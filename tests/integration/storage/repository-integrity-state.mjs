import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {Sha256} from '../../../portable/sha256.ts';
import {hashSnapshot} from '../../../portable/integrity-hash.ts';

for(const file of [
  'source/core/internal.ts',
  'source/core/operation-lifecycle.ts',
  'source/core/integrity-continuation.ts',
  'source/core/backup-integrity-host.ts',
  'source/core/backup-actions-host.ts',
  'source/core/host-metadata.ts'
])vm.runInThisContext(readScript(file),{filename:file});

const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const Lifecycle=registry.require('operation-lifecycle',1);
const Continuation=registry.require('integrity-continuation',1);
const IntegrityHost=registry.require('backup-integrity-host',1);
const BackupActionsHost=registry.require('backup-actions-host',1);
const HostMetadata=registry.require('host-metadata',1);
const freeze=Object.freeze;
const objectId=char=>'obj_'+char.repeat(32),scanId='a'.repeat(64),stamp='2026-09-01T00:00:00.000Z';
const requestId='00000000-0000-0000-0000-000000000001',recheckRequest='00000000-0000-0000-0000-000000000002';

class FakeElement{
  constructor(id=''){this.id=id;this.hidden=true;this.disabled=false;this.textContent='';this.className='';this.children=[];this.attributes={};this.classes=new Set();this.classList={toggle:(name,on)=>{if(on)this.classes.add(name);else this.classes.delete(name);}};}
  setAttribute(key,value){this.attributes[key]=String(value);}
  replaceChildren(...children){this.children=children;this.textContent=children.map(child=>child.textContent||'').join('');}
}
class FakeButton extends FakeElement{}
globalThis.HTMLButtonElement=FakeButton;

function fakeDocument(){
  const elements=new Map();
  for(const id of ['attachment-verification-status','device-verification-status','drive-verification-status'])elements.set(id,new FakeElement(id));
  for(const id of ['recheck-device-folder','recheck-google-drive'])elements.set(id,new FakeButton(id));
  return {
    elements,
    document:freeze({getElementById:id=>elements.get(id)||null,createElement:()=>new FakeElement()})
  };
}

