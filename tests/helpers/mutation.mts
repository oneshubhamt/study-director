import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {captureOutcome} from './subprocess.mts';
import {classify,parseEvidence} from './mutation-evidence.mts';
import type {ChildOutcome,MutationOutcome} from './mutation-evidence.mts';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
type Mutation={id:string;file:string;find:string;replace:string;tests:readonly string[]};
const mutations:readonly Mutation[]=Object.freeze([
  Object.freeze({"id":"attachment-archive-verifies-manifest-digest","file":"source/core/attachments.ts","find":"if(digest.some((v,i)=>v!==header[12+i]))throw new Error('Attachment archive manifest failed verification.');","replace":"if(false)throw new Error('Attachment archive manifest failed verification.');","tests":["tests/helpers/verification/attachment-archive.mts"]}),
  Object.freeze({"id":"attachment-archive-rejects-trailing-bytes","file":"source/core/attachments.ts","find":"if(offset!==file.size)throw new Error('Attachment archive is truncated or contains unexpected data.');","replace":"if(false)throw new Error('Attachment archive is truncated or contains unexpected data.');","tests":["tests/helpers/verification/attachment-archive.mts"]}),
  Object.freeze({"id":"retention-keeps-safety-per-device","file":"source/core/managed-repository.ts","find":"const device=repositoryRowDevice(row);byDevice.set","replace":"const device='';byDevice.set","tests":["tests/unit/backup/repository-retention.mjs"]}),
  Object.freeze({"id":"retention-expires-safety","file":"source/core/managed-repository.ts","find":"Date.parse(row.manifest.retention.protectedUntil)>nowMs","replace":"true","tests":["tests/unit/backup/repository-retention.mjs"]}),
  Object.freeze({"id":"active-session-autosave-stays-normal","file":"source/core/repositories.ts","find":"(strictDurability?idbStrictTransaction:idbTransaction)<void>","replace":"idbStrictTransaction<void>","tests":["tests/integration/storage/strict-durability-boundaries.mjs"]}),
  Object.freeze({"id":"canonical-note-port-is-strict","file":"source/core/repositories.ts","find":"idbGetAll,idbStoreTransaction,idbStrictTransaction,storageResets:()=>IndexedDb.lifecycle().resets","replace":"idbGetAll,idbStoreTransaction,idbStrictTransaction:idbTransaction,storageResets:()=>IndexedDb.lifecycle().resets","tests":["tests/integration/storage/strict-durability-boundaries.mjs"]}),
  Object.freeze({"id":"canonical-daily-batch-is-strict","file":"source/core/repositories.ts","find":"return idbStrictTransaction<{ok:true}>(stores,","replace":"return idbTransaction<{ok:true}>(stores,","tests":["tests/integration/storage/strict-durability-boundaries.mjs"]}),
  Object.freeze({id:'canonical-sorts-object-keys',file:'source/core/canonical.ts',find:'Object.keys(input).sort()',replace:'Object.keys(input)',tests:Object.freeze(['tests/unit/app/canonical.mts'])}),
  Object.freeze({id:'save-lane-retries-only-current-value',file:'source/core/save-lane.ts',find:'if(sequence===taken)',replace:'if(true)',tests:Object.freeze(['tests/helpers/verification/save-lane.mts'])}),
  Object.freeze({
    id:'settlement-clears-its-deadline',file:'source/core/operation-lifecycle.ts',
    find:'if(timer!==null)clear(timer);',replace:'if(false)clear(timer);',
    tests:Object.freeze(['tests/unit/app/operation-lifecycle.mjs'])
  }),
  Object.freeze({
    id:'diagnostic-history-keeps-live-operations',file:'source/core/backup-operation-diagnostics.ts',
    find:"records=records.filter(row=>row.status==='running'||keep.has(row));",replace:'records=records.filter(row=>keep.has(row));',
    tests:Object.freeze(['tests/helpers/verification/backup-operation-diagnostics.mts'])
  }),
  Object.freeze({
    id:'partial-integrity-remains-unfinished',file:'source/core/operation-lifecycle.ts',
    find:'details.complete===false',replace:'false',
    tests:Object.freeze(['tests/unit/app/operation-lifecycle.mjs'])
  }),
  Object.freeze({
    id:'encrypted-backup-password-verifier-is-enforced',file:'portable/stream-encryption.ts',
    find:"if(!await crypto.subtle.verify('HMAC',hmac,bytes.slice(32),VERIFIER_PROOF))throw invalid('The password is incorrect.','BACKUP_AUTH_FAILED');",replace:"if(false)throw invalid('The password is incorrect.','BACKUP_AUTH_FAILED');",
    tests:Object.freeze(['tests/integration/backup/encryption.mjs'])
  }),
  Object.freeze({
    id:'backup-chunk-integrity-is-enforced',file:'source/core/backup-codec.ts',
    find:'if(checksum!==entry.checksum)throw new Error(`Backup chunk ${entry.seq} failed its integrity check.`);',
    replace:'if(false)throw new Error(`Backup chunk ${entry.seq} failed its integrity check.`);',
    tests:Object.freeze(['tests/integration/backup/portable-backup.mjs'])
  }),
  Object.freeze({
    id:'attachment-metadata-failure-rolls-references-back',file:'source/core/attachments.ts',
    find:'if(!referenceChange?.rollback)return error;',replace:'return error;',
    tests:Object.freeze(['tests/integration/attachments/attachment-deletion.mjs'])
  }),
  Object.freeze({
    id:'restore-verifies-committed-saved-days',file:'source/core/backup.ts',
    find:'if(!Canonical.same(byDate.get(record.date),sanitizeCurrentDailyRecord(record)))throw new Error(`Post-restore verification failed for saved day ${record.date}.`);',
    replace:'if(false)throw new Error(`Post-restore verification failed for saved day ${record.date}.`);',
    tests:Object.freeze(['tests/integration/backup/backup-persistence.mjs'])
  }),
  Object.freeze({
    id:'reconciliation-verifies-committed-saved-days',file:'source/core/backup.ts',
    find:'if(!intended||!committed||!Canonical.same(committed,intended))throw new Error(`Saved-Day reconciliation commit did not match the resolved state for ${record.date}.`);',
    replace:'if(false)throw new Error(`Saved-Day reconciliation commit did not match the resolved state for ${record.date}.`);',
    tests:Object.freeze(['tests/integration/backup/backup-persistence.mjs'])
  }),
  Object.freeze({
    id:'library-clear-restores-durable-journal',file:'source/core/library-clear.ts',
    find:'await ports.restore(journal.payload);',replace:'await Promise.resolve();',
    tests:Object.freeze(['tests/integration/library/library-clear.mjs'])
  }),
  Object.freeze({
    id:"exact-restore-does-not-owe-publication",file:"source/core/backup-provider.ts",
    find:"sourceNeeded:mode==='bring-in'||selected.shared===true",replace:"sourceNeeded:true",
    tests:Object.freeze(["tests/integration/backup/repository-restore.mjs"])
  }),
  Object.freeze({
    id:"shared-restore-owes-publication",file:"source/core/backup-provider.ts",
    find:"sourceNeeded:mode==='bring-in'||selected.shared===true",replace:"sourceNeeded:mode==='bring-in'",
    tests:Object.freeze(["tests/integration/backup/sync-shared-base.mjs"])
  }),
  Object.freeze({
    id:"bring-in-owes-publication",file:"source/core/backup-provider.ts",
    find:"sourceNeeded:mode==='bring-in'||selected.shared===true",replace:"sourceNeeded:selected.shared===true",
    tests:Object.freeze(["tests/integration/backup/repository-restore.mjs"])
  }),
  Object.freeze({
    id:"note-reference-removal-verifies-persisted-text",file:"source/core/library-clear.ts",
    find:"String(verified[key]?.text||'')!==value||postimages.has(key)&&!same(verified[key],postimages.get(key))",replace:"false",
    tests:Object.freeze(["tests/integration/attachments/attachment-deletion.mjs"])
  }),
  Object.freeze({
    id:"note-reference-removal-verifies-whole-record",file:"source/core/library-clear.ts",
    find:"String(verified[key]?.text||'')!==value||postimages.has(key)&&!same(verified[key],postimages.get(key))",replace:"String(verified[key]?.text||'')!==value",
    tests:Object.freeze(["tests/integration/attachments/attachment-deletion.mjs"])
  }),
  Object.freeze({
    id:"note-reference-removal-verifies-links",file:"source/core/library-clear.ts",
    find:"String(verified[key]?.text||'')!==value||postimages.has(key)&&!same(verified[key],postimages.get(key))",replace:"String(verified[key]?.text||'')!==value||postimages.has(key)&&!same({...verified[key],links:postimages.get(key)?.links},postimages.get(key))",
    tests:Object.freeze(["tests/integration/attachments/attachment-deletion.mjs"])
  }),
  Object.freeze({
    id:"exact-restore-identifies-selected-checkpoint",file:"source/core/backup-provider.ts",
    find:"sourceCheckpoint:mode==='restore-version'?row.item.id:''",replace:"sourceCheckpoint:''",
    tests:Object.freeze(["tests/integration/backup/repository-restore.mjs"])
  }),
  Object.freeze({
    id:"restore-queues-newer-source-state",file:"source/core/backup-provider.ts",
    find:"await clearPendingRetry(selected);\n      if(automaticNeeded(selected)){",replace:"await clearPendingRetry(selected);\n      if(false){",
    tests:Object.freeze(["tests/integration/backup/repository-restore.mjs"])
  }),
  Object.freeze({
    id:"restore-queues-disconnected-configured-peer",file:"source/core/backup-provider.ts",
    find:"other.id===selected.id||!automaticRecoveryDestination(other)",replace:"other.id===selected.id||!providerConnected(other)||!automaticRecoveryDestination(other)",
    tests:Object.freeze(["tests/integration/backup/repository-restore.mjs"])
  }),
  Object.freeze({id:"restore-preserves-selected-manifest",file:"source/core/backup-provider.ts",
    find:"const digest=await Exports.run('checksum',{value:file.blob},{signal}),checkpointId=file.manifest.checkpoint.checkpointId;assertOrigin?.();",replace:"const digest=await Exports.run('checksum',{value:file.blob},{signal}),checkpointId=retention?.role==='before-restore'&&history[0]?history[0].checkpoint.checkpointId:file.manifest.checkpoint.checkpointId;assertOrigin?.();",
    tests:Object.freeze(['tests/integration/backup/repository-restore.mjs'])}),
  Object.freeze({id:"restore-safety-copy-preserves-displaced-records",file:"source/core/managed-repository.ts",
    find:"for(const [month,items] of grouped(capture.dailyDocuments,'date'))await materializeStructured('dailyRecordPack',month,freeze([...items]));",replace:"for(const [month,items] of grouped(capture.dailyDocuments,'date'))await materializeStructured('dailyRecordPack',month,freeze(retention?.role==='before-restore'?items.map(item=>({...item,reflection:''})):[...items]));",
    tests:Object.freeze(['tests/integration/backup/repository-restore.mjs'])}),
  Object.freeze({id:"automatic-cadence-keeps-first-change",file:"source/core/backup-provider.ts",find:"if(!Number.isFinite(state.waitingSince))state.waitingSince=now;",replace:"state.waitingSince=now;",tests:Object.freeze(["tests/integration/backup/automatic-provider-backup.mjs"])}),
  Object.freeze({id:"recovery-holds-every-provider",file:"source/core/backup-provider.ts",find:"const held=[...providers.values()].filter((selected:Provider)=>selected.repository).map((selected:Provider)=>{",replace:"const held=[...providers.values()].filter((selected:Provider)=>selected.repository&&selected.id!=='device-folder').map((selected:Provider)=>{",tests:Object.freeze(["tests/integration/backup/pending-provider-recovery.mjs"])}),
  Object.freeze({id:"pending-receipt-preserves-successor",file:"source/core/backup-recovery-host.ts",find:"if(expected!==undefined&&JSON.stringify(pending)!==JSON.stringify(expected))",replace:"if(false)",tests:Object.freeze(["tests/integration/backup/pending-provider-recovery.mjs"])}),
  Object.freeze({id:"foreground-release-resumes-work",file:"source/core/repository-background.ts",find:"foreground=null;resolveRelease?.();resumeTimers();wake('foreground');",replace:"foreground=null;resolveRelease?.();",tests:Object.freeze(["tests/unit/backup/repository-background.mjs"])}),
  Object.freeze({id:"recovery-resumes-after-unwind",file:"source/core/managed-recovery.ts",find:"await input.automaticBackup.resume(suspension);",replace:"await Promise.resolve(suspension);",tests:Object.freeze(["tests/unit/backup/managed-recovery.mjs"])}),
  Object.freeze({id:"recovery-publication-failure-stays-pending",file:"source/core/managed-recovery.ts",find:"present=freeze({status:'pending',reason:String((error",replace:"present=freeze({status:'completed',reason:String((error",tests:Object.freeze(["tests/unit/backup/managed-recovery.mjs"])}),
  Object.freeze({id:"mutation-denies-foreign-writer",file:"source/core/mutation-coordinator.ts",find:"if(foreignActive()&&!isRecoveryKind(operationKind))",replace:"if(false)",tests:Object.freeze(["tests/unit/backup/mutation-coordinator.mjs"])}),
  Object.freeze({id:"mutation-rejects-stale-claim-revision",file:"source/core/mutation-coordinator.ts",find:"sameOwner(current,state.origin)&&current.revision===state.origin.revision",replace:"sameOwner(current,state.origin)",tests:Object.freeze(["tests/unit/backup/mutation-coordinator.mjs"])}),
  Object.freeze({id:"device-claim-rejects-stale-head",file:"source/core/backup-provider.ts",find:"if(!head||head.item.id!==expectedCheckpointId)",replace:"if(!head)",tests:Object.freeze(["tests/helpers/session-ownership-claim-regression.mjs"])}),
  Object.freeze({id:"recovery-hold-awaits-provider-drain",file:"source/core/backup-provider.ts",find:"settled:Promise.all(held.map(row=>row.suspension.settled))",replace:"settled:Promise.resolve([])",tests:Object.freeze(["tests/integration/backup/pending-provider-recovery.mjs"])}),
  Object.freeze({id:"recovery-release-resumes-every-provider",file:"source/core/backup-provider.ts",find:"for(const row of held)row.coordinator.resume(row.suspension);",replace:"for(const row of held)if(row===held[0])row.coordinator.resume(row.suspension);",tests:Object.freeze(["tests/integration/backup/pending-provider-recovery.mjs"])}),
  Object.freeze({id:"recovery-failure-still-resumes",file:"source/core/managed-recovery.ts",find:"        });\n      }finally{\n        if(suspension!==null){",replace:"        });\n      }catch(error){suspension=null;throw error;}finally{\n        if(suspension!==null){",tests:Object.freeze(["tests/unit/backup/managed-recovery.mjs"])}),
  Object.freeze({id:"recovery-host-waits-for-settlement",file:"source/core/backup-recovery-host.ts",find:"await held.settled;",replace:"void held.settled;",tests:Object.freeze(["tests/unit/backup/backup-recovery-host.mjs"])}),
  Object.freeze({id:"retry-clear-failure-preserves-obligation",file:"source/core/backup-provider.ts",find:"AppDiagnostics.capture('backup-provider.pending-retry-clear',error,'warn');return false;",replace:"AppDiagnostics.capture('backup-provider.pending-retry-clear',error,'warn');return true;",tests:Object.freeze(["tests/integration/backup/pending-provider-recovery.mjs"])}),
  Object.freeze({id:"forget-retires-pending-obligation",file:"source/core/backup-provider.ts",find:"handoffSessions.delete(selected.id);await clearPendingRetry(selected);providerBackground(selected).clearAllScheduled();",replace:"handoffSessions.delete(selected.id);providerBackground(selected).clearAllScheduled();",tests:Object.freeze(["tests/integration/backup/pending-provider-recovery.mjs"])}),
  Object.freeze({"id":"exact-restore-retires-superseded-intent","file":"source/core/backup-provider.ts","find":"await clearPendingRetry(selected);\n      if(automaticNeeded(selected)){","replace":"await Promise.resolve();\n      if(automaticNeeded(selected)){","tests":Object.freeze(["tests/integration/backup/repository-restore.mjs"])}),
  Object.freeze({"id":"unavailable-pending-read-fails-closed","file":"source/core/backup-recovery-host.ts","find":"catch(error){input.diagnostics.capture('backup.pending-provider-read',error,'error');throw error;}","replace":"catch(error){input.diagnostics.capture('backup.pending-provider-read',error,'error');return normalizePending(null);}","tests":Object.freeze(["tests/unit/backup/backup-recovery-host.mjs"])}),
  Object.freeze({"id":"pending-receipt-requires-source-revision","file":"source/core/backup-provider.ts","find":"return !Number.isFinite(required)||Number.isFinite(completed)&&completed>=required;","replace":"return true;","tests":Object.freeze(["tests/integration/backup/pending-provider-recovery.mjs"])}),
  Object.freeze({"id":"foreground-release-rediscovers-new-work","file":"source/core/repository-background.ts","find":"foreground=null;resolveRelease?.();resumeTimers();wake('foreground');","replace":"foreground=null;resolveRelease?.();resumeTimers();","tests":Object.freeze(["tests/unit/backup/repository-background.mjs"])}),
  Object.freeze({"id":"older-backoff-preserves-new-urgent-deadline","file":"source/core/backup-provider.ts","find":"backoff&&!newer&&!preserve?'replace':'earliest'","replace":"backoff?'replace':'earliest'","tests":Object.freeze(["tests/integration/backup/automatic-provider-backup.mjs"])}),
  Object.freeze({"id":"same-revision-failure-enforces-backoff","file":"source/core/backup-provider.ts","find":"backoff&&!newer&&!preserve?'replace':'earliest'","replace":"'earliest'","tests":Object.freeze(["tests/integration/backup/automatic-provider-backup.mjs"])}),
  Object.freeze({"id":"restore-clears-before-renewing-source-intent","file":"source/core/backup-provider.ts","find":"await clearPendingRetry(selected);\n      if(automaticNeeded(selected)){","replace":"if(!automaticNeeded(selected))await clearPendingRetry(selected);\n      if(automaticNeeded(selected)){","tests":Object.freeze(["tests/integration/backup/repository-restore.mjs"])}),
  Object.freeze({"id":"restore-journal-prepare-is-strict","file":"source/core/repository-journals.ts","find":"{strict:true,abortMessage:'restore journal preparation aborted'}","replace":"{strict:false,abortMessage:'restore journal preparation aborted'}","tests":["tests/helpers/verification/repository-journals.mts"]}),
  Object.freeze({"id":"library-journal-prepare-is-strict","file":"source/core/repository-journals.ts","find":"{strict:true,abortMessage:'Library-clear journal preparation aborted'}","replace":"{strict:false,abortMessage:'Library-clear journal preparation aborted'}","tests":["tests/helpers/verification/repository-journals.mts"]}),
  Object.freeze({"id":"restore-journal-phase-is-strict","file":"source/core/repository-journals.ts","find":"{strict:true,abortMessage:'restore journal phase update aborted'}","replace":"{strict:false,abortMessage:'restore journal phase update aborted'}","tests":["tests/helpers/verification/repository-journals.mts"]}),
  Object.freeze({"id":"library-journal-phase-is-strict","file":"source/core/repository-journals.ts","find":"{strict:true,abortMessage:'Library-clear journal phase update aborted'}","replace":"{strict:false,abortMessage:'Library-clear journal phase update aborted'}","tests":["tests/helpers/verification/repository-journals.mts"]}),
  Object.freeze({"id":"library-journal-verifies-chunk-digest","file":"source/core/repository-journals.ts","find":"if(await libraryClearDigest(bytes)!==state.sha256)","replace":"if(false)","tests":["tests/helpers/verification/repository-journals.mts"]}),
  Object.freeze({"id":"restore-journal-retirement-is-strict","file":"source/core/repository-journals.ts","find":"{strict:true,abortMessage:'restore journal cleanup aborted'}","replace":"{strict:false,abortMessage:'restore journal cleanup aborted'}","tests":["tests/helpers/verification/repository-journals.mts"]}),
  Object.freeze({"id":"library-journal-retirement-is-strict","file":"source/core/repository-journals.ts","find":"{strict:true,abortMessage:'Library-clear journal cleanup aborted'}","replace":"{strict:false,abortMessage:'Library-clear journal cleanup aborted'}","tests":["tests/helpers/verification/repository-journals.mts"]}),
  Object.freeze({"id":"library-journal-verifies-plan-signature","file":"source/core/repository-journals.ts","find":"if(await libraryClearDigest(new TextEncoder().encode(String((payload as {planSignature?:unknown}|null)?.planSignature||'')))!==state.signatureHash)","replace":"if(false)","tests":["tests/helpers/verification/repository-journals.mts"]}),
  // The rule-based tests: a sync keeps the other edit, Hourly keeps only
  // versions whose notes changed, and a backward clock jump moves the timer's start.
  Object.freeze({
    id:'sync-keeps-the-other-edit',file:'source/core/backup.ts',
    find:'held.kept.text=sides.incomingNewer?conflict.localValue:conflict.incomingValue;',replace:'held.kept.text=sides.incomingNewer?conflict.incomingValue:conflict.localValue;',
    tests:Object.freeze(['tests/integration/backup/sync-shared-base.mjs'])
  }),
  Object.freeze({
    id:'hourly-keeps-only-changed-notes',file:'source/core/managed-repository.ts',
    find:'if(hour(row)===hour(after)||notes(row)&&notes(row)===notes(after))continue;',replace:'if(hour(row)===hour(after))continue;',
    tests:Object.freeze(['tests/unit/backup/repository-retention.mjs'])
  }),
  Object.freeze({
    id:'clock-jump-rebases-timer-start',file:'source/core/timer-engine.ts',
    find:'TimerState.patchRuntime({startMs:Number(TimerState.runtime.startMs)+delta});',replace:'void delta;',
    tests:Object.freeze(['tests/unit/app/timer-engine-logic.mjs'])
  })
]);

