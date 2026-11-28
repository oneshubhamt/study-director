// Node's disk-backed Blob exercises the worker's bounded file-processing port.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createProcessingEngine as pureEngine} from '../../portable/processing.ts';
import {processingRequest} from '../../portable/request-decoder.ts';
import type {Progress,FilePort} from '../../types/portable-file.ts';

import type {ProcessingOperation,ProcessingInputs,ProcessingOutputs} from '../../types/portable-processing.ts';

let directory: string | undefined;
let sequence=0;
export async function outputHandle(): Promise<FilePort> {
  if (!directory) {
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sd-file-processing-'));
    directory=temp;
    process.once('exit',()=>fs.rmSync(temp,{recursive:true,force:true}));
  }
  const filename=path.join(directory,String(++sequence));
  fs.writeFileSync(filename,'');
  return {
    async createSyncAccessHandle(){
      const fd=fs.openSync(filename,'r+');
      return {
        write:(bytes,{at})=>fs.writeSync(fd,bytes,0,bytes.length,at),
        truncate:size=>fs.ftruncateSync(fd,size),
        flush:()=>fs.fsyncSync(fd),
        close:()=>fs.closeSync(fd)
      };
    },
    getFile:()=>fs.openAsBlob(filename)
  };
}

export function createProcessingEngine(render?: Parameters<typeof pureEngine>[0]){
  const engine=pureEngine(render);
  function run<K extends ProcessingOperation>(type:K,data:Omit<ProcessingInputs[NoInfer<K>],'output'>,progress?:Progress):Promise<ProcessingOutputs[K]>;
  function run(type:'file.release'|'file.collect',data?:unknown):Promise<true>;
  async function run(type:string,data:unknown={},progress?:Progress):Promise<unknown>{
    if(type==='file.release'||type==='file.collect')return true;
    const needsOutput=type==='file.copy'||type==='crypto.stream.encrypt'||type==='crypto.stream.decrypt';
    const input=needsOutput&&data&&typeof data==='object'?{...data,output:await outputHandle()}:data;
    const request=processingRequest(type,input);
    return engine.run(request.type,request.data,progress);
  }
  return {scope:<T,>(operation:()=>T)=>operation(),run};
}
