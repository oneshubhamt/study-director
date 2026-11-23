import {readHostHtml} from '../../../build/host-source.mjs';
import assert from 'node:assert/strict';
import {readRuntimeSource} from '../../helpers/runtime-source.mjs';

const app=readHostHtml();
const updater=readRuntimeSource('source/core/pwa-update-host.ts');
const lifecycle=readRuntimeSource('source/core/pwa-lifecycle.ts');
const sw=readRuntimeSource('source/platform/sw.ts');

assert.match(app,/PwaUpdateHostModule\.createController\(/u,'main must compose the checked PWA update host');
assert.doesNotMatch(app,/function (?:pwaUpdateBlockReason|reserveApplicationUpdate|prepareApplicationUpdate|checkPwaUpdateIfDue)\b/u,'PWA update algorithms must not remain unchecked in main');
assert.match(updater,/const READY_DELAY=650,SAFETY_RETRY=5\*60\*1000,EXTERNAL_RETRY=5000,CHECK_INTERVAL=24\*60\*60\*1000,CHECK_RETRY_BASE=5\*60\*1000,CHECK_RETRY_MAX=60\*60\*1000,BACKUP_WAIT=60\*1000/u,'checked updater must retain ready, safety, backup-wait and 24-hour check cadence');
assert.doesNotMatch(updater,/PWA_UPDATE_RETRY_MS=1800/u,'waiting updates must not restore legacy 1.8-second polling');
assert.match(updater,/CHECK_RETRY_BASE=5\*60\*1000,CHECK_RETRY_MAX=60\*60\*1000/u,'failed checks need bounded retry backoff');

const checkStart=updater.indexOf('async function checkIfDue(');
const checkEnd=updater.indexOf('lifecycle=input.lifecycle.module.createCoordinator',checkStart);
assert.ok(checkStart>0&&checkEnd>checkStart,'checked update-check scheduler function not found');
const checkBody=updater.slice(checkStart,checkEnd);
const requestIndex=checkBody.indexOf('await lifecycle.checkForUpdate()');
const markIndex=checkBody.indexOf('markCheck()');
assert.ok(requestIndex>=0&&markIndex>requestIndex,'successful-check timestamp must be written only after registration.update succeeds');

const applyStart=updater.indexOf('async function applyFromUi()');
const applyEnd=updater.indexOf('function renderStatus',applyStart);
assert.ok(applyStart>0&&applyEnd>applyStart,'checked manual update handler not found');
const applyBody=updater.slice(applyStart,applyEnd);
const preflightIndex=applyBody.indexOf('ignoreActiveTimers:true');
const pauseIndex=applyBody.indexOf('effects.pauseTimer()');
assert.ok(preflightIndex>=0&&pauseIndex>preflightIndex,'Pause & Update must preflight non-timer blockers before pausing the timer');

assert.match(updater,/activeReservation!==token/u,'reservation validation must be tied to the exact operation token');
assert.match(updater,/token\.workRevision!==state\.workRevision\(\)/u,'reservation validation must reject newer work');
assert.match(updater,/await input\.reservation\.settleMutation\(\)/u,'unreserved preparation must still wait for the mutation coordinator');
assert.match(app,/flushPendingReview:async\(\)=>await flushPendingReviewSave\(\{strict:true,allowDuringRecoveryQuiescence:true\}\)!==false/u,'PWA-owned Review checkpoint must be allowed inside its recovery-quiesced reservation and normalize sync\/async persistence to a strict boolean');
assert.match(updater,/loaded\.value\.revision\)!==Number\(liveResult\.value\.revision\)/u,'active-session persistence must retain read-back verification');
assert.match(updater,/state\.providerBusy\(\)\|\|state\.providerBackgroundBackupActive\(\)/u,'a running background backup must defer update activation');
assert.match(updater,/effects\.flushAutomaticBackups\('app-update'\)/u,'checked update safety must own the pre-update backup wait policy');
assert.doesNotMatch(app,/PWA_UPDATE_BACKUP_WAIT_MS|function backUpBeforeUpdate\b/u,'PWA-specific backup wait policy must not remain in unchecked main');
assert.match(updater,/lifecycle\.reconcileFollowerRole\(state\.ownership\(\)\.state===configuration\.secondaryState\)/u,'ownership projection must continuously reconcile candidate follower evidence');
assert.match(lifecycle,/function hasFollowerEvidence\(\).*followerIdentities\.size>0\|\|!!candidate&&followerWorkers\.has\(candidate\)/u,'exact follower evidence must survive a secondary-to-primary ownership handoff until controller reconciliation');
assert.match(lifecycle,/identity\.releaseId!==target\.releaseId\|\|identity\.buildId!==target\.buildId\|\|identity\.assetId!==target\.assetId/u,'reload authorization must re-identify the exact release, build and page-asset tuple');
assert.match(lifecycle,/followerIdentities\.has\(followerIdentity\(target\)\)/u,'external follower ownership must survive browser ServiceWorker wrapper replacement by verified full identity');
assert.doesNotMatch(lifecycle,/captureWorkerRole\(source,String\(data\['releaseId'\]/u,'candidate hint release strings must not establish follower identity');
assert.match(lifecycle,/rememberFollowerHint\(source,data\)/u,'candidate announcements may retain only a complete identity tuple for follower handoff');
assert.match(sw,/SD_PWA_UPDATE_AVAILABLE',releaseId:RELEASE_ID,buildId:BUILD_ID,assetId:ASSET_ID/u,'waiting-worker announcements must carry the immutable identity tuple');
assert.match(sw,/SD_PWA_ACTIVATED',releaseId:RELEASE_ID,buildId:BUILD_ID,assetId:ASSET_ID/u,'activation announcements must carry the immutable identity tuple');

assert.match(sw,/\bPRECACHE_CONCURRENCY=8\b/u,'Service Worker precache concurrency must be explicitly bounded at eight');
assert.match(sw,/const worker=async\(\)=>\{while\(!failure\)/u,'precache installation must use a bounded worker queue rather than fixed batches');
assert.match(sw,/Promise\.all\(Array\.from\(\{length:Math\.min\(PRECACHE_CONCURRENCY,PRECACHE\.length\)\},\(\)=>worker\(\)\)\)/u,'precache worker count must be bounded by both the concurrency limit and asset count');
assert.match(sw,/if\(failure\)throw failure;/u,'worker-queue failures must still fail installation before release metadata is committed');
assert.match(sw,/parseCacheIdentities\(decodeURIComponent\('@@SD_CACHE_STORAGE_IDENTITIES_URI@@'\)\)/u,'cache identities must be safely quoted then validated');
assert.match(sw,/const PRECACHE=parsePrecache\('@@SD_PWA_ASSET_MANIFEST@@'\)/u,'precache data must be validated at consumption');
assert.match(sw,/resolved\.origin!==base\.origin\|\|!resolved\.pathname\.startsWith\(base\.pathname\)\|\|resolved\.search\|\|resolved\.hash/u,'precache paths must remain inside the service-worker scope without query or fragment ambiguity');

console.log(JSON.stringify({status:'PASS',suite:'pwa-updater-contract',checks:{checkedOwner:true,cooldown24h:true,successTimestamp:true,boundedBackoff:true,preflightBeforePause:true,reservationIdentity:true,sessionReadback:true,precacheValidation:true,precacheConcurrency8:true,workerQueue:true}},null,2));
