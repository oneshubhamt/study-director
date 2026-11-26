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
let revision=1,failLibrary=false,denyToken=false,libraryWriteGate=null,replacedDraftText='',previewCalls=0,renderCalls=0,acceptedPreferences=null;
let draftMode='normal',readFails=false,authoredDraft=null,portableMode='normal',operationRevision=1,planReadGate=null;
const token=freeze({format:'study-director.ownership-write-token',contractVersion:1,tabId:'t',pageId:'p',claimId:'c',revision:1,state:'primary',allowHydrating:false,reason:'qa'});
const data=PlanHostModule.createData(freeze({
  codec,
  repositories:freeze({
    plans:freeze({
      read:async()=>{if(readFails)throw new Error('read unavailable');const snapshot=clone(canonical),gate=planReadGate;planReadGate=null;if(gate){gate.enter();await gate.wait;}return snapshot;},
      replace:async(value,options)=>{options?.assertOrigin?.();assert.equal(options?.ownershipToken?.revision,revision);replaceCalls++;canonical=cleanPlans(value);return true;},
      replacePortable:async(value,options)=>{
        options?.assertOrigin?.();assert.equal(options?.ownershipToken?.revision,revision);replacePortableCalls++;
        if(portableMode==='reject')throw new Error('portable transaction rejected');
        canonical=cleanPlans(value.plans);canonicalPreferences=clone(value.preferences);
        if(portableMode==='retired'){operationRevision++;options?.assertOrigin?.();}
        if(portableMode==='unknown')readFails=true;
        if(portableMode==='committed'||portableMode==='unknown')throw new Error('portable acknowledgement failed');
        options?.assertOrigin?.();
        return clone({...value.preferences,version:2,updatedAt:'2026-11-10T00:00:00.000Z'});
      },
      writeDraft:async value=>{writeDraftCalls++;if(draftMode==='reject')throw new Error('draft rejected');canonical={...canonical,draft:value};if(draftMode==='committed')throw new Error('draft acknowledgement failed');return true;},
      writeLibrary:async value=>{writeLibraryCalls++;if(failLibrary)throw new Error('library unavailable');if(libraryWriteGate)await libraryWriteGate;canonical=cleanPlans({...canonical,...value});return true;}
    }),
    preferences:freeze({read:async()=>clone(canonicalPreferences)})
  }),
  ownership:freeze({issueWriteToken:()=>{if(denyToken)throw new Error('ownership unavailable');return freeze({...token,revision});},assertWriteToken:issued=>{if(issued.revision!==revision)throw new Error('ownership changed');return true;}}),
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
    authoredDraft:()=>authoredDraft,
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

denyToken=true;
assert.throws(()=>data.writeDraft('Unauthorized draft'),/ownership unavailable/);
assert.equal(data.readDraft(),'Working draft','failed token acquisition cannot publish an unauthorized in-memory draft');
assert.equal(canonical.draft,'Working draft');
denyToken=false;
// A supplied stale token must fail before optimistic state becomes visible.
revision++;
assert.throws(()=>data.writeDraft('Stale token draft',{ownershipToken:token}),/ownership changed/u);
assert.equal(data.readDraft(),'Working draft');assert.equal(canonical.draft,'Working draft');assert.equal(writeDraftCalls,1);

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

// A queued rewrite may not borrow the next owner's token after waiting.
{
  let release;libraryWriteGate=new Promise(resolve=>{release=resolve;});
  const pending=data.writeLibrary({savedPlans:[a,b],defaultId:b.id});await Promise.resolve();
  const rewrite=data.rewriteAfterStorageReset();const before=replaceCalls;
  revision++;release();await assert.rejects(pending,/ownership changed/u);await assert.rejects(rewrite,/ownership changed/u);
  assert.equal(replaceCalls,before,'successor lease cannot authorize an earlier reset');libraryWriteGate=null;
  await data.hydrate();
}
const stableLibrary=data.library();
failLibrary=true;
await assert.rejects(data.writeLibrary({savedPlans:[a],defaultId:a.id}),/library unavailable/);
assert.deepEqual(data.library(),stableLibrary,'failed saved-plan persistence cannot publish an uncommitted library to host readers');
failLibrary=false;
assert.equal(await data.writeLibrary(stableLibrary),true,'a later successful write clears the failed Plan-data chain');

// A failed draft is never published as canonical; a successful unrelated
// library write cannot clear the draft's failure or bless a backup.
draftMode='reject';
const failedDraft=data.writeDraft('Rejected replacement',{strictDurability:true});
assert.equal(data.readDraft(),'Working draft','pending write is not confirmed storage');
await assert.rejects(failedDraft,/draft rejected/u);
assert.equal(data.readDraft(),'Working draft');assert.equal(canonical.draft,'Working draft');
await data.writeLibrary(data.library());
await assert.rejects(data.settled(),/draft rejected/u);
draftMode='normal';await data.writeDraft('Working draft',{strictDurability:true});assert.equal(await data.settled(),true);

// A committed-but-unacknowledged write must not be reported as success;
// read-back aligns the cache but expressly prohibits older-byte rollback.
draftMode='committed';
await assert.rejects(data.writeDraft('Committed replacement',{strictDurability:true}),error=>error.planDraftUnconfirmed===true);
assert.equal(data.readDraft(),'Committed replacement');assert.equal(canonical.draft,'Committed replacement');
readFails=true;
await assert.rejects(data.writeDraft('Uncertain replacement',{strictDurability:true}),error=>error.planDraftUnconfirmed===true);
assert.equal(data.readDraft(),'Committed replacement');assert.equal(canonical.draft,'Uncertain replacement');
readFails=false;draftMode='normal';
const retryWrites=writeDraftCalls;
await data.writeDraft('Committed replacement');
assert.equal(writeDraftCalls,retryWrites+1,'unknown readback cannot permit an equal-text cache skip');
assert.equal(canonical.draft,'Committed replacement');

// A queued whole-library save must not erase a preceding change.
{
  let release;libraryWriteGate=new Promise(resolve=>{release=resolve;});
  const c={...a,id:'plan-gamma001',label:'Gamma'};
  const first=data.writeLibrary({savedPlans:[a,b,c],defaultId:b.id});
  const second=data.writeLibrary({savedPlans:[a],defaultId:a.id});
  const rejected=assert.rejects(second,/Saved plans changed before this save/u);
  release();await first;await rejected;libraryWriteGate=null;
  assert.equal(canonical.defaultId,b.id);assert.equal(canonical.savedPlans.length,3);
  await data.writeLibrary(data.library());
}

// Recovery preserves visible authored text instead of resurrecting a
// failed optimistic replacement; a null fallback still stays null.
authoredDraft='Rescued visible unsaved draft';canonical=cleanPlans({draft:null,savedPlans:[],defaultId:null});
await data.rewriteAfterStorageReset();assert.equal(canonical.draft,authoredDraft);
assert.equal(data.readDraft(),authoredDraft);authoredDraft=null;

const imported={version:2,plans:{draft:null,savedPlans:[b],defaultId:b.id},preferences:{...emptyPreferences(),studentName:'Imported Student'}};
assert.equal(await data.importData(imported),true);
assert.equal(replacePortableCalls,1);
assert.equal(replacedDraftText,b.scheduleText,'null imported draft projects the imported selected default, not the factory schedule');
assert.equal(previewCalls,1);assert.equal(renderCalls,1);
assert.equal(acceptedPreferences.studentName,'Imported Student');
assert.equal(await data.verify(imported),true);
canonical=cleanPlans({draft:null,savedPlans:[],defaultId:null});
await data.rewriteAfterStorageReset();assert.equal(canonical.draft,null,'displayed fallback is not a new draft');
assert.equal(await data.verify(imported),true);
assert.ok(flushPreferenceCalls>=2,'settlement keeps Plan and protected Preferences in one portable-data barrier');

// The same PlanData owner is used by restore-journal compensation. Neither
// a rejected transaction nor a committed/unacknowledged one may poison the
// authorized rollback lane; ordinary import still cannot bypass settlement.
const preimage=await data.exportData({flush:false}),target={...preimage,plans:{draft:'Incoming portable draft',savedPlans:[a],defaultId:a.id},preferences:{...preimage.preferences,studentName:'Incoming Student'}};
for(const mode of ['reject','committed','unknown']){
  const origin=operationRevision,assertOrigin=()=>{if(operationRevision!==origin)throw new Error('protected operation retired');};
  portableMode=mode;
  await assert.rejects(data.importData(target,{assertOrigin}),/portable (transaction rejected|acknowledgement failed)/u);
  assert.equal(canonical.draft,mode==='reject'?preimage.plans.draft:target.plans.draft);
  assert.equal(data.readDraft(),mode==='committed'?target.plans.draft:preimage.plans.draft);
  if(mode==='unknown')assert.throws(()=>data.writeDraft('Unrelated edit'),/Portable Plan storage is unconfirmed/u);
  readFails=false;portableMode='normal';
  await assert.rejects(data.importData(preimage),/portable (transaction rejected|acknowledgement failed)/u);
  await assert.rejects(data.importData(preimage,{rollback:true}),/original protected recovery authority/u);
  const beforeRollback=replacePortableCalls;
  assert.equal(await data.importData(preimage,{rollback:true,assertOrigin}),true);
  assert.equal(replacePortableCalls,beforeRollback+1);
  assert.equal(await data.verify(preimage),true);
  assert.equal(replacedDraftText,preimage.plans.draft??b.scheduleText);
}

// A retired protected operation must not project a commit or restore bytes
// under an unrelated successor, even if the tab ownership token still works.
{
  const origin=operationRevision,assertOrigin=()=>{if(operationRevision!==origin)throw new Error('protected operation retired');};
  const beforeProjection=previewCalls;
  portableMode='retired';await assert.rejects(data.importData(target,{assertOrigin}),/protected operation retired/u);
  assert.equal(canonical.draft,target.plans.draft);assert.equal(previewCalls,beforeProjection);
  portableMode='normal';const beforeRollback=replacePortableCalls;
  await assert.rejects(data.importData(preimage,{rollback:true,assertOrigin}),/protected operation retired/u);
  assert.equal(replacePortableCalls,beforeRollback);
  await data.hydrate();
}

// A delayed read cannot overwrite the successor's hydrated cache, nor a
// write admitted during that read. The latter must re-read canonical bytes.
function gatedRead(){
  let release,enter;
  const entered=new Promise(resolve=>{enter=resolve;}),wait=new Promise(resolve=>{release=resolve;});
  planReadGate={enter,wait};return {entered,release};
}
{
  const gate=gatedRead(),origin=revision,check=()=>{if(origin!==revision)throw new Error('hydration authority retired');};
  const previous=data.hydrate(check),rejected=assert.rejects(previous,/hydration authority retired/u);
  await gate.entered;revision++;canonical={...canonical,draft:'Successor canonical draft'};
  await data.hydrate();gate.release();await rejected;
  assert.equal(data.readDraft(),'Successor canonical draft');
}
{
  const gate=gatedRead(),previous=data.hydrate();
  await gate.entered;await data.writeDraft('Committed during hydration');gate.release();
  await previous;assert.equal(data.readDraft(),'Committed during hydration');assert.equal(canonical.draft,data.readDraft());
}
console.log(JSON.stringify({status:'PASS',contract:'plan-host-data',checks:['default composition','detached library reads','saved default persistence','strict draft adapter','token-before-memory-publication','supplied-stale-token-before-publication','atomic storage-reset replacement','queued-write recovery ordering','failed-library rollback','portable import projection','portable verification','rejected-draft-not-published','independent-failure-lanes','unconfirmed-commit-readback','unknown-readback-forces-retry','stale-library-queue-refused','visible-draft-storage-recovery','portable-failure-rollback','committed-portable-readback','unknown-portable-outcome','retired-protected-import']},null,2));
