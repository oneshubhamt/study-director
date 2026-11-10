import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

for(const path of ['source/core/internal.ts','source/core/plan-host.ts'])vm.runInThisContext(readRuntimeSource(path),{filename:path});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const PlanHostModule=registry.require('plan-host',1);
const freeze=Object.freeze;
const clone=value=>structuredClone(value);
const emptyPreferences=()=>({studentName:null,theme:null,presentation:null,quote:null,practiceCueMode:null,fontScale:null,practiceTargetMs:null,nudge:null});

function cleanPlans(raw){
  if(!raw||!Array.isArray(raw.savedPlans)||!Object.hasOwn(raw,'draft')||!Object.hasOwn(raw,'defaultId'))throw new Error('invalid plans');
  if(raw.defaultId!==null&&!raw.savedPlans.some(plan=>plan.id===raw.defaultId))throw new Error('missing default');
  return clone({draft:raw.draft,savedPlans:raw.savedPlans,defaultId:raw.defaultId});
}
const codec=freeze({
  plans:cleanPlans,
  preferences:value=>clone(value||emptyPreferences()),
  normalize:value=>({version:2,plans:cleanPlans(value.plans),preferences:clone(value.preferences)})
});
const a={id:'plan-alpha001',label:'Alpha',scheduleText:'07:00 | 60 | Alpha | work | Core | block | 1',createdAt:'2026-11-01T00:00:00.000Z',updatedAt:'2026-11-01T00:00:00.000Z'};
const b={id:'plan-beta0001',label:'Beta',scheduleText:'08:00 | 45 | Beta | work | Optional | pages | 10',createdAt:'2026-11-02T00:00:00.000Z',updatedAt:'2026-11-02T00:00:00.000Z'};
let canonical=cleanPlans({draft:null,savedPlans:[a,b],defaultId:a.id});
let canonicalPreferences={...emptyPreferences(),studentName:'Stored Student'};
let writeDraftCalls=0,writeLibraryCalls=0,replaceCalls=0,replacePortableCalls=0,flushPreferenceCalls=0;
let failLibrary=false,libraryWriteGate=null,replacedDraftText='',previewCalls=0,renderCalls=0,acceptedPreferences=null;
const token=freeze({format:'study-director.ownership-write-token',contractVersion:1,tabId:'t',pageId:'p',claimId:'c',revision:1,state:'primary',allowHydrating:false,reason:'qa'});
const data=PlanHostModule.createData(freeze({
  codec,
  repositories:freeze({
    plans:freeze({
      read:async()=>clone(canonical),
      replace:async value=>{replaceCalls++;canonical=cleanPlans(value);return true;},
      replacePortable:async value=>{replacePortableCalls++;canonical=cleanPlans(value.plans);canonicalPreferences=clone(value.preferences);return clone({...value.preferences,version:2,updatedAt:'2026-11-10T00:00:00.000Z'});},
      writeDraft:async value=>{writeDraftCalls++;canonical={...canonical,draft:value};return true;},
      writeLibrary:async value=>{writeLibraryCalls++;if(failLibrary)throw new Error('library unavailable');if(libraryWriteGate)await libraryWriteGate;canonical=cleanPlans({...canonical,...value});return true;}
    }),
    preferences:freeze({read:async()=>clone(canonicalPreferences)})
  }),
  ownership:freeze({issueWriteToken:()=>token,assertWriteToken:()=>true}),
  storage:freeze({markError:()=>true}),
  preferences:freeze({
    fallback:()=>emptyPreferences(),
    flush:async()=>{flushPreferenceCalls++;return true;},
    accept:value=>{acceptedPreferences=clone(value);return value;},
    refreshAppearance:()=>true,
    applyRuntime:()=>true,
    studentName:()=>canonicalPreferences.studentName
  }),
  runtime:freeze({
    canMutate:()=>true,
    flushDraft:async()=>true,
    replaceDraftText:value=>{replacedDraftText=value;},
    previewDraft:()=>{previewCalls++;},
    renderSavedPlans:()=>{renderCalls++;}
  }),
  defaults:freeze({factory:freeze({studentName:'Factory Student',scheduleText:'06:00 | 30 | Factory | work | Core | block | 1'})})
}));

