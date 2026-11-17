import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const runtime=read('source/external/insights-runtime.ts');
const host=read('source/core/insights-host.ts');
const app=read('source/host/main.js');
const manifest=read('build/module-manifest.mjs');
const legacy=read('source/external/insights.js');

assert.match(runtime,/StudyDirector\?\.data\?\.deviceState/u,'Insights runtime must consume only the public bounded device-state capability');
assert.match(host,/function createDeviceState\(input[\s\S]{0,620}readInsightsWindow:[\s\S]{0,140}input\.readWindow[\s\S]{0,220}writeInsightsWindow:[\s\S]{0,140}input\.writeWindow/u,'checked Insights host owns bounded window persistence');
assert.match(host,/function createPreloadScheduler\(input[\s\S]{0,900}visibilityState==='hidden'[\s\S]{0,900}requestTab/u,'checked Insights host owns delayed visible-page preload policy');
assert.match(app,/const InsightsDeviceState=InsightsHostModule\.createDeviceState\(Object\.freeze\(\{[\s\S]{0,300}AppData\.local\.getText\(STORAGE_KEYS\.insightsWindow[\s\S]{0,260}AppData\.local\.setText\(STORAGE_KEYS\.insightsWindow/u,'main must only inject bounded window storage adapters');
assert.match(app,/const InsightsPreload=InsightsHostModule\.createPreloadScheduler\(Object\.freeze\(\{[\s\S]{0,520}requestTab:\(\)=>PluginRuntime\.requestTab\('insights'\)/u,'main must only inject the generic plugin request into checked Insights preload policy');
assert.match(app,/preloadInsights:InsightsPreload\.schedule/u,'startup must call the checked feature-owned preload scheduler');
assert.match(app,/deviceState:InsightsDeviceState/u,'public API must expose the checked device-state capability');
assert.match(runtime,/const register=window\.StudyDirector&&window\.StudyDirector\.registerPlugin;[\s\S]{0,260}register\(PLUGIN_DESCRIPTOR\)===true/u,'checked Insights runtime must retain public plugin registration');
assert.match(runtime,/if\(!supportsCapabilities\(api,REQUIRED_CAPABILITIES\)[\s\S]{0,360}return false/u,'checked Insights registration must fail closed when required capabilities are unavailable');
assert.match(runtime,/if\(api&&typeof api\.registerPlugin==='function'\)connectPlugin\(\);[\s\S]{0,180}addEventListener\(PLUGIN_READY_EVENT,connectPlugin,\{once:true\}\)/u,'checked Insights runtime must preserve immediate-or-ready-event startup ordering');
assert.match(runtime,/if\(!registered\)\{view\.dispose\(\);return false;\}/u,'failed plugin registration must dispose view-owned listeners and worker resources before retry');
assert.match(runtime,/ready:async\(\)=>\{await state\.navigationReady;await restoreScroll\(\);return true;\}/u,'tab readiness must await scroll restoration rather than only scheduling it');
assert.doesNotMatch(runtime,/await void restoreScroll\(\)/u,'scroll restoration must never be accidentally converted to an immediately resolved await');
assert.match(runtime,/state\.renderRollback=Object\.freeze\(\{pane,token,nodes:Object\.freeze\(priorNodes\)\}\)[\s\S]{0,900}renderMetrics\.cancelled\|\|!InsightsRenderCoordinator\.isCurrent\(token\)[\s\S]{0,220}restoreInterruptedRender\(\)/u,'superseded progressive refreshes must roll back to the last complete retained view');
assert.match(app,/const PluginRuntime=\(\(\)=>\{/u,'shared generic plugin-loader mechanics must remain host-owned for P5.13');
assert.doesNotMatch(runtime,/AppData\.|localStorage|indexedDB/u,'Insights retained runtime must not reach host persistence directly');
assert.doesNotMatch(runtime,/\beval\s*\(|new Function\s*\(/u,'Insights runtime must not use string-to-code execution');
assert.doesNotMatch(runtime,/querySelector(?:All)?\(`[^`]*\$\{/u,'Insights runtime values must not be interpolated into CSS selectors');
assert.match(manifest,/external\/insights-rendering\.ts','external\/insights-runtime\.ts','external\/insights\.js'/u,'one generated Insights asset must keep renderer then checked retained runtime then inert tracked shell');
assert.doesNotMatch(legacy,/\b(?:const|let|var|function)\b|=>|\(\)\s*\{/u,'legacy Insights shell must remain non-executable until separately authorized deletion');

const workerExit=runtime.indexOf("if(typeof document==='undefined'&&typeof self!=='undefined'&&typeof self.postMessage==='function')return;");
const renderer=runtime.indexOf('const InsightsRendering=createInsightsRendering');
assert.ok(workerExit>=0&&renderer>workerExit,'worker context must exit before retained/browser DOM runtime construction');

console.log(JSON.stringify({
  status:'PASS',suite:'insights-runtime-boundary',
  checkedHostPorts:true,genericLoaderDeferred:true,workerExitBeforeDom:true,inertLegacyShell:true,staticSelectors:true,noStringCode:true,retainedRollback:true,readyAwaitsScroll:true,registrationCleanup:true
}));
