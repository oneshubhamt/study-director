// A bounded writer shared by worker encryption, copying and downloads.
// Each profile keeps its scratch files in its own folder: the plain one, or
// the plain one followed by ~<profile scope>. The folder is split rather than
// measured: the bundler would fix a name's length before the build fills it in.
const OPFS_DIRECTORY='@@SD_BACKUP_FILES_OPFS_DIRECTORY@@',SEPARATOR='@@SD_PROFILE_SCOPE_SEPARATOR@@',PROFILE_SCOPE=/^prof_[a-z0-9]{1,24}_[a-z0-9]{6,12}_[a-f0-9]{8}$/u;
const profileFolder=value=>{const [base,scope,...rest]=String(value).split(SEPARATOR);return base===OPFS_DIRECTORY&&(scope===undefined||!rest.length&&PROFILE_SCOPE.test(scope));};
const OPFS_NAME=/^backup-[a-f0-9-]{36}$/u;
export async function resolveHandle(output){
  if(output?.kind!=='opfs')return output;
  const name=String(output.name||'');
  if(!OPFS_NAME.test(name))throw new Error('Backup scratch-file identity is invalid.');
  const folder=String(output.directory||'');
  if(!profileFolder(folder))throw new Error('Backup scratch-file folder is invalid.');
  const storage=globalThis.navigator?.storage;
  if(!storage||typeof storage.getDirectory!=='function')throw new Error('Browser file storage is unavailable to the file worker.');
  const root=await storage.getDirectory(),directory=await root.getDirectoryHandle(folder,{create:true});
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