function fixture(){
  const dom=fakeDocument(),state={
    readFailed:false,txReadFailed:false,writeFailed:false,commitFailed:false,owner:true,
    drive:'drive-one',device:'device-one',driveConnected:true,deviceConnected:true,
    durable:null,writes:0,health:[],transactions:0,queued:[],jobs:[],nowMs:Date.parse(stamp),uuid:requestId
  };
  const diagnostics=[];
  const normalize=value=>IntegrityHost.normalizeRepositoryState(value,Continuation.normalize);
  state.durable=normalize({version:7,locations:{
    'device-folder':{repositoryScope:'device-one',completedAt:stamp},
    'google-drive':{repositoryScope:'drive-one',completedAt:stamp,failedAt:stamp,cursor:objectId('b'),scanId,quarantinedObjectIds:[objectId('c')]}
  }});
  const repository=freeze({
    owner:'backup',
    read:async name=>{assert.equal(name,'repositoryIntegrityScrub');if(state.readFailed)throw new Error('read unavailable');return state.durable;},
    transaction:(_mode,operation,options)=>{
      assert.equal(options.strict,true,'integrity state mutations require strict durability');state.transactions++;
      return new Promise((resolve,reject)=>{
        let next=state.durable,finished=false;
        const finish=(ok,value)=>{
          if(finished)return;finished=true;
          if(!ok){reject(value instanceof Error?value:new Error(String(value||'transaction failed')));return;}
          if(state.commitFailed){reject(new Error('commit unavailable'));return;}
          state.durable=next;state.writes++;resolve(value);
        };
        const tx={oncomplete:null};
        const view={
          get(name){
            assert.equal(name,'repositoryIntegrityScrub');
            const request={error:null,onsuccess:null,onerror:null};
            queueMicrotask(()=>{
              if(state.txReadFailed){request.error=new Error('transaction read unavailable');request.onerror?.();return;}
              request.onsuccess?.();queueMicrotask(()=>{if(!finished)tx.oncomplete?.();});
            });
            return freeze({request,value:()=>state.durable});
          },
          put(name,value){
            assert.equal(name,'repositoryIntegrityScrub');next=value;
            const request={error:null,onerror:null};
            if(state.writeFailed)queueMicrotask(()=>{request.error=new Error('write unavailable');request.onerror?.();});
            return request;
          }
        };
        try{operation(view,tx,finish);}catch(error){finish(false,error);}
      });
    }
  });
  let timerSequence=0;
  const controller=IntegrityHost.createController(freeze({
    lifecycle:Lifecycle,
    metadata:freeze({
      attachment:freeze({owner:'host',read:async()=>null,write:async(_name,value)=>freeze({family:'host',value,updatedAt:new Date(state.nowMs).toISOString()})}),
      repository
    }),
    attachmentMetadataName:'attachmentIntegrityAudit',repositoryMetadataName:'repositoryIntegrityScrub',
    storage:freeze({supported:()=>false,shallowAudit:async()=>freeze({status:'completed',complete:true,checked:0,issues:freeze([])})}),
    references:freeze({sources:async()=>new Set()}),validAttachmentId:value=>/^asset-[a-z0-9-]+$/u.test(String(value||'')),
    data:freeze({datasetRevision:async()=>0}),referenceRevision:()=>0,
    authority:freeze({canMutate:()=>state.owner}),
    background:freeze({upkeepBlocker:()=>'',backgroundBlocker:()=>'',foregroundBusy:()=>false}),
    backgroundTasks:freeze({budget:()=>()=>false,yieldTask:async()=>{}}),
    provider:freeze({
      backgroundStatus:()=>freeze([...state.jobs]),
      locationStatus:id=>id==='google-drive'?freeze({connected:state.driveConnected}):id==='device-folder'?freeze({connected:state.deviceConnected}):null,
      repositoryScope:async id=>id==='device-folder'?state.device:state.drive,
      requestIntegrity:id=>{state.queued.push(id);return true;}
    }),
    continuation:freeze({verify:async()=>freeze({complete:true})}),normalizeContinuation:Continuation.normalize,
    unsafe:freeze({mutation:()=>false,attachmentIngest:()=>false}),
    storageHealth:freeze({
      markError:(source,message)=>{state.health.push(freeze({kind:'warn',source,message}));return true;},
      markOk:source=>{state.health.push(freeze({kind:'ok',source}));return true;}
    }),
    invalidateAttachmentLibrary:()=>true,
    diagnostics:freeze({
      capture:(scope,error,level)=>{diagnostics.push(freeze({scope,message:String(error?.message||error),level}));},
      start:()=>'',mark:()=>true,finish:()=>true,fail:()=>true
    }),
    document:dom.document,
    environment:freeze({
      now:()=>state.nowMs,nowIso:()=>new Date(++state.nowMs).toISOString(),uuid:()=>state.uuid,
      setTimeout:()=>++timerSequence,clearTimeout:()=>{}
    }),
    limits:freeze({attachmentIntervalMs:86400000,attachmentRetryMs:1800000,repositoryBatchObjects:64,repositoryBatchBytes:64*1024*1024})
  }));
  return {state,controller,dom,diagnostics,normalize};
}
const read=(h,id)=>h.controller.repositoryHooks.readTarget(id);
const write=(h,id,result)=>h.controller.repositoryHooks.writeResult(id,result);
const cases=[];async function test(name,run){await run();cases.push(name);}

