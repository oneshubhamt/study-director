import assert from 'node:assert/strict';
import {RecordCodecs,CompatibilityCodecs,Domain,helpers,limits,dataContract,dailyRecordCodec,freeze,boundedInt,boundedNumber,optionalBoundedNumber,optionalText,clampText,normalizeTimestamp,sameDataValue} from '../../helpers/current-codec-fixture.mjs';

// Support Activities (registry: support-note-identity). Builds up to
// SDVB75F28 stored it under a reserved title; this build stores it under its
// own name and gives a new one a fixed id. The current codecs refuse the
// reserved title, so no copy of it passes as current; the compatibility
// codecs give it the note's own name and change nothing else, in the note
// and in a version of it kept for review.
const RETIRED='__study_director_support_activities__',NoteKeys=dailyRecordCodec.noteKeys;
assert.deepEqual({...NoteKeys.support},{id:'n_f0929787c2c33fc9',label:'Support Activities',title:'support activities'});
assert.equal(Domain.ScheduleModel.normalizeArea(NoteKeys.support.label),NoteKeys.support.title,'its title is its name, as for any note');

const other='n_00000000000000aa',id='n_00000000000000bb';
const stored={version:3,key:id,label:RETIRED,text:'WG1:{"v":1}',updatedAt:'2026-11-01T08:00:00.000Z',links:[other]};
assert.equal(dailyRecordCodec.sanitizeCurrentNote(stored),null,'the reserved title is not current');
assert.equal(dailyRecordCodec.sanitizeNoteFields({label:RETIRED,text:'x'}),null,'nor in a kept version');
assert.ok(dailyRecordCodec.sanitizeCurrentNote({...stored,label:'Support Activities'}),'its own name is');

const pendingReviewCodec=RecordCodecs.createPendingReviewCodec(freeze({dataContract,dailyRecordCodec,activeSessionCodec:freeze({sanitizeCurrent:value=>value,contentValue:value=>value}),personalDataCodec:freeze({normalize:value=>value}),helpers:freeze({sameDataValue,randomBytes:size=>new Uint8Array(size)})}));
const compatibility=CompatibilityCodecs.create(freeze({
  limits,dataContract,keyedRecord:freeze({create:()=>Object.create(null)}),dailyRecordCodec,activeSessionCodec:freeze({sanitizeCurrent:value=>value,normalize:value=>value}),personalDataCodec:freeze({normalize:value=>value}),pendingReviewCodec,
  helpers:freeze({boundedInt,boundedNumber,optionalBoundedNumber,optionalText,clampText,clampEditorContent:clampText,editorContentWithinLimits:()=>true,sameDataValue,sanitizePracticeRun:helpers.sanitizePracticeRun,activeSessionScheduleFingerprint:()=>'fp',isValidIsoDate:value=>/^\d{4}-\d{2}-\d{2}$/u.test(String(value)),isCanonicalScheduleText:()=>true}),
  timestamps:freeze({normalizeTimestamp,normalizeImportedTimestamp:normalizeTimestamp}),domain:Domain,installationId:()=>'inst_support_device'
}));

// The note: its own name; id, links, text and time kept.
assert.equal(compatibility.olderNote(stored),true);
assert.deepEqual(compatibility.note(stored,id),{...stored,label:'Support Activities'});
const current={...stored,label:'Support Activities'};
assert.equal(compatibility.olderNote(current),false,'a current note is not older');
assert.deepEqual(compatibility.note(current,id),current,'and passes unchanged');
// A name-keyed note (manifest 5 and older) under the reserved name takes the
// id worked out from that name, the fixed id, and its own name.
assert.deepEqual(compatibility.note({key:RETIRED,text:'old',updatedAt:'2026-01-01T00:00:00.000Z'},RETIRED),{version:3,key:NoteKeys.support.id,label:'Support Activities',text:'old',updatedAt:'2026-01-01T00:00:00.000Z'},'a name-keyed support note becomes the fixed id');

// A version of it kept for review: kept and base titles take its name.
const review={version:2,id:'pr_'+'a'.repeat(32),subject:'note',ref:id,keptAt:'2026-11-02T08:00:00.000Z',keptFrom:'',keptChangedAt:'',kept:{label:RETIRED,text:'kept text'},base:{label:RETIRED},resolvedAt:''};
assert.equal(pendingReviewCodec.normalize(review),null,'a review holding the reserved title is not current');
assert.equal(compatibility.olderReview(review),true);
assert.deepEqual(compatibility.pendingReview(review),{...review,kept:{label:'Support Activities',text:'kept text'},base:{label:'Support Activities'}});
const textOnly={...review,kept:{text:'kept text'},base:null};
assert.equal(compatibility.olderReview(textOnly),false,'a review of the text alone is current');
assert.ok(pendingReviewCodec.normalize(textOnly));
assert.equal(compatibility.olderReview({...review,subject:'savedDay',ref:'2026-11-01',kept:null,base:null}),false,'only note reviews hold titles');

console.log(JSON.stringify({status:'PASS',suite:'support-note-identity',fixedId:NoteKeys.support.id,retiredTitleRefused:true,noteConverted:true,nameKeyedConverted:true,reviewConverted:true},null,2));
