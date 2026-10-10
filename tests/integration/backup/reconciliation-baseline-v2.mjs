import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {APP_META_VALIDATION_OWNERS} from '../../../contracts/data-architecture.mjs';
import {createHarness} from '../../helpers/repository-harness.mjs';

for(const file of ['source/core/internal.js','source/core/reconciliation-baseline.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')],BaselineModule=registry.require('reconciliation-baseline',1),freeze=Object.freeze;
const sharedStores={area:new Map(),sync:new Map(),tombstones:new Map(),reflection:new Map(),daily:new Map(),summary:new Map(),session:new Map(),meta:new Map()};
const harness=createHarness(new Map(),sharedStores),gateway=harness.appMetaGateway;
const limits=freeze({maxAreaNameChars:160,maxRichTextBytes:2*1024*1024,maxOngoingNotes:1000}),normalizeAreaName=value=>String(value??'').trim();
const codec=BaselineModule.createCodec(freeze({limits,normalizeAreaName}));
const validators={};for(const name of APP_META_VALIDATION_OWNERS.host)validators[name]=()=>true;
validators.reconciliationBase=value=>codec.normalizeHeader(value)!==null;
validators.reconciliationBaseNotePrefix=(value,context)=>codec.normalizeNote(value,context)!==null;
gateway.registerValidators('host',freeze(validators));
const host=gateway.bind('host'),store=BaselineModule.createStore(freeze({codec,meta:host,families:freeze({header:'reconciliationBase',notes:'reconciliationBaseNotePrefix'})}));
const cp=n=>'cp_'+String(n).padStart(32,'0');
const identity=async keys=>({noteCount:keys.length,noteKeyFingerprint:await codec.keyFingerprint(keys)});
// The first baseline is a full write; older single-row baselines are converted
// once by the compatibility host (tests/integration/storage/compatibility-host.mjs).
const seed=freeze({format:'study-director.reconciliation-base-update',version:1,full:true,baseCheckpointId:'',noteCount:2,noteKeyFingerprint:'',noteKeys:freeze(['Ethics','Polity']),updates:freeze({Ethics:'ethics v1',Polity:'polity v1'}),deletes:freeze([])});
assert.equal(await store.write(cp(1),seed),true);
const first=await store.readHeader();
assert.equal(first.version,2);assert.equal(first.checkpointId,cp(1));assert.equal(first.noteCount,2);assert.match(first.noteKeyFingerprint,/^[a-f0-9]{64}$/u);
assert.equal(sharedStores.meta.get('reconciliationBaseNote:Ethics').value.text,'ethics v1');
assert.equal(sharedStores.meta.get('reconciliationBaseNote:Polity').value.text,'polity v1');

const polityEnvelopeBefore=structuredClone(sharedStores.meta.get('reconciliationBaseNote:Polity')),ethicsEnvelopeBefore=structuredClone(sharedStores.meta.get('reconciliationBaseNote:Ethics'));
await new Promise(resolve=>setTimeout(resolve,2));
const editIdentity=await identity(['Ethics','Polity']),edit=freeze({format:'study-director.reconciliation-base-update',version:1,full:false,baseCheckpointId:cp(1),...editIdentity,noteKeys:null,updates:freeze({Ethics:'ethics v2'}),deletes:freeze([])});
assert.equal(await store.write(cp(2),edit),true);
assert.equal((await store.readHeader()).checkpointId,cp(2));
assert.equal(sharedStores.meta.get('reconciliationBaseNote:Ethics').value.text,'ethics v2');
assert.notEqual(sharedStores.meta.get('reconciliationBaseNote:Ethics').updatedAt,ethicsEnvelopeBefore.updatedAt,'edited note baseline must receive a new envelope');
assert.deepEqual(sharedStores.meta.get('reconciliationBaseNote:Polity'),polityEnvelopeBefore,'unchanged note baseline must not be rewritten');

const ethicsEnvelopeAfterEdit=structuredClone(sharedStores.meta.get('reconciliationBaseNote:Ethics'));
await new Promise(resolve=>setTimeout(resolve,2));
const noopIdentity=await identity(['Ethics','Polity']),noop=freeze({format:'study-director.reconciliation-base-update',version:1,full:false,baseCheckpointId:cp(2),...noopIdentity,noteKeys:null,updates:freeze({}),deletes:freeze([])});
assert.equal(await store.write(cp(3),noop),true);assert.deepEqual(sharedStores.meta.get('reconciliationBaseNote:Ethics'),ethicsEnvelopeAfterEdit,'unchanged checkpoint must advance only the tiny header');assert.deepEqual(sharedStores.meta.get('reconciliationBaseNote:Polity'),polityEnvelopeBefore);

const removeIdentity=await identity(['Ethics']),remove=freeze({format:'study-director.reconciliation-base-update',version:1,full:false,baseCheckpointId:cp(3),...removeIdentity,noteKeys:null,updates:freeze({}),deletes:freeze(['Polity'])});
assert.equal(await store.write(cp(4),remove),true);assert.equal(sharedStores.meta.has('reconciliationBaseNote:Polity'),false,'deleted note must remove only its reconciliation row');assert.equal((await store.readHeader()).noteCount,1);

const headerBeforeStale=await store.readHeader(),staleIdentity=await identity(['Ethics']),stale=freeze({format:'study-director.reconciliation-base-update',version:1,full:false,baseCheckpointId:cp(2),...staleIdentity,noteKeys:null,updates:freeze({Ethics:'must not commit'}),deletes:freeze([])});
assert.equal(await store.write(cp(5),stale),false,'a stale checkpoint baseline must not overwrite newer reconciliation ancestry');assert.equal((await store.readHeader()).checkpointId,headerBeforeStale.checkpointId);assert.equal((await store.readNotes(['Ethics'])).Ethics,'ethics v2');

const scansBefore=harness.idbReads.metaGetAll,selected=await store.readNotes(['Ethics','Missing']);
assert.deepEqual(Object.fromEntries(Object.entries(selected)),{Ethics:'ethics v2'});assert.equal(harness.idbReads.metaGetAll,scansBefore,'lazy reconciliation reads must use keyed rows, not a full appMeta scan');

const full=freeze({format:'study-director.reconciliation-base-update',version:1,full:true,baseCheckpointId:'',noteCount:1,noteKeyFingerprint:'',noteKeys:freeze(['Essay']),updates:freeze({Essay:'essay baseline'}),deletes:freeze([])});
assert.equal(await store.write(cp(6),full),true);assert.deepEqual(Object.fromEntries(Object.entries(await store.readNotes(['Essay','Ethics']))),{Essay:'essay baseline'},'rare exact/full baseline replacement must remove obsolete per-note rows atomically');

console.log(JSON.stringify({status:'PASS',suite:'reconciliation-baseline-v2',unchangedCheckpoint:'header-only',editedNote:'one-row',deletedNote:'one-row-delete',lazyReads:'keyed-only',staleBase:'fail-closed'},null,2));
