import {readScript} from '../../../build/source-script.mts';
import {readCoreScript,coreScriptPath} from '../../helpers/core-script.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {noteRow,TRASH_PREFIX} from '../../helpers/note-ids.mjs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';
const source=fs.readFileSync('source/app.html','utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(){
  const timers=new Map();let seq=0;const state={owner:true,busy:false,revision:'one',refs:0,failure:false,commitFailure:false,completed:0,scans:[],keys:['late'],removed:[],journal:null,removedPasses:[],invalidated:0,now:0};
  const ports={canMutate:()=>state.owner,mutationActive:()=>state.busy,collect:async fn=>{if(state.failure)throw new Error('IO');return fn({keys:async()=>state.keys.slice(),removeMany:async ids=>{state.removed.push(...ids);state.removedPasses.push(ids.length);state.keys=state.keys.filter(key=>!ids.includes(key));return ids.length;},sweep:async()=>0});},readRestoreJournal:async()=>state.journal,readLibraryClearJournal:async()=>null,liveFields:()=>[],getReferenceRevision:()=>state.refs,getDatasetRevision:async()=>state.revision,scanReferences:value=>{state.scans.push(value);return {trusted:true,assetIds:value==='last'?['late']:[]};},readNotes:async()=>({}),loadActiveSession:async()=>({ok:true,value:null,error:null}),readPendingReviewTexts:async()=>[],listDailyRecords:async()=>['a','b','c','d','last'].map(reflection=>({reflection})),budget:()=>()=>true,yieldTask:async()=>{},invalidate:()=>state.invalidated++,captureError:()=>{},completed:async()=>{if(state.commitFailure)throw new Error('completion write');state.completed++;},now:()=>state.now,setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id)};
  const context={setTimeout:ports.setTimeout,clearTimeout:ports.clearTimeout};vm.createContext(context);for(const file of ['internal','operation-lifecycle','asset-maintenance'])vm.runInContext(readCoreScript(file),context,{filename:coreScriptPath(file)});
  const mod=context[Symbol.for('studyDirector.internalModules.v1')].require('asset-maintenance',1,Object.freeze({lifecycle:context[Symbol.for('studyDirector.internalModules.v1')].require('operation-lifecycle',1)})),api=mod.create(ports,{lease:{protect(){},release(){},isProtected:()=>false},batchSize:2});return {state,ports,api,timers};
}
const cases=[];
{
  // An attachment used only by a version kept for review is never collected.
  const h=fixture();h.state.keys=['kept-only','orphan'];h.ports.listDailyRecords=async()=>[];h.ports.readPendingReviewTexts=async()=>['kept text'];
  const scan=h.ports.scanReferences;h.ports.scanReferences=value=>value==='kept text'?{trusted:true,assetIds:['kept-only']}:scan(value);
  for(let pass=0;pass<12;pass++){const result=await h.api.run();if(['completed','clean'].includes(result.status))break;}
  assert.deepEqual(h.state.removed,['orphan'],'only the unused attachment goes');cases.push('a kept version protects its attachments');
}
{
  const h=fixture();assert.equal((await h.api.run()).status,'yielded');assert.equal(h.state.removed.length,0);assert.equal((await h.api.run()).status,'yielded');assert.equal(h.state.removed.length,0);assert.equal((await h.api.run()).status,'completed');assert.equal(h.state.removed.length,0,'a late reference must prevent deletion');assert.equal(h.state.completed,1);assert.equal(h.state.scans.filter(x=>x==='a').length,1,'resume must not redo the prefix');assert.equal(h.timers.size,0);cases.push('bounded reference scan resumes without deleting a late reference');
}
{
  const h=fixture();await h.api.run();h.state.revision='two';await h.api.run();assert.equal(h.state.scans.filter(x=>x==='a').length,2,'changed canonical source invalidates prefix');h.state.busy=true;assert.equal((await h.api.run()).reason,'mutation-active');assert.ok([...h.timers.values()].every(t=>t.ms<=15000));cases.push('changed source restarts; foreground defers');
}
{
  const h=fixture();h.state.failure=true;assert.equal((await h.api.run()).status,'failed');assert.equal(h.state.completed,0);assert.equal([...h.timers.values()][0].ms,1800000);h.state.failure=false;h.state.keys=[];h.state.commitFailure=true;assert.equal((await h.api.run()).status,'failed');assert.equal(h.state.completed,0);h.state.commitFailure=false;assert.equal((await h.api.run()).status,'clean');assert.equal(h.state.completed,1);assert.equal(h.timers.size,0);cases.push('IO and completion failures retain retry; success commits later');
}
{
  const h=fixture();h.state.keys=['x','y','z','w','v'];h.ports.listDailyRecords=async()=>[];let total=0;for(let i=0;i<10;i++){const result=await h.api.run();total+=result.removed;if(result.status==='completed'||result.status==='clean')break;}assert.equal(total,5);assert.ok(h.state.removedPasses.every(n=>n<=2));assert.equal(h.state.completed,1);cases.push('logical deletion batches finish within the cap');
}
{
  const h=fixture(),gate=deferred();h.ports.readNotes=()=>gate.promise;const run=h.api.run();await Promise.resolve();await Promise.resolve();h.state.busy=true;gate.resolve({});assert.equal((await run).reason,'foreground-busy');assert.equal(h.state.removed.length,0);assert.equal(h.api.status().busy,false);h.state.busy=false;h.state.journal={state:'pending'};assert.equal((await h.api.run()).reason,'restore-journal');assert.equal(h.state.completed,0);assert.equal([...h.timers.values()][0].ms,60000,'journal block must retain a retry');h.api.schedule(1000);h.api.schedule(60000);assert.equal([...h.timers.values()][0].ms,1000,'a later opportunity must not postpone an existing timer');cases.push('foreground preempts before deletion; journals retain pending work');
}
{
  const calls=[];const touch=()=>{throw new Error('attachment cleanup must not write browser storage');};const context={RichTextAssetMaintenance:{schedule:delay=>{calls.push(delay);return true;}},AppData:{local:{getText:touch,setText:touch,remove:touch}},appCanMutate:()=>true};vm.createContext(context);const line=source.match(/^scheduleRichTextAssetMaintenance=.*$/mu)[0];vm.runInContext('let '+line,context);assert.equal(vm.runInContext('scheduleRichTextAssetMaintenance(5000)',context),true);assert.deepEqual(calls,[5000]);cases.push('a cleanup request goes straight to the owner and keeps no browser-storage record');
}
{
  const h=fixture();h.ports.listDailyRecords=async()=>{throw new Error('Saved Days unavailable');};assert.equal((await h.api.run()).status,'failed');assert.equal(h.state.removed.length,0);assert.equal(h.state.completed,0);assert.equal([...h.timers.values()][0].ms,1800000);cases.push('unavailable Saved Days cannot become an empty reference inventory');
}
{
  const h=fixture(),gate=deferred();h.ports.readRestoreJournal=()=>gate.promise;const run=h.api.run();await Promise.resolve();await Promise.resolve();const waiting=h.api.settled(),rejected=assert.rejects(waiting,{code:'ASSET_MAINTENANCE_UNSETTLED'});const deadline=[...h.timers.values()].find(t=>t.ms===10000);assert.ok(deadline);deadline.fn();await rejected;assert.equal(h.api.status().busy,true,'deadline must not pretend storage work stopped');h.state.busy=true;gate.resolve(null);await run;assert.equal(h.state.removed.length,0);assert.equal(h.api.status().busy,false);cases.push('foreground settlement deadline keeps the actual executor active until release');
}
{
  const h=fixture();h.state.keys=[];const collect=h.ports.collect;let changed=false;h.ports.collect=async(fn,options)=>{const result=await collect(fn,options);if(!changed){changed=true;h.api.schedule(2000);}return result;};
  assert.equal((await h.api.run()).status,'yielded');assert.equal(h.state.completed,0,'a newer request prevents success/pending retirement');assert.equal((await h.api.run()).status,'clean');assert.equal(h.state.completed,1);cases.push('a new request during collection keeps its pending intent until the rerun');
}


