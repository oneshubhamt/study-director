import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {artifactInventory,createReceipt,validateReceipt,writeReceipt} from '../../helpers/coverage-provenance.mts';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'coverage-provenance-'));
const identity={sha:'fixture',fingerprint:'fixture-source',root:'/fixture',node:process.versions.node};
const tests=['tests/integration/example.mjs','tests/unit/example.mts'];
const raw=(test:string,runId='run-1',count=1)=>JSON.stringify({runId,test,result:[{url:'source/core/example.ts',functions:[{functionName:'f',isBlockCoverage:true,ranges:[{startOffset:0,endOffset:1,count}]}]}]});
const file=(index:number)=>path.join(directory,`coverage-${index}-1.json`);
const receiptFile=path.join(directory,'receipt.json');
try{
  assert.throws(()=>validateReceipt(directory,identity,tests),/provenance missing/);
  fs.writeFileSync(file(1),raw(tests[0]!));
  assert.throws(()=>artifactInventory(directory,'run-1',tests),/Incomplete coverage/);
  fs.writeFileSync(file(2),raw(tests[1]!,'old-run'));
  assert.throws(()=>artifactInventory(directory,'run-1',tests),/Mixed producer run/);
  fs.writeFileSync(file(2),raw(tests[1]!,'run-1',0));
  assert.throws(()=>artifactInventory(directory,'run-1',tests),/no executed code/);
  fs.writeFileSync(file(2),raw(tests[1]!));
  const base={runId:'run-1',identity,tests,scope:'full' as const};
  const full=createReceipt({...base,status:'PASS'},directory);
  for(const [receipt,reason] of [[{...full,status:'FAIL' as const},/did not pass/],[{...full,scope:'targeted' as const},/Partial coverage/]] as const){
    writeReceipt(directory,receipt);assert.throws(()=>validateReceipt(directory,identity,tests),reason);fs.unlinkSync(receiptFile);
  }
  writeReceipt(directory,full);
  assert.deepEqual(validateReceipt(directory,identity,tests),full);
  assert.throws(()=>validateReceipt(directory,{...identity,fingerprint:'changed'},tests),/Stale/);
  assert.throws(()=>validateReceipt(directory,identity,[tests[0]!]),/full test selection/);
  fs.writeFileSync(file(2),raw(tests[1]!,'run-1',2));
  assert.throws(()=>validateReceipt(directory,identity,tests),/hash mismatch/);
  fs.unlinkSync(file(2));assert.throws(()=>validateReceipt(directory,identity,tests),/Incomplete coverage/);
}finally{fs.rmSync(directory,{recursive:true,force:true});}
console.log(JSON.stringify({status:'PASS',suite:'coverage-provenance'}));
