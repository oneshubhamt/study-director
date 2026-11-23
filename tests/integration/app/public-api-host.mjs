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

activeTab='guide';
const first=runtime.requestTab('guide'),coalesced=runtime.requestTab('guide');
assert.equal(first,coalesced,'pending optional loads must coalesce');
assert.equal(scripts.length,1);assert.equal(scripts[0].dataset.studyDirectorPluginTab,'guide');
const rendersBeforeLateFailure=renders;activeTab='plan';scripts[0].onerror?.call(scripts[0],new Event('error'));
assert.equal(await first,false);assert.equal(renders,rendersBeforeLateFailure,'late failure must not render an inactive optional tab');
assert.equal(runtime.status().optionalFiles[0].state,'missing');

const noop=()=>true;
const publicApi=runtime.createPublicApi(freeze({
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
    theme:freeze({defaultId:'dark',supported:freeze([]),get:()=> 'dark',set:()=> 'dark'}),
    presentation:freeze({defaultId:'glass',invariants:freeze({}),breakpoints:freeze({}),tokens:freeze({contractVersion:1,public:freeze({}),internal:freeze({})}),manifest:freeze({}),list:()=>freeze([]),register:noop,get:()=> 'glass',set:()=> 'glass'})
  }),
  ui:freeze({
    registerTab:tabPort.registerTab,goTab:async()=>true,navigationStatus:()=>freeze({}),
    workspaceHistory:freeze({register:noop,open:noop,replace:noop,close:noop,closed:noop})
  })
}));
assert.ok(Object.isFrozen(publicApi)&&Object.isFrozen(publicApi.backup)&&Object.isFrozen(publicApi.installation)&&Object.isFrozen(publicApi.appearance)&&Object.isFrozen(publicApi.ui),'public API and nested capability groups must be frozen');
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
assert.equal(runtime.status().registered.find(row=>row.name==='SD-guide')?.attempts,1);
assert.equal(runtime.requestTab('missing'),null);

console.log(JSON.stringify({status:'PASS',suite:'public-api-host',coalesced:true,retry:true,inactiveRenderFence:true,descriptorValidation:true,capabilityGate:true,singleRegistration:true,frozenPublicApi:true}));
