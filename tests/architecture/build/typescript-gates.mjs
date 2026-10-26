import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const root=process.cwd();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sd-type-gates-'));
try{
 fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir');
 const file=path.join(temp,'probe.ts'),config=path.join(temp,'tsconfig.json');
 fs.writeFileSync(config,JSON.stringify({extends:path.join(root,'tsconfig.base.json'),compilerOptions:{lib:['ES2022'],types:[]},files:['probe.ts']}));
 for(const [name,source,gate,pass] of [
 ['valid',"const value:string='ok';void value;",'tsc',true],
 ['wrong type','const value:string=42;void value;','tsc',false],
 ['indexing','const values:number[]=[];const value:number=values[0];void value;','tsc',false],
 ['optional','const value:{strict?:boolean}={strict:undefined};void value;','tsc',false],
 ['valid lint',"const value:string='ok';void value;",'oxlint',true],
 ['explicit any','const value:any=1;void value;','oxlint',false],
 ['floating promise','Promise.resolve(42).then(value=>value);','oxlint',false],
 ['unsafe call',"const value=JSON.parse('{}');value.call();",'oxlint',false],
 ['misused promise','const callback:()=>void=async()=>{};void callback;','oxlint',false],
 ['nonexhaustive',"function f(v:'a'|'b'){switch(v){case 'a':return 1;}}void f;",'oxlint',false]
 ]){
  fs.writeFileSync(file,source);
  const args=gate==='tsc'?['--project',config]:['--type-aware','--tsconfig',config,'--config',path.join(root,'.oxlintrc.json'),file];
  const result=spawnSync(path.join(root,'node_modules/.bin',gate),args,{cwd:temp,encoding:'utf8'});
  assert.equal(result.signal,null,`${name}: tool terminated by signal`);
  assert.equal(result.error,undefined);assert.equal(result.status===0,pass,`${name}: ${result.stdout} ${result.stderr}`);
  if(!pass)assert.match(result.stdout+result.stderr,gate==='tsc'?/error TS\d+/u:/error typescript\(/u,`${name}: failure must be a real diagnostic`);
 }
}finally{fs.rmSync(temp,{recursive:true,force:true});}

console.log(JSON.stringify({status:'PASS',suite:'typescript-gates',checks:10,negativeTypeAndLintGates:true}));
