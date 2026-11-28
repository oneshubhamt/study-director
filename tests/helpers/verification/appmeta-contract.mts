import assert from 'node:assert/strict';
import {createHarness,type RepositoryControls} from '../repository-harness.mts';
import {method} from '../registered-exports.mts';
import {jsonObject,jsonArray,jsonString} from './read-verification.mts';

function checkedHarness(...args:Parameters<typeof createHarness>){
  const h=createHarness(...args),app=jsonObject(h.app),gateway=h.appMetaGateway,meta=h.repositoryMeta;
  const proof=(value:unknown)=>{const row=jsonObject(value);return {ok:row['ok'],rows:row['rows'],issues:Array.from(jsonArray(row['issues']),jsonString)};};
  const call=(owner:string,name:string)=>method(app[owner],name);
  const asyncCall=(owner:string,name:string)=>(...values:unknown[])=>Promise.resolve(call(owner,name)(...values));
  return {...h,app:{
    metadata:{verifyCurrent:async()=>proof(await asyncCall('metadata','verifyCurrent')())},
    personalPreferences:{read:async()=>jsonObject(await asyncCall('personalPreferences','read')()),
      replace:(value:unknown)=>asyncCall('personalPreferences','replace')(value),write:(value:unknown)=>asyncCall('personalPreferences','write')(value)},
    planData:{read:async()=>jsonObject(await asyncCall('planData','read')()),replacePortable:(value:unknown)=>asyncCall('planData','replacePortable')(value),
      writeDraft:(value:string,options:{strictDurability:boolean})=>asyncCall('planData','writeDraft')(value,options)}
  },appMetaGateway:{resolve:(key:string)=>{const value=method(gateway,'resolve')(key);return value===null?null:jsonObject(value);},verifyAll:async()=>proof(await method(gateway,'verifyAll')())},
  repositoryMeta:{
    read:async(name:string)=>method(meta,'read')(name),
    write:async(name:string,value:unknown,options?:{suffix?:string;updatedAt?:string;strict?:boolean})=>method(meta,'write')(name,value,options),
    list:async(name:string)=>Array.from(jsonArray(await method(meta,'list')(name)),jsonObject),
    view:(tx:unknown)=>{const view=method(meta,'view')(tx);return {put:(name:string,value:unknown,options:{suffix:string;updatedAt:string})=>method(view,'put')(name,value,options)};}
  }};
}

// AppMeta is tested as one contract: canonical values, gateway ownership/bounds, and revision-envelope migration.

{ // appmeta-current-values
const stores={area:new Map<string,unknown>(),sync:new Map<string,unknown>(),tombstones:new Map<string,unknown>(),reflection:new Map<string,unknown>(),daily:new Map<string,unknown>(),summary:new Map<string,unknown>(),session:new Map<string,unknown>(),meta:new Map<string,unknown>()};
const {app}=checkedHarness(new Map<string,unknown>(),stores);

let proof=await app.metadata.verifyCurrent();
assert.equal(proof.ok,true,'an empty optional appMeta surface must be canonical');

const epoch={format:'study-director.canonical-mutation-epoch',version:1,token:'a'.repeat(32),committedAt:'2026-09-16T09:59:00.000Z'};
stores.meta.set('canonicalMutationEpoch',{key:'canonicalMutationEpoch',version:1,value:epoch,updatedAt:epoch.committedAt});
proof=await app.metadata.verifyCurrent();
assert.equal(proof.ok,true,'the canonical mutation epoch must be accepted as device-local coordination metadata');
stores.meta.set('canonicalMutationEpoch',{key:'canonicalMutationEpoch',version:1,value:{...epoch,token:'too-short'},updatedAt:epoch.committedAt});
proof=await app.metadata.verifyCurrent();
assert.equal(proof.ok,false,'a malformed canonical mutation epoch must fail closed');
assert.ok(proof.issues.some(issue=>issue.startsWith('canonicalMutationEpoch:')&&issue.includes('value is not canonical')));
stores.meta.delete('canonicalMutationEpoch');

const maintenance={version:6,status:'completed',completedAt:'2026-09-16T10:00:00.000Z'};
stores.meta.set('dataMaintenance',{key:'dataMaintenance',version:1,value:maintenance,updatedAt:maintenance.completedAt});
proof=await app.metadata.verifyCurrent();
assert.equal(proof.ok,true,'current maintenance metadata must validate exactly');
stores.meta.set('dataMaintenance',{key:'dataMaintenance',version:1,value:{...maintenance,version:5},updatedAt:maintenance.completedAt});
proof=await app.metadata.verifyCurrent();
assert.equal(proof.ok,false,'an older maintenance version is not current; the compatibility host retires it');

stores.meta.set('dataMaintenance',{key:'dataMaintenance',version:1,value:{...maintenance,staleField:true},updatedAt:maintenance.completedAt});
proof=await app.metadata.verifyCurrent();
assert.equal(proof.ok,false,'unknown appMeta value fields must be rejected');
assert.ok(proof.issues.some(issue=>issue.startsWith('dataMaintenance:')&&issue.includes('value is not canonical')));

stores.meta.set('dataMaintenance',{key:'dataMaintenance',version:1,value:maintenance,updatedAt:maintenance.completedAt,legacy:true});
proof=await app.metadata.verifyCurrent();
assert.equal(proof.ok,false,'noncanonical appMeta row envelopes must be rejected');
assert.ok(proof.issues.some(issue=>issue.startsWith('dataMaintenance:')&&issue.includes('envelope is not canonical')));

console.log(JSON.stringify({status:'PASS',suite:'appmeta-current-values',proof},null,2));
}

