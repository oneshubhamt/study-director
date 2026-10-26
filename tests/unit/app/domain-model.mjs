import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const execute=file=>vm.runInThisContext(readScript(new URL(file,import.meta.url).pathname),{filename:file});
execute('../../../source/core/internal.js');
execute('../../../source/core/domain.ts');

const limits=Object.freeze({
  maxAreaNameChars:80,
  maxDurationMinutes:1440,
  maxScheduleChars:20000,
  maxScheduleRows:200,
  maxTaskNameChars:120,
  maxTasksPerDay:200,
  maxUnitChars:40
});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const domain=registry.require('domain',1,limits);
const {TimeModel:time,ScheduleModel:schedule,CompletionModel:completion,OutcomeModel:outcomes}=domain;

// Study-day time semantics: the day rolls over at 04:00 without leaking clock arithmetic to callers.
assert.equal(time.rolloverHour,4);
assert.equal(time.clockMinuteToStudyMinute(4*60),0);
assert.equal(time.clockMinuteToStudyMinute(3*60+59),1439);
assert.equal(time.studyMinuteToHHMM(0),'04:00');
assert.equal(time.studyMinuteToHHMM(1439),'03:59');
assert.equal(time.normalizeHHMM('7:05'),'07:05');
assert.equal(time.normalizeHHMM('24:00'),'');
assert.equal(time.isValidIsoDate('2024-02-29'),true);
assert.equal(time.isValidIsoDate('2025-02-29'),false);
assert.equal(time.formatDuration(135),'2h 15m');
assert.equal(time.formatSeconds(-3661),'-01:01:01');

// Schedule parsing/normalization is deterministic across supported row formats and hostile identifier text.
const csv=schedule.parseText('Start,Mins,Task,Kind,Area,Measure,Target\n05:00,60,"Essay, outline",study,GS 2,pages,4');
assert.equal(csv.ok,true);
assert.equal(csv.parsed.length,1);
assert.deepEqual({...csv.parsed[0]},{start:'05:00',dur:60,name:'Essay, outline',kind:'work',area:'GS 2',measure:'pages',target:4});
const pipe=schedule.parseText('05:00 | 30 | Walk | routine | exercise | km | 2');
assert.equal(pipe.ok,true);
assert.equal(pipe.parsed[0].kind,'support');
assert.equal(schedule.normalizeKind('unknown','sleep',''),'fixed');
assert.equal(schedule.normalizeArea('  GS 2 > Polity  '),'gs 2 > polity');
assert.equal(schedule.displayArea('  GS 2 > Polity  '),'GS 2 > Polity');
assert.deepEqual(Array.from(schedule.parentAreaKeys('gs > polity > parliament')),['gs','gs > polity']);
assert.equal(schedule.cleanIdentifierText('A\u202eB'),'A B');
assert.equal(schedule.normalizeTarget('—'),null);
assert.equal(schedule.normalizeTarget('1000001'),1000000);
assert.equal(schedule.fingerprint(csv.parsed),schedule.fingerprint(csv.parsed.map(row=>({...row}))));

// Completion evidence has an explicit precedence order: skip > manual > units > focus/time > unresolved.
assert.deepEqual({...completion.resolve({skipped:true,storedPct:90})},{pct:0,source:'skipped'});
assert.deepEqual({...completion.resolve({source:'manual',storedPct:42,unitPct:80,focusPct:90})},{pct:42,source:'manual'});
assert.deepEqual({...completion.resolve({unitPct:75,focusPct:90})},{pct:75,source:'units'});
assert.deepEqual({...completion.resolve({focusPct:55,doneFlag:true})},{pct:55,source:'finished-time'});
assert.deepEqual({...completion.resolve({doneFlag:true})},{pct:0,source:'finished-unverified'});
assert.equal(completion.fromUnits(3,4),75);
assert.equal(completion.fromUnits(3,0),null);
assert.equal(completion.fromFocus(90,60,{cap:100}),100);

// Outcome classification distinguishes no-evidence completion from measured zero output.
assert.equal(outcomes.classify({kind:'work',completion:100}),'full');
assert.equal(outcomes.classify({kind:'work',completion:35}),'partial');
assert.equal(outcomes.classify({kind:'work',skipped:true}),'skipped');
assert.equal(outcomes.classify({kind:'work',doneFlag:true}),'finished-unverified');
assert.equal(outcomes.classify({kind:'work',completionSource:'units',completion:0}),'zero-output');
assert.equal(outcomes.classify({kind:'work'}),'untouched');
const counts=outcomes.count([
  {kind:'work',completion:100},
  {kind:'work',completion:25},
  {kind:'support',completion:100},
  {kind:'work',skipped:true}
]);
assert.deepEqual({...counts},{full:1,partial:1,skipped:1,untouched:0,'finished-unverified':0,'zero-output':0});
assert.equal(outcomes.total(counts),3);

assert.equal(domain.makeTaskId({name:'  GS-2 / Polity!  '},0),'t01_gs-2-polity');
assert.equal(Object.isFrozen(domain),true);
assert.equal(Object.isFrozen(time),true);

console.log(JSON.stringify({status:'PASS',contract:'domain-model',time:true,schedule:true,completion:true,outcomes:true},null,2));