// Conservative reachability, source fencing and lease contention.
{
const context={console,Object,Set,Map,Math,Number,String,Promise,Date,TypeError,Symbol,setTimeout:()=>1,clearTimeout:()=>{}};context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.js','source/core/operation-lifecycle.ts','source/core/asset-storage.js','source/core/asset-maintenance.js'])vm.runInContext(readScript(file),context,{filename:file});
const registry=context[Symbol.for('studyDirector.internalModules.v1')],storage=registry.require('asset-storage',1),mod=registry.require('asset-maintenance',1,Object.freeze({lifecycle:registry.require('operation-lifecycle',1)}));
const lease=()=>storage.createLease(5000,()=>1000);
const assetId='img-prune-safety-12345678901234567890';let uncertain=true,removeCalls=0,referenceRevision=0,datasetRevision='stable';
const field={value:'WG1:uncertain',isConnected:true};
const store={keys:async()=>[assetId],removeMany:async ids=>{removeCalls++;return ids.length;},sweep:async()=>0};
const maintenance=mod.create({
  canMutate:()=>true,mutationActive:()=>false,collect:async fn=>fn(store),readRestoreJournal:async()=>null,readLibraryClearJournal:async()=>null,
  liveFields:()=>[field],getReferenceRevision:()=>referenceRevision,getDatasetRevision:async()=>datasetRevision,
  scanReferences:()=>uncertain?{trusted:false,assetIds:[]}:{trusted:true,assetIds:[]},readNotes:async()=>({}),loadActiveSession:async()=>({ok:true,value:null,error:null}),readPendingReviewTexts:async()=>[],listDailyRecords:async()=>[],
  budget:()=>()=>false,yieldTask:async()=>{},invalidate:()=>{},captureError:()=>{}
},{lease:lease()});
const skipped=await maintenance.run();assert.equal(skipped.status,'skipped');assert.equal(skipped.reason,'uncertain-rich-text');assert.equal(skipped.removed,0);assert.equal(removeCalls,0);
uncertain=false;const completed=await maintenance.run();assert.equal(completed.status,'completed');assert.equal(completed.removed,1);assert.equal(removeCalls,1);
datasetRevision=null;assert.equal((await maintenance.run()).reason,'unverified-record-source');assert.equal(removeCalls,1);
datasetRevision='stable';let bumped=false;
const changed=mod.create({
  canMutate:()=>true,mutationActive:()=>false,collect:async fn=>fn(store),readRestoreJournal:async()=>null,readLibraryClearJournal:async()=>null,
  liveFields:()=>[field],getReferenceRevision:()=>referenceRevision,getDatasetRevision:async()=>datasetRevision,
  scanReferences:()=>({trusted:true,assetIds:[]}),readNotes:async()=>{if(!bumped){referenceRevision++;bumped=true;}return {};},loadActiveSession:async()=>({ok:true,value:null,error:null}),readPendingReviewTexts:async()=>[],listDailyRecords:async()=>[],
  budget:()=>()=>false,yieldTask:async()=>{},invalidate:()=>{},captureError:()=>{}
},{lease:lease()});
assert.equal((await changed.run()).reason,'source-changed');assert.equal(removeCalls,1);

let leaseRetrySchedules=0;
const leaseBlocked=mod.create({
  canMutate:()=>true,mutationActive:()=>false,collect:async()=>({status:'skipped',reason:'active-editor-or-file-operation',removed:0}),readRestoreJournal:async()=>null,readLibraryClearJournal:async()=>null,
  liveFields:()=>[],getReferenceRevision:()=>0,getDatasetRevision:async()=>'stable',scanReferences:()=>({trusted:true,assetIds:[]}),readNotes:async()=>({}),loadActiveSession:async()=>({ok:true,value:null,error:null}),readPendingReviewTexts:async()=>[],listDailyRecords:async()=>[],
  budget:()=>()=>false,yieldTask:async()=>{},invalidate:()=>{},captureError:()=>{},setTimeout:()=>{leaseRetrySchedules++;return 1;},clearTimeout:()=>{}
},{lease:lease()});
assert.equal((await leaseBlocked.run()).reason,'active-editor-or-file-operation');
assert.equal(leaseBlocked.leaseReleased(),true,'A lease release must retry cleanup only after a prior cleanup was actually blocked by a reader/editor.');
assert.equal(leaseRetrySchedules,2,'Reader contention keeps a fallback timer, and release provides the immediate opportunity.');
assert.equal(leaseBlocked.leaseReleased(),false,'Ordinary later attachment reads/releases must not manufacture cleanup work.');

cases.push('untrusted rich text, source changes and unavailable revisions forbid deletion; lease release retries only pending work');
}

