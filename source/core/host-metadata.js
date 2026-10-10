(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('host-metadata',1,()=>{
  const freeze=Object.freeze;
  function exactKeys(value,keys){return !!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|'));}
  function createAppMetaValidators(input){
    exactObject(input,['keys','same','normalizers'],'Host metadata validator input');
    exactObject(input.keys,['verifiedRecoveryBackups','backupProtection','attachmentIntegrityAudit','automaticDeviceBackup','repositoryIntegrityScrub','managedProviderBackupPending','repositoryMaintenancePending','reconciliationBase','reconciliationBaseNotePrefix'],'Host metadata keys');
    functions(input.normalizers,['verifiedRecovery','attachmentIntegrity','repositoryIntegrity','reconciliationBase','reconciliationBaseNote'],'Host metadata normalizers');
    if(typeof input.same!=='function')throw new TypeError('Host metadata equality helper is required.');
    const keys=input.keys,normalizers=input.normalizers,same=input.same;
    function canonical(key,value){
      if(key===keys.verifiedRecoveryBackups)return same(value,normalizers.verifiedRecovery(value));
      if(key===keys.backupProtection){const version=Number(value&&value.version);return !!(value&&exactKeys(value,['version','id','verifier'])&&version===2&&typeof value.id==='string'&&value.id.length>0&&value.id.length<=128&&value.verifier instanceof Blob&&value.verifier.size>0&&value.verifier.size<=1024*1024);}
      if(key===keys.attachmentIntegrityAudit)return same(value,normalizers.attachmentIntegrity(value));
      if(key===keys.repositoryIntegrityScrub)return same(value,normalizers.repositoryIntegrity(value));
      if(key===keys.managedProviderBackupPending){
        if(!value||!exactKeys(value,['format','version','entries'])||value.format!=='study-director.managed-provider-backup-pending'||Number(value.version)!==1||!Array.isArray(value.entries)||value.entries.length>8)return false;
        const seen=new Set();
        for(const entry of value.entries){
          if(!entry||!exactKeys(entry,['providerId','requestedAt','sourceRevision']))return false;
          const providerId=String(entry.providerId||''),requestedAt=String(entry.requestedAt||''),sourceRevision=String(entry.sourceRevision||'');
          if(!/^[a-z][a-z0-9-]{0,40}$/u.test(providerId)||seen.has(providerId)||!Number.isFinite(Date.parse(requestedAt))||!Number.isFinite(Date.parse(sourceRevision)))return false;
          seen.add(providerId);
        }
        return true;
      }
      if(key===keys.repositoryMaintenancePending){
        if(!value||!exactKeys(value,['format','version','entries'])||value.format!=='study-director.repository-maintenance-pending'||Number(value.version)!==4||!Array.isArray(value.entries)||value.entries.length>8)return false;
        const seen=new Set();
        for(const entry of value.entries){
          if(!entry||!exactKeys(entry,['providerId','requestedAt','nextEligibleAt','reason','repositoryScope','requestId'])||typeof entry.requestId!=='string')return false;
          const providerId=String(entry.providerId||''),requestedAt=String(entry.requestedAt||''),nextEligibleAt=String(entry.nextEligibleAt||''),reason=String(entry.reason||''),repositoryScope=String(entry.repositoryScope||''),requestId=entry.requestId;
          if(!/^[a-z][a-z0-9-]{0,40}$/u.test(providerId)||seen.has(providerId)||!Number.isFinite(Date.parse(requestedAt))||!Number.isFinite(Date.parse(nextEligibleAt))||!/^[a-z][a-z0-9-]{0,47}$/u.test(reason)||repositoryScope.length>320||requestId&&!/^[a-f0-9-]{36}$/u.test(requestId))return false;seen.add(providerId);
        }
        return true;
      }
      if(key===keys.reconciliationBase)return same(value,normalizers.reconciliationBase(value));
      if(key===keys.automaticDeviceBackup){
        if(!value||!exactKeys(value,['format','version','enabled','directoryHandle','lastBackupAt','lastFilename','sourceRevision'])||value.format!=='study-director.device-backup-settings'||Number(value.version)!==3||value.enabled!==true)return false;
        const handle=value.directoryHandle,filename=String(value.lastFilename||''),backupAt=String(value.lastBackupAt||''),source=String(value.sourceRevision||'');
        return !!(handle&&typeof handle.getFileHandle==='function'&&typeof handle.getDirectoryHandle==='function'&&typeof handle.queryPermission==='function'&&(!filename||/^cp_[a-f0-9]{32}\.sdcheckpoint$/u.test(filename))&&(!backupAt||Number.isFinite(Date.parse(backupAt)))&&(!source||Number.isFinite(Date.parse(source))));
      }
      return false;
    }
    const validator=(value,context)=>canonical(context.key,value)===true;
    const reconciliationNoteValidator=(value,context)=>same(value,normalizers.reconciliationBaseNote(value,context))===true;
    return freeze({
      verifiedRecoveryBackups:validator,backupProtection:validator,attachmentIntegrityAudit:validator,
      automaticDeviceBackup:validator,repositoryIntegrityScrub:validator,managedProviderBackupPending:validator,repositoryMaintenancePending:validator,
      reconciliationBase:validator,reconciliationBaseNotePrefix:reconciliationNoteValidator
    });
  }
  return freeze({format:'study-director.host-metadata-module',contractVersion:1,createAppMetaValidators});
});
})();
