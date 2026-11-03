import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const app=read('source/app.html'),repository=read('source/core/managed-repository.js'),provider=read('source/core/backup-provider.js'),device=read('source/core/device-backup.js'),host=read('source/core/backup-recovery-host.js'),drive=read('source/external/drive.js');

const identityBody=repository.slice(repository.indexOf('function repositoryLogicalIdentityPayload'),repository.indexOf('async function repositoryLogicalFingerprint'));
for(const excluded of ['checkpointId','installationId','sourceRevision','reconciliationBaseId','objectId','protectionId'])assert.equal(identityBody.includes(excluded),false,`provider/capture artifact must not enter logical-state identity: ${excluded}`);

assert.match(app,/id="managed-version-history"[\s\S]*id="managed-version-history-title">Version History/u,'one Version History dialog for every location');
assert.doesNotMatch(host,/input\.device\b/u,'the recovery host has no Device-only path');
// One list: each connected location's own history is read, then each
// version shows once, read from the Device Folder when it holds it.
assert.match(provider,/async function removeRepositoryProviderVersion/u);
for(const forbidden of ['import-file','importLocal','.sdbackup','import-archive'])assert.equal(host.includes(forbidden),false,`standalone file backup/import must stay outside managed provider history: ${forbidden}`);
assert.doesNotMatch(drive,/DeviceBackup|device-backup|projectManagedRepositoryHistory|mergeManagedRepositoryHistory/u,'Google Drive transport must not know about Device Folder');
assert.doesNotMatch(device,/google-drive|Google Drive|BackupProviderRuntime/u,'the Device Folder controller must not know about Drive; it reaches the engine only through its injected port');

console.log(JSON.stringify({status:'PASS',suite:'managed-version-history-contract',oneVersionHistory:true,independentHistories:true,noCrossProviderDiscovery:true,manualFileExcluded:true,explicitSafetyRemoval:true},null,2));
