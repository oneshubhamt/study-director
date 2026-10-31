import {readHostHtml} from '../../../build/host-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=readHostHtml();
const review=fs.readFileSync('source/core/review.js','utf8');

assert.match(html,/let mutationUiOperationActive=false;/u,'protected-operation UI reconciliation must track the local mutation lifecycle.');
assert.match(html,/if\(mutationUiOperationActive&&!active&&!AppMutationCoordinator\.blocksUi\(\)\)queueProtectedMutationUiReconcile\(\);/u,'protected-operation UI reconciliation must run only when the local mutation lock is actually released.');
assert.match(html,/function reconcileProtectedMutationUi\(\)\{[\s\S]*?renderSched\(\);PlanRuntime\.savedPlans\.syncAccess\(\);[\s\S]*?setExecuteControlsEnabled\(isLiveTrackableTimer\(\)\);updateSessionControls\(\);PracticePacer\.render\(\);[\s\S]*?ReviewView\.syncMode\(\);[\s\S]*?LibraryView\.refreshNotes\(\);/u,'Plan, Execute, Review and Library must re-derive mutation-sensitive UI after protection releases.');
assert.match(html,/const restored=parseScheduleDraftText\(draftText\),matchesApplied=!!TASKS\.length&&restored\.ok&&scheduleFingerprintForRows\(restored\.parsed\)===scheduleFingerprint\(\);[\s\S]*?if\(matchesApplied\)PlanDraftEditor\.deactivate\(\);[\s\S]*?PlanDraftEditor\.preview\(\{silent:true,enterDraft:!matchesApplied\}\)/u,'portable Plan restore must remain in applied mode when the restored draft is semantically identical to the restored live schedule.');
assert.doesNotMatch(html,/title:element\.getAttribute\('title'\)/u,'ownership projection must not snapshot attributes it never mutates.');
assert.doesNotMatch(review,/wasDisabled=!!saveButton\?\.disabled/u,'Review save completion must derive control availability from current Review state rather than replaying a pre-operation disabled snapshot.');
assert.match(review,/finally\{activeSessionPersistenceBlocked=false;saveDayInProgress=false;syncReviewSurfaceMode\(\);\}/u,'Study-day save completion must re-derive Review controls.');

console.log(JSON.stringify({status:'PASS',contract:'protected-mutation-ui-reconciliation',surfaces:['plan','execute','review','library']},null,2));
