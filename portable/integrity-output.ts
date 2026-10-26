import type {OutputTarget,SyncFilePort,AsyncFilePort,ByteWriter} from '../types/portable-file.ts';
import {resolveHandle} from './file-output.ts';
// A checkpoint writer preserves its committed prefix on failure. Full export
// writers retain their separate truncate/abort behavior.
export async function openIntegrityOutput(output:OutputTarget,offset:number):Promise<ByteWriter>{
  const handle=await resolveHandle(output);
  if(!handle||!Number.isSafeInteger(offset)||offset<0||offset>(await handle.getFile()).size)throw new Error('Integrity scratch checkpoint is incomplete.');
  let sync:SyncFilePort|null=null,writer:AsyncFilePort|null=null,position=offset,closed=false;
  try{
    if(typeof handle.createSyncAccessHandle==='function'){sync=await handle.createSyncAccessHandle();sync.truncate(offset);}
    else{writer=await handle.createWritable!({keepExistingData:offset>0});await writer.truncate(offset);await writer.seek(offset);}
  }catch(error){
    if(sync){try{sync.close();}catch{}}
    else if(writer){try{await writer!.abort();}catch{}}
    throw error;
  }
  return {
    async write(bytes){if(closed)throw new Error('Integrity output is closed.');if(sync){for(let index=0;index<bytes.byteLength;){const written=sync.write(bytes.subarray(index),{at:position});if(written<=0)throw new Error('Integrity output made no progress.');index+=written;position+=written;}}else{await writer!.write(bytes);position+=bytes.byteLength;}},
    async close(){if(closed)return;closed=true;if(sync){try{sync.flush();}finally{sync.close();}}else{try{await writer!.close();}catch(error){try{await writer!.abort();}catch{}throw error;}}},
    async abort(){if(closed)return;closed=true;if(sync){try{sync.truncate(offset);}finally{sync.close();}}else await writer!.abort();}
  };
}
