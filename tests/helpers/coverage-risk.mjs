export const COVERAGE_FLOORS=Object.freeze([
  Object.freeze({file:'source/core/canonical.ts',lines:90,branches:70,functions:100}),
  Object.freeze({file:'source/core/save-lane.ts',lines:90,branches:65,functions:85}),
  Object.freeze({file:'portable/stream-encryption.ts',lines:90,branches:80,functions:90}),
  Object.freeze({file:'source/core/library-clear.js',lines:80,branches:55,functions:90}),
  Object.freeze({file:'source/core/asset-maintenance.js',lines:95,branches:50,functions:85}),
  Object.freeze({file:'source/core/asset-storage.js',lines:90,branches:58,functions:70}),
  Object.freeze({file:'source/core/attachments.js',lines:65,branches:50,functions:50}),
  Object.freeze({file:'source/core/backup.js',lines:70,branches:58,functions:70}),
  Object.freeze({file:'source/core/device-backup.js',lines:85,branches:60,functions:90}),
  Object.freeze({file:'source/core/practice-pacer.js',lines:55,branches:45,functions:55}),
  Object.freeze({file:'source/core/timer-engine.js',lines:42,branches:38,functions:42}),
  Object.freeze({file:'source/core/backup-codec.js',lines:85,branches:58,functions:90}),
  Object.freeze({file:'source/core/repository-journals.js',lines:90,branches:55,functions:75}),
  Object.freeze({file:'source/external/insights-model.js',lines:75,branches:55,functions:70})
]);

export const CRITICAL_PATHS=Object.freeze([
  Object.freeze({id:'encrypted-backup-exact-envelope',file:'portable/stream-encryption.ts',snippet:'if(encryptedSize(size)!==file.size)',reason:'reject truncated or trailing encrypted backup bytes'}),
  Object.freeze({id:'backup-chunk-integrity-rejection',file:'source/core/backup-codec.js',snippet:'if(checksum!==entry.checksum)',reason:'reject corrupted backup chunks before restore'}),
  Object.freeze({id:'attachment-reference-rollback',file:'source/core/attachments.js',snippet:'await referenceChange.rollback();assertAuthority({allowDurableProtected:true});return error;',reason:'restore references after attachment metadata failure'}),
  Object.freeze({id:'post-restore-record-verification',file:'source/core/backup.js',snippet:'Post-restore verification failed for saved day',reason:'detect corrupted committed restore state'}),
  Object.freeze({id:'library-clear-journal-rollback',file:'source/core/library-clear.js',snippet:'await ports.restore(journal.payload);',reason:'recover destructive Library clear from durable journal'}),
  Object.freeze({id:'library-clear-reference-rewrite-verification',file:'source/core/library-clear.js',snippet:"if(String(verified[key]?.text||'')!==value)throw new Error('Note reference removal verification failed.');",reason:'verify retained rich-text references after forced attachment unlink'}),
  Object.freeze({id:'library-clear-state-restore-verification',file:'source/core/library-clear.js',snippet:"if(!actual||!same(actual,original))throw new Error('Saved Days rollback verification failed.');",reason:'verify journaled Saved-Day state after rollback'}),
  Object.freeze({id:'timer-inactive-gap-detection',file:'source/core/timer-engine.js',snippet:"openInactiveGapPrompt(TimerState.runtime.taskIdx,gapMs,last,now,source);",reason:'inactive wake gaps must become explicit classified timer state'}),
  Object.freeze({id:'timer-backward-clock-rebase',file:'source/core/timer-engine.js',snippet:'PracticePacer.rebaseClock(delta);',reason:'backward wall-clock jumps must rebase all coupled timer and Pacer timestamps'}),
  Object.freeze({id:'timer-restore-evidence-monotonicity',file:'source/core/timer-engine.js',snippet:'return Math.max(0,Math.min(maxSec,Math.max(saved,activeAtSave)));',reason:'restored timer evidence must not regress below saved or elapsed evidence'})
]);


const NON_FAST_COVERAGE_OWNERS=Object.freeze([
  Object.freeze({file:'source/core/note-links.js',owner:'browser/library/notes-management',reason:'The real picker, backlinks and tags are exercised in notes-management; Library selection uses a mocked UI port.'}),
  Object.freeze({file:'source/external/wordgard.js',owner:'browser/rich-text + release/bundle',reason:'Generated vendor runtime; browser rich-editor journeys exercise it and release QA verifies bundle provenance.'}),
  Object.freeze({prefix:'rich-text/',owner:'browser/release',reason:'TypeScript editor source is compiled and exercised through browser/release QA rather than the Node fast runtime.'}),
  Object.freeze({file:'portable/attachment-worker.ts',owner:'build/worker',reason:'Worker build source; runtime behavior is exercised through the emitted worker/integration path.'}),
  Object.freeze({file:'portable/worker-contracts.ts',owner:'build/worker + browser/rich-text',reason:'Shared message validation runs in emitted workers and the editor bundle; authored source coverage awaits bundle mapping.'}),
  Object.freeze({file:'portable/worker.ts',owner:'build/worker',reason:'Worker build source; runtime behavior is exercised through emitted worker tests.'}),
  Object.freeze({file:'source/core/library.js',owner:'browser',reason:'Library UI orchestration is exercised through browser workflows; destructive data logic lives in fast library-clear contracts.'}),
  Object.freeze({file:'source/core/review.js',owner:'browser',reason:'Review UI orchestration is exercised through the core browser journey.'}),
  Object.freeze({file:'source/external/export-worker.js',owner:'integration-worker',reason:'Executed inside a worker_threads child by the export integration test; parent Inspector coverage does not attach to child workers.'}),
  Object.freeze({file:'source/external/image-worker.js',owner:'browser/worker',reason:'Image worker behavior is owned by browser image workflows and release build checks.'}),
  Object.freeze({file:'source/external/glass.js',owner:'browser',reason:'Visual UI layer.'}),
  Object.freeze({file:'source/external/aurora.js',owner:'browser',reason:'Visual UI layer.'}),
  Object.freeze({file:'source/external/guide.js',owner:'browser',reason:'Guide UI layer.'}),
  Object.freeze({file:'source/external/insights.js',owner:'browser/release',reason:'Insights presentation, worker transport, and interaction layer; the extracted computation engine is covered directly by the fast suite.'})
]);

export function nonFastCoverageOwner(file){
  for(const rule of NON_FAST_COVERAGE_OWNERS){
    if(rule.file===file||rule.prefix&&file.startsWith(rule.prefix))return rule;
  }
  return null;
}
