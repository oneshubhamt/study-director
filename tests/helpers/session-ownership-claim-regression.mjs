import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const freeze=Object.freeze,noop=()=>{},DATE='2026-10-27',A='inst_claim_device_a',B='inst_claim_device_b';
const context={Object,Symbol,TypeError,Error,Date,AbortController,Blob,Promise,Map,Set,TextEncoder,Uint8Array,DOMException,console,setTimeout,clearTimeout};context.globalThis=context;vm.createContext(context);
for(const name of ['internal','operation-lifecycle','repository-policy','repository-background','backup-provider'])vm.runInContext(fs.readFileSync(`source/core/${name}.js`,'utf8'),context,{filename:`source/core/${name}.js`});
const registry=context[Symbol.for('studyDirector.internalModules.v1')],lifecycle=registry.require('operation-lifecycle',1),background=registry.require('repository-background',1,freeze({lifecycle})),policy=registry.require('repository-policy',1);
const sha256=async blob=>createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex');
const unexpected=()=>{throw new Error('Unexpected backup-pipeline operation in Active Session claim test.');};
const pipeline=freeze({
  createPublication:unexpected,publish:unexpected,publishInline:unexpected,inspectManifest:unexpected,inspect:unexpected,bringIn:unexpected,restoreVersion:unexpected,verifyCheckpoint:unexpected,verifyObject:unexpected,scrub:unexpected,cleanup:unexpected,inspectCommit:unexpected,
  retention:freeze({}),validatePolicy:unexpected,classifyState:unexpected,activeProtected:unexpected,selectRetention:unexpected,projectHistory:unexpected,noteObject:unexpected,readNote:unexpected,readSession:unexpected,markCompleted:unexpected,sharedBase:unexpected,establishBase:unexpected
});
const presentation=freeze({
  begin:()=>freeze({update:noop,finish:noop}),read:()=>null,feedback:noop,condition:noop,notice:noop,detail:noop,outcome:noop,locationLabel:()=>'',resolve:noop,reset:noop,subscribe:()=>noop
});
const files=new Map(),claimOrder=new Map(),watchCommits=[];let publicationId=0,claimDownloads=0,claimLists=0,tick=0,operations=0,watchFails=false,oddWatch={ignored:0,ignoredCommits:0};
const HEAD_A='cp_'+'a'.repeat(32),HEAD_B='cp_'+'b'.repeat(32),CONTENT_FINGERPRINT='c'.repeat(64),HANDOFF_TOKEN='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',OTHER_TOKEN='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';let headId=HEAD_A;
const descriptor=file=>freeze({kind:'session-claim',id:file.id,name:file.name,size:file.blob.size,digest:file.digest,serverDigest:file.digest,createdAt:file.exportedAt,modifiedAt:file.exportedAt,remoteId:'claim-'+file.id,remoteVersion:'1',verificationScope:'claim-scope'});
const headDescriptor=kind=>freeze({kind,id:headId,name:headId+(kind==='checkpoint'?'.sdcheckpoint':'.sdcommit'),size:1,digest:'d'.repeat(64),serverDigest:'d'.repeat(64),createdAt:'2026-10-27T08:00:00.000Z',modifiedAt:'2026-10-27T08:00:00.000Z',remoteId:kind+'-'+headId,...(kind==='checkpoint'?{history:freeze({format:15,logicalFingerprint:'e'.repeat(64),exportedAt:'2026-10-27T08:00:00.000Z',counts:freeze({dailyRecord:0,note:0}),encrypted:false,retention:freeze({role:'normal'}),origin:B})}:{})});
const repository=freeze({
  scope:async()=>'claim-scope',
  list:async({kind})=>freeze({items:freeze(['checkpoint','commit'].includes(kind)?[headDescriptor(kind)]:[]),overflow:false,ignored:0}),upload:unexpected,download:unexpected,delete:unexpected,
  beginPublication:async()=>freeze({id:'pub_'+(++publicationId),createdAt:new Date().toISOString(),sameDevice:false}),
  listPublications:async()=>freeze({items:freeze([]),overflow:false,ignored:0}),assertPublication:async()=>true,endPublication:async()=>true,
  listSessionClaims:async()=>{claimLists++;return freeze({items:freeze([...files.values()].map(descriptor)),overflow:false,ignored:0});},
  // Newest first, takeover notes and version-complete records together.
  listSessionWatch:async({limit})=>{
    if(watchFails){watchFails=false;throw new Error('QA_FIXTURE network failure');}
    const rows=[...[...files.values()].map(file=>({at:claimOrder.get(file.id)||0,item:descriptor(file)})),...watchCommits].sort((x,y)=>y.at-x.at).slice(0,limit).map(row=>row.item);
    return freeze({claims:freeze(rows.filter(row=>row.kind==='session-claim')),commits:freeze(rows.filter(row=>row.kind==='commit')),incomplete:false,...oddWatch});
  },
  // Each operation verifies Drive's folder once (counted here).
  beginOperation:()=>{operations++;return repository;},
  uploadSessionClaim:async file=>{files.set(file.id,freeze({...file}));claimOrder.set(file.id,++tick);return descriptor(file);},
  downloadSessionClaim:async item=>{claimDownloads++;const file=files.get(item.id);if(!file)throw new Error('missing claim');return freeze({blob:file.blob,release:async()=>{}});},
  deleteSessionClaim:async item=>files.delete(item.id)
});
function makeRuntime(installationId,read){
  const runtime=registry.require('backup-provider',1,freeze({repositoryPolicy:policy})).createRuntime(freeze({
    background:freeze({format:background.format,contractVersion:1,createCoordinator:background.createCoordinator,maintenance:background.maintenance,maintenanceActionable:background.maintenanceActionable}),
    repository:pipeline,
    ports:freeze({
      configuration:freeze({appVersion:'qa'}),controller:freeze({beginImport:noop,cancelImport:noop,finishImport:noop}),
      exports:freeze({
        followProtection:async()=>false,
        protect:async file=>freeze({...file,encrypted:false,protectionId:'',checkProtection:async()=>{}}),
        unprotect:async blob=>freeze({blob,encrypted:false}),
        run:async(type,data)=>{if(type==='checksum')return sha256(data.value);if(type==='file.release')return true;throw new Error('Unexpected export operation '+type);}
      }),
      domain:freeze({clampText:value=>String(value||'')}),view:freeze({presentation}),
      ownership:freeze({canRunBackground:()=>true,canShare:()=>true,requireMutationControl:noop}),
      environment:freeze({clearTimeout,setTimeout}),diagnostics:freeze({capture:noop,fail:noop,finish:noop,mark:noop,start:()=>''})
    })
  }));
  runtime.register(freeze({id:'google-drive',label:'Google Drive',shared:true,connected:()=>true,backgroundAvailable:()=>true,repository}));
  runtime.configureSessionOwnership(freeze({installationId:()=>installationId,read:async()=>read(),today:()=>DATE}));
  return runtime;
}
let sessionA=freeze({date:DATE,runningOn:B,revision:50}),sessionB=freeze({date:DATE,runningOn:B,revision:50});
const a=makeRuntime(A,()=>sessionA),b=makeRuntime(B,()=>sessionB);
const claimed=await a.claimSessionOwnership('google-drive',{date:DATE,observedOwner:B,observedRevision:50,observedContentFingerprint:CONTENT_FINGERPRINT,expectedCheckpointId:HEAD_A,handoffToken:HANDOFF_TOKEN,revision:51});
assert.equal(claimed.status,'completed');assert.equal(claimed.claim.state,'owned');assert.equal(claimed.claim.revision,51);
assert.equal(claimDownloads,0,'a new claim is confirmed from one listing (Drive\'s checksum of the upload), not downloaded again');
const stored=[...files.values()].sort((x,y)=>x.id.localeCompare(y.id)).at(-1),raw=JSON.parse(await stored.blob.text());
assert.equal(raw.version,4);assert.equal(raw.handoffToken,HANDOFF_TOKEN);assert.equal(raw.state,'owned');assert.match(raw.sessionToken,/^[a-f0-9]{64}$/u);assert.match(raw.ownerToken,/^[a-f0-9]{64}$/u);assert.match(raw.observedOwnerToken,/^[a-f0-9]{64}$/u);assert.equal(raw.observedContentFingerprint,CONTENT_FINGERPRINT);
assert.equal(raw.handoffToken,HANDOFF_TOKEN,'verified remote claim is tied to the local attempt');
for(const key of ['date','owner','observedOwner'])assert.equal(Object.hasOwn(raw,key),false,`stored claim must not expose ${key}`);
const seenA=await a.readSessionClaim('google-drive');
assert.equal(claimDownloads,0,'the claim this device wrote and verified is not downloaded to read it');
const seenB=await b.readSessionClaim('google-drive');
assert.equal(claimDownloads,1,'another device downloads a claim it has not seen');
await b.readSessionClaim('google-drive');
assert.equal(claimDownloads,1,'an unchanged claim file is one listing, not a listing and a download');
{
  // A changed file is downloaded again, even at the same size.
  const file=[...files.values()].sort((x,y)=>x.id.localeCompare(y.id)).at(-1),value=JSON.parse(await file.blob.text());
  value.ownerToken=value.ownerToken.slice(0,-1)+(value.ownerToken.endsWith('0')?'1':'0');
  const blob=new Blob([JSON.stringify(value)]);assert.equal(blob.size,file.blob.size);
  files.set(file.id,freeze({...file,blob,size:blob.size,digest:await sha256(blob)}));
  assert.equal((await b.readSessionClaim('google-drive')).ownerToken,value.ownerToken,'the changed claim is read, not the remembered one');
  assert.equal(claimDownloads,2);
  files.set(file.id,file);
}
assert.deepEqual({state:seenA.state,applies:seenA.applies,ownedHere:seenA.ownedHere,revision:seenA.revision,handoffToken:seenA.handoffToken},{state:'owned',applies:true,ownedHere:true,revision:51,handoffToken:HANDOFF_TOKEN});
assert.deepEqual({state:seenB.state,applies:seenB.applies,ownedHere:seenB.ownedHere,revision:seenB.revision},{state:'owned',applies:true,ownedHere:false,revision:51});
// A Continue Here that stopped after its claim landed is finished by another
// one. This device's own claim never blocks it; the new claim records what
// the device observes now (here the old owner studied on to revision 55).
const again=await a.claimSessionOwnership('google-drive',{date:DATE,observedOwner:B,observedRevision:55,observedContentFingerprint:CONTENT_FINGERPRINT,expectedCheckpointId:HEAD_A,handoffToken:OTHER_TOKEN,revision:56});
assert.equal(again.status,'completed');assert.equal(again.claim.epoch,claimed.claim.epoch+1,'a fresh claim, not the old one');
assert.equal(again.claim.observedRevision,55);assert.equal(again.claim.handoffToken,OTHER_TOKEN);
await assert.rejects(()=>b.claimSessionOwnership('google-drive',{date:DATE,observedOwner:B,observedRevision:50,observedContentFingerprint:CONTENT_FINGERPRINT,expectedCheckpointId:HEAD_A,handoffToken:HANDOFF_TOKEN,revision:51}),error=>error?.code==='REPOSITORY_SESSION_CLAIM_STALE','the stale former owner must not reclaim from old evidence');
await assert.rejects(()=>b.claimSessionOwnership('google-drive',{date:DATE,observedOwner:B,observedRevision:60,observedContentFingerprint:CONTENT_FINGERPRINT,expectedCheckpointId:HEAD_A,handoffToken:HANDOFF_TOKEN,revision:61}),error=>error?.code==='REPOSITORY_SESSION_CLAIM_STALE','another device\'s claim blocks a claim that observed a different owner, whatever the revision');
headId=HEAD_B;
await assert.rejects(()=>a.claimSessionOwnership('google-drive',{date:DATE,observedOwner:B,observedRevision:50,observedContentFingerprint:CONTENT_FINGERPRINT,expectedCheckpointId:HEAD_A,handoffToken:HANDOFF_TOKEN,revision:52}),error=>error?.code==='REPOSITORY_SESSION_CLAIM_STALE','a takeover must fail if Drive advances after the verified head was observed but before the claim linearizes');
assert.equal(await a.releaseSessionClaim('google-drive',claimed.claim),false,'only the newest claim can be compensated');
assert.equal(await a.releaseSessionClaim('google-drive',again.claim),true,'a failed local takeover can restore the previous owner with a higher epoch');
const rolledBack=await b.readSessionClaim('google-drive');assert.equal(rolledBack.handoffToken,OTHER_TOKEN,'compensation retains the exact attempt identity');assert.equal(rolledBack.state,'owned');assert.equal(rolledBack.applies,true);assert.equal(rolledBack.ownedHere,true);assert.equal(rolledBack.revision,55);
// Released builds write the hashed v2 form, and Drive can still hold a plain
// form with a date and device ids. Both are read as v4 claims without the
// fields they lack, through the one compatibility path.
const lastStored=[...files.values()].sort((p,q)=>p.id.localeCompare(q.id)).at(-1);
const oldValue=JSON.parse(await lastStored.blob.text());
const replaceLast=async value=>{const blob=new Blob([JSON.stringify(value)]);files.set(lastStored.id,freeze({...lastStored,blob,size:blob.size,digest:await sha256(blob)}));};
const v2Value={...oldValue,version:2};delete v2Value.observedContentFingerprint;delete v2Value.handoffToken;
await replaceLast(v2Value);
const v2Projected=await b.readSessionClaim('google-drive');
assert.equal(v2Projected.state,oldValue.state);assert.equal(v2Projected.applies,true,'a v2 claim from an older device still applies to today');
assert.equal(v2Projected.revision,oldValue.revision);assert.equal(v2Projected.observedContentFingerprint,'');assert.equal(v2Projected.handoffToken,'');
await replaceLast({format:'study-director.active-session-claim',version:1,date:DATE,epoch:oldValue.epoch,owner:A,observedRevision:50,claimedAt:'2026-10-27T09:00:00.000Z'});
const plainProjected=await a.readSessionClaim('google-drive');
assert.equal(plainProjected.applies,true);assert.equal(plainProjected.ownedHere,true,'a plain claim naming this device reads as owned here');
assert.equal(plainProjected.state,'owned');assert.equal(plainProjected.revision,51,'a plain v1 claim implies the next revision');
// A claim a newer build wrote (this format, a higher version) is not read:
// it reads as owned elsewhere by a device this build cannot follow, and
// Continue Here, sync and upload wait for an app update. Nothing is written.
await replaceLast({...oldValue,version:9,someNewField:'x'});
const newer=await b.readSessionClaim('google-drive');
assert.deepEqual({...newer},{state:'owned',applies:true,ownedHere:false,newer:true,epoch:oldValue.epoch},'a newer claim reads as owned elsewhere, newer');
assert.equal(b.diagnosticSync().find(row=>row.id==='google-drive')?.needsUpdate,true,'sync says the app needs an update');
const filesBefore=files.size;
await assert.rejects(()=>b.claimSessionOwnership('google-drive',{date:DATE,observedOwner:B,observedRevision:50,observedContentFingerprint:CONTENT_FINGERPRINT,expectedCheckpointId:headId,handoffToken:OTHER_TOKEN,revision:57}),error=>error?.code==='REPOSITORY_SYNC_NEEDS_UPDATE'&&/newer version of Study Director\. Update this app to continue\./u.test(error.message),'Continue Here waits for an app update');
assert.equal(files.size,filesBefore,'and writes no claim');
const downloadsBefore=claimDownloads;await b.readSessionClaim('google-drive');assert.equal(claimDownloads,downloadsBefore,'an unchanged newer claim is not downloaded again');
await replaceLast({...oldValue,format:'another.format',version:9});
await assert.rejects(()=>b.readSessionClaim('google-drive'),error=>error?.code==='REPOSITORY_SESSION_CLAIM_UNCERTAIN','an unknown claim form is not guessed at');
await replaceLast(oldValue);
assert.equal((await b.readSessionClaim('google-drive')).newer,undefined,'a readable claim reads as before');
assert.equal(b.diagnosticSync().find(row=>row.id==='google-drive')?.needsUpdate,false,'and the update notice goes');
// The session check (watchSession, every 10 s): one listing of the newest
// takeover notes and version-complete records. A version another device
// finished is reported once; when only newer versions fill the answer, no
// note was added since, and the last verified claim stands without listing
// every note again.
{
  const commit=id=>freeze({...headDescriptor('commit'),id,name:id+'.sdcommit',remoteId:'commit-'+id});
  const known=await b.readSessionClaim('google-drive'),listsBefore=claimLists,first=await b.watchSession('google-drive');
  assert.equal(first.claim.epoch,known.epoch,'the check sees the current claim from its one listing');
  assert.equal(claimLists,listsBefore,'without listing every claim');
  assert.equal(first.newVersions,false,'no version finished elsewhere yet');
  watchCommits.push({at:++tick,item:commit('cp_'+'e'.repeat(32))});
  assert.equal((await b.watchSession('google-drive')).newVersions,true,'a version finished elsewhere is reported');
  // Not brought in yet (a takeover was being saved): the next check reports it again.
  assert.equal((await b.watchSession('google-drive')).newVersions,true,'reported until it is brought in');
  b.bringInSessionVersions('google-drive');
  assert.equal((await b.watchSession('google-drive')).newVersions,false,'once brought in, not again');
  for(let index=0;index<25;index++)watchCommits.push({at:++tick,item:commit('cp_'+String(index).padStart(32,'f'))});
  const crowded=await b.watchSession('google-drive');
  assert.equal(crowded.claim.epoch,known.epoch,'with only newer versions in the answer, the last verified claim stands');
  assert.equal(claimLists,listsBefore,'still without listing every claim');
  assert.equal(crowded.newVersions,true);b.bringInSessionVersions('google-drive');
  // After a gap (offline, in the background) a claim may have been pushed out
  // of the answer by later versions: every note is read once more.
  const realNow=Date.now,operationsBefore=operations;Date.now=()=>realNow()+61000;
  try{
    const afterGap=await b.watchSession('google-drive');assert.equal(afterGap.claim.epoch,known.epoch);assert.equal(claimLists,listsBefore+1,'after a gap the claims are read in full');
    // One operation serves every check: one request each, Drive's folder
    // verified when checks start and again only after an error.
    await b.watchSession('google-drive');await b.watchSession('google-drive');
    assert.equal(operations,operationsBefore,'the checks share one operation, even after a gap');
    watchFails=true;await assert.rejects(()=>b.watchSession('google-drive'));
    await b.watchSession('google-drive');
    assert.equal(operations,operationsBefore+1,'after an error the folder is verified again');
    // An unreadable version record does not hide a takeover; an unreadable
    // takeover note leaves ownership uncertain, and the check says so.
    oddWatch={ignored:0,ignoredCommits:1};assert.equal((await b.watchSession('google-drive')).claim.epoch,known.epoch);
    oddWatch={ignored:1,ignoredCommits:0};await assert.rejects(()=>b.watchSession('google-drive'),error=>error.code==='REPOSITORY_SESSION_CLAIM_UNCERTAIN');
  }finally{Date.now=realNow;oddWatch={ignored:0,ignoredCommits:0};}
}
// Version 3 was written only by unreleased builds; it is refused like any unknown form.
const v3Value={...oldValue,version:3};delete v3Value.handoffToken;
await replaceLast(v3Value);
await assert.rejects(()=>b.readSessionClaim('google-drive'),error=>error?.code==='REPOSITORY_SESSION_CLAIM_UNCERTAIN','a version-3 claim is refused');
console.log(JSON.stringify({status:'PASS',suite:'session-ownership-claim',opaque:true,contentAnchored:true,staleOwnerBlocked:true,staleHeadBlocked:true,rollbackEpoch:true},null,2));
