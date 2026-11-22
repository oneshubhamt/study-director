import assert from 'node:assert/strict';
import {RecordCodecs,Domain,helpers,limits,dataContract,dailyRecordCodec,freeze,boundedInt,boundedNumber,optionalBoundedNumber,optionalText,clampText,normalizeTimestamp,sameDataValue} from '../../helpers/current-codec-fixture.mjs';

// Current Support Activities identity and canonical linked notes.
const NoteKeys=dailyRecordCodec.noteKeys;
assert.deepEqual({...NoteKeys.support},{id:'n_f0929787c2c33fc9',label:'Support Activities',title:'support activities'});
assert.equal(Domain.ScheduleModel.normalizeArea(NoteKeys.support.label),NoteKeys.support.title,'its title is its name, as for any note');

const other='n_00000000000000aa',id='n_00000000000000bb';
const stored={version:3,key:id,label:'Support Activities',text:'WG1:{"v":1}',updatedAt:'2026-11-01T08:00:00.000Z',links:[other]};
assert.ok(dailyRecordCodec.sanitizeCurrentNote({...stored,label:'Support Activities'}),'its own name is');

const pendingReviewCodec=RecordCodecs.createPendingReviewCodec(freeze({dataContract,dailyRecordCodec,activeSessionCodec:freeze({sanitizeCurrent:value=>value,contentValue:value=>value}),personalDataCodec:freeze({normalize:value=>value}),helpers:freeze({sameDataValue,randomBytes:size=>new Uint8Array(size)})}));
// A version of it kept for review: kept and base titles take its name.
const review={version:2,id:'pr_'+'a'.repeat(32),subject:'note',ref:id,keptAt:'2026-11-02T08:00:00.000Z',keptFrom:'',keptChangedAt:'',kept:{label:'Support Activities',text:'kept text'},base:{label:'Support Activities'},resolvedAt:''};
const textOnly={...review,kept:{text:'kept text'},base:null};
assert.ok(pendingReviewCodec.normalize(textOnly));

console.log(JSON.stringify({status:'PASS',suite:'support-note-identity',fixedId:NoteKeys.support.id,currentTitle:true},null,2));
