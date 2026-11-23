import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readRuntimeSource} from '../../helpers/runtime-source.mjs';

for(const file of ['source/core/internal.ts','source/core/public-api-host.ts'])vm.runInThisContext(readRuntimeSource(file),{filename:file});
const module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('public-api-host',1),freeze=Object.freeze;
let activeTab='plan',renders=0,setupCalls=0,previewRegistrations=0;
const scripts=[],tabs=new Map();

function scriptElement(){
  return {async:true,dataset:{},src:'',onload:null,onerror:null,removed:false,remove(){this.removed=true;}};
}
const document={
  head:{appendChild(node){scripts.push(node);return node;}},
  createElement(tag){if(tag==='script')return scriptElement();throw new Error('Unexpected element: '+tag);},
  getElementById(){return null;},
  querySelector(selector){return selector==='.nav-item.on[data-tab]'?{dataset:{tab:activeTab}}:null;}
};
const tabPort=freeze({
  registerTab(config){const id=String(config?.id||'');if(!id)return false;tabs.set(id,config);return true;},
  renderTab(){renders++;return true;}
});
const runtime=module.createRuntime(freeze({
  configuration:freeze({
    capabilities:freeze({pluginApi:1,tabRegistry:1,previewRecords:1}),
    descriptors:freeze([freeze({tabId:'guide',label:'Guide',icon:'?',src:'guide.js',pluginName:'SD-guide'})])
  }),
  environment:freeze({document,trustedAssetURL:value=>value}),
  tabs:tabPort,
  preview:freeze({registerProvider(target,provider){assert.equal(target,'insights');assert.equal(typeof provider,'function');previewRegistrations++;return true;}}),
  clampText:(value,max)=>String(value||'').slice(0,max)
}));
assert.equal(runtime.registerPlaceholders(),true);
assert.equal(runtime.registerPlaceholders(),true);
assert.equal([...tabs.keys()].filter(id=>id==='guide').length,1,'placeholder registration is idempotent');
const rejectingRuntime=module.createRuntime(freeze({
  configuration:freeze({
    capabilities:freeze({pluginApi:1,tabRegistry:1,previewRecords:1}),
    descriptors:freeze([freeze({tabId:'guide',label:'Guide',icon:'?',src:'guide.js',pluginName:'SD-guide'})])
  }),
  environment:freeze({document,trustedAssetURL:value=>value}),
  tabs:freeze({registerTab:()=>false,renderTab:()=>null}),
  preview:freeze({registerProvider:()=>true}),
  clampText:(value,max)=>String(value||'').slice(0,max)
}));
assert.equal(rejectingRuntime.registerPlaceholders(),false,'placeholder registration must surface a broken shell to host composition');

const failureRuntimeInput=freeze({
  configuration:freeze({
    capabilities:freeze({pluginApi:1,tabRegistry:1,previewRecords:1}),
    descriptors:freeze([freeze({tabId:'guide',label:'Guide',icon:'?',src:'guide.js',pluginName:'SD-guide'})])
  }),
  tabs:tabPort,
  preview:freeze({registerProvider:()=>true}),
  clampText:(value,max)=>String(value||'').slice(0,max)
});
const failureRuntimeWith=environment=>module.createRuntime(freeze({...failureRuntimeInput,environment:freeze(environment)}));
let blockAssetUrl=true;
const recoveredScripts=[];
const blockedAssetRuntime=failureRuntimeWith({
  document:{...document,head:{appendChild(node){recoveredScripts.push(node);return node;}}},
  trustedAssetURL(value){if(blockAssetUrl)throw new TypeError('Trusted URL rejected');return value;}
});
assert.equal(await blockedAssetRuntime.requestTab('guide'),false,'a rejected asset URL must settle the optional-load request instead of rejecting it');
assert.equal(blockedAssetRuntime.status().optionalFiles[0].state,'failed','URL-preparation failure must become retryable');
assert.equal(blockedAssetRuntime.status().optionalFiles[0].attempts,1);
blockAssetUrl=false;
const recoveredRequest=blockedAssetRuntime.requestTab('guide',{retry:true});
assert.equal(recoveredScripts.length,1,'a failed preflight must not append its script, and a retry must append once');
recoveredScripts[0].onload?.call(recoveredScripts[0],new Event('load'));
assert.equal(await recoveredRequest,false,'a successfully fetched script without plugin registration is still not registered');
assert.equal(blockedAssetRuntime.status().optionalFiles[0].state,'loaded');
assert.equal(blockedAssetRuntime.status().optionalFiles[0].attempts,2);

const rejectedAppendRuntime=failureRuntimeWith({
  document:{...document,head:{appendChild(){throw new Error('Script insertion refused');}}},
  trustedAssetURL:value=>value
});
assert.equal(await rejectedAppendRuntime.requestTab('guide'),false,'DOM insertion failure must settle instead of leaving an unhandled rejected promise');
assert.equal(rejectedAppendRuntime.status().optionalFiles[0].state,'failed','DOM insertion failure must be classified as retryable');
assert.equal(rejectedAppendRuntime.status().optionalFiles[0].attempts,1);

