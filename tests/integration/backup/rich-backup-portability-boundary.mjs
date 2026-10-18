import {RUNTIME_DATA_CONTRACT} from '../../../contracts/canonical-identities.mjs';
import {createProcessingEngine} from '../../../portable/processing.js';
const testProcessing=Object.freeze({...createProcessingEngine(),scope:operation=>operation()});
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PRODUCTION_LIMITS as limits} from '../../../contracts/production-limits.mjs';
import {testPendingReviewCodec} from '../../helpers/pending-review-codec.mjs';

const read=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url),'utf8');
for(const file of ['source/core/internal.js','source/core/persistence.js','source/core/record-codecs.js','source/core/backup-codec.js'])vm.runInThisContext(read(file),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const RecordCodecs=registry.require('record-codecs',1);
const BackupCodecs=registry.require('backup-codec',1);
const Persistence=registry.require('persistence',1),freeze=Object.freeze,MiB=1024*1024;

const richSandbox={console,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,queueMicrotask};
vm.createContext(richSandbox);vm.runInContext(read('source/external/rich-text.js'),richSandbox,{filename:'rich-text.js'});
const rich=vm.runInContext('globalThis.StudyDirectorRichText',richSandbox);
assert.equal(limits.backupMaxEntryBytes,5*MiB);
assert.equal(limits.backupMaxLineBytes,16*MiB);
assert.equal(limits.backupMaxUncompressedBytes,512*MiB);
assert.equal(limits.maxRichTextBytes,2*MiB);
assert.equal(limits.maxRichTextWords,20000);
const dataContract=RUNTIME_DATA_CONTRACT;
const defs=freeze({
  dailyRecord:freeze({idField:'date',backupLimit:limits.maxImportRecords}),note:freeze({idField:'key',backupLimit:limits.maxNotes}),
  activeSession:freeze({idField:'id',backupLimit:1})
});
const entityDefinition=type=>defs[type]||null,entityIdentity=(type,item)=>String(item?.[defs[type]?.idField]||'');
const boundedInt=(value,{min=0,max=Number.MAX_SAFE_INTEGER,fallback=0}={})=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;};
const jsonByteLength=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).byteLength;
const personalDataCodec=RecordCodecs.createPersonalDataCodec(limits);
const pendingReviewCodec=testPendingReviewCodec(RecordCodecs,{personalDataCodec});
const codec=BackupCodecs.createBackupCodec(freeze({personalDataCodec,pendingReviewCodec,processing:testProcessing,
  appConfig:freeze({appName:'Study Director',attribution:'Study Director'}),limits,dataContract,legacy:freeze({schemaVersion:3,tombstoneLimit:limits.maxLegacyImportTombstones}),
  entityTypes:freeze(Object.keys(defs)),keyedRecord:freeze({create:()=>Object.create(null)}),entities:freeze({entityDefinition,entityIdentity}),
  helpers:freeze({boundedInt,jsonByteLength}),
  richText:freeze({assetIds:value=>rich.assetIds(value),assetIdValid:value=>rich.isAssetId(value),imageMimeTypeValid:value=>rich.isSupportedImageType(value)}),
  dailyRecordCodec:freeze({sanitizeHistoricalDailyRecord:value=>value,canonicalizeHistoricalDailyRecord:value=>value,sanitizeCurrentDailyRecord:value=>value,sanitizeImportedNote:value=>value,sanitizeCurrentNote:value=>value,isSupportedSavedDate:()=>true}),
  activeSessionCodec:freeze({sanitizeCurrent:value=>value}),
  compatibilityCodec:freeze({format:'study-director.compatibility-codecs',contractVersion:1,dailyRecord:value=>value,note:value=>value,activeSession:value=>value,reflectionDraft:value=>value})
}));

const paragraph=param=>({type:'Paragraph',content:[{type:'Text',param}]});
const content=Array.from({length:limits.maxRichTextWords},(_,i)=>paragraph(`w${i}`));
const encode=()=>`WG1:${JSON.stringify({version:1,doc:{type:'Doc',content}})}`;
// Quote characters appended to the first word place the canonical Wordgard state just below the
// byte ceiling. Each is stored as \" and escaped again inside a backup entry, the worst case for
// how much a rich value grows there.
const targetBytes=limits.maxRichTextBytes-256;
content[0].content[0].param+='"'.repeat(Math.max(0,Math.floor((targetBytes-jsonByteLength(encode()))/2)));
const heavyState=encode();
const {words,bytes:canonicalBytes}=rich.measure(heavyState);
assert.equal(rich.isRichTextValue(heavyState),true,'Boundary state must remain valid Wordgard data.');
assert.equal(words,limits.maxRichTextWords,'Adversarial state must exercise the full rich-word allowance.');
assert.ok(canonicalBytes<=limits.maxRichTextBytes&&canonicalBytes>limits.maxRichTextBytes-1024,'Fixture must sit immediately below the canonical rich-state ceiling.');

const updatedAt='2026-09-01T00:00:00.000Z';
const ongoing=freeze({key:'Portability boundary',text:heavyState,updatedAt});
const activeSession=freeze({version:9,id:'current',date:'2026-09-01',revision:1,updatedAt,snapshot:freeze({review:freeze({reflection:heavyState,studyQuality:5})})});
const oldEntryLimit=2*MiB;
const outcomes=[];
for(const [entityType,item] of [['note',ongoing],['activeSession',activeSession]]){
  const entryBytes=jsonByteLength(item);
  assert.ok(entryBytes>oldEntryLimit,`${entityType} fixture must exceed the previous 2 MiB entry limit.`);
  assert.ok(entryBytes<=limits.backupMaxEntryBytes,`${entityType} must fit the production 5 MiB entry boundary.`);
  const groups=codec.splitItems([item]);
  assert.equal(groups.length,1);assert.equal(groups[0].length,1);assert.equal(groups[0][0],item);
  const chunk=await codec.encodeChunk(0,entityType,groups[0],codec.checksumAlgorithm());
  const lineBytes=new TextEncoder().encode(chunk.line).byteLength;
  assert.ok(lineBytes<=limits.backupMaxLineBytes,`${entityType} chunk must fit the production 16 MiB line boundary.`);
  outcomes.push({entityType,canonicalBytes,entryBytes,lineBytes});
}

console.log(JSON.stringify({status:'PASS',suite:'rich-backup-portability-boundary',engine:'wordgard',oldEntryLimitMiB:2,entryLimitMiB:limits.backupMaxEntryBytes/MiB,lineLimitMiB:limits.backupMaxLineBytes/MiB,totalUncompressedLimitMiB:limits.backupMaxUncompressedBytes/MiB,outcomes},null,2));
