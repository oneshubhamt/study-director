export const COVERAGE_FLOORS=Object.freeze([
  Object.freeze({file:'source/core/canonical.ts',lines:90,branches:70,functions:100}),
  Object.freeze({file:'source/core/save-lane.ts',lines:90,branches:65,functions:85}),
  Object.freeze({file:'portable/stream-encryption.ts',lines:90,branches:80,functions:90}),
  Object.freeze({file:'source/core/library-clear.ts',lines:80,branches:55,functions:90}),
  Object.freeze({file:'source/core/asset-maintenance.ts',lines:95,branches:50,functions:85}),
  Object.freeze({file:'source/core/asset-storage.ts',lines:90,branches:58,functions:70}),
  Object.freeze({file:'source/core/attachments.ts',lines:65,branches:50,functions:50}),
  Object.freeze({file:'source/core/backup.ts',lines:70,branches:58,functions:70}),
  Object.freeze({file:'source/core/device-backup.ts',lines:85,branches:60,functions:90}),
  Object.freeze({file:'source/core/practice-pacer.ts',lines:55,branches:45,functions:55}),
  Object.freeze({file:'source/core/timer-engine.ts',lines:42,branches:38,functions:42}),
  Object.freeze({file:'source/core/backup-codec.ts',lines:85,branches:58,functions:90}),
  Object.freeze({file:'source/core/repository-journals.ts',lines:90,branches:55,functions:75}),
  Object.freeze({file:'source/external/insights-model.js',lines:75,branches:55,functions:70})
]);

export const CRITICAL_PATHS=Object.freeze([
  Object.freeze({id:'encrypted-backup-exact-envelope',file:'portable/stream-encryption.ts',snippet:'if(encryptedSize(size)!==file.size)',reason:'reject truncated or trailing encrypted backup bytes'}),
  Object.freeze({id:'backup-chunk-integrity-rejection',file:'source/core/backup-codec.ts',snippet:'if(checksum!==entry.checksum)',reason:'reject corrupted backup chunks before restore'}),
  Object.freeze({id:'attachment-reference-rollback',file:'source/core/attachments.ts',snippet:'await referenceChange.rollback();assertAuthority({allowDurableProtected:true});return error;',reason:'restore references after attachment metadata failure'}),
  Object.freeze({id:'post-restore-record-verification',file:'source/core/backup.ts',snippet:'Post-restore verification failed for saved day',reason:'detect corrupted committed restore state'}),
  Object.freeze({id:'library-clear-journal-rollback',file:'source/core/library-clear.ts',snippet:'await ports.restore(journal.payload);',reason:'recover destructive Library clear from durable journal'}),
  Object.freeze({id:'library-clear-reference-rewrite-verification',file:'source/core/library-clear.ts',snippet:"if(String(verified[key]?.text||'')!==value)throw new Error('Note reference removal verification failed.');",reason:'verify retained rich-text references after forced attachment unlink'}),
  Object.freeze({id:'library-clear-state-restore-verification',file:'source/core/library-clear.ts',snippet:"if(!actual||!same(actual,original))throw new Error('Saved Days rollback verification failed.');",reason:'verify journaled Saved-Day state after rollback'}),
  Object.freeze({id:'timer-inactive-gap-detection',file:'source/core/timer-engine.ts',snippet:"openInactiveGapPrompt(TimerState.runtime.taskIdx,gapMs,last,now,source);",reason:'inactive wake gaps must become explicit classified timer state'}),
  Object.freeze({id:'timer-backward-clock-rebase',file:'source/core/timer-engine.ts',snippet:'PracticePacer.rebaseClock(delta);',reason:'backward wall-clock jumps must rebase all coupled timer and Pacer timestamps'}),
  Object.freeze({id:'timer-restore-evidence-monotonicity',file:'source/core/timer-engine.ts',snippet:'return Math.max(0,Math.min(maxSec,Math.max(saved,activeAtSave)));',reason:'restored timer evidence must not regress below saved or elapsed evidence'})
]);


