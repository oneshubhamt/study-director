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
  checkedHostPorts:true,genericLoaderDeferred:true,workerExitBeforeDom:true,inertLegacyShell:true,staticSelectors:true,noStringCode:true
}));
