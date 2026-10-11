(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,declaredFunctions:requireFunctions}=registry.contracts;
registry.define('managed-repository',1,()=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    configuration:freeze(['backupVersion','limits','logicalCaptureFormat','logicalCaptureVersion']),
    persistence:freeze(['reconciliationBaseRead','reconciliationBaseWrite']),
    assets:freeze(['get','verifyAliases']),
    files:freeze(['protect','unprotect','run','scope']),
    checkpoint:freeze(['capture','beginPreparation','readPreparationUnits','finalizePreparation','establishPreparationBaseline','assertCurrent','inspectVerifiedCapture','verifyVerifiedCapture','currentImportSignal']),
    domain:freeze(['clampText']),
    environment:freeze(['throwIfAborted','yieldTask']),
    diagnostics:freeze(['capture'])
  });
  function createEngine(input){
    exactObject(input,['codec','ports'],'Managed repository input');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Managed repository ports');
    for(const [name,fields] of Object.entries(PORT_FIELDS))exactObject(ports[name],fields,'Managed repository '+name+' port');
    for(const name of ['persistence','assets','files','checkpoint','domain','environment','diagnostics'])requireFunctions(ports[name],PORT_FIELDS[name],'Managed repository '+name+' port');
    const BackupCodec=input.codec;
    if(!BackupCodec||!Object.isFrozen(BackupCodec))throw new TypeError('Managed repository backup codec is invalid.');
    requireFunctions(BackupCodec,['countShape','utf8Bytes','compressionSupported','assetIds','legacyAreaNoteKey'],'Managed repository backup codec');
    if(!Object.isFrozen(ports.configuration.limits))throw new TypeError('Managed repository limits must be frozen.');
    const APP_LIMITS=ports.configuration.limits,backupVersion=ports.configuration.backupVersion;
    const LOGICAL_CHECKPOINT_CAPTURE_FORMAT=ports.configuration.logicalCaptureFormat,LOGICAL_CHECKPOINT_CAPTURE_VERSION=ports.configuration.logicalCaptureVersion;
    const AppData=freeze({reconciliationBase:freeze({read:ports.persistence.reconciliationBaseRead,write:ports.persistence.reconciliationBaseWrite})});
    const AssetData=freeze({get:ports.assets.get,verifyAliases:ports.assets.verifyAliases});
    const Exports=ports.files;
    const captureLogicalCheckpoint=ports.checkpoint.capture,beginPreparationCapture=ports.checkpoint.beginPreparation,readPreparationUnits=ports.checkpoint.readPreparationUnits,finalizePreparationCapture=ports.checkpoint.finalizePreparation,establishPreparationBaseline=ports.checkpoint.establishPreparationBaseline,assertLogicalCheckpointCurrent=ports.checkpoint.assertCurrent,inspectVerifiedCapture=ports.checkpoint.inspectVerifiedCapture,verifyVerifiedCapture=ports.checkpoint.verifyVerifiedCapture,currentImportSignal=ports.checkpoint.currentImportSignal;
    const clampText=ports.domain.clampText,throwIfImportAborted=ports.environment.throwIfAborted,yieldTask=ports.environment.yieldTask;
    const AppDiagnostics=freeze({capture:ports.diagnostics.capture});
    const REPOSITORY_RETENTION_POLICY=freeze({
      format:'study-director.repository-retention-policy',version:1,normalLimit:15,dailyDays:6,weeklyPeriods:4,monthlyPeriods:4,protectedLimit:1,beforeRestoreProtectionMs:7*24*60*60*1000,weekStartsOn:1,calendar:'local-at-capture'
    });
    const REPOSITORY_RECONCILIATION_ANCESTRY_MAX_BYTES=Math.max(8192,Math.floor((Number(APP_LIMITS.backupMaxEntryBytes)||2097152)/8));
    function validateRepositoryRetentionPolicy(value){
      const keys=Object.keys(REPOSITORY_RETENTION_POLICY);
      if(!value||typeof value!=='object'||Array.isArray(value)||keys.some(key=>value[key]!==REPOSITORY_RETENTION_POLICY[key])||Object.keys(value).some(key=>!keys.includes(key)))throw new TypeError('Managed repository retention policy is invalid or unsupported.');
      return value;
    }
    validateRepositoryRetentionPolicy(REPOSITORY_RETENTION_POLICY);
// Manifest 6 keys notes by permanent id; earlier manifests keyed them by name.
const REPOSITORY_MANIFEST_FORMAT='study-director.backup-repository-checkpoint',REPOSITORY_MANIFEST_VERSION=6,REPOSITORY_NOTE_ID_MANIFEST_VERSION=6,REPOSITORY_SUPPORTED_MANIFEST_VERSIONS=freeze(new Set([1,2,3,4,5,6]));
const LEGACY_REFLECTION_DRAFT_PACK_KIND='reflectionDraftPack';
const REPOSITORY_COMMIT_FORMAT='study-director.backup-repository-commit',REPOSITORY_COMMIT_VERSION=1,REPOSITORY_COMMIT_REQUIRED_MANIFEST_VERSION=2;
const REPOSITORY_OBJECT_FORMAT='study-director.backup-repository-object',REPOSITORY_OBJECT_VERSION=1;
const REPOSITORY_PACK_FORMAT='study-director.backup-repository-structured-pack',REPOSITORY_PACK_VERSION=1,REPOSITORY_PACK_SHARDS=4,REPOSITORY_PACK_MEMBER_MAX_BYTES=64*1024;
const REPOSITORY_PACKABLE_KINDS=freeze(new Set(['areaNote','personalData']));
const repositoryPreparedState=new WeakMap();
const repositoryPublicationStates=new Map();
const REPOSITORY_PREPARATION_INDEX_VERSION=2;
const REPOSITORY_OBJECT_IO_CONCURRENCY=8;
const REPOSITORY_LARGE_OBJECT_BYTES=8*1024*1024;
let repositoryPreparationIndex=null;
async function mapRepositoryBounded(values,worker,limit=REPOSITORY_OBJECT_IO_CONCURRENCY){
  const rows=Array.isArray(values)?values:[],results=new Array(rows.length),concurrency=Math.max(1,Math.min(REPOSITORY_OBJECT_IO_CONCURRENCY,Math.floor(Number(limit)||1)));let next=0,failure=null;
  async function run(){for(;;){if(failure)return;const index=next++;if(index>=rows.length)return;try{results[index]=await worker(rows[index],index);}catch(error){if(!failure)failure=error;}}}
  await Promise.all(Array.from({length:Math.min(concurrency,rows.length)},run));if(failure)throw failure;return results;
}
function repositoryPublicationConcurrency(entries){return (entries||[]).some(entry=>Number(entry&&entry.storedBytes)>REPOSITORY_LARGE_OBJECT_BYTES)?2:REPOSITORY_OBJECT_IO_CONCURRENCY;}
function repositoryObjectId(){return 'obj_'+globalThis.crypto.randomUUID().replace(/-/gu,'');}
function repositoryUnitKey(kind,key){return String(kind)+'\u0000'+String(key);}
function repositoryPackShard(kind,key){
  const bytes=BackupCodec.utf8Bytes(repositoryUnitKey(kind,key));let hash=2166136261;
  for(const byte of bytes){hash^=byte;hash=Math.imul(hash,16777619)>>>0;}
  return hash%REPOSITORY_PACK_SHARDS;
}
function repositoryPackKey(shard){const value=Number(shard);if(!Number.isInteger(value)||value<0||value>=REPOSITORY_PACK_SHARDS)throw new Error('Repository structured-pack shard is invalid.');return `shard:${value}`;}
function repositoryPackableEntry(entry){return !!(entry&&entry.present&&REPOSITORY_PACKABLE_KINDS.has(String(entry.kind))&&Number(entry.sourceBytes)>0&&Number(entry.sourceBytes)<=REPOSITORY_PACK_MEMBER_MAX_BYTES);}
function repositoryPackMembersKey(members){return (members||[]).map(member=>`${member.kind}\u0000${member.key}\u0000${member.fingerprint}\u0000${member.sourceBytes}`).join('\u0001');}
function repositoryPackManifestMembers(value){
  const rows=Array.isArray(value)?value:[],seen=new Set(),out=[];
  for(const raw of rows){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Repository structured-pack member is invalid.');
    const kind=String(raw.kind||''),key=String(raw.key||''),fingerprint=String(raw.fingerprint||'').toLowerCase(),sourceBytes=Number(raw.sourceBytes),unit=repositoryUnitKey(kind,key);
    if(!REPOSITORY_PACKABLE_KINDS.has(kind)||!key||!/^[a-f0-9]{64}$/u.test(fingerprint)||!Number.isSafeInteger(sourceBytes)||sourceBytes<=0||sourceBytes>REPOSITORY_PACK_MEMBER_MAX_BYTES||seen.has(unit))throw new Error('Repository structured-pack member is malformed.');
    seen.add(unit);out.push(freeze({kind,key,fingerprint,sourceBytes}));
  }
  out.sort((a,b)=>a.kind.localeCompare(b.kind)||a.key.localeCompare(b.key));if(!out.length)throw new Error('Repository structured-pack contains no members.');return freeze(out);
}
function repositoryPreparationUnit(kind,key){
  if(kind==='dailyRecordPack')return `dailyRecordPack:${String(key)}`;
  if(kind==='areaNote')return `areaNote:${String(key)}`;
  if(kind==='personalData'&&String(key)==='personal')return 'personalData';
  if(kind==='activeSession'&&String(key)==='active')return 'activeSession';
  throw new Error('Repository structured preparation unit is invalid.');
}
function repositoryPreparationDescriptor(unit){
  const value=String(unit||'');
  if(/^dailyRecordPack:\d{4}-(?:0[1-9]|1[0-2])$/u.test(value))return freeze({unit:value,kind:'dailyRecordPack',key:value.slice('dailyRecordPack:'.length)});
  if(value.startsWith('areaNote:')&&value.length>'areaNote:'.length)return freeze({unit:value,kind:'areaNote',key:value.slice('areaNote:'.length)});
  if(value==='personalData')return freeze({unit:value,kind:'personalData',key:'personal'});
  if(value==='activeSession')return freeze({unit:value,kind:'activeSession',key:'active'});
  return null;
}
function repositoryPreparationStampMap(rows){const map=new Map();for(const row of rows||[]){const unit=String(row&&row.unit||''),token=String(row&&row.token||'');if(!unit||!token||map.has(unit))return null;map.set(unit,token);}return map;}
function repositoryPreparationEntry(kind,key,payload,fingerprint='',sourceBytes=0,{present=true}={}){
  const unit=repositoryPreparationUnit(kind,key),members=kind==='dailyRecordPack'?freeze((payload||[]).map(item=>String(item&&item.date||'')).filter(Boolean).sort()):freeze([]),assetIds=present?BackupCodec.assetIds(payload):freeze([]);
  return freeze({unit,kind,key:String(key),present:present===true,fingerprint:present?String(fingerprint||''):'',sourceBytes:present?Math.max(0,Number(sourceBytes)||0):0,members,assetIds});
}
function repositoryPreparationEntryMap(index){const map=new Map();for(const entry of index&&index.entries||[])map.set(String(entry.unit),entry);return map;}
async function repositoryPreparationPlan(preparation,reconciliationBase){
  const index=repositoryPreparationIndex;if(!index||Number(index.version)!==REPOSITORY_PREPARATION_INDEX_VERSION)return null;
  if(String(index.checkpointId||'')!==String(reconciliationBase&&reconciliationBase.checkpointId||''))return null;
  const current=repositoryPreparationStampMap(preparation&&preparation.stamps),previous=repositoryPreparationStampMap(index.stamps);if(!current||!previous||current.has('*'))return null;
  for(const unit of current.keys())if(!repositoryPreparationDescriptor(unit)&&!/^attachmentAsset:(?:att|img)-[a-z0-9-]{20,80}$/u.test(unit))return null;
  for(const unit of previous.keys())if(!current.has(unit))return null;
  const changed=[];for(const [unit,token] of current)if(previous.get(unit)!==token)changed.push(unit);
  if(String(index.epochToken||'')===String(preparation&&preparation.epochToken||'')){if(changed.length||current.size!==previous.size)return null;}
  else if(!changed.length)return null;
  const entries=repositoryPreparationEntryMap(index),structuredChanged=changed.filter(unit=>!!repositoryPreparationDescriptor(unit));
  if(!reconciliationBase||Number(reconciliationBase.noteCount)!==Number(index.noteCount)||String(reconciliationBase.noteKeyFingerprint||'')!==String(index.noteKeyFingerprint||''))return null;
  return freeze({index,entries,currentStamps:current,changed:freeze(changed),structuredChanged:freeze(structuredChanged)});
}
async function repositoryNoteSetIdentity(entries){
  const noteKeys=[...entries.values()].filter(entry=>entry&&entry.present&&entry.kind==='areaNote').map(entry=>String(entry.key)).sort(),noteKeyFingerprint=await Exports.run('checksum',{value:JSON.stringify(noteKeys),algorithm:'sha256'});
  return freeze({noteKeys:freeze(noteKeys),noteCount:noteKeys.length,noteKeyFingerprint:String(noteKeyFingerprint||'')});
}
async function repositoryPreparationIndexCandidate(epochToken,stamps,entries){
  const rows=[...entries.values()].sort((a,b)=>a.unit.localeCompare(b.unit));
  const maxUnits=Math.max(1024,Number(APP_LIMITS.maxImportRecords||10000)+Number(APP_LIMITS.maxOngoingNotes||1000)+16);if(rows.length>maxUnits)return null;
  const noteSet=await repositoryNoteSetIdentity(entries);
  return freeze({version:REPOSITORY_PREPARATION_INDEX_VERSION,epochToken:String(epochToken||''),checkpointId:'',noteCount:noteSet.noteCount,noteKeyFingerprint:noteSet.noteKeyFingerprint,stamps:freeze([...(stamps||[])]),entries:freeze(rows)});
}
function repositoryPreparationCounts(entries){
  let dailyRecord=0,areaNote=0,activeSession=0,personalData=0;
  for(const entry of entries.values())if(entry&&entry.present){if(entry.kind==='dailyRecordPack')dailyRecord+=entry.members.length;else if(entry.kind==='areaNote')areaNote+=1;else if(entry.kind==='activeSession')activeSession=1;else if(entry.kind==='personalData')personalData=1;}
  return BackupCodec.countShape({checkpointManifest:1,personalData,dailyRecord,areaNote,activeSession});
}
function repositoryPreparationInventory(entries){
  const recordDates=[],noteKeys=[],assetIds=new Set();
  for(const entry of entries.values())if(entry&&entry.present){if(entry.kind==='dailyRecordPack')recordDates.push(...entry.members);else if(entry.kind==='areaNote')noteKeys.push(entry.key);for(const id of entry.assetIds||[])assetIds.add(String(id));}
  recordDates.sort();noteKeys.sort();return freeze({recordDates:freeze(recordDates),noteKeys:freeze(noteKeys),assetIds:freeze([...assetIds].sort()),counts:repositoryPreparationCounts(entries)});
}
function repositoryMonth(value){const match=/^(\d{4}-\d{2})-\d{2}$/u.exec(String(value||''));if(!match)throw new Error('Repository record date is invalid.');return match[1];}
function repositoryManifestCounts(value,manifestVersion){
  const current=BackupCodec.countShape(value||{});
  if(Number(manifestVersion)>=5)return freeze({...current});
  const raw=Number(value&&value.reflectionDraft||0),reflectionDraft=Number.isSafeInteger(raw)&&raw>=0&&raw<=Math.max(1,Number(APP_LIMITS.maxImportRecords)||10000)?raw:0;
  return freeze({dailyRecord:Number(current.dailyRecord||0),areaNote:Number(current.areaNote||0),activeSession:Number(current.activeSession||0),reflectionDraft,personalData:Number(current.personalData||0),checkpointManifest:Number(current.checkpointManifest||0)});
}
function repositoryCountsEqualForManifest(actual,expected,manifestVersion){
  const a=repositoryManifestCounts(actual,manifestVersion),b=repositoryManifestCounts(expected,manifestVersion);
  return Object.keys(a).every(key=>Number(a[key]||0)===Number(b[key]||0));
}
function repositoryManifestObject(entry){
  const base={
    objectId:String(entry.objectId),kind:String(entry.kind),key:String(entry.key),fingerprint:String(entry.fingerprint),
    compression:entry.compression==='gzip'?'gzip':'none',sourceBytes:Number(entry.sourceBytes)||0,storedBytes:Number(entry.storedBytes)||0,
    storedChecksum:String(entry.storedChecksum||'')
  };
  if(entry.kind==='structuredPack')base.members=repositoryPackManifestMembers(entry.members);
  return freeze(base);
}
function repositoryLogicalObjectRows(manifest){
  const out=[];
  for(const entry of Array.isArray(manifest&&manifest.objects)?manifest.objects:[]){
    const kind=String(entry&&entry.kind||'');
    if(kind==='reflectionDraftPack')continue; // Legacy-only data intentionally retired from the current canonical state.
    if(kind==='structuredPack'){for(const member of repositoryPackManifestMembers(entry.members))out.push(freeze({...member}));}
    else out.push(freeze({kind,key:String(entry&&entry.key||''),fingerprint:String(entry&&entry.fingerprint||''),sourceBytes:Number(entry&&entry.sourceBytes)||0}));
  }
  return freeze(out.sort((a,b)=>a.kind.localeCompare(b.kind)||a.key.localeCompare(b.key)||a.fingerprint.localeCompare(b.fingerprint)||a.sourceBytes-b.sourceBytes));
}
function repositoryLogicalIdentityPayload(value){
  const manifest=value&&typeof value==='object'?value:{};
  const objects=repositoryLogicalObjectRows(manifest);
  const assets=(Array.isArray(manifest.assets)?manifest.assets:[]).map(entry=>entry&&entry.missing===true?freeze({assetId:String(entry.assetId||''),missing:true}):freeze({assetId:String(entry&&entry.assetId||''),mimeType:String(entry&&entry.mimeType||''),size:Number(entry&&entry.size)||0,checksum:String(entry&&entry.checksum||''),name:String(entry&&entry.name||''),library:entry&&entry.library===true})).sort((a,b)=>a.assetId.localeCompare(b.assetId));
  const protectedManifest=manifest.protectedCheckpointManifest&&typeof manifest.protectedCheckpointManifest==='object'?manifest.protectedCheckpointManifest:{};
  const savedDayDeletions=(Array.isArray(protectedManifest.savedDayDeletions)?protectedManifest.savedDayDeletions:[]).map(entry=>freeze({date:String(entry&&entry.date||''),deletedAt:String(entry&&entry.deletedAt||'')})).sort((a,b)=>a.date.localeCompare(b.date)||a.deletedAt.localeCompare(b.deletedAt));
  const areaNoteDeletions=(Array.isArray(protectedManifest.areaNoteDeletions)?protectedManifest.areaNoteDeletions:[]).map(entry=>freeze({key:String(entry&&entry.key||''),deletedAt:String(entry&&entry.deletedAt||'')})).sort((a,b)=>a.key.localeCompare(b.key)||a.deletedAt.localeCompare(b.deletedAt));
  const attachmentDeletions=(Array.isArray(protectedManifest.attachmentDeletions)?protectedManifest.attachmentDeletions:[]).map(entry=>freeze({assetId:String(entry&&entry.assetId||''),deletedAt:String(entry&&entry.deletedAt||'')})).sort((a,b)=>a.assetId.localeCompare(b.assetId)||a.deletedAt.localeCompare(b.deletedAt));
  // Logical identity is defined by the current portable canonical domains. Legacy-only
  // Reflection Draft counts are verified when reading old manifests but are deliberately
  // excluded here because L16F discards that retired domain during compatibility migration.
  const counts=BackupCodec.countShape(manifest.counts||{});
  return freeze({format:'study-director.managed-backup-logical-state',version:1,counts:freeze({...counts}),objects:freeze(objects),assets:freeze(assets),deletions:freeze({savedDays:freeze(savedDayDeletions),areaNotes:freeze(areaNoteDeletions),attachments:freeze(attachmentDeletions)})});
}
async function repositoryLogicalFingerprint(value){
  const payload=repositoryLogicalIdentityPayload(value),serialized=await Exports.run('stringify',{value:payload});
  return Exports.run('checksum',{value:serialized,algorithm:'sha256'});
}

function repositoryPad2(value){return String(value).padStart(2,'0');}
function repositoryLocalDateKey(value){const date=value instanceof Date?value:new Date(value);if(!Number.isFinite(date.getTime()))throw new Error('Repository retention calendar date is invalid.');return `${date.getFullYear()}-${repositoryPad2(date.getMonth()+1)}-${repositoryPad2(date.getDate())}`;}
function repositoryLocalWeekStartKey(value){const date=value instanceof Date?new Date(value.getTime()):new Date(value);if(!Number.isFinite(date.getTime()))throw new Error('Repository retention calendar date is invalid.');date.setHours(12,0,0,0);const day=date.getDay(),delta=(day-REPOSITORY_RETENTION_POLICY.weekStartsOn+7)%7;date.setDate(date.getDate()-delta);return repositoryLocalDateKey(date);}
function repositoryRetentionCalendar(value){const date=value instanceof Date?new Date(value.getTime()):new Date(value);if(!Number.isFinite(date.getTime()))throw new Error('Repository retention calendar date is invalid.');const localDate=repositoryLocalDateKey(date);return freeze({localDate,weekStart:repositoryLocalWeekStartKey(date),month:localDate.slice(0,7),utcOffsetMinutes:-date.getTimezoneOffset()});}
function repositoryUtcDateKey(value){const date=value instanceof Date?new Date(value.getTime()):new Date(value);if(!Number.isFinite(date.getTime()))throw new Error('Repository retention calendar date is invalid.');return `${date.getUTCFullYear()}-${repositoryPad2(date.getUTCMonth()+1)}-${repositoryPad2(date.getUTCDate())}`;}
function repositoryOffsetDateKey(value,offsetMinutes){const date=value instanceof Date?new Date(value.getTime()):new Date(value),offset=Number(offsetMinutes);if(!Number.isFinite(date.getTime())||!Number.isInteger(offset)||Math.abs(offset)>14*60)throw new Error('Repository retention calendar offset is invalid.');return repositoryUtcDateKey(new Date(date.getTime()+offset*60000));}
function repositoryLegacyRetentionDescriptor(exportedAt){const date=new Date(exportedAt);if(!Number.isFinite(date.getTime()))throw new Error('Repository retention calendar date is invalid.');const localDate=repositoryUtcDateKey(date),localOrdinal=repositoryDateOrdinal(localDate),weekStart=repositoryDateKeyFromOrdinal(repositoryWeekStartOrdinal(localOrdinal));return freeze({format:'study-director.repository-retention',version:1,role:'normal',protectedUntil:'',calendar:freeze({localDate,weekStart,month:localDate.slice(0,7),utcOffsetMinutes:0})});}
function canonicalRepositorySafetyPurpose(value,{legacy=false}={}){
  const purpose=String(value||'before-restore');
  if(legacy&&purpose==='before-clear-archive')return 'before-clear-library';
  return ['before-restore','before-combine','before-clear-library'].includes(purpose)?purpose:'';
}
function repositoryRetentionDescriptor(exportedAt,input=null){
  // `role` is a stable wire field; `purpose` identifies the current safety operation.
  const role=input&&input.role==='before-restore'?'before-restore':'normal',calendar=repositoryRetentionCalendar(exportedAt);let protectedUntil='',purpose='';
  if(role==='before-restore'){
    const requested=String(input&&input.protectedUntil||''),parsed=Date.parse(requested),minimum=Date.parse(exportedAt);
    protectedUntil=Number.isFinite(parsed)&&parsed>minimum?new Date(parsed).toISOString():new Date(minimum+REPOSITORY_RETENTION_POLICY.beforeRestoreProtectionMs).toISOString();
    purpose=canonicalRepositorySafetyPurpose(input&&input.purpose)||'before-restore';
  }
  return freeze({format:'study-director.repository-retention',version:1,role,protectedUntil,purpose,calendar});
}
function repositoryDateOrdinal(key){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/u.exec(String(key||''));if(!match)return NaN;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),date=new Date(Date.UTC(year,month-1,day));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return NaN;
  return Math.floor(date.getTime()/86400000);
}
function validateRepositoryRetention(value,exportedAt,{legacy=false}={}){
  if(legacy)return repositoryLegacyRetentionDescriptor(exportedAt);
  if(!value||typeof value!=='object'||Array.isArray(value)||value.format!=='study-director.repository-retention'||Number(value.version)!==1)throw new Error('Device repository retention metadata is invalid.');
  const role=value.role==='before-restore'?'before-restore':value.role==='normal'?'normal':'';if(!role)throw new Error('Device repository retention role is invalid.');
  const exportedAtMs=Date.parse(exportedAt),protectedUntil=String(value.protectedUntil||''),protectedUntilMs=Date.parse(protectedUntil),rawPurpose=String(value.purpose||'');
  const purpose=role==='before-restore'?canonicalRepositorySafetyPurpose(rawPurpose||'before-restore',{legacy:true}):'';
  if(role==='before-restore'&&(!Number.isFinite(protectedUntilMs)||!Number.isFinite(exportedAtMs)||protectedUntilMs<=exportedAtMs))throw new Error('Device repository protection expiry is invalid.');
  if(role==='before-restore'&&!purpose)throw new Error('Device repository safety purpose is invalid.');
  if(role==='normal'&&(protectedUntil||rawPurpose))throw new Error('Normal repository checkpoints cannot carry safety metadata.');
  const calendar=value.calendar,localDate=String(calendar&&calendar.localDate||''),weekStart=String(calendar&&calendar.weekStart||''),month=String(calendar&&calendar.month||''),offset=Number(calendar&&calendar.utcOffsetMinutes),localOrdinal=repositoryDateOrdinal(localDate),weekOrdinal=repositoryDateOrdinal(weekStart);
  if(!calendar||typeof calendar!=='object'||Array.isArray(calendar)||!Number.isFinite(localOrdinal)||!Number.isFinite(weekOrdinal)||!/^(?:\d{4})-(?:0[1-9]|1[0-2])$/u.test(month)||month!==localDate.slice(0,7)||!Number.isInteger(offset)||Math.abs(offset)>14*60||repositoryOffsetDateKey(exportedAt,offset)!==localDate||weekOrdinal>localOrdinal||localOrdinal-weekOrdinal>6||new Date(weekOrdinal*86400000).getUTCDay()!==REPOSITORY_RETENTION_POLICY.weekStartsOn)throw new Error('Device repository retention calendar is invalid.');
  return freeze({format:'study-director.repository-retention',version:1,role,protectedUntil:role==='before-restore'?new Date(protectedUntilMs).toISOString():'',purpose,calendar:freeze({localDate,weekStart,month,utcOffsetMinutes:offset})});
}
function repositoryDateKeyFromOrdinal(value){const date=new Date(Number(value)*86400000);return `${date.getUTCFullYear()}-${repositoryPad2(date.getUTCMonth()+1)}-${repositoryPad2(date.getUTCDate())}`;}
function repositoryWeekStartOrdinal(value){const date=new Date(Number(value)*86400000),day=date.getUTCDay(),delta=(day-REPOSITORY_RETENTION_POLICY.weekStartsOn+7)%7;return Number(value)-delta;}
function newestRepositoryRow(rows){return rows.reduce((best,row)=>!best||Date.parse(row.manifest.exportedAt)>Date.parse(best.manifest.exportedAt)||Date.parse(row.manifest.exportedAt)===Date.parse(best.manifest.exportedAt)&&String(row.id).localeCompare(String(best.id))>0?row:best,null);}
function activeProtectedRepositoryRow(rowsValue,now=Date.now()){
  const rows=Array.isArray(rowsValue)?rowsValue:[],nowMs=now instanceof Date?now.getTime():Number(now);
  if(!Number.isFinite(nowMs))throw new Error('Repository protection evaluation time is invalid.');
  return newestRepositoryRow(rows.filter(row=>row&&row.manifest?.retention?.role==='before-restore'&&Date.parse(row.manifest.retention.protectedUntil)>nowMs));
}
function classifyRepositoryState(input={}){
  const manifests=Array.isArray(input.manifests)?input.manifests:[],commits=Array.isArray(input.commits)?input.commits:[],commitById=new Map(),manifestIds=new Set(),committed=[],uncommitted=[],invalidPairs=[];
  for(const row of commits){const id=String(row&&row.id||'');if(!/^cp_[a-f0-9]{32}$/u.test(id)||commitById.has(id))throw new Error('Managed repository commit classification input is invalid.');commitById.set(id,row);}
  for(const row of manifests){const id=String(row&&row.id||''),manifest=row&&row.manifest;if(!/^cp_[a-f0-9]{32}$/u.test(id)||manifestIds.has(id)||!manifest||manifest.checkpoint?.checkpointId!==id)throw new Error('Managed repository checkpoint classification input is invalid.');manifestIds.add(id);const commit=commitById.get(id)||null;
    if(Number(manifest.version)>=REPOSITORY_COMMIT_REQUIRED_MANIFEST_VERSION&&!commit){uncommitted.push(row);continue;}
    if(commit){try{validateRepositoryCommitValue(commit.marker,manifest);}catch(error){invalidPairs.push(freeze({manifest:row,commit,error}));continue;}}
    committed.push(freeze({...row,commitRef:commit&&commit.ref||null}));
  }
  const sorter=(a,b)=>Date.parse(a.manifest.exportedAt)-Date.parse(b.manifest.exportedAt)||String(a.id).localeCompare(String(b.id));committed.sort(sorter);uncommitted.sort(sorter);
  const orphanCommits=commits.filter(row=>!manifestIds.has(String(row.id||'')));
  return freeze({committed:freeze(committed),uncommitted:freeze(uncommitted),invalidPairs:freeze(invalidPairs),orphanCommits:freeze(orphanCommits),latest:committed.length?committed[committed.length-1]:null});
}
function selectRepositoryRetention(rowsValue,{now=new Date()}={}){
  const rows=Array.isArray(rowsValue)?[...rowsValue]:[];rows.sort((a,b)=>Date.parse(a.manifest?.exportedAt||0)-Date.parse(b.manifest?.exportedAt||0)||String(a.id||'').localeCompare(String(b.id||'')));
  const nowMs=now instanceof Date?now.getTime():Date.parse(now);if(!Number.isFinite(nowMs))throw new Error('Repository retention evaluation time is invalid.');
  const activeProtected=activeProtectedRepositoryRow(rows,nowMs),normalRows=rows.filter(row=>row&&row.manifest?.retention?.role==='normal');
  const selected=new Map(),tiers=new Map();
  const keep=(row,tier)=>{if(!row)return;selected.set(row.id,row);if(!tiers.has(row.id))tiers.set(row.id,tier);};
  const latest=newestRepositoryRow(normalRows);keep(latest,'latest');
  if(latest){
    // Each tier keeps the newest checkpoint from its most recent periods that
    // have one, counting only periods wholly older than the one holding the
    // oldest checkpoint kept so far: no Weekly shares a week with a Daily and
    // no Monthly a month with a Weekly. Periods without a checkpoint are
    // skipped, so a break of any length never empties a tier.
    const calendar=row=>row.manifest.retention.calendar,policy=REPOSITORY_RETENTION_POLICY;
    let oldest=latest;
    for(const [tier,count,period] of [['daily',policy.dailyDays,value=>value.localDate],['weekly',policy.weeklyPeriods,value=>value.weekStart],['monthly',policy.monthlyPeriods,value=>value.month]]){
      const limit=period(calendar(oldest)),newest=new Map();
      // Dates, weeks and months are zero-padded, so text order is time order.
      for(const row of normalRows){const key=period(calendar(row));if(key<limit)newest.set(key,newest.has(key)?newestRepositoryRow([newest.get(key),row]):row);}
      const kept=[...newest.keys()].sort().reverse().slice(0,count);
      if(!kept.length)break;
      for(const key of kept)keep(newest.get(key),tier);
      oldest=newest.get(kept.at(-1));
    }
    // Slots the tiers cannot use (a young history, a long break) go to the
    // newest checkpoint of the remaining days, closing the widest gaps in time
    // first and the newer on a tie. A day's older checkpoints still give way
    // to its newest, but no day is dropped while a slot is free.
    const time=row=>Date.parse(row.manifest.exportedAt),days=new Map(),covered=new Set([...selected.values()].map(row=>calendar(row).localDate));
    for(const row of normalRows){const day=calendar(row).localDate;if(!covered.has(day))days.set(day,days.has(day)?newestRepositoryRow([days.get(day),row]):row);}
    const spare=[...days.values()];
    while(selected.size<policy.normalLimit&&spare.length){
      let pick=0,widest=-1;
      spare.forEach((row,index)=>{let gap=Infinity;for(const kept of selected.values())gap=Math.min(gap,Math.abs(time(row)-time(kept)));if(gap>widest||gap===widest&&newestRepositoryRow([spare[pick],row])===row){pick=index;widest=gap;}});
      keep(spare.splice(pick,1)[0],'saved');
    }
  }
  if(activeProtected)keep(activeProtected,'before-restore');
  const retained=rows.filter(row=>selected.has(row.id)),remove=rows.filter(row=>!selected.has(row.id));
  return freeze({retained:freeze(retained),remove:freeze(remove),activeProtected:activeProtected||null,tiers:freeze(Object.fromEntries(tiers)),normalRetained:retained.filter(row=>row!==activeProtected).length,policy:REPOSITORY_RETENTION_POLICY});
}
function projectManagedRepositoryHistory(rowsValue,source,{now=new Date(),quarantinedObjectIds=null}={}){
  const rows=Array.isArray(rowsValue)?rowsValue:[],sourceId=String(source&&source.id||''),sourceLabel=clampText(source&&source.label||'',80),quarantined=new Set(repositoryScrubObjectIds(quarantinedObjectIds));
  if(!sourceId||!sourceLabel)throw new TypeError('Managed Version History source is invalid.');
  const normalized=rows.map(row=>{
    const id=String(row&&row.id||row&&row.manifest&&row.manifest.checkpoint&&row.manifest.checkpoint.checkpointId||''),manifest=row&&row.manifest;
    if(!/^cp_[a-f0-9]{32}$/u.test(id)||!manifest||manifest.checkpoint.checkpointId!==id||!/^[a-f0-9]{64}$/u.test(String(manifest.logicalFingerprint||'')))throw new Error('Managed Version History contains an invalid committed checkpoint.');
    return freeze({id,manifest});
  }).filter(row=>!row.manifest.objects.some(entry=>quarantined.has(entry.objectId)));
  const selection=selectRepositoryRetention(normalized,{now}),tiers=selection.tiers;
  return freeze([...selection.retained].sort((a,b)=>Date.parse(b.manifest.exportedAt)-Date.parse(a.manifest.exportedAt)||b.id.localeCompare(a.id)).map(row=>{
    const manifest=row.manifest,tier=String(tiers[row.id]||'saved');
    return freeze({
      logicalId:'state_'+manifest.logicalFingerprint,logicalFingerprint:manifest.logicalFingerprint,exportedAt:manifest.exportedAt,counts:manifest.counts,
      location:freeze({sourceId,sourceLabel,checkpointId:row.id,exportedAt:manifest.exportedAt,tier,encrypted:manifest.encrypted===true,safetyPurpose:tier==='before-restore'?String(manifest.retention&&manifest.retention.purpose||'before-restore'):'',health:manifest.warning?'degraded':'healthy',warning:String(manifest.warning||'')})
    });
  }));
}
function validateRepositoryCommitValue(value,manifest=null){
  if(!value||typeof value!=='object'||Array.isArray(value)||value.format!==REPOSITORY_COMMIT_FORMAT||Number(value.version)!==REPOSITORY_COMMIT_VERSION)throw new Error('Repository checkpoint commit marker is invalid.');
  const checkpointId=String(value.checkpointId||''),exportedAt=String(value.exportedAt||''),sourceRevision=String(value.sourceRevision||'');if(!/^cp_[a-f0-9]{32}$/u.test(checkpointId)||!Number.isFinite(Date.parse(exportedAt))||!Number.isFinite(Date.parse(sourceRevision)))throw new Error('Repository checkpoint commit marker provenance is invalid.');
  const normalized=freeze({format:REPOSITORY_COMMIT_FORMAT,version:REPOSITORY_COMMIT_VERSION,checkpointId,exportedAt:new Date(exportedAt).toISOString(),sourceRevision:new Date(sourceRevision).toISOString(),manifestVersion:Number(value.manifestVersion)||0});
  if(manifest&&(manifest.checkpoint.checkpointId!==normalized.checkpointId||manifest.exportedAt!==normalized.exportedAt||manifest.sourceRevision!==normalized.sourceRevision||Number(manifest.version)!==normalized.manifestVersion))throw new Error('Repository checkpoint commit marker does not match its manifest.');
  return normalized;
}
async function createRepositoryCommitMarker(manifest,checks={}){const value=validateRepositoryCommitValue({format:REPOSITORY_COMMIT_FORMAT,version:REPOSITORY_COMMIT_VERSION,checkpointId:manifest.checkpoint.checkpointId,exportedAt:manifest.exportedAt,sourceRevision:manifest.sourceRevision,manifestVersion:manifest.version},manifest),text=JSON.stringify(value),blob=new Blob([text],{type:'application/json'}),digest=await Exports.run('checksum',{value:blob},{signal:checks.signal||null});return freeze({...value,blob,size:blob.size,digest,checkProtection:checks.checkProtection,checkSource:checks.checkSource});}
async function inspectRepositoryCommitMarker(file,manifest=null){if(!(file instanceof Blob)||file.size<=0||file.size>4096)throw new Error('Repository checkpoint commit marker is unreadable.');let value;try{value=JSON.parse(await file.text());}catch{throw new Error('Repository checkpoint commit marker is invalid JSON.');}return validateRepositoryCommitValue(value,manifest);}

