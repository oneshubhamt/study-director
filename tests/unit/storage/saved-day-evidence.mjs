import assert from 'node:assert/strict';
import {Domain,dailyRecordCodec} from '../../helpers/current-codec-fixture.mjs';

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
console.log(JSON.stringify({status:'PASS',suite:'saved-day-evidence',revisionsAreLocal:true,coveragePreservesActualWork:true}));
