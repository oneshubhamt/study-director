import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';

const rawRecovery={
  version:1,revision:7,updatedAt:'2026-09-17T10:00:00.000Z',
  shell:{
    id:'active',type:'activeSession',version:7,revision:7,date:'2026-09-16',status:'suspended',
    scheduleText:'07:00 | 60 | A | Study | Area | pages | 10',suspendedAt:'2026-09-17T09:00:00.000Z',updatedAt:'2026-09-17T10:00:00.000Z',
    entityType:'activeSession',entityId:'current',schemaVersion:1,deviceId:'dev_r10',createdAt:'2026-09-16T07:00:00.000Z',deleted:false,syncStatus:'pending'
  },
  snapshot:{date:'2026-09-16',payload:'preserve-me'},
  deviceId:'dev_r10',syncStatus:'pending'
};
const local=new Map([['recovery',rawRecovery]]);
const {app}=createHarness(local);
const before=await app.compatibility.verifyActiveSession();
assert.equal(before.ok,false,'legacy recovery shell must fail the pre-retirement canonical proof');
assert.ok(before.issues.includes('active-session-recovery-noncanonical'));
const result=await app.compatibility.migrateActiveSession();
assert.equal(result.status,'migrated');
assert.equal(result.rewritten,0);
assert.equal(result.recoveryRewritten,1,'legacy recovery envelope must be rewritten even when no IndexedDB session exists');

const current=local.get('recovery');
assert.ok(current);
assert.deepEqual(Object.keys(current).sort(),['revision','shell','snapshot','updatedAt','version']);
assert.deepEqual(Object.keys(current.shell).sort(),['date','id','revision','scheduleText','status','suspendedAt','type','updatedAt','version']);
for(const key of ['entityType','entityId','schemaVersion','deviceId','createdAt','deleted','syncStatus']){
  assert.equal(Object.hasOwn(current.shell,key),false,`legacy shell field ${key} must be retired`);
}
assert.equal(Object.hasOwn(current,'deviceId'),false);
assert.equal(Object.hasOwn(current,'syncStatus'),false);
assert.equal(current.snapshot.payload,'preserve-me','recovery snapshot content must survive shell canonicalization');

const proof=await app.compatibility.verifyActiveSession();
assert.equal(proof.ok,true,'rewritten recovery envelope must pass the pre-retirement canonical proof');
assert.deepEqual(Array.from(proof.issues),[]);
const second=await app.compatibility.migrateActiveSession();
assert.equal(second.status,'current','canonical recovery payload must be idempotent on restart');
assert.equal(second.recoveryRewritten,0);

console.log(JSON.stringify({status:'PASS',suite:'active-session-recovery-migration',rewrittenOnce:true,idempotent:true},null,2));
