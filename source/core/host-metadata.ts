import type {BrowserRegistry} from '../../types/browser-registry.ts';
import type {HostMetaInput,HostMetaFamily} from '../../types/host-metadata.ts';
import type {MetaContext,MetaValidator} from '../../types/app-meta.ts';
(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:BrowserRegistry|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('host-metadata',1,()=>{
  const freeze=Object.freeze;
  function exactKeys<K extends string>(value:unknown,keys:readonly K[]):value is Record<K,unknown>{return !!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|'));}
  function createAppMetaValidators(input:HostMetaInput){
    exactObject(input,['keys','same','normalizers'],'Host metadata validator input');
    exactObject(input.keys,['verifiedRecoveryBackups','backupProtection','attachmentIntegrityAudit','deviceFolder','repositoryIntegrityScrub','managedProviderBackupPending','repositoryMaintenancePending','reconciliationBase','reconciliationBaseNotePrefix','reconciliationBaseDayPrefix'],'Host metadata keys');
    functions(input.normalizers,['verifiedRecovery','attachmentIntegrity','repositoryIntegrity','reconciliationBase','reconciliationBaseNote','reconciliationBaseDays'],'Host metadata normalizers');
    if(typeof input.same!=='function')throw new TypeError('Host metadata equality helper is required.');
    const keys=input.keys,normalizers=input.normalizers,same=input.same;
    function canonical(key:string,raw:unknown){
      const value=raw as Partial<Record<'version'|'key'|'format'|'entries'|'directoryHandle'|'baseline'|'id'|'verifier'|'setAt',unknown>>|null|undefined;
      if(key===keys.verifiedRecoveryBackups)return same(value,normalizers.verifiedRecovery(value));
      if(key===keys.backupProtection){const version=Number(value&&value.version),stored=value&&value.key;return !!(value&&exactKeys(value,['version','id','verifier','key','setAt'])&&version===3&&typeof value.id==='string'&&value.id.length>0&&value.id.length<=128&&value.verifier instanceof Blob&&value.verifier.size>0&&value.verifier.size<=1024*1024&&(stored===null||typeof CryptoKey!=='undefined'&&stored instanceof CryptoKey&&stored.type==='secret'&&stored.algorithm?.name==='PBKDF2'&&stored.extractable===false)&&Number.isFinite(Date.parse(String(value.setAt))));}
      if(key===keys.attachmentIntegrityAudit)return same(value,normalizers.attachmentIntegrity(value));
      if(key===keys.repositoryIntegrityScrub)return same(value,normalizers.repositoryIntegrity(value));
      if(key===keys.managedProviderBackupPending){
        if(!value||!exactKeys(value,['format','version','entries'])||value.format!=='study-director.managed-provider-backup-pending'||Number(value.version)!==1||!Array.isArray(value.entries)||value.entries.length>8)return false;
        const seen=new Set();
        for(const entry of value.entries as unknown[]){
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
        for(const entry of value.entries as unknown[]){
          if(!entry||!exactKeys(entry,['providerId','requestedAt','nextEligibleAt','reason','repositoryScope','requestId'])||typeof entry.requestId!=='string')return false;
          const providerId=String(entry.providerId||''),requestedAt=String(entry.requestedAt||''),nextEligibleAt=String(entry.nextEligibleAt||''),reason=String(entry.reason||''),repositoryScope=String(entry.repositoryScope||''),requestId=entry.requestId;
          if(!/^[a-z][a-z0-9-]{0,40}$/u.test(providerId)||seen.has(providerId)||!Number.isFinite(Date.parse(requestedAt))||!Number.isFinite(Date.parse(nextEligibleAt))||!/^[a-z][a-z0-9-]{0,47}$/u.test(reason)||repositoryScope.length>320||requestId&&!/^[a-f0-9-]{36}$/u.test(requestId))return false;seen.add(providerId);
        }
        return true;
      }
      if(key===keys.reconciliationBase)return same(value,normalizers.reconciliationBase(value));
      if(key===keys.deviceFolder){
        if(!value||!exactKeys(value,['format','version','directoryHandle','baseline'])||value.format!=='study-director.device-folder-settings'||Number(value.version)!==4)return false;
        const handle=value.directoryHandle as {getFileHandle?:unknown;getDirectoryHandle?:unknown;queryPermission?:unknown}|null|undefined,baseline=String(value.baseline||'');
        return !!(handle&&typeof handle.getFileHandle==='function'&&typeof handle.getDirectoryHandle==='function'&&typeof handle.queryPermission==='function'&&(!baseline||Number.isFinite(Date.parse(baseline))));
      }
      return false;
    }
    const validator:MetaValidator=(value,context)=>canonical(context.key,value)===true;
    const reconciliationNoteValidator:MetaValidator=(value,context)=>same(value,normalizers.reconciliationBaseNote(value,context))===true;
    const reconciliationDaysValidator:MetaValidator=(value,context)=>same(value,normalizers.reconciliationBaseDays(value,context))===true;
    return freeze({
      verifiedRecoveryBackups:validator,backupProtection:validator,attachmentIntegrityAudit:validator,
      deviceFolder:validator,repositoryIntegrityScrub:validator,managedProviderBackupPending:validator,repositoryMaintenancePending:validator,
      reconciliationBase:validator,reconciliationBaseNotePrefix:reconciliationNoteValidator,reconciliationBaseDayPrefix:reconciliationDaysValidator
    });
  }
  return freeze({format:'study-director.host-metadata-module',contractVersion:1,createAppMetaValidators});
});
})();
