import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {ReconciliationInput,SourceRef,ReconciliationSourceInput,ReconciliationSource,EntityState,EntityCandidate,SessionCandidate,ReconciliationPlan,ReconciliationDecisions,StateMapOptions,CandidateBase} from '../../types/reconciliation.ts';
import type {DailyRecord,NoteRecord} from '../../types/record-models.ts';
import type {SavedDayDeletion,NoteDeletion} from '../../types/backup-models.ts';
const sdReconciliationFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'reconciliation','study-director.reconciliation-module',1,[ReconciliationInput]>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const createModule=(input:ReconciliationInput)=>{
  const freeze=Object.freeze;
  if(!input||!Object.isFrozen(input)||Object.keys(input).sort().join('|')!=='canonical'||!input.canonical||input.canonical.format!=='study-director.canonical'||input.canonical.contractVersion!==1||typeof input.canonical.same!=='function')throw new TypeError('Reconciliation canonical dependency is invalid.');
  const Canonical=input.canonical;
  const FORMAT='study-director.reconciliation-plan';
  const RESOLVED_FORMAT='study-director.resolved-plan';
  const VERSION=1;
  const safeId=(value:unknown)=>String(value||'').trim().replace(/[^A-Za-z0-9._-]+/gu,'_').slice(0,120)||'source';
  const validDate=(value:unknown)=>/^\d{4}-\d{2}-\d{2}$/u.test(String(value||''));
  const frozenArray=<T>(values:readonly T[])=>freeze(values.map(value=>Object.isFrozen(value)?value:freeze(value)));
  function normalizeSource(raw:ReconciliationSourceInput,{local,id,label}:SourceRef):ReconciliationSource{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new TypeError(`Reconciliation ${local?'local':'incoming'} source is invalid.`);
    const cleanId=safeId(raw.id||id),cleanLabel=String(raw.label||label||cleanId).trim().slice(0,160)||cleanId;
    return freeze({
      id:cleanId,label:cleanLabel,local,
      savedDays:Array.isArray(raw.savedDays)?freeze([...(raw.savedDays as readonly DailyRecord[])]):freeze([]),
      savedDayDeletions:Array.isArray(raw.savedDayDeletions)?freeze([...(raw.savedDayDeletions as readonly SavedDayDeletion[])]):freeze([]),
      notes:raw.notes&&typeof raw.notes==='object'&&!Array.isArray(raw.notes)?raw.notes:Object.create(null) as Record<string,NoteRecord>,
      noteDeletions:Array.isArray(raw.noteDeletions)?freeze([...(raw.noteDeletions as readonly NoteDeletion[])]):freeze([]),
      activeSession:raw.activeSession&&typeof raw.activeSession==='object'?raw.activeSession:null
    });
  }
  function sourceRef(source:SourceRef){return freeze({id:source.id,label:source.label,local:source.local});}
  function candidateSources(local:SourceRef,incoming:SourceRef,origin:'shared'|'local'|'incoming'){
    if(origin==='shared')return frozenArray([sourceRef(local),sourceRef(incoming)]);
    return frozenArray([sourceRef(origin==='local'?local:incoming)]);
  }
  function buildStateMap<T,D extends {deletedAt:string}>(source:ReconciliationSource,{records,deletions,keyOf,entityLabel}:StateMapOptions<T,D>){
    const map=new Map<string,EntityState<T>>();
    for(const record of records(source)){
      const key=String(keyOf(record)||'');if(!key)continue;
      if(map.has(key))throw new Error(`${source.label} contains duplicate ${entityLabel} state for ${key}.`);
      map.set(key,freeze({kind:'record',value:record}));
    }
    for(const deletion of deletions(source)){
      const key=String(keyOf(deletion)||''),deletedAt=String(deletion&&deletion.deletedAt||'');
      if(!key||!Number.isFinite(Date.parse(deletedAt)))continue;
      if(map.has(key))throw new Error(`${source.label} contains both a ${entityLabel} record and deletion state for ${key}.`);
      map.set(key,freeze({kind:'deleted',value:null,deletedAt:new Date(deletedAt).toISOString()}));
    }
    return map;
  }
  function equivalentState<T>(a:EntityState<T>|undefined,b:EntityState<T>|undefined){return !!a&&!!b&&a.kind===b.kind&&(a.kind==='deleted'||Canonical.same(a.value,b.value));}
  // Exactly one study-evidence projection for Saved Day equality and
  // the separately versioned semantic baseline. Write metadata is excluded.
  function savedDayContentValue(record:DailyRecord|null|undefined){
    if(!record||typeof record!=='object')return null;
    const {savedAt:_savedAt,updatedAt:_updatedAt,sourceRevision:_sourceRevision,...evidence}=record;
    return evidence;
  }
  function equivalentSavedDayState(a:EntityState<DailyRecord>|undefined,b:EntityState<DailyRecord>|undefined){
    if(!a||!b||a.kind!==b.kind)return false;
    if(a.kind==='deleted')return true;
    if(a.kind!=='record'||!a.value||!b.value)return false;
    return Canonical.same(savedDayContentValue(a.value),savedDayContentValue(b.value));
  }
  function pairStateCandidates<T>(identity:string,key:string,localSource:SourceRef,incomingSource:SourceRef,localState:EntityState<T>|undefined,incomingState:EntityState<T>|undefined,equivalent:(a:EntityState<T>|undefined,b:EntityState<T>|undefined)=>boolean=equivalentState):readonly EntityCandidate<T>[]{
    const source=(origin:'local'|'incoming'|'shared')=>candidateSources(localSource,incomingSource,origin);
    if(localState&&incomingState&&equivalent(localState,incomingState)){
      const sources=source('shared');
      if(localState.kind==='record'&&incomingState.kind==='record')return freeze([freeze({id:`${identity}_record_shared`,key,kind:'record' as const,local:true,sources,value:incomingState.value,record:incomingState.value,deletedAt:null,localDeletedAt:null})]);
      if(localState.kind==='deleted'&&incomingState.kind==='deleted'){
        const deletedAt=Date.parse(localState.deletedAt)>=Date.parse(incomingState.deletedAt)?localState.deletedAt:incomingState.deletedAt;
        return freeze([freeze({id:`${identity}_deleted_shared`,key,kind:'deleted' as const,local:true,sources,value:null,record:null,deletedAt,localDeletedAt:localState.deletedAt})]);
      }
    }
    const out:EntityCandidate<T>[]=[];
    for(const [origin,state] of [['local',localState],['incoming',incomingState]] as const){
      if(!state)continue;
      const base={id:`${identity}_${state.kind}_${origin}`,key,local:origin==='local',sources:source(origin)};
      out.push(state.kind==='record'?freeze({...base,kind:'record' as const,value:state.value,record:state.value,deletedAt:null,localDeletedAt:null}):freeze({...base,kind:'deleted' as const,value:null,record:null,deletedAt:state.deletedAt,localDeletedAt:origin==='local'?state.deletedAt:null}));
    }
    return freeze(out);
  }
  function buildSavedDays(local:ReconciliationSource,incoming:ReconciliationSource){
    const options:StateMapOptions<DailyRecord,SavedDayDeletion>={records:source=>source.savedDays,deletions:source=>source.savedDayDeletions,keyOf:value=>validDate(value&&value.date)?value.date:'',entityLabel:'Saved-Day'};
    const localMap=buildStateMap(local,options),incomingMap=buildStateMap(incoming,options),dates=new Set([...localMap.keys(),...incomingMap.keys()]);
    return freeze([...dates].sort().map(date=>{
      const localState=localMap.get(date),incomingState=incomingMap.get(date);
      const candidates=pairStateCandidates(`saved-day_${date}`,date,local,incoming,localState,incomingState,equivalentSavedDayState);
      const localCandidate=candidates.find(candidate=>candidate.local)||null,conflict=candidates.length>1;
      const metadataRefresh=!!localState&&!!incomingState&&localState.kind==='record'&&incomingState.kind==='record'&&
        equivalentSavedDayState(localState,incomingState)&&!Canonical.same(localState.value,incomingState.value);
      return freeze({date,candidates,localCandidateId:localCandidate?.id||null,defaultCandidateId:localCandidate?.id||(candidates[0]?.id||null),conflict,identical:!conflict&&candidates.length===1&&candidates[0]!.sources.length===2,metadataRefresh,incomingOnly:!localCandidate&&candidates.length===1,decisionKey:`savedDay__${date.replaceAll('-','_')}`});
    }));
  }
  function buildNotes(local:ReconciliationSource,incoming:ReconciliationSource){
    const options:StateMapOptions<NoteRecord,NoteDeletion>={records:source=>Object.values(source.notes||{}),deletions:source=>source.noteDeletions,keyOf:value=>String(value&&value.key||''),entityLabel:'Note'};
    const localMap=buildStateMap(local,options),incomingMap=buildStateMap(incoming,options),keys=new Set([...localMap.keys(),...incomingMap.keys()]);
    return freeze([...keys].sort().map((key,index)=>{
      // Plan-local identities never depend on display names or lossy sanitization.
      const identity=`note_${index}`;
      const candidates=pairStateCandidates(identity,key,local,incoming,localMap.get(key),incomingMap.get(key));
      const localCandidate=candidates.find(candidate=>candidate.local)||null,conflict=candidates.length>1;
      return freeze({key,candidates,localCandidateId:localCandidate?.id||null,defaultCandidateId:localCandidate?.id||(candidates[0]?.id||null),conflict,identical:!conflict&&candidates.length===1&&candidates[0]!.sources.length===2,incomingOnly:!localCandidate&&candidates.length===1,localOnly:!!localCandidate&&candidates.length===1&&candidates[0]!.sources.length===1,decisionKey:identity});
    }));
  }
  function buildActiveSession(local:ReconciliationSource,incoming:ReconciliationSource){
    const localValue=local.activeSession,incomingValue=incoming.activeSession,candidates:SessionCandidate[]=[];
    if(localValue&&incomingValue&&Canonical.same(localValue,incomingValue))candidates.push(freeze({id:'session_active_shared',key:'active',local:true,sources:candidateSources(local,incoming,'shared'),value:localValue}));
    else{
      if(localValue)candidates.push(freeze({id:'session_active_local',key:'active',local:true,sources:candidateSources(local,incoming,'local'),value:localValue}));
      if(incomingValue)candidates.push(freeze({id:'session_active_incoming',key:'active',local:false,sources:candidateSources(local,incoming,'incoming'),value:incomingValue}));
    }
    const frozen=freeze(candidates),localCandidate=frozen.find(candidate=>candidate.local)||null,conflict=frozen.length>1;
    return freeze({candidates:frozen,localCandidateId:localCandidate?.id||null,defaultCandidateId:localCandidate?.id||(frozen[0]?.id||null),conflict,identical:!conflict&&frozen.length===1&&frozen[0]!.sources.length===2,incomingOnly:!localCandidate&&frozen.length===1,localOnly:!!localCandidate&&frozen.length===1&&frozen[0]!.sources.length===1,decisionKey:'activeSession'});
  }
  function createPlan(input:{local:ReconciliationSourceInput;incoming:ReconciliationSourceInput}):ReconciliationPlan{
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join('|')!=='incoming|local'||!input.local||!input.incoming)throw new TypeError('Reconciliation plan requires exactly local and incoming sources.');
    const local=normalizeSource(input.local,{local:true,id:'local',label:'This device'}),incoming=normalizeSource(input.incoming,{local:false,id:'incoming',label:'Backup copy'});
    if(local.id===incoming.id)throw new Error('Reconciliation sources must have distinct identities.');
    return freeze({format:FORMAT,version:VERSION,localSource:sourceRef(local),incomingSource:sourceRef(incoming),savedDays:buildSavedDays(local,incoming),notes:buildNotes(local,incoming),activeSession:buildActiveSession(local,incoming)});
  }
  function hasIncoming(candidate:Pick<CandidateBase,'sources'>){return candidate.sources.some(source=>!source.local);}
  function summarizePlan(plan:ReconciliationPlan){
    if(!plan||plan.format!==FORMAT||Number(plan.version)!==VERSION)throw new TypeError('ReconciliationPlan is invalid.');
    const incomingSavedDayCandidates=plan.savedDays.flatMap(item=>item.candidates.filter(hasIncoming)),incomingRecords=incomingSavedDayCandidates.filter(candidate=>candidate.kind==='record'),incomingDeletions=incomingSavedDayCandidates.filter(candidate=>candidate.kind==='deleted');
    const recordConflicts=plan.savedDays.filter(item=>item.conflict&&item.candidates.some(candidate=>candidate.local&&candidate.kind==='record')&&item.candidates.some(candidate=>hasIncoming(candidate)&&candidate.kind==='record')).length;
    const localDeletionConflicts=plan.savedDays.filter(item=>item.conflict&&item.candidates.some(candidate=>candidate.local&&candidate.kind==='deleted')&&item.candidates.some(candidate=>hasIncoming(candidate)&&candidate.kind==='record')).length;
    const deletionConflicts=plan.savedDays.filter(item=>item.conflict&&item.candidates.some(candidate=>candidate.local&&candidate.kind==='record')&&item.candidates.some(candidate=>hasIncoming(candidate)&&candidate.kind==='deleted')).length;
    const incomingNoteItems=plan.notes.filter(item=>item.candidates.some(hasIncoming)).length,active=plan.activeSession,checkpointPresent=active.candidates.some(hasIncoming),localPresent=!!active.localCandidateId;
    return freeze({
      savedDays:freeze({total:incomingRecords.length,newItems:plan.savedDays.filter(item=>item.incomingOnly&&item.candidates[0]?.kind==='record').length,conflicts:plan.savedDays.filter(item=>item.conflict).length,recordConflicts,localDeletionConflicts,identical:plan.savedDays.filter(item=>item.identical&&item.candidates[0]?.kind==='record').length,deletions:incomingDeletions.length,deletionConflicts,deletionAlreadyAbsent:incomingDeletions.length-deletionConflicts}),
      notes:freeze({total:incomingNoteItems,localItems:plan.notes.filter(item=>!!item.localCandidateId).length,newItems:plan.notes.filter(item=>item.incomingOnly).length,conflicts:plan.notes.filter(item=>item.conflict).length,deletions:plan.notes.filter(item=>item.candidates.some(candidate=>candidate.kind==='deleted'&&hasIncoming(candidate))).length}),
      activeSession:freeze({total:checkpointPresent?1:0,checkpointPresent,localPresent,identical:active.identical,newItems:active.incomingOnly?1:0,conflicts:active.conflict?1:0})
    });
  }
  function selectedCandidate<C extends {id:string}>(item:{candidates:readonly C[];defaultCandidateId:string|null},selection:unknown,label:string){
    const id=selection||item.defaultCandidateId;if(!id)return null;
    const candidate=item.candidates.find(value=>value.id===id);if(!candidate)throw new Error(`${label} reconciliation decision is invalid.`);return candidate;
  }
  function changedFromLocal(item:{localCandidateId:string|null},candidate:{id:string}|null){return !!candidate&&candidate.id!==item.localCandidateId;}
  function resolvePlan(plan:ReconciliationPlan,decisions:ReconciliationDecisions={}){
    if(!plan||plan.format!==FORMAT||Number(plan.version)!==VERSION)throw new TypeError('ReconciliationPlan is invalid.');
    const savedDayDecisions=decisions.savedDays&&typeof decisions.savedDays==='object'?decisions.savedDays:{},noteDecisions=decisions.notes&&typeof decisions.notes==='object'?decisions.notes:{};
    const savedDays=freeze(plan.savedDays.map(item=>{
      const decision=savedDayDecisions[item.date];
      if(decision&&typeof decision==='object'&&!Array.isArray(decision)&&Object.prototype.hasOwnProperty.call(decision,'value')){
        const value=decision.value,localCandidate=item.candidates.find(candidate=>candidate.id===item.localCandidateId)||null;
        if(!value||typeof value!=='object'||Array.isArray(value)||String(value.date||'')!==item.date)throw new Error(`Saved Day ${item.date} reconciliation value is invalid.`);
        return freeze({date:item.date,state:'record',candidateId:null,changed:item.metadataRefresh===true||!localCandidate||localCandidate.kind!=='record'||!Canonical.same(value,localCandidate.record),hadLocal:!!item.localCandidateId,record:value,deletedAt:null,local:false,sources:freeze(item.candidates.flatMap(candidate=>candidate.sources))});
      }
      const candidate=selectedCandidate(item,decision,`Saved Day ${item.date}`);if(!candidate)return freeze({date:item.date,state:'none',candidateId:null,changed:false,hadLocal:false});
      const changed=changedFromLocal(item,candidate)||item.metadataRefresh===true||(candidate.kind==='deleted'&&candidate.local&&!!candidate.localDeletedAt&&candidate.deletedAt!==candidate.localDeletedAt);
      return freeze({date:item.date,state:candidate.kind,candidateId:candidate.id,changed,hadLocal:!!item.localCandidateId,record:candidate.kind==='record'?candidate.record:null,deletedAt:candidate.kind==='deleted'?candidate.deletedAt:null,local:candidate.local,sources:candidate.sources});
    }));
    const notes=freeze(plan.notes.map(item=>{
      const decision=noteDecisions[item.key];
      if(decision&&typeof decision==='object'&&!Array.isArray(decision)&&Object.prototype.hasOwnProperty.call(decision,'value')){
        const value=decision.value,localCandidate=item.candidates.find(candidate=>candidate.id===item.localCandidateId)||null;if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`Note ${item.key} reconciliation value is invalid.`);
        return freeze({key:item.key,state:'record',candidateId:null,value,deletedAt:null,changed:!localCandidate||localCandidate.kind!=='record'||!Canonical.same(value,localCandidate.value),hadLocal:!!item.localCandidateId,local:false,sources:freeze(item.candidates.flatMap(candidate=>candidate.sources))});
      }
      const candidate=selectedCandidate(item,decision,`Note ${item.key}`),changed=!!candidate&&(changedFromLocal(item,candidate)||(candidate.kind==='deleted'&&candidate.local&&!!candidate.localDeletedAt&&candidate.deletedAt!==candidate.localDeletedAt));
      return freeze({key:item.key,state:candidate?.kind||'none',candidateId:candidate?.id||null,value:candidate?.kind==='record'?candidate.value:null,deletedAt:candidate?.kind==='deleted'?candidate.deletedAt:null,changed,hadLocal:!!item.localCandidateId,local:!!candidate?.local,sources:candidate?.sources||freeze([])});
    }));
    const activeCandidate=selectedCandidate(plan.activeSession,decisions.activeSession,'Active Session'),activeSession=freeze({candidateId:activeCandidate?.id||null,value:activeCandidate?.value||null,changed:!!activeCandidate&&changedFromLocal(plan.activeSession,activeCandidate),hadLocal:!!plan.activeSession.localCandidateId,local:!!activeCandidate?.local,sources:activeCandidate?.sources||freeze([])});
    return freeze({format:RESOLVED_FORMAT,version:VERSION,sourcePlan:plan,savedDays,notes,activeSession});
  }
  return freeze({format:'study-director.reconciliation-module',contractVersion:1,createPlan,resolvePlan,summarizePlan,savedDayContentValue});
};
registry.define('reconciliation',1,createModule);
return createModule;
})();
export type ReconciliationModule=ReturnType<typeof sdReconciliationFactory>;
