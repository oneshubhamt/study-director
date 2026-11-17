import {CURRENT_SCHEMA_VERSIONS,EXTERNAL_FORMATS} from './canonical-identities.mjs';
const freeze=Object.freeze;

// How an older build knows it cannot read synced data. Every form that
// travels between devices (in backup files and Drive or Device Folder
// versions, and the Continue Here claim) is read inside a container whose
// version every build checks first: a newer one is kept as it is, nothing is
// uploaded over it, and the app asks for an update. So a form that changes
// must raise its container's version; otherwise an older build would read
// the new form as damaged, or misread it.
//
// Current canonical baseline only. Future shape changes must raise their
// container versions and explicitly define rollout; no older-form readers
// ship in this build. Git history records retired baselines.
export const SYNCED_RECORDS=freeze(['DailyRecord','Note','ActiveSession','SessionSnapshot','PendingReview','CheckpointMetadata','CheckpointProtectedManifest']);
// Stored on this device only: their own version is checked when read here.
export const LOCAL_RECORDS=freeze(['DailySummary','LocalRecoveryEnvelope','AppMeta']);
const row=value=>freeze({...value,records:freeze({...value.records})});
export const SYNCED_FORMAT_LEDGER=freeze([
  row({release:'current',backup:26,manifest:11,claim:4,personalData:2,
    records:{DailyRecord:16,Note:3,ActiveSession:11,SessionSnapshot:6,PendingReview:2,CheckpointMetadata:1,CheckpointProtectedManifest:3}})
]);
export const CURRENT_SYNCED_FORMATS=freeze({backup:EXTERNAL_FORMATS.completeBackup.metadataVersion,records:freeze(Object.fromEntries(SYNCED_RECORDS.map(name=>[name,CURRENT_SCHEMA_VERSIONS[name]])))});