await test('read, transactional read, write and commit failures preserve both providers',async()=>{
  for(const field of ['readFailed','txReadFailed','writeFailed','commitFailed']){
    const h=fixture(),before=h.state.durable;h.state[field]=true;
    await assert.rejects(write(h,'device-folder',{repositoryScope:'device-one',status:'completed',complete:true}));
    assert.equal(h.state.durable,before,field);assert.equal(h.state.writes,0,field);
    assert.deepEqual(Array.from(h.state.durable.locations['google-drive'].quarantinedObjectIds),[objectId('c')]);
    h.state[field]=false;await write(h,'device-folder',{repositoryScope:'device-one',status:'completed',complete:true});
    assert.ok((await read(h,'device-folder')).completedAt);assert.equal(h.state.writes,1);
    assert.equal(JSON.stringify(h.state.durable.locations['google-drive']),JSON.stringify(before.locations['google-drive']),'transaction must preserve unrelated target');
  }
});
await test('budget yield and restart preserve last verified cursor and scan identity',async()=>{
  const h=fixture();await write(h,'device-folder',{repositoryScope:'device-one',status:'yielded',reason:'budget',cursor:objectId('d'),scanId});
  const restarted=await read(h,'device-folder');assert.equal(restarted.cursor,objectId('d'));assert.equal(restarted.scanId,scanId);assert.ok(restarted.cycleStartedAt);assert.equal(restarted.completedAt,stamp);
});
await test('unavailable results retain quarantine and cannot claim complete verification',async()=>{
  const h=fixture();await read(h,'google-drive');
  for(const quarantined of [undefined,[],[objectId('c')]])await write(h,'google-drive',{repositoryScope:'drive-one',status:'unavailable',reason:'timeout',complete:true,quarantined});
  const target=h.state.durable.locations['google-drive'];
  assert.equal(target.history.at(-1).complete,false);assert.deepEqual(Array.from(target.quarantinedObjectIds),[objectId('c')]);
  assert.equal(target.cursor,objectId('b'));assert.equal(target.scanId,scanId);assert.equal(target.completedAt,stamp);assert.ok(target.failedAt);
});
await test('partial progress cannot clear unresolved failure or quarantine health',async()=>{
  const h=fixture();await read(h,'google-drive');
  await write(h,'google-drive',{repositoryScope:'drive-one',status:'yielded',cursor:objectId('d'),scanId});
  assert.equal(h.state.durable.locations['google-drive'].failedAt,stamp);assert.equal(h.state.health.at(-1).kind,'warn');
  await write(h,'google-drive',{repositoryScope:'drive-one',status:'completed',complete:true,quarantined:[objectId('c')]});
  assert.equal(h.state.durable.locations['google-drive'].failedAt,'');assert.equal(h.state.health.at(-1).kind,'warn','a completed pass with quarantine remains unhealthy');
});
await test('health projects only currently bound repositories and later success supersedes failure',async()=>{
  const h=fixture();await read(h,'device-folder');assert.equal(h.state.health.at(-1).kind,'ok','unbound Drive history must not poison current health');
  await read(h,'google-drive');assert.equal(h.state.health.at(-1).kind,'warn','bound Drive failure must be visible');
  const later='2026-09-02T00:00:00.000Z';
  h.state.durable=h.normalize({version:7,locations:{
    'device-folder':h.state.durable.locations['device-folder'],
    'google-drive':{...h.state.durable.locations['google-drive'],failedAt:stamp,completedAt:later,lastOutcome:'completed',quarantinedObjectIds:[]}
  }});
  await h.controller.installRepository();assert.equal(h.state.health.at(-1).kind,'ok');
});
await test('repository generation binding preserves same repositories and resets replacements',async()=>{
  const h=fixture();assert.equal((await read(h,'device-folder')).repositoryScope,'device-one');assert.equal(h.state.writes,0);
  h.state.device='device-two';const target=await read(h,'device-folder');
  assert.equal(target.repositoryScope,'device-two');assert.equal(target.completedAt,'');assert.equal(target.cursor,'');assert.equal(target.quarantinedObjectIds.length,0);
});
await test('a missing location starts its own entry without disturbing the other provider',async()=>{
  const h=fixture(),drive=h.state.durable.locations['google-drive'];
  h.state.durable=h.normalize({version:7,locations:{'google-drive':drive}});
  const bound=await read(h,'device-folder');assert.equal(bound.repositoryScope,'device-one');assert.equal(bound.completedAt,'');
  await write(h,'device-folder',{repositoryScope:'device-one',status:'yielded',cursor:objectId('d'),scanId});
  assert.equal(h.state.durable.locations['device-folder'].cursor,objectId('d'));
  assert.equal(JSON.stringify(h.state.durable.locations['google-drive']),JSON.stringify(drive));
});
await test('repository recreation rejects stale scan results and starts clean',async()=>{
  const h=fixture();h.state.drive='drive-two';
  await assert.rejects(write(h,'google-drive',{repositoryScope:'drive-one',status:'failed',quarantined:[objectId('e')]}),{code:'REPOSITORY_CHANGED'});
  const target=h.state.durable.locations['google-drive'];
  assert.equal(target.repositoryScope,'drive-two');assert.equal(target.completedAt,'');assert.equal(target.failedAt,'');assert.equal(target.quarantinedObjectIds.length,0);
});
await test('concurrent provider progress is serialized without lost updates',async()=>{
  const h=fixture();await Promise.all([
    write(h,'device-folder',{repositoryScope:'device-one',status:'yielded',cursor:objectId('d'),scanId}),
    write(h,'google-drive',{repositoryScope:'drive-one',status:'yielded',cursor:objectId('e'),scanId})
  ]);
  assert.equal(h.state.durable.locations['device-folder'].cursor,objectId('d'));
  assert.equal(h.state.durable.locations['google-drive'].cursor,objectId('e'));
  assert.deepEqual(Array.from(h.state.durable.locations['google-drive'].quarantinedObjectIds),[objectId('c')]);
});
await test('unscoped completion cannot postpone the first scan of a newly bound repository',async()=>{
  const h=fixture();h.state.durable=h.normalize({version:7,locations:{
    'device-folder':{completedAt:stamp},
    'google-drive':{completedAt:stamp,quarantinedObjectIds:[objectId('c')]}
  }});
  const bound=await read(h,'google-drive');
  assert.equal(bound.repositoryScope,'drive-one');assert.equal(bound.completedAt,'');assert.equal(bound.quarantinedObjectIds.length,0);
  assert.equal(h.state.durable.locations['device-folder'].completedAt,stamp);
});
await test('lost write ownership and identity-free results fail closed',async()=>{
  const h=fixture();h.state.owner=false;const before=h.state.durable;
  await assert.rejects(write(h,'device-folder',{repositoryScope:'device-one',status:'completed',complete:true}));assert.equal(h.state.durable,before);
  h.state.owner=true;await assert.rejects(write(h,'device-folder',{status:'completed',complete:true}));assert.equal(h.state.durable,before);
});
await test('Drive executor classifies transport, permission, lock, corruption and budget outcomes',async()=>{
  const source=readScript('source/core/backup-provider.ts'),start=source.indexOf('  async function runConfiguredIntegrityScrub('),end=source.indexOf('  async function backupRepositoryProvider(',start);
  assert.ok(start>=0&&end>start,'provider integrity executor remains present');
  let failure;
  const context={Object,String,freeze:Object.freeze,integrityScrubHooks:{},repositoryProviderObjectIds:rows=>Object.freeze([...new Set(rows)]),AppDiagnostics:{capture(){}},scrubRepositoryProvider:async()=>{throw failure;}};
  vm.createContext(context);vm.runInContext(source.match(/const fields=[^\n]+;/u)[0]+source.slice(start,end),context);
  for(const [code,name,status,quarantine,reason] of [
    ['DRIVE_TIMEOUT','Error','unavailable',false,'unavailable'],
    ['NotAllowedError','NotAllowedError','unavailable',false,'permission'],
    ['FILE_BUSY','NotReadableError','unavailable',false,'busy'],
    ['BACKUP_LOCKED','Error','unavailable',false,'locked'],
    ['REPOSITORY_INTEGRITY_CORRUPT','Error','failed',true,'unavailable'],
    ['REPOSITORY_OBJECT_MISSING','Error','failed',true,'unavailable'],
    ['REPOSITORY_INTEGRITY_BUDGET','AbortError','yielded',false,'budget']
  ]){
    failure=Object.assign(new Error('test failure'),{code,name,repositoryObjectId:objectId('d'),repositoryScrubProgress:{cursor:objectId('e'),scanId,checked:1,quarantined:[objectId('c')]}});
    const result=await context.runConfiguredIntegrityScrub({id:'google-drive',repository:{}},{repositoryScope:'drive-one',skipObjectIds:[objectId('c')]});
    assert.equal(result.status,status,code);assert.equal(result.reason,reason,code);assert.equal(result.repositoryScope,'drive-one');
    assert.equal(result.cursor,objectId('e'));assert.equal(result.scanId,scanId);assert.equal(result.quarantined.includes(objectId('d')),quarantine,code);assert.ok(result.quarantined.includes(objectId('c')));
  }
});
await test('metadata validator accepts only canonical current-version integrity records',async()=>{
  const h=fixture(),names=['verifiedRecoveryBackups','backupProtection','attachmentIntegrityAudit','deviceFolder','repositoryIntegrityScrub','managedProviderBackupPending','repositoryMaintenancePending','reconciliationBase','reconciliationBaseNotePrefix','reconciliationBaseDayPrefix'];
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const validators=HostMetadata.createAppMetaValidators(freeze({
    keys:freeze(Object.fromEntries(names.map(name=>[name,name]))),same,
    normalizers:freeze({
      verifiedRecovery:value=>value,attachmentIntegrity:value=>value,repositoryIntegrity:h.normalize,
      reconciliationBase:value=>value,reconciliationBaseNote:value=>value,reconciliationBaseDays:value=>value
    })
  }));
  const validate=value=>validators.repositoryIntegrityScrub(value,{key:'repositoryIntegrityScrub'});
  assert.equal(validate(h.state.durable),true);
  const drive=h.state.durable.locations['google-drive'],device=h.state.durable.locations['device-folder'];
  for(const record of [{version:2,device,drive},{version:6,device,drive},{...h.state.durable,version:6}])assert.equal(validate(record),false);
  const large={...drive,quarantinedObjectIds:Array.from({length:257},(_,i)=>'obj_'+(i+1).toString(16).padStart(32,'0'))};
  const record={version:7,locations:{'device-folder':device,'google-drive':large}};
  assert.equal(validate(record),true);assert.equal(h.normalize(record).locations['google-drive'].quarantinedObjectIds.length,257);
  assert.equal(validate({...h.state.durable,locations:{...h.state.durable.locations,'google-drive':{...drive,recheck:true,recheckCursor:'invalid'}}}),false);
  assert.equal(validate({...h.state.durable,locations:{...h.state.durable.locations,'Bad Id':drive}}),false);
  assert.equal(validate({...h.state.durable,locations:{...h.state.durable.locations,'device-folder':{...device,repositoryHandle:null}}}),false);
  assert.equal(validate({...h.state.durable,unknownField:true}),false);assert.equal(validate({...h.state.durable,version:99}),false);
});
await test('recheck is scoped, preserves quarantine and requires write control',async()=>{
  const h=fixture();await read(h,'google-drive');
  assert.equal(await h.controller.requestRepositoryRecheck('google-drive'),true);
  const target=h.state.durable.locations['google-drive'];
  assert.equal(target.recheckCursor,'');assert.equal(target.recheck,true);assert.equal(target.requestId,requestId);assert.equal(target.quarantinedObjectIds.length,1);
  assert.deepEqual(h.state.queued,['google-drive']);
  const before=h.state.durable;h.state.owner=false;
  assert.equal(await h.controller.requestRepositoryRecheck('device-folder'),false);assert.equal(h.state.durable,before);
});
await test('new recheck rejects older troubled results and clears quarantine only after its verified pass',async()=>{
  const h=fixture();await read(h,'google-drive');assert.equal(await h.controller.requestRepositoryRecheck('google-drive'),true);
  const before=h.state.durable.locations['google-drive'],pending=h.state.durable.locations['google-drive'];
  for(const older of [
    {status:'yielded',reason:'preempted',cursor:objectId('d'),scanId},
    {status:'failed',corruption:true,complete:true,quarantined:[objectId('e')]},
    {status:'unavailable',reason:'timeout'}
  ])await assert.rejects(write(h,'google-drive',{repositoryScope:'drive-one',...older}),{code:'REPOSITORY_CHANGED'});
  await write(h,'google-drive',{repositoryScope:'drive-one',status:'completed',complete:true,quarantined:[]});
  const shown=h.state.durable.locations['google-drive'];
  assert.ok(shown.completedAt&&shown.completedAt!==pending.completedAt);assert.equal(shown.lastOutcome,'completed');assert.equal(shown.recheck,true);assert.equal(shown.requestId,requestId);
  assert.deepEqual(Array.from(shown.quarantinedObjectIds),Array.from(before.quarantinedObjectIds),'older clean completion cannot clear pending recheck quarantine');
  await write(h,'google-drive',{repositoryScope:'drive-one',requestId,status:'unavailable'});assert.equal(h.state.durable.locations['google-drive'].recheck,true);
  await write(h,'google-drive',{repositoryScope:'drive-one',requestId,status:'completed',complete:true,quarantined:[]});
  assert.equal(h.state.durable.locations['google-drive'].recheck,false);assert.equal(h.state.durable.locations['google-drive'].quarantinedObjectIds.length,0);
  assert.equal(h.state.durable.locations['google-drive'].history.length,1,'daily history remains summarized rather than segment-amplified');
});
async function beginRecheck(h){
  h.state.uuid=recheckRequest;await read(h,'google-drive');assert.equal(await h.controller.requestRepositoryRecheck('google-drive'),true);
  assert.equal(h.state.durable.locations['google-drive'].requestId,recheckRequest);
}
await test('corrupt recheck progress persists independently and survives metadata failures',async()=>{
  const h=fixture();await beginRecheck(h);
  await write(h,'google-drive',{repositoryScope:'drive-one',requestId:recheckRequest,status:'yielded',corruption:true,cursor:'',recheckCursor:objectId('c'),scanId,partial:null,quarantined:[objectId('c')]});
  let saved=await read(h,'google-drive');assert.equal(saved.cursor,'');assert.equal(saved.recheckCursor,objectId('c'));assert.equal(saved.recheck,true);assert.equal(saved.blockedReason,'corrupt');
  for(const field of ['readFailed','txReadFailed','writeFailed','commitFailed']){
    const before=h.state.durable;h.state[field]=true;
    await assert.rejects(write(h,'google-drive',{repositoryScope:'drive-one',requestId:recheckRequest,status:'yielded',cursor:objectId('d'),recheckCursor:objectId('d'),scanId}));
    assert.equal(h.state.durable,before);h.state[field]=false;
  }
  await write(h,'google-drive',{repositoryScope:'drive-one',requestId:recheckRequest,status:'unavailable'});
  saved=h.state.durable.locations['google-drive'];assert.equal(saved.recheckCursor,objectId('c'));assert.equal(saved.recheck,true);
  h.state.drive='drive-two';const replaced=await read(h,'google-drive');assert.equal(replaced.recheckCursor,'');assert.equal(replaced.recheck,false);assert.equal(replaced.quarantinedObjectIds.length,0);
});
await test('confirmed corruption does not discard the next object-segment continuation',async()=>{
  const h=fixture();await beginRecheck(h);const hash=new Sha256();hash.update(new Uint8Array(1048576));
  const partial={version:1,objectId:objectId('d'),storedChecksum:'d'.repeat(64),storedBytes:2*1048576,phase:'stored',sourceVersion:'verified-source-v1',stored:{name:'backup-00000000-0000-0000-0000-000000000001',offset:1048576,hash:hashSnapshot(hash),frame:0}};
  await write(h,'google-drive',{repositoryScope:'drive-one',requestId:recheckRequest,status:'yielded',checkpointOnly:true,corruption:true,cursor:'',recheckCursor:objectId('c'),scanId,partial,quarantined:[objectId('c'),objectId('d')]});
  const restarted=await read(h,'google-drive');
  assert.equal(restarted.recheckCursor,objectId('c'));assert.equal(restarted.partial.objectId,objectId('d'));assert.equal(restarted.partial.stored.offset,1048576);
  assert.equal(restarted.history.length,0);assert.equal(restarted.quarantinedObjectIds.length,2);
});
await test('only a full unhealthy recheck closes its request and retains corruption warning',async()=>{
  const h=fixture();await beginRecheck(h);
  const base={repositoryScope:'drive-one',requestId:recheckRequest,status:'failed',corruption:true,quarantined:[objectId('c')]};
  await write(h,'google-drive',{...base,complete:true});assert.equal(h.state.durable.locations['google-drive'].recheck,true);
  await write(h,'google-drive',{...base,complete:true,recheckComplete:true});
  const value=h.state.durable.locations['google-drive'];
  assert.equal(value.recheck,false);assert.equal(value.recheckCursor,'');assert.equal(value.cursor,'');assert.equal(value.scanId,'');assert.equal(value.partial,null);
  assert.ok(value.failedAt);assert.equal(value.completedAt,value.failedAt);assert.equal(value.lastOutcome,'failed');assert.equal(value.blockedReason,'corrupt');
  assert.equal(value.quarantinedObjectIds.length,1);assert.equal(value.history.at(-1).complete,true);assert.equal(h.state.health.at(-1).kind,'warn');
});
await test('verification presentation reports health, progress and recheck failures from the checked owner',async()=>{
  const h=fixture();await read(h,'google-drive');
  const row=()=>h.dom.elements.get('drive-verification-status').textContent,button=h.dom.elements.get('recheck-google-drive');
  assert.match(row(),/^Google Drive: 1 damaged backup file/u);assert.equal(button.hidden,false);assert.equal(button.disabled,false);
  h.state.durable=h.normalize({version:7,locations:{...h.state.durable.locations,'google-drive':{repositoryScope:'drive-one',recheck:true,blockedReason:'corrupt',quarantinedObjectIds:[objectId('c')]}}});
  await h.controller.installRepository();assert.match(row(),/^Google Drive: Recheck continuing; some backup files are still damaged/u);
  h.state.durable=h.normalize({version:7,locations:{...h.state.durable.locations,'google-drive':{repositoryScope:'drive-one',lastOutcome:'completed',completedAt:stamp,quarantinedObjectIds:[]}}});
  await h.controller.installRepository();assert.match(row(),/^Google Drive: All backup files intact/u);
  h.state.uuid=requestId;assert.equal(await h.controller.requestRepositoryRecheck('google-drive'),true);assert.equal(button.disabled,true);assert.equal(button.textContent,'Rechecking…');
  h.state.jobs=[freeze({job:'google-drive integrity',running:true})];
  await write(h,'google-drive',{repositoryScope:'drive-one',requestId,status:'yielded',cursor:objectId('d'),scanId,done:5,total:38});
  assert.match(row(),/^Google Drive: Checking… 5 of 38 backup files/u);
  h.state.jobs=[];await write(h,'google-drive',{repositoryScope:'drive-one',requestId,status:'completed',complete:true,quarantined:[]});
  assert.match(row(),/^Google Drive: All backup files intact/u);assert.equal(button.disabled,false);
  h.state.driveConnected=false;assert.equal(await h.controller.requestRepositoryRecheck('google-drive'),false);
  assert.match(row(),/^Google Drive: Recheck did not start: Connect Google Drive before rechecking it\./u);assert.equal(h.dom.elements.get('drive-verification-status').classes.has('verification-error'),true);
});
await test('large quarantine is lossless through normalization, unrelated commits and repository replacement',async()=>{
  const h=fixture(),ids=Array.from({length:257},(_,i)=>'obj_'+(i+1).toString(16).padStart(32,'0'));
  h.state.durable=h.normalize({version:7,locations:{...h.state.durable.locations,'google-drive':{...h.state.durable.locations['google-drive'],quarantinedObjectIds:[...ids,'invalid',ids[0]]}}});
  assert.deepEqual(Array.from((await read(h,'google-drive')).quarantinedObjectIds),ids);
  const prior=h.state.durable;await write(h,'device-folder',{repositoryScope:'device-one',status:'completed',complete:true});
  assert.deepEqual(Array.from(h.state.durable.locations['google-drive'].quarantinedObjectIds),ids);
  h.state.commitFailed=true;await assert.rejects(write(h,'google-drive',{repositoryScope:'drive-one',status:'failed',corruption:true,objectId:'obj_'+'f'.repeat(32)}));
  assert.deepEqual(Array.from(h.state.durable.locations['google-drive'].quarantinedObjectIds),ids);h.state.commitFailed=false;
  assert.deepEqual(Array.from(h.normalize(prior).locations['google-drive'].quarantinedObjectIds),ids);
  h.state.drive='drive-replaced';assert.equal((await read(h,'google-drive')).quarantinedObjectIds.length,0);
});
await test('Device Folder permission refresh policy remains in the checked actions owner',async()=>{
  let refreshes=0;const device=freeze({refreshPermission:async()=>{refreshes++;return true;}});
  const activation=BackupActionsHost.createDeviceActivation(freeze({device:()=>device,refreshKinds:new Set(['focus','visible','takeover'])}));
  for(const kind of ['focus','visible','takeover'])assert.equal(await activation.handle(kind),true);
  assert.equal(refreshes,3);assert.equal(await activation.handle('background'),false);assert.equal(refreshes,3);
});

console.log(JSON.stringify({status:'PASS',suite:'repository-integrity-state',productionOwner:'backup-integrity-host',cases},null,2));
