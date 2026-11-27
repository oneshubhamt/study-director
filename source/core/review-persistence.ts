import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {FlushOptions,SaveLane,SaveState} from '../../types/pilot.ts';
import type {ReviewDailyReflectionResult} from '../../types/review.ts';
import type {DiaryDraft,DiaryEditorCallbacks,ReviewPersistenceInput,ReviewPersistenceModule as ReviewPersistenceModuleContract,SavedDayRecord} from '../../types/review-persistence.ts';

const sdReviewPersistenceFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'review-persistence','study-director.review-persistence-module'>|undefined;
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
const freeze=Object.freeze;

function createPersistence(input:Readonly<ReviewPersistenceInput>){
  if(!input||typeof input!=='object')throw new TypeError('Review persistence input is required.');
  const {configuration,records,codec,ownership,text,richText,dates,saveLane,environment}=input;
  const {limits,dataContract}=configuration;
  function durableReceipt(receipt:unknown,label:string){
    if(!receipt||typeof receipt!=='object'||!('storage' in receipt)||(receipt as {storage?:unknown}).storage!=='indexeddb'){
      throw new Error(`${label} reached only emergency recovery storage, not canonical IndexedDB. Keep this tab open and retry after storage recovers.`);
    }
  }
  function snapshot(record:SavedDayRecord|null|undefined):ReviewDailyReflectionResult{
    return freeze({record:record||null,canonical:String(record?.reflection||''),revision:record?records.timestamp(record):0,recordKind:record?.recordKind||null});
  }
  async function canonicalRecord(date:string){
    return (await records.get(date,{strict:true}))||null;
  }
  async function load(date:string){
    if(!dates.isSupported(date))return snapshot(null);
    return snapshot(await records.get(date));
  }
  function assertReflectionOwner(revision:number){
    if(!ownership.canMutate()||ownership.revision()!==revision)throw new Error('Daily Reflection ownership changed. Reopen it before editing.');
  }
  async function commit(date:string,value:string,options:Readonly<{expectedCanonical?:string;expectedRecordKind?:SavedDayRecord['recordKind'];backupCapture?:boolean;assertOrigin?:(()=>void)|null}>={}){
    if(!ownership.canMutate())throw new Error('Use the primary tab to edit Daily Reflections.');
    const ownerRevision=ownership.revision(),assertOrigin=()=>{assertReflectionOwner(ownerRevision);options.assertOrigin?.();};assertOrigin();
    if(!dates.isSupported(date))throw new Error('That reflection date is not available.');
    const candidate=text.clampEditorContent(value,limits.maxReflectionChars);
    if(!text.editorContentWithinLimits(candidate))throw new Error('Daily Reflection exceeds the rich-text limit.');
    const current=await records.get(date,{strict:true}),currentCanonical=String(current?.reflection||'');
    assertOrigin();
    if(options.expectedRecordKind!==undefined&&current?.recordKind!==options.expectedRecordKind)throw new Error('This Daily Reflection changed record type. Reopen it before deleting.');
    const hasContent=!!String(candidate||'').trim(),backupCapture=options.backupCapture===true;
    if(currentCanonical===candidate){
      if(current)await records.verifyCanonical(current);else await records.verifyCanonicalAbsent(date);assertOrigin();
      return snapshot(current);
    }
    // A retry after a committed write with unavailable read-back is a verified
    // no-op if the requested reflection is already present. Never rewrite the
    // rest of a Saved Day just to acknowledge that outcome.
    if(options.expectedCanonical!==undefined&&currentCanonical!==String(options.expectedCanonical||''))throw new Error('This Daily Reflection changed elsewhere. Reopen it before editing.');
    let committed=false;
    try{
      if(current?.recordKind==='study'){
        const next={...current,reflection:candidate,updatedAt:environment.nowIso()};
        const receipt=await records.save(next,{backupCapture,expectedCanonical:current,assertOrigin});durableReceipt(receipt,'Daily Reflection');committed=true;
        assertOrigin();await records.verifyCanonical(next);
      }else if(hasContent){
        const diary=codec.createDiaryRecord(date,candidate,{savedAt:current?.savedAt||undefined,sourceRevision:current?.sourceRevision||0});
        if(!diary)throw new Error('Daily Reflection failed canonical validation.');
        const receipt=await records.save(diary,{backupCapture,expectedCanonical:current,assertOrigin});durableReceipt(receipt,'Daily Reflection');committed=true;
        assertOrigin();await records.verifyCanonical(diary);
      }else if(current?.recordKind==='diary'){
        await records.remove(date,{backupCapture,expectedCanonical:current,assertOrigin});committed=true;
        assertOrigin();await records.verifyCanonicalAbsent(date);
      }
      assertOrigin();const fresh=await canonicalRecord(date);assertOrigin();
      if(hasContent&&String(fresh?.reflection||'')!==candidate)throw new Error('Daily Reflection did not pass its canonical save read-back check.');
      if(!hasContent&&current?.recordKind==='study'&&(!fresh||fresh.recordKind!=='study'||String(fresh.reflection||'').trim()))throw new Error('Daily Reflection clear did not pass its canonical save read-back check.');
      if(!hasContent&&current?.recordKind==='diary'&&fresh)throw new Error('Daily Reflection deletion did not pass its canonical save read-back check.');
      return snapshot(fresh);
    }catch(error){
      if(!committed)throw error;
      throw Object.assign(new Error('Daily Reflection reached canonical storage, but final verification did not complete.'),{code:'DAILY_RECORD_COMMITTED_UNVERIFIED',cause:error});
    }
  }
  const DailyReflectionPersistence=freeze({load,commit});

  type EditorState={
    date:string;canonical:string;revision:number;recordKind:'diary'|'study';ownershipRevision:number;
    onSaved:((record:SavedDayRecord|null)=>void)|null;onState:((state:'saving'|'saved'|'error',message:string)=>void)|null;assertWrite:(()=>void)|null;
    lane:Readonly<SaveLane<string,SavedDayRecord|null>>;
  };
  const bindings=new WeakMap<HTMLTextAreaElement,EditorState>();
  function activeState(field:HTMLTextAreaElement){
    const state=bindings.get(field);
    if(!state||!field.isConnected||field.dataset['diaryDate']!==state.date||
        Number(field.dataset['diaryOwnershipRevision'])!==state.ownershipRevision||
        state.ownershipRevision!==ownership.revision())return null;
    return state;
  }
  function clear(field:HTMLTextAreaElement){
    if(!(field instanceof HTMLTextAreaElement))return false;
    bindings.get(field)?.lane.cancel();richText.closeField(field);bindings.delete(field);
    ['diaryDate','diaryRevision','diaryOwnershipRevision','richSyncState','richSyncStatus','richExternalConflict'].forEach(key=>delete field.dataset[key]);
    return true;
  }
  function draft(date:string){
    if(!dates.isSupported(date))return null;
    const now=environment.nowIso();
    const meta=dates.insights(date);
    const value:DiaryDraft={version:dataContract.schemas.DailyRecord.version,recordKind:'diary',date,savedAt:now,updatedAt:now,sourceRevision:0,reflection:'',dayOfWeek:meta.dayOfWeek,dayName:meta.dayName};return freeze(value);
  }
  async function write(field:HTMLTextAreaElement,state:EditorState,value:string,options:FlushOptions={}){
    const assertOrigin=()=>{if(activeState(field)!==state||!ownership.canMutate())throw new Error('This Diary editor is no longer bound to the current study owner.');state.assertWrite?.();};assertOrigin();
    const candidate=text.clampEditorContent(value,limits.maxReflectionChars);
    if(!text.editorContentWithinLimits(candidate))throw new Error('Diary reflection exceeds the rich-text limit.');
    const saved=await commit(state.date,candidate,{expectedCanonical:state.canonical,backupCapture:options.backupCapture===true,assertOrigin});
    if(activeState(field)!==state)throw new Error('This Diary editor became stale while its save was completing.');
    const fresh=(saved.record||null) as SavedDayRecord|null;
    state.canonical=saved.canonical;state.revision=Number((saved as {revision?:unknown}).revision)||0;state.recordKind=saved.recordKind==='study'?'study':'diary';
    field.dataset['diaryRevision']=String(state.revision);richText.syncField(field);state.onSaved?.(fresh);return fresh;
  }
  function laneState(field:HTMLTextAreaElement,state:EditorState,status:'saving'|'saved'|'error',error:unknown){
    if(activeState(field)!==state)return;
    const message=status==='error'?saveLane.failureMessage('Diary reflection',error):status==='saving'?'Saving…':'Saved';
    field.dataset['richSyncState']=status;field.dataset['richSyncStatus']=message;state.onState?.(status,message);
  }
  function bind(field:HTMLTextAreaElement,date:string,record:SavedDayRecord,callbacks:DiaryEditorCallbacks={}){
    if(!(field instanceof HTMLTextAreaElement)||!dates.isSupported(date)||!record)return null;
    clear(field);
    const canonical=String(record.reflection||''),revision=records.timestamp(record),ownershipRevision=ownership.revision();
    let state!:EditorState;
    const lane=saveLane.createLane<string,SavedDayRecord|null>(freeze({
      label:'Diary reflection',write:(next:string,options:FlushOptions)=>write(field,state,next,options),
      onState:(status:SaveState,error:unknown)=>laneState(field,state,status,error),
      environment:freeze({setTimeout:environment.setTimeout,clearTimeout:environment.clearTimeout})
    }));
    state={date,canonical,revision,recordKind:record.recordKind==='diary'?'diary':'study',ownershipRevision,onSaved:callbacks.onSaved||null,onState:callbacks.onState||null,assertWrite:callbacks.assertWrite||null,lane};
    bindings.set(field,state);
    field.dataset['diaryDate']=date;field.dataset['diaryRevision']=String(revision);field.dataset['diaryOwnershipRevision']=String(ownershipRevision);
    field.dataset['richSyncState']=ownership.canMutate()?'saved':'read-only';field.dataset['richSyncStatus']=ownership.canMutate()?'Saved':'Read-only';
    field.value=text.plain(canonical);field.maxLength=limits.maxReflectionChars;field.setAttribute('aria-label',`Diary reflection for ${date}`);
    environment.queueMicrotask(()=>richText.syncField(field));
    return freeze({date,revision});
  }
  function documentFor(field:HTMLTextAreaElement){
    const state=activeState(field);if(!state)return null;
    return freeze({documentId:`diary:${state.date}`,label:`Diary reflection for ${state.date}`,initialValue:state.canonical,maxWords:limits.maxRichTextWords,surface:'reflection' as const});
  }
  function capture(field:HTMLTextAreaElement,event?:Event){
    const state=activeState(field);if(!state)return '';
    const trusted=richText.validatedInput(event,field),value=trusted?trusted.canonical:String(field.value||'');
    if(trusted||text.isRich(value))return value;
    return value===text.plain(state.canonical)?state.canonical:value;
  }
  function schedule(field:HTMLTextAreaElement,value:string){const state=activeState(field);return state&&ownership.canMutate()?state.lane.schedule(String(value??'')):false;}
  function flush(field:HTMLTextAreaElement,options:FlushOptions={}){const state=activeState(field);return state&&ownership.canMutate()?state.lane.flush(options):Promise.reject(new Error('Diary editor is no longer active for the current study owner.'));}
  async function deleteEntry(date:string,options:Readonly<{backupCapture?:boolean;expectedRecord?:Pick<SavedDayRecord,'recordKind'|'reflection'>;assertWrite?:(()=>void)|null}>={}){
    if(!ownership.canMutate()||!dates.isSupported(date))return false;
    const ownerRevision=ownership.revision(),assertOrigin=()=>{assertReflectionOwner(ownerRevision);options.assertWrite?.();};assertOrigin();
    const current=await records.get(date,{strict:true});
    assertOrigin();
    if(!current){await records.verifyCanonicalAbsent(date);assertOrigin();return options.expectedRecord?.recordKind!=='study';}
    if(options.expectedRecord&&(current.recordKind!==options.expectedRecord.recordKind||String(current.reflection||'')!==String(options.expectedRecord.reflection||'')))throw new Error('This Daily Reflection changed after confirmation. Reopen it before deleting.');
    const result=await commit(date,'',{expectedCanonical:String(current.reflection||''),expectedRecordKind:current.recordKind,backupCapture:options.backupCapture===true,assertOrigin});
    return current.recordKind==='study'?!!result.record&&result.record.recordKind==='study'&&!String(result.record.reflection||'').trim():!result.record;
  }
  async function settled(field:HTMLTextAreaElement){const state=bindings.get(field);if(!state)return true;return state.lane.settled();}
  const DiaryEditor=freeze({bind,capture,clear,deleteEntry,documentFor,draft,flush,schedule,settled});
  return freeze({format:'study-director.review-persistence',contractVersion:1,DailyReflectionPersistence,DiaryEditor});
}
const createModule=():ReviewPersistenceModuleContract=>freeze({format:'study-director.review-persistence-module',contractVersion:1,createPersistence});
registry.define('review-persistence',1,createModule);
return createModule;
})();
export type ReviewPersistenceModule=ReturnType<typeof sdReviewPersistenceFactory>;
