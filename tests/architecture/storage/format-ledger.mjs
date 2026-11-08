import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CURRENT_SCHEMA_VERSIONS} from '../../../contracts/canonical-identities.mjs';
import {SYNCED_RECORDS,LOCAL_RECORDS,SYNCED_FORMAT_LEDGER,CURRENT_SYNCED_FORMATS} from '../../../contracts/format-ledger.mjs';

// Any change to a form that travels between devices raises the versions an
// older build checks first, so that build keeps the new data, uploads
// nothing over it and asks for an update, instead of misreading it.
const HOW='Update the current canonical contract, writer, strict readers and rejection tests together. Historical upgrades are not supported on this branch.';
const read=file=>readRuntimeSource(file);
const number=(source,pattern,label)=>{const match=pattern.exec(source);assert.ok(match,`${label} not found`);return Number(match[1]);};
const manifest=number(read('source/core/managed-repository.ts'),/REPOSITORY_MANIFEST_VERSION=(\d+)/u,'Repository manifest version');
const claim=number(read('source/core/backup-provider.ts'),/SESSION_CLAIM_VERSION=(\d+)/u,'Session claim version');
const personalData=number(read('source/core/record-codecs.ts'),/raw\.version!==(\d+)\)throw new Error\('Unsupported current personal-data version\.'\)/u,'Personal-data version');

// Every stored form is either synced or local-only, so a new one is classed.
assert.deepEqual([...SYNCED_RECORDS,...LOCAL_RECORDS].sort(),Object.keys(CURRENT_SCHEMA_VERSIONS).sort(),'Class each schema in contracts/format-ledger.mjs as synced or local-only.');

// The last row is what the code writes now.
const current=SYNCED_FORMAT_LEDGER.at(-1);
assert.equal(current.release,'current');
assert.deepEqual({...current.records},{...CURRENT_SYNCED_FORMATS.records},`A synced form's version changed. ${HOW}`);
assert.equal(current.personalData,personalData,`The personal-data version changed. ${HOW}`);
assert.equal(current.backup,CURRENT_SYNCED_FORMATS.backup,`The backup version and the ledger disagree. ${HOW}`);
assert.equal(current.manifest,manifest,`The repository manifest version and the ledger disagree. ${HOW}`);
assert.equal(current.claim,claim,`The session claim version and the ledger disagree. ${HOW}`);

assert.equal(SYNCED_FORMAT_LEDGER.length,1,'Only the current canonical format set is supported');
console.log(JSON.stringify({status:'PASS',suite:'format-ledger',rows:SYNCED_FORMAT_LEDGER.length,backup:current.backup,manifest,claim}));
