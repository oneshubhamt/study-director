const MiB=1024*1024;
const GiB=1024*MiB;
const KiB=1024;

export const PRODUCTION_LIMITS=Object.freeze({
  minSupportedSavedDate:'2025-01-01',
  importBytes:20*MiB,
  backupMaxCompressedBytes:128*MiB,
  backupMaxFileBytes:Number.MAX_SAFE_INTEGER,
  backupMaxAssetDescriptors:50000,
  richAssetMaxBytes:12*MiB,
  attachmentPdfAudioMaxBytes:2*GiB,
  richAssetMaxPerDocument:20,
  richAssetMaxBytesPerDocument:64*MiB,
  richAssetMaxAltChars:120,
  richAssetMaxDimensionPx:4096,
  richAssetMaxPixels:12*1024*1024,
  backupMaxUncompressedBytes:512*MiB,
  // One entry holds a whole note, Saved Day or session. JSON escaping at most
  // doubles a rich value, so this stays above twice maxRichTextBytes.
  backupMaxEntryBytes:5*MiB,
  backupMaxLineBytes:16*MiB,
  backupChunkTargetBytes:512*KiB,
  backupChunkItems:100,
  backupImportBatchSize:250,
  maxLegacyImportTombstones:30000,
  maxBackupChunks:25000,
  maxImportRecords:10000,
  maxScheduleRows:160,
  maxTasksPerDay:160,
  maxScheduleChars:100000,
  maxStudentNameChars:80,
  maxSearchChars:500,
  maxBackupFilenameChars:160,
  maxReflectionChars:70000,
  maxQuoteChars:1000,
  maxNoteChars:70000,
  maxCarryForwardChars:10000,
  maxRichTextWords:20000,
  // Blocks and text runs in one rich document: three per word, as before.
  maxRichTextNodes:60000,
  // Room for maxRichTextWords of three-byte text (such as Hindi) plus formatting.
  maxRichTextBytes:2*MiB,
  // Historical runtime size references; package sizes are informational from SDVB72B.
  richRuntimeMaxRawBytes:334*KiB,
  richRuntimeMaxGzipBytes:106*KiB,
  // Live, imported and backed-up Ongoing Notes, and their deletion records.
  // Recently deleted counts towards it but gives way.
  maxOngoingNotes:2000,
  // Days a deleted Ongoing Note stays in Recently deleted.
  areaNoteTrashDays:30,
  // Notes one note's linked-notes bar can hold.
  maxNoteLinks:50,
  maxTaskNameChars:160,
  maxAreaNameChars:160,
  maxUnitChars:40,
  maxDurationMinutes:1440,
  maxStatusMessageChars:2000,
  maxLiveSessionsPerTask:32,
  maxPauseEventsPerTask:96,
  maxPracticeRunsPerDay:24,
  maxPracticeUnitsPerRun:500,
  maxPracticeUnitsPerDay:512,
  maxPracticePlanGroups:32,
  maxPracticeMarksPerUnit:10000,
  minPracticeTargetMs:5000,
  maxPracticeTargetMs:24*60*60*1000,
  // All emergency copies in browser storage share one budget (session first,
  // then unsaved notes, failed deletes, fallback Saved Days); each also has its
  // own ceiling below.
  localRescueBytes:4*MiB,
  fallbackDailyRecordsBytes:3*MiB,
  areaNoteRescueBytes:1*MiB,
  deletionRecoveryBytes:64*KiB,
  storageWarningRatio:0.80,
  storageCriticalRatio:0.92
});

export const CAPACITY_PROFILES=Object.freeze({
  fieldBoundaries:Object.freeze(['schedule','reflection','ongoingNote','richText','asset','backupEntry','backupLine']),
  countBoundaries:Object.freeze(['dailyRecords','ongoingNotes','savedDayDeletions','assets']),
  byteBoundaries:Object.freeze(['legacyImport','compressedBackup','uncompressedBackup','portableBackup']),
  denseTextMetadata:Object.freeze({
    description:'Dense plain-text backup metadata without image assets or rich-document payloads.',
    dailyRecords:500,
    ongoingNotes:250,
    assetCount:0,
    averageTextBytes:8*KiB
  })
});

export function assertProductionLimits(value=PRODUCTION_LIMITS){
  if(!Object.isFrozen(value))throw new TypeError('Production limits must be frozen.');
  for(const [name,limit] of Object.entries(value)){
    if(name==='minSupportedSavedDate')continue;
    if(!Number.isFinite(limit)||limit<=0)throw new TypeError(`Production limit ${name} is invalid.`);
  }
  if(value.backupMaxCompressedBytes>value.backupMaxUncompressedBytes)throw new RangeError('Compressed backup limit exceeds the uncompressed safety limit.');
  if(value.backupMaxEntryBytes>value.backupMaxLineBytes)throw new RangeError('Backup entry limit exceeds the line limit.');
  if(value.backupMaxEntryBytes<=2*value.maxRichTextBytes)throw new RangeError('A maximum rich value could not fit one backup entry.');
  return true;
}

assertProductionLimits();