function validateRepositoryManifest(value){
  const manifestVersion=Number(value&&value.version);
  if(!value||typeof value!=='object'||Array.isArray(value)||value.format!==REPOSITORY_MANIFEST_FORMAT||!REPOSITORY_SUPPORTED_MANIFEST_VERSIONS.has(manifestVersion))throw new Error('Device repository checkpoint is invalid.');
  const checkpoint=value.checkpoint;
  if(!checkpoint||!/^cp_[a-f0-9]{32}$/u.test(String(checkpoint.checkpointId||''))||!Number.isFinite(Date.parse(String(checkpoint.createdAt||'')))||!String(checkpoint.originInstallationId||''))throw new Error('Device repository checkpoint provenance is invalid.');
  const exportedAt=String(value.exportedAt||''),sourceRevision=String(value.sourceRevision||'');
  if(!Number.isFinite(Date.parse(exportedAt))||checkpoint.createdAt!==exportedAt||!Number.isFinite(Date.parse(sourceRevision)))throw new Error('Device repository checkpoint timestamps are invalid.');
  const protectionId=String(value.protectionId||'');if(protectionId.length>128)throw new Error('Device repository protection identity is invalid.');
  const retention=validateRepositoryRetention(value.retention,exportedAt,{legacy:manifestVersion===1});
  if(!Array.isArray(value.objects)||!Array.isArray(value.assets))throw new Error('Device repository checkpoint object index is invalid.');
  const objectIds=new Set(),unitKeys=new Set(),logicalUnitKeys=new Set(),objects=[];
  for(const raw of value.objects){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Device repository object reference is invalid.');
    const objectId=String(raw.objectId||''),kind=String(raw.kind||''),key=String(raw.key||''),fingerprint=String(raw.fingerprint||'').toLowerCase(),storedChecksum=String(raw.storedChecksum||'').toLowerCase();
    const sourceBytes=Number(raw.sourceBytes),storedBytes=Number(raw.storedBytes),compression=raw.compression==='gzip'?'gzip':raw.compression==='none'?'none':'';
    if(!/^obj_[a-f0-9]{32}$/u.test(objectId)||!kind||!key||!/^[a-f0-9]{64}$/u.test(fingerprint)||!compression||!Number.isSafeInteger(sourceBytes)||sourceBytes<0||!Number.isSafeInteger(storedBytes)||storedBytes<=0||!/^[a-f0-9]{64}$/u.test(storedChecksum))throw new Error('Device repository object reference is malformed.');
    const unit=repositoryUnitKey(kind,key);if(objectIds.has(objectId)||unitKeys.has(unit))throw new Error('Device repository object index contains duplicates.');
    let members;
    if(kind==='structuredPack'){
      if(manifestVersion<4||!/^shard:[0-3]$/u.test(key))throw new Error('Device repository structured-pack reference is invalid.');
      members=repositoryPackManifestMembers(raw.members);const shard=Number(key.slice('shard:'.length));
      for(const member of members){const logicalUnit=repositoryUnitKey(member.kind,member.key);if(repositoryPackShard(member.kind,member.key)!==shard||logicalUnitKeys.has(logicalUnit))throw new Error('Device repository structured-pack membership is invalid.');logicalUnitKeys.add(logicalUnit);}
    }else if(kind!=='attachment'){const logicalUnit=repositoryUnitKey(kind,key);if(logicalUnitKeys.has(logicalUnit))throw new Error('Device repository logical object index contains duplicates.');logicalUnitKeys.add(logicalUnit);}
    objectIds.add(objectId);unitKeys.add(unit);objects.push(freeze({objectId,kind,key,fingerprint,compression,sourceBytes,storedBytes,storedChecksum,...(members?{members}:{})}));
  }
  const assets=[];
  for(const raw of value.assets){
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof raw.assetId!=='string'||!raw.assetId)throw new Error('Device repository attachment reference is invalid.');
    if(raw.missing===true){assets.push(freeze({assetId:raw.assetId,missing:true}));continue;}
    const size=Number(raw.size),checksum=String(raw.checksum||'').toLowerCase(),objectId=String(raw.objectId||'');
    if(!Number.isSafeInteger(size)||size<=0||!/^[a-f0-9]{64}$/u.test(checksum)||!objectIds.has(objectId))throw new Error('Device repository attachment reference is malformed.');
    assets.push(freeze({assetId:raw.assetId,mimeType:String(raw.mimeType||''),size,checksum,name:String(raw.name||''),library:raw.library===true,objectId}));
  }
  const counts=repositoryManifestCounts(value.counts||{},manifestVersion);
  const reconciliationBaseId=String(value.reconciliationBaseId||'');if(reconciliationBaseId&&!/^cp_[a-f0-9]{32}$/u.test(reconciliationBaseId))throw new Error('Device repository reconciliation base is invalid.');
  const rawAncestorIds=Array.isArray(value.reconciliationAncestorIds)?value.reconciliationAncestorIds:(reconciliationBaseId?[reconciliationBaseId]:[]),reconciliationAncestorIds=[],reconciliationAncestorSet=new Set();
  for(const rawId of rawAncestorIds){const id=String(rawId||'');if(!/^cp_[a-f0-9]{32}$/u.test(id)||id===String(checkpoint.checkpointId||'')||reconciliationAncestorSet.has(id))throw new Error('Device repository reconciliation ancestry is invalid.');reconciliationAncestorSet.add(id);reconciliationAncestorIds.push(id);}
  if((reconciliationBaseId&&reconciliationAncestorIds[0]!==reconciliationBaseId)||(!reconciliationBaseId&&reconciliationAncestorIds.length)||repositoryReconciliationAncestryBytes(reconciliationAncestorIds)>REPOSITORY_RECONCILIATION_ANCESTRY_MAX_BYTES)throw new Error('Device repository reconciliation ancestry is invalid.');
  const protectedCheckpointManifest=value.protectedCheckpointManifest;
  if(Number(backupVersion)>=15&&(!protectedCheckpointManifest||protectedCheckpointManifest.checkpointId!==checkpoint.checkpointId||protectedCheckpointManifest.sourceRevision!==new Date(sourceRevision).toISOString()))throw new Error('Device repository protected checkpoint manifest is invalid.');
  const logicalFingerprint=String(value.logicalFingerprint||'').toLowerCase();
  if(manifestVersion>=3&&!/^[a-f0-9]{64}$/u.test(logicalFingerprint))throw new Error('Device repository logical checkpoint fingerprint is invalid.');
  if(manifestVersion<3&&logicalFingerprint&&!/^[a-f0-9]{64}$/u.test(logicalFingerprint))throw new Error('Device repository logical checkpoint fingerprint is invalid.');
  return freeze({
    format:REPOSITORY_MANIFEST_FORMAT,version:manifestVersion,checkpoint:freeze({...checkpoint}),exportedAt,sourceRevision,
    installationId:String(value.installationId||''),protectionId,encrypted:value.encrypted===true,counts,protectedCheckpointManifest,reconciliationBaseId,reconciliationAncestorIds:freeze(reconciliationAncestorIds),retention,logicalFingerprint,
    objects:freeze(objects),assets:freeze(assets),warning:String(value.warning||''),committedAt:Number.isFinite(Date.parse(String(value.committedAt||'')))?new Date(String(value.committedAt)).toISOString():exportedAt
  });
}
async function repositoryProtectionContext({interactive=false}={}){
  const source=new Blob(['R'],{type:'application/octet-stream'});
  const probe=await Exports.protect({blob:source,filename:'repository-policy-probe'}, {interactive});
  try{return freeze({encrypted:probe.encrypted===true,protectionId:String(probe.protectionId||''),checkProtection:probe.checkProtection});}
  finally{if(probe.blob!==source)await Exports.run('file.release',{file:probe.blob});}
}
async function repositorySerializedJson(value,{signal=null}={}){
  const text=await Exports.run('stringify',{value},{signal});
  return freeze({text,sourceBytes:BackupCodec.utf8Bytes(text).byteLength});
}
async function repositoryJsonBlob(serialized,{compression='gzip',signal=null}={}){
  const text=String(serialized&&serialized.text||''),sourceBytes=Number(serialized&&serialized.sourceBytes)||BackupCodec.utf8Bytes(text).byteLength;
  if(compression==='gzip'&&BackupCodec.compressionSupported()){
    const id=await Exports.run('encode.open',{gzip:true,maxBytes:APP_LIMITS.backupMaxCompressedBytes},{signal});
    try{await Exports.run('encode.write',{id,line:text},{signal});return freeze({blob:await Exports.run('encode.finish',{id},{signal}),sourceBytes,compression:'gzip'});}
    catch(error){await Exports.run('encode.close',{id}).catch(()=>{});throw error;}
  }
  return freeze({blob:new Blob([text],{type:'application/json'}),sourceBytes,compression:'none'});
}
async function protectRepositoryBlob(sourceBlob,filename,context,{interactive=false,knownChecksum='',signal=null}={}){
  const protectedFile=await Exports.protect({blob:sourceBlob,filename},{interactive,signal});
  if(String(protectedFile.protectionId||'')!==context.protectionId||protectedFile.encrypted!==context.encrypted){
    if(protectedFile.blob!==sourceBlob)await Exports.run('file.release',{file:protectedFile.blob});
    throw new Error('Backup encryption changed while preparing the device repository. Retry the backup.');
  }
  const storedChecksum=!protectedFile.encrypted&&knownChecksum?knownChecksum:await Exports.run('checksum',{value:protectedFile.blob},{signal});
  return freeze({blob:protectedFile.blob,encrypted:protectedFile.encrypted===true,protectionId:context.protectionId,checkProtection:protectedFile.checkProtection,storedChecksum,release:protectedFile.blob!==sourceBlob?()=>Exports.run('file.release',{file:protectedFile.blob}):async()=>{}});
}
function repositoryHistory(value){
  const source=Array.isArray(value)?value:(value?[value]:[]),rows=[];
  const seen=new Set();
  for(const raw of source){
    const manifest=validateRepositoryManifest(raw),id=manifest.checkpoint.checkpointId;
    if(seen.has(id))continue;seen.add(id);rows.push(manifest);
  }
  rows.sort((a,b)=>Date.parse(a.exportedAt)-Date.parse(b.exportedAt)||a.checkpoint.checkpointId.localeCompare(b.checkpoint.checkpointId));
  return freeze(rows);
}
function repositoryReconciliationAncestryBytes(ids){let bytes=2;for(let index=0;index<ids.length;index++)bytes+=(index?1:0)+String(ids[index]).length+2;return bytes;}
function repositoryReconciliationAncestors(history,baseId){
  const start=String(baseId||'');if(!start)return freeze([]);
  const byId=new Map((history||[]).map(manifest=>[String(manifest.checkpoint&&manifest.checkpoint.checkpointId||''),manifest])),out=[],seen=new Set();let ancestryBytes=2;
  const append=id=>{const value=String(id||'');if(!/^cp_[a-f0-9]{32}$/u.test(value)||seen.has(value))return false;const added=(out.length?1:0)+value.length+2;if(ancestryBytes+added>REPOSITORY_RECONCILIATION_ANCESTRY_MAX_BYTES)return false;seen.add(value);out.push(value);ancestryBytes+=added;return true;};
  let current=start;
  while(current&&!seen.has(current)){
    if(!append(current))break;
    const manifest=byId.get(current);if(!manifest)break;
    const inherited=Array.isArray(manifest.reconciliationAncestorIds)&&manifest.reconciliationAncestorIds.length?manifest.reconciliationAncestorIds:(manifest.reconciliationBaseId?[manifest.reconciliationBaseId]:[]);
    let tail=current,exhausted=false;
    for(const id of inherited){if(seen.has(id)){tail=id;continue;}if(!append(id)){exhausted=true;break;}tail=id;}
    if(exhausted)break;
    const tailManifest=byId.get(tail);current=String(tailManifest&&tailManifest.reconciliationBaseId||'');
  }
  return freeze(out);
}
function repositoryReuseIndex(history,protectionId,availableObjectIds=null){
  const structured=new Map(),packs=new Map(),attachments=new Map(),available=availableObjectIds instanceof Set?availableObjectIds:null;
  for(const manifest of [...history].reverse()){
    if(manifest.protectionId!==protectionId)continue;
    for(const entry of manifest.objects||[]){
      if(available&&!available.has(entry.objectId))continue;
      if(entry.kind==='attachment'){
        const key=entry.fingerprint+':'+entry.sourceBytes;if(!attachments.has(key))attachments.set(key,entry);
      }else if(entry.kind==='structuredPack'){
        const key=String(entry.key)+'\u0000'+repositoryPackMembersKey(entry.members);if(!packs.has(key))packs.set(key,entry);
      }else{
        const key=repositoryUnitKey(entry.kind,entry.key)+'\u0000'+entry.fingerprint;if(!structured.has(key))structured.set(key,entry);
      }
    }
  }
  return freeze({structured,packs,attachments});
}
function rethrowCleanupControl(error){
  const code=String(error&&error.code||'');
  if(error&&error.name==='AbortError'||/_MAINTENANCE_BUDGET$/u.test(code))throw error;
}
async function cleanupRepositoryRetention(input){
  const rows=Array.isArray(input&&input.checkpoints)?[...input.checkpoints]:[];
  rows.sort((a,b)=>Date.parse(a.manifest?.exportedAt||0)-Date.parse(b.manifest?.exportedAt||0)||String(a.id||'').localeCompare(String(b.id||'')));
  const checkpointUncertain=Math.max(0,Number(input&&input.invalidCount)||0)+Math.max(0,Number(input&&input.ignoredCount)||0),overflow=input&&input.overflow===true;
  // Missing and unreadable are different states. An incomplete inventory cannot
  // prove that any manifest, commit or shared object is safe to remove.
  if(overflow||checkpointUncertain)return freeze({warning:'Repository cleanup was deferred because backup history could not be read completely. No backup files were removed.',retained:freeze(rows),removedCheckpoints:0,removedUncommitted:0,removedOrphanCommits:0,deferredIncomplete:0,checkpointDeferred:0,checkpointFailures:0,gcRemoved:0,gcDeferred:0,gcBudgetDeferred:0,gcFailures:0,gcSkipped:true,gcPending:true,uncertainCount:checkpointUncertain+(overflow?1:0),objectGcBlocked:input&&input.blockObjectGc===true,overflow,selection:null});
  const preparedObjects=input&&input.inventoryBeforeDelete===true?await input.listObjects():null;
  await input.beginDeletion?.();
  const selection=selectRepositoryRetention(rows,{now:input&&input.now||new Date()}),keep=[...selection.retained],remove=[...selection.remove],retainedIds=new Set();for(const row of keep)for(const entry of row.manifest?.objects||[])retainedIds.add(entry.objectId);
  const checkpointDeleteLimit=Number.isSafeInteger(Number(input&&input.maxCheckpointDeletes))?Math.max(1,Number(input.maxCheckpointDeletes)):Number.POSITIVE_INFINITY;
  const objectDeleteLimit=Number.isSafeInteger(Number(input&&input.maxObjectDeletes))?Math.max(1,Number(input.maxObjectDeletes)):Number.POSITIVE_INFINITY;
  let deletionFailures=0,removedCheckpoints=0,checkpointDeferred=0,checkpointDeleteAttempts=0,removedUncommitted=0,removedOrphanCommits=0;
  const failedRows=[],deferredRows=[],incomplete=Array.isArray(input&&input.incompleteArtifacts)?input.incompleteArtifacts:[],deferredIncomplete=input&&input.blockObjectGc===true?incomplete.length:0;
  if(!deferredIncomplete)for(const artifact of incomplete){
    if(checkpointDeleteAttempts>=checkpointDeleteLimit){checkpointDeferred+=1;continue;}
    input.workBudget?.check();checkpointDeleteAttempts+=1;
    try{if(await input.deleteIncompleteArtifact(artifact)===false)throw new Error('Incomplete artifact deletion was not confirmed.');if(artifact.kind==='checkpoint')removedUncommitted+=1;else removedOrphanCommits+=1;input.workBudget?.advance();}
    catch(error){rethrowCleanupControl(error);deletionFailures+=1;try{input.onError?.('incomplete-delete',error,artifact);}catch(reportingError){}}
  }
  for(const row of remove){
    if(checkpointDeleteAttempts>=checkpointDeleteLimit){checkpointDeferred+=1;deferredRows.push(row);for(const entry of row.manifest?.objects||[])retainedIds.add(entry.objectId);continue;}
    input.workBudget?.check();checkpointDeleteAttempts+=1;
    try{if(await input.deleteCheckpoint(row)!==false){removedCheckpoints+=1;input.workBudget?.advance();}else throw new Error('Checkpoint deletion was not confirmed.');}
    catch(error){rethrowCleanupControl(error);deletionFailures+=1;failedRows.push(row);for(const entry of row.manifest?.objects||[])retainedIds.add(entry.objectId);try{input.onError?.('checkpoint-delete',error,row);}catch(reportingError){}}
  }
  let gcRemoved=0,gcDeferred=0,gcBudgetDeferred=0,gcFailures=0,gcDeleteAttempts=0,objectListingInvalid=0,objectListingOverflow=false,objectListingFailed=false,gcSkipped=Math.max(0,Number(input&&input.invalidCount)||0)>0||Math.max(0,Number(input&&input.ignoredCount)||0)>0||deletionFailures>0||checkpointDeferred>0||input&&input.blockObjectGc===true;
  const graceBefore=Date.parse(String(input&&input.objectGraceBefore||''));
  if(!gcSkipped){
    try{
      const listing=preparedObjects||await input.listObjects(),objects=Array.isArray(listing)?listing:Array.isArray(listing&&listing.items)?listing.items:[];
      objectListingOverflow=listing&&listing.overflow===true;objectListingInvalid=Math.max(0,Number(listing&&listing.invalidCount)||0);
      if(objectListingOverflow||objectListingInvalid>0)gcSkipped=true;
      else for(const item of objects){
        const id=String(item&&item.id||'');if(!id||retainedIds.has(id))continue;
        if(Number.isFinite(graceBefore)){const observed=Date.parse(String(item&&item.createdAt||item&&item.modifiedAt||''));if(!Number.isFinite(observed)||observed>graceBefore){gcDeferred+=1;continue;}}
        if(gcDeleteAttempts>=objectDeleteLimit){gcBudgetDeferred+=1;continue;}
        input.workBudget?.check();gcDeleteAttempts+=1;
        try{if(await input.deleteObject(item)!==false){gcRemoved+=1;input.workBudget?.advance();}else gcFailures+=1;}catch(error){rethrowCleanupControl(error);gcFailures+=1;try{input.onError?.('object-delete',error,item);}catch(reportingError){}}
      }
    }catch(error){rethrowCleanupControl(error);gcSkipped=true;objectListingFailed=true;try{input.onError?.('object-list',error,null);}catch(reportingError){}
    }
  }
  const parts=[];
  if(deferredIncomplete)parts.push(`${deferredIncomplete} incomplete publication artifact${deferredIncomplete===1?' was':'s were'} retained because another repository publication may still be in progress.`);
  if(deletionFailures)parts.push(`${deletionFailures} backup file${deletionFailures===1?' was':'s were'} retained because deletion could not be confirmed.`);
  if(checkpointDeferred)parts.push(`${checkpointDeferred} backup file${checkpointDeferred===1?' was':'s were'} deferred to keep this maintenance pass bounded.`);
  if(gcSkipped)parts.push(input&&input.blockObjectGc===true?'Shared-object cleanup was deferred because another repository publication may still be in progress.':objectListingOverflow||objectListingInvalid||objectListingFailed?'Shared-object cleanup was deferred because the repository object listing could not be read or interpreted safely.':'Shared-object cleanup was deferred because checkpoint state still needs a later safe maintenance pass.');
  if(gcDeferred)parts.push(`${gcDeferred} recently created unreferenced object${gcDeferred===1?' was':'s were'} retained until a later maintenance pass.`);
  if(gcBudgetDeferred)parts.push(`${gcBudgetDeferred} unused object${gcBudgetDeferred===1?' was':'s were'} deferred to keep this maintenance pass bounded.`);
  if(gcFailures)parts.push(`${gcFailures} unused object${gcFailures===1?' could':'s could'} not be removed and will be retried later.`);
  const uncertain=objectListingInvalid+(objectListingFailed?1:0);if(objectListingInvalid)parts.push(`${objectListingInvalid} repository object entr${objectListingInvalid===1?'y was':'ies were'} unreadable and left untouched.`);if(objectListingFailed)parts.push('Repository object enumeration failed and was left untouched.');if(objectListingOverflow)parts.push('Repository object enumeration exceeded its safety bound and was left untouched.');
  const actualRetained=[...keep,...failedRows,...deferredRows].sort((a,b)=>Date.parse(a.manifest?.exportedAt||0)-Date.parse(b.manifest?.exportedAt||0)||String(a.id||'').localeCompare(String(b.id||'')));
  return freeze({warning:parts.join(' '),retained:freeze(actualRetained),removedCheckpoints,removedUncommitted,removedOrphanCommits,deferredIncomplete,checkpointDeferred,checkpointFailures:deletionFailures,gcRemoved,gcDeferred,gcBudgetDeferred,gcFailures,gcSkipped,gcPending:gcSkipped||deferredIncomplete>0||checkpointDeferred>0||gcDeferred>0||gcBudgetDeferred>0||gcFailures>0,uncertainCount:uncertain,objectGcBlocked:input&&input.blockObjectGc===true,objectListingFailed,overflow:objectListingOverflow,selection});
}

