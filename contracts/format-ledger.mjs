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
// One row per set of synced forms, oldest first, starting with the oldest
// build still in use. Changing a synced form: raise its version, raise
// `backup` and `manifest` (and `claim` for the claim), read the older form
// through the compatibility layer, and add a row here
// (docs/areas/data-and-storage.md#changing-a-synced-form).
// tests/architecture/storage/format-ledger.mjs checks the rows against the code.
export const SYNCED_RECORDS=freeze(['DailyRecord','Note','ActiveSession','SessionSnapshot','PendingReview','CheckpointMetadata','CheckpointProtectedManifest']);
// Stored on this device only: their own version is checked when read here.
export const LOCAL_RECORDS=freeze(['DailySummary','LocalRecoveryEnvelope','AppMeta']);
const row=value=>freeze({...value,records:freeze({...value.records})});
export const SYNCED_FORMAT_LEDGER=freeze([
  row({release:'SDVB75F18',backup:23,manifest:8,claim:2,personalData:2,
    records:{DailyRecord:16,Note:3,ActiveSession:10,SessionSnapshot:6,PendingReview:1,CheckpointMetadata:1,CheckpointProtectedManifest:3}}),
  // Kept versions name their device (PendingReview 2); the claim names the
  // handoff and the content it observed (claim 4).
  row({release:'current',backup:24,manifest:9,claim:4,personalData:2,
    records:{DailyRecord:16,Note:3,ActiveSession:10,SessionSnapshot:6,PendingReview:2,CheckpointMetadata:1,CheckpointProtectedManifest:3}})
]);
export const CURRENT_SYNCED_FORMATS=freeze({backup:EXTERNAL_FORMATS.completeBackup.metadataVersion,records:freeze(Object.fromEntries(SYNCED_RECORDS.map(name=>[name,CURRENT_SCHEMA_VERSIONS[name]])))});
