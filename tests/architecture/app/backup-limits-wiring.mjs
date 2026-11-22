import {readScript} from '../../../build/source-script.mts';
import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import {PRODUCTION_LIMITS} from '../../../contracts/production-limits.mjs';

// The Backup module declares every production limit it reads. The typed host now
// passes the complete canonical APP_LIMITS object, so no hand-picked wiring can
// silently omit a newly required limit.
const backup=readRuntimeSource('source/core/backup.ts'),host=readScript('source/host/main.ts');
const read=new Set([...backup.matchAll(/APP_LIMITS\.([A-Za-z]+)/gu)].map(match=>match[1]));
const declared=backup.match(/const REQUIRED_LIMITS=freeze\(\[([^\]]*)\]\s*\)/u);
assert.ok(declared,'backup.js declares the limits it requires');
const required=new Set([...declared[1].matchAll(/'([A-Za-z]+)'/gu)].map(match=>match[1]));
for(const key of read)assert.ok(required.has(key),`backup.js reads APP_LIMITS.${key}, so it must be in REQUIRED_LIMITS`);

const start=host.indexOf('const BackupRuntimeHost=BackupRecoveryHostModule.createRuntime(');
assert.ok(start>=0,'the typed host creates the checked Backup runtime host');
const end=host.indexOf('appData:AppData',start);
assert.ok(end>start,'the checked Backup runtime host exposes its configuration before AppData composition');
const block=host.slice(start,end);
assert.match(block,/limits:APP_LIMITS/u,'the Backup runtime receives the complete canonical limits object');
for(const key of required)assert.ok(Number(PRODUCTION_LIMITS[key])>0,`${key} is a positive production limit`);
console.log(JSON.stringify({status:'PASS',suite:'backup-limits-wiring',required:[...required].sort(),read:[...read].sort()}));