activeTab='guide';
const first=runtime.requestTab('guide'),coalesced=runtime.requestTab('guide');
assert.equal(first,coalesced,'pending optional loads must coalesce');
assert.equal(scripts.length,1);assert.equal(scripts[0].dataset.studyDirectorPluginTab,'guide');
const rendersBeforeLateFailure=renders;activeTab='plan';scripts[0].onerror?.call(scripts[0],new Event('error'));
assert.equal(await first,false);assert.equal(renders,rendersBeforeLateFailure,'late failure must not render an inactive optional tab');
assert.equal(runtime.status().optionalFiles[0].state,'missing');

const noop=()=>true,mutableThemeMetadata=[];
const publicApiInput=freeze({
  version:'SDVQ1',
  data:freeze({contract:freeze({}),deviceState:freeze({readInsightsWindow:()=>'',writeInsightsWindow:noop})}),
  insights:freeze({notifications:freeze({}),dataSource:freeze({})}),
  logic:freeze({classifyTaskOutcome:noop,summarizePracticeRuns:noop}),
  plan:freeze({getDraft:()=>'',loadDraft:async()=>freeze({ok:true})}),
  preview:freeze({useSample:async()=>freeze({ok:true}),setRecords:noop,clear:noop}),
  backup:freeze({
    createCheckpoint:noop,inspect:noop,releaseFile:noop,receiveStream:noop,checksum:noop,restore:noop,downloadSafetyCopy:noop,maxFileBytes:1024,
    repositoryPolicy:freeze({}),device:()=> 'device',
    profile:freeze({id:()=> 'profile',name:()=> 'Profile',bind:noop,deleted:noop,controls:noop}),
    providers:freeze({register:noop,list:()=>freeze([])})
  }),
  installation:freeze({status:()=>freeze({}),promptInstall:noop,inspectInstallation:noop,revealInstallHelp:noop}),
  appearance:freeze({
    theme:freeze({defaultId:'dark',supported:mutableThemeMetadata,get:()=> 'dark',set:()=> 'dark'}),
    presentation:freeze({defaultId:'glass',invariants:freeze({}),breakpoints:freeze({}),tokens:freeze({contractVersion:1,public:freeze({}),internal:freeze({})}),manifest:freeze({}),list:()=>freeze([]),register:noop,get:()=> 'glass',set:()=> 'glass'})
  }),
  ui:freeze({
    registerTab:tabPort.registerTab,goTab:async()=>true,navigationStatus:()=>freeze({}),
    workspaceHistory:freeze({register:noop,open:noop,replace:noop,close:noop,closed:noop})
  })
});
const publicApi=runtime.createPublicApi(publicApiInput);
assert.ok(Object.isFrozen(publicApi)&&Object.isFrozen(publicApi.backup)&&Object.isFrozen(publicApi.installation)&&Object.isFrozen(publicApi.appearance)&&Object.isFrozen(publicApi.appearance.theme)&&Object.isFrozen(publicApi.appearance.theme.supported)&&Object.isFrozen(publicApi.ui),'public API and nested capability groups must be frozen');
assert.equal(Object.isFrozen(mutableThemeMetadata),false,'public API construction must not freeze the host input array in place');assert.notEqual(publicApi.appearance.theme.supported,mutableThemeMetadata,'public API must publish its own frozen theme-metadata collection');
const budgetScripts=[];
const budgetRuntime=failureRuntimeWith({
  document:{...document,head:{appendChild(node){budgetScripts.push(node);return node;}}},trustedAssetURL:value=>value
});
const budgetApi=budgetRuntime.createPublicApi(publicApiInput),budgetLoad=budgetRuntime.requestTab('guide');
assert.equal(budgetScripts.length,1);
let exhaustedSetupCalls=0;
const exhaustedPlugin={name:'SD-guide',version:'qa-exhausted',setup(){exhaustedSetupCalls++;return false;}};
assert.equal(budgetApi.registerPlugin(exhaustedPlugin),false);assert.equal(budgetApi.registerPlugin(exhaustedPlugin),false);
budgetScripts[0].onload?.call(budgetScripts[0],new Event('load'));
assert.equal(await budgetLoad,false);assert.equal(exhaustedSetupCalls,2);assert.equal(budgetRuntime.status().registered.find(row=>row.name==='SD-guide')?.attempts,2);
const scriptsBeforeExhaustedRetry=budgetScripts.length;
assert.equal(await budgetRuntime.requestTab('guide',{retry:true}),false,'an exhausted registration budget must not offer another script-load attempt');
assert.equal(budgetScripts.length,scriptsBeforeExhaustedRetry,'registration exhaustion must not append a futile retry script');

