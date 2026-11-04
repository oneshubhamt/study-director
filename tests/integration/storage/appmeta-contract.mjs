import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';

// AppMeta is tested as one contract: canonical values, gateway ownership/bounds, and revision-envelope migration.

{ // appmeta-current-values
const stores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()};
const {app}=createHarness(new Map(),stores);

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
const stores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()};
const {appMetaGateway:gateway,repositoryMeta,indexedDb,idbReads}=createHarness(new Map(),stores);

assert.equal(gateway.resolve('dataMaintenance')?.family,'dataMaintenance');
assert.equal(gateway.resolve('savedDayDeletion:2026-09-19')?.family,'savedDayDeletionPrefix');
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
assert.equal(entries[0].suffix,deletion.date);
assert.ok(idbReads.boundedMetaGetAll>beforeBounded,'prefix list must use a bounded IndexedDB range');

await indexedDb.strictTransaction(['daily','meta'],'readwrite',(tx,finish)=>{
  tx.objectStore('daily').put({date:'2026-09-20',version:1});
  const meta=repositoryMeta.view(tx),value={format:'study-director.saved-day-deletion',version:1,date:'2026-09-20',deletedAt};
  meta.put('savedDayDeletionPrefix',value,{suffix:value.date,updatedAt:deletedAt});
  tx.oncomplete=()=>finish(true,true);
},'cross-store appMeta transaction aborted');
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
const stores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map([
  [key,{key,format:'study-director.insights-dataset-revision',version:1,counter:7,updatedAt}]
])};
const {app}=createHarness(new Map(),stores);

const before=await app.compatibility.verifyInsightsRevisionEnvelope();
assert.equal(before.ok,false,'legacy direct appMeta revision row must not count as canonical');
assert.equal(before.legacy,true);

const migrated=await app.compatibility.migrateInsightsRevisionEnvelope();
assert.equal(migrated.status,'migrated');
const row=stores.meta.get(key);
assert.deepEqual(Object.keys(row).sort(),['key','updatedAt','value','version']);
assert.equal(row.key,key);
assert.equal(row.version,1);
assert.equal(row.updatedAt,updatedAt);
assert.deepEqual(Object.keys(row.value).sort(),['counter','format','updatedAt','version']);
assert.equal(row.value.format,'study-director.insights-dataset-revision');
assert.equal(row.value.version,2);
assert.equal(row.value.counter,7);
assert.equal(row.value.updatedAt,updatedAt);

const after=await app.compatibility.verifyInsightsRevisionEnvelope();
assert.equal(after.ok,true);
assert.equal(after.legacy,false);

console.log(JSON.stringify({status:'PASS',suite:'appmeta-insights-envelope',migrated,after},null,2));
}

{ // personal-preferences-resilience
const stores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()};
const controls={};
const harness=createHarness(new Map(),stores,controls);
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
const controls={},h=createHarness(new Map(),null,controls);
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
controls.failNextMetaWrite=true;
await assert.rejects(h.app.planData.replacePortable(after),/injected appMeta write failure/u,
  'portable Personal Data transaction rejects its failure instead of reporting success');
assert.deepEqual(snapshot(),previous,'a failed Personal Data transaction preserves draft, saved Plans and preferences together');
assert.equal(JSON.stringify(await h.app.planData.read()),JSON.stringify(before.plans),'cross-realm Plan values match');
assert.equal((await h.app.personalPreferences.read()).studentName,'Before');
await h.app.planData.replacePortable(after);
assert.equal(h.idbDurability.strict,strict+2,'each attempt uses one strict IndexedDB transaction, not three independent writes');
assert.equal(JSON.stringify(await h.app.planData.read()),JSON.stringify(after.plans),'both Plan records publish together');
const preferences=await h.app.personalPreferences.read();
for(const [key,value] of Object.entries(after.preferences))
  assert.deepEqual(preferences[key],value,`portable setting ${key} publishes with Plans`);
assert.ok(h.stores.meta.has('canonicalMutationEpoch'),'the combined commit carries canonical mutation provenance');
console.log(JSON.stringify({status:'PASS',suite:'portable-personal-atomicity',strictCommits:2,rolledBackOnFailure:true,planAndPreferencesTogether:true}));
}