// End-to-end conservation: an incomplete reachability proof must change neither
// metadata nor bytes. Once reads recover, only the unreachable object may go.
{
  const richContext={URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,queueMicrotask,structuredClone};vm.createContext(richContext);vm.runInContext(richTextRuntimeSource(),richContext);
  const rich=richContext.StudyDirectorRichText,ids=['note','session','day','trash','orphan'].map((_,i)=>'att-'+String(i+1).padStart(32,'0'));
  const reference=id=>rich.insertAttachmentReference('',{id,name:'Diagram',mode:'inline-image'}).value;
  const session=reflection=>({id:'active',type:'activeSession',version:1,date:'2026-10-01',status:'suspended',scheduleText:'',suspendedAt:'2026-10-01T12:00:00.000Z',revision:20,updatedAt:'2026-10-01T12:20:00.000Z',snapshot:{review:{reflection}}});
  const blob=new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jTioAAAAASUVORK5CYII=','base64')],{type:'image/png'});
  const hash=Buffer.from(await webcrypto.subtle.digest('SHA-256',await blob.arrayBuffer())).toString('hex');
  const faults=['notes','day','session','session-rescue','session-partial-port','local-session','local-day','local-deletions'];
  for(const fault of faults){
    const controls={dailyKeyEnumeration:true},h=createHarness(new Map(),null,controls),timers=new Map();let sequence=0,completed=0,failed=true;
    // Seed older rescue through the production emergency-write path.
    if(fault.includes('rescue')||fault==='session-partial-port'){
      controls.failSessionWrite=true;
      const saved=await h.app.activeSession.save({...session('older reflection'),revision:19,updatedAt:'2026-10-01T12:19:00.000Z'},{emergency:true});
      assert.equal(saved.storage.local,true);controls.failSessionWrite=false;
    }
    const biologyNote=noteRow('Biology',reference(ids[0]),'2026-10-01T12:20:00.000Z');h.stores.area.set(biologyNote.key,biologyNote);
    // A note in Recently deleted keeps its images: restoring it must bring them back.
    const deletedNote=noteRow('Chemistry',reference(ids[3]),'2026-10-01T12:20:00.000Z');h.stores.area.set(TRASH_PREFIX+deletedNote.key,{...deletedNote,key:TRASH_PREFIX+deletedNote.key});
    h.stores.session.set('active',session(reference(ids[1])));
    await h.app.dailyRecords.save({version:1,date:'2026-10-01',savedAt:'2026-10-01T12:20:00.000Z',updatedAt:'2026-10-01T12:20:00.000Z',reflection:reference(ids[2])});
    controls.onStorageRead=async({store})=>{if(failed&&((fault==='notes'&&store==='area')||(fault==='day'&&store==='daily')||(fault.startsWith('session')&&store==='session')))throw new Error('Temporary '+fault+' read failure');};
    controls.failLocalGetKeys=new Set(fault==='local-session'?['recovery']:fault==='local-day'?['fallback']:fault==='local-deletions'?['deletionRecovery']:[]);
    const context={Blob,TextEncoder,crypto:webcrypto,setTimeout:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearTimeout:id=>timers.delete(id)};vm.createContext(context);
    for(const file of ['internal','operation-lifecycle','asset-storage','asset-maintenance'])vm.runInContext(readCoreScript(file),context);
    const registry=context[Symbol.for('studyDirector.internalModules.v1')],Assets=registry.require('asset-storage',1);
    const metadata=new Map(ids.map((id,i)=>[id,{version:2,storage:'opfs',file:'attblob-12345678-1234-1234-1234-'+String(i+1).padStart(12,'0'),hash,size:blob.size,type:blob.type,name:'Diagram',library:false}]));
    const physical=new Map([...metadata.values()].map(row=>[row.file,blob]));
    const dir={async *entries(){for(const [name] of [...physical])yield [name,{kind:'file'}];},removeEntry:async name=>{physical.delete(name);},getFileHandle:async name=>{if(!physical.has(name))throw Object.assign(new Error('missing'),{name:'NotFoundError'});return {getFile:async()=>physical.get(name)};}};
    const storage=Assets.create({name:'reachability-test',maxBytes:100000,validId:rich.isAssetId,validType:type=>type==='image/png',storage:{getDirectory:async()=>({getDirectoryHandle:async()=>dir})},locks:{request:async(_name,options,fn)=>(typeof options==='function'?options:fn)({})},protocol:'https:',ingest:{ingest:async()=>{}},canMutate:()=>true,issueToken:()=>({}),assertToken(){},read:async id=>metadata.get(id),entries:async()=>[...metadata],keys:async()=>[...metadata.keys()],commit:async(_upsert,remove,_token,guard)=>{assert.equal(guard(),true);for(const id of remove)metadata.delete(id);}});
    assert.equal((await storage.shallowAudit(ids)).issues.length,0);
    const maintenance=registry.require('asset-maintenance',1,Object.freeze({lifecycle:registry.require('operation-lifecycle',1)})).create({canMutate:()=>true,mutationActive:()=>false,collect:storage.collect,readRestoreJournal:h.app.restoreJournal.read,readLibraryClearJournal:h.app.libraryClearJournal.read,liveFields:()=>[],getReferenceRevision:()=>1,getDatasetRevision:async()=>'stable',scanReferences:rich.scanAttachmentReferences,readNotes:h.app.notes.readFreshPayload,
      // Check both strict production composition and a mixed-result port.
      loadActiveSession:()=>h.app.activeSession.load(0,{strict:fault!=='session-partial-port'}),readPendingReviewTexts:async()=>[],listDailyRecords:()=>h.app.dailyRecords.list({strict:true}),budget:()=>()=>false,yieldTask:async()=>{},invalidate(){},captureError(){},completed:()=>{completed++;},now:()=>0,setTimeout:context.setTimeout,clearTimeout:context.clearTimeout},{lease:Assets.createLease()});
    const beforeMetadata=JSON.stringify([...metadata]),beforeBytes=[...physical.keys()];
    assert.equal((await maintenance.run()).status,'failed',fault);
    assert.equal(JSON.stringify([...metadata]),beforeMetadata,fault+' must preserve every metadata row');assert.deepEqual([...physical.keys()],beforeBytes,fault+' must preserve every file');assert.equal(completed,0);assert.equal(maintenance.status().pending,true);assert.equal([...timers.values()][0].ms,1800000);
    failed=false;controls.failLocalGetKeys=new Set();
    assert.equal((await maintenance.run()).status,'completed',fault+' must resume');
    assert.deepEqual([...metadata.keys()],ids.slice(0,4));assert.equal(physical.size,4);assert.equal(completed,1);assert.equal(maintenance.status().pending,false);assert.equal(timers.size,0);
    cases.push('canonical reachability: '+fault+' preserves all data and retries to exact cleanup');
  }
}
// Assemble the real storage executor and lifecycle. Preparation latency may
// exceed the nominal pass allowance at every stage, but finite work must drain.
for(const latency of [4999,5000,6000,20000]){
 const timers=new Map();let stamp=0,sequence=0,completed=0,sourceRevision=1,busy=false,preempt=false;
 const context=vm.createContext({Blob,TextEncoder,crypto:webcrypto,setTimeout:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearTimeout:id=>timers.delete(id)});
 for(const file of ['internal','operation-lifecycle','asset-storage','asset-maintenance'])vm.runInContext(readCoreScript(file),context);
 const registry=context[Symbol.for('studyDirector.internalModules.v1')],Assets=registry.require('asset-storage',1),blob=new Blob(['orphan']);
 const rows=new Map(Array.from({length:4},(_,i)=>['att-'+String(i+1).padStart(32,'0'),{version:2,storage:'opfs',file:'attblob-'+String(i+1).padStart(32,'0'),hash:'c'.repeat(64),size:blob.size,type:'application/pdf',name:'orphan.pdf',library:false}])),files=new Map([...rows.values()].map(row=>[row.file,blob]));
 const slow=()=>{stamp+=latency;if(preempt)busy=true;};
 const dir={async *entries(){for(const name of files.keys()){slow();yield [name,{kind:'file'}];}},removeEntry:async name=>files.delete(name)};
 const storage=Assets.create({name:'slow-cleanup',protocol:'https:',storage:{getDirectory:async()=>({getDirectoryHandle:async()=>dir})},locks:{request:async(_name,options,work)=>(typeof options==='function'?options:work)({})},read:async key=>{slow();return rows.get(key);},keys:async()=>{slow();return [...rows.keys()];},entries:async()=>{slow();return [...rows];},commit:async(_upsert,remove,_token,guard)=>{assert.equal(guard(),true);for(const key of remove)rows.delete(key);sourceRevision++;},validId:value=>/^att-[a-f0-9]{32}$/.test(value),validType:type=>type==='application/pdf',maxBytes:1024,canMutate:()=>true,issueToken:()=>1,assertToken(){},ingest:{ingest:async()=>assert.fail('unused')}});
 const maintenance=registry.require('asset-maintenance',1,Object.freeze({lifecycle:registry.require('operation-lifecycle',1)})).create({canMutate:()=>true,mutationActive:()=>busy,collect:storage.collect,readRestoreJournal:async()=>{slow();return null;},readLibraryClearJournal:async()=>{slow();return null;},liveFields:()=>[],getReferenceRevision:()=>1,getDatasetRevision:async()=>{slow();return sourceRevision;},scanReferences:()=>({trusted:true,assetIds:[]}),readNotes:async()=>{slow();return {};},loadActiveSession:async()=>{slow();return {ok:true,value:null};},readPendingReviewTexts:async()=>[],listDailyRecords:async()=>{slow();return [];},budget:()=>()=>true,yieldTask:async()=>{},invalidate(){},captureError:error=>assert.fail(error),completed:()=>{completed++;},now:()=>stamp,setTimeout:context.setTimeout,clearTimeout:context.clearTimeout},{lease:Assets.createLease()});
 preempt=true;assert.equal((await maintenance.run()).reason,'foreground-busy');assert.equal(rows.size,4);assert.equal(files.size,4);preempt=false;busy=false;
 // Each source phase has a retained load and traversal boundary; the
 // canonical mutation epoch changes after deletion, so each remaining
 // orphan may require a new proof. Physical candidates advance once each.
 const sourcePhases=4,maxAttempts=(2*sourcePhases+2)*rows.size+files.size+2;
 let final;for(let pass=0;pass<maxAttempts;pass++){final=await maintenance.run();assert.ok(final.removed<=1,'slow deletion reads commit a single bounded candidate');if(['completed','clean'].includes(final.status))break;assert.equal(final.status,'yielded');assert.equal(final.reason,'budget');}
 assert.ok(['completed','clean'].includes(final.status));assert.equal(rows.size,0);assert.equal(files.size,0);assert.equal(completed,1);assert.equal(maintenance.status().pending,false);assert.equal(timers.size,0);
 cases.push('assembled attachment GC finishes with '+latency+'ms IO and preemption retains bytes');
}
console.log(JSON.stringify({status:'PASS',suite:'attachment-cleanup',cases},null,2));
