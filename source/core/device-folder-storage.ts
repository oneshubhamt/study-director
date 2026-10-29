import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {FolderStorageInput,FolderDirectory,FolderMarker,StorageKind,LockKind,StorageItem,StorageIdentity,StorageUpload,StoredFile,FileSummary,LockLease,SignalOptions,RangeOptions,WholeOptions,DownloadOptions,RangeResult} from '../../types/device-folder-storage.ts';
const sdDeviceFolderStorageFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'device-folder-storage','study-director.device-folder-storage-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
// Device Folder storage for the backup engine: the same list, download,
// upload, delete and lock operations the Google Drive adapter offers, on a
// folder the person chose. Inside it, each profile and device has its own
// repository folder ("Study Director - Ana - iPhone Safari"), known by the
// marker file inside rather than by its name: objects/, checkpoints/ and
// commits/, and pub_*.sdpublication / mnt_*.sdmaintenance markers in objects/.
// The layout functions find it, make it, and take over another one.
const createModule=()=>{
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
  function createStorage(input:FolderStorageInput){
    exactObject(input,['checksum','environment','folder','identities','inspectManifest','limits','owner'],'Device Folder storage input');
    functions(input.environment,['canMutate','clearTimeout','now','setTimeout','yieldTask'],'Device Folder storage environment');
    exactObject(input.identities,['checkpoints','commits','objects','prefix','root'],'Device Folder storage identities');
    if(typeof input.owner!=='function')throw new TypeError('Device Folder storage owner port is invalid.');
    exactObject(input.limits,['maintenanceAssertionMarginMs','maintenanceMaxAgeMs','publicationAssertionMarginMs','publicationMaxAgeMs','responseTimeoutMs'],'Device Folder storage limits');
    if(typeof input.folder!=='function'||typeof input.checksum!=='function'||typeof input.inspectManifest!=='function')throw new TypeError('Device Folder storage ports are invalid.');
    const environment=input.environment,identities=input.identities,limits=input.limits;
    const summaryCache=new Map<string,FileSummary>(),digestCache=new Map<string,string>();
    const nowMs=()=>{const value=Number(environment.now());return Number.isFinite(value)?value:Date.now();};
    const iso=(ms:number)=>new Date(Number(ms)||0).toISOString();
    function abortReason(signal:AbortSignal|null){const reason=signal?.reason instanceof Error?signal.reason:new Error('Device Folder operation was cancelled.');if(!reason.name||reason.name==='Error')reason.name='AbortError';return reason;}
    function assertCurrent(signal:AbortSignal|null){if(signal?.aborted)throw abortReason(signal);}
    // Every file-system call, read or write, is bounded, so a stalled folder
    // (a disconnected drive, a cloud sync client) surfaces as an error instead
    // of a hang. Closing a written file commits it, so it gets a longer allowance.
    function bounded<T>(operation:PromiseLike<T>,label:string,signal:AbortSignal|null=null,timeoutMs=limits.responseTimeoutMs):Promise<T>{
      return new Promise<T>((resolve,reject)=>{
        let settled=false;
        const finish=<V>(callback:(value:V)=>void,value:V)=>{if(settled)return;settled=true;environment.clearTimeout(timer);signal?.removeEventListener('abort',onAbort);callback(value);};
        const onAbort=()=>finish(reject,abortReason(signal));
        const timer=environment.setTimeout(()=>{const error=new Error(`${label} did not respond within ${Math.round(timeoutMs/1000)} seconds.`);Object.assign(error,{code:'DEVICE_FILESYSTEM_TIMEOUT'});finish(reject,error);},timeoutMs);
        if(signal){if(signal.aborted){onAbort();return;}signal.addEventListener('abort',onAbort,{once:true});}
        Promise.resolve(operation).then(value=>finish(resolve,value),error=>finish(reject,error));
      });
    }
    function chosenFolder(){
      const folder=input.folder();
      if(!folder||typeof folder.getDirectoryHandle!=='function')throw new Error('The selected folder cannot be used for Study Director automatic backup.');
      return folder;
    }
    // The repository folder in use: a fixed name, or the one the controller
    // settled on for this profile and device.
    function rootName(){
      const name=String((typeof identities.root==='function'?identities.root():identities.root)||'');
      if(!name)throw Object.assign(new Error('The Device Folder backups are still being prepared.'),{code:'DEVICE_REPOSITORY_PENDING'});
      return name;
    }
    async function directories(){
      const folder=chosenFolder();
      try{
        const root=await folder.getDirectoryHandle(rootName(),{create:true});
        const [objects,checkpoints,commits]=await Promise.all([root.getDirectoryHandle(identities.objects,{create:true}),root.getDirectoryHandle(identities.checkpoints,{create:true}),root.getDirectoryHandle(identities.commits,{create:true})]);
        return freeze({root,objects,checkpoints,commits});
      }catch(error){
        if(!error||(error as {name?:unknown}).name!=='NotFoundError')throw error;
        const missing=new Error('The backup folder is no longer available. Choose the backup folder again.');Object.assign(missing,{code:'DEVICE_FOLDER_MISSING'});throw missing;
      }
    }
    async function entries(directory:FolderDirectory,label:string,signal:AbortSignal|null){
      if(!directory||typeof directory.entries!=='function')throw new Error(`${label} cannot be listed.`);
      const iterable=directory.entries(),iterator=typeof iterable[Symbol.asyncIterator]==='function'?iterable[Symbol.asyncIterator]():iterable,out=[];
      try{for(;;){assertCurrent(signal);const step=await bounded(iterator.next(),`${label} listing`,signal);if(step.done)break;out.push(step.value);if(out.length%LIST_YIELD_EVERY===0)await environment.yieldTask();}}
      finally{if(typeof iterator.return==='function')Promise.resolve(iterator.return()).catch(()=>{});}
      return out;
    }
    async function fileOrNull(directory:FolderDirectory,name:string,signal:AbortSignal|null=null){
      try{const handle=await bounded(directory.getFileHandle(name),`Device Folder file ${name}`,signal);return await bounded(handle.getFile(),`Device Folder file ${name}`,signal);}
      catch(error){if(error&&(error as {name?:unknown}).name==='NotFoundError')return null;throw error;}
    }
    // Each repository folder carries a random identity, so caches and pending
    // maintenance never carry over to a different folder. The same marker says
    // which profile and device it belongs to (version 2).
    const randomId=()=>globalThis.crypto.randomUUID().replace(/-/gu,'');
    function parseMarker(text:string):FolderMarker|null{
      try{const value=JSON.parse(text) as {format?:unknown;version?:unknown;id?:unknown;profile?:unknown;scope?:unknown;device?:unknown}|null,version=Number(value&&value.version);if(value&&value.format===SCOPE_FORMAT&&version===2&&/^[a-f0-9]{32}$/u.test(String(value.id||'')))return freeze({id:String(value.id),version:2,profile:String(value.profile||''),scope:String(value.scope||''),device:String(value.device||'')});}catch{}
      return null;
    }
    async function readMarker(directory:FolderDirectory){const file=await fileOrNull(directory,SCOPE_FILE);return file?parseMarker(await file.text()):null;}
    // A profile is known on this device by its scope, which never changes; its
    // id is recorded too, and follows it.
    function owner(){const value:Partial<ReturnType<typeof input.owner>>=input.owner()||{};return freeze({profile:String(value.profile||''),scope:String(value.scope||''),device:String(value.device||'')});}
    function markerBlob(id:string){const mine=owner();return new Blob([JSON.stringify({format:SCOPE_FORMAT,version:2,id,profile:mine.profile,scope:mine.scope,device:mine.device})],{type:'application/json'});}
    async function scope(){
      const {root}=await directories(),existing=await readMarker(root);
      if(existing)return `device-folder:1:${existing.id}`;
      const id=randomId();
      await writeFile(root,SCOPE_FILE,markerBlob(id));
      return `device-folder:1:${id}`;
    }
    async function digestOf(file:Blob,cacheKey:string,signal:AbortSignal|null){
      const cached=digestCache.get(cacheKey);if(cached)return cached;
      const digest=String(await input.checksum(file,{signal})||'');if(!/^[a-f0-9]{64}$/u.test(digest))throw new Error('Device Folder file checksum is invalid.');
      digestCache.set(cacheKey,digest);if(digestCache.size>512)digestCache.delete(digestCache.keys().next().value!);return digest;
    }
    // A version's summary comes from its manifest, so history shows dates,
    // counts and tiers without reading anything else. A manifest this build
    // cannot read is marked unreadable, and one waiting for the password
    // locked; a read that failed is tried again on the next listing.
    async function summaryOf(file:Blob,cacheKey:string):Promise<FileSummary>{
      if(summaryCache.has(cacheKey))return summaryCache.get(cacheKey)!;
      let summary:FileSummary;
      try{const manifest=await input.inspectManifest(file,{interactive:false});summary=freeze({history:freeze({format:Number(manifest.version)||0,logicalFingerprint:manifest.logicalFingerprint,exportedAt:manifest.exportedAt,counts:freeze({dailyRecord:Number(manifest.counts?.['dailyRecord'])||0,note:Number(manifest.counts?.['note'])||0}),encrypted:manifest.encrypted===true,retention:manifest.retention,origin:String(manifest.installationId||'')})});}
      catch(error){if(error&&(error as {code?:unknown}).code==='BACKUP_LOCKED')return freeze({locked:true});if((error as {repositoryUnreadable?:unknown}|null|undefined)?.repositoryUnreadable!==true)return freeze({});summary=freeze({unreadable:true});}
      summaryCache.set(cacheKey,summary);if(summaryCache.size>256)summaryCache.delete(summaryCache.keys().next().value!);return summary;
    }
    async function describe(kind:StorageKind,id:string,name:string,file:StoredFile,repositoryScope:string,signal:AbortSignal|null){
      const modifiedAt=iso(file.lastModified||nowMs()),cacheKey=`${repositoryScope}\u0000${name}\u0000${file.lastModified}\u0000${file.size}`,item:StorageItem={kind,id,name,size:file.size,createdAt:modifiedAt,modifiedAt,remoteId:name,remoteVersion:String(Math.max(1,Math.floor(Number(file.lastModified)||1))),verificationScope:repositoryScope};
      if(kind!=='object')Object.assign(item,{digest:await digestOf(file,cacheKey,signal)});
      if(kind==='checkpoint')Object.assign(item,await summaryOf(file,cacheKey));
      return freeze(item);
    }
    async function list({kind,signal=null}:{kind:StorageKind}&SignalOptions){
      const spec=KINDS[kind];if(!spec)throw new Error('Device Folder storage list kind is invalid.');
      const dirs=await directories(),repositoryScope=await scope(),items=[];let ignored=0;
      for(const [name,handle] of await entries(dirs[spec.directory],`Device Folder ${kind} folder`,signal)){
        const match=spec.pattern.exec(String(name));if(!match)continue;
        if(!handle||handle.kind!=='file'){ignored+=1;continue;}
        try{const file=await bounded(handle.getFile(),`Device Folder ${kind} ${name}`,signal);if(!(Number(file.size)>0)){ignored+=1;continue;}items.push(await describe(kind,match[1]!,String(name),file,repositoryScope,signal));}
        catch(error){if(error&&((error as {name?:unknown}).name==='AbortError'||(error as {code?:unknown}).code==='DEVICE_FILESYSTEM_TIMEOUT'))throw error;ignored+=1;}
      }
      return freeze({items:freeze(items),overflow:false,ignored});
    }
    function download(item:StorageIdentity,options:RangeOptions):Promise<RangeResult>;
    function download(item:StorageIdentity,options?:WholeOptions):Promise<StoredFile>;
    function download(item:StorageIdentity,options:DownloadOptions):Promise<StoredFile|RangeResult>;
    async function download(item:StorageIdentity,options:DownloadOptions={}):Promise<StoredFile|RangeResult>{
      const spec=KINDS[item&&item.kind];if(!spec||!spec.pattern.test(String(item.id||'')+spec.suffix))throw new Error('A Study Director backup download has an invalid identity.');
      const dirs=await directories(),file=await fileOrNull(dirs[spec.directory],item.id+spec.suffix,options.signal||null);
      if(!file){const error=new Error('A file required by this backup version is missing from the Device Folder.');Object.assign(error,{code:'REPOSITORY_OBJECT_MISSING'});throw error;}
      // A range read (integrity verification) also returns the file's size and
      // version (its modified time, as listed), so a file that changes between
      // ranges restarts verification instead of mixing bytes from two files.
      if(Object.hasOwn(options,'offset')){
        const offset=options.offset,length=options.length,total=Number(file.size);
        if(typeof offset!=='number'||!Number.isSafeInteger(offset)||offset<0||typeof length!=='number'||!Number.isSafeInteger(length)||length<1||length>1024*1024||offset+length>total)throw new Error('Repository download range is invalid.');
        return freeze({blob:file.slice(offset,offset+length),totalBytes:total,version:String(Math.max(1,Math.floor(Number(file.lastModified)||1)))});
      }
      return file;
    }
    async function writeFile(directory:FolderDirectory,name:string,blob:Blob,{checks=null,onProgress=null}:{checks?:(()=>void|Promise<void>)|null;onProgress?:((loaded:number,total:number)=>void)|null|undefined}={}){
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
    async function upload(file:StorageUpload){
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
    async function remove(item:StorageIdentity){
      const spec=KINDS[item&&item.kind];if(!spec||!spec.pattern.test(String(item.id||'')+spec.suffix))throw new Error('A Study Director backup deletion request has an invalid identity.');
      const dirs=await directories(),name=item.id+spec.suffix,directory=dirs[spec.directory];
      if(item.remoteVersion){const current=await fileOrNull(directory,name);if(!current)return false;if(String(Math.max(1,Math.floor(Number(current.lastModified)||1)))!==String(item.remoteVersion))throw new Error('A Study Director backup file changed before deletion. Nothing was removed.');}
      try{await bounded(directory.removeEntry(name),`Device Folder remove ${name}`);return true;}catch(error){if(error&&(error as {name?:unknown}).name==='NotFoundError')return false;throw error;}
    }
    // Locks are marker files; their age comes from the file's modified time.
    async function beginLock(kind:LockKind){
      const spec=LOCKS[kind],id=spec.prefix+globalThis.crypto.randomUUID().replace(/-/gu,''),name=id+spec.suffix,{objects}=await directories();
      await writeFile(objects,name,new Blob([JSON.stringify({format:spec.format,version:1,id,startedAt:iso(nowMs())})],{type:'application/json'}));
      const written=await fileOrNull(objects,name);if(!written)throw new Error('The Device Folder lock could not be written.');
      return freeze({kind,id,name,createdAt:iso(written.lastModified||nowMs())});
    }
    async function listLocks(kind:LockKind){
      const spec=LOCKS[kind],{objects}=await directories(),items=[];let ignored=0;
      for(const [name,handle] of await entries(objects,'Device Folder lock folder',null)){
        const match=spec.pattern.exec(String(name));if(!match)continue;
        if(!handle||handle.kind!=='file'){ignored+=1;continue;}
        try{const file=await bounded(handle.getFile(),`Device Folder lock ${name}`);items.push(freeze({kind,id:match[1]!,name:String(name),createdAt:iso(file.lastModified)}));}catch{ignored+=1;}
      }
      return freeze({items:freeze(items),overflow:false,ignored});
    }
    async function assertLock(kind:LockKind,lease:LockLease){
      const spec=LOCKS[kind],id=String(lease&&lease.id||''),name=String(lease&&lease.name||'');
      if(!spec.pattern.test(name)||name!==id+spec.suffix)throw new Error('Device Folder lock is invalid.');
      const {objects}=await directories(),file=await fileOrNull(objects,name);if(!file)throw new Error('Device Folder lock disappeared. Retry the backup.');
      const age=nowMs()-Number(file.lastModified||0),window=kind==='publication'?limits.publicationMaxAgeMs-limits.publicationAssertionMarginMs:limits.maintenanceMaxAgeMs-limits.maintenanceAssertionMarginMs;
      if(!Number.isFinite(age)||age<0||age>=window)throw new Error('Device Folder lock is too old to continue safely. Retry the backup.');
      let parsed: {format?:unknown;version?:unknown;id?:unknown}|null=null;try{parsed=JSON.parse(await file.text()) as {format?:unknown;version?:unknown;id?:unknown}|null;}catch{}
      if(!parsed||parsed.format!==spec.format||Number(parsed.version)!==1||parsed.id!==id)throw new Error('Device Folder lock could not be verified. Retry the backup.');
      return true;
    }
    async function renewLock(kind:LockKind,lease:LockLease){
      await assertLock(kind,lease);const spec=LOCKS[kind],{objects}=await directories();
      await writeFile(objects,lease.name,new Blob([JSON.stringify({format:spec.format,version:1,id:lease.id,startedAt:iso(nowMs())})],{type:'application/json'}));
      // The renewed lease carries the new start, so the next renewal waits a full interval.
      const written=await fileOrNull(objects,lease.name);if(!written)throw new Error('Device Folder lock disappeared. Retry the backup.');
      return freeze({...lease,createdAt:iso(written.lastModified||nowMs())});
    }
    async function endLock(kind:LockKind,lease:LockLease){
      const spec=LOCKS[kind],name=String(lease&&lease.name||'');if(!spec.pattern.test(name))return false;
      const {objects}=await directories();try{await bounded(objects.removeEntry(name),`Device Folder lock ${name}`);return true;}catch(error){if(error&&(error as {name?:unknown}).name==='NotFoundError')return false;throw error;}
    }
    // An operation view checks its signal and protection before every file
    // call, so long cleanups can keep their lease renewed while listing.
    function beginOperation({signal=null,checkProtection=null}:SignalOptions&{checkProtection?:(()=>void|Promise<void>)|null}={}){
      const guard=async()=>{assertCurrent(signal);await checkProtection?.();assertCurrent(signal);};
      function guardedDownload(item:StorageIdentity,options:RangeOptions):Promise<RangeResult>;
      function guardedDownload(item:StorageIdentity,options?:WholeOptions):Promise<StoredFile>;
      function guardedDownload(item:StorageIdentity,options:DownloadOptions):Promise<StoredFile|RangeResult>;
      async function guardedDownload(item:StorageIdentity,options:DownloadOptions={}){await guard();return download(item,{...options,signal:options.signal||signal});}
      return freeze({
        list:async(options:{kind:StorageKind}&SignalOptions)=>{await guard();return list({...options,signal:options?.signal||signal});},
        download:guardedDownload,
        delete:async(item:StorageIdentity)=>{await guard();return remove(item);},
        upload:async(file:StorageUpload)=>{await guard();return upload(file);},
        scope,historyReadConcurrency:8,
        beginPublication:()=>beginLock('publication'),listPublications:()=>listLocks('publication'),assertPublication:(lease:LockLease)=>assertLock('publication',lease),endPublication:(lease:LockLease)=>endLock('publication',lease),
        beginMaintenance:()=>beginLock('maintenance'),listMaintenances:()=>listLocks('maintenance'),assertMaintenance:(lease:LockLease)=>assertLock('maintenance',lease),renewMaintenance:(lease:LockLease)=>renewLock('maintenance',lease),endMaintenance:(lease:LockLease)=>endLock('maintenance',lease)
      });
    }
    /* LAYOUT · which repository folder this profile and device use */
    async function childDirectory(parent:FolderDirectory,name:string){
      try{return await bounded(parent.getDirectoryHandle(name),`Device Folder ${name}`);}
      catch(error){if(error&&((error as {name?:unknown}).name==='NotFoundError'||(error as {name?:unknown}).name==='TypeMismatchError'))return null;throw error;}
    }
    // How many versions a repository folder holds, and when the newest was made.
    async function versionsIn(directory:FolderDirectory){
      const commits=await childDirectory(directory,identities.commits);if(!commits)return freeze({versions:0,newest:''});
      let versions=0,newest=0;
      for(const [name,handle] of await entries(commits,'Device Folder versions',null)){
        if(!KINDS.commit.pattern.test(String(name))||!handle||handle.kind!=='file')continue;
        versions+=1;try{newest=Math.max(newest,Number((await bounded(handle.getFile(),`Device Folder version ${name}`)).lastModified)||0);}catch{}
      }
      return freeze({versions,newest:newest?iso(newest):''});
    }
    // The Study Director repository folders in the chosen folder: those made
    // for each profile and device.
    async function inspect(){
      const folder=chosenFolder(),repositories=[];
      for(const [name,handle] of await entries(folder,'Device Folder',null)){
        if(!handle||handle.kind!=='directory')continue;
        if(!String(name).startsWith(identities.prefix))continue;
        const marker=await readMarker(handle);if(!marker||marker.version!==2||!marker.profile)continue;
        repositories.push(freeze({name:String(name),profile:marker.profile,scope:marker.scope,device:marker.device,...await versionsIn(handle)}));
      }
      return freeze({repositories:freeze(repositories)});
    }
    // What the chosen folder holds, by name, as its listing says.
    async function childNames(folder:FolderDirectory){const names=new Set<string>();for(const [name] of await entries(folder,'Device Folder',null))names.add(String(name));return names;}
    // A name not yet taken: "Study Director - Ana - iPhone Safari", then " (2)"…
    // Names are plain ASCII: some file systems map other characters onto
    // another folder, which would mix backups with the chosen folder itself.
    async function freeName(base:string){
      const folder=chosenFolder(),clean=String(base||'').trim();
      if(!clean.startsWith(identities.prefix)||!/^[\x20-\x7e]{1,200}$/u.test(clean))throw new Error('The backup folder name is invalid.');
      const taken=await childNames(folder);
      for(let index=1;index<100;index++){const name=index===1?clean:`${clean} (${index})`;if(!taken.has(name))return name;}
      throw new Error('No free name was found for the backup folder.');
    }
    // A new folder must then be listed in the chosen folder under its name.
    async function makeChild(name:string){
      const folder=chosenFolder(),made=await bounded(folder.getDirectoryHandle(name,{create:true}),`Device Folder ${name}`);
      if(!(await childNames(folder)).has(name))throw new Error('This folder cannot hold a backup folder of that name. Choose another folder.');
      return made;
    }
    async function create(base:string){
      const name=await freeName(base),root=await makeChild(name);
      await writeFile(root,SCOPE_FILE,markerBlob(randomId()));
      return name;
    }
    // This device takes over another repository folder (after a browser data
    // clear, the same backups under a new device id): it keeps its identity.
    async function claim(name:string){
      const root=await childDirectory(chosenFolder(),String(name||''));if(!root)throw Object.assign(new Error('That backup folder is no longer there.'),{code:'DEVICE_FOLDER_MISSING'});
      const marker=await readMarker(root);if(!marker)throw new Error('That folder does not hold Study Director backups.');
      await writeFile(root,SCOPE_FILE,markerBlob(marker.id));
      summaryCache.clear();digestCache.clear();
      return String(name);
    }
    return freeze({
      layout:freeze({inspect,create,claim}),
      list,upload,download,delete:remove,scope,beginOperation,historyReadConcurrency:8,
      beginPublication:()=>beginLock('publication'),listPublications:()=>listLocks('publication'),assertPublication:(lease:LockLease)=>assertLock('publication',lease),endPublication:(lease:LockLease)=>endLock('publication',lease),
      beginMaintenance:()=>beginLock('maintenance'),listMaintenances:()=>listLocks('maintenance'),assertMaintenance:(lease:LockLease)=>assertLock('maintenance',lease),renewMaintenance:(lease:LockLease)=>renewLock('maintenance',lease),endMaintenance:(lease:LockLease)=>endLock('maintenance',lease)
    });
  }
  return freeze({format:'study-director.device-folder-storage-module',contractVersion:1,createStorage});
};
registry.define('device-folder-storage',1,createModule);
return createModule;
})();
export type DeviceFolderStorageModule=ReturnType<typeof sdDeviceFolderStorageFactory>;
