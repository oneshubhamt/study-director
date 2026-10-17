import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['source/core/internal.js','source/core/canonical.js','source/core/reconciliation.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const canonical=registry.require('canonical',1);
const reconciliation=registry.require('reconciliation',1,Object.freeze({canonical}));
const freeze=Object.freeze;
const day=(date,text)=>freeze({version:15,date,reflection:text,updatedAt:'2026-09-19T00:00:00.000Z'});
const deletion=(date,deletedAt)=>freeze({date,deletedAt});
const note=(key,text)=>freeze({version:2,key,text,updatedAt:'2026-09-19T00:00:00.000Z'});
const session=label=>freeze({id:'current',version:9,date:'2026-09-19',status:'suspended',scheduleText:label,snapshot:freeze({label,review:freeze({reflection:'',studyQuality:null})})});

const plan=reconciliation.createPlan({
  local:{id:'local',label:'This device',
    savedDays:[day('2026-09-10','local'),day('2026-09-11','same')],
    savedDayDeletions:[deletion('2026-09-12','2026-09-18T10:00:00.000Z'),deletion('2026-09-13','2026-09-18T11:00:00.000Z')],
    notes:{A:note('A','local A'),Same:note('Same','same')},
    activeSession:session('LOCAL')},
  incoming:{id:'cp_a',label:'Checkpoint A',
    savedDays:[day('2026-09-10','A'),day('2026-09-11','same'),day('2026-09-12','restored')],
    savedDayDeletions:[deletion('2026-09-13','2026-09-19T11:00:00.000Z')],
    notes:{A:note('A','remote A'),B:note('B','remote B'),Same:note('Same','same')},
    activeSession:session('REMOTE-A')}
});

assert.equal(plan.format,'study-director.reconciliation-plan');
assert.deepEqual(plan.localSource,{id:'local',label:'This device',local:true});
assert.deepEqual(plan.incomingSource,{id:'cp_a',label:'Checkpoint A',local:false});
const d10=plan.savedDays.find(item=>item.date==='2026-09-10');
assert.equal(d10.candidates.length,2,'Saved-Day reconciliation must contain only local and incoming divergent states.');
assert.equal(d10.candidates.find(candidate=>candidate.local)?.record.reflection,'local');
assert.equal(d10.defaultCandidateId,d10.localCandidateId,'Local must be the default when present.');
const d11=plan.savedDays.find(item=>item.date==='2026-09-11');
assert.equal(d11.conflict,false);assert.equal(d11.identical,true,'Identical local/incoming Saved Days must collapse.');
const d12=plan.savedDays.find(item=>item.date==='2026-09-12');
assert.deepEqual(d12.candidates.map(candidate=>candidate.kind).sort(),['deleted','record'],'Deletion must be a first-class candidate state.');
const d13=plan.savedDays.find(item=>item.date==='2026-09-13');
assert.equal(d13.candidates.length,1,'Equivalent local/incoming deletion states must collapse.');
assert.equal(d13.candidates[0].deletedAt,'2026-09-19T11:00:00.000Z','Collapsed deletion state must retain the newer deletion timestamp.');
const resolvedDeletion13=reconciliation.resolvePlan(plan,{}).savedDays.find(item=>item.date==='2026-09-13');
assert.equal(resolvedDeletion13.changed,true,'A shared deletion candidate must update an older local deletion timestamp.');

const noteA=plan.notes.find(item=>item.key==='A'),noteB=plan.notes.find(item=>item.key==='B'),noteSame=plan.notes.find(item=>item.key==='Same');
assert.equal(noteA.conflict,true);assert.equal(noteA.defaultCandidateId,noteA.localCandidateId);
assert.equal(noteB.incomingOnly,true,'Missing local Note must be an automatic incoming candidate.');
assert.equal(noteSame.identical,true,'Identical Notes must not conflict.');

assert.equal(plan.activeSession.candidates.length,2,'Active Session reconciliation must remain pairwise.');
assert.equal(plan.activeSession.conflict,true);assert.equal(plan.activeSession.defaultCandidateId,plan.activeSession.localCandidateId);

const summary=reconciliation.summarizePlan(plan);
assert.deepEqual(summary.savedDays,{total:3,newItems:0,conflicts:2,recordConflicts:1,localDeletionConflicts:1,identical:1,deletions:1,deletionConflicts:0,deletionAlreadyAbsent:1},'Saved-Day conflict accounting must have one authoritative reconciliation summary.');
assert.deepEqual(summary.notes,{total:3,localItems:2,newItems:1,conflicts:1,deletions:0},'Note impact must come from the reconciliation domain summary.');
assert.deepEqual(summary.activeSession,{total:1,checkpointPresent:true,localPresent:true,identical:false,newItems:0,conflicts:1},'Active Session impact must come from the reconciliation domain summary.');

const incomingA=d10.candidates.find(candidate=>!candidate.local);
const record12=d12.candidates.find(candidate=>candidate.kind==='record');
const incomingSession=plan.activeSession.candidates.find(candidate=>!candidate.local);
const resolved=reconciliation.resolvePlan(plan,{savedDays:{'2026-09-10':incomingA.id,'2026-09-12':record12.id},activeSession:incomingSession.id});
assert.equal(resolved.format,'study-director.resolved-plan');
assert.equal(resolved.savedDays.find(item=>item.date==='2026-09-10').record.reflection,'A');
assert.equal(resolved.savedDays.find(item=>item.date==='2026-09-12').state,'record');
const customDayValue=freeze({...day('2026-09-10','custom reflection'),version:16,recordKind:'study'});
const customDayResolved=reconciliation.resolvePlan(plan,{savedDays:{'2026-09-10':freeze({value:customDayValue})}});
assert.equal(customDayResolved.savedDays.find(item=>item.date==='2026-09-10').record.reflection,'custom reflection','Saved-Day reconciliation must accept an explicit manually resolved reflection value.');
assert.equal(customDayResolved.savedDays.find(item=>item.date==='2026-09-10').changed,true,'Custom Saved-Day resolution must be marked changed from local.');
assert.equal(resolved.notes.find(item=>item.key==='A').changed,false,'Divergent Note must default to local until rich-text reconciliation resolves it.');
assert.equal(resolved.notes.find(item=>item.key==='B').changed,true,'Missing incoming Note must be selected automatically.');
const customNoteValue=note('A','manually reconciled A');
const customResolved=reconciliation.resolvePlan(plan,{notes:{A:freeze({value:customNoteValue})}});
assert.equal(customResolved.notes.find(item=>item.key==='A').value.text,'manually reconciled A','ResolvedPlan must accept an explicit scratch-editor reconciliation value.');
assert.equal(customResolved.notes.find(item=>item.key==='A').changed,true,'Custom reconciled note must be marked changed from local.');
assert.equal(resolved.activeSession.value.scheduleText,'REMOTE-A');

const localOnlySession=reconciliation.createPlan({local:{id:'local2',label:'Local',activeSession:session('KEEP')},incoming:{id:'empty',label:'Empty checkpoint',activeSession:null}});
const resolvedLocalOnly=reconciliation.resolvePlan(localOnlySession,{});
assert.equal(resolvedLocalOnly.activeSession.value.scheduleText,'KEEP');
assert.equal(resolvedLocalOnly.activeSession.changed,false,'Incoming absence must never clear a local Active Session.');
const incomingOnlySession=reconciliation.createPlan({local:{id:'local3',label:'Local',activeSession:null},incoming:{id:'cp',label:'Checkpoint',activeSession:session('USE')}});
assert.equal(reconciliation.resolvePlan(incomingOnlySession,{}).activeSession.value.scheduleText,'USE','Incoming-only Active Session must be selected automatically.');

// Note deletion is a first-class pairwise state. Local deletion is the
// default against a stale incoming record; incoming deletion requires a choice
// against a live local note.
const noteDeletionPlan=reconciliation.createPlan({
  local:{id:'local-note-delete',label:'Local',notes:{Live:note('Live','keep me')},noteDeletions:[{key:'Gone',deletedAt:'2026-09-19T10:00:00.000Z'}]},
  incoming:{id:'remote-note-delete',label:'Remote',notes:{Gone:note('Gone','stale remote note')},noteDeletions:[{key:'Live',deletedAt:'2026-09-19T11:00:00.000Z'}]}
});
const goneNote=noteDeletionPlan.notes.find(item=>item.key==='Gone'),liveNote=noteDeletionPlan.notes.find(item=>item.key==='Live');
assert.equal(goneNote.conflict,true);assert.equal(goneNote.candidates.find(candidate=>candidate.id===goneNote.defaultCandidateId).kind,'deleted','A local note deletion must default over a stale incoming record.');
assert.equal(reconciliation.resolvePlan(noteDeletionPlan,{}).notes.find(item=>item.key==='Gone').state,'deleted');
assert.equal(liveNote.conflict,true);assert.equal(liveNote.candidates.find(candidate=>candidate.id===liveNote.defaultCandidateId).kind,'record','An incoming note deletion must not silently delete a live local note.');
const incomingNoteDeletion=liveNote.candidates.find(candidate=>candidate.kind==='deleted');
assert.equal(reconciliation.resolvePlan(noteDeletionPlan,{notes:{Live:incomingNoteDeletion.id}}).notes.find(item=>item.key==='Live').state,'deleted','An explicit incoming note deletion choice must resolve to deleted state.');

assert.throws(()=>reconciliation.createPlan({sources:[{id:'a'},{id:'b'}]}),/requires exactly local and incoming/u,'The production reconciliation API must reject the retired N-way shape.');
assert.throws(()=>reconciliation.createPlan({local:{id:'local'},incoming:{id:'incoming'},third:{id:'third'}}),/requires exactly local and incoming/u,'The pairwise reconciliation API must reject unexpected top-level participants or metadata.');
assert.deepEqual(Object.keys(reconciliation).sort(),['contractVersion','createPlan','format','resolvePlan','summarizePlan'],'Dead reconciliation APIs must not remain public.');

// Machine identities must not collide across punctuation, Unicode or truncated labels.
const collisionKeys=['a b','a_b','हिन्दी','中文','x'.repeat(130)+'a','x'.repeat(130)+'b'];
const collisionPlan=reconciliation.createPlan({local:{notes:Object.fromEntries(collisionKeys.map(key=>[key,note(key,'retain '+key)]))},incoming:{noteDeletions:collisionKeys.map(key=>({key,deletedAt:'2026-09-28T10:00:00.000Z'}))}});
assert.equal(new Set(collisionPlan.notes.map(item=>item.decisionKey)).size,collisionKeys.length);
assert.equal(new Set(collisionPlan.notes.flatMap(item=>item.candidates.map(candidate=>candidate.id))).size,collisionKeys.length*2);
const configured=Object.fromEntries(collisionPlan.notes.map((item,index)=>[item.decisionKey,index%2?item.candidates.find(candidate=>candidate.kind==='deleted').id:item.localCandidateId]));
assert.ok(Object.keys(configured).every(id=>id.length<=80));
const collisionResolved=reconciliation.resolvePlan(collisionPlan,{notes:Object.fromEntries(collisionPlan.notes.map(item=>[item.key,configured[item.decisionKey]]))});
collisionResolved.notes.forEach((item,index)=>assert.equal(item.state,index%2?'deleted':'record',`independent decision for ${item.key}`));

console.log(JSON.stringify({status:'PASS',suite:'reconciliation-domain',checks:38,coverage:['pairwise ReconciliationPlan','exact pairwise API guard','ResolvedPlan','Saved-Day deletion candidates','Note deletion candidates','per-key notes','Active Session presence rules','authoritative conflict summary','lean public API','no Reflection Draft reconciliation domain']},null,2));
