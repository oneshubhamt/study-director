import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['source/core/internal.js','source/core/managed-recovery.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const module=registry.require('managed-recovery',1);
const freeze=Object.freeze;
const CHECKPOINT='cp_'+'a'.repeat(32);

function harness(options={}){
  const events=[],diagnostics=[];
  let suspended=0,activeLock=false,revision='2026-09-20T12:00:00.000Z';
  const coordinator=module.createCoordinator(freeze({
    automaticBackup:freeze({
      suspend:async reason=>{events.push(`suspend:${reason}`);suspended+=1;if(options.failSuspend)throw new Error('suspend failed');return freeze({token:'s1'});},
      resume:async token=>{events.push(`resume:${token.token}`);suspended-=1;if(options.failResume)throw new Error('resume failed');return true;}
    }),
    diagnostics:freeze({capture:(scope,error,severity)=>diagnostics.push(freeze({scope,message:String(error?.message||error),severity})),mark:(phase,details)=>diagnostics.push(freeze({scope:'phase',message:phase,level:'info'}))}),
    lifecycle:freeze({
      settle:async kind=>{events.push(`settle:${kind}`);if(options.failSettle)throw new Error('settle failed');},
      quiesce:async operation=>{events.push('quiesce:enter');try{return await operation();}finally{events.push('quiesce:exit');}},
      rebuild:async kind=>{events.push(`rebuild:${kind}`);if(options.failRebuild)throw new Error('rebuild failed');},
      revision:()=>revision
    }),
    mutation:freeze({run:async(name,operation)=>{assert.equal(name,'managed-recovery');assert.equal(activeLock,false);activeLock=true;events.push('mutation:enter');try{return await operation();}finally{events.push('mutation:exit');activeLock=false;}}})
  }));
  const spec=freeze({
    kind:options.kind||'restore-version',label:'Device Folder',
    createSafety:async()=>{events.push('safety');if(options.failSafety)throw new Error('safety failed');return freeze({verified:true,checkpointId:CHECKPOINT,sourceRevision:revision});},
    apply:async()=>{events.push('apply');if(options.failApply)throw new Error('apply failed');return options.cancelled?freeze({cancelled:true}):freeze({cancelled:false,value:'restored'});},
    publishPresent:async()=>{events.push('present');if(options.failPresent)throw new Error('present failed');return freeze({status:'completed',checkpointId:'cp_'+'b'.repeat(32)});}
  });
  return {coordinator,spec,events,diagnostics,state:()=>freeze({suspended,activeLock})};
}

{
  const h=harness();
  const result=await h.coordinator.execute(h.spec);
  assert.equal(result.cancelled,false);
  assert.equal(result.managedRecovery.safety.checkpointId,CHECKPOINT);
  assert.equal(result.managedRecovery.present.status,'completed');
  assert.deepEqual(h.events,['mutation:enter','suspend:restore-version','quiesce:enter','settle:restore-version','quiesce:exit','safety','quiesce:enter','settle:restore-version','apply','rebuild:restore-version','quiesce:exit','present','mutation:exit','resume:s1']);
  assert.deepEqual(h.state(),{suspended:0,activeLock:false});
  assert.equal(h.coordinator.status().active,false);
}

{
  const h=harness({failSafety:true});
  await assert.rejects(()=>h.coordinator.execute(h.spec),/safety failed/);
  assert.equal(h.events.includes('apply'),false,'Local mutation must not begin before the protected safety checkpoint is verified.');
  assert.deepEqual(h.events,['mutation:enter','suspend:restore-version','quiesce:enter','settle:restore-version','quiesce:exit','safety','mutation:exit','resume:s1']);
  assert.deepEqual(h.state(),{suspended:0,activeLock:false});
}

{
  const h=harness({failApply:true});
  await assert.rejects(()=>h.coordinator.execute(h.spec),/apply failed/);
  assert.equal(h.events.includes('present'),false,'A failed restore must not publish a false post-operation present.');
  assert.deepEqual(h.events,['mutation:enter','suspend:restore-version','quiesce:enter','settle:restore-version','quiesce:exit','safety','quiesce:enter','settle:restore-version','apply','quiesce:exit','mutation:exit','resume:s1']);
  assert.deepEqual(h.state(),{suspended:0,activeLock:false});
}

{
  const h=harness({failPresent:true});
  const result=await h.coordinator.execute(h.spec);
  assert.equal(result.managedRecovery.present.status,'pending','Post-operation repository failure must not undo an already verified local restore.');
  assert.match(result.managedRecovery.present.reason,/present failed/);
  assert.equal(h.diagnostics.some(row=>row.scope==='managed-recovery.publish-present'),true);
  assert.deepEqual(h.state(),{suspended:0,activeLock:false});
}

{
  const h=harness({cancelled:true,kind:'bring-in'});
  const result=await h.coordinator.execute(h.spec);
  assert.equal(result.cancelled,true);
  assert.equal(result.managedRecovery.present.status,'skipped');
  assert.equal(h.events.includes('rebuild:bring-in'),false);
  assert.equal(h.events.includes('present'),false);
  assert.deepEqual(h.state(),{suspended:0,activeLock:false});
}

{
  const h=harness({failResume:true});
  const result=await h.coordinator.execute(h.spec);
  assert.equal(result.managedRecovery.present.status,'completed');
  assert.equal(h.diagnostics.some(row=>row.scope==='managed-recovery.resume-automatic-backup'),true,'Resume failures must be surfaced diagnostically rather than masking a completed restore.');
  assert.equal(h.coordinator.status().active,false);
}

{
  const h=harness();
  const held=Object.freeze({...h.spec,apply:async()=>{h.events.push('apply');await new Promise(resolve=>setTimeout(resolve,15));return freeze({cancelled:false});}});
  const first=h.coordinator.execute(held);
  await new Promise(resolve=>setTimeout(resolve,1));
  await assert.rejects(()=>h.coordinator.execute(h.spec),/already running/,'Managed recovery must be single-flight even before provider-specific logic is considered.');
  await first;
}

console.log(JSON.stringify({status:'PASS',suite:'managed-recovery-coordinator',orderedTransaction:true,verifiedSafetyBeforeMutation:true,automaticBackupSuspension:true,restoreFailureResumes:true,publishFailureDegradesToPending:true,cancellationSkipsPostPublish:true,singleFlight:true},null,2));
