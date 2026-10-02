(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('compatibility',1,()=>{
  const freeze=Object.freeze;
  // This is the only historical IndexedDB-layout decision exposed to persistence.
  // Deleting the compatibility module later removes the old-version branch while
  // leaving generic onupgradeneeded/store-creation infrastructure intact.
  function applyIndexedDbUpgrade({oldVersion,db,transaction,appMetaStore,dailyRecordMigrationKey}){
    const version=Math.max(0,Number(oldVersion)||0);
    if(version>=3||!transaction||!db.objectStoreNames.contains(appMetaStore))return false;
    transaction.objectStore(appMetaStore).put({
      key:dailyRecordMigrationKey,
      version:1,
      value:{complete:false,reason:'indexeddb-pre-v3'},
      updatedAt:new Date().toISOString()
    });
    return true;
  }
  function createFacade(input){
    exactObject(input,['baselineId','live','backups','verification'],'Compatibility facade input');
    if(typeof input.baselineId!=='string'||!input.baselineId)throw new TypeError('Compatibility baseline identity is required.');
    functions(input.live,[
      'cleanupLegacyStorage','migratePlan','migrateReflections','migrateHostMetadata','migrateActiveSession','migrateAreaNotes','migrateAreaNoteRecovery','migrateDailyRecords','migrateDeletionState','migrateInsightsRevisionEnvelope','cleanupLegacyAttachments','cleanupObsoleteMetadata','retireTopology','retireLegacyIdentity'
    ],'Compatibility live adapters');
    functions(input.backups,['inspectCurrent','inspectLegacy'],'Compatibility backup adapters');
    functions(input.verification,['planLegacy','reflectionLegacy','activeSession','areaNotes','areaNoteRecovery','dailyRecords','deletionState','insightsRevisionEnvelope','canonicalStores','legacyStorage','legacyAttachments','obsoleteMetadata','topology','retiredIdentity','retiredHostCompatibility','freshBackup'],'Compatibility verification adapters');
    let liveRun=null,lastReport=null,lastVerification=null;
    const retryableResult=value=>!!(value&&typeof value==='object'&&value.status==='skipped'&&value.reason==='not-primary');
    async function proof(name,operation){
      try{
        const value=await operation();
        if(value===true)return freeze({ok:true});
        if(value===false||value==null)return freeze({ok:false,reason:`${name}-not-proven`});
        if(typeof value!=='object')return freeze({ok:false,reason:`${name}-invalid-proof`});
        return freeze({...value,ok:value.ok===true});
      }catch(error){return freeze({ok:false,reason:`${name}-verification-failed`,error:String(error&&error.message||error||'verification failed')});}
    }
    const localCanonicalChecks=freeze([
      ['planLegacy',input.verification.planLegacy],['reflectionLegacy',input.verification.reflectionLegacy],['activeSession',input.verification.activeSession],
      ['areaNotes',input.verification.areaNotes],['areaNoteRecovery',input.verification.areaNoteRecovery],['dailyRecords',input.verification.dailyRecords],['deletionState',input.verification.deletionState],
      ['insightsRevisionEnvelope',input.verification.insightsRevisionEnvelope],['canonicalStores',input.verification.canonicalStores],['legacyStorage',input.verification.legacyStorage],['legacyAttachments',input.verification.legacyAttachments],
      ['obsoleteMetadata',input.verification.obsoleteMetadata]
    ]);
    async function verifyChecks(entries){
      const checks={};
      for(const [name,operation] of entries)checks[name]=await proof(name,operation);
      return checks;
    }
    const deferredCanonicalChecks=freeze([...localCanonicalChecks,['retiredIdentity',input.verification.retiredIdentity]]);
    async function migrateLive(){
      if(liveRun)return liveRun;
      liveRun=(async()=>{
        const results={};
        // Ordering is deliberate: migrate sources before generic residue cleanup.
        // Legacy localStorage may still contain the only copy of Plan/preferences,
        // Active Session recovery, or Area Note recovery data. Retired standalone
        // Reflection Draft keys are deliberately discarded by their compatibility step.
        results.plan=await input.live.migratePlan();
        results.reflections=await input.live.migrateReflections();
        results.activeSession=await input.live.migrateActiveSession();
        results.areaNotes=await input.live.migrateAreaNotes();
        results.areaNoteRecovery=await input.live.migrateAreaNoteRecovery();
        results.dailyRecords=await input.live.migrateDailyRecords();
        results.deletionState=await input.live.migrateDeletionState();
        results.insightsRevisionEnvelope=await input.live.migrateInsightsRevisionEnvelope();
        results.hostMetadata=await input.live.migrateHostMetadata();
        results.attachments=await input.live.cleanupLegacyAttachments();
        results.obsoleteMetadata=await input.live.cleanupObsoleteMetadata();
        results.legacyStorage=await input.live.cleanupLegacyStorage();
        if(Object.values(results).some(retryableResult)){
          // A secondary tab may continue only when migration is unnecessary because
          // every runtime-facing local surface is already current canonical state.
          // Historical data must never leak into ordinary hydration as a fallback.
          const deferredProof=await verifyChecks(deferredCanonicalChecks);
          const failed=Object.entries(deferredProof).filter(([,value])=>value.ok!==true).map(([name])=>name);
          if(failed.length)throw new Error(`Canonical migration must complete in the primary tab before runtime hydration: ${failed.join(', ')}`);
          lastVerification=null;
          lastReport=freeze({format:'study-director.compatibility-migration-report',contractVersion:2,baselineId:input.baselineId,completedAt:new Date().toISOString(),results:freeze(results),deferredProof:freeze(deferredProof)});
          liveRun=null;
          return lastReport;
        }
        // B4 retirement is fail-closed: prove every local canonical surface before
        // physically removing retired compatibility stores or legacy identity.
        const preRetirement=await verifyChecks(localCanonicalChecks);
        const failed=Object.entries(preRetirement).filter(([,value])=>value.ok!==true).map(([name])=>name);
        if(failed.length)throw new Error(`Canonical migration verification failed before topology retirement: ${failed.join(', ')}`);
        results.topology=await input.live.retireTopology();
        const topologyProof=await proof('topology',input.verification.topology);
        if(!topologyProof.ok)throw new Error('IndexedDB topology retirement could not be verified.');
        results.retiredIdentity=await input.live.retireLegacyIdentity();
        const identityProof=await proof('retiredIdentity',input.verification.retiredIdentity);
        if(!identityProof.ok)throw new Error('Legacy device identity retirement could not be verified.');
        lastVerification=null;
        lastReport=freeze({
          format:'study-director.compatibility-migration-report',contractVersion:2,
          baselineId:input.baselineId,completedAt:new Date().toISOString(),results:freeze(results),
          preRetirement:freeze(preRetirement),retirementProof:freeze({topology:topologyProof,retiredIdentity:identityProof})
        });
        return lastReport;
      })().catch(error=>{liveRun=null;throw error;});
      return liveRun;
    }

    async function inspectBackup(file,options={}){
      try{return await input.backups.inspectCurrent(file,options);}
      catch(error){
        if(error&&error.code==='STUDY_DIRECTOR_LEGACY_BACKUP')return input.backups.inspectLegacy(file,options);
        throw error;
      }
    }
    async function verifyCanonicalInstallation(){
      const checks={};
      for(const [name,operation] of [
        ['planLegacy',input.verification.planLegacy],['reflectionLegacy',input.verification.reflectionLegacy],['activeSession',input.verification.activeSession],
        ['areaNotes',input.verification.areaNotes],['areaNoteRecovery',input.verification.areaNoteRecovery],['dailyRecords',input.verification.dailyRecords],['deletionState',input.verification.deletionState],
        ['insightsRevisionEnvelope',input.verification.insightsRevisionEnvelope],['canonicalStores',input.verification.canonicalStores],['legacyStorage',input.verification.legacyStorage],['legacyAttachments',input.verification.legacyAttachments],
        ['obsoleteMetadata',input.verification.obsoleteMetadata],['topology',input.verification.topology],['retiredIdentity',input.verification.retiredIdentity],['retiredHostCompatibility',input.verification.retiredHostCompatibility],['freshBackup',input.verification.freshBackup]
      ])checks[name]=await proof(name,operation);
      const canonicalNames=['planLegacy','reflectionLegacy','activeSession','areaNotes','areaNoteRecovery','dailyRecords','deletionState','insightsRevisionEnvelope','canonicalStores','legacyStorage','legacyAttachments','obsoleteMetadata','topology','retiredIdentity'];
      const canonical=canonicalNames.every(name=>checks[name].ok===true),backupReady=checks.freshBackup.ok===true,compatibilityRetired=checks.retiredHostCompatibility.ok===true;
      lastVerification=freeze({
        format:'study-director.canonical-installation-proof',contractVersion:1,baselineId:input.baselineId,
        checkedAt:new Date().toISOString(),canonical,backupReady,compatibilityRetired,retirementDataReady:canonical&&backupReady&&compatibilityRetired,checks:freeze(checks)
      });
      return lastVerification;
    }
    function status(){
      const migrated=!!(lastReport&&!Object.values(lastReport.results||{}).some(retryableResult));
      return freeze({format:'study-director.compatibility-status',contractVersion:1,baselineId:input.baselineId,migrated,lastReport,lastVerification});
    }
    return freeze({format:'study-director.compatibility-facade',contractVersion:1,migrateLive,inspectBackup,verifyCanonicalInstallation,status});
  }
  return freeze({format:'study-director.compatibility-module',contractVersion:1,applyIndexedDbUpgrade,createFacade});
});
})();
