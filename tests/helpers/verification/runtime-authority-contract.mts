import {readHostHtml} from '../../../build/host-source.mts';
import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';

const app=readHostHtml();
const startupHost=readScript('source/core/startup-host.ts');
const persistence=readScript('source/core/persistence.ts');


const identitySource=persistence.slice(persistence.indexOf('function createInstallationIdentity'),persistence.indexOf('function normalizeTimestamp'));
assert.doesNotMatch(identitySource,/legacyDeviceId|compatibilityDeviceId|retireLegacy|verifyRetired/u,'normal persistence identity capability must be current-only');

const hydrateStart=app.indexOf('async function hydrateProtectedPreferences(');
const hydrateEnd=app.indexOf('async function flushProtectedPreferences(',hydrateStart);
const hydrateBlock=app.slice(hydrateStart,hydrateEnd);
assert.match(hydrateBlock,/protectedPreferencesHydrated&&!force/u,'ordinary hydration may reuse current in-memory Preferences');
assert.match(startupHost,/hydrateSavedDrafts\(freeze\(\{forcePreferences:true,failClosed:true,assertOrigin:assertCurrent\}\)\)/u,'ownership takeover must force a fresh canonical Preferences read before becoming writable');
assert.match(app,/StartupHostModule\.createOwnershipController/u,'host ownership startup composition must cross the checked startup-host boundary');
assert.doesNotMatch(app,/OwnershipModule\.createOwnershipController\(Object\.freeze/u,'host must not retain duplicate direct ownership startup composition');
assert.match(startupHost,/let planError[\s\S]*preferencesError[\s\S]*try\{await p\.hydratePlan\(assertOrigin\);\}[\s\S]*try\{await p\.hydratePreferences\(\{force:forcePreferences,\.\.\.\(assertOrigin\?\{assertOrigin\}:\{\}\)\}\);\}/u,'Plan and Preferences hydration failures are isolated');
assert.match(startupHost,/if\(planError\)p\.projectPlan\(\{fallback:true\}\);else\{p\.projectPlan\(\);p\.renderSavedPlans\(\);\}/u,'Preferences failure must not force Plan fallback');
assert.match(app,/if\(!appCanMutate\(\)\|\|!protectedPreferencesHydrated\)return false;/u,'portable Preferences writes must be blocked when canonical Preferences are not hydrated');

const appearance=readScript('source/core/presentation-host.ts');
for(const [start,end] of [['applyTheme','setTheme'],['applyPresentation','setPresentation'],['setFontScale','stepFontScale']]){
  const method=appearance.indexOf('function '+start+'('),next=appearance.indexOf('function '+end+'(',method);
  assert.ok(method>=0&&next>method);
  assert.doesNotMatch(appearance.slice(method,next),/(?:storage|AppData\.local)\.setText/u,'appearance mirrors wait for canonical persistence');
}
const flushStart=app.indexOf('async function flushProtectedPreferences('),flushEnd=app.indexOf('function scheduleProtectedPreferencesWrite()',flushStart);
const flushBlock=app.slice(flushStart,flushEnd);
const committed=flushBlock.indexOf('const saved=await run;');
assert.ok(committed>=0&&committed<flushBlock.indexOf('refreshAppearanceMirrors(saved)'),'appearance mirrors must refresh only after the canonical write resolves');


const maintenance=readScript('source/core/backup-maintenance-host.ts');
assert.match(maintenance,/function schedule\([\s\S]*?if\(!authority\.fullyInitialized\(\)\)return false;/u);
assert.match(maintenance,/function backgroundBlocker\([\s\S]*?if\(!authority\.fullyInitialized\(\)\)return 'startup';/u);
assert.match(startupHost,/markReady:async proof=>\{[\s\S]*proof\.canonical!==true[\s\S]*p\.reseedEpoch\(\)[\s\S]*p\.scheduleMaintenance\(\);/u,'maintenance follows verified canonical startup');


const plan=readScript('source/core/plan-host.ts');
const importStart=plan.indexOf('async function importData('),importEnd=plan.indexOf('async function verify(',importStart);
assert.ok(importStart>=0&&importEnd>importStart);
const projectionStart=plan.indexOf('function projectReplacement(');
assert.ok(projectionStart>=0&&projectionStart<importStart);
const applyPreferences=plan.slice(projectionStart,importEnd);
assert.match(plan.slice(importStart,importEnd),/projectReplacement\(clean\.plans,portable\)/u,'ordinary import must use the checked projection owner');
assert.match(applyPreferences,/preferences\.accept\(portable\)[\s\S]*?preferences\.applyRuntime\(portable\)/u);
assert.doesNotMatch(applyPreferences,/keepScreenAwake|systemAlerts/u,'portable backup import must not touch destination device-local settings');

console.log(JSON.stringify({status:'PASS',suite:'runtime-authority-contract',installationIdentityCurrentOnly:true,ownershipTakeoverFreshPreferences:true,mirrorCommitOrdering:true,canonicalOnly:true,deviceLocalImportPreserved:true,independentHydrationFailureDomains:true,startupMaintenanceGated:true},null,2));
