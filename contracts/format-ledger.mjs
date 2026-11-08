import {CURRENT_SCHEMA_VERSIONS,EXTERNAL_FORMATS} from './canonical-identities.mjs';
const freeze=Object.freeze;

// Current-only formats that travel between devices. Unsupported versions are
// refused without rewriting them. Historical readers/upgrades are intentionally
// absent on TS-Conversion; the owner assumes every installation is current.
export const SYNCED_RECORDS=freeze(['DailyRecord','Note','ActiveSession','SessionSnapshot','PendingReview','CheckpointMetadata','CheckpointProtectedManifest']);
// Stored on this device only: their own version is checked when read here.
export const LOCAL_RECORDS=freeze(['DailySummary','LocalRecoveryEnvelope','AppMeta']);
const row=value=>freeze({...value,records:freeze({...value.records})});
export const SYNCED_FORMAT_LEDGER=freeze([
  // Kept versions name their device (PendingReview 2); the claim names the
  // handoff and the content it observed (claim 4).
  row({release:'current',backup:24,manifest:9,claim:4,personalData:2,
    records:{DailyRecord:16,Note:3,ActiveSession:10,SessionSnapshot:6,PendingReview:2,CheckpointMetadata:1,CheckpointProtectedManifest:3}})
]);
export const CURRENT_SYNCED_FORMATS=freeze({backup:EXTERNAL_FORMATS.completeBackup.metadataVersion,records:freeze(Object.fromEntries(SYNCED_RECORDS.map(name=>[name,CURRENT_SCHEMA_VERSIONS[name]])))});
