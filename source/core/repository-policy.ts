import type {PilotRegistry} from '../../types/pilot.ts';
(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:PilotRegistry|undefined})[Symbol.for('studyDirector.internalModules.v1')];
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
    // An upload marker that says it renews is refreshed while its upload
    // runs. One left unrefreshed this long was abandoned (a closed or frozen
    // page), so cleanup removes it instead of waiting out the full day.
    // A marker without that promise, from an older build, keeps the full day.
    publicationRenewMs:2*60*1000,
    publicationStaleMs:15*60*1000,
    maintenanceWorkBudgetMs,
    maintenanceReleaseGraceMs,
    maintenanceMaxAgeMs:maintenanceWorkBudgetMs+maintenanceReleaseGraceMs,
    maintenanceAssertionMarginMs:maintenanceReleaseGraceMs,
    // Network coordination needs room for acquisition, overlap verification,
    // retirement, assertion and the protected request. This is not a work budget.
    driveMetadataTimeoutMs,
    driveMaintenanceMaxAgeMs:6*driveMetadataTimeoutMs+maintenanceReleaseGraceMs,
    driveMaintenanceAssertionMarginMs:driveMetadataTimeoutMs+maintenanceReleaseGraceMs,
    objectGcGraceMs:48*60*60*1000,
    // Automatic backups, the same for every location: within 20 minutes of
    // the first change not yet backed up, within seconds of a key moment
    // (finishing the day, saving a day to Library), and before a sign-in that
    // expires (Google Drive's lasts about an hour) runs out.
    automaticQuietMs:20*60*1000,
    automaticUrgentMs:3*1000,
    automaticExpiryLeadMs:5*60*1000
  });
  return freeze({format:'study-director.repository-policy-module',contractVersion:1,protocol});
});
})();
