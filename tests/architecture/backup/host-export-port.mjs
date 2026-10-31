import {readHostHtml} from '../../../build/host-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const backup=fs.readFileSync(path.join(root,'source/core/backup.ts'),'utf8');
const host=readHostHtml(path.join(root,'source'));
const contract=backup.match(/exports:freeze\((\[[^\]]+\])\)/u);
const wired=host.match(/^\s*exports:(Object\.freeze\(\{[^\n]+\}\)),?$/mu);
assert.ok(contract&&wired,'Backup exports contract and production host wiring must be present.');
const expected=vm.runInNewContext(contract[1]);
const stub=Object.freeze(Object.fromEntries(expected.map(key=>[key,()=>{}])));
const actual=vm.runInNewContext(wired[1],{
  Object,backupBackgroundAvailability:()=>true,BackupProtection:Object.freeze({...stub,follow:()=>{}}),Exports:stub,AttachmentStorage:{during:operation=>operation()}
});
assert.ok(Object.isFrozen(actual),'Production exports port must be immutable.');
assert.deepEqual(Object.keys(actual).sort(),[...expected].sort(),'Production exports port must exactly match the backup runtime contract.');
assert.ok(expected.every(key=>typeof actual[key]==='function'),'Production exports port must supply callable functions.');
console.log(JSON.stringify({status:'PASS',suite:'backup-host-exports-port',fields:expected.length}));