{ // appmeta-gateway
const stores={area:new Map<string,unknown>(),sync:new Map<string,unknown>(),tombstones:new Map<string,unknown>(),reflection:new Map<string,unknown>(),daily:new Map<string,unknown>(),summary:new Map<string,unknown>(),session:new Map<string,unknown>(),meta:new Map<string,unknown>()};
const {appMetaGateway:gateway,repositoryMeta,indexedDb,idbReads}=checkedHarness(new Map<string,unknown>(),stores);

assert.equal(gateway.resolve('dataMaintenance')?.['family'],'dataMaintenance');
assert.equal(gateway.resolve('savedDayDeletion:2026-09-19')?.['family'],'savedDayDeletionPrefix');
assert.equal(gateway.resolve('savedDayDeletion:') ,null,'empty prefix suffix must not resolve as a current identity');
assert.equal(gateway.resolve('unknown.key'),null,'unknown appMeta identity must not resolve');
await assert.rejects(repositoryMeta.read('restoreJournalPayload'),/owned by repository-journals/,'repository capability must not access journal families');

const maintenance={version:6,status:'completed',completedAt:'2026-09-19T10:00:00.000Z'};
await repositoryMeta.write('dataMaintenance',maintenance,{updatedAt:maintenance.completedAt,strict:true});
assert.deepEqual(await repositoryMeta.read('dataMaintenance'),maintenance);
await assert.rejects(repositoryMeta.write('dataMaintenance',{...maintenance,unexpected:true},{strict:true}),/not canonical/,'family-specific validator must reject noncanonical values before publication');

const deletedAt='2026-09-19T11:00:00.000Z';
const deletion={format:'study-director.saved-day-deletion',version:1,date:'2026-09-18',deletedAt};
await repositoryMeta.write('savedDayDeletionPrefix',deletion,{suffix:deletion.date,updatedAt:deletedAt,strict:true});
const beforeBounded=idbReads.boundedMetaGetAll;
const entries=await repositoryMeta.list('savedDayDeletionPrefix');
assert.equal(entries.length,1);
assert.equal(entries[0]?.['suffix'],deletion.date);
assert.ok(idbReads.boundedMetaGetAll>beforeBounded,'prefix list must use a bounded IndexedDB range');

await indexedDb.strictTransaction(['daily','meta'],'readwrite',(tx,finish)=>{
  tx.objectStore('daily').put({date:'2026-09-20',version:1});
  const meta=repositoryMeta.view(tx),value={format:'study-director.saved-day-deletion',version:1,date:'2026-09-20',deletedAt};
  meta.put('savedDayDeletionPrefix',value,{suffix:value.date,updatedAt:deletedAt});
  tx.oncomplete=()=>finish(true,true);
});
assert.ok(stores.daily.has('2026-09-20'));
assert.ok(stores.meta.has('savedDayDeletion:2026-09-20'),'transaction-scoped view must participate in an existing cross-store transaction');

stores.meta.set('dataMaintenance',{key:'dataMaintenance',version:1,value:maintenance,updatedAt:maintenance.completedAt,unexpected:true});
await assert.rejects(repositoryMeta.read('dataMaintenance'),/envelope is not canonical/,'typed reads must fail closed on malformed envelopes');
stores.meta.delete('dataMaintenance');
stores.meta.set('unclassified',{key:'unclassified',version:1,value:{},updatedAt:deletedAt});
const proof=await gateway.verifyAll();
assert.equal(proof.ok,false);
assert.ok(proof.issues.some(issue=>issue==='unclassified:unclassified'));

console.log(JSON.stringify({status:'PASS',suite:'appmeta-gateway',ownerRestrictions:true,boundedPrefixReads:true,transactionView:true,failClosed:true},null,2));
}

