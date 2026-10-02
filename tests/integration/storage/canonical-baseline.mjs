import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';

const date='2026-09-10';
const legacy={date,version:0,reflection:'legacy'};
const fallbackLegacy={date:'2026-09-09',version:0,reflection:'fallback'};
const stores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map([[date,legacy]]),summary:new Map(),session:new Map(),meta:new Map()};
const local=new Map([['fallback',[fallbackLegacy]]]);
const {app}=createHarness(local,stores);

let proof=await app.compatibility.verifyDailyRecords();
assert.equal(proof.ok,false,'historical records must not be reported as canonical before migration');
assert.ok(proof.issues.some(issue=>issue.startsWith('daily-record:')));

const migration=await app.compatibility.migrateDailyRecords();
assert.equal(migration.records,1);
assert.equal(migration.rewritten,1,'historical canonical record must be rewritten, not merely normalized on read');
assert.equal(migration.fallbackRecords,1);
assert.equal(stores.daily.get(date).version,1);
assert.equal(local.get('fallback')[0].version,1,'fallback Daily Records must be rewritten to the same canonical schema');
assert.equal(stores.summary.has(date),true,'derived summary must be rebuilt from the canonical record');

proof=await app.compatibility.verifyDailyRecords();
assert.equal(proof.ok,true,'post-migration stored records, summaries, fallback and marker must all prove canonical');
assert.equal(proof.issues.length,0);

stores.daily.set(date,{...stores.daily.get(date),version:0});
proof=await app.compatibility.verifyDailyRecords();
assert.equal(proof.ok,false,'canonical proof must detect historical data that reappears after migration');
assert.ok(proof.issues.includes(`daily-record:${date}`));

console.log(JSON.stringify({status:'PASS',suite:'canonical-baseline',migration,proofAfterTamper:proof},null,2));
