// Node's disk-backed Blob exercises bounded file processing without npm/browser fixtures.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createProcessingEngine as pureEngine} from '../../portable/processing.ts';
let directory,sequence=0;
export async function outputHandle(){
  if(!directory){directory=fs.mkdtempSync(path.join(os.tmpdir(),'sd-file-processing-'));process.once('exit',()=>fs.rmSync(directory,{recursive:true,force:true}));}
  const filename=path.join(directory,String(++sequence));fs.writeFileSync(filename,'');
  return {
    async createSyncAccessHandle(){const fd=fs.openSync(filename,'r+');return {write:(bytes,{at})=>fs.writeSync(fd,bytes,0,bytes.length,at),truncate:size=>fs.ftruncateSync(fd,size),flush:()=>fs.fsyncSync(fd),close:()=>fs.closeSync(fd)};},
    getFile:()=>fs.openAsBlob(filename)
  };
}
export function createProcessingEngine(render){
  const engine=pureEngine(render);
  return {scope:operation=>operation(),async run(type,data={},...args){
    if(type==='file.release'||type==='file.collect')return true;
    if(type==='file.copy'||type.startsWith('crypto.stream.'))data={...data,output:await outputHandle()};
    return engine.run(type,data,...args);
  }};
}
