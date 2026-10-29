import {readCoreScript,coreScriptPath} from '../../helpers/core-script.mjs';
import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {Sha256} from '../../../portable/sha256.ts';
import {hashSnapshot} from '../../../portable/integrity-hash.ts';

// Execute canonical host normalization and persistence, using atomic transaction
// boundaries with injectable read/write/commit failures and real handle identity.
const app=fs.readFileSync('source/app.html','utf8');
const normalization=app.slice(app.indexOf('function normalizeRepositoryIntegrityTarget('),app.indexOf('async function libraryClearSnapshot('));
const persistence=app.slice(app.indexOf('let repositoryIntegrityWriteChain='),app.indexOf('const RepositoryIntegrityContinuation='));
const objectId=char=>'obj_'+char.repeat(32),scanId='a'.repeat(64),stamp='2026-09-01T00:00:00.000Z';
function fixture(){
  const state={readFailed:false,txReadFailed:false,writeFailed:false,commitFailed:false,owner:true,drive:'drive-one',device:'device-one',durable:null,writes:0,health:[],transactions:0};
  const context={console,Object,Date,Promise,crypto:webcrypto,appCanMutate:()=>state.owner,
    BackupProviderRuntime:{repositoryScope:async id=>id==='device-folder'?state.device:state.drive},AppDiagnostics:{capture(){}},
    repositoryIntegrityBoundScopes:{},renderIntegrityStatuses(){},markStorageHealthError:(key,message)=>state.health.push({kind:'warn',key,message}),markStorageHealthOk:key=>state.health.push({kind:'ok',key}),
    BackupAppMeta:{read:async()=>{if(state.readFailed)throw new Error('read unavailable');return state.durable;},transaction:(_mode,operation,options)=>{
      assert.equal(options.strict,true);state.transactions++;
      return new Promise((resolve,reject)=>{
        let next=null,finished=false;
        const finish=(ok,value)=>{if(finished)return;finished=true;if(!ok){reject(value);return;}if(state.commitFailed){reject(new Error('commit unavailable'));return;}state.durable=next;state.writes++;resolve(value);};
        const tx={oncomplete:null},view={get(){const request={};queueMicrotask(()=>{if(state.txReadFailed){request.error=new Error('transaction read unavailable');request.onerror?.();}else{request.onsuccess?.();if(!finished)queueMicrotask(()=>tx.oncomplete?.());}});return {request,value:()=>state.durable};},put(_name,value){next=value;const request={};if(state.writeFailed)queueMicrotask(()=>{request.error=new Error('write unavailable');request.onerror?.();});return request;}};
        operation(view,tx,finish);
      });
    }}
  };
  vm.createContext(context);for(const name of ['internal','integrity-continuation'])vm.runInContext(readCoreScript(name),context,{filename:coreScriptPath(name)});context.IntegrityContinuationModule=context[Symbol.for('studyDirector.internalModules.v1')].require('integrity-continuation',1);vm.runInContext(normalization+persistence,context);
  state.durable=context.normalizeRepositoryIntegrityState({version:7,locations:{
    'device-folder':{repositoryScope:'device-one',completedAt:stamp},
    'google-drive':{repositoryScope:'drive-one',completedAt:stamp,failedAt:stamp,cursor:objectId('b'),scanId,quarantinedObjectIds:[objectId('c')]}}});
  return {state,context};
}
const cases=[];async function test(name,run){await run();cases.push(name);}
await test('read, transactional read, write and commit failures preserve both providers',async()=>{
  for(const field of ['readFailed','txReadFailed','writeFailed','commitFailed']){
    const h=fixture(),before=h.state.durable;h.state[field]=true;
    await assert.rejects(h.context.updateRepositoryIntegrityTarget('device-folder',{repositoryScope:'device-one',status:'completed',complete:true}));
    assert.equal(h.state.durable,before,field);assert.equal(h.state.writes,0,field);assert.deepEqual(Array.from(h.state.durable.locations['google-drive'].quarantinedObjectIds),[objectId('c')]);
    h.state[field]=false;const saved=await h.context.updateRepositoryIntegrityTarget('device-folder',{repositoryScope:'device-one',status:'completed',complete:true});assert.ok(saved.completedAt);assert.equal(h.state.writes,1);assert.equal(JSON.stringify(h.state.durable.locations['google-drive']),JSON.stringify(before.locations['google-drive']),'transaction must preserve unrelated target');
  }
});
await test('budget yield and restart preserve last verified cursor and scan identity',async()=>{
  const h=fixture();await h.context.updateRepositoryIntegrityTarget('device-folder',{repositoryScope:'device-one',status:'yielded',reason:'budget',cursor:objectId('d'),scanId});
  const restarted=await h.context.readRepositoryIntegrityTarget('device-folder');assert.equal(restarted.cursor,objectId('d'));assert.equal(restarted.scanId,scanId);assert.ok(restarted.cycleStartedAt);assert.equal(restarted.completedAt,stamp);
});
await test('unavailable reads retain quarantine and do not manufacture a corrupt object',async()=>{
  const h=fixture();for(const quarantined of [undefined,[],[objectId('c')]])await h.context.updateRepositoryIntegrityTarget('google-drive',{repositoryScope:'drive-one',status:'unavailable',reason:'timeout',complete:true,quarantined});
  assert.equal(h.state.durable.locations['google-drive'].history.at(-1).complete,false,'unavailable cannot claim complete verification even with a stale progress flag');
  assert.deepEqual(Array.from(h.state.durable.locations['google-drive'].quarantinedObjectIds),[objectId('c')]);assert.equal(h.state.durable.locations['google-drive'].cursor,objectId('b'));assert.equal(h.state.durable.locations['google-drive'].scanId,scanId);assert.equal(h.state.durable.locations['google-drive'].completedAt,stamp);assert.ok(h.state.durable.locations['google-drive'].failedAt);
});
await test('partial progress cannot clear unresolved failure or quarantine health',async()=>{
  const h=fixture();await h.context.updateRepositoryIntegrityTarget('google-drive',{repositoryScope:'drive-one',status:'yielded',cursor:objectId('d'),scanId});assert.equal(h.state.durable.locations['google-drive'].failedAt,stamp);assert.equal(h.state.health.at(-1).kind,'warn');
  await h.context.updateRepositoryIntegrityTarget('google-drive',{repositoryScope:'drive-one',status:'completed',complete:true,quarantined:[objectId('c')]});assert.equal(h.state.durable.locations['google-drive'].failedAt,'');assert.equal(h.state.health.at(-1).kind,'warn','a cycle that skipped quarantine is not healthy');
});
await test('the same Device Folder repository keeps state; a replaced one starts over',async()=>{
  const h=fixture();assert.equal((await h.context.readRepositoryIntegrityTarget('device-folder')).repositoryScope,'device-one');assert.equal(h.state.writes,0);
  h.state.device='device-two';const target=await h.context.readRepositoryIntegrityTarget('device-folder');assert.equal(target.repositoryScope,'device-two');assert.equal(target.completedAt,'');assert.equal(target.cursor,'');
});
await test('a location with no record yet starts its own entry and leaves the others untouched',async()=>{
  const h=fixture(),drive=h.state.durable.locations['google-drive'];h.state.durable={version:7,locations:{'google-drive':drive}};
  const bound=await h.context.readRepositoryIntegrityTarget('device-folder');assert.equal(bound.repositoryScope,'device-one');assert.equal(bound.completedAt,'');
  await h.context.updateRepositoryIntegrityTarget('device-folder',{repositoryScope:'device-one',status:'yielded',cursor:objectId('d'),scanId});
  assert.equal(h.state.durable.locations['device-folder'].cursor,objectId('d'));assert.equal(JSON.stringify(h.state.durable.locations['google-drive']),JSON.stringify(drive));
});
await test('Drive recreation and stale scan results cannot contaminate the new repository',async()=>{
  const h=fixture();h.state.drive='drive-two';await assert.rejects(h.context.updateRepositoryIntegrityTarget('google-drive',{repositoryScope:'drive-one',status:'failed',quarantined:[objectId('e')]}),{code:'REPOSITORY_CHANGED'});
  const target=h.state.durable.locations['google-drive'];assert.equal(target.repositoryScope,'drive-two');assert.equal(target.completedAt,'');assert.equal(target.failedAt,'');assert.equal(target.quarantinedObjectIds.length,0);
});
await test('concurrent provider progress is serialized and preserves each checkpoint',async()=>{
  const h=fixture();await Promise.all([
    h.context.updateRepositoryIntegrityTarget('device-folder',{repositoryScope:'device-one',status:'yielded',cursor:objectId('d'),scanId}),
    h.context.updateRepositoryIntegrityTarget('google-drive',{repositoryScope:'drive-one',status:'yielded',cursor:objectId('e'),scanId})]);
  assert.equal(h.state.durable.locations['device-folder'].cursor,objectId('d'));assert.equal(h.state.durable.locations['google-drive'].cursor,objectId('e'));assert.deepEqual(Array.from(h.state.durable.locations['google-drive'].quarantinedObjectIds),[objectId('c')]);
});
await test('unscoped completion cannot postpone a new repository scan',async()=>{
  const h=fixture();h.state.durable={version:7,locations:{'device-folder':{completedAt:stamp},'google-drive':{completedAt:stamp,quarantinedObjectIds:[objectId('c')]}}};
  const bound=await h.context.readRepositoryIntegrityTarget('google-drive');assert.equal(bound.repositoryScope,'drive-one');assert.equal(bound.completedAt,'');assert.equal(bound.quarantinedObjectIds.length,0);assert.equal(h.state.durable.locations['device-folder'].completedAt,stamp);
});
await test('lost write ownership and results without repository identity fail closed',async()=>{
  const h=fixture();h.state.owner=false;const before=h.state.durable;await assert.rejects(h.context.updateRepositoryIntegrityTarget('device-folder',{repositoryScope:'device-one',status:'completed',complete:true}));assert.equal(h.state.durable,before);
  await assert.rejects(h.context.updateRepositoryIntegrityTarget('device-folder',{status:'completed',complete:true}));assert.equal(h.state.durable,before);
});
await test('Drive executor quarantines confirmed corruption while retaining availability and yield progress',async()=>{
  const source=fs.readFileSync('source/core/backup-provider.js','utf8'),start=source.indexOf('  async function runConfiguredIntegrityScrub('),end=source.indexOf('  async function backupRepositoryProvider(',start);
  let failure;const context={Object,String,freeze:Object.freeze,integrityScrubHooks:{},repositoryProviderObjectIds:rows=>Object.freeze([...new Set(rows)]),AppDiagnostics:{capture(){}},scrubRepositoryProvider:async()=>{throw failure;}};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  for(const [code,name,status,quarantine] of [['DRIVE_TIMEOUT','Error','unavailable',false],['NotAllowedError','NotAllowedError','unavailable',false],['BACKUP_LOCKED','Error','unavailable',false],['REPOSITORY_INTEGRITY_CORRUPT','Error','failed',true],['REPOSITORY_OBJECT_MISSING','Error','failed',true],['REPOSITORY_INTEGRITY_BUDGET','AbortError','yielded',false]]){
    failure=Object.assign(new Error('test failure'),{code,name,repositoryObjectId:objectId('d'),repositoryScrubProgress:{cursor:objectId('e'),scanId,checked:1,quarantined:[objectId('c')]}});
    const result=await context.runConfiguredIntegrityScrub({id:'google-drive',repository:{}},{repositoryScope:'drive-one',skipObjectIds:[objectId('c')]});
    assert.equal(result.status,status,code);assert.equal(result.repositoryScope,'drive-one');assert.equal(result.cursor,objectId('e'));assert.equal(result.scanId,scanId);assert.equal(result.quarantined.includes(objectId('d')),quarantine,code);assert.ok(result.quarantined.includes(objectId('c')));
  }
});
await test('the validator accepts only the current record and rejects older versions',async()=>{
  const h=fixture(),context=h.context;
  for(const file of ['source/core/host-metadata.ts'])vm.runInContext(readScript(file),context);
  vm.runInContext(app.slice(app.indexOf('function sameDataValue('),app.indexOf('function normalizeStudyQuality(')),context);
  const module=context[Symbol.for('studyDirector.internalModules.v1')].require('host-metadata',1),names=['verifiedRecoveryBackups','backupProtection','attachmentIntegrityAudit','deviceFolder','repositoryIntegrityScrub','managedProviderBackupPending','repositoryMaintenancePending','reconciliationBase','reconciliationBaseNotePrefix','reconciliationBaseDayPrefix'];
  const validators=module.createAppMetaValidators(Object.freeze({keys:Object.freeze(Object.fromEntries(names.map(name=>[name,name]))),same:context.sameDataValue,normalizers:Object.freeze({verifiedRecovery:value=>value,attachmentIntegrity:value=>value,repositoryIntegrity:context.normalizeRepositoryIntegrityState,reconciliationBase:value=>value,reconciliationBaseNote:value=>value,reconciliationBaseDays:value=>value})}));
  const validate=value=>validators.repositoryIntegrityScrub(value,{key:'repositoryIntegrityScrub'});
  assert.equal(h.state.durable.version,7);assert.equal(validate(h.state.durable),true);
  const drive=h.state.durable.locations['google-drive'],device=h.state.durable.locations['device-folder'];
  for(const record of [{version:2,device,drive},{version:6,device,drive},{...h.state.durable,version:6}])assert.equal(validate(record),false,`version ${record.version} is not read by the ordinary runtime`);
  const large={...drive,quarantinedObjectIds:Array.from({length:257},(_,i)=>'obj_'+(i+1).toString(16).padStart(32,'0'))};
  const record={version:7,locations:{'device-folder':device,'google-drive':large}};assert.equal(validate(record),true);assert.equal(context.normalizeRepositoryIntegrityState(record).locations['google-drive'].quarantinedObjectIds.length,257);
  assert.equal(validate({...h.state.durable,locations:{...h.state.durable.locations,'google-drive':{...drive,recheck:true,recheckCursor:'invalid'}}}),false);
  assert.equal(validate({...h.state.durable,locations:{...h.state.durable.locations,'Bad Id':drive}}),false,'location ids are validated');
  assert.equal(validate({...h.state.durable,locations:{...h.state.durable.locations,'device-folder':{...device,repositoryHandle:null}}}),false);
  assert.equal(validate({...h.state.durable,unknownField:true}),false);assert.equal(validate({...h.state.durable,version:99}),false);
});
await test('the recheck action is scoped, retains quarantine, and requires write control',async()=>{
 const h=fixture(),queued=[];h.context.BackupProviderRuntime.locationStatus=()=>({connected:true});h.context.BackupProviderRuntime.requestIntegrity=id=>queued.push(id);h.context.setStatus=()=>{};
 const start=app.indexOf('async function requestRepositoryIntegrityRecheck('),end=app.indexOf('const ATTACHMENT_INTEGRITY_META_KEY=',start);vm.runInContext(app.slice(start,end),h.context);
 await h.context.mutateRepositoryIntegrityTarget('google-drive',current=>({...current,recheck:true,recheckCursor:objectId('c')}));
 assert.equal(await h.context.requestRepositoryIntegrityRecheck('google-drive'),true);assert.equal(h.state.durable.locations['google-drive'].recheckCursor,'');assert.equal(queued[0],'google-drive');assert.equal(h.state.durable.locations['google-drive'].recheck,true);assert.ok(h.state.durable.locations['google-drive'].requestId);assert.equal(h.state.durable.locations['google-drive'].quarantinedObjectIds.length,1);
 const before=h.state.durable;h.state.owner=false;assert.equal(await h.context.requestRepositoryIntegrityRecheck('device-folder'),false);assert.equal(h.state.durable,before);
});
await test('a new recheck rejects older results and clears quarantine only after successful verification',async()=>{
 const h=fixture(),before=h.state.durable.locations['google-drive'],requestId='00000000-0000-0000-0000-000000000001';
 await h.context.mutateRepositoryIntegrityTarget('google-drive',current=>({...current,requestId,recheck:true,cursor:'',scanId:'',partial:null,cycleStartedAt:stamp}));
 await assert.rejects(h.context.updateRepositoryIntegrityTarget('google-drive',{repositoryScope:'drive-one',status:'completed',complete:true,quarantined:[]}),{code:'REPOSITORY_CHANGED'});assert.equal(h.state.durable.locations['google-drive'].recheck,true);assert.deepEqual(Array.from(h.state.durable.locations['google-drive'].quarantinedObjectIds),Array.from(before.quarantinedObjectIds));
 await h.context.updateRepositoryIntegrityTarget('google-drive',{repositoryScope:'drive-one',requestId,status:'unavailable'});assert.equal(h.state.durable.locations['google-drive'].recheck,true);assert.ok(h.state.durable.locations['google-drive'].quarantinedObjectIds.length);
 await h.context.updateRepositoryIntegrityTarget('google-drive',{repositoryScope:'drive-one',requestId,status:'completed',complete:true,quarantined:[]});assert.equal(h.state.durable.locations['google-drive'].recheck,false);assert.equal(h.state.durable.locations['google-drive'].quarantinedObjectIds.length,0);assert.equal(h.state.durable.locations['google-drive'].history.length,1,'durable target history summarizes each day, not every segment');
});
const recheckRequest='00000000-0000-0000-0000-000000000002';
async function beginRecheck(h){await h.context.mutateRepositoryIntegrityTarget('google-drive',current=>({...current,recheck:true,requestId:recheckRequest,cursor:'',recheckCursor:'',scanId:'',partial:null,cycleStartedAt:stamp}));}
await test('attempted corrupt progress persists independently of healthy progress and survives metadata failures',async()=>{
 const h=fixture();await beginRecheck(h);
 await h.context.updateRepositoryIntegrityTarget('google-drive',{repositoryScope:'drive-one',requestId:recheckRequest,status:'yielded',corruption:true,cursor:'',recheckCursor:objectId('c'),scanId,partial:null,quarantined:[objectId('c')]});
 const saved=await h.context.readRepositoryIntegrityTarget('google-drive');assert.equal(saved.cursor,'');assert.equal(saved.recheckCursor,objectId('c'));assert.equal(saved.recheck,true);assert.equal(saved.blockedReason,'corrupt');
 for(const field of ['readFailed','txReadFailed','writeFailed','commitFailed']){const before=h.state.durable;h.state[field]=true;await assert.rejects(h.context.updateRepositoryIntegrityTarget('google-drive',{repositoryScope:'drive-one',requestId:recheckRequest,status:'yielded',cursor:objectId('d'),recheckCursor:objectId('d'),scanId}));assert.equal(h.state.durable,before);h.state[field]=false;}
 await h.context.updateRepositoryIntegrityTarget('google-drive',{repositoryScope:'drive-one',requestId:recheckRequest,status:'unavailable'});assert.equal(h.state.durable.locations['google-drive'].recheckCursor,objectId('c'));assert.equal(h.state.durable.locations['google-drive'].recheck,true);
 h.state.drive='drive-two';const replaced=await h.context.readRepositoryIntegrityTarget('google-drive');assert.equal(replaced.recheckCursor,'');assert.equal(replaced.recheck,false);assert.equal(replaced.quarantinedObjectIds.length,0);
});
await test('earlier confirmed corruption does not discard the next object segment checkpoint',async()=>{
 const h=fixture();await beginRecheck(h);const hash=new Sha256();hash.update(new Uint8Array(1048576));
 const partial={version:1,objectId:objectId('d'),storedChecksum:'d'.repeat(64),storedBytes:2*1048576,phase:'stored',sourceVersion:'verified-source-v1',stored:{name:'backup-00000000-0000-0000-0000-000000000001',offset:1048576,hash:hashSnapshot(hash),frame:0}};
 await h.context.updateRepositoryIntegrityTarget('google-drive',{repositoryScope:'drive-one',requestId:recheckRequest,status:'yielded',checkpointOnly:true,corruption:true,cursor:'',recheckCursor:objectId('c'),scanId,partial,quarantined:[objectId('c'),objectId('d')]});
 const restarted=await h.context.readRepositoryIntegrityTarget('google-drive');assert.equal(restarted.recheckCursor,objectId('c'));assert.equal(restarted.partial.objectId,objectId('d'));assert.equal(restarted.partial.stored.offset,1048576);assert.equal(restarted.history.length,0);assert.equal(restarted.quarantinedObjectIds.length,2);
});
await test('a full unhealthy recheck ends its request and retains an explicit corruption warning',async()=>{
 const h=fixture();await beginRecheck(h);const base={repositoryScope:'drive-one',requestId:recheckRequest,status:'failed',corruption:true,quarantined:[objectId('c')]};
 await h.context.updateRepositoryIntegrityTarget('google-drive',{...base,complete:true});assert.equal(h.state.durable.locations['google-drive'].recheck,true,'a plain failed result is not proof of a full recheck');
 await h.context.updateRepositoryIntegrityTarget('google-drive',{...base,complete:true,recheckComplete:true});const value=h.state.durable.locations['google-drive'];
 assert.equal(value.recheck,false);assert.equal(value.recheckCursor,'');assert.equal(value.cursor,'');assert.equal(value.scanId,'');assert.equal(value.partial,null);assert.ok(value.failedAt);assert.equal(value.completedAt,value.failedAt);assert.equal(value.lastOutcome,'failed');assert.equal(value.blockedReason,'corrupt');assert.equal(value.quarantinedObjectIds.length,1);assert.equal(value.history.at(-1).complete,true);assert.equal(h.state.health.at(-1).kind,'warn');
});
await test('recheck status distinguishes pending corruption, unavailability and terminal findings',async()=>{
 const h=fixture();vm.runInContext(app.slice(app.indexOf('function integrityStatusText('),app.indexOf('function renderIntegrityStatuses(')),h.context);
 assert.match(h.context.integrityStatusText({recheck:true,blockedReason:'corrupt'}),/^Recheck continuing; some objects remain corrupt/u);
 assert.match(h.context.integrityStatusText({recheck:true,lastOutcome:'unavailable',quarantinedObjectIds:[objectId('c')]}),/^Verification unavailable; previous findings retained/u);
 assert.match(h.context.integrityStatusText({recheck:false,lastOutcome:'failed',blockedReason:'corrupt',completedAt:stamp,quarantinedObjectIds:[objectId('c')]}),/^Objects need attention.*Last full scan/u);
 assert.match(h.context.integrityStatusText({recheck:true,blockedReason:'locked'}),/^Paused until backup encryption is unlocked/u);
});
await test('activation refreshes Device permission without owning integrity scheduling',async()=>{
 const start=app.indexOf('async function refreshDeviceBackgroundPermission('),source=app.slice(start,app.indexOf('AppActivation.subscribe(',start));
 const kinds={ORDINARY_FOCUS:'focus',VISIBILITY_RETURN:'visible',OWNERSHIP_TAKEOVER:'takeover'};let refreshes=0;
 const context={APP_ACTIVATION_KINDS:kinds,DeviceBackup:{refreshPermission:async()=>{refreshes++;}}};vm.createContext(context);vm.runInContext(source,context);
 for(const kind of ['focus','visible','takeover'])await context.refreshDeviceBackgroundPermission({kind});assert.equal(refreshes,3);
 await context.refreshDeviceBackgroundPermission({kind:'background'});assert.equal(refreshes,3);
});
await test('large quarantine remains lossless across commits, restart and repository replacement',async()=>{
 const h=fixture(),ids=Array.from({length:257},(_,i)=>'obj_'+(i+1).toString(16).padStart(32,'0'));
 await h.context.mutateRepositoryIntegrityTarget('google-drive',current=>({...current,quarantinedObjectIds:[...ids,'invalid',ids[0]]}));
 assert.deepEqual(Array.from((await h.context.readRepositoryIntegrityTarget('google-drive')).quarantinedObjectIds),ids);
 const prior=h.state.durable;await h.context.updateRepositoryIntegrityTarget('device-folder',{repositoryScope:'device-one',status:'completed',complete:true});assert.deepEqual(Array.from(h.state.durable.locations['google-drive'].quarantinedObjectIds),ids);
 h.state.commitFailed=true;await assert.rejects(h.context.updateRepositoryIntegrityTarget('google-drive',{repositoryScope:'drive-one',status:'failed',corruption:true,objectId:'obj_'+ 'f'.repeat(32)}));assert.deepEqual(Array.from(h.state.durable.locations['google-drive'].quarantinedObjectIds),ids);h.state.commitFailed=false;
 assert.deepEqual(Array.from(h.context.normalizeRepositoryIntegrityState(prior).locations['google-drive'].quarantinedObjectIds),ids);
 h.state.drive='drive-replaced';assert.equal((await h.context.readRepositoryIntegrityTarget('google-drive')).quarantinedObjectIds.length,0);
});

console.log(JSON.stringify({status:'PASS',suite:'repository-integrity-state',cases},null,2));
