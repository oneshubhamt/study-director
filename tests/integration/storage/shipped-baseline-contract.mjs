import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SHIPPED_BASELINE_PERSISTENCE_CONTRACT as BASELINE} from '../../fixtures/shipped-baseline-persistence-contract.mjs';
import {INDEXED_DB,OBSOLETE_INDEXED_DB} from '../../../contracts/canonical-identities.mjs';
import {LOCAL_STORAGE_KEYS,OBSOLETE_LOCAL_STORAGE_KEYS,APP_META_KEYS,OBSOLETE_APP_META_KEYS,RENAMED_APP_META_KEYS} from '../../../contracts/data-architecture.mjs';
import {allCompatibilityEntries} from '../../../contracts/compatibility.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
const compatibilityHost=source('source/core/compatibility-host.js');
const backupCodec=source('source/core/backup-codec.js');
const exportsSource=source('source/core/exports.js');

assert.equal(BASELINE.indexedDb.name,INDEXED_DB.name);
assert.equal(BASELINE.indexedDb.version,OBSOLETE_INDEXED_DB.baselineVersion);
assert.ok(INDEXED_DB.version>BASELINE.indexedDb.version);
for(const [id,old] of Object.entries(BASELINE.indexedDb.stores)){
  if(Object.prototype.hasOwnProperty.call(OBSOLETE_INDEXED_DB.stores,id)){
    assert.equal(OBSOLETE_INDEXED_DB.stores[id],old.name,`${id} must be explicitly retired`);
    continue;
  }
  const current=INDEXED_DB.stores[id];
  assert.ok(current,`Shipped baseline store ${id} has no current home`);
  assert.equal(current.name,old.name,`Shipped baseline store ${id} identity drifted`);
  assert.ok(current.schemaVersion>=old.schemaVersion,`Shipped baseline store ${id} schema regressed`);
}

const durableKeys=new Set([...Object.values(LOCAL_STORAGE_KEYS),...Object.values(OBSOLETE_LOCAL_STORAGE_KEYS)]);
assert.equal(BASELINE.localStorage.length,26,'Fixture must retain every shipped-baseline LocalStorage identity.');
for(const key of BASELINE.localStorage)assert.ok(durableKeys.has(key),`Shipped-baseline LocalStorage identity is unaccounted for: ${key}`);

const currentMeta=new Set(Object.values(APP_META_KEYS));
const obsoleteMeta=new Set([...Object.values(OBSOLETE_APP_META_KEYS),...Object.values(RENAMED_APP_META_KEYS)]);
for(const key of BASELINE.appMeta){
  if(key==='backupProviderOperation:'){
    assert.match(compatibilityHost,/LEGACY_BACKUP_PROVIDER_OPERATION_PREFIX='backupProviderOperation:'/u);
    continue;
  }
  assert.ok(currentMeta.has(key)||obsoleteMeta.has(key),`Shipped-baseline appMeta identity is unaccounted for: ${key}`);
}

const compatibilityIds=new Set(allCompatibilityEntries().map(entry=>entry.id));
for(const id of ['daily-record-historical-shapes','active-session-v7-domain-separation','area-note-historical-rows','r10-indexeddb-topology-retirement','l7-host-metadata-normalization','complete-backup-v7-v19']){
  assert.ok(compatibilityIds.has(id),`Shipped-baseline compatibility path is not inventoried: ${id}`);
}
assert.ok(BASELINE.external.backupMetadataVersion>=7&&BASELINE.external.backupMetadataVersion<=16);
assert.match(backupCodec,/!\[7,8,9,10,11,12,13,14,15,16,17,18,19,20,21\]\.includes\(version\)/u,'The shipped backup version must remain inside the isolated complete-backup compatibility range.');
assert.doesNotMatch(exportsSource,/SDENC01|legacyDecryptBackup/u,'No encrypted backups exist in the retired SDENC01 format, so the app has no reader for it.');

console.log(JSON.stringify({
  status:'PASS',suite:'shipped-baseline-contract',release:BASELINE.release,
  sourceZipSha256:BASELINE.provenance.sourceZipSha256,
  indexedDbVersion:BASELINE.indexedDb.version,localStorageIdentities:BASELINE.localStorage.length,
  appMetaIdentities:BASELINE.appMeta.length,backupMetadataVersion:BASELINE.external.backupMetadataVersion
},null,2));
