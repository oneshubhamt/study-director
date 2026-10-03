import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync('source/app.html','utf8');
const startup=fs.readFileSync('source/core/startup.js','utf8');
const persistence=fs.readFileSync('source/core/persistence.js','utf8');
const compatibilityHost=fs.readFileSync('source/core/compatibility-host.js','utf8');

const identitySource=persistence.slice(persistence.indexOf('function createInstallationIdentity'),persistence.indexOf('function normalizeTimestamp'));
assert.doesNotMatch(identitySource,/legacyDeviceId|compatibilityDeviceId|retireLegacy|verifyRetired/u,'normal persistence identity capability must be current-only');

const hydrateStart=app.indexOf('async function hydrateProtectedPreferences({force=false}={})');
const hydrateEnd=app.indexOf('async function flushProtectedPreferences()',hydrateStart);
const hydrateBlock=app.slice(hydrateStart,hydrateEnd);
assert.match(hydrateBlock,/protectedPreferencesHydrated&&!force/u,'ordinary hydration may reuse current in-memory Preferences');
assert.match(app,/hydrateSavedDrafts\(\{forcePreferences:true,failClosed:true\}\)/u,'ownership takeover must force a fresh canonical Preferences read before becoming writable');
assert.match(app,/let planError=null,preferencesError=null;[\s\S]{0,260}try\{await PlanData\.hydrate\(\);\}[\s\S]{0,260}try\{await hydrateProtectedPreferences\(\{force:forcePreferences\}\);\}/u,'Plan and Preferences hydration failures must be isolated rather than sharing one Promise.all failure domain');
assert.match(app,/if\(planError\)PlanRuntime\.hydrate\(\{fallback:true\}\);\s*else\{PlanRuntime\.hydrate\(\);PlanRuntime\.savedPlans\.render\(\);\}/u,'Preferences failure must not force Plan fallback when Plan hydration succeeded');
assert.match(app,/if\(!appCanMutate\(\)\|\|!protectedPreferencesHydrated\)return false;/u,'portable Preferences writes must be blocked when canonical Preferences are not hydrated');

const themeStart=app.indexOf('function applyTheme('),themeEnd=app.indexOf('function setTheme(',themeStart);
const presentationStart=app.indexOf('function applyPresentation('),presentationEnd=app.indexOf('function setPresentation(',presentationStart);
const fontStart=app.indexOf('function setFontScale('),fontEnd=app.indexOf('function stepFontScale(',fontStart);
assert.doesNotMatch(app.slice(themeStart,themeEnd),/AppData\.local\.setText/u,'theme mirror must not advance before canonical persistence succeeds');
assert.doesNotMatch(app.slice(presentationStart,presentationEnd),/AppData\.local\.setText/u,'presentation mirror must not advance before canonical persistence succeeds');
assert.doesNotMatch(app.slice(fontStart,fontEnd),/AppData\.local\.setText/u,'font mirror must not advance before canonical persistence succeeds');
const flushStart=app.indexOf('async function flushProtectedPreferences('),flushEnd=app.indexOf('function scheduleProtectedPreferencesWrite()',flushStart);
const flushBlock=app.slice(flushStart,flushEnd);
assert.ok(flushBlock.indexOf('const saved=await run;')<flushBlock.indexOf('refreshAppearanceMirrors(saved)'),'appearance mirrors must refresh only after the canonical write resolves');
assert.match(startup,/lifecycle\.flush-preferences/u,'page/background lifecycle must proactively flush a pending Preferences write');

const migrationStart=compatibilityHost.indexOf('async function migratePlan(){');
const migrationEnd=compatibilityHost.indexOf('async function migrateReflections(){',migrationStart);
const migration=compatibilityHost.slice(migrationStart,migrationEnd);
assert.ok(migrationStart>=0&&migrationEnd>migrationStart,'legacy Plan/Preferences migration must remain isolated in the compatibility host');
assert.match(migration,/if\(!currentPreferences\)\{/u,'legacy mirrors are migration inputs only when no current PortablePreferences.v2 row exists');
assert.ok(migration.indexOf('const written=await preferences.write(next')<migration.indexOf('local.remove(obsolete.nudge)'),'legacy nudge authority must survive until canonical Preferences are written and verified');
assert.match(app,/CompatibilityHostModule\.createFacade/u,'ordinary runtime must consume the isolated compatibility host instead of re-embedding migration logic');


const maintenanceStart=app.indexOf('function scheduleDataMaintenance(delay=1200');
const maintenanceEnd=app.indexOf('/* ONGOING SUBJECT NOTES */',maintenanceStart);
const maintenanceBlock=app.slice(maintenanceStart,maintenanceEnd);
assert.match(maintenanceBlock,/if\(!StartupLifecycle\.status\(\)\.fullyInitialized\)return false;/u,'data maintenance must not start before compatibility migration and canonical startup verification complete');
const maintenanceAdmission=app.slice(app.indexOf('const DataMaintenanceJob=OperationLifecycle.createJob('),maintenanceStart);
assert.match(maintenanceAdmission,/isAvailable:\(\)=>!StartupLifecycle\.status\(\)\.fullyInitialized\?'startup'/u,'the owned maintenance job must recheck startup at execution admission');
assert.match(app,/markReady:async proof=>\{[\s\S]*proof&&proof\.canonical===true[\s\S]*AppData\.mutationEpoch\.reseed\(\)[\s\S]*scheduleDataMaintenance\(\);/u,'initial maintenance must remain inside the verified-ready boundary after canonical epoch reseeding');
assert.match(app,/normalizePracticeTargetMs:value=>validPracticeMs\(value,\{min:APP_LIMITS\.minPracticeTargetMs\}\)\|\|null/u,'historical optional Practice targets must normalize absent/invalid values to null rather than zero');

const applyPreferencesStart=app.indexOf('async function applyPreferences(raw)');
const applyPreferencesEnd=app.indexOf('async function importData(value)',applyPreferencesStart);
const applyPreferences=app.slice(applyPreferencesStart,applyPreferencesEnd);
assert.doesNotMatch(applyPreferences,/keepScreenAwake|systemAlerts/u,'portable backup import must not touch destination device-local settings');

console.log(JSON.stringify({status:'PASS',suite:'runtime-authority-contract',installationIdentityCurrentOnly:true,ownershipTakeoverFreshPreferences:true,mirrorCommitOrdering:true,migrationPrecedence:true,deviceLocalImportPreserved:true,independentHydrationFailureDomains:true,startupMaintenanceGated:true,optionalPracticeTargetCanonical:true},null,2));
