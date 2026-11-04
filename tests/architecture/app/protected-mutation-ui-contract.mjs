import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('source/app.html','utf8');
const review=fs.readFileSync('source/core/review.js','utf8');
const plan=fs.readFileSync('source/core/plan.js','utf8');

assert.match(html,/let mutationUiOperationActive=false;/u,'protected-operation UI reconciliation must track the local mutation lifecycle.');
assert.match(html,/if\(mutationUiOperationActive&&!active&&!AppMutationCoordinator\.blocksUi\(\)\)queueProtectedMutationUiReconcile\(\);/u,'protected-operation UI reconciliation must run only when the local mutation lock is actually released.');
assert.match(html,/function reconcileProtectedMutationUi\(\)\{[\s\S]*?renderSched\(\);PlanRuntime\.savedPlans\.syncAccess\(\);[\s\S]*?setExecuteControlsEnabled\(isLiveTrackableTimer\(\)\);updateSessionControls\(\);PracticePacer\.render\(\);[\s\S]*?ReviewView\.syncMode\(\);[\s\S]*?LibraryView\.refreshNotes\(\);/u,'Plan, Execute, Review and Library must re-derive mutation-sensitive UI after protection releases.');
assert.match(html,/async function importData\(value\)\{[\s\S]*?await settled\(\);[\s\S]*?AppData\.planData\.replace\(clean\.plans\)[\s\S]*?PlanDraftEditor\.preview\(\{silent:true,enterDraft:false\}\)/u,'Personal Data import must settle pending draft writes and must not implicitly enter Plan editing.');
assert.doesNotMatch(plan,/else if\(!TASKS\.length\)draftMode=true;/u,'empty live tasks never implicitly open Plan editing.');
assert.doesNotMatch(html,/title:element\.getAttribute\('title'\)/u,'ownership projection must not snapshot attributes it never mutates.');
assert.doesNotMatch(review,/wasDisabled=!!saveButton\?\.disabled/u,'Review save completion must derive control availability from current Review state rather than replaying a pre-operation disabled snapshot.');
assert.match(review,/finally\{activeSessionPersistenceBlocked=false;saveDayInProgress=false;syncReviewSurfaceMode\(\);\}/u,'Study-day save completion must re-derive Review controls.');

console.log(JSON.stringify({status:'PASS',contract:'protected-mutation-ui-reconciliation',surfaces:['plan','execute','review','library']},null,2));