assert.equal(runtime.createPublicApi(freeze({
  version:'ignored',data:publicApi.data,insights:publicApi.insights,logic:publicApi.logic,plan:publicApi.plan,preview:publicApi.preview,
  backup:freeze({createCheckpoint:noop,inspect:noop,releaseFile:noop,receiveStream:noop,checksum:noop,restore:noop,downloadSafetyCopy:noop,maxFileBytes:1,repositoryPolicy:freeze({}),device:()=>'',profile:freeze({id:()=>'',name:()=>'',bind:noop,deleted:noop,controls:noop}),providers:freeze({register:noop,list:()=>[]})}),
  installation:freeze({status:()=>freeze({}),promptInstall:noop,inspectInstallation:noop,revealInstallHelp:noop}),
  appearance:freeze({theme:freeze({defaultId:'x',supported:freeze([]),get:()=>'',set:()=>''}),presentation:freeze({defaultId:'x',invariants:freeze({}),breakpoints:freeze({}),tokens:freeze({contractVersion:1,public:null,internal:null}),manifest:freeze({}),list:()=>[],register:noop,get:()=>'',set:()=>''})}),
  ui:publicApi.ui
})),publicApi,'public API construction must be single-assignment');

let malformedSetup=0;
for(const plugin of [
  {setup(){malformedSetup++;return true;}},
  {name:'qa-bad-version',version:1,setup(){malformedSetup++;return true;}},
  {name:'qa-bad-requirements',requires:{pluginApi:'1'},setup(){malformedSetup++;return true;}},
  {name:'qa-bad-preview',previewProviders:{insights:'not-a-provider'},setup(){malformedSetup++;return true;}}
])assert.equal(publicApi.registerPlugin(plugin),false,'malformed public plugin descriptors must fail closed');
assert.equal(malformedSetup,0,'malformed plugin descriptors must be rejected before setup');
const hostileDescriptor={get name(){throw new Error('hostile descriptor getter');},setup(){return true;}};
assert.equal(publicApi.registerPlugin(hostileDescriptor),false,'descriptor parsing failures must be contained at the public API boundary');
let prototypeSetup=0;
const prototypeRequirements=Object.fromEntries([['__proto__',1]]);
assert.equal(publicApi.registerPlugin({name:'qa-prototype-requirement',requires:prototypeRequirements,setup(){prototypeSetup++;return true;}}),false,'prototype-like capability keys must not resolve through Object.prototype');
assert.equal(prototypeSetup,0,'prototype-like missing capability must reject before setup');

let contextPreserved=false;
const contextPlugin={name:'qa-method-context',setup(){contextPreserved=this===contextPlugin;return true;}};
assert.equal(publicApi.registerPlugin(contextPlugin),true);
assert.equal(contextPreserved,true,'plugin setup keeps the original descriptor as its method receiver');

let incompatibleSetup=0;
assert.equal(publicApi.registerPlugin({name:'qa-incompatible',requires:{missingCapability:1},setup(){incompatibleSetup++;return true;}}),false);
assert.equal(incompatibleSetup,0,'capability rejection must happen before plugin setup');
assert.equal(publicApi.registerPlugin({name:'qa-incompatible',requires:{missingCapability:1},setup(){incompatibleSetup++;return true;}}),false);
assert.equal(incompatibleSetup,0,'incompatible registration remains inert');

activeTab='guide';
const retry=runtime.requestTab('guide',{retry:true});
assert.equal(scripts.length,2);
const provider=()=>freeze([]);
const guidePlugin={
  name:'SD-guide',version:'qa',requires:{pluginApi:1,tabRegistry:1},
  previewProviders:{insights:provider},
  setup(api){setupCalls++;return api.ui.registerTab({id:'guide',label:'Guide',icon:'?',render:noop});}
};
assert.equal(publicApi.registerPlugin(guidePlugin),true);
assert.equal(publicApi.registerPlugin(guidePlugin),true);
assert.equal(setupCalls,1,'a successful plugin must set up exactly once');
assert.equal(previewRegistrations,1,'preview provider registration must happen exactly once');
scripts[1].onload?.call(scripts[1],new Event('load'));
assert.equal(await retry,true);
assert.equal(runtime.status().optionalFiles[0].state,'registered');
const registeredStatus=runtime.status();
assert.equal(registeredStatus.registered.find(row=>row.name==='SD-guide')?.attempts,1);
assert.ok(Object.isFrozen(registeredStatus)&&Object.isFrozen(registeredStatus.optionalFiles)&&Object.isFrozen(registeredStatus.registered),'plugin status snapshots and collections must be immutable');
const guideStatus=registeredStatus.registered.find(row=>row.name==='SD-guide');
assert.ok(guideStatus&&Object.isFrozen(guideStatus),'registration status rows must not expose mutable runtime-map records');
assert.throws(()=>{guideStatus.attempts=99;},TypeError);
assert.equal(runtime.status().registered.find(row=>row.name==='SD-guide')?.attempts,1,'mutating a returned status row must not corrupt internal plugin state');
assert.equal(runtime.requestTab('missing'),null);

console.log(JSON.stringify({status:'PASS',suite:'public-api-host',placeholderFailureSurfaced:true,coalesced:true,retry:true,inactiveRenderFence:true,descriptorValidation:true,hostileDescriptorContained:true,prototypeSafeCapabilities:true,setupContextPreserved:true,capabilityGate:true,singleRegistration:true,registrationBudgetRetryFence:true,frozenThemeMetadata:true,immutableStatus:true,frozenPublicApi:true}));
