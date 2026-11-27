import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import type {SpawnSyncOptions} from 'node:child_process';

type CaptureOptions=SpawnSyncOptions & {maxBuffer?:number};
export function captureOutcome(command:string,args:readonly string[],{maxBuffer=8*1024*1024,...options}:CaptureOptions={}){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-process-')),stdoutPath=path.join(directory,'stdout'),stderrPath=path.join(directory,'stderr');
  try{
    const stdout=fs.openSync(stdoutPath,'w');
    try{
      const stderr=fs.openSync(stderrPath,'w');
      try{
        const result=spawnSync(command,args,{...options,stdio:['ignore',stdout,stderr]});
        if(fs.statSync(stdoutPath).size+fs.statSync(stderrPath).size>maxBuffer)throw new Error('Subprocess output exceeded its capture limit.');
        return {...result,stdout:fs.readFileSync(stdoutPath,'utf8'),stderr:fs.readFileSync(stderrPath,'utf8')};
      }finally{fs.closeSync(stderr);}
    }finally{fs.closeSync(stdout);}
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
export function captureProcess(command:string,args:readonly string[],options:CaptureOptions={}){
  const result=captureOutcome(command,args,options);
  if(result.error)throw result.error;
  if(result.signal||!Number.isInteger(result.status))throw new Error(`Subprocess did not exit normally: ${result.signal||'no exit status'}`);
  return result;
}