async function prepareRepositoryCheckpointWork(previousManifests=null,{interactive=false,availableObjectIds=null,excludedObjectIds=null,retention=null,signal=null}={}){
  throwIfImportAborted(signal);
  const history=repositoryHistory(previousManifests);
  const context=await repositoryProtectionContext({interactive});
  const exportedAt=new Date().toISOString();
  const preparation=await beginPreparationCapture(exportedAt);throwIfImportAborted(signal);
  const reconciliationBase=await AppData.reconciliationBase.read().catch(()=>null),reconciliationBaseId=String(reconciliationBase&&reconciliationBase.checkpointId||''),reconciliationAncestorIds=repositoryReconciliationAncestors(history,reconciliationBaseId);
  const plan=preparation?await repositoryPreparationPlan(preparation,reconciliationBase):null;
  if(!plan&&repositoryPreparationIndex)repositoryPreparationIndex=null;
  const excluded=new Set(repositoryScrubObjectIds(excludedObjectIds)),available=availableObjectIds instanceof Set?new Set([...availableObjectIds].filter(id=>!excluded.has(id))):availableObjectIds;
  const reuseIndex=repositoryReuseIndex(history,context.protectionId,available),objects=[],leases=[],structuredObjects=new Map(),packedPayloads=new Map(),currentByUnit=new Map(),candidateEntries=plan?new Map(plan.entries):new Map(),readNoteText=new Map();
  let capture=null,assetItems=[],candidateIndex=null,reconciliationUpdate=null;
  const serializeStructured=async(kind,key,payload)=>{
    const body=freeze({format:REPOSITORY_OBJECT_FORMAT,version:REPOSITORY_OBJECT_VERSION,kind,key,payload}),serialized=await repositorySerializedJson(body,{signal}),fingerprint=await Exports.run('checksum',{value:serialized.text,algorithm:'sha256'},{signal});
    return freeze({body,serialized,fingerprint});
  };
  const materializeStructured=async(kind,key,payload)=>{
    throwIfImportAborted(signal);
    const unit=repositoryPreparationUnit(kind,key),encoded=await serializeStructured(kind,key,payload),entry=repositoryPreparationEntry(kind,key,payload,encoded.fingerprint,encoded.serialized.sourceBytes);
    candidateEntries.set(unit,entry);
    if(repositoryPackableEntry(entry)){packedPayloads.set(unit,payload);structuredObjects.delete(unit);}
    else{
      const old=reuseIndex.structured.get(repositoryUnitKey(kind,key)+'\u0000'+encoded.fingerprint);let object;
      if(old)object=freeze({...old,reused:true,blob:null,checkProtection:context.checkProtection});
      else{
        const payloadFile=await repositoryJsonBlob(encoded.serialized,{compression:'gzip',signal}),objectId=repositoryObjectId(),file=await protectRepositoryBlob(payloadFile.blob,objectId+'.sdobject',context,{interactive,signal});throwIfImportAborted(signal);
        leases.push(file.release);object=freeze({objectId,kind,key,fingerprint:encoded.fingerprint,compression:payloadFile.compression,sourceBytes:payloadFile.sourceBytes,storedBytes:file.blob.size,storedChecksum:file.storedChecksum,reused:false,blob:file.blob,checkProtection:file.checkProtection});
      }
      structuredObjects.set(unit,object);packedPayloads.delete(unit);
    }
    if(kind==='areaNote')readNoteText.set(String(key),String(payload&&payload.text||''));
    return entry;
  };
  const packGroups=entries=>{const groups=new Map();for(const entry of entries.values())if(repositoryPackableEntry(entry)){const shard=repositoryPackShard(entry.kind,entry.key);if(!groups.has(shard))groups.set(shard,[]);groups.get(shard).push(entry);}for(const rows of groups.values())rows.sort((a,b)=>a.kind.localeCompare(b.kind)||a.key.localeCompare(b.key));return groups;};
  const materializePack=async(shard,members)=>{
    const key=repositoryPackKey(shard),manifestMembers=freeze(members.map(entry=>freeze({kind:entry.kind,key:entry.key,fingerprint:entry.fingerprint,sourceBytes:entry.sourceBytes}))),reuseKey=key+'\u0000'+repositoryPackMembersKey(manifestMembers),old=reuseIndex.packs.get(reuseKey);
    if(old)return freeze({...old,reused:true,blob:null,checkProtection:context.checkProtection});
    const missing=members.filter(entry=>!packedPayloads.has(entry.unit)).map(entry=>entry.unit);
    if(missing.length){
      if(!preparation)throw new Error('Repository structured-pack payload became unavailable during checkpoint preparation.');
      const reads=await readPreparationUnits(preparation,missing);
      for(const result of reads){
        const descriptor=repositoryPreparationDescriptor(result&&result.unit),expected=descriptor&&candidateEntries.get(descriptor.unit);
        if(!descriptor||!expected||!result.present)throw new Error('Repository structured-pack payload became unavailable during checkpoint preparation.');
        const encoded=await serializeStructured(descriptor.kind,descriptor.key,result.payload);
        if(encoded.fingerprint!==expected.fingerprint||encoded.serialized.sourceBytes!==expected.sourceBytes){const error=new Error('Stored data changed while the backup pack was being prepared. Retry the backup.');error.code='BACKUP_SOURCE_FENCE_CHANGED';error.backupStage='checkpoint-source-fence';throw error;}
        packedPayloads.set(descriptor.unit,result.payload);
      }
    }
    const bodies=[];for(const entry of members){if(!packedPayloads.has(entry.unit))throw new Error('Repository structured-pack payload is unavailable.');bodies.push(freeze({kind:entry.kind,key:entry.key,payload:packedPayloads.get(entry.unit)}));}
    const body=freeze({format:REPOSITORY_PACK_FORMAT,version:REPOSITORY_PACK_VERSION,shard,members:freeze(bodies)}),serialized=await repositorySerializedJson(body,{signal}),fingerprint=await Exports.run('checksum',{value:serialized.text,algorithm:'sha256'},{signal}),payloadFile=await repositoryJsonBlob(serialized,{compression:'gzip',signal}),objectId=repositoryObjectId(),file=await protectRepositoryBlob(payloadFile.blob,objectId+'.sdobject',context,{interactive,signal});throwIfImportAborted(signal);
    leases.push(file.release);return freeze({objectId,kind:'structuredPack',key,fingerprint,compression:payloadFile.compression,sourceBytes:payloadFile.sourceBytes,storedBytes:file.blob.size,storedChecksum:file.storedChecksum,members:manifestMembers,reused:false,blob:file.blob,checkProtection:file.checkProtection});
  };
  const grouped=(items,dateKey)=>{const map=new Map();for(const item of items){const month=repositoryMonth(item&&item[dateKey]);if(!map.has(month))map.set(month,[]);map.get(month).push(item);}return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));};
  try{
    if(plan){
      const readUnits=new Set(plan.structuredChanged);
      for(const entry of candidateEntries.values()){
        if(!entry.present||repositoryPackableEntry(entry))continue;
        const old=reuseIndex.structured.get(repositoryUnitKey(entry.kind,entry.key)+'\u0000'+entry.fingerprint);
        if(old)structuredObjects.set(entry.unit,freeze({...old,reused:true,blob:null,checkProtection:context.checkProtection}));
        else readUnits.add(entry.unit);
      }
      const reads=readUnits.size?await readPreparationUnits(preparation,[...readUnits].sort()):freeze([]);
      for(const result of reads){
        const descriptor=repositoryPreparationDescriptor(result&&result.unit);if(!descriptor)throw new Error('Incremental repository preparation returned an unknown unit.');
        if(!result.present){candidateEntries.set(descriptor.unit,repositoryPreparationEntry(descriptor.kind,descriptor.key,null,'',0,{present:false}));structuredObjects.delete(descriptor.unit);if(descriptor.kind==='areaNote')readNoteText.set(descriptor.key,null);continue;}
        await materializeStructured(descriptor.kind,descriptor.key,result.payload);
      }
      const inventory=repositoryPreparationInventory(candidateEntries),catalogue=new Map((preparation.assetCatalogue||[]).map(row=>[String(row&&row.id||''),row])),ids=new Set((preparation.assetCatalogue||[]).filter(row=>row&&row.library===true).map(row=>String(row.id)));
      for(const id of inventory.assetIds)ids.add(id);
      await AssetData.verifyAliases(preparation.assetCatalogue,[...ids]);
      assetItems=[...ids].filter(Boolean).sort().map(assetId=>{const row=catalogue.get(assetId);if(!row)return freeze({descriptor:freeze({assetId,missing:true}),blob:null});return freeze({descriptor:freeze({assetId,mimeType:row.type,size:row.size,checksum:row.hash,name:row.name,library:row.library===true}),blob:null});});
      capture=await finalizePreparationCapture(preparation,freeze({recordDates:inventory.recordDates,noteKeys:inventory.noteKeys,assetIds:assetItems.map(item=>item.descriptor.assetId),counts:inventory.counts}));
      const updates=Object.create(null),deletes=[];for(const [key,text] of readNoteText){if(text===null)deletes.push(key);else updates[key]=text;}
      candidateIndex=await repositoryPreparationIndexCandidate(preparation.epochToken,preparation.stamps,candidateEntries);if(!candidateIndex)throw new Error('Incremental repository preparation index could not be rebuilt.');
      reconciliationUpdate=freeze({format:'study-director.reconciliation-base-update',version:1,full:false,baseCheckpointId:reconciliationBaseId,noteCount:candidateIndex.noteCount,noteKeyFingerprint:candidateIndex.noteKeyFingerprint,noteKeys:null,updates:freeze(updates),deletes:freeze(deletes.sort())});
    }else{
      capture=await captureLogicalCheckpoint(exportedAt,preparation?{includeAssetBlobs:false,assumeFlushed:true,requireCanonicalComplete:true}:{includeAssetBlobs:false,requireCanonicalComplete:true});
      for(const [month,items] of grouped(capture.dailyDocuments,'date'))await materializeStructured('dailyRecordPack',month,freeze([...items]));
      for(const note of capture.areaNoteItems)await materializeStructured('areaNote',String(note.key),note);
      if(capture.activeSession)await materializeStructured('activeSession','active',capture.activeSession);
      if(capture.personalData)await materializeStructured('personalData','personal',capture.personalData);
      assetItems=[...(capture.assetItems||[])];
      const updates=Object.create(null),noteKeys=[];for(const note of capture.areaNoteItems||[]){const key=String(note&&note.key||'').trim();if(!key)continue;noteKeys.push(key);updates[key]=String(note&&note.text||'');}
      noteKeys.sort();reconciliationUpdate=freeze({format:'study-director.reconciliation-base-update',version:1,full:true,baseCheckpointId:'',noteCount:noteKeys.length,noteKeyFingerprint:'',noteKeys:freeze(noteKeys),updates:freeze(updates),deletes:freeze([])});
    }
    const structuredRank=freeze({dailyRecordPack:0,activeSession:1,personalData:2,areaNote:3});
    for(const entry of [...candidateEntries.values()].filter(entry=>entry.present&&!repositoryPackableEntry(entry)).sort((a,b)=>(structuredRank[a.kind]??9)-(structuredRank[b.kind]??9)||String(a.key).localeCompare(String(b.key)))){
      const object=structuredObjects.get(entry.unit);if(!object)throw new Error('A reusable structured repository object became unavailable during checkpoint preparation.');objects.push(object);currentByUnit.set(repositoryUnitKey(object.kind,object.key),object);
    }
    for(const [shard,members] of [...packGroups(candidateEntries).entries()].sort((a,b)=>a[0]-b[0]))objects.push(await materializePack(shard,members));
    const assets=[],attachmentObjectsByFingerprint=new Map(reuseIndex.attachments);
    for(const item of assetItems){
      throwIfImportAborted(signal);
      const descriptor=item.descriptor;
      if(descriptor.missing===true){assets.push(freeze({assetId:descriptor.assetId,missing:true}));continue;}
      const contentFingerprint=String(descriptor.checksum).toLowerCase(),contentKey='content:'+contentFingerprint+':'+descriptor.size;
      let object=attachmentObjectsByFingerprint.get(contentFingerprint+':'+descriptor.size);
      if(object&&object.kind==='attachment'){
        object=freeze({...object,reused:true,blob:null,checkProtection:context.checkProtection});
        if(!currentByUnit.has(repositoryUnitKey('attachment',object.key))){objects.push(object);currentByUnit.set(repositoryUnitKey('attachment',object.key),object);}
      }else{
        const blob=await AssetData.get(descriptor.assetId);throwIfImportAborted(signal);
        if(!(blob instanceof Blob)){assets.push(freeze({assetId:descriptor.assetId,missing:true}));continue;}
        if(blob.size!==descriptor.size||blob.type!==descriptor.mimeType)throw new Error('An attachment changed while the repository checkpoint was being prepared. Retry the backup.');
        const objectId=repositoryObjectId(),file=await protectRepositoryBlob(blob,objectId+'.sdobject',context,{interactive,knownChecksum:contentFingerprint,signal});
        leases.push(file.release);object=freeze({objectId,kind:'attachment',key:contentKey,fingerprint:contentFingerprint,compression:'none',sourceBytes:blob.size,storedBytes:file.blob.size,storedChecksum:file.storedChecksum,reused:false,blob:file.blob,checkProtection:file.checkProtection});
        objects.push(object);currentByUnit.set(repositoryUnitKey('attachment',contentKey),object);attachmentObjectsByFingerprint.set(contentFingerprint+':'+descriptor.size,object);
      }
      assets.push(freeze({...descriptor,objectId:object.objectId}));
    }
    throwIfImportAborted(signal);await assertLogicalCheckpointCurrent(capture);await context.checkProtection?.();throwIfImportAborted(signal);
    if(!plan){
      const baseline=await establishPreparationBaseline(capture,[...candidateEntries.values()].filter(entry=>entry.present).map(entry=>entry.unit));
      if(baseline)candidateIndex=await repositoryPreparationIndexCandidate(baseline.epochToken,baseline.stamps,candidateEntries);
    }
    const manifestObjects=freeze(objects.map(repositoryManifestObject)),manifestAssets=freeze(assets);
    const identitySource=freeze({counts:freeze({...capture.counts}),protectedCheckpointManifest:capture.protectedCheckpointManifest,objects:manifestObjects,assets:manifestAssets});
    const logicalFingerprint=await repositoryLogicalFingerprint(identitySource);
    const manifestBase=freeze({
      format:REPOSITORY_MANIFEST_FORMAT,version:REPOSITORY_MANIFEST_VERSION,checkpoint:capture.checkpoint,exportedAt:capture.exportedAt,sourceRevision:capture.sourceRevision,
      installationId:capture.installationId,protectionId:context.protectionId,encrypted:context.encrypted,counts:freeze({...capture.counts}),protectedCheckpointManifest:capture.protectedCheckpointManifest,reconciliationBaseId,reconciliationAncestorIds,retention:repositoryRetentionDescriptor(capture.exportedAt,retention),logicalFingerprint,
      objects:manifestObjects,assets:manifestAssets,warning:capture.warning
    });
    const prepared=freeze({
      format:'study-director.prepared-repository-checkpoint',version:1,checkpoint:capture.checkpoint,exportedAt:capture.exportedAt,sourceRevision:capture.sourceRevision,
      protectionId:context.protectionId,encrypted:context.encrypted,counts:freeze({...capture.counts}),objects:freeze(objects),warning:capture.warning
    });
    repositoryPreparedState.set(prepared,{capture,context,manifestBase,leases,released:false,manifestFinalized:false,reconciliationUpdate,preparationIndexCandidate:candidateIndex});
    return prepared;
  }catch(error){for(const release of leases.splice(0))await release().catch(()=>{});throw error;}
}
function invalidateRepositoryPreparation(){repositoryPreparationIndex=null;for(const continuation of repositoryPublicationStates.keys())void continuation.release();return true;}
function repositoryPreparationDiagnosticReason(error){
  const message=String(error&&error.message||'');
  if(message==='Incremental repository preparation index could not be rebuilt.')return 'incremental-index-rebuild';
  if(message==='A reusable structured repository object became unavailable during checkpoint preparation.')return 'reusable-structured-object-unavailable';
  if(message.startsWith('Repository structured preparation unit is invalid.'))return 'structured-unit-invalid';
  if(message.includes('attachment changed while the repository checkpoint was being prepared'))return 'attachment-source-changed';
  if(message.includes('reconciliation'))return 'reconciliation-preparation';
  return 'unexpected-repository-preparation';
}
async function prepareRepositoryCheckpoint(previousManifests=null,options={}){
  // A routine canonical write can legitimately race checkpoint preparation
  // (for example an Active Session recovery checkpoint). The snapshot fence is
  // authoritative, so retry once instead of turning a transient fence race into
  // a user-visible backup failure. Unexpected preparation failures keep a stable
  // diagnostic code/stage so live traces do not collapse back to plain Error.
  for(let attempt=0;attempt<2;attempt+=1){
    try{return await prepareRepositoryCheckpointWork(previousManifests,options);}
    catch(error){
      const code=String(error&&error.code||'');
      if(code==='BACKUP_SOURCE_FENCE_CHANGED'&&attempt===0){
        AppDiagnostics.capture('repository.preparation-source-race',error,'warn');
        throwIfImportAborted(options&&options.signal||null);await yieldTask();throwIfImportAborted(options&&options.signal||null);continue;
      }
      if(code||error&&error.name==='AbortError')throw error;
      const wrapped=new Error(String(error&&error.message||'Repository checkpoint preparation failed.'));
      wrapped.name=String(error&&error.name||'Error');wrapped.code='BACKUP_REPOSITORY_PREPARATION_FAILED';wrapped.backupStage='checkpoint-repository-preparation';wrapped.diagnosticReason=repositoryPreparationDiagnosticReason(error);wrapped.cause=error;throw wrapped;
    }
  }
  const error=new Error('Repository checkpoint preparation retry was exhausted.');error.code='BACKUP_SOURCE_FENCE_CHANGED';error.backupStage='checkpoint-source-fence';throw error;
}
async function finalizeRepositoryCheckpointManifest(prepared,{interactive=false,signal=null}={}){
  const state=repositoryPreparedState.get(prepared);
  if(!state||state.released)throw new Error('Prepared repository checkpoint is unavailable.');
  if(state.manifestFinalized)throw new Error('Prepared repository checkpoint manifest was already finalized.');
  // prepareRepositoryCheckpointWork already verifies the canonical source after every
  // payload/object needed by this checkpoint has been captured. From here onward the
  // checkpoint is immutable: later app edits belong to the next checkpoint and must
  // not invalidate a slow Device Folder or Drive publication.
  await state.context.checkProtection?.();
  const manifest=validateRepositoryManifest({...state.manifestBase,committedAt:new Date().toISOString()});
  throwIfImportAborted(signal);
  const source=new Blob([await Exports.run('stringify',{value:manifest},{signal})],{type:'application/json'});
  const protectedFile=await Exports.protect({blob:source,filename:'repository-checkpoint.sdcheckpoint'},{interactive,signal});
  if(String(protectedFile.protectionId||'')!==state.context.protectionId||protectedFile.encrypted!==state.context.encrypted){if(protectedFile.blob!==source)await Exports.run('file.release',{file:protectedFile.blob});throw new Error('Backup encryption changed before the repository checkpoint could be committed.');}
  state.manifestFinalized=true;
  return freeze({
    blob:protectedFile.blob,manifest,exportedAt:manifest.exportedAt,sourceRevision:manifest.sourceRevision,counts:manifest.counts,
    protectionId:manifest.protectionId,encrypted:manifest.encrypted,checkProtection:protectedFile.checkProtection,
    checkSource:async()=>true,release:()=>protectedFile.blob!==source?Exports.run('file.release',{file:protectedFile.blob}):Promise.resolve()
  });
}
async function establishRepositoryReconciliationBase(prepared){
  const state=repositoryPreparedState.get(prepared);
  if(!state||state.released||!state.manifestFinalized)throw new Error('Finalized repository checkpoint manifest is unavailable for reconciliation ancestry.');
  const checkpointId=String(state.capture&&state.capture.checkpoint&&state.capture.checkpoint.checkpointId||'');
  if(!/^cp_[a-f0-9]{32}$/u.test(checkpointId))throw new Error('Committed repository checkpoint identity is invalid.');
  const update=state.reconciliationUpdate;if(!update)throw new Error('Prepared repository checkpoint reconciliation update is unavailable.');
  const written=await AppData.reconciliationBase.write(checkpointId,update);
  if(written!==false&&state.preparationIndexCandidate)repositoryPreparationIndex=freeze({...state.preparationIndexCandidate,checkpointId});else if(written===false)repositoryPreparationIndex=null;
  return checkpointId;
}
async function inspectRepositoryManifest(file,{interactive=false}={}){
  if(!(file instanceof Blob))throw new TypeError('Repository checkpoint file is unreadable.');
  const decoded=await Exports.unprotect(file,{interactive});
  try{
    const parsed=await Exports.run('parseBlob',{file:decoded.blob,maxBytes:Math.min(Number(APP_LIMITS.backupMaxCompressedBytes)||67108864,67108864)});
    const manifest=validateRepositoryManifest(parsed);
    if(decoded.encrypted!==manifest.encrypted)throw new Error('Repository checkpoint protection metadata is inconsistent.');
    const logicalFingerprint=await repositoryLogicalFingerprint(manifest);
    if(manifest.logicalFingerprint&&manifest.logicalFingerprint!==logicalFingerprint)throw new Error('Repository checkpoint logical-state fingerprint failed verification.');
    return manifest.logicalFingerprint===logicalFingerprint?manifest:freeze({...manifest,logicalFingerprint});
  }finally{if(decoded.blob!==file)await Exports.run('file.release',{file:decoded.blob});}
}
function repositoryCorruption(message){const error=new Error(message);error.code='REPOSITORY_INTEGRITY_CORRUPT';return error;}
async function verifyRepositoryObject(file,entry,options={}){
  const expected=repositoryManifestObject(entry);
  if(!(file instanceof Blob)||file.size!==expected.storedBytes)throw repositoryCorruption('Repository object size did not match after reopening.');
  const checksum=await Exports.run('checksum',{value:file},{signal:options.signal||null,onProgress:typeof options.onProgress==='function'?options.onProgress:null});
  if(checksum!==expected.storedChecksum)throw repositoryCorruption('Repository object failed read-back verification.');
  return true;
}
const REPOSITORY_SCRUB_SKIPPED_KINDS=freeze(new Set(['activeSession',LEGACY_REFLECTION_DRAFT_PACK_KIND]));
const REPOSITORY_SCRUB_KIND_PRIORITY=freeze(new Map([['attachment',0],['structuredPack',1],['areaNote',2],['dailyRecordPack',3],['personalData',4]]));
function repositoryScrubObjectIds(value){
  const rows=Array.isArray(value)?value:[],seen=new Set(),out=[];
  for(const raw of rows){const id=String(raw||'');if(!/^obj_[a-f0-9]{32}$/u.test(id)||seen.has(id))continue;seen.add(id);out.push(id);}
  return freeze(out);
}
async function scrubRepositoryIntegrity(manifests,readObjectValue,{cursor='',recheckCursor='',scanId='',partial=null,recheck=false,verifyIncremental=null,readRange=null,maxObjects=4,maxBytes=256*1024*1024,signal=null,skipObjectIds=null,onProgress=null,storedDigest=null}={}){
  const history=repositoryHistory(manifests),readObject=repositoryReadPort(readObjectValue),firstByObject=new Map(),skipped=new Set(repositoryScrubObjectIds(skipObjectIds)),quarantinedPresent=new Set();
  for(const manifest of history)for(const entry of manifest.objects||[]){
    if(REPOSITORY_SCRUB_SKIPPED_KINDS.has(entry.kind)||firstByObject.has(entry.objectId))continue;
    if(skipped.has(entry.objectId)){quarantinedPresent.add(entry.objectId);if(!recheck)continue;}
    firstByObject.set(entry.objectId,freeze({manifest,entry}));
  }
  const rows=[...firstByObject.values()].sort((a,b)=>{
    const pa=REPOSITORY_SCRUB_KIND_PRIORITY.get(a.entry.kind)??99,pb=REPOSITORY_SCRUB_KIND_PRIORITY.get(b.entry.kind)??99;
    return pa-pb||Date.parse(a.manifest.exportedAt)-Date.parse(b.manifest.exportedAt)||a.entry.objectId.localeCompare(b.entry.objectId);
  });
  const currentScanId=await Exports.run('checksum',{value:JSON.stringify(rows.map(({entry})=>[entry.objectId,entry.storedChecksum,entry.fingerprint]))},{signal});
  const cleanCursor=scanId===currentScanId&&/^obj_[a-f0-9]{32}$/u.test(String(cursor||''))?String(cursor):'';
  const cleanRecheckCursor=recheck&&scanId===currentScanId&&/^obj_[a-f0-9]{32}$/u.test(String(recheckCursor||''))?String(recheckCursor):'';
  const traversalCursor=recheck?cleanRecheckCursor||cleanCursor:cleanCursor;
  let index=traversalCursor?rows.findIndex(row=>row.entry.objectId===traversalCursor)+1:0;
  const objectLimit=Math.max(1,Math.min(32,Number.isInteger(maxObjects)?maxObjects:4));
  const byteLimit=Math.max(1024*1024,Math.min(1024*1024*1024,Number.isFinite(Number(maxBytes))?Number(maxBytes):256*1024*1024));
  let checked=0,checkedBytes=0,attempted=0,attemptedBytes=0,lastCursor=index>0?cleanCursor:'',lastRecheckCursor=index>0?cleanRecheckCursor:'',checkpoint=scanId===currentScanId&&(!traversalCursor||index>0)?partial:null;
  // In a recheck, quarantine remaining before the attempted cursor records a
  // confirmed bad outcome. Healthy verified progress remains a separate cursor.
  let corruption=recheck&&rows.slice(0,index).some(({entry})=>quarantinedPresent.has(entry.objectId));
  const progress=()=>freeze({complete:false,cursor:lastCursor,recheckCursor:lastRecheckCursor,scanId:currentScanId,partial:checkpoint,checked,checkedBytes,attempted,total:rows.length,quarantined:freeze([...quarantinedPresent]),...(recheck?{corruption}:{} )});
  try{for(;index<rows.length;index+=1){
    throwIfImportAborted(signal);
    // A location that keeps its own checksum of each stored object (Drive)
    // is checked against it without downloading; it costs no budget.
    const {manifest,entry}=rows[index],reported=typeof storedDigest==='function'?String(storedDigest(entry)||'').toLowerCase():'',projected=attemptedBytes+(reported?0:Number(entry.storedBytes||0));
    if(!reported&&attempted>0&&(attempted>=objectLimit||projected>byteLimit))break;
    let healthy=true;
    try{
      if(reported){
        if(reported!==String(entry.storedChecksum||'').toLowerCase())throw repositoryCorruption(`Repository object ${entry.objectId} no longer matches its stored checksum.`);
      }else if(typeof verifyIncremental==='function'&&typeof readRange==='function'){
        const verified=await verifyIncremental({entry,manifest,readRange,checkpoint,signal,onCheckpoint:async value=>{checkpoint=value;if(typeof onProgress==='function')await onProgress(progress());}});
        if(!verified.complete)break;
        if(entry.kind!=='attachment')await readRepositoryStructuredObject(manifest,entry,readObject,{interactive:false,signal,opened:verified.opened});
      }else if(entry.kind==='attachment'){
        const opened=await openRepositoryObject(manifest,entry,readObject,{interactive:false,signal});
        try{
          if(opened.blob.size!==entry.sourceBytes)throw repositoryCorruption(`Repository attachment object ${entry.objectId} plaintext size failed verification.`);
          const checksum=await Exports.run('checksum',{value:opened.blob},{signal});
          if(checksum!==entry.fingerprint)throw repositoryCorruption(`Repository attachment object ${entry.objectId} plaintext integrity failed verification.`);
        }finally{await opened.release().catch(()=>{});}
      }else await readRepositoryStructuredObject(manifest,entry,readObject,{interactive:false,signal});
    }catch(error){
      const confirmedBad=['REPOSITORY_INTEGRITY_CORRUPT','REPOSITORY_OBJECT_MISSING'].includes(error?.code);
      if(confirmedBad)checkpoint=null;
      if(recheck&&skipped.has(entry.objectId)&&confirmedBad&&!signal?.aborted){
        healthy=false;corruption=true;
        // A known failure remains quarantined. Recording its attempted outcome
        // prevents it starving later objects or repeatedly publishing repairs.
        quarantinedPresent.add(entry.objectId);
      }else{
        error.repositoryObjectId=entry.objectId;error.repositoryObjectKind=entry.kind;error.repositoryScrubCursor=lastCursor;error.repositoryQuarantined=freeze([...quarantinedPresent]);throw error;
      }
    }
    checkpoint=null;attempted+=reported?0:1;attemptedBytes+=reported?0:Number(entry.storedBytes)||0;
    if(recheck)lastRecheckCursor=entry.objectId;
    if(healthy){quarantinedPresent.delete(entry.objectId);checked+=1;checkedBytes+=Number(entry.storedBytes)||0;lastCursor=entry.objectId;}
    if(!reported&&typeof onProgress==='function')await onProgress(progress());
    await yieldTask({priority:'background'});
  }}catch(error){error.repositoryScrubCursor=lastCursor;error.repositoryScrubProgress=progress();throw error;}
  const complete=index>=rows.length;
  return freeze({...progress(),complete,cursor:complete?'':lastCursor,recheckCursor:complete?'':lastRecheckCursor,...(recheck?{recheckComplete:complete,status:complete?corruption?'failed':'completed':'yielded',reason:corruption?'corrupt':''}:{})});
}
function repositoryReadPort(readObject){
  if(typeof readObject!=='function')throw new TypeError('Repository restore requires an object reader.');
  return readObject;
}
function repositoryReadLease(value){
  if(value instanceof Blob)return freeze({blob:value,release:async()=>{}});
  if(value===null){const error=new Error('Repository object is missing.');error.code='REPOSITORY_OBJECT_MISSING';throw error;}
  if(!value||typeof value!=='object'||!(value.blob instanceof Blob))throw new Error('Repository object is unreadable.');
  return freeze({blob:value.blob,release:typeof value.release==='function'?value.release:async()=>{}});
}
function repositoryStructuredLimit(){
  const declared=Number(APP_LIMITS.backupMaxUncompressedBytes)||Number(APP_LIMITS.backupMaxCompressedBytes)||64*1024*1024;
  return Math.max(1024*1024,Math.min(declared,512*1024*1024));
}
async function openRepositoryObject(manifest,entry,readObject,{interactive=true,signal=null}={}){
  throwIfImportAborted(signal);
  const lease=repositoryReadLease(await readObject(entry)),stored=lease.blob;
  try{
    throwIfImportAborted(signal);
    await verifyRepositoryObject(stored,entry,{signal});
    const decoded=await Exports.unprotect(stored,{interactive,signal});
    if(decoded.encrypted!==manifest.encrypted){
      if(decoded.blob!==stored)await Exports.run('file.release',{file:decoded.blob});
      throw repositoryCorruption('Repository object protection does not match its checkpoint manifest.');
    }
    let released=false;
    return freeze({blob:decoded.blob,release:async()=>{if(released)return;released=true;if(decoded.blob!==stored)await Exports.run('file.release',{file:decoded.blob}).catch(()=>{});await lease.release().catch(()=>{});}});
  }catch(error){await lease.release().catch(()=>{});throw error;}
}
async function readRepositoryStructuredObject(manifest,entry,readObject,options={}){
  if(entry.kind==='attachment')throw new Error('Attachment repository objects cannot be decoded as structured records.');
  const opened=options.opened||await openRepositoryObject(manifest,entry,readObject,options),limit=repositoryStructuredLimit();
  try{
    return await Exports.scope(async()=>{
      let id=null;
      try{
        id=await Exports.run('decode.open',{file:opened.blob,gzip:entry.compression==='gzip',maxBytes:limit,maxLineBytes:limit},{signal:options.signal});
        const next=async()=>{try{return await Exports.run('decode.next',{id},{signal:options.signal});}catch(error){if(error?.name==='SyntaxError')throw repositoryCorruption(`Repository object ${entry.objectId} contains invalid structured JSON.`);throw error;}};
        const first=await next();
        if(first.done||!first.value||!first.value.value)throw repositoryCorruption(`Repository object ${entry.objectId} contains no structured payload.`);
        const body=first.value.value,second=await next();
        if(!second.done)throw repositoryCorruption(`Repository object ${entry.objectId} contains trailing structured data.`);
        const serialized=await Exports.run('stringify',{value:body}),sourceBytes=BackupCodec.utf8Bytes(serialized).byteLength;
        if(sourceBytes!==entry.sourceBytes)throw repositoryCorruption(`Repository object ${entry.objectId} source size failed verification.`);
        const fingerprint=await Exports.run('checksum',{value:serialized,algorithm:'sha256'},{signal:options.signal});
        if(fingerprint!==entry.fingerprint)throw repositoryCorruption(`Repository object ${entry.objectId} content fingerprint failed verification.`);
        if(entry.kind!=='structuredPack'){
          if(!body||typeof body!=='object'||Array.isArray(body)||body.format!==REPOSITORY_OBJECT_FORMAT||Number(body.version)!==REPOSITORY_OBJECT_VERSION||body.kind!==entry.kind||String(body.key)!==entry.key)throw repositoryCorruption(`Repository object ${entry.objectId} identity is invalid.`);
          return freeze([freeze({kind:entry.kind,key:entry.key,payload:body.payload})]);
        }
        const shard=Number(String(entry.key).slice('shard:'.length));
        if(!body||typeof body!=='object'||Array.isArray(body)||body.format!==REPOSITORY_PACK_FORMAT||Number(body.version)!==REPOSITORY_PACK_VERSION||Number(body.shard)!==shard||!Array.isArray(body.members))throw repositoryCorruption(`Repository structured pack ${entry.objectId} identity is invalid.`);
        const expected=repositoryPackManifestMembers(entry.members),actual=[];
        for(const raw of body.members){
          if(!raw||typeof raw!=='object'||Array.isArray(raw))throw repositoryCorruption(`Repository structured pack ${entry.objectId} contains an invalid member.`);
          const kind=String(raw.kind||''),key=String(raw.key||''),encoded=await (async()=>{const logicalBody=freeze({format:REPOSITORY_OBJECT_FORMAT,version:REPOSITORY_OBJECT_VERSION,kind,key,payload:raw.payload}),text=await Exports.run('stringify',{value:logicalBody}),bytes=BackupCodec.utf8Bytes(text).byteLength,hash=await Exports.run('checksum',{value:text,algorithm:'sha256'},{signal:options.signal});return freeze({bytes,hash});})();
          actual.push(freeze({kind,key,fingerprint:encoded.hash,sourceBytes:encoded.bytes,payload:raw.payload}));
        }
        actual.sort((a,b)=>a.kind.localeCompare(b.kind)||a.key.localeCompare(b.key));
        if(actual.length!==expected.length)throw repositoryCorruption(`Repository structured pack ${entry.objectId} member count failed verification.`);
        for(let index=0;index<expected.length;index+=1){const want=expected[index],got=actual[index];if(got.kind!==want.kind||got.key!==want.key||got.fingerprint!==want.fingerprint||got.sourceBytes!==want.sourceBytes||repositoryPackShard(got.kind,got.key)!==shard)throw repositoryCorruption(`Repository structured pack ${entry.objectId} member integrity failed verification.`);}
        return freeze(actual.map(member=>freeze({kind:member.kind,key:member.key,payload:member.payload})));
      }finally{if(id!==null)await Exports.run('decode.close',{id}).catch(()=>{});}
    });
  }finally{await opened.release().catch(()=>{});}
}
// An attachment already on this device with the same size and checksum is
// read from here instead of the backup location; its bytes are hashed and
// must match the verified manifest, so nothing is trusted unchecked.
async function localRepositoryAttachment(descriptor,{signal=null}={}){
  let local=null;try{local=await AssetData.get(descriptor.assetId);}catch{return null;}
  if(!(local instanceof Blob)||local.size!==Number(descriptor.size))return null;
  throwIfImportAborted(signal);
  return await Exports.run('checksum',{value:local},{signal})===descriptor.checksum?local:null;
}
async function openRepositoryAttachment(manifest,entry,descriptor,readObject,options={}){
  if(entry.kind!=='attachment'||entry.compression!=='none')throw new Error('Repository attachment object metadata is invalid.');
  const opened=await openRepositoryObject(manifest,entry,readObject,options);
  try{
    if(opened.blob.size!==entry.sourceBytes||opened.blob.size!==descriptor.size)throw repositoryCorruption(`Repository attachment ${descriptor.assetId} size failed verification.`);
    const checksum=await Exports.run('checksum',{value:opened.blob},{signal:options.signal});
    if(checksum!==entry.fingerprint||checksum!==descriptor.checksum)throw repositoryCorruption(`Repository attachment ${descriptor.assetId} failed plaintext integrity verification.`);
    return opened;
  }catch(error){await opened.release().catch(()=>{});throw error;}
}
// With note set, only the objects holding that note and the images its text
// uses are read. Each is still verified against the verified manifest; the
// whole-checkpoint cross-checks need every object and are left out.
// localAttachments (restores only) lets attachments already on this device be
// used instead of downloaded; verifying the backup copy itself never does.
async function reconstructVerifiedRepositoryCheckpoint(manifestValue,readObjectValue,{interactive=true,signal=null,note='',localAttachments=false}={}){
  const manifest=validateRepositoryManifest(manifestValue),readObject=repositoryReadPort(readObjectValue),noteKey=String(note||'');
  throwIfImportAborted(signal);
  if(manifest.installationId&&manifest.installationId!==manifest.checkpoint.originInstallationId)throw new Error('Repository checkpoint installation provenance is inconsistent.');
  const objectById=new Map(manifest.objects.map(entry=>[entry.objectId,entry]));
  const allowedKinds=new Set(['dailyRecordPack','areaNote','activeSession','personalData','structuredPack','attachment']);if(manifest.version<=4)allowedKinds.add(LEGACY_REFLECTION_DRAFT_PACK_KIND);
  for(const entry of manifest.objects)if(!allowedKinds.has(entry.kind))throw new Error(`Repository object kind ${entry.kind} is unsupported.`);
  const dailyDocuments=[],areaNoteItems=[];let activeSession=null,personalData=null,legacyReflectionDraftCount=0;
  // A one-note read names the note by id; older manifests hold it by name.
  const noteIdOf=key=>manifest.version>=REPOSITORY_NOTE_ID_MANIFEST_VERSION?key:BackupCodec.legacyAreaNoteKey(key);
  const holdsNote=entry=>entry.kind==='areaNote'&&noteIdOf(entry.key)===noteKey||entry.kind==='structuredPack'&&repositoryPackManifestMembers(entry.members).some(member=>member.kind==='areaNote'&&noteIdOf(member.key)===noteKey);
  const seenDates=new Set(),seenNoteKeys=new Set(),seenDraftDates=new Set(),structuredEntries=manifest.objects.filter(entry=>entry.kind!=='attachment'&&(!noteKey||holdsNote(entry)));
  const structuredPayloads=await mapRepositoryBounded(structuredEntries,async entry=>{
    throwIfImportAborted(signal);
    return readRepositoryStructuredObject(manifest,entry,readObject,{interactive,signal});
  });
  const logicalRows=[];for(const rows of structuredPayloads)logicalRows.push(...rows.filter(row=>!noteKey||row.kind==='areaNote'&&noteIdOf(row.key)===noteKey));logicalRows.sort((a,b)=>a.kind.localeCompare(b.kind)||a.key.localeCompare(b.key));
  for(const logical of logicalRows){
    throwIfImportAborted(signal);const entry=logical,payload=logical.payload;
    if(entry.kind==='dailyRecordPack'){
      if(!Array.isArray(payload))throw new Error('Repository Saved-Day pack is invalid.');
      for(const record of payload){const date=String(record&&record.date||'');if(repositoryMonth(date)!==entry.key||seenDates.has(date))throw new Error('Repository Saved-Day pack contains an invalid or duplicate date.');seenDates.add(date);dailyDocuments.push(record);}
    }else if(entry.kind==='areaNote'){
      if(!payload||typeof payload!=='object'||Array.isArray(payload)||String(payload.key||'')!==entry.key||seenNoteKeys.has(entry.key))throw new Error('Repository Ongoing Note object is invalid.');
      seenNoteKeys.add(entry.key);areaNoteItems.push(payload);
    }else if(entry.kind===LEGACY_REFLECTION_DRAFT_PACK_KIND){
      if(manifest.version>4||!Array.isArray(payload))throw new Error('Legacy repository Reflection Draft pack is invalid.');
      for(const draft of payload){const date=String(draft&&draft.date||'');if(repositoryMonth(date)!==entry.key||seenDraftDates.has(date))throw new Error('Legacy repository Reflection Draft pack contains an invalid or duplicate date.');seenDraftDates.add(date);legacyReflectionDraftCount++;}
    }else if(entry.kind==='activeSession'){
      if(entry.key!=='active'||activeSession!==null)throw new Error('Repository Active Session object is invalid.');activeSession=payload;
    }else if(entry.kind==='personalData'){
      if(entry.key!=='personal'||personalData!==null)throw new Error('Repository personal-data object is invalid.');personalData=payload;
    }else throw new Error(`Repository logical object kind ${entry.kind} is unsupported.`);
  }
  dailyDocuments.sort((a,b)=>String(a.date).localeCompare(String(b.date)));areaNoteItems.sort((a,b)=>String(a.key).localeCompare(String(b.key)));
  const counts=repositoryManifestCounts({checkpointManifest:1,personalData:personalData?1:0,dailyRecord:dailyDocuments.length,areaNote:areaNoteItems.length,activeSession:activeSession?1:0,reflectionDraft:legacyReflectionDraftCount},manifest.version);
  if(!noteKey&&!repositoryCountsEqualForManifest(counts,manifest.counts,manifest.version))throw new Error('Repository checkpoint counts do not match its reconstructed contents.');
  const referencedAttachmentIds=new Set(),attachmentLeases=new Map(),assetItems=[],noteAssetIds=noteKey?new Set(areaNoteItems.flatMap(item=>[...BackupCodec.assetIds(item)])):null;
  try{
    for(const raw of manifest.assets){
      if(noteAssetIds&&!noteAssetIds.has(raw.assetId))continue;
      throwIfImportAborted(signal);
      if(raw.missing===true){assetItems.push(freeze({descriptor:freeze({assetId:raw.assetId,missing:true}),blob:null}));continue;}
      const entry=objectById.get(raw.objectId);
      if(!entry||entry.kind!=='attachment')throw new Error(`Repository attachment ${raw.assetId} references an unavailable object.`);
      referencedAttachmentIds.add(entry.objectId);
      const descriptor=freeze({assetId:raw.assetId,mimeType:raw.mimeType,size:raw.size,checksum:raw.checksum,name:raw.name,library:raw.library});
      if(localAttachments&&entry.fingerprint===raw.checksum&&entry.sourceBytes===raw.size){const local=await localRepositoryAttachment(raw,{signal});if(local){assetItems.push(freeze({descriptor,blob:local}));continue;}}
      let opened=attachmentLeases.get(entry.objectId);
      if(!opened){opened=await openRepositoryAttachment(manifest,entry,raw,readObject,{interactive,signal});attachmentLeases.set(entry.objectId,opened);}
      else if(opened.blob.size!==raw.size||entry.fingerprint!==raw.checksum)throw new Error(`Repository attachment ${raw.assetId} shares an object with inconsistent metadata.`);
      assetItems.push(freeze({descriptor,blob:opened.blob}));
    }
    if(!noteKey)for(const entry of manifest.objects)if(entry.kind==='attachment'&&!referencedAttachmentIds.has(entry.objectId))throw new Error('Repository checkpoint contains an unreferenced attachment object.');
    const installationId=manifest.installationId||manifest.checkpoint.originInstallationId;
    const capture=freeze({
      format:LOGICAL_CHECKPOINT_CAPTURE_FORMAT,version:LOGICAL_CHECKPOINT_CAPTURE_VERSION,
      dailyDocuments:freeze(dailyDocuments),exportedAt:manifest.exportedAt,sourceRevision:manifest.sourceRevision,
      studentName:String(personalData&&personalData.preferences&&personalData.preferences.studentName||'Study Director'),installationId,checkpoint:manifest.checkpoint,
      recordDates:freeze(dailyDocuments.map(record=>String(record.date))),areaNoteItems:freeze(areaNoteItems),activeSession,personalData,
      savedDayDeletions:freeze([...(manifest.protectedCheckpointManifest.savedDayDeletions||[])]),areaNoteDeletions:freeze([...(manifest.protectedCheckpointManifest.areaNoteDeletions||[])]),attachmentDeletions:freeze([...(manifest.protectedCheckpointManifest.attachmentDeletions||[])]),counts,assetItems:freeze(assetItems),warning:manifest.warning,
      protectedCheckpointManifest:manifest.protectedCheckpointManifest,noteScope:noteKey
    });
    let released=false;
    const release=async()=>{if(released)return false;released=true;for(const opened of attachmentLeases.values())await opened.release().catch(()=>{});attachmentLeases.clear();return true;};
    return freeze({capture,release,repositoryCheckpoint:manifest.checkpoint,repositoryEncrypted:manifest.encrypted,verifiedSourceBytes:(noteKey?[...structuredEntries,...manifest.objects.filter(entry=>referencedAttachmentIds.has(entry.objectId))]:manifest.objects).reduce((total,entry)=>total+Math.max(0,Number(entry.sourceBytes)||0),0),storedBytes:manifest.objects.reduce((total,entry)=>total+Math.max(0,Number(entry.storedBytes)||0),0)});
  }catch(error){for(const opened of attachmentLeases.values())await opened.release().catch(()=>{});attachmentLeases.clear();throw error;}
}
async function inspectRepositoryCheckpoint(manifest,readObject,options={}){
  const signal=options.signal||currentImportSignal()||null,managedRecovery=options.managedRecovery;
  if(managedRecovery!==undefined&&managedRecovery!==null&&typeof managedRecovery!=='function')throw new TypeError('Managed repository recovery orchestration is invalid.');
  const normalizedManifest=validateRepositoryManifest(manifest),reconstructed=await reconstructVerifiedRepositoryCheckpoint(normalizedManifest,readObject,{interactive:options.interactive!==false,signal,note:typeof options.note==='string'?options.note:'',localAttachments:true});
  try{
    return await inspectVerifiedCapture(reconstructed.capture,freeze({signal,release:reconstructed.release,sourceEncrypted:normalizedManifest.encrypted,repositoryManifest:normalizedManifest,repositoryCommitted:options.committed===true,managedRecovery:managedRecovery||null,managedProgress:typeof options.managedProgress==='function'?options.managedProgress:null,verifiedSourceBytes:reconstructed.verifiedSourceBytes,storedBytes:reconstructed.storedBytes}));
  }catch(error){await reconstructed.release().catch(()=>{});throw error;}
}
async function verifyRepositoryCheckpoint(manifest,readObject,options={}){
  const signal=options.signal||currentImportSignal()||null,normalizedManifest=validateRepositoryManifest(manifest),reconstructed=await reconstructVerifiedRepositoryCheckpoint(normalizedManifest,readObject,{interactive:options.interactive===true,signal});
  try{return await verifyVerifiedCapture(reconstructed.capture,freeze({signal,sourceEncrypted:normalizedManifest.encrypted,repositoryManifest:normalizedManifest,verifiedSourceBytes:reconstructed.verifiedSourceBytes,storedBytes:reconstructed.storedBytes}));}
  finally{await reconstructed.release().catch(()=>{});}
}
async function releaseRepositoryCheckpoint(prepared){
  const state=repositoryPreparedState.get(prepared);if(!state||state.released)return false;state.released=true;repositoryPreparedState.delete(prepared);
  for(const release of state.leases.splice(0))await release().catch(()=>{});return true;
}
async function releaseRepositoryPublication(state){
  const {prepared,manifestFile}=state;state.prepared=null;state.manifestFile=null;state.commitMarker=null;
  await manifestFile?.release?.().catch(error=>AppDiagnostics.capture('repository.publication-release',error,'warn'));
  if(prepared)await releaseRepositoryCheckpoint(prepared).catch(error=>AppDiagnostics.capture('repository.publication-release',error,'warn'));
}
function createRepositoryPublication(){
  const state={prepared:null,manifestFile:null,commitMarker:null,busy:false,invalidated:false,settled:Promise.resolve(),releaseTask:null};
  const continuation=freeze({
    status:()=>freeze({pending:!!state.prepared,busy:state.busy,invalidated:state.invalidated,role:repositoryPreparedState.get(state.prepared)?.manifestBase.retention.role||'normal'}),
    release:()=>{state.invalidated=true;return state.releaseTask||(state.releaseTask=state.settled.then(()=>releaseRepositoryPublication(state)).finally(()=>repositoryPublicationStates.delete(continuation)));}
  });
  repositoryPublicationStates.set(continuation,state);return continuation;
}
async function refreshRepositoryPublicationProtection(state,options){
  const previous=repositoryPreparedState.get(state.prepared),context=await repositoryProtectionContext(options);
  if(!previous||previous.released||context.protectionId!==previous.context.protectionId||context.encrypted!==previous.context.encrypted)throw Object.assign(new Error('Backup encryption changed. Retry the backup with the current settings.'),{name:'AbortError',code:'BACKUP_POLICY_CHANGED'});
  if(previous.manifestBase.retention.role==='before-restore')await assertLogicalCheckpointCurrent(previous.capture);
  if(state.prepared.objects.some(entry=>entry.reused&&(options.availableObjectIds instanceof Set&&!options.availableObjectIds.has(entry.objectId)||(options.excludedObjectIds||[]).includes(entry.objectId))))throw Object.assign(new Error('A reusable backup object is no longer available. Prepare a fresh checkpoint.'),{code:'BACKUP_REPOSITORY_BASE_CHANGED'});
  // The immutable bytes outlive an attempt; its abort signal and file-worker
  // generation do not. Rebind policy checks without re-encrypting the payload.
  const prepared=freeze({...state.prepared,objects:freeze(state.prepared.objects.map(entry=>freeze({...entry,checkProtection:context.checkProtection})))});
  repositoryPreparedState.delete(state.prepared);previous.context=context;repositoryPreparedState.set(prepared,previous);state.prepared=prepared;
  if(state.manifestFile)state.manifestFile=freeze({...state.manifestFile,checkProtection:context.checkProtection});
  if(state.commitMarker)state.commitMarker=freeze({...state.commitMarker,checkProtection:context.checkProtection});
}
// The newest ordinary version a prepared backup would duplicate, if any: the
// same content (logical fingerprint) built from exactly the same stored
// objects, none of them new. A repair that replaces a damaged object, and a
// protected safety version, always get written.
function repositoryUnchangedVersion(history,prepared){
  const base=repositoryPreparedState.get(prepared)?.manifestBase;if(!base||base.retention?.role!=='normal'||prepared.objects.some(entry=>!entry.reused))return null;
  let newest=null;
  for(const manifest of Array.isArray(history)?history:[])if((manifest?.retention?.role||'normal')==='normal'&&(!newest||Date.parse(manifest.exportedAt)>Date.parse(newest.exportedAt)))newest=manifest;
  if(!newest||!newest.logicalFingerprint||newest.logicalFingerprint!==base.logicalFingerprint)return null;
  const ids=list=>(list||[]).map(entry=>String(entry.objectId)).sort().join('|');
  return ids(newest.objects)===ids(base.objects)?newest:null;
}
async function publishRepositoryCheckpoint(history,options={},transport={}){
  if(!transport||typeof transport!=='object'||typeof transport.writeObject!=='function'||typeof transport.writeManifest!=='function'||typeof transport.commit!=='function')throw new TypeError('Repository publication transport is invalid.');
  const continuation=options.continuation||null,state=continuation?repositoryPublicationStates.get(continuation):{prepared:null,manifestFile:null,commitMarker:null,busy:false,invalidated:false};
  if(!state||state.invalidated||state.busy)throw new TypeError('Repository publication continuation is unavailable or already running.');
  state.busy=true;let settle;state.settled=new Promise(resolve=>{settle=resolve;});
  let prepared=state.prepared,manifestFile=state.manifestFile,publication=null,commitReceipt=null,committed=false,retained=false;const written=[],warnings=[];
  const check=()=>{throwIfImportAborted(options.signal);if(state.invalidated)throw Object.assign(new Error('Repository publication was retired.'),{name:'AbortError',code:'BACKUP_SOURCE_FENCE_CHANGED'});};
  const postCommit=async(phase,message,work)=>{try{return await work();}catch(error){warnings.push(message);AppDiagnostics.capture(`repository.publication-${phase}`,error,'warn');return null;}};
  try{
    check();
    if(prepared){await refreshRepositoryPublicationProtection(state,options);prepared=state.prepared;manifestFile=state.manifestFile;}
    else{prepared=await prepareRepositoryCheckpoint(history,options);state.prepared=prepared;}
    check();
    // Nothing changed since the newest version: write nothing (no requests,
    // no history slot), but record that the current changes are backed up.
    const unchanged=repositoryUnchangedVersion(history,prepared);
    if(unchanged){
      const checkpointId=unchanged.checkpoint.checkpointId,publication=freeze({name:checkpointId+'.sdcheckpoint',unchanged:true}),objectsReused=prepared.objects.length;
      const context=freeze({prepared,manifest:unchanged,sourceRevision:prepared.sourceRevision,exportedAt:unchanged.exportedAt,publication,commitReceipt:null,objectsWritten:0,objectsReused,writtenBytes:0,attachmentBytesWritten:0,unchanged:true});
      const committedResult=typeof transport.onCommitted==='function'?await postCommit('bookkeeping','The backup was already up to date, but local backup status could not be updated.',()=>transport.onCommitted(context)):null;
      return freeze({checkpointId,manifest:unchanged,sourceRevision:prepared.sourceRevision,exportedAt:unchanged.exportedAt,publication,commitReceipt:null,objectsWritten:0,objectsReused,writtenBytes:0,attachmentBytesWritten:0,committedResult,cleanupResult:null,unchanged:true,warning:warnings.join(' ')});
    }
    let objectsWritten=0,objectsReused=0,writtenBytes=0,attachmentBytesWritten=0;
    const freshObjects=[];
    for(const entry of prepared.objects){if(entry.reused)objectsReused+=1;else freshObjects.push(entry);}
    const receipts=await mapRepositoryBounded(freshObjects,async entry=>{
      check();await entry.checkProtection?.();check();
      const receipt=await transport.writeObject(entry,prepared),row=freeze({entry,receipt});
      written.push(row);
      return row;
    },repositoryPublicationConcurrency(freshObjects));
    for(const row of receipts){
      objectsWritten+=1;writtenBytes+=Number(row.entry.storedBytes)||0;if(row.entry.kind==='attachment')attachmentBytesWritten+=Number(row.entry.sourceBytes)||0;
    }
    check();if(!manifestFile){manifestFile=await finalizeRepositoryCheckpointManifest(prepared,options);state.manifestFile=manifestFile;}
    await manifestFile.checkProtection?.();await manifestFile.checkSource?.();check();
    publication=await transport.writeManifest(manifestFile,prepared);
    await manifestFile.checkSource?.();
    check();const commitMarker=state.commitMarker||(state.commitMarker=await createRepositoryCommitMarker(manifestFile.manifest,{checkProtection:manifestFile.checkProtection,checkSource:manifestFile.checkSource,signal:options.signal||null}));check();
    commitReceipt=await transport.commit(commitMarker,prepared,publication);
    committed=true;
    const baseEstablished=await postCommit('reconciliation-base','The checkpoint was saved and verified, but local reconciliation ancestry could not be updated. A later backup will retry completion bookkeeping.',async()=>{await establishRepositoryReconciliationBase(prepared);return true;});
    const context=freeze({prepared,manifest:manifestFile.manifest,sourceRevision:manifestFile.sourceRevision,exportedAt:manifestFile.exportedAt,publication,commitReceipt,objectsWritten,objectsReused,writtenBytes,attachmentBytesWritten});
    const committedResult=baseEstablished&&typeof transport.onCommitted==='function'?await postCommit('bookkeeping','The checkpoint was saved and verified, but local backup status could not be updated. A later backup will retry completion bookkeeping.',()=>transport.onCommitted(context)):null;
    const cleanupResult=typeof transport.cleanup==='function'?await postCommit('retention-cleanup','The checkpoint was saved and verified, but repository retention cleanup did not complete.',()=>transport.cleanup(freeze({...context,committedResult}))):null;
    return freeze({checkpointId:manifestFile.manifest.checkpoint.checkpointId,manifest:manifestFile.manifest,sourceRevision:manifestFile.sourceRevision,exportedAt:manifestFile.exportedAt,publication,commitReceipt,objectsWritten,objectsReused,writtenBytes,attachmentBytesWritten,committedResult,cleanupResult,warning:warnings.join(' ')});
  }catch(error){
    if(['BACKUP_POLICY_CHANGED','BACKUP_SOURCE_FENCE_CHANGED','BACKUP_REPOSITORY_BASE_CHANGED'].includes(String(error?.code||'')))state.invalidated=true;
    if(continuation&&state.prepared&&!state.invalidated&&!committed&&typeof transport.retainOnFailure==='function')try{retained=await transport.retainOnFailure(error)===true;}catch(retainError){AppDiagnostics.capture('repository.publication-retain',retainError,'warn');}
    if(typeof transport.onFailure==='function')try{await transport.onFailure(error,freeze({prepared,publication,commitReceipt,committed,retained,written:freeze([...written])}));}catch(cleanupError){AppDiagnostics.capture('repository.publication-cleanup',cleanupError,'warn');}
    throw error;
  }finally{
    if(!retained||state.invalidated)await releaseRepositoryPublication(state);
    state.busy=false;settle();
  }
}

    return freeze({
      format:'study-director.managed-repository',contractVersion:1,noteIdManifestVersion:REPOSITORY_NOTE_ID_MANIFEST_VERSION,
      createPublication:createRepositoryPublication,publish:publishRepositoryCheckpoint,inspectManifest:inspectRepositoryManifest,inspect:inspectRepositoryCheckpoint,verifyCheckpoint:verifyRepositoryCheckpoint,verifyObject:verifyRepositoryObject,scrub:scrubRepositoryIntegrity,cleanup:cleanupRepositoryRetention,inspectCommit:inspectRepositoryCommitMarker,
      retention:REPOSITORY_RETENTION_POLICY,validatePolicy:validateRepositoryRetentionPolicy,classifyState:classifyRepositoryState,activeProtected:activeProtectedRepositoryRow,selectRetention:selectRepositoryRetention,projectHistory:projectManagedRepositoryHistory,invalidatePreparation:invalidateRepositoryPreparation
    });
  }
  return freeze({format:'study-director.managed-repository-module',contractVersion:1,createEngine});
});
})();
