import {readHostHtml} from '../../../build/host-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=readHostHtml();
const sw=fs.readFileSync('source/platform/sw.js','utf8');
assert.match(app,/const PWA_UPDATE_CHECK_INTERVAL_MS=24\*60\*60\*1000;/,'proactive update checks must use a 24-hour success cooldown');
assert.doesNotMatch(app,/const PWA_UPDATE_RETRY_MS=1800;/,'waiting updates must not use the legacy 1.8-second polling loop');
assert.match(app,/const PWA_UPDATE_SAFETY_RETRY_MS=5\*60\*1000;/,'waiting updates need only a slow safety fallback');
assert.match(app,/PWA_UPDATE_CHECK_RETRY_BASE_MS/,'failed checks need bounded retry backoff');
assert.match(app,/PWA_UPDATE_CHECK_RETRY_MAX_MS/,'failed checks need a maximum retry bound');

const checkStart=app.indexOf('async function checkPwaUpdateIfDue(');
const checkEnd=app.indexOf('\nconst PwaLifecycle=',checkStart);
assert.ok(checkStart>0&&checkEnd>checkStart,'update-check scheduler function not found');
const checkBody=app.slice(checkStart,checkEnd);
const requestIndex=checkBody.indexOf('await PwaLifecycle.checkForUpdate()');
const markIndex=checkBody.indexOf('markPwaUpdateCheck');
assert.ok(requestIndex>=0&&markIndex>requestIndex,'successful-check timestamp must be written only after registration.update succeeds');

const applyStart=app.indexOf('async function applyPwaUpdateFromUi()');
const applyEnd=app.indexOf('\nfunction renderPwaUpdateStatus',applyStart);
assert.ok(applyStart>0&&applyEnd>applyStart,'manual update handler not found');
const applyBody=app.slice(applyStart,applyEnd);
const preflightIndex=applyBody.indexOf('ignoreActiveTimers:true');
const pauseIndex=applyBody.indexOf('togglePause()');
assert.ok(preflightIndex>=0&&pauseIndex>preflightIndex,'Pause & Update must preflight non-timer blockers before pausing the timer');

assert.match(sw,/const PRECACHE_CONCURRENCY=4;/,'Service Worker precache concurrency must be explicitly bounded at four');
assert.match(sw,/Promise\.allSettled/,'concurrent precache batches must settle before fail-closed cleanup');

console.log(JSON.stringify({status:'PASS',suite:'pwa-updater-contract',checks:{cooldown24h:true,successTimestamp:true,boundedBackoff:true,eventDrivenWaiting:true,preflightBeforePause:true,precacheConcurrency4:true}},null,2));
