import assert from 'node:assert/strict';
import {Domain,dailyRecordCodec,limits} from '../../helpers/current-codec-fixture.mjs';

// A real production-codec test: device revisions cannot substitute for
// evidence, and later coverage cannot conceal reduced/contradictory work.
const scheduleText='08:00 | 60 | Ethics | work | Ethics | block | 1';
const parsed=Domain.ScheduleModel.parseText(scheduleText);
assert.equal(parsed.ok,true,'The test schedule must parse through the production domain model.');
const schedule=parsed.parsed.map(row=>({
  start:row.start,duration:row.dur,name:row.name,kind:row.kind,
  area:row.area,measure:row.measure,target:row.target
}));
const date='2026-09-17';
const session={date,scheduleText,snapshot:{
  contentRevision:7,savedRevision:7,review:{reflection:'Retained reflection',studyQuality:4},
  practice:{runs:[]},taskState:{t1:{
    completion:50,progress:{done:5,total:10},actual:{seconds:1800}
  }},scheduleAdjustments:{},latestCarryForward:'Continue tomorrow'
}};
const record={recordKind:'study',date,sourceRevision:5,schedule,practiceRuns:[],
  reflection:'Retained reflection',studyQuality:4,carryForwardDraft:'Continue tomorrow',
  results:{t1:{completion:50,done:5,total:10,actualSeconds:1800}}};
const covers=dailyRecordCodec.savedDayCoversSessionEvidence;
assert.equal(covers(record,session),true,
  'Different local revision numbers must not invalidate matching study evidence.');
assert.equal(covers({...record,sourceRevision:900},session,{allowAdvances:true}),true,
  'The originating device can assign any unrelated Saved Day source revision.');
assert.equal(covers({...record,reflection:'Changed'},session),false,
  'Changed reflection content is not identical evidence.');
assert.equal(covers({...record,schedule:[{...schedule[0],name:'Different task'}]},session,{allowAdvances:true}),false,
  'A different schedule does not cover the session.');
assert.equal(covers({...record,results:{t1:{...record.results.t1,completion:49}}},session,{allowAdvances:true}),false,
  'Reduced completion cannot count as a later advance.');
assert.equal(covers({...record,results:{t1:{...record.results.t1,actualSeconds:1900}}},session),false,
  'Exact evidence mode rejects changed recorded time.');
assert.equal(covers({...record,results:{t1:{...record.results.t1,actualSeconds:1900}}},session,{allowAdvances:true}),true,
  'Coverage mode can accept later recorded study time.');

// An unfinished Practice Pacer attempt is actual study evidence, not merely
// the already-finalized practice.runs array. Matching task/configuration and
// completed units must be covered by a separate canonical finalized run.
const practiceActive={taskId:'t1',targetMs:60000,unitMs:[61000],currentMs:30000,
  anchorMs:null,pauseCause:'manual',cueStage:0,totalUnits:3};
const withActive={...session,snapshot:{...session.snapshot,
  practice:{runs:[],active:practiceActive}}};
assert.equal(covers(record,withActive,{allowAdvances:true}),false,
  'A Saved Day without the unfinished attempt cannot cover an active Practice Pacer run.');
const savedPractice={targetMs:60000,unitMs:[61000,30000],partial:true,taskId:'t1',totalUnits:3};
const withPartial={...record,practiceRuns:[savedPractice]};
assert.equal(covers(withPartial,withActive),true,
  'A finalized partial run with exact observed units covers the prior paused attempt.');
assert.equal(covers({...withPartial,practiceRuns:[{...savedPractice,unitMs:[61000,40000]}]},withActive),false,
  'Exact coverage does not silently accept progressed current units.');
assert.equal(covers({...withPartial,practiceRuns:[{...savedPractice,unitMs:[61000,40000]}]},withActive,{allowAdvances:true}),true,
  'Later completed practice time may cover recorded earlier active evidence.');
for(const changed of [
  {...savedPractice,taskId:'unrelated-task'},
  {...savedPractice,targetMs:90000},
  {...savedPractice,unitMs:[60000,30000]},
  {...savedPractice,unitMs:[61000,20000]}
])assert.equal(covers({...withPartial,practiceRuns:[changed]},withActive,{allowAdvances:true}),false,
  'An unrelated task, changed settings, reduced time or changed finished unit never proves the same active work.');
const withFinishedAndActive={...withActive,snapshot:{...withActive.snapshot,
  practice:{runs:[savedPractice],active:practiceActive}}};