assert.equal(await data.hydrate(),true);
assert.deepEqual(data.activeDefaults(),{studentName:'Stored Student',scheduleText:a.scheduleText},'selected saved plan supplies the first/default schedule');
const detached=data.library();detached.savedPlans[0].label='Mutated copy';
assert.equal(data.library().savedPlans[0].label,'Alpha','library reads are detached from host state');

assert.equal(await data.writeLibrary({savedPlans:[a,b],defaultId:b.id}),true);
assert.equal(data.defaultSchedule(),b.scheduleText);
assert.equal(canonical.defaultId,b.id);

assert.equal(await data.writeDraft('Working draft',{strictDurability:true}),true);
assert.equal(canonical.draft,'Working draft');
assert.equal(writeDraftCalls,1);

const beforeReset={writeDraftCalls,writeLibraryCalls,replaceCalls};
canonical=cleanPlans({draft:null,savedPlans:[],defaultId:null});
assert.equal(await data.rewriteAfterStorageReset(),true);
assert.equal(replaceCalls,beforeReset.replaceCalls+1,'storage reset uses one atomic Plan-document replacement');
assert.equal(writeDraftCalls,beforeReset.writeDraftCalls,'storage reset does not rebuild the draft separately');
assert.equal(writeLibraryCalls,beforeReset.writeLibraryCalls,'storage reset does not rebuild the library separately');
assert.equal(canonical.draft,'Working draft');
assert.equal(canonical.defaultId,b.id);
assert.equal(canonical.savedPlans.length,2);

let releaseLibraryWrite;
libraryWriteGate=new Promise(resolve=>{releaseLibraryWrite=resolve;});
const queuedLibrary=data.writeLibrary({savedPlans:[a,b],defaultId:a.id});
await Promise.resolve();
const queuedReset=data.rewriteAfterStorageReset();
await Promise.resolve();
assert.equal(replaceCalls,beforeReset.replaceCalls+1,'storage-reset snapshot waits for an already-queued library write');
releaseLibraryWrite();
await queuedLibrary;
await queuedReset;
libraryWriteGate=null;
assert.equal(canonical.defaultId,a.id,'storage-reset rewrite includes the library state committed immediately before its snapshot');

const stableLibrary=data.library();
failLibrary=true;
await assert.rejects(data.writeLibrary({savedPlans:[a],defaultId:a.id}),/library unavailable/);
assert.deepEqual(data.library(),stableLibrary,'failed saved-plan persistence cannot publish an uncommitted library to host readers');
failLibrary=false;
assert.equal(await data.writeLibrary(stableLibrary),true,'a later successful write clears the failed Plan-data chain');

const imported={version:2,plans:{draft:null,savedPlans:[b],defaultId:b.id},preferences:{...emptyPreferences(),studentName:'Imported Student'}};
assert.equal(await data.importData(imported),true);
assert.equal(replacePortableCalls,1);
assert.equal(replacedDraftText,b.scheduleText,'null imported draft projects the imported selected default, not the factory schedule');
assert.equal(previewCalls,1);assert.equal(renderCalls,1);
assert.equal(acceptedPreferences.studentName,'Imported Student');
assert.equal(await data.verify(imported),true);
assert.ok(flushPreferenceCalls>=2,'settlement keeps Plan and protected Preferences in one portable-data barrier');

console.log(JSON.stringify({status:'PASS',contract:'plan-host-data',checks:['default composition','detached library reads','saved default persistence','strict draft adapter','atomic storage-reset replacement','queued-write recovery ordering','failed-library rollback','portable import projection','portable verification']},null,2));
