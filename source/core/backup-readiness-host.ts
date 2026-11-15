import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {AutomaticBackupPolicy,AutomaticBackupPolicyInput,BackupNudgeController,BackupNudgeInput,BackupReadinessHostContract,CanonicalCommitController,CanonicalCommitEvent,CanonicalCommitInput,StorageHealthController,StorageHealthHistory,StorageHealthInput,StorageHealthPatch,StorageHealthState,VerifiedBackupReceipt,VerifiedRecoveryController,VerifiedRecoveryCopy,VerifiedRecoveryInput,VerifiedRecoveryState} from '../../types/backup-readiness-host.ts';

const sdBackupReadinessHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'backup-readiness-host','study-director.backup-readiness-host-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
const {exactFrozenObject:exactObject}=registry.contracts,freeze=Object.freeze;

const EMPTY_HEALTH:StorageHealthHistory=freeze({version:3,lastLocalSaveAt:null,lastStudyDataSaveAt:null,browserDataClearedAt:null});
const SOURCE_LABELS:Readonly<Record<string,string>>=freeze({
  indexedDB:'Browser database','localStorage.read':'Browser storage read','localStorage.write':'Browser storage write',
  'planDraft.write':'Plan draft',activeSession:'Live-session recovery',notes:'Notes',dailyRecords:'Library records',deletionRecovery:'Deletion recovery',
  maintenance:'Data maintenance',capacity:'Storage capacity',backup:'Backup',attachmentIntegrity:'Attachment storage',repositoryIntegrity:'Backup verification'
});
function objectRecord(value:unknown):Record<string,unknown>{return value&&typeof value==='object'?value as Record<string,unknown>:Object.create(null) as Record<string,unknown>;}
function optionalIso(value:unknown):string|null{
  if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return null;
  return new Date(value).toISOString();
}
function healthHistory(value:unknown):StorageHealthHistory{
  const row=objectRecord(value);
  return freeze({
    version:3,
    lastLocalSaveAt:optionalIso(row['lastLocalSaveAt']),
    lastStudyDataSaveAt:optionalIso(row['lastStudyDataSaveAt']),
    browserDataClearedAt:optionalIso(row['browserDataClearedAt'])
  });
}
function createStorageHealth(input:Readonly<StorageHealthInput>):Readonly<StorageHealthController>{
  exactObject(input,['local','key','maxStatusMessageChars','clampText','refreshWarning','scheduleSyncStatus','document','timeLabelFromIso','renderCapabilities'],'Storage health input');
  const issueMap=new Map<string,Readonly<{source:string;label:string;message:string;level:'warn'|'error';at:string}>>();
  let active=false,mirroring=false,clearMarkerOwned=false;
  let history=healthHistory(input.local.getJson(input.key,null));
  const initialReadError=input.local.lastError;
  if(initialReadError){
    const fields=objectRecord(initialReadError),message=String(fields['message']||initialReadError);
    issueMap.set('localStorage.read',freeze({source:'localStorage.read',label:SOURCE_LABELS['localStorage.read']!,message:`Browser storage could not be read: ${message}. Changes may not restore after reload.`,level:'error',at:new Date().toISOString()}));
  }
  const notify=()=>{if(active)input.refreshWarning();};
  const normalizeSource=(value:unknown)=>String(value||'storage').slice(0,80);
  const normalizeMessage=(value:unknown)=>input.clampText(String(value||'Storage is unavailable.'),input.maxStatusMessageChars);
  function laterTime(own:unknown,other:unknown):string|null{
    const ownText=typeof own==='string'?own:'',otherText=typeof other==='string'?other:'',ownAt=Date.parse(ownText),otherAt=Date.parse(otherText);
    return Number.isFinite(otherAt)&&(!Number.isFinite(ownAt)||otherAt>ownAt)?new Date(otherAt).toISOString():optionalIso(ownText);
  }
  function mirror(options:Readonly<{marker?:boolean}>={}):boolean{
    if(mirroring)return false;mirroring=true;
    try{
      const known=healthHistory(input.local.getJson(input.key,null));
      history=freeze({...history,lastLocalSaveAt:laterTime(history.lastLocalSaveAt,known.lastLocalSaveAt),lastStudyDataSaveAt:laterTime(history.lastStudyDataSaveAt,known.lastStudyDataSaveAt)});
      if(!clearMarkerOwned&&!options.marker)history=freeze({...history,browserDataClearedAt:known.browserDataClearedAt});
      return input.local.setJson(input.key,history);
    }finally{mirroring=false;}
  }
  function snapshot():StorageHealthState{
    const issues=freeze([...issueMap.values()].sort((a,b)=>a.at.localeCompare(b.at)));
    return freeze({...history,issues,hasIssues:issues.length>0});
  }
  function issue(source:unknown,message:unknown,options:Readonly<{level?:'warn';mirror?:boolean}>={}):StorageHealthState{
    const key=normalizeSource(source),entry=freeze({source:key,label:SOURCE_LABELS[key]||'Storage',message:normalizeMessage(message),level:options.level==='warn'?'warn' as const:'error' as const,at:new Date().toISOString()});
    issueMap.set(key,entry);if(key==='indexedDB'&&options.mirror!==false)mirror();notify();return snapshot();
  }
  function patchHistory(patch:StorageHealthPatch):void{
    const source=objectRecord(patch);
    history=freeze({...history,
      ...(Object.hasOwn(source,'lastLocalSaveAt')?{lastLocalSaveAt:optionalIso(source['lastLocalSaveAt'])}:{}),
      ...(Object.hasOwn(source,'lastStudyDataSaveAt')?{lastStudyDataSaveAt:optionalIso(source['lastStudyDataSaveAt'])}:{}),
      ...(Object.hasOwn(source,'browserDataClearedAt')?{browserDataClearedAt:optionalIso(source['browserDataClearedAt'])}:{})
    });
  }
  function recover(source:unknown,patch:StorageHealthPatch|null=null,options:Readonly<{mirror?:boolean}>={}):StorageHealthState{
    const key=normalizeSource(source),recovered=issueMap.delete(key),hasPatch=!!patch&&Object.keys(patch).length>0;
    if(!recovered&&!hasPatch)return snapshot();
    if(patch){patchHistory(patch);if(options.mirror!==false)mirror();}
    notify();return snapshot();
  }
  function updateHistory(patch:StorageHealthPatch):StorageHealthState{
    const marker=Object.hasOwn(patch,'browserDataClearedAt');patchHistory(patch);mirror({marker});if(marker)clearMarkerOwned=!!history.browserDataClearedAt;notify();return snapshot();
  }
  function observeLocalStorage(operation:unknown,error:unknown):void{
    const kind=operation==='write'?'write':'read',source=`localStorage.${kind}`;
    if(error){const fields=objectRecord(error),action=kind==='write'?'written':'read';issue(source,`Browser storage could not be ${action}: ${String(fields['message']||error)}. Changes may not survive a reload.`,{mirror:false});}
    else if(issueMap.has(source))recover(source,null,{mirror:false});
  }
  function localIsoDate(date:Date):string{return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function healthTime(value:string|null):string{
    if(!value)return 'never';const date=new Date(value);if(!Number.isFinite(date.getTime()))return 'unknown';
    if(localIsoDate(date)===localIsoDate(new Date()))return input.timeLabelFromIso(value)||'today';
    return date.toLocaleDateString('en-IN',{day:'2-digit',month:'short'});
  }
  function render(health:StorageHealthState=snapshot()):void{
    input.scheduleSyncStatus();
    const el=input.document.getElementById('storage-health'),lastSaved=input.document.getElementById('last-local-save');
    if(lastSaved){lastSaved.textContent=health.lastLocalSaveAt?healthTime(health.lastLocalSaveAt):'Never';lastSaved.title=health.lastLocalSaveAt||'';}
    if(el){
      el.hidden=!health.issues.length;el.textContent=health.issues.map(row=>`${row.label}: ${row.message.slice(0,180)}`).join(' · ');
      const className=health.issues.some(row=>row.level==='error')?'err':health.issues.some(row=>row.level==='warn')?'warn':'ok';
      el.className='storage-health ui-surface ui-status '+className;
    }
    input.renderCapabilities();
  }
  const markOk=(source:string,key:string='')=>recover(source,key?{[key]:new Date().toISOString()}:null);
  const markTimestamp=(key:string)=>updateHistory({[key]:new Date().toISOString()});
  const markError=(source:string,reason:unknown,options:Readonly<{level?:'warn';mirror?:boolean}>={})=>issue(source,reason||'Storage is unavailable.',options);
  function activate():StorageHealthState{active=true;notify();return snapshot();}
  return freeze({format:'study-director.storage-health' as const,contractVersion:1 as const,activate,issue,recover,updateHistory,observeLocalStorage,snapshot,render,markOk,markTimestamp,markError});
}

function createCanonicalCommit(input:Readonly<CanonicalCommitInput>):Readonly<CanonicalCommitController>{
  exactObject(input,['storage','scanAttachmentReferences','incrementReferenceRevision','syncCapability','notifyBackupChange','scheduleAssetMaintenance','invalidateAttachmentLibrary','fullyInitialized','refreshKeptVersions','reminderDate','revalidateSaveReminder','nowIso'],'Canonical commit host input');
  const signatures=new Map<string,string>(),studyDataTypes=new Set(['note','dailyRecord','activeSession','planData','pendingReview']);
  function descriptor(event:CanonicalCommitEvent):Readonly<{key:string;force:boolean;deleted:boolean;text:string}>|null{
    const type=String(event?.entityType||''),operation=event?.operation==='delete'?'delete':'upsert',value=objectRecord(event?.value);
    if(type==='dataset')return freeze({key:'dataset:*',force:true,deleted:operation==='delete',text:''});
    let identity='',text='';
    if(type==='note'){identity=String(value['key']||'');text=String(value['text']||'');}
    else if(type==='dailyRecord'){identity=String(value['date']||'');text=String(value['reflection']||'');}
    else if(type==='activeSession'){
      identity=String(value['id']||'current');
      const snapshot=objectRecord(value['snapshot']),review=objectRecord(snapshot['review']);text=String(review['reflection']||'');
    }else if(type==='pendingReview')return freeze({key:'pendingReview:*',force:true,deleted:false,text:''});
    else return null;
    return freeze({key:`${type}:${identity||'*'}`,force:false,deleted:operation==='delete',text});
  }
  function changesAttachmentReferences(event:CanonicalCommitEvent):boolean{
    const row=descriptor(event);if(!row)return false;if(row.force){signatures.clear();return true;}
    const prior=signatures.get(row.key);if(row.deleted){signatures.delete(row.key);return prior!==undefined||row.key.startsWith('activeSession:');}
    let signature='';
    try{
      const scan=input.scanAttachmentReferences(row.text);if(!scan||scan.trusted!==true)return true;
      signature=[...new Set(scan.assetIds||[])].sort().join('|');
    }catch{return true;}
    signatures.set(row.key,signature);return prior===undefined||prior!==signature;
  }
  function handle(event:CanonicalCommitEvent):void{
    const referencesChanged=changesAttachmentReferences(event);if(referencesChanged)input.incrementReferenceRevision();
    const committedAt=event?.committedAt||input.nowIso(),studyData=event?.startup!==true&&event?.settingsOnly!==true&&studyDataTypes.has(event?.entityType);
    input.storage.updateHistory(studyData?{lastLocalSaveAt:committedAt,lastStudyDataSaveAt:committedAt}:{lastLocalSaveAt:committedAt});input.storage.render();
    input.syncCapability(event);
    if(event?.backupCapture!==true)input.notifyBackupChange({urgent:event?.entityType==='dailyRecord',reason:String(event?.entityType||'canonical-commit')});
    if(referencesChanged&&event?.backupCapture!==true){input.scheduleAssetMaintenance();input.invalidateAttachmentLibrary();}
    if(event?.entityType==='pendingReview'&&input.fullyInitialized())void input.refreshKeptVersions();
    if(event?.entityType==='dailyRecord'&&input.reminderDate())void input.revalidateSaveReminder();
  }
  return freeze({format:'study-director.canonical-commit-host' as const,contractVersion:1 as const,handle,changesAttachmentReferences});
}


const VERIFIED_SOURCE=/^[a-z][a-z0-9-]{0,40}$/u;
const verifiedBackupTime=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
function normalizeVerifiedRecoveryCopy(value:unknown):VerifiedRecoveryCopy|null{
  const row=objectRecord(value),at=verifiedBackupTime(row['at']),sourceRevision=verifiedBackupTime(row['sourceRevision']);
  if(!at||!sourceRevision)return null;
  const format=Number.isSafeInteger(row['format'])?Number(row['format']):null;
  return freeze({at,sourceRevision,format,...(row['verified']===true||row['verified']===false?{verified:row['verified']===true}:{})});
}
function normalizeVerifiedRecoveryState(value:unknown):VerifiedRecoveryState{
  const row=objectRecord(value);
  if(Number(row['version'])!==3)return freeze({version:3 as const,file:null,providers:freeze({})});
  const providers:Record<string,VerifiedRecoveryCopy>=Object.create(null) as Record<string,VerifiedRecoveryCopy>;
  for(const [id,raw] of Object.entries(objectRecord(row['providers']))){
    const copy=VERIFIED_SOURCE.test(id)?normalizeVerifiedRecoveryCopy(raw):null;if(copy)providers[id]=copy;
  }
  const file=normalizeVerifiedRecoveryCopy(row['file']);
  return freeze({version:3 as const,file:file?freeze({...file,verified:objectRecord(row['file'])['verified']===true}):null,providers:freeze(providers)});
}

function createVerifiedRecovery(input:Readonly<VerifiedRecoveryInput>):Readonly<VerifiedRecoveryController>{
  exactObject(input,['metadata','storageHealth','mutationEpoch','backupVersion','sourceRevision','refreshProviders','capture','nowIso'],'Verified recovery readiness input');
  let current:VerifiedRecoveryState=normalizeVerifiedRecoveryState(null),writeChain:Promise<unknown>=Promise.resolve(),startupReady:Promise<boolean>|null=null;
  const entries=(state:VerifiedRecoveryState=current)=>freeze([state.file,...Object.values(state.providers)].filter((entry):entry is VerifiedRecoveryCopy=>entry!==null));
  const lastBackupTime=(state:VerifiedRecoveryState=current)=>Math.max(-Infinity,...entries(state).map(entry=>Date.parse(entry.at)).filter(Number.isFinite));
  const verified=(source:string)=>source==='file'?current.file:current.providers[source]||null;
  async function read(){return normalizeVerifiedRecoveryState(await input.metadata.read());}
  function update(change:(state:VerifiedRecoveryState)=>VerifiedRecoveryState|Readonly<{version:3;file:VerifiedRecoveryCopy|null;providers:Readonly<Record<string,VerifiedRecoveryCopy>>}>){
    const run=async()=>{
      const next=normalizeVerifiedRecoveryState(change(await read()));
      try{await input.metadata.write(next);}
      catch(error){input.capture('backup.freshness-write',error,'warn');throw error;}
      current=next;input.refreshProviders();return true;
    };
    const next=writeChain.catch(()=>undefined).then(run);writeChain=next;return next;
  }
  function record(copy:VerifiedBackupReceipt):Promise<boolean>{
    const source=String(copy?.source||''),sourceRevision=verifiedBackupTime(copy?.sourceRevision);
    if(!sourceRevision||!VERIFIED_SOURCE.test(source))return Promise.resolve(false);
    const entry:VerifiedRecoveryCopy=freeze({at:input.nowIso(),sourceRevision,format:copy.attachmentsComplete===false?null:input.backupVersion});
    return update(prior=>source==='file'
      ?freeze({...prior,file:freeze({...entry,verified:copy.verified===true})})
      :freeze({...prior,providers:freeze({...prior.providers,[source]:entry})}));
  }
  async function reconcileChangeClock(){
    const recorded=String(input.storageHealth.snapshot().lastLocalSaveAt||''),latest=await input.mutationEpoch.latestChangeAt(recorded);
    if(latest===recorded)return false;
    input.storageHealth.updateHistory({lastLocalSaveAt:latest});return true;
  }
  function reconcileStartupChangeClock(){
    if(!startupReady)startupReady=reconcileChangeClock().catch(error=>{startupReady=null;throw error;});
    return startupReady;
  }
  async function install(){current=await read();input.refreshProviders();return current;}
  async function verifyFreshCurrentBackup(){
    const unknown=()=>freeze({ok:false,verifiedCopies:0,latestVerifiedAt:''});
    let revision;
    try{revision=await input.mutationEpoch.latestChangeAt(input.sourceRevision());}
    catch(error){input.capture('backup.freshness-epoch-read',error,'warn');return unknown();}
    const currentSave=Date.parse(String(revision||''));if(!Number.isFinite(currentSave))return unknown();
    let state;
    try{state=await read();}
    catch(error){input.capture('backup.freshness-receipt-read',error,'warn');return unknown();}
    const candidates=entries(state).filter(entry=>entry.verified!==false&&entry.format===input.backupVersion&&Date.parse(entry.sourceRevision)>=currentSave).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
    return freeze({ok:candidates.length>0,verifiedCopies:candidates.length,latestVerifiedAt:candidates[0]?.at||''});
  }
  return freeze({format:'study-director.verified-recovery-readiness' as const,contractVersion:1 as const,state:()=>current,verified,entries,lastBackupTime,read,record,verifyFreshCurrentBackup,reconcileChangeClock,reconcileStartupChangeClock,install});
}

function createAutomaticBackupPolicy(input:Readonly<AutomaticBackupPolicyInput>):Readonly<AutomaticBackupPolicy>{
  exactObject(input,['verified','currentRevision','canonicalEmpty'],'Automatic backup policy input');
  return freeze({
    covered:(id:string)=>input.verified.verified(String(id||''))?.sourceRevision||'',
    current:()=>input.currentRevision(),
    ready:async()=>{const empty=await input.canonicalEmpty();return empty===null?null:!empty;}
  });
}

function createBackupNudge(input:Readonly<BackupNudgeInput>):Readonly<BackupNudgeController>{
  exactObject(input,['verified','storageHealth','dueMs','checkMs','canMutate','now','automaticActive','dailySummaryCount','todayIso','publishMessage','notify','capture'],'Backup nudge input');
  let message='',checkedAt=0,notifiedDate='';
  async function run(force:boolean=false){
    if(!input.canMutate())return false;
    const now=input.now();if(!force&&now-checkedAt<input.checkMs)return false;checkedAt=now;
    let backups;
    try{backups=await input.verified.read();}
    catch(error){input.capture('backup.nudge-receipt-read',error,'warn');return false;}
    const entries=input.verified.entries(backups),last=input.verified.lastBackupTime(backups);
    const covered=Math.max(-Infinity,...entries.map(entry=>Date.parse(entry.sourceRevision)).filter(Number.isFinite));
    const changed=Date.parse(input.storageHealth.snapshot().lastLocalSaveAt||''),unbacked=!Number.isFinite(covered)||!Number.isFinite(changed)||changed>covered;
    const automatic=input.automaticActive();let due=!automatic&&unbacked&&Number.isFinite(last)&&now-last>=input.dueMs;
    if(!Number.isFinite(last)&&!automatic){
      try{due=(await input.dailySummaryCount())>=7;}catch{}
    }
    const drive=!!backups.providers['google-drive'];
    message=due?(drive?'Backup reminder: your changes have not reached Google Drive for over a week. Sign in again in Library → Data.':'Backup reminder: the last backup is over a week old. Open Library → Data.'):'';
    input.publishMessage(message);
    const date=input.todayIso();
    if(due&&notifiedDate!==date){
      notifiedDate=date;
      input.notify(drive?'Sign in to Google Drive':'Back up Study Director',drive?'Your changes have not been backed up for at least seven days.':'It has been at least seven days since the last backup.',`sdm-backup-${date}`);
    }
    return due;
  }
  function reset(){message='';checkedAt=input.now();notifiedDate='';input.publishMessage('');return true;}
  return freeze({format:'study-director.backup-nudge' as const,contractVersion:1 as const,run,reset,message:()=>message,checkedAt:()=>checkedAt});
}

const createModule=():BackupReadinessHostContract=>freeze({format:'study-director.backup-readiness-host-module',contractVersion:1,createStorageHealth,createCanonicalCommit,normalizeVerifiedRecoveryState,createVerifiedRecovery,createAutomaticBackupPolicy,createBackupNudge});
registry.define('backup-readiness-host',1,createModule);
return createModule;
})();
export type BackupReadinessHostModule=ReturnType<typeof sdBackupReadinessHostFactory>;