assert.equal(covers(withPartial,withFinishedAndActive,{allowAdvances:true}),false,
  'One Saved Day run cannot cover both an earlier distinct run and the active attempt.');
const setupOnly={...withActive,snapshot:{...withActive.snapshot,practice:{runs:[],
  active:{...practiceActive,unitMs:[],currentMs:0}}}};
assert.equal(covers(record,setupOnly,{allowAdvances:true}),true,
  'An untouched, zero-time setup is not saved study evidence.');

// A running active attempt has accrued time since its anchor, even before
// the next pause writes that time into currentMs. The persisted session
// timestamp bounds that evidence; an unavailable clock fails closed.
const runningFrom=Date.parse('2026-09-17T08:00:00.000Z');
const stillRunning={...withActive,snapshot:{...withActive.snapshot,
  updatedAt:'2026-09-17T08:00:10.000Z',
  practice:{runs:[],active:{...practiceActive,anchorMs:runningFrom}}}};
assert.equal(covers({...withPartial,practiceRuns:[{...savedPractice,unitMs:[61000,39000]}]},stillRunning,{allowAdvances:true}),false,
  'Saved Day evidence must include elapsed time since the observed practice anchor.');
assert.equal(covers({...withPartial,practiceRuns:[{...savedPractice,unitMs:[61000,40000]}]},stillRunning,{allowAdvances:true}),true,
  'A finalized run with at least all observed elapsed time covers a running snapshot.');
assert.equal(covers(withPartial,{...stillRunning,snapshot:{...stillRunning.snapshot,updatedAt:null}},{allowAdvances:true}),false,
  'Missing snapshot clock evidence cannot prove a running attempt was recorded.');

// The live Practice Pacer saturates its active unit at the 24-hour limit.
// Evidence reconstruction must use that same limit, not demand impossible
// overtime after a resumed near-limit attempt.
const cap=limits.maxPracticeTargetMs;
const nearLimit={...stillRunning,snapshot:{...stillRunning.snapshot,
  practice:{runs:[],active:{...practiceActive,unitMs:[],currentMs:cap-500,
    anchorMs:runningFrom}}}};
const cappedRun={targetMs:practiceActive.targetMs,taskId:practiceActive.taskId,
  totalUnits:practiceActive.totalUnits,partial:true,unitMs:[cap]};
assert.equal(covers({...record,practiceRuns:[cappedRun]},nearLimit,{allowAdvances:true}),true,
  'The canonical maximum-duration run covers a running attempt already saturated by the live pacer.');
assert.equal(covers({...record,practiceRuns:[{...cappedRun,unitMs:[cap-1]}]},nearLimit,{allowAdvances:true}),false,
  'A duration even one millisecond below the canonical saturation point must not be treated as covered.');
assert.equal(covers({...record,practiceRuns:[cappedRun]},
  {...nearLimit,snapshot:{...nearLimit.snapshot,updatedAt:null}},{allowAdvances:true}),false,
  'A saturated unit cannot excuse a missing timestamp for a running attempt.');

// Save Today while a block had just started: no time on it, so the Saved Day
// keeps its start but no end, and still covers the session (startup asked
// about an "unsaved previous study day" every time).
{
  const started={...session,snapshot:{...session.snapshot,taskState:{...session.snapshot.taskState,t2:{progress:{total:1},actual:{
    clock:{startedAt:'2026-09-17T10:00:00.000Z'},record:{firstStartedAt:'2026-09-17T10:00:00.000Z',lastEndedAt:'2026-09-17T10:00:00.600Z',activeSeconds:0,sessionCount:1}}}}}};
  const saved={...record,results:{...record.results,t2:{completion:0,total:1,actualStart:'2026-09-17T10:00:00.000Z',sessionCount:1}}};
  assert.equal(covers(saved,started,{allowAdvances:true}),true,'a block with no time recorded is covered without an end');
  const timed={...started,snapshot:{...started.snapshot,taskState:{...started.snapshot.taskState,t2:{...started.snapshot.taskState.t2,actual:{...started.snapshot.taskState.t2.actual,seconds:30}}}}};
  assert.equal(covers(saved,timed,{allowAdvances:true}),false,'time on the block still needs the Saved Day to hold it');
}
console.log(JSON.stringify({status:'PASS',suite:'saved-day-evidence',revisionsAreLocal:true,coveragePreservesActualWork:true}));
