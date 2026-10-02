import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// File-backed output also works in sandboxes that prohibit subprocess pipes.
// A launch error or signal is a harness failure, never a successful assertion run.
export function captureProcess(command,args,{maxBuffer=8*1024*1024,...options}={}){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-process-')),stdoutPath=path.join(directory,'stdout'),stderrPath=path.join(directory,'stderr');
  const stdout=fs.openSync(stdoutPath,'w'),stderr=fs.openSync(stderrPath,'w');
  try{
    const result=spawnSync(command,args,{...options,stdio:['ignore',stdout,stderr]});
    if(result.error)throw result.error;
    if(result.signal||!Number.isInteger(result.status))throw new Error(`Subprocess did not exit normally: ${result.signal||'no exit status'}`);
    if(fs.statSync(stdoutPath).size+fs.statSync(stderrPath).size>maxBuffer)throw new Error('Subprocess output exceeded its capture limit.');
    return {...result,stdout:fs.readFileSync(stdoutPath,'utf8'),stderr:fs.readFileSync(stderrPath,'utf8')};
  }finally{fs.closeSync(stdout);fs.closeSync(stderr);fs.rmSync(directory,{recursive:true,force:true});}
}
