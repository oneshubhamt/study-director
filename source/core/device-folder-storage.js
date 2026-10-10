(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
// Device Folder storage for the backup engine: the same list, download,
// upload, delete and lock operations the Google Drive adapter offers, on a
// folder the person chose. The folder layout and lock files are unchanged:
// objects/, checkpoints/ and commits/ under the repository folder, and
// pub_*.sdpublication / mnt_*.sdmaintenance markers in objects/.
registry.define('device-folder-storage',1,()=>{
  const freeze=Object.freeze;
  const KINDS=freeze({
    object:freeze({directory:'objects',suffix:'.sdobject',pattern:/^(obj_[a-f0-9]{32})\.sdobject$/u}),
    checkpoint:freeze({directory:'checkpoints',suffix:'.sdcheckpoint',pattern:/^(cp_[a-f0-9]{32})\.sdcheckpoint$/u}),
    commit:freeze({directory:'commits',suffix:'.sdcommit',pattern:/^(cp_[a-f0-9]{32})\.sdcommit$/u})
  });
  const LOCKS=freeze({
    publication:freeze({prefix:'pub_',suffix:'.sdpublication',format:'study-director.repository-publication',pattern:/^(pub_[a-f0-9]{32})\.sdpublication$/u}),
    maintenance:freeze({prefix:'mnt_',suffix:'.sdmaintenance',format:'study-director.repository-maintenance',pattern:/^(mnt_[a-f0-9]{32})\.sdmaintenance$/u})
  });
  const SCOPE_FILE='repository.sdscope',SCOPE_FORMAT='study-director.device-folder-scope',WRITE_CHUNK_BYTES=1024*1024,LIST_YIELD_EVERY=128;
  function createStorage(input){
    exactObject(input,['checksum','environment','folder','identities','inspectManifest','limits'],'Device Folder storage input');
    functions(input.environment,['canMutate','clearTimeout','now','setTimeout','yieldTask'],'Device Folder storage environment');
    exactObject(input.identities,['checkpoints','commits','objects','root'],'Device Folder storage identities');
    exactObject(input.limits,['maintenanceAssertionMarginMs','maintenanceMaxAgeMs','publicationAssertionMarginMs','publicationMaxAgeMs','responseTimeoutMs'],'Device Folder storage limits');
    if(typeof input.folder!=='function'||typeof input.checksum!=='function'||typeof input.inspectManifest!=='function')throw new TypeError('Device Folder storage ports are invalid.');
    const environment=input.environment,identities=input.identities,limits=input.limits;
    const summaryCache=new Map(),digestCache=new Map();
    const nowMs=()=>{const value=Number(environment.now());return Number.isFinite(value)?value:Date.now();};
    const iso=ms=>new Date(Number(ms)||0).toISOString();
    function abortReason(signal){const reason=signal?.reason instanceof Error?signal.reason:new Error('Device Folder operation was cancelled.');if(!reason.name||reason.name==='Error')reason.name='AbortError';return reason;}
    function assertCurrent(signal){if(signal?.aborted)throw abortReason(signal);}
    // Every file-system call, read or write, is bounded, so a stalled folder
    // (a disconnected drive, a cloud sync client) surfaces as an error instead
    // of a hang. Closing a written file commits it, so it gets a longer allowance.
    function bounded(operation,label,signal=null,timeoutMs=limits.responseTimeoutMs){
      return new Promise((resolve,reject)=>{
        let settled=false;
        const finish=(callback,value)=>{if(settled)return;settled=true;environment.clearTimeout(timer);signal?.removeEventListener('abort',onAbort);callback(value);};
        const onAbort=()=>finish(reject,abortReason(signal));
        const timer=environment.setTimeout(()=>{const error=new Error(`${label} did not respond within ${Math.round(timeoutMs/1000)} seconds.`);error.code='DEVICE_FILESYSTEM_TIMEOUT';finish(reject,error);},timeoutMs);
        if(signal){if(signal.aborted){onAbort();return;}signal.addEventListener('abort',onAbort,{once:true});}
        Promise.resolve(operation).then(value=>finish(resolve,value),error=>finish(reject,error));
      });
    }
    async function directories(){
      const folder=input.folder();
      if(!folder||typeof folder.getDirectoryHandle!=='function')throw new Error('The selected folder cannot be used for Study Director automatic backup.');
      try{
        const root=await folder.getDirectoryHandle(identities.root,{create:true});
        const [objects,checkpoints,commits]=await Promise.all([root.getDirectoryHandle(identities.objects,{create:true}),root.getDirectoryHandle(identities.checkpoints,{create:true}),root.getDirectoryHandle(identities.commits,{create:true})]);
        return freeze({root,objects,checkpoints,commits});
      }catch(error){
        if(!error||error.name!=='NotFoundError')throw error;
        const missing=new Error('The backup folder is no longer available. Choose the backup folder again.');missing.code='DEVICE_FOLDER_MISSING';throw missing;
      }
    }
    async function entries(directory,label,signal){
      if(!directory||typeof directory.entries!=='function')throw new Error(`${label} cannot be listed.`);
      const iterable=directory.entries(),iterator=typeof iterable[Symbol.asyncIterator]==='function'?iterable[Symbol.asyncIterator]():iterable,out=[];
      try{for(;;){assertCurrent(signal);const step=await bounded(iterator.next(),`${label} listing`,signal);if(step.done)break;out.push(step.value);if(out.length%LIST_YIELD_EVERY===0)await environment.yieldTask();}}
      finally{if(typeof iterator.return==='function')Promise.resolve(iterator.return()).catch(()=>{});}
      return out;
    }
    async function fileOrNull(directory,name,signal=null){
      try{const handle=await bounded(directory.getFileHandle(name),`Device Folder file ${name}`,signal);return await bounded(handle.getFile(),`Device Folder file ${name}`,signal);}
      catch(error){if(error&&error.name==='NotFoundError')return null;throw error;}
    }
    // Each repository folder carries a random identity, so caches and pending
    // maintenance never carry over to a different folder.
    async function scope(){
      const {root}=await directories(),existing=await fileOrNull(root,SCOPE_FILE);
      if(existing){try{const value=JSON.parse(await existing.text());if(value&&value.format===SCOPE_FORMAT&&/^[a-f0-9]{32}$/u.test(String(value.id||'')))return `device-folder:1:${value.id}`;}catch{}}
      const id=globalThis.crypto.randomUUID().replace(/-/gu,'');
      await writeFile(root,SCOPE_FILE,new Blob([JSON.stringify({format:SCOPE_FORMAT,version:1,id})],{type:'application/json'}));
      return `device-folder:1:${id}`;
    }
    async function digestOf(file,cacheKey,signal){
      const cached=digestCache.get(cacheKey);if(cached)return cached;
      const digest=String(await input.checksum(file,{signal})||'');if(!/^[a-f0-9]{64}$/u.test(digest))throw new Error('Device Folder file checksum is invalid.');
      digestCache.set(cacheKey,digest);if(digestCache.size>512)digestCache.delete(digestCache.keys().next().value);return digest;
    }
    // A version's summary comes from its manifest, so history shows dates,
    // counts and tiers without reading anything else.
    async function summaryOf(file,cacheKey){
      if(summaryCache.has(cacheKey))return summaryCache.get(cacheKey);
      let summary=null;
      try{const manifest=await input.inspectManifest(file,{interactive:false});summary=freeze({logicalFingerprint:manifest.logicalFingerprint,exportedAt:manifest.exportedAt,counts:freeze({dailyRecord:Number(manifest.counts?.dailyRecord)||0,areaNote:Number(manifest.counts?.areaNote)||0}),encrypted:manifest.encrypted===true,retention:manifest.retention});}
      catch(error){if(error&&error.code==='BACKUP_LOCKED')return null;summary=null;}
      summaryCache.set(cacheKey,summary);if(summaryCache.size>256)summaryCache.delete(summaryCache.keys().next().value);return summary;
    }
    async function describe(kind,id,name,file,repositoryScope,signal){
      const modifiedAt=iso(file.lastModified||nowMs()),cacheKey=`${repositoryScope}\u0000${name}\u0000${file.lastModified}\u0000${file.size}`,item={kind,id,name,size:file.size,createdAt:modifiedAt,modifiedAt,remoteId:name,remoteVersion:String(Math.max(1,Math.floor(Number(file.lastModified)||1))),verificationScope:repositoryScope};
      if(kind!=='object')item.digest=await digestOf(file,cacheKey,signal);
      if(kind==='checkpoint'){const summary=await summaryOf(file,cacheKey);if(summary)item.history=summary;}
      return freeze(item);
    }
    async function list({kind,signal=null}={}){
      const spec=KINDS[kind];if(!spec)throw new Error('Device Folder storage list kind is invalid.');
      const dirs=await directories(),repositoryScope=await scope(),items=[];let ignored=0;
      for(const [name,handle] of await entries(dirs[spec.directory],`Device Folder ${kind} folder`,signal)){
        const match=spec.pattern.exec(String(name));if(!match)continue;
        if(!handle||handle.kind!=='file'){ignored+=1;continue;}
        try{const file=await bounded(handle.getFile(),`Device Folder ${kind} ${name}`,signal);if(!(Number(file.size)>0)){ignored+=1;continue;}items.push(await describe(kind,match[1],String(name),file,repositoryScope,signal));}
        catch(error){if(error&&(error.name==='AbortError'||error.code==='DEVICE_FILESYSTEM_TIMEOUT'))throw error;ignored+=1;}
      }
      return freeze({items:freeze(items),overflow:false,ignored});
    }
    async function download(item,options={}){
      const spec=KINDS[item&&item.kind];if(!spec||!spec.pattern.test(String(item.id||'')+spec.suffix))throw new Error('A Study Director backup download has an invalid identity.');
      const dirs=await directories(),file=await fileOrNull(dirs[spec.directory],item.id+spec.suffix,options.signal||null);
      if(!file){const error=new Error('A file required by this backup version is missing from the Device Folder.');error.code='REPOSITORY_OBJECT_MISSING';throw error;}
      if(Object.hasOwn(options,'offset'))return file.slice(options.offset,options.offset+options.length);
      return file;
    }
    async function writeFile(directory,name,blob,{checks=null,onProgress=null}={}){
      const label=`Device Folder write ${name}`;
      const handle=await bounded(directory.getFileHandle(name,{create:true}),label),writable=await bounded(handle.createWritable({keepExistingData:false}),label);let closed=false;
      try{
        for(let offset=0;offset<blob.size;offset+=WRITE_CHUNK_BYTES){await checks?.();await bounded(writable.write(blob.slice(offset,offset+WRITE_CHUNK_BYTES)),label);onProgress?.(Math.min(offset+WRITE_CHUNK_BYTES,blob.size),blob.size);}
        await checks?.();if(!environment.canMutate())throw new Error('Control changed before the backup was committed.');
        await bounded(writable.close(),label,null,limits.responseTimeoutMs*6);closed=true;
      }catch(error){if(!closed)try{await writable.abort?.();}catch{}throw error;}
      return handle;
    }
    // A write is complete only when the file reads back with the expected
    // size and checksum; a mismatch removes the file and fails the write.
    async function upload(file){
      const spec=KINDS[file&&file.kind];if(!spec||!spec.pattern.test(String(file.id||'')+spec.suffix)||!(file.blob instanceof Blob))throw new Error('A Study Director backup upload has an invalid identity.');
      const dirs=await directories(),name=file.id+spec.suffix,directory=dirs[spec.directory],checks=async()=>{await file.checkProtection?.();await file.checkSource?.();};
      await writeFile(directory,name,file.blob,{checks,onProgress:file.onProgress});
      const written=await fileOrNull(directory,name);
      if(!written||written.size!==file.blob.size){try{await bounded(directory.removeEntry(name),`Device Folder remove ${name}`);}catch{}throw new Error('The Device Folder did not keep the complete backup file.');}
      const expected=String(file.digest||''),actual=await input.checksum(written,{});
      if(expected&&actual!==expected){try{await bounded(directory.removeEntry(name),`Device Folder remove ${name}`);}catch{}throw new Error('A Device Folder backup file failed verification after it was written.');}
      // The read-back checksum is the folder's receipt, as Drive's server checksum is.
      return freeze({...await describe(file.kind,file.id,name,written,await scope(),null),serverDigest:actual});
    }
    async function remove(item){
      const spec=KINDS[item&&item.kind];if(!spec||!spec.pattern.test(String(item.id||'')+spec.suffix))throw new Error('A Study Director backup deletion request has an invalid identity.');
      const dirs=await directories(),name=item.id+spec.suffix,directory=dirs[spec.directory];
      if(item.remoteVersion){const current=await fileOrNull(directory,name);if(!current)return false;if(String(Math.max(1,Math.floor(Number(current.lastModified)||1)))!==String(item.remoteVersion))throw new Error('A Study Director backup file changed before deletion. Nothing was removed.');}
      try{await bounded(directory.removeEntry(name),`Device Folder remove ${name}`);return true;}catch(error){if(error&&error.name==='NotFoundError')return false;throw error;}
    }
    // Locks are marker files; their age comes from the file's modified time.
    async function beginLock(kind){
      const spec=LOCKS[kind],id=spec.prefix+globalThis.crypto.randomUUID().replace(/-/gu,''),name=id+spec.suffix,{objects}=await directories();
      await writeFile(objects,name,new Blob([JSON.stringify({format:spec.format,version:1,id,startedAt:iso(nowMs())})],{type:'application/json'}));
      const written=await fileOrNull(objects,name);if(!written)throw new Error('The Device Folder lock could not be written.');
      return freeze({kind,id,name,createdAt:iso(written.lastModified||nowMs())});
    }
    async function listLocks(kind){
      const spec=LOCKS[kind],{objects}=await directories(),items=[];let ignored=0;
      for(const [name,handle] of await entries(objects,'Device Folder lock folder',null)){
        const match=spec.pattern.exec(String(name));if(!match)continue;
        if(!handle||handle.kind!=='file'){ignored+=1;continue;}
        try{const file=await bounded(handle.getFile(),`Device Folder lock ${name}`);items.push(freeze({kind,id:match[1],name:String(name),createdAt:iso(file.lastModified)}));}catch{ignored+=1;}
      }
      return freeze({items:freeze(items),overflow:false,ignored});
    }
    async function assertLock(kind,lease){
      const spec=LOCKS[kind],id=String(lease&&lease.id||''),name=String(lease&&lease.name||'');
      if(!spec.pattern.test(name)||name!==id+spec.suffix)throw new Error('Device Folder lock is invalid.');
      const {objects}=await directories(),file=await fileOrNull(objects,name);if(!file)throw new Error('Device Folder lock disappeared. Retry the backup.');
      const age=nowMs()-Number(file.lastModified||0),window=kind==='publication'?limits.publicationMaxAgeMs-limits.publicationAssertionMarginMs:limits.maintenanceMaxAgeMs-limits.maintenanceAssertionMarginMs;
      if(!Number.isFinite(age)||age<0||age>=window)throw new Error('Device Folder lock is too old to continue safely. Retry the backup.');
      let parsed=null;try{parsed=JSON.parse(await file.text());}catch{}
      if(!parsed||parsed.format!==spec.format||Number(parsed.version)!==1||parsed.id!==id)throw new Error('Device Folder lock could not be verified. Retry the backup.');
      return true;
    }
    async function renewLock(kind,lease){
      await assertLock(kind,lease);const spec=LOCKS[kind],{objects}=await directories();
      await writeFile(objects,lease.name,new Blob([JSON.stringify({format:spec.format,version:1,id:lease.id,startedAt:iso(nowMs())})],{type:'application/json'}));
      // The renewed lease carries the new start, so the next renewal waits a full interval.
      const written=await fileOrNull(objects,lease.name);if(!written)throw new Error('Device Folder lock disappeared. Retry the backup.');
      return freeze({...lease,createdAt:iso(written.lastModified||nowMs())});
    }
    async function endLock(kind,lease){
      const spec=LOCKS[kind],name=String(lease&&lease.name||'');if(!spec.pattern.test(name))return false;
      const {objects}=await directories();try{await bounded(objects.removeEntry(name),`Device Folder lock ${name}`);return true;}catch(error){if(error&&error.name==='NotFoundError')return false;throw error;}
    }
    // An operation view checks its signal and protection before every file
    // call, so long cleanups can keep their lease renewed while listing.
    function beginOperation({signal=null,checkProtection=null}={}){
      const guard=async()=>{assertCurrent(signal);await checkProtection?.();assertCurrent(signal);};
      return freeze({
        list:async options=>{await guard();return list({...options,signal:options?.signal||signal});},
        download:async(item,options={})=>{await guard();return download(item,{...options,signal:options.signal||signal});},
        delete:async item=>{await guard();return remove(item);},
        upload:async file=>{await guard();return upload(file);},
        scope,historyReadConcurrency:8,
        beginPublication:()=>beginLock('publication'),listPublications:()=>listLocks('publication'),assertPublication:lease=>assertLock('publication',lease),endPublication:lease=>endLock('publication',lease),
        beginMaintenance:()=>beginLock('maintenance'),listMaintenances:()=>listLocks('maintenance'),assertMaintenance:lease=>assertLock('maintenance',lease),renewMaintenance:lease=>renewLock('maintenance',lease),endMaintenance:lease=>endLock('maintenance',lease)
      });
    }
    return freeze({
      list,upload,download,delete:remove,scope,beginOperation,historyReadConcurrency:8,
      beginPublication:()=>beginLock('publication'),listPublications:()=>listLocks('publication'),assertPublication:lease=>assertLock('publication',lease),endPublication:lease=>endLock('publication',lease),
      beginMaintenance:()=>beginLock('maintenance'),listMaintenances:()=>listLocks('maintenance'),assertMaintenance:lease=>assertLock('maintenance',lease),renewMaintenance:lease=>renewLock('maintenance',lease),endMaintenance:lease=>endLock('maintenance',lease)
    });
  }
  return freeze({format:'study-director.device-folder-storage-module',contractVersion:1,createStorage});
});
})();
