import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CURRENT_SCHEMA_VERSIONS} from '../../../contracts/canonical-identities.mjs';
import {SYNCED_RECORDS,LOCAL_RECORDS,SYNCED_FORMAT_LEDGER,CURRENT_SYNCED_FORMATS} from '../../../contracts/format-ledger.mjs';

// Any change to a form that travels between devices raises the versions an
// older build checks first, so that build keeps the new data, uploads
// nothing over it and asks for an update, instead of misreading it.
const HOW='Raise the backup and repository-manifest versions (and the claim version for the claim), read the older form through the compatibility layer, and add a row to contracts/format-ledger.mjs (docs/areas/data-and-storage.md#changing-a-synced-form).';
const read=file=>fs.readFileSync(file,'utf8');
const number=(source,pattern,label)=>{const match=pattern.exec(source);assert.ok(match,`${label} not found`);return Number(match[1]);};
const manifest=number(read('source/core/managed-repository.js'),/REPOSITORY_MANIFEST_VERSION=(\d+)/u,'Repository manifest version');
const claim=number(read('source/core/backup-provider.js'),/SESSION_CLAIM_VERSION=(\d+)/u,'Session claim version');
const personalData=number(read('source/core/record-codecs.js'),/raw\.version!==(\d+)\)throw new Error\('Unsupported current personal-data version\.'\)/u,'Personal-data version');

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

// Between rows: containers never go back, and any change to a form raises
// both containers (the claim is its own container).
for(let index=1;index<SYNCED_FORMAT_LEDGER.length;index++){
  const before=SYNCED_FORMAT_LEDGER[index-1],after=SYNCED_FORMAT_LEDGER[index];
  for(const key of ['backup','manifest','claim'])assert.ok(after[key]>=before[key],`${after.release}: ${key} went back`);
  const changed=Object.keys(after.records).some(name=>after.records[name]!==before.records[name])||after.personalData!==before.personalData;
  if(changed)assert.ok(after.backup>before.backup&&after.manifest>before.manifest,`${after.release}: a synced form changed without raising the containers. ${HOW}`);
  assert.ok(changed||after.claim!==before.claim||after.backup!==before.backup||after.manifest!==before.manifest,`${after.release}: a row must record a change`);
}
console.log(JSON.stringify({status:'PASS',suite:'format-ledger',rows:SYNCED_FORMAT_LEDGER.length,backup:current.backup,manifest,claim}));
