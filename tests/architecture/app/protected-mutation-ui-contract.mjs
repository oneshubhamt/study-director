import {readScript} from '../../../build/source-script.mts';
import {readHostHtml} from '../../../build/host-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=readHostHtml();
const review=fs.readFileSync('source/core/review.js','utf8');
const plan=fs.readFileSync('source/core/plan.ts','utf8');
const repositories=readScript('source/core/repositories.ts');

assert.match(html,/let mutationUiOperationActive=false;/u,'protected-operation UI reconciliation must track the local mutation lifecycle.');
assert.match(html,/if\(mutationUiOperationActive&&!active&&!AppMutationCoordinator\.blocksUi\(\)\)queueProtectedMutationUiReconcile\(\);/u,'protected-operation UI reconciliation must run only when the local mutation lock is actually released.');
assert.match(html,/function reconcileProtectedMutationUi\(\)\{[\s\S]*?renderSched\(\);PlanRuntime\.savedPlans\.syncAccess\(\);[\s\S]*?setExecuteControlsEnabled\(isLiveTrackableTimer\(\)\);updateSessionControls\(\);PracticePacer\.render\(\);[\s\S]*?ReviewView\.syncMode\(\);[\s\S]*?LibraryView\.refreshNotes\(\);/u,'Plan, Execute, Review and Library must re-derive mutation-sensitive UI after protection releases.');
assert.match(html,/async function importData\(value\)\{[\s\S]*?await settled\(\);[\s\S]*?AppData\.planData\.replacePortable\(clean\)[\s\S]*?PlanDraftEditor\.preview\(\{silent:true,enterDraft:false\}\)/u,'Personal Data import must settle pending edits, commit the portable records together and never enter Plan editing.');
assert.match(repositories,/replacePortable:\(value\s*\)=>\{[\s\S]*?Meta\.transaction\('readwrite',[\s\S]*?meta\.put\('planDraft',[\s\S]*?meta\.put\('planLibrary',[\s\S]*?meta\.put\('personalPreferences',[\s\S]*?\{strict:true,abortMessage:'Portable Plans and Preferences restore aborted'\}\)/u,'A single strict IndexedDB transaction must commit the Plan draft, saved plans and preferences together.');
assert.doesNotMatch(plan,/else if\(!TASKS\.length\)draftMode=true;/u,'empty live tasks never implicitly open Plan editing.');
assert.doesNotMatch(html,/title:element\.getAttribute\('title'\)/u,'ownership projection must not snapshot attributes it never mutates.');
assert.doesNotMatch(review,/wasDisabled=!!saveButton\?\.disabled/u,'Review save completion must derive control availability from current Review state rather than replaying a pre-operation disabled snapshot.');
assert.match(review,/finally\{activeSessionPersistenceBlocked=false;saveDayInProgress=false;syncReviewSurfaceMode\(\);\}/u,'Study-day save completion must re-derive Review controls.');

console.log(JSON.stringify({status:'PASS',contract:'protected-mutation-ui-reconciliation',surfaces:['plan','execute','review','library']},null,2));
