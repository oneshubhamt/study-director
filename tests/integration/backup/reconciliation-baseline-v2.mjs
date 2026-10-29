import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {APP_META_VALIDATION_OWNERS} from '../../../contracts/data-architecture.mjs';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {noteKeys,noteId} from '../../helpers/note-ids.mjs';

for(const file of ['source/core/internal.js','source/core/reconciliation-baseline.ts'])vm.runInThisContext(readScript(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')],BaselineModule=registry.require('reconciliation-baseline',1),freeze=Object.freeze;
const sharedStores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()};
const harness=createHarness(new Map(),sharedStores),gateway=harness.appMetaGateway;
const limits=freeze({maxAreaNameChars:160,maxRichTextBytes:2*1024*1024,maxNotes:1000});
const codec=BaselineModule.createCodec(freeze({limits,isNoteKey:noteKeys.isKey}));
// The base holds notes under their stored keys (ids).
const E=noteId('Ethics'),P=noteId('Polity'),S=noteId('Essay'),M=noteId('Missing');
const validators={};for(const name of APP_META_VALIDATION_OWNERS.host)validators[name]=()=>true;
validators.reconciliationBase=value=>codec.normalizeHeader(value)!==null;
validators.reconciliationBaseNotePrefix=(value,context)=>codec.normalizeNote(value,context)!==null;
validators.reconciliationBaseDayPrefix=(value,context)=>codec.normalizeDays(value,context)!==null;
gateway.registerValidators('host',freeze(validators));
const host=gateway.bind('host'),store=BaselineModule.createStore(freeze({codec,meta:host,families:freeze({days:'reconciliationBaseDayPrefix',header:'reconciliationBase',notes:'reconciliationBaseNotePrefix'})}));
const cp=n=>'cp_'+String(n).padStart(32,'0');
const identity=async keys=>({noteCount:keys.length,noteKeyFingerprint:await codec.keyFingerprint(keys)});
// The first canonical base is a full write.
const seed=freeze({format:'study-director.reconciliation-base-update',version:2,full:true,baseCheckpointId:'',noteCount:2,noteKeyFingerprint:'',personalFingerprint:'',sessionFingerprint:'',noteKeys:freeze([E,P]),updates:freeze({[E]:freeze({label:'Ethics',text:'ethics v1'}),[P]:freeze({label:'Polity',text:'polity v1'})}),deletes:freeze([]),days:freeze({})});
assert.equal(await store.write(cp(1),seed),true);
const first=await store.readHeader();
assert.equal(first.version,3);assert.equal(first.checkpointId,cp(1));assert.equal(first.noteCount,2);assert.match(first.noteKeyFingerprint,/^[a-f0-9]{64}$/u);
assert.equal(sharedStores.meta.get('reconciliationBaseNote:'+E).value.text,'ethics v1');assert.equal(sharedStores.meta.get('reconciliationBaseNote:'+E).value.label,'Ethics','the base keeps each note’s title too');
assert.equal(sharedStores.meta.get('reconciliationBaseNote:'+P).value.text,'polity v1');

const polityEnvelopeBefore=structuredClone(sharedStores.meta.get('reconciliationBaseNote:'+P)),ethicsEnvelopeBefore=structuredClone(sharedStores.meta.get('reconciliationBaseNote:'+E));
await new Promise(resolve=>setTimeout(resolve,2));
const editIdentity=await identity([E,P]),edit=freeze({format:'study-director.reconciliation-base-update',version:2,full:false,baseCheckpointId:cp(1),...editIdentity,personalFingerprint:null,sessionFingerprint:null,noteKeys:null,updates:freeze({[E]:freeze({label:'Ethics',text:'ethics v2'})}),deletes:freeze([]),days:freeze({})});
assert.equal(await store.write(cp(2),edit),true);
assert.equal((await store.readHeader()).checkpointId,cp(2));
assert.equal(sharedStores.meta.get('reconciliationBaseNote:'+E).value.text,'ethics v2');
assert.notEqual(sharedStores.meta.get('reconciliationBaseNote:'+E).updatedAt,ethicsEnvelopeBefore.updatedAt,'edited note baseline must receive a new envelope');
assert.deepEqual(sharedStores.meta.get('reconciliationBaseNote:'+P),polityEnvelopeBefore,'unchanged note baseline must not be rewritten');

const ethicsEnvelopeAfterEdit=structuredClone(sharedStores.meta.get('reconciliationBaseNote:'+E));
await new Promise(resolve=>setTimeout(resolve,2));
const noopIdentity=await identity([E,P]),noop=freeze({format:'study-director.reconciliation-base-update',version:2,full:false,baseCheckpointId:cp(2),...noopIdentity,personalFingerprint:null,sessionFingerprint:null,noteKeys:null,updates:freeze({}),deletes:freeze([]),days:freeze({})});
assert.equal(await store.write(cp(3),noop),true);assert.deepEqual(sharedStores.meta.get('reconciliationBaseNote:'+E),ethicsEnvelopeAfterEdit,'unchanged checkpoint must advance only the tiny header');assert.deepEqual(sharedStores.meta.get('reconciliationBaseNote:'+P),polityEnvelopeBefore);

const removeIdentity=await identity([E]),remove=freeze({format:'study-director.reconciliation-base-update',version:2,full:false,baseCheckpointId:cp(3),...removeIdentity,personalFingerprint:null,sessionFingerprint:null,noteKeys:null,updates:freeze({}),deletes:freeze([P]),days:freeze({})});
assert.equal(await store.write(cp(4),remove),true);assert.equal(sharedStores.meta.has('reconciliationBaseNote:'+P),false,'deleted note must remove only its reconciliation row');assert.equal((await store.readHeader()).noteCount,1);

const headerBeforeStale=await store.readHeader(),staleIdentity=await identity([E]),stale=freeze({format:'study-director.reconciliation-base-update',version:2,full:false,baseCheckpointId:cp(2),...staleIdentity,personalFingerprint:null,sessionFingerprint:null,noteKeys:null,updates:freeze({[E]:freeze({label:'Ethics',text:'must not commit'})}),deletes:freeze([]),days:freeze({})});
assert.equal(await store.write(cp(5),stale),false,'a stale checkpoint baseline must not overwrite newer reconciliation ancestry');assert.equal((await store.readHeader()).checkpointId,headerBeforeStale.checkpointId);assert.equal((await store.readNotes([E]))[E].text,'ethics v2');

const scansBefore=harness.idbReads.metaGetAll,selected=await store.readNotes([E,M]);
assert.deepEqual(Object.fromEntries(Object.entries(selected)),{[E]:{label:'Ethics',text:'ethics v2'}});assert.equal(harness.idbReads.metaGetAll,scansBefore,'lazy reconciliation reads must use keyed rows, not a full appMeta scan');

const full=freeze({format:'study-director.reconciliation-base-update',version:2,full:true,baseCheckpointId:'',noteCount:1,noteKeyFingerprint:'',personalFingerprint:'',sessionFingerprint:'',noteKeys:freeze([S]),updates:freeze({[S]:freeze({label:'Essay',text:'essay baseline'})}),deletes:freeze([]),days:freeze({})});
assert.equal(await store.write(cp(6),full),true);assert.deepEqual(Object.fromEntries(Object.entries(await store.readNotes([S,E]))),{[S]:{label:'Essay',text:'essay baseline'}},'rare exact/full baseline replacement must remove obsolete per-note rows atomically');

// Plans and settings are one fingerprint: an update that did not read them keeps the base's.
const sIdentity=await identity([S]),personalA='a'.repeat(64),personalB='b'.repeat(64);
assert.equal(await store.write(cp(7),freeze({...full,personalFingerprint:personalA})),true);assert.equal((await store.readHeader()).personalFingerprint,personalA);
assert.equal(await store.write(cp(8),freeze({format:'study-director.reconciliation-base-update',version:2,full:false,baseCheckpointId:cp(7),...sIdentity,personalFingerprint:null,sessionFingerprint:null,noteKeys:null,updates:freeze({}),deletes:freeze([]),days:freeze({})})),true);
assert.equal((await store.readHeader()).personalFingerprint,personalA,'an update that did not read plans and settings keeps their fingerprint');
assert.equal(await store.write(cp(9),freeze({format:'study-director.reconciliation-base-update',version:2,full:false,baseCheckpointId:cp(8),...sIdentity,personalFingerprint:personalB,sessionFingerprint:null,noteKeys:null,updates:freeze({}),deletes:freeze([]),days:freeze({})})),true);
assert.equal((await store.readHeader()).personalFingerprint,personalB);
assert.equal(await store.write(cp(10),freeze({...full,personalFingerprint:null})),false,'a full base always states its plans-and-settings fingerprint');

// Saved Days: one fingerprint per day, kept as one row per month.
const h=c=>c.repeat(64),sessionA=h('c'),sessionB=h('d');
assert.equal(await store.write(cp(10),freeze({...full,personalFingerprint:'',sessionFingerprint:null})),false,'a full base always states its session fingerprint');
assert.equal(await store.write(cp(11),freeze({...full,personalFingerprint:'',sessionFingerprint:sessionA,days:freeze({'2026-09':freeze({'2026-09-30':h('1')}),'2026-10':freeze({'2026-10-01':h('2'),'2026-10-02':h('3')})})})),true);
assert.deepEqual({...await store.readDays(['2026-09-30','2026-10-01','2026-10-02','2026-10-03'])},{'2026-09-30':h('1'),'2026-10-01':h('2'),'2026-10-02':h('3')},'a day missing from the base reads as absent');
assert.equal((await store.readHeader()).sessionFingerprint,sessionA);
const septemberBefore=structuredClone(sharedStores.meta.get('reconciliationBaseDays:2026-09'));
await new Promise(resolve=>setTimeout(resolve,2));
assert.equal(await store.write(cp(12),freeze({format:'study-director.reconciliation-base-update',version:2,full:false,baseCheckpointId:cp(11),...sIdentity,personalFingerprint:null,sessionFingerprint:null,noteKeys:null,updates:freeze({}),deletes:freeze([]),days:freeze({'2026-10':freeze({'2026-10-01':h('4')})})})),true);
assert.deepEqual({...await store.readDays(['2026-10-01','2026-10-02'])},{'2026-10-01':h('4')},'an update replaces the whole month it names');
assert.deepEqual(sharedStores.meta.get('reconciliationBaseDays:2026-09'),septemberBefore,'a month the update does not name is not rewritten');
assert.equal((await store.readHeader()).sessionFingerprint,sessionA,'an update that did not read the session keeps its fingerprint');
assert.equal(await store.write(cp(13),freeze({format:'study-director.reconciliation-base-update',version:2,full:false,baseCheckpointId:cp(12),...sIdentity,personalFingerprint:null,sessionFingerprint:'',noteKeys:null,updates:freeze({}),deletes:freeze([]),days:freeze({'2026-09':null})})),true);
assert.equal(sharedStores.meta.has('reconciliationBaseDays:2026-09'),false,'a month with no Saved Days left is removed');assert.equal((await store.readHeader()).sessionFingerprint,'','no session is a fingerprint too');
assert.equal(await store.write(cp(14),freeze({...full,personalFingerprint:'',sessionFingerprint:sessionB,days:freeze({'2026-11':freeze({'2026-11-01':h('5')})})})),true);
assert.equal(sharedStores.meta.has('reconciliationBaseDays:2026-10'),false,'a full base removes months it does not hold');assert.deepEqual({...await store.readDays(['2026-11-01'])},{'2026-11-01':h('5')});
assert.equal(await store.write(cp(15),freeze({...full,personalFingerprint:'',sessionFingerprint:'',days:freeze({'2026-11':freeze({'2026-12-01':h('6')})})})),false,'a day filed under another month is refused');
assert.equal(await store.write(cp(15),freeze({...full,version:1,personalFingerprint:'',sessionFingerprint:''})),false,'only the current update format is written');
assert.equal(codec.normalizeHeader({...await store.readHeader(),version:2}),null,'an older base header is not read');

console.log(JSON.stringify({status:'PASS',suite:'reconciliation-baseline-v2',unchangedCheckpoint:'header-only',editedNote:'one-row',deletedNote:'one-row-delete',lazyReads:'keyed-only',staleBase:'fail-closed',days:'month-rows',session:'fingerprint'},null,2));
