import {jsonArray,jsonString,jsonObject} from './read-verification.mts';
import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const backup=fs.readFileSync(path.join(root,'source/core/backup.ts'),'utf8');
const host=readScript(path.join(root,'source/core/backup-recovery-host.ts'));
const contract=backup.match(/exports:freeze\((\[[^\]]+\])\)/u);
const wired=host.match(/const exportsPort=freeze\((\{[\s\S]*?\})\s*\);/u);
assert.ok(contract?.[1]&&wired?.[1],'Backup exports contract and production host wiring must be present.');
const expected=jsonArray(vm.runInNewContext(contract[1]) as unknown).map(jsonString);
const stub=Object.freeze(Object.fromEntries(expected.map(key=>[key,()=>{}])));
const actual:unknown=vm.runInNewContext('Object.freeze('+wired[1]+')',{
  Object,input:{backgroundAvailable:()=>true,processing:stub,protection:{...stub,follow:()=>{}},assets:{during:(operation:()=>unknown)=>operation()}}
});
assert.match(host,/exports:exportsPort,session:input\.session/u,'the live runtime must receive the tested port');
assert.ok(Object.isFrozen(actual),'Production exports port must be immutable.');
const actualPort=jsonObject(actual);
assert.deepEqual(Object.keys(actualPort).sort(),[...expected].sort(),'Production exports port must exactly match the backup runtime contract.');
assert.ok(expected.every(key=>typeof actualPort[key]==='function'),'Production exports port must supply callable functions.');
console.log(JSON.stringify({status:'PASS',suite:'backup-host-exports-port',fields:expected.length}));
