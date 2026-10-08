import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {renderBuild,validateBuild} from '../../../build/build.mjs';
import {externalModules,privateModules} from '../../../build/module-manifest.mjs';

const build=renderBuild();assert.equal(validateBuild(build),true);
const descriptor=externalModules.find(row=>row.id==='world');
const workerDescriptor=externalModules.find(row=>row.id==='world-worker');
assert.equal(descriptor.execution,'on-demand');assert.equal(workerDescriptor.execution,'worker');
assert.equal(descriptor.isolated,true);assert.equal(workerDescriptor.isolated,true);
assert.ok(privateModules.every(row=>!row.source.includes('/world')));
const world=fs.readFileSync('source/external/world.js','utf8');

// Setup receives poisoned canonical capabilities. Only tab registration is usable.
let plugin=null,tab=null;
const pane={};const elements=new Map([['pane-world',pane]]);
const context=vm.createContext({
 window:{StudyDirector:{registerPlugin(value){plugin=value;return true;}}},
 document:{getElementById:id=>elements.get(id)||null,createElement:()=>({}),head:{appendChild(node){elements.set(node.id,node);}}},
 MutationObserver:class{observe(target){assert.equal(target,pane);}},
 localStorage:new Proxy({}, {get(){throw Error('Setup must not open any storage.');}})
});
vm.runInContext(world,context);
assert.equal(plugin.name,'SD-world');assert.deepEqual({...plugin.requires},{pluginApi:1,tabRegistry:1});
const canonical=new Proxy({}, {get(_target,key){if(key==='ui')return {registerTab(value){tab=value;return true;}};throw Error(`Forbidden canonical capability ${String(key)}`);}});
assert.equal(plugin.setup(canonical),true);assert.equal(tab.id,'world');assert.equal(tab.label,'Living World');assert.equal(tab.ready(),true);

// The exact generated worker processes neutral inputs without a host or storage.
let receive=null;const responses=[];
const self={importScripts(){throw Error('World worker must be self-contained.');},
 addEventListener(type,handler){assert.equal(type,'message');receive=handler;},postMessage(value){responses.push(value);}};
const isolated=vm.createContext({self,structuredClone,
 localStorage:new Proxy({}, {get(){throw Error('Worker reached storage.');}}),
 indexedDB:new Proxy({}, {get(){throw Error('Worker reached canonical IndexedDB.');}})
});
const workerName=build.externalNames.deployment.get('world-worker');
vm.runInContext(build.deployment.get(workerName),isolated);
assert.equal(typeof receive,'function');assert.equal(isolated.SDWorldPlanetGeneratorEngine,undefined);
function request(requestId,operation,payload){
 receive({data:{format:'study-director.world.planet-worker-request',version:1,requestId,operation,...payload}});
 const response=responses.pop();assert.ok(response,`Missing ${operation} response`);assert.equal(response.ok,true,response.error?.message);return response.result;
}
const options={seed:'0123456789abcdef0123456789abcdef',level:2};
const planet=request('generate-1','generate',{options});
const same=request('generate-2','generate',{options});
assert.equal(planet.cellCount,320);assert.equal(planet.audit.fingerprintMatches,true);assert.equal(planet.fingerprint,same.fingerprint);
const neutralContext=vm.createContext({});vm.runInContext(fs.readFileSync('source/external/world/behaviour-engine.js','utf8'),neutralContext);
const timeline=vm.runInContext("SDWorldBehaviourEngine.buildTimeline([],{currentStudyDate:'2026-10-08',datasetRevision:'standalone-neutral-v1'})",neutralContext);
const ecology=request('ecology','evolve-ecology',{planet,timeline});
assert.equal(ecology.state.audit.fingerprintMatches,true);assert.equal(ecology.state.source.planetFingerprint,planet.fingerprint);
assert.equal(timeline.source.recordCount,0);assert.equal(timeline.current.lifetime.evidence.effectiveMinutes,0);
const systems=request('systems','build-systems',{planet,ecology:ecology.state,when:{localDateTime:'2026-10-08T12:00:00',timezoneOffsetMinutes:0}});
assert.equal(systems.atmosphere.audit.fingerprintMatches,true);assert.equal(systems.wildlife.audit.fingerprintMatches,true);
receive({data:{format:'study-director.world.planet-worker-request',version:1,requestId:'bad',operation:'write-app-record'}});
assert.equal(responses.pop().ok,false);

// A Trusted Types worker policy must reject every asset except its own same-origin filename.
const started=[];const runtime=vm.createContext({location:{href:'https://example.test/app/index.html',origin:'https://example.test'},URL,
 Worker:class{constructor(url){started.push(String(url));}},trustedTypes:{createPolicy(name,rules){assert.equal(name,'sd-world-worker');return rules;}}});
vm.runInContext(fs.readFileSync('source/external/world/worker-runtime.js','utf8').replaceAll('@@SD_WORLD_PLANET_WORKER_FILENAME@@',workerName),runtime);
vm.runInContext(`new SDWorldWorkerRuntime.Worker('https://example.test/app/${workerName}')`,runtime);
assert.equal(started.length,1);
for(const url of ['https://evil.test/'+workerName,'https://example.test/app/sw.js','blob:https://example.test/123','javascript:alert(1)'])
 assert.throws(()=>vm.runInContext(`new SDWorldWorkerRuntime.Worker(${JSON.stringify(url)})`,runtime),/Unapproved Living World worker/);
assert.equal(started.length,1);
console.log(JSON.stringify({status:'PASS',checks:['narrow-plugin-capabilities','isolated-lazy-build','deterministic-worker-planet','neutral-ecology-and-natural-systems','closed-worker-protocol','restricted-worker-urls']},null,2));