const NON_FAST_COVERAGE_OWNERS=Object.freeze([
  Object.freeze({file:'source/core/data-bootstrap-host.ts',owner:'browser/storage + app/core-flow',reason:'Bootstrap configuration and repository composition execute in the built application; canonical-storage, unsupported-data, recovery and core-flow browser journeys exercise the live startup boundary.'}),
  Object.freeze({file:'source/core/execution-views.ts',owner:'browser/app/core-flow + execute journeys',reason:'Execute presentation is DOM orchestration exercised through core-flow, session and populated-accessibility browser journeys.'}),
  Object.freeze({file:'source/core/navigation.ts',owner:'browser/app + ui/interactions + workspace',reason:'Native/history navigation and workspace reconciliation are exercised through core-flow, interaction-history and workspace browser journeys.'}),
  Object.freeze({file:'source/core/notes-host.ts',owner:'browser/library/notes-management + notes-at-limit + rich-text',reason:'The checked note/editor owner is exercised through real Library note management, capacity and rich-editor workflows; persistence mathematics remains covered by fast repository tests.'}),
  Object.freeze({file:'source/core/profiles.ts',owner:'browser/ui/profile-panel + backup/sync-and-profiles',reason:'Profile lifecycle and switching are exercised by the profile-panel and multi-device sync/profile browser journeys.'}),
  Object.freeze({file:'source/core/rich-text-host.ts',owner:'browser/rich-text + attachments',reason:'Rich editor mount/dispose, focus, quiescence and attachment integration are exercised by rich-editor and attachment-editor browser journeys.'}),
  Object.freeze({file:'source/core/session-handoff.ts',owner:'browser/backup/session-handoff-journeys + sync-journeys',reason:'Cross-device ownership transfer and claim reconciliation are exercised by dedicated multi-device handoff and sync browser journeys.'}),
  Object.freeze({file:'source/core/workspace-overlay.ts',owner:'browser/rich-text/workspace-overlay + ui/interactions',reason:'Workspace overlay/history behavior is exercised through workspace, attachment and interaction-history browser journeys.'}),
  Object.freeze({file:'source/host/install-capture.js',owner:'browser/release',reason:'Install/startup capture runs only as part of the built application and is exercised by the release browser application/PWA journeys.'}),
  Object.freeze({file:'source/host/main.js',owner:'browser/release',reason:'The application composition host is executed as the built runtime across the complete release browser suite; fast tests cover extracted domain owners directly.'}),
  Object.freeze({file:'source/host/presentation-metadata.js',owner:'browser/release',reason:'Presentation metadata is host/UI composition exercised through the built release browser journeys rather than the Node fast runtime.'}),
  Object.freeze({file:'source/external/wordgard.js',owner:'browser/rich-text + release/bundle',reason:'Generated vendor runtime; browser rich-editor journeys exercise it and release QA verifies bundle provenance.'}),
  Object.freeze({prefix:'rich-text/',owner:'browser/release',reason:'TypeScript editor source is compiled and exercised through browser/release QA rather than the Node fast runtime.'}),
  Object.freeze({file:'portable/attachment-worker.ts',owner:'build/worker',reason:'Worker build source; runtime behavior is exercised through the emitted worker/integration path.'}),
  Object.freeze({file:'portable/worker-contracts.ts',owner:'build/worker + browser/rich-text',reason:'Shared message validation runs in emitted workers and the editor bundle; authored source coverage awaits bundle mapping.'}),
  Object.freeze({file:'portable/worker.ts',owner:'build/worker',reason:'Worker build source; runtime behavior is exercised through emitted worker tests.'}),
  Object.freeze({file:'source/core/library.ts',owner:'browser',reason:'Library UI orchestration is exercised through browser workflows; destructive data logic lives in fast library-clear contracts.'}),
  Object.freeze({file:'source/core/note-links.ts',owner:'browser/library/notes-management + rich-text/link-context',reason:'Note-link picker, linked-note bar, tag suggestions and navigation are DOM interaction orchestration exercised by browser note-management and link-context workflows; canonical note/link storage remains covered by fast repository tests.'}),
  Object.freeze({file:'source/core/review.ts',owner:'browser',reason:'Review UI orchestration is exercised through the core browser journey.'}),
  Object.freeze({file:'source/external/export-worker.js',owner:'integration-worker',reason:'Executed inside a worker_threads child by the export integration test; parent Inspector coverage does not attach to child workers.'}),
  Object.freeze({file:'source/external/image-worker.js',owner:'browser/worker',reason:'Image worker behavior is owned by browser image workflows and release build checks.'}),
  Object.freeze({file:'source/external/glass.js',owner:'browser',reason:'Visual UI layer.'}),
  Object.freeze({file:'source/external/aurora.js',owner:'browser',reason:'Visual UI layer.'}),
  Object.freeze({file:'source/external/guide.js',owner:'browser',reason:'Guide UI layer.'}),
  Object.freeze({file:'source/external/wordgard.js',owner:'browser/release',reason:'Generated Wordgard runtime bundle; authored rich-text sources are covered by bundle integrity/build contracts and browser/release editor certification.'}),
  Object.freeze({file:'source/external/insights.js',owner:'browser/release',reason:'Insights presentation, worker transport, and interaction layer; the extracted computation engine is covered directly by the fast suite.'})
]);

export function nonFastCoverageOwner(file){
  for(const rule of NON_FAST_COVERAGE_OWNERS){
    if(rule.file===file||rule.prefix&&file.startsWith(rule.prefix))return rule;
  }
  return null;
}
