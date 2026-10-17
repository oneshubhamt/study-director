import assert from 'node:assert/strict';
import {RecordCodecs,Domain,helpers,limits,dataContract,freeze,normalizeTimestamp} from '../../helpers/current-codec-fixture.mjs';

// A note's text is checked against the rich-text limits once. Reading the
// same notes again (at start-up, for backups and upkeep) compares the text
// with the one last found sound instead of parsing it again; anything else is
// checked as before, and a text that fails is never remembered.
let checks=0;
const codec=RecordCodecs.createDailyRecordCodec(freeze({
  limits:freeze({...limits,maxNotes:3}),dataContract,domain:Domain,keyedRecord:freeze({create:()=>Object.create(null)}),
  helpers:freeze({...helpers,editorContentWithinLimits:value=>{checks++;return !String(value).includes('over the limit');}}),
  timestamps:freeze({normalizeTimestamp,normalizeImportedTimestamp:normalizeTimestamp,normalizeImportedEpochMillis:(value,fallback=null)=>Number.isFinite(Number(value))?Number(value):fallback}),
  timer:freeze({modes:freeze({PAUSED:'paused',RUNNING:'running'}),defaultBreakSeconds:()=>300})
}));
const id=n=>`n_${String(n).padStart(16,'0')}`;
const note=(n,text)=>({version:3,key:id(n),label:`Note ${n}`,text,updatedAt:'2026-10-01T10:00:00.000Z'});
const read=(n,text)=>codec.sanitizeCurrentNote(note(n,text));

assert.deepEqual(read(1,'first text'),note(1,'first text'));assert.equal(checks,1);
assert.deepEqual(read(1,'first text'),note(1,'first text'));assert.equal(checks,1,'the same text is not checked again');
assert.deepEqual(read(1,['first',' text'].join('')),note(1,'first text'));assert.equal(checks,1,'an equal copy read afresh is not checked again');
read(1,'edited text');assert.equal(checks,2,'a changed text is checked');
read(1,'first text');assert.equal(checks,3,'only the latest sound text is kept');
read(2,'first text');assert.equal(checks,4,'each note has its own');

assert.equal(read(3,'text over the limit'),null);assert.equal(read(3,'text over the limit'),null);assert.equal(checks,6,'a text that fails is checked every time');
assert.equal(codec.sanitizeCurrentNote({...note(1,'first text'),extra:true}),null,'the record shape is still checked on every read');

// At most one text per note the library can hold; the least recently read goes.
read(3,'third');read(1,'first text');assert.equal(checks,7);
read(4,'fourth');assert.equal(checks,8);
read(1,'first text');read(3,'third');assert.equal(checks,8,'recently read notes are kept');
read(2,'first text');assert.equal(checks,9,'the least recently read note was let go');

console.log(JSON.stringify({status:'PASS',suite:'note-text-checked-once',checks}));