{ // appmeta-insights-envelope
const key='insightsDatasetRevision';
const updatedAt='2026-09-16T10:00:00.000Z';
const stores={area:new Map<string,unknown>(),sync:new Map<string,unknown>(),tombstones:new Map<string,unknown>(),reflection:new Map<string,unknown>(),daily:new Map<string,unknown>(),summary:new Map<string,unknown>(),session:new Map<string,unknown>(),meta:new Map<string,unknown>([
  [key,{key,format:'study-director.insights-dataset-revision',version:1,counter:7,updatedAt}]
])};
const original=structuredClone(stores.meta.get(key));
const gateway=checkedHarness(new Map<string,unknown>(),stores).repositoryMeta;
await assert.rejects(gateway.read('insightsDatasetRevision'),/envelope is not canonical/);
assert.deepEqual(stores.meta.get(key),original,'unsupported metadata is not converted or rewritten');
console.log(JSON.stringify({status:'PASS',suite:'appmeta-insights-envelope',unsupportedRejected:true}));
}

{ // personal-preferences-resilience
const stores={area:new Map<string,unknown>(),sync:new Map<string,unknown>(),tombstones:new Map<string,unknown>(),reflection:new Map<string,unknown>(),daily:new Map<string,unknown>(),summary:new Map<string,unknown>(),session:new Map<string,unknown>(),meta:new Map<string,unknown>()};
const controls:RepositoryControls={};
const harness=checkedHarness(new Map<string,unknown>(),stores,controls);
const preferences=harness.app.personalPreferences;
const canonical=Object.freeze({
  version:2,studentName:'Canonical',theme:'glass',presentation:'glass',quote:'Persist me',practiceCueMode:'quiet',
  fontScale:1.08,practiceTargetMs:600000,nudge:Object.freeze({enabled:true,sound:false,nudgeAfter:45,breakMinutes:5}),updatedAt:'2026-09-20T01:00:00.000Z'
});
await preferences.replace(canonical);
assert.deepEqual(await preferences.read(),canonical,'current PortablePreferences.v2 must round-trip through typed appMeta');
assert.ok(harness.idbDurability.strict>0,'Portable Preferences publication must use a strict IndexedDB transaction');

const before=structuredClone(stores.meta.get('personalPreferences'));
controls.failNextMetaWrite=true;
await assert.rejects(
  ()=>preferences.write({...canonical,theme:'light'}),
  /injected appMeta write failure/i,
  'an IndexedDB failure must reject the canonical Preferences write'
);
assert.deepEqual(stores.meta.get('personalPreferences'),before,'failed canonical Preferences publication must not replace the last durable row');


console.log(JSON.stringify({
  status:'PASS',suite:'preferences-resilience',
  canonicalRoundTrip:true,
  strictPublication:true,
  canonicalWriteFailurePreservesPriorRow:true
},null,2));
}

