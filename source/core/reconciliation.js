(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
registry.define('reconciliation',1,input=>{
  const freeze=Object.freeze;
  if(!input||!Object.isFrozen(input)||Object.keys(input).sort().join('|')!=='canonical'||!input.canonical||input.canonical.format!=='study-director.canonical'||input.canonical.contractVersion!==1||typeof input.canonical.same!=='function')throw new TypeError('Reconciliation canonical dependency is invalid.');
  const Canonical=input.canonical;
  const FORMAT='study-director.reconciliation-plan';
  const RESOLVED_FORMAT='study-director.resolved-plan';
  const VERSION=1;
  const safeId=value=>String(value||'').trim().replace(/[^A-Za-z0-9._-]+/gu,'_').slice(0,120)||'source';
  const validDate=value=>/^\d{4}-\d{2}-\d{2}$/u.test(String(value||''));
  const frozenArray=values=>freeze(values.map(value=>Object.isFrozen(value)?value:freeze(value)));
  function normalizeSource(raw,{local,id,label}){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new TypeError(`Reconciliation ${local?'local':'incoming'} source is invalid.`);
    const cleanId=safeId(raw.id||id),cleanLabel=String(raw.label||label||cleanId).trim().slice(0,160)||cleanId;
    return freeze({
      id:cleanId,label:cleanLabel,local,
      savedDays:Array.isArray(raw.savedDays)?freeze([...raw.savedDays]):freeze([]),
      savedDayDeletions:Array.isArray(raw.savedDayDeletions)?freeze([...raw.savedDayDeletions]):freeze([]),
      notes:raw.notes&&typeof raw.notes==='object'&&!Array.isArray(raw.notes)?raw.notes:Object.create(null),
      noteDeletions:Array.isArray(raw.noteDeletions)?freeze([...raw.noteDeletions]):freeze([]),
      activeSession:raw.activeSession&&typeof raw.activeSession==='object'?raw.activeSession:null
    });
  }
  function sourceRef(source){return freeze({id:source.id,label:source.label,local:source.local});}
  function candidateSources(local,incoming,origin){
    if(origin==='shared')return frozenArray([sourceRef(local),sourceRef(incoming)]);
    return frozenArray([sourceRef(origin==='local'?local:incoming)]);
  }
  function buildStateMap(source,{records,deletions,keyOf,entityLabel}){
    const map=new Map();
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
  function equivalentState(a,b){return !!a&&!!b&&a.kind===b.kind&&(a.kind==='deleted'||Canonical.same(a.value,b.value));}
  // Exactly one study-evidence projection for Saved Day equality and
  // the separately versioned semantic baseline. Write metadata is excluded.
  function savedDayContentValue(record){
    if(!record||typeof record!=='object')return null;
    const {savedAt:_savedAt,updatedAt:_updatedAt,sourceRevision:_sourceRevision,...evidence}=record;
    return evidence;
  }
  function equivalentSavedDayState(a,b){
    if(!a||!b||a.kind!==b.kind)return false;
    if(a.kind==='deleted')return true;
    if(a.kind!=='record'||!a.value||!b.value)return false;
    return Canonical.same(savedDayContentValue(a.value),savedDayContentValue(b.value));
  }
  function pairStateCandidates(identity,key,localSource,incomingSource,localState,incomingState,equivalent=equivalentState){
    if(!localState&&!incomingState)return freeze([]);
    if(equivalent(localState,incomingState)){
      const kind=localState.kind,sources=candidateSources(localSource,incomingSource,'shared');
      const deletedAt=kind==='deleted'?(Date.parse(localState.deletedAt)>=Date.parse(incomingState.deletedAt)?localState.deletedAt:incomingState.deletedAt):null;
      // If only Saved Day metadata differs, converge on the verified incoming
      // canonical record so full-record shared-base hashes remain meaningful.
      // For exactly equal Notes this changes nothing.
      const sharedRecord=kind==='record'?incomingState.value:null;
      return freeze([freeze({
        id:`${identity}_${kind}_shared`,key,kind,local:true,sources,
        value:sharedRecord,record:sharedRecord,
        deletedAt,localDeletedAt:kind==='deleted'?localState.deletedAt:null
      })]);
    }
    const out=[];
    for(const [origin,state] of [['local',localState],['incoming',incomingState]]){
      if(!state)continue;
      const kind=state.kind,sources=candidateSources(localSource,incomingSource,origin);
      out.push(freeze({
        id:`${identity}_${kind}_${origin}`,key,kind,local:origin==='local',sources,
        value:kind==='record'?state.value:null,record:kind==='record'?state.value:null,
        deletedAt:kind==='deleted'?state.deletedAt:null,localDeletedAt:kind==='deleted'&&origin==='local'?state.deletedAt:null
      }));
    }
    return freeze(out);
  }
  function buildSavedDays(local,incoming){
    const options={records:source=>source.savedDays,deletions:source=>source.savedDayDeletions,keyOf:value=>validDate(value&&value.date)?value.date:'',entityLabel:'Saved-Day'};
    const localMap=buildStateMap(local,options),incomingMap=buildStateMap(incoming,options),dates=new Set([...localMap.keys(),...incomingMap.keys()]);
    return freeze([...dates].sort().map(date=>{
      const localState=localMap.get(date),incomingState=incomingMap.get(date);
      const candidates=pairStateCandidates(`saved-day_${date}`,date,local,incoming,localState,incomingState,equivalentSavedDayState);
      const localCandidate=candidates.find(candidate=>candidate.local)||null,conflict=candidates.length>1;
      const metadataRefresh=!!localState&&!!incomingState&&localState.kind==='record'&&incomingState.kind==='record'&&
        equivalentSavedDayState(localState,incomingState)&&!Canonical.same(localState.value,incomingState.value);
      return freeze({date,candidates,localCandidateId:localCandidate?.id||null,defaultCandidateId:localCandidate?.id||(candidates[0]?.id||null),conflict,identical:!conflict&&candidates.length===1&&candidates[0].sources.length===2,metadataRefresh,incomingOnly:!localCandidate&&candidates.length===1,decisionKey:`savedDay__${date.replaceAll('-','_')}`});
    }));
  }
  function buildNotes(local,incoming){
    const options={records:source=>Object.values(source.notes||{}),deletions:source=>source.noteDeletions,keyOf:value=>String(value&&value.key||''),entityLabel:'Note'};
    const localMap=buildStateMap(local,options),incomingMap=buildStateMap(incoming,options),keys=new Set([...localMap.keys(),...incomingMap.keys()]);
    return freeze([...keys].sort().map((key,index)=>{
      // Plan-local identities never depend on display names or lossy sanitization.
      const identity=`note_${index}`;
      const candidates=pairStateCandidates(identity,key,local,incoming,localMap.get(key),incomingMap.get(key));
      const localCandidate=candidates.find(candidate=>candidate.local)||null,conflict=candidates.length>1;
      return freeze({key,candidates,localCandidateId:localCandidate?.id||null,defaultCandidateId:localCandidate?.id||(candidates[0]?.id||null),conflict,identical:!conflict&&candidates.length===1&&candidates[0].sources.length===2,incomingOnly:!localCandidate&&candidates.length===1,localOnly:!!localCandidate&&candidates.length===1&&candidates[0].sources.length===1,decisionKey:identity});
    }));
  }
  function buildActiveSession(local,incoming){
    const localValue=local.activeSession,incomingValue=incoming.activeSession,candidates=[];
    if(localValue&&incomingValue&&Canonical.same(localValue,incomingValue))candidates.push(freeze({id:'session_active_shared',key:'active',local:true,sources:candidateSources(local,incoming,'shared'),value:localValue}));
    else{
      if(localValue)candidates.push(freeze({id:'session_active_local',key:'active',local:true,sources:candidateSources(local,incoming,'local'),value:localValue}));
      if(incomingValue)candidates.push(freeze({id:'session_active_incoming',key:'active',local:false,sources:candidateSources(local,incoming,'incoming'),value:incomingValue}));
    }
    const frozen=freeze(candidates),localCandidate=frozen.find(candidate=>candidate.local)||null,conflict=frozen.length>1;
    return freeze({candidates:frozen,localCandidateId:localCandidate?.id||null,defaultCandidateId:localCandidate?.id||(frozen[0]?.id||null),conflict,identical:!conflict&&frozen.length===1&&frozen[0].sources.length===2,incomingOnly:!localCandidate&&frozen.length===1,localOnly:!!localCandidate&&frozen.length===1&&frozen[0].sources.length===1,decisionKey:'activeSession'});
  }
  function createPlan(input){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join('|')!=='incoming|local'||!input.local||!input.incoming)throw new TypeError('Reconciliation plan requires exactly local and incoming sources.');
    const local=normalizeSource(input.local,{local:true,id:'local',label:'This device'}),incoming=normalizeSource(input.incoming,{local:false,id:'incoming',label:'Backup copy'});
    if(local.id===incoming.id)throw new Error('Reconciliation sources must have distinct identities.');
    return freeze({format:FORMAT,version:VERSION,localSource:sourceRef(local),incomingSource:sourceRef(incoming),savedDays:buildSavedDays(local,incoming),notes:buildNotes(local,incoming),activeSession:buildActiveSession(local,incoming)});
  }
  function hasIncoming(candidate){return candidate.sources.some(source=>!source.local);}
  function summarizePlan(plan){
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
  function selectedCandidate(item,selection,label){
    const id=selection||item.defaultCandidateId;if(!id)return null;
    const candidate=item.candidates.find(value=>value.id===id);if(!candidate)throw new Error(`${label} reconciliation decision is invalid.`);return candidate;
  }
  function changedFromLocal(item,candidate){return !!candidate&&candidate.id!==item.localCandidateId;}
  function resolvePlan(plan,decisions={}){
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
});
})();
