(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
registry.define('repository-policy',1,()=>{
  const freeze=Object.freeze;
  const maintenanceWorkBudgetMs=30*1000,maintenanceReleaseGraceMs=maintenanceWorkBudgetMs;
  const driveMetadataTimeoutMs=45*1000;
  const protocol=freeze({
    publicationMaxAgeMs:24*60*60*1000,
    publicationAssertionMarginMs:30*60*1000,
    maintenanceWorkBudgetMs,
    maintenanceReleaseGraceMs,
    maintenanceMaxAgeMs:maintenanceWorkBudgetMs+maintenanceReleaseGraceMs,
    maintenanceAssertionMarginMs:maintenanceReleaseGraceMs,
    // Network coordination needs room for acquisition, overlap verification,
    // retirement, assertion and the protected request. This is not a work budget.
    driveMetadataTimeoutMs,
    driveMaintenanceMaxAgeMs:6*driveMetadataTimeoutMs+maintenanceReleaseGraceMs,
    driveMaintenanceAssertionMarginMs:driveMetadataTimeoutMs+maintenanceReleaseGraceMs,
    objectGcGraceMs:48*60*60*1000
  });
  return freeze({format:'study-director.repository-policy-module',contractVersion:1,protocol});
});
})();
