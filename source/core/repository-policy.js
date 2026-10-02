(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
registry.define('repository-policy',1,()=>{
  const freeze=Object.freeze;
  const maintenanceWorkBudgetMs=30*1000,maintenanceReleaseGraceMs=maintenanceWorkBudgetMs;
  const protocol=freeze({
    publicationMaxAgeMs:24*60*60*1000,
    publicationAssertionMarginMs:30*60*1000,
    maintenanceWorkBudgetMs,
    maintenanceReleaseGraceMs,
    maintenanceMaxAgeMs:maintenanceWorkBudgetMs+maintenanceReleaseGraceMs,
    maintenanceAssertionMarginMs:maintenanceReleaseGraceMs,
    objectGcGraceMs:48*60*60*1000
  });
  return freeze({format:'study-director.repository-policy-module',contractVersion:1,protocol});
});
})();