const witnesses:Readonly<Record<string,readonly string[]>>={
  "attachment-archive-verifies-manifest-digest": ["await assert.rejects(()=>module.inspect(new Blob([tampered])),/manifest failed verification/u);"],
  "attachment-archive-rejects-trailing-bytes": ["await assert.rejects(()=>module.inspect(new Blob([archive,new Uint8Array([9])])),/truncated or contains unexpected data/u);"],
  "retention-keeps-safety-per-device": ["assert.deepEqual(perDevice.retained.filter(row=>perDevice.tiers[row.id]==='before-restore')"],
  "retention-expires-safety": ["assert.equal(expiredProtected.activeProtected,null"],
  "active-session-autosave-stays-normal": ["assert.equal(strictCount(),0,'Review autosaves"],
  "canonical-note-port-is-strict": ["assert.ok(strictCount()>beforeNoteFlush"],
  "canonical-daily-batch-is-strict": ["assert.ok(strictCount()>beforeDaily"],
  "restore-journal-retirement-is-strict": ["assert.equal(idbDurability.strict,restoreStrictBefore+1,'restore journal retirement must use strict durability');"],
  "library-journal-retirement-is-strict": ["assert.equal(idbDurability.strict,libraryStrictBefore+1,'library-clear journal retirement must use strict durability');"],
  "library-journal-verifies-plan-signature": ["await assert.rejects(journal().read(),/plan signature does not verify/u,'a valid payload digest cannot authorize a mismatched plan signature');"],
  "restore-journal-prepare-is-strict": ["assert.equal(current.idbDurability.strict,before+1,'journal preparation uses a strict transaction');"],
  "library-journal-prepare-is-strict": ["assert.equal(current.idbDurability.strict,before+1,'journal preparation uses a strict transaction');"],
  "restore-journal-phase-is-strict": ["assert.equal(current.idbDurability.strict,before+1,'journal phase publication uses a strict transaction');"],
  "library-journal-phase-is-strict": ["assert.equal(current.idbDurability.strict,before+1,'journal phase publication uses a strict transaction');"],
  "library-journal-verifies-chunk-digest": ["await assert.rejects(journal().read(),/failed integrity verification/u,'same-length rollback corruption must fail closed');"],
  "foreground-release-rediscovers-new-work": ["assert.equal(attempts,1,'foreground release rediscovers newly owed work even without an existing timer');"],
  "older-backoff-preserves-new-urgent-deadline": ["assert.ok(distinctReads.some(at=>at>changedAt&&at<=changedAt+t.policy.automaticUrgentMs+1000)","assert.ok(Number.isFinite(dueAt)&&dueAt<=t.clock.now()+t.policy.automaticUrgentMs+1000","assert.equal(t.runtime.backgroundStatus().find(row=>row.job==='google-drive convergence').reason,'important-change'","assert.equal(attempts,2,'a new revision must not be delayed by the previous revision backoff');"],
  "same-revision-failure-enforces-backoff": ["assert.equal(attempts,1,'same-revision urgency cannot bypass backoff');","assert.equal(attempts().length,2,'a failed catch-up is tried again within a minute');"],
  "restore-clears-before-renewing-source-intent": ["assert.deepEqual(sourceIntentActions,['clear','mark'],'source restore replaces the old obligation before recording the new one');"],
  "exact-restore-retires-superseded-intent": ["assert.equal(await pendingStore().read('repository-version-qa'),null,'exact restore retires the superseded source intent');"],
  "unavailable-pending-read-fails-closed": ["assert.match(String(unavailablePending?.message||''),/temporary appMeta read failure/u,'unavailable pending metadata must reject, not become confirmed absence');"],
  "pending-receipt-requires-source-revision": ["assert.deepEqual(t.stats().durable,original,'an older source revision receipt must not retire the durable obligation');"],
  "recovery-hold-awaits-provider-drain": ["assert.equal(settled,false,'a recovery hold must await actual publication release, not merely abort it');"],
  "recovery-release-resumes-every-provider": ["assert.equal(t.stats().writes,2,'release permits each owed destination to publish once');"],
  "recovery-failure-still-resumes": ["assert.deepEqual(h.state(),{suspended:0,activeLock:false},'a failed safety publication releases the hold');"],
  "recovery-host-waits-for-settlement": ["assert.deepEqual(events.slice(start).filter(event=>['plan-flush','notes-flush','apply'].includes(event)),[],'nothing happens while background work is still running');"],
  "retry-clear-failure-preserves-obligation": ["assert.equal(t.status().pending,true,'a failed durable retirement must not complete the retry');"],
  "forget-retires-pending-obligation": ["assert.equal(t.stats().durable,null,'the owed backup is dropped');"],
  "automatic-cadence-keeps-first-change": ["assert.equal(t.publishedAt.length,2);assert.ok(t.publishedAt[1]-start>=20*MINUTE"],
  "recovery-holds-every-provider": ["assert.equal(t.stats().writes,0,'a recovery hold prevents both destinations from publishing');"],
  "pending-receipt-preserves-successor": ["assert.deepEqual(t.stats().durable?.entries[0],newer,'the older receipt must preserve the exact newer durable marker');"],
  "foreground-release-resumes-work": ["assert.equal(fired,1,'deferred background work must resume after foreground release');"],
  "recovery-resumes-after-unwind": ["assert.deepEqual(h.state(),{suspended:0,activeLock:false},'managed recovery releases its suspension and mutation lock');"],
  "recovery-publication-failure-stays-pending": ["assert.equal(result.managedRecovery.present.status,'pending','Post-operation repository failure must not undo an already verified local restore.');"],
  "mutation-denies-foreign-writer": ["assert.equal(entered,false,'a competing foreign lease must deny entry');"],
  "mutation-rejects-stale-claim-revision": ["assert.equal(entered,false,'an old revision cannot borrow the same claim after asynchronous admission');"],
  "device-claim-rejects-stale-head": ["assert.equal(staleHead?.code,'REPOSITORY_SESSION_CLAIM_STALE','a verified but superseded head cannot authorize another claim');"],
  "canonical-sorts-object-keys": [
    "assert.equal(canonical.signature(original),"
  ],
  "save-lane-retries-only-current-value": [
    "assert.equal(newerSettled,true,",
    "assert.equal(finalSettled,true,",
    "assert.deepEqual(writes,['old','new'],'no superseded value"
  ],
  "settlement-clears-its-deadline": [
    "assert.equal(timers.size,0,'settled operations clear the deadline');"
  ],
  "diagnostic-history-keeps-live-operations": [
    "assert.equal(first.snapshot().find(row=>row.id===id)?.status,'running','starting an operation must retain its live record');",
    "assert.equal(concurrent.snapshot().find(row=>row.id===foregroundId)?.status,'running'"
  ],
  "partial-integrity-remains-unfinished": [
    "assert.equal(lifecycle.outcome(details),expected,JSON.stringify(details));"
  ],
  "encrypted-backup-password-verifier-is-enforced": [
    "await assert.rejects(verifyPasswordVerifier(verifier,await passwordKey('wrong password'))"
  ],
  "backup-chunk-integrity-is-enforced": [
    "await assert.rejects(()=>codec.inspectCurrent(codec.createV10Container(tamperedMetadata"
  ],
  "attachment-metadata-failure-rolls-references-back": [
    "assert.equal(s.rollbacks,1,'Metadata failure must roll reference surgery back.');"
  ],
  "restore-verifies-committed-saved-days": [
    "assert.ok(finalVerificationFailure instanceof Error);",
    "assert.match(finalVerificationFailure.message,/Post-restore verification failed for saved day/u);"
  ],
  "reconciliation-verifies-committed-saved-days": [
    "assert.ok(verificationFailure instanceof Error);",
    "assert.match(verificationFailure.message,/Saved-Day reconciliation commit did not match the resolved state/u);"
  ],
  "library-clear-restores-durable-journal": [
    "assert.equal(t.state().restored,1,'metadata failure restores journaled state');",
    "assert.equal(t.state().restored,1,'startup replays journaled state');"
  ],
  "exact-restore-does-not-owe-publication": ["assert.equal(await pendingStore().read('repository-version-qa'),null,'a current non-shared source owes no duplicate publication');"],
  "shared-restore-owes-publication": ["assert.equal(restoreIntent?.providerId,'drive','shared restore persists the owed publication before returning');"],
  "bring-in-owes-publication": ["assert.equal((await pendingStore().read('repository-version-qa'))?.providerId,'repository-version-qa','a non-shared bring-in records the source publication it owes');"],
  "note-reference-removal-verifies-persisted-text": ["assert.match(String(rejection?.message||''),/Note reference removal verification failed/u,fault+' readback must refuse attachment deletion');"],
  "note-reference-removal-verifies-whole-record": ["assert.match(String(rejection?.message||''),/Note reference removal verification failed/u,fault+' readback must refuse attachment deletion');"],
  "note-reference-removal-verifies-links": ["assert.match(String(rejection?.message||''),/Note reference removal verification failed/u,fault+' readback must refuse attachment deletion');"],
  "exact-restore-identifies-selected-checkpoint": ["assert.deepEqual([providerRestore.convergence.source.status,providerRestore.convergence.source.unchanged,providerRestore.convergence.source.checkpoint],['completed',true,checkpointId]);"],
  "restore-queues-newer-source-state": ["assert.deepEqual([restored.convergence.source.status,restored.convergence.source.retryQueued,restored.convergence.source.scheduled],['pending',true,true],'the restored location owes a backup of the result and has one scheduled');"],
  "restore-queues-disconnected-configured-peer": ["assert.deepEqual(restored.convergence.others.map(row=>[row.id,row.status,row.queued,row.scheduled]),[['peer-qa','pending',true,true]],'the other location is recorded and scheduled too');"],
  "restore-preserves-selected-manifest": ["assert.deepEqual(new Uint8Array(await selected.blob.arrayBuffer()),originalHistoricalManifestBytes,'restore preserves the selected manifest bytes, including on failure');"],
  "restore-safety-copy-preserves-displaced-records": ["assert.deepEqual(records,displacedDays,'restoring the protected version recovers the exact displaced Saved Days');"],
  "sync-keeps-the-other-edit": [
    "assert.equal(keptNote.kept.text,'one, A again",
    "assert.equal(held[0].kept.text,older.text,label);"
  ],
  "hourly-keeps-only-changed-notes": [
    "assert.ok(!matches,'an Hourly version differs from the next one kept in hour and notes');",
    "assert.deepEqual(hourlyOf(repository.selectRetention(changes,"
  ],
  "clock-jump-rebases-timer-start": [
    "assert.equal(timerState.runtime.startMs,wakeNow-100000);"
  ]
};

