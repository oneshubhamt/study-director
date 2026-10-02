// A bounded writer shared by worker encryption, copying and downloads.
const OPFS_DIRECTORY='@@SD_BACKUP_FILES_OPFS_DIRECTORY@@';
const OPFS_NAME=/^backup-[a-f0-9-]{36}$/u;
export async function resolveHandle(output){
  if(output?.kind!=='opfs')return output;
  const name=String(output.name||'');
  if(!OPFS_NAME.test(name))throw new Error('Backup scratch-file identity is invalid.');
  const storage=globalThis.navigator?.storage;
  if(!storage||typeof storage.getDirectory!=='function')throw new Error('Browser file storage is unavailable to the file worker.');
  const root=await storage.getDirectory(),directory=await root.getDirectoryHandle(OPFS_DIRECTORY,{create:true});
  return directory.getFileHandle(name,{create:true});
}
export async function openOutput(output){
  const handle=await resolveHandle(output);
  if(!handle||typeof handle.getFile!=='function'||(typeof handle.createSyncAccessHandle!=='function'&&typeof handle.createWritable!=='function'))throw new Error('Backup file output is unavailable.');
  let sync=null,asyncWriter=null,position=0,closed=false;
  if(typeof handle.createSyncAccessHandle==='function')sync=await handle.createSyncAccessHandle();
  else asyncWriter=await handle.createWritable({keepExistingData:false});
  if(sync)sync.truncate(0);
  return {
    async write(bytes){
      if(closed)throw new Error('File output is closed.');
      if(sync){let offset=0;while(offset<bytes.byteLength){const count=sync.write(bytes.subarray(offset),{at:position});if(count<=0)throw new Error('File output made no progress.');offset+=count;position+=count;}}
      else{await asyncWriter.write(bytes);position+=bytes.byteLength;}
    },
    async close(){if(closed)return;closed=true;if(sync){try{sync.flush();}finally{sync.close();}}else await asyncWriter.close();},
    async abort(){if(closed)return;closed=true;if(sync){try{sync.truncate(0);}finally{sync.close();}}else await asyncWriter.abort();},
    file:()=>handle.getFile(),
    get size(){return position;}
  };
}
export async function copyFile(file,writer,progress=()=>{}){
  for(let offset=0;offset<file.size;offset+=1048576){const bytes=new Uint8Array(await file.slice(offset,offset+1048576).arrayBuffer());await writer.write(bytes);progress({loaded:Math.min(offset+bytes.length,file.size),total:file.size,phase:'copying'});}
}
