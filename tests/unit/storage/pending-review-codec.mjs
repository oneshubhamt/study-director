import assert from 'node:assert/strict';
import {RecordCodecs,freeze,sameDataValue,limits,dataContract,dailyRecordCodec} from '../../helpers/current-codec-fixture.mjs';
import {noteId} from '../../helpers/note-ids.mjs';

// PendingReview.v1: a version a sync kept for review. Only canonical records
// pass; a resolved one keeps only its id and wins every merge; resolved ones
// are bounded, open ones never dropped.
const personalDataCodec=RecordCodecs.createPersonalDataCodec(limits);
const activeSessionCodec=freeze({sanitizeCurrent:value=>value&&value.id==='current'?structuredClone(value):null});
const codec=RecordCodecs.createPendingReviewCodec(freeze({dataContract,dailyRecordCodec,activeSessionCodec,personalDataCodec,helpers:freeze({sameDataValue,randomBytes:length=>crypto.getRandomValues(new Uint8Array(length))})}));
assert.equal(codec.version,dataContract.schemas.PendingReview.version);

const id=noteId('ethics'),keptAt='2026-10-18T09:00:00.000Z';
const note=codec.create({subject:'note',ref:id,kept:{text:'their paragraph'},base:{text:'shared paragraph'},keptAt});
assert.match(note.id,/^pr_[a-f0-9]{32}$/u);assert.deepEqual(Object.keys(note).sort(),['base','id','kept','keptAt','ref','resolvedAt','subject','version']);
assert.deepEqual({...note,id:''},{version:1,id:'',subject:'note',ref:id,keptAt,kept:{text:'their paragraph'},base:{text:'shared paragraph'},resolvedAt:''});
assert.deepEqual(codec.normalize(note),note,'a stored review reads back unchanged');
assert.ok(codec.create({subject:'note',ref:id,kept:null}),'a note deleted on the other side keeps null');
assert.throws(()=>codec.create({subject:'note',ref:'Ethics',kept:{text:'x'}}),/invalid/u,'notes are named by id');
assert.throws(()=>codec.create({subject:'note',ref:id,kept:{text:'x'},base:{label:'y'}}),/invalid/u,'a base holds only the fields kept');
assert.throws(()=>codec.create({subject:'personal',ref:'personal',kept:null}),/invalid/u,'plans and settings are never kept as a deletion');
assert.throws(()=>codec.create({subject:'savedDay',ref:'2026-10-17',kept:{version:16,date:'2026-10-16'}}),/invalid/u,'a Saved Day is kept under its own date');
assert.equal(codec.normalize({...note,extra:true}),null,'unknown fields are refused');
assert.equal(codec.normalize({...note,keptAt:'18 Oct 2026'}),null,'times are canonical');

const resolved=codec.resolved(note,'2026-10-18T10:00:00.000Z');
assert.deepEqual(resolved,{...note,kept:null,base:null,resolvedAt:'2026-10-18T10:00:00.000Z'},'a resolved review keeps only its id');
assert.deepEqual(codec.richTexts(note),['their paragraph','shared paragraph'],'kept texts may use attachments');assert.deepEqual(codec.richTexts(resolved),[]);

const session=codec.create({subject:'session',ref:'session',kept:{id:'current',snapshot:{review:{reflection:'kept reflection'}}}});
assert.deepEqual(codec.richTexts(session),['kept reflection']);
const other=codec.create({subject:'note',ref:id,kept:{label:'Ethics II'},keptAt});
// A resolved review wins on every device; open ones are never dropped, and
// only the newest resolved ones are kept, as many as may wait.
assert.deepEqual(codec.merge([[note,other],[resolved]],10).map(review=>review.id),[note.id,other.id].sort());
assert.equal(codec.merge([[resolved],[note]],10).find(review=>review.id===note.id).resolvedAt,resolved.resolvedAt,'a resolved review wins');
assert.equal(codec.merge([[note],[resolved]],0).length,0,'resolved ones beyond the limit go');
assert.equal(codec.merge([[note,other]],0).length,2,'open ones always stay');
assert.throws(()=>codec.merge([[{...note,kept:'x'}]],10),/invalid/u,'an invalid review stops the merge');

console.log(JSON.stringify({status:'PASS',suite:'pending-review-codec',canonicalOnly:true,resolvedWins:true,openNeverDropped:true}));
