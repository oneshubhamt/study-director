import assert from 'node:assert/strict';
import {checkCases} from '../../helpers/generated-cases.mts';
const originalSeed=process.env['SD_CASE_SEED'],originalFamily=process.env['SD_CASE_FAMILY'];
try{
  delete process.env['SD_CASE_SEED'];delete process.env['SD_CASE_FAMILY'];
  const inputs: string[]=[];
  const collect=(target:string[])=>({random,int,weighted}: Parameters<Parameters<typeof checkCases>[2]>[0],index:number)=>{target.push(JSON.stringify({index,draw:random(),id:int(1,10000),op:weighted({edit:2,keep:1})}));};
  await checkCases('family A',{seed:20261102,count:3},collect(inputs));
  process.env['SD_CASE_SEED']='20261103';process.env['SD_CASE_FAMILY']='family A';
  const replay:string[]=[];
  assert.equal(await checkCases('family A',{seed:20261102,count:3},collect(replay)),1);
  assert.deepEqual(replay,[inputs[1]],'non-first seed reproduces all inputs and index');
  assert.equal(await checkCases('family B',{seed:20261103,count:3},collect(replay)),0,'overlapping families are distinct');
  process.env['SD_CASE_SEED']='20261120';
  await assert.rejects(checkCases('family A',{seed:20261102,count:3},collect(replay)),/outside family A/);
}finally{
  if(originalSeed===undefined)delete process.env['SD_CASE_SEED'];else process.env['SD_CASE_SEED']=originalSeed;
  if(originalFamily===undefined)delete process.env['SD_CASE_FAMILY'];else process.env['SD_CASE_FAMILY']=originalFamily;
}
console.log(JSON.stringify({status:'PASS',suite:'generated-case-replay'}));