function isolatedEnvironment(tempRoot:string):NodeJS.ProcessEnv{
  const env={...process.env};
  for(const key of ['NODE_OPTIONS','NODE_PATH','NODE_V8_COVERAGE','SD_COVERAGE_DIR','SD_ENCRYPTED_TEST','SD_MINIFIED_TEST','SD_TEST_ARTIFACT_DIR','SD_CASE_SEED','SD_CASE_FAMILY','SD_CASE_TRACE_SEED','SD_CASE_TRACE_FAMILY'])delete env[key];
  const directories={HOME:path.join(tempRoot,'home'),TMPDIR:path.join(tempRoot,'tmp'),XDG_CACHE_HOME:path.join(tempRoot,'cache'),SD_TEST_ARTIFACT_DIR:path.join(tempRoot,'artifacts')};
  Object.assign(env,directories,{TZ:'UTC',TERM:'dumb',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',NO_COLOR:'1',FORCE_COLOR:'0',CI:'1',TEMP:directories.TMPDIR,TMP:directories.TMPDIR,SD_ENCRYPTED_TEST:'0',SD_MINIFIED_TEST:'0',SD_MUTATION_EVIDENCE:path.join(tempRoot,'exception.json')});
  for(const directory of Object.values(directories))fs.mkdirSync(directory,{recursive:true});
  return env;
}
function uniqueIndex(source:string,anchor:string,label:string):number{
  const first=source.indexOf(anchor);
  if(first<0||first!==source.lastIndexOf(anchor))throw new Error(`${label}: anchor missing or not unique: ${anchor}`);
  return first;
}
function applyMutation(clone:string,mutation:Mutation){
  const target=path.join(clone,mutation.file),source=fs.readFileSync(target,'utf8');
  const first=uniqueIndex(source,mutation.find,mutation.id);
  const changed=source.slice(0,first)+mutation.replace+source.slice(first+mutation.find.length);
  fs.writeFileSync(target,changed);
  const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
  return {before:digest(source),after:digest(changed)};
}
function copyRepository(target:string){
  fs.cpSync(root,target,{recursive:true,filter:source=>{
    const relative=path.relative(root,source).split(path.sep).join('/');
    return relative!=='.git'&&!relative.startsWith('.git/')&&relative!=='node_modules'&&!relative.startsWith('node_modules/');
  }});
}
function runTest(clone:string,test:string,tempRoot:string,timeout:number):ChildOutcome{
  const loader=pathToFileURL(path.join(clone,'tests/helpers/hermetic-loader.mjs')).href;
  const runtime=pathToFileURL(path.join(clone,'tests/helpers/hermetic-runtime.mjs')).href;
  const observer=pathToFileURL(path.join(clone,'tests/helpers/mutation-observer.mts')).href;
  const env=isolatedEnvironment(tempRoot);
  const result=captureOutcome(process.execPath,['--no-warnings','--experimental-loader',loader,'--import',observer,'--import',runtime,test],{cwd:clone,env,encoding:'utf8',timeout,maxBuffer:8*1024*1024});
  const evidenceFile=path.join(tempRoot,'exception.json');
  return {...result,evidence:fs.existsSync(evidenceFile)?parseEvidence(fs.readFileSync(evidenceFile,'utf8')):null};
}
type RunRecord={test:string;outcome:MutationOutcome;status:number|null;signal:string|null;error:string|null;evidence:ChildOutcome['evidence'];stdout:string;stderr:string};
function record(test:string,result:ChildOutcome,outcome:MutationOutcome):RunRecord{
  return {test,outcome,status:result.status,signal:result.signal,error:result.error?.message??null,evidence:result.evidence,stdout:result.stdout,stderr:result.stderr};
}
function runMutation(mutation:Mutation,anchors:readonly string[],timeout=240000){
  const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-mutant-')),clone=path.join(tempRoot,'repo');
  const controls:RunRecord[]=[],attempts:RunRecord[]=[];
  let outcome:MutationOutcome='harness-failure',source:{before:string;after:string}|null=null,error:string|null=null;
  try{
    copyRepository(clone);
    const targets=mutation.tests.map(test=>{
      const file=path.join(clone,test),text=fs.readFileSync(file,'utf8');
      const lines=anchors.map(anchor=>text.slice(0,uniqueIndex(text,anchor,test)).split('\n').length);
      return {test,file,lines};
    });
    for(const [i,target] of targets.entries()){
      const result=runTest(clone,target.test,path.join(tempRoot,'control-'+i),timeout);
      const verdict=classify(result,target,true);controls.push(record(target.test,result,verdict));
      if(verdict!=='passed'){outcome=verdict;return {id:mutation.id,file:mutation.file,find:mutation.find,replace:mutation.replace,source,controls,attempts,outcome,error};}
    }
    source=applyMutation(clone,mutation);
    outcome='survived';
    for(const [i,target] of targets.entries()){
      const result=runTest(clone,target.test,path.join(tempRoot,'mutant-'+i),timeout);
      const verdict=classify(result,target,false);attempts.push(record(target.test,result,verdict));
      if(verdict!=='survived'){outcome=verdict;break;}
    }
  }catch(failure){outcome='harness-failure';error=failure instanceof Error?failure.message:String(failure);}
  finally{fs.rmSync(tempRoot,{recursive:true,force:true});}
  return {id:mutation.id,file:mutation.file,find:mutation.find,replace:mutation.replace,source,controls,attempts,outcome,error};
}
const requested=process.argv.slice(2);
if(requested.includes('--probe')){
  if(requested.length!==1)throw new Error('--probe must be used alone.');
  const test='tests/unit/app/canonical.mts',canonical=mutations[0]!;
  const anchor=witnesses[canonical.id]!;
  const importLine="import assert from 'node:assert/strict';";
  const probe=(id:string,replace:string,expected:MutationOutcome,timeout?:number)=>{
    const result=runMutation({id,file:test,find:importLine,replace,tests:[test]},anchor,timeout);
    console.log(JSON.stringify({...result,expected}));
    if(result.outcome!==expected)process.exitCode=1;
  };
  const noOp=runMutation({...canonical,id:'probe-no-op',replace:canonical.find},anchor);
  const real=runMutation(canonical,anchor);
  console.log(JSON.stringify({...noOp,expected:'survived'}));
  console.log(JSON.stringify({...real,expected:'killed'}));
  if(noOp.outcome!=='survived'||real.outcome!=='killed')process.exitCode=1;
  probe('probe-missing-import',importLine+" import './missing-mutation-probe.mjs';",'setup-failure');
  probe('probe-unrelated-assertion',importLine+" assert.fail('unrelated probe');",'unrelated-failure');
  probe('probe-unsettled-await',importLine+' await new Promise(()=>{});','unsettled-await');
  probe('probe-timeout',importLine+' await new Promise(resolve=>setTimeout(resolve,60000));','timeout',5000);
}else{
  const selected=requested.length?mutations.filter(mutation=>requested.includes(mutation.id)):mutations;
  if(requested.length&&selected.length!==requested.length)throw new Error(`Unknown or repeated mutation id. Available: ${mutations.map(item=>item.id).join(', ')}`);
  const results=selected.map(mutation=>{
    const anchors=witnesses[mutation.id];
    if(!anchors)throw new Error(`No intended assertions for ${mutation.id}`);
    const result=runMutation(mutation,anchors);
    console.log(JSON.stringify({...result,replay:`npm run test:mutation -- ${mutation.id}`}));
    console.log(`${result.outcome.toUpperCase()} ${mutation.id}`);
    return result;
  });
  const failed=results.filter(result=>result.outcome!=='killed');
  console.log(JSON.stringify({status:failed.length?'FAIL':'PASS',mutants:results.length,killed:results.length-failed.length,failed:failed.map(({id,outcome})=>({id,outcome}))},null,2));
  if(failed.length)process.exitCode=1;
}
