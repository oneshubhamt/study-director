import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {BackupReadinessHostContract,CanonicalCommitController,CanonicalCommitEvent,CanonicalCommitInput,StorageHealthController,StorageHealthHistory,StorageHealthInput,StorageHealthPatch,StorageHealthState} from '../../types/backup-readiness-host.ts';

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

const createModule=():BackupReadinessHostContract=>freeze({format:'study-director.backup-readiness-host-module',contractVersion:1,createStorageHealth,createCanonicalCommit});
registry.define('backup-readiness-host',1,createModule);
return createModule;
})();
export type BackupReadinessHostModule=ReturnType<typeof sdBackupReadinessHostFactory>;
