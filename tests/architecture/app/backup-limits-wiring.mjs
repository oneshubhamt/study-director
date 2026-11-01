import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PRODUCTION_LIMITS} from '../../../contracts/production-limits.mjs';

// The Backup module is given a hand-picked set of limits. A limit it reads but
// is not given becomes undefined: the review merge then keeps no resolved
// reviews and every sync that brings one in fails its own commit check
// (Entry 022). Every limit backup.js reads must be required at start-up and
// wired from the app's limits.
const backup=fs.readFileSync('source/core/backup.js','utf8'),app=fs.readFileSync('source/app.html','utf8');
const read=new Set([...backup.matchAll(/APP_LIMITS\.([A-Za-z]+)/gu)].map(match=>match[1]));
const declared=backup.match(/const REQUIRED_LIMITS=freeze\(\[([^\]]*)\]\)/u);
assert.ok(declared,'backup.js declares the limits it requires');
const required=new Set([...declared[1].matchAll(/'([A-Za-z]+)'/gu)].map(match=>match[1]));
for(const key of read)assert.ok(required.has(key),`backup.js reads APP_LIMITS.${key}, so it must be in REQUIRED_LIMITS`);
assert.match(backup,/REQUIRED_LIMITS\.filter\(key=>!\(Number\(ports\.configuration\.limits\[key\]\)>0\)\)/u,'start-up refuses a missing or non-positive limit');

const start=app.indexOf('const BackupRuntime=BackupModule.createRuntime(');
assert.ok(start>=0,'the app creates the Backup runtime');
const block=app.slice(start,app.indexOf('persistence:Object.freeze({',start)),wired=block.match(/limits:Object\.freeze\(\{([\s\S]*?)\}\)/u);
assert.ok(wired,'the Backup runtime receives a limits object');
const entries=new Map([...wired[1].matchAll(/([A-Za-z]+):APP_LIMITS\.([A-Za-z]+)/gu)].map(match=>[match[1],match[2]]));
for(const key of required){
  assert.equal(entries.get(key),key,`the app wires ${key} from APP_LIMITS.${key}`);
  assert.ok(Number(PRODUCTION_LIMITS[key])>0,`${key} is a positive production limit`);
}
console.log(JSON.stringify({status:'PASS',suite:'backup-limits-wiring',required:[...required].sort(),read:[...read].sort()}));