{ // bf2-portable-personal-atomicity
const controls:RepositoryControls={},h=checkedHarness(new Map<string,unknown>(),null,controls);
const before={version:2,plans:{draft:'Local unsaved working draft',savedPlans:[],defaultId:null},
  preferences:{studentName:'Before',theme:'glass',presentation:'glass',quote:'Original',
    practiceCueMode:'quiet',fontScale:1,practiceTargetMs:600000,nudge:null}};
const after={version:2,plans:{draft:'Another device draft',savedPlans:[],defaultId:null},
  preferences:{...before.preferences,studentName:'After',theme:'aurora',quote:'Changed'}};
const keys=['planDraft','planLibrary','personalPreferences'];
const snapshot=()=>Object.fromEntries(keys.map(key=>[key,structuredClone(h.stores.meta.get(key))]));
await h.app.planData.replacePortable(before);
assert.equal(JSON.stringify(await h.app.planData.read()),JSON.stringify(before.plans),'cross-realm Plan values match');
const previous=snapshot(),strict=h.idbDurability.strict;
const durableBefore=structuredClone(h.stores.meta);
controls.failNextMetaWrite=true;
await assert.rejects(h.app.planData.replacePortable(after),/injected appMeta write failure/u,
  'portable Personal Data transaction rejects its failure instead of reporting success');
assert.deepEqual(snapshot(),previous,'a failed Personal Data transaction preserves draft, saved Plans and preferences together');
assert.equal(JSON.stringify(await h.app.planData.read()),JSON.stringify(before.plans),'cross-realm Plan values match');
assert.equal((await h.app.personalPreferences.read())['studentName'],'Before');
// The last put fails after the epoch, preparation stamp and both Plan rows
// have been submitted. The whole transaction must roll back, not just its last row.
controls.failNextMetaRequest={operation:'put',key:'personalPreferences'};
await assert.rejects(h.app.planData.replacePortable(after),/transaction aborted|injected appMeta request failure/u);
assert.equal(controls.failNextMetaRequest,undefined,'the last queued put actually failed');
assert.deepEqual(h.stores.meta,durableBefore,'late failure preserves every canonical and coordination row');
const restarted=checkedHarness(h.sharedLocal,h.stores);
assert.equal(JSON.stringify(await restarted.app.planData.read()),JSON.stringify(before.plans));
assert.equal((await restarted.app.personalPreferences.read())['studentName'],'Before');
await h.app.planData.replacePortable(after);
assert.equal(h.idbDurability.strict,strict+3,'each attempt uses one strict IndexedDB transaction, not three independent writes');
assert.equal(JSON.stringify(await h.app.planData.read()),JSON.stringify(after.plans),'both Plan records publish together');
const recovered=checkedHarness(h.sharedLocal,h.stores);
assert.equal(JSON.stringify(await recovered.app.planData.read()),JSON.stringify(after.plans),'retried Plan documents survive restart');
const preferences=await recovered.app.personalPreferences.read();
for(const [key,value] of Object.entries(after.preferences))
  assert.deepEqual(preferences[key],value,`portable setting ${key} publishes with Plans`);
assert.ok(h.stores.meta.has('canonicalMutationEpoch'),'the combined commit carries canonical mutation provenance');

// Explicit user Apply/Done must use the same strict IDB durability boundary,
// while a failed write must leave the previous canonical draft intact.
const strictBeforeDraft=h.idbDurability.strict;
controls.failNextMetaWrite=true;
await assert.rejects(h.app.planData.writeDraft('unsafely rejected',{strictDurability:true}),
  /injected appMeta write failure/u,'explicit Plan save rejects a failed strict write');
assert.equal((await h.app.planData.read())['draft'],after.plans.draft,
  'a failed strict Plan write does not replace the canonical draft');
await h.app.planData.writeDraft('strict Plan saved',{strictDurability:true});
assert.equal(h.idbDurability.strict,strictBeforeDraft+2,
  'failed and completed explicit Plan writes each use the existing strict transaction path');
assert.equal((await h.app.planData.read())['draft'],'strict Plan saved');
console.log(JSON.stringify({status:'PASS',suite:'portable-personal-atomicity',strictCommits:2,rolledBackOnFailure:true,planAndPreferencesTogether:true}));
}
