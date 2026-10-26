import {PRODUCTION_LIMITS} from '../../../contracts/production-limits.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {compileScript,readScript} from '../../../build/source-script.mts';
import {renderBuild,validateBuild} from '../../../build/build.mjs';

// The exact erased program is consumed by both the build and VM harnesses.
const build=renderBuild();
assert.equal(validateBuild(build),true);
for(const id of ['canonical','save-lane']){
  const file=`source/core/${id}.ts`,source=fs.readFileSync(file,'utf8'),output=readScript(file);
  assert.equal(output.length,source.length);
  assert.equal(output.split('\n').length,source.split('\n').length);
  assert.equal(build.privateSources.get(id),output);
  assert.ok(build.deployment.has(build.privateNames.get(id)));
}
const source="import type {NeverExecuted} from './no-runtime-file.ts';\nconst message: string='😀';\nthrow new Error(message);";
const output=compileScript(source,'offset-probe.ts');
assert.equal(output.indexOf('throw new Error'),source.indexOf('throw new Error'),'V8 offsets must refer directly to authored source');
assert.throws(()=>vm.runInNewContext(output,{}, {filename:'offset-probe.ts'}),error=>error.message==='😀'&&error.stack.includes('offset-probe.ts:3'));
assert.throws(()=>compileScript('enum State { Ready }','enum.ts'),/not supported/);
assert.throws(()=>compileScript("import './runtime.js';",'import.ts'),/import statement/);
assert.throws(()=>compileScript('export const value: number=1;','export.ts'),/export/);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sd-erasure-'));
try{
  const file=path.join(temp,'fresh.ts');
  fs.writeFileSync(file,'const value: number=1;');const first=readScript(file);
  fs.writeFileSync(file,'const value: number=2;');assert.notEqual(readScript(file),first,'mutated authored sources must never use a stale compile cache');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log(JSON.stringify({status:'PASS',suite:'typescript-pipeline',identicalBuildAndTestProgram:true,offsetPreservation:true,classicScriptBoundary:true,freshMutationInput:true}));

// The transitional declaration cannot silently invent a limit or misstate its primitive type.
const limitTypes=Object.fromEntries([...fs.readFileSync('contracts/production-limits.d.mts','utf8').matchAll(/^  (\w+): (string|number);$/gmu)].map(match=>[match[1],match[2]]));
assert.deepEqual(limitTypes,Object.fromEntries(Object.entries(PRODUCTION_LIMITS).map(([key,value])=>[key,typeof value])));
