import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['source/core/internal.js','source/core/compatibility.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const Compatibility=registry.require('compatibility',1);
const freeze=Object.freeze;

const order=[];
const live=freeze({
  renameIdentities:async()=>{order.push('identities');return freeze({status:'renamed'});},
  cleanupLegacyStorage:async()=>{order.push('legacyStorage');return freeze({status:'cleaned'});},
  migratePlan:async()=>{order.push('plan');return freeze({status:'migrated'});},
  migrateReflections:async()=>{order.push('reflections');return freeze({status:'migrated'});},
  migrateHostMetadata:async()=>{order.push('hostMetadata');return freeze({status:'migrated'});},
  migrateActiveSession:async()=>{order.push('activeSession');return freeze({status:'migrated'});},
  migrateAreaNotes:async()=>{order.push('areaNotes');return freeze({status:'migrated'});},
  migrateAreaNoteRecovery:async()=>{order.push('areaNoteRecovery');return freeze({status:'migrated'});},
  migrateDailyRecords:async()=>{order.push('dailyRecords');return freeze({status:'migrated'});},
  migrateDeletionState:async()=>{order.push('deletionState');return freeze({status:'migrated'});},
  migrateInsightsRevisionEnvelope:async()=>{order.push('insightsRevisionEnvelope');return freeze({status:'migrated'});},
  cleanupLegacyAttachments:async()=>{order.push('attachments');return freeze({status:'cleaned'});},
  cleanupObsoleteMetadata:async()=>{order.push('obsoleteMetadata');return freeze({status:'cleaned'});},
  retireTopology:async()=>{order.push('topology');return freeze({status:'retired'});},
  retireLegacyIdentity:async()=>{order.push('retiredIdentity');return freeze({status:'retired'});}
});
let currentInspections=0,legacyInspections=0;
const backups=freeze({
  inspectCurrent:async file=>{currentInspections++;if(file==='legacy')throw Object.assign(new Error('legacy'),{code:'STUDY_DIRECTOR_LEGACY_BACKUP'});return freeze({kind:'current'});},
  inspectLegacy:async()=>{legacyInspections++;return freeze({kind:'legacy'});}
});
const checkState={};
const names=['planLegacy','reflectionLegacy','activeSession','areaNotes','areaNoteRecovery','dailyRecords','deletionState','insightsRevisionEnvelope','canonicalStores','legacyStorage','legacyAttachments','obsoleteMetadata','topology','retiredIdentity','retiredHostCompatibility','freshBackup'];
const verification=freeze(Object.fromEntries(names.map(name=>[name,async()=>{
  const state=checkState[name];
  if(state instanceof Error)throw state;
  return freeze({ok:state!==false,name});
}])));

const facade=Compatibility.createFacade(freeze({baselineId:'CURRENT_BASELINE',live,backups,verification}));

const failClosedOrder=[];
const failClosedLive=freeze(Object.fromEntries(Object.entries(live).map(([name,fn])=>[name,async()=>{failClosedOrder.push(name);return fn();}])));
const failClosedVerification=freeze({...verification,dailyRecords:async()=>freeze({ok:false})});
const failClosedFacade=Compatibility.createFacade(freeze({baselineId:'FAIL_CLOSED',live:failClosedLive,backups,verification:failClosedVerification}));
await assert.rejects(()=>failClosedFacade.migrateLive(),/verification failed before topology retirement/u);
assert.equal(failClosedOrder.includes('retireTopology'),false,'topology must not retire when canonical verification fails');
assert.equal(failClosedOrder.includes('retireLegacyIdentity'),false,'legacy identity must not retire when canonical verification fails');
order.length=0;

const deferredLive=freeze({...live,migratePlan:async()=>freeze({status:'skipped',reason:'not-primary'})});
const deferredVerification=freeze({...verification,retiredIdentity:async()=>freeze({ok:false,legacyPresent:true})});
const deferredFacade=Compatibility.createFacade(freeze({baselineId:'DEFERRED_LEGACY_IDENTITY',live:deferredLive,backups,verification:deferredVerification}));
await assert.rejects(()=>deferredFacade.migrateLive(),/retiredIdentity/u,'a secondary tab must not enter ordinary runtime while legacy installation identity still requires migration');
order.length=0;

const upgradeWrites=[];
const upgradeStore={put:value=>upgradeWrites.push(value)};
const upgradeTx={objectStore:name=>{assert.equal(name,'meta');return upgradeStore;}};
const upgradeDb={objectStoreNames:{contains:name=>name==='meta'}};
assert.equal(Compatibility.applyIndexedDbUpgrade({oldVersion:2,db:upgradeDb,transaction:upgradeTx,appMetaStore:'meta',dailyRecordMigrationKey:'dailyRecordMigration'}),true);
assert.equal(upgradeWrites.length,1);
assert.equal(upgradeWrites[0].key,'dailyRecordMigration');
assert.equal(upgradeWrites[0].value.complete,false);
assert.equal(Compatibility.applyIndexedDbUpgrade({oldVersion:3,db:upgradeDb,transaction:upgradeTx,appMetaStore:'meta',dailyRecordMigrationKey:'dailyRecordMigration'}),false,'current/future layouts must bypass the retired historical decision');

const [first,second]=await Promise.all([facade.migrateLive(),facade.migrateLive()]);
assert.equal(first,second,'concurrent migration callers must share one facade run');
assert.deepEqual(order,['identities','plan','reflections','activeSession','areaNotes','areaNoteRecovery','dailyRecords','deletionState','insightsRevisionEnvelope','hostMetadata','attachments','obsoleteMetadata','legacyStorage','topology','retiredIdentity'],'physical retirement must occur only after migratable sources are consumed and local canonical proofs pass');
assert.equal(facade.status().migrated,true);

assert.equal((await facade.inspectBackup('current')).kind,'current');
assert.equal((await facade.inspectBackup('legacy')).kind,'legacy');
assert.equal(currentInspections,2);
assert.equal(legacyInspections,1,'legacy reader must only run after the current reader explicitly identifies a legacy backup');

let proof=await facade.verifyCanonicalInstallation();
assert.equal(proof.canonical,true);
assert.equal(proof.backupReady,true);
assert.equal(proof.compatibilityRetired,true);
assert.equal(proof.retirementDataReady,true);
assert.equal(facade.status().lastVerification,proof);


checkState.retiredHostCompatibility=false;
proof=await facade.verifyCanonicalInstallation();
assert.equal(proof.canonical,true,'legacy security compatibility may remain readable without making current user-domain data noncanonical');
assert.equal(proof.compatibilityRetired,false);
assert.equal(proof.retirementDataReady,false,'historical adapters must not be declared removable while an L7 security policy remains');
checkState.retiredHostCompatibility=undefined;
checkState.dailyRecords=false;
proof=await facade.verifyCanonicalInstallation();
assert.equal(proof.canonical,false,'a failed canonical-data check must block canonical status');
assert.equal(proof.backupReady,true);
assert.equal(proof.retirementDataReady,false);
assert.equal(proof.checks.dailyRecords.ok,false);

checkState.dailyRecords=undefined;
checkState.freshBackup=false;
proof=await facade.verifyCanonicalInstallation();
assert.equal(proof.canonical,true,'backup readiness is deliberately separate from local canonical data readiness');
assert.equal(proof.backupReady,false);
assert.equal(proof.retirementDataReady,false);

checkState.freshBackup=undefined;
checkState.legacyAttachments=new Error('OPFS unavailable');
proof=await facade.verifyCanonicalInstallation();
assert.equal(proof.canonical,false);
assert.equal(proof.checks.legacyAttachments.ok,false);
assert.equal(proof.checks.legacyAttachments.reason,'legacyAttachments-verification-failed');
assert.match(proof.checks.legacyAttachments.error,/OPFS unavailable/u);

console.log(JSON.stringify({status:'PASS',suite:'compatibility-retirement',migrationOrder:order,backupRouting:{currentInspections,legacyInspections},proofFormat:proof.format},null,2));
