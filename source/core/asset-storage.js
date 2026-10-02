(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
registry.define('asset-storage',1,()=>{
  const freeze=Object.freeze;
  function createLease(ttlMs=10000,now=()=>Date.now()){
    const protectedUntil=new Map();
    function purge(){const stamp=Number(now())||0;for(const [id,until] of protectedUntil)if(until<=stamp)protectedUntil.delete(id);return stamp;}
    return freeze({
      protect(id){const key=String(id||'');protectedUntil.set(key,purge()+Math.max(1000,Number(ttlMs)||10000));return key;},
      release(id){return protectedUntil.delete(String(id||''));},
      isProtected(id){const stamp=purge(),until=protectedUntil.get(String(id||''))||0;return until>stamp;}
    });
  }
  function create(ports){
    const {read,keys,commit,validId,validType,maxBytes,storage,locks,issueToken,assertToken,canMutate,ingest}=ports;
    const writeLock=ports.name+':attachment-metadata.v2',retainLock=ports.name+':attachment-retention.v2',DIRECTORY='@@SD_ATTACHMENT_OPFS_DIRECTORY@@',LEGACY_DIRECTORY='@@SD_LEGACY_ATTACHMENT_OPFS_DIRECTORY@@';
    const supported=()=>ports.protocol!=='file:'&&typeof storage?.getDirectory==='function'&&typeof locks?.request==='function'&&typeof ingest?.ingest==='function';
    function available(){if(!supported()){const error=new Error(ports.protocol==='file:'?'Attachments cannot be stored when index.html is opened directly. Close this copy and use Start-Study-Director from the deployment folder, or open the hosted app.':'Attachment storage is unavailable. Use a supported browser with site storage enabled.');error.name='NotSupportedError';throw error;}}
    const id=value=>{if(typeof value!=='string'||!validId(value))throw new TypeError('Invalid attachment identity.');return value;};
    const limit=type=>ports.limitForType?ports.limitForType(type):maxBytes;
    const cleanName=value=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,160);
    const opaqueFile=value=>typeof value==='string'&&/^attblob-[a-f0-9-]{20,80}$/i.test(value);
    const locked=work=>{available();return locks.request(writeLock,work);};
    const legacyMetadata=value=>value instanceof Blob||!!value&&value.version===1;
    let legacyCleanupResult=null;
    function metadata(value){
      if(!value||value.version!==2||value.storage!=='opfs'||!opaqueFile(value.file)||typeof value.hash!=='string'||! /^[a-f0-9]{64}$/.test(value.hash)||!Number.isSafeInteger(value.size)||value.size<=0||value.size>limit(value.type)||!validType(value.type)||typeof value.library!=='boolean'||typeof value.name!=='string'||value.name.length>160||/[\u0000-\u001f\u007f]/.test(value.name))throw new Error('Attachment metadata is invalid.');
      return {version:2,storage:'opfs',file:value.file,hash:value.hash,size:value.size,type:value.type,name:value.name,library:value.library};
    }
    async function directory(){try{return await (await storage.getDirectory()).getDirectoryHandle(DIRECTORY,{create:true});}catch(error){if(['SecurityError','NotAllowedError','UnknownError'].includes(error.name))throw new Error('Attachment storage could not be opened. Open Study Director through its local launcher or hosted address, and allow site storage in your browser.',{cause:error});throw error;}}
    async function file(dir,name){try{return await (await dir.getFileHandle(name)).getFile();}catch(error){if(error.name==='NotFoundError')return null;throw error;}}
    async function allEntries(){return ports.entries?await ports.entries():Promise.all((await keys()).map(async key=>[key,await read(key)]));}
    async function verifyLegacyClean(){
      if(!supported())return Object.freeze({ok:false,status:'unverified',reason:'storage-unavailable',legacyMetadata:0,legacyDirectory:null});
      return locked(async()=>{
        let legacyMetadataCount=0;
        for(const [,row] of await allEntries())if(legacyMetadata(row))legacyMetadataCount++;
        let legacyDirectory=false;
        try{await (await storage.getDirectory()).getDirectoryHandle(LEGACY_DIRECTORY);legacyDirectory=true;}
        catch(error){if(error?.name!=='NotFoundError')throw error;}
        return Object.freeze({ok:legacyMetadataCount===0&&!legacyDirectory,status:'verified',legacyMetadata:legacyMetadataCount,legacyDirectory});
      });
    }
    async function cleanupLegacy(){
      if(legacyCleanupResult)return {status:'completed',removed:0,directoryRemoved:false};
      if(!supported())return {status:'skipped',reason:'storage-unavailable',removed:0,directoryRemoved:false};
      let token;try{token=issueToken({allowHydrating:true});}catch{return {status:'skipped',reason:'not-primary',removed:0,directoryRemoved:false};}
      return locked(async()=>{
        assertToken(token);
        const remove=[];for(const [key,row] of await allEntries()){assertToken(token);if(legacyMetadata(row)){id(key);remove.push(key);}}
        assertToken(token);if(remove.length)await commit([],remove,token);
        assertToken(token);
        let directoryRemoved=false;
        try{await (await storage.getDirectory()).removeEntry(LEGACY_DIRECTORY,{recursive:true});directoryRemoved=true;}catch(error){if(error?.name!=='NotFoundError')directoryRemoved=false;}
        assertToken(token);
        legacyCleanupResult=Object.freeze({status:'completed',removed:remove.length,directoryRemoved});return legacyCleanupResult;
      });
    }
    async function list(){const result=[];for(const [key,row] of await allEntries()){if(row==null)continue;id(key);if(legacyMetadata(row))throw new Error(`Attachment ${key} uses historical metadata and must be migrated before normal runtime access.`);result.push({id:key,...metadata(row)});}return result;}
    async function storedFiles(){return new Set((await list()).map(row=>row.file));}
    async function get(assetId){const key=id(assetId);available();return during(async()=>{const value=await read(key);if(value==null)return null;if(legacyMetadata(value))throw new Error(`Attachment ${key} uses historical metadata and must be migrated before normal runtime access.`);const row=metadata(value),blob=await file(await directory(),row.file);if(!blob||blob.size!==row.size)throw new Error('Attachment file is missing or incomplete. Restore it from a backup.');return blob.slice(0,blob.size,row.type);});}
    async function shallowAudit(referenceIds=[],options={}){
      available();
      const references=new Set((referenceIds||[]).map(value=>String(value||'')).filter(validId));
      const shouldYield=typeof options.shouldYield==='function'?options.shouldYield:()=>false,yieldTask=typeof options.yieldTask==='function'?options.yieldTask:async()=>{},check=typeof options.check==='function'?options.check:()=>{};
      const now=typeof options.now==='function'?options.now:Date.now,started=now(),maxEntries=Math.max(1,Number(options.maxEntries)||128),workMs=Math.max(1,Number(options.workMs)||5000);
      return during(async()=>{
        check();const entries=(await allEntries()).filter(([,value])=>value!=null).sort(([a],[b])=>String(a).localeCompare(String(b)));
        const identity=JSON.stringify([entries,[...references].sort()]),scanId=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity))),v=>v.toString(16).padStart(2,'0')).join('');
        const prior=options.progress?.scanId===scanId?options.progress:null;
        let cursor=Number.isSafeInteger(prior?.cursor)?prior.cursor:0,checked=Number(prior?.checked)||0,visited=0;
        const known=new Set(entries.map(([key])=>String(key))),missing=[...references].filter(key=>!known.has(key)).sort(),total=entries.length+missing.length;
        if(cursor<0||cursor>total)cursor=0;
        const issues=cursor&&Array.isArray(prior?.issues)?[...prior.issues]:[];
        const issue=row=>issues.push(Object.freeze(row));let dir=null;
        try{for(;cursor<total;cursor++){
          check();if(visited>=maxEntries||now()-started>=workMs)break;visited++;
          if(cursor>=entries.length)issue({id:missing[cursor-entries.length],kind:'missing-metadata'});
          else{
            const [rawKey,value]=entries[cursor],key=String(rawKey||'');let row;
            try{id(key);if(legacyMetadata(value))throw new Error('legacy metadata');row={id:key,...metadata(value)};}catch{issue({id:key,kind:'metadata-invalid'});}
            if(shouldYield())await yieldTask();
            if(row&&(row.library||references.has(key))){
              check();if(!dir)dir=await directory();const blob=await file(dir,row.file);check();
              if(!blob)issue({id:key,kind:'missing-file'});else if(blob.size!==row.size)issue({id:key,kind:'size-mismatch',expectedSize:row.size,actualSize:blob.size});checked++;
            }
          }
          if(shouldYield())await yieldTask();
        }
        }catch(error){error.attachmentAuditProgress={scanId,cursor,checked,total,issues};throw error;}
        check();const complete=cursor>=total;
        return Object.freeze({status:complete?'completed':'yielded',complete,checked,references:references.size,issues:Object.freeze(issues),progress:complete?null:Object.freeze({scanId,cursor,checked,total,issues:Object.freeze(issues)})});
      });
    }
    // Published files may still back File/Blob readers after metadata is repointed.
    // Leave obsolete bytes for collect().sweep(), which holds exclusive retention
    // before the metadata lock. Never wait for that lock from a publisher.
    async function put(assetId,blob,options={}){
      const key=id(assetId);available();
      if(!(blob instanceof Blob)||!Number.isSafeInteger(blob.size)||blob.size<=0||blob.size>limit(blob.type)||!validType(blob.type))throw new TypeError('Attachment file exceeds the supported file limits or type.');
      const token=options.token||issueToken(),check=()=>{assertToken(token);if(options.signal?.aborted)throw Object.assign(new Error('Attachment operation cancelled.'),{name:'AbortError'});options.check?.();};
      check();const result=await ingest.ingest(blob,{signal:options.signal,onProgress:options.onProgress});let keepResult=false;
      try{
        const staged=await locked(async()=>{
          check();const previousValue=await read(key),previous=previousValue==null?null:metadata(previousValue);
          if(previous&&(previous.hash!==result.hash||previous.type!==blob.type||previous.size!==blob.size))throw new Error('Attachment identity already belongs to different content.');
          const next={version:2,storage:'opfs',file:result.storageName,hash:result.hash,size:blob.size,type:blob.type,name:previous?.name||cleanName(options.name),library:previous?.library===true||options.library===true};
          if(options.stage){keepResult=true;return next;}
          const upserts=new Map();
          for(const [rowId,value] of await allEntries()){
            if(value==null)continue;if(legacyMetadata(value))throw new Error(`Attachment ${rowId} uses historical metadata and must be migrated before normal runtime access.`);
            const row=metadata(value);
            if(row.hash===next.hash&&row.size===next.size&&row.file!==next.file){upserts.set(rowId,{...row,file:next.file});}
          }
          upserts.set(key,metadata(next));
          check();assertToken(token);await commit([...upserts],[],token,()=>{check();return true;});keepResult=true;
          return next;
        });
        return staged;
      }catch(error){if(!keepResult)await ingest.remove(result.storageName).catch(()=>{});throw error;}
    }
    async function retain(){if(!supported())return ()=>{};return new Promise((resolve,reject)=>{locks.request(retainLock,{mode:'shared'},()=>new Promise(release=>{let done=false;resolve(()=>{if(done)return;done=true;release();ports.onReleased?.();});})).catch(reject);});}
    async function during(work){const release=await retain();try{return await work();}finally{release();}}
    let sweepIterator=null,sweepEntry=null,sweepPending=false;
    async function collect(scan,options={}){
      const check=()=>options.check?.(),maxEntries=Math.max(1,Number(options.maxEntries)||128);
      if(!supported())return {status:'skipped',reason:'storage-unavailable',removed:0};
      return locks.request(retainLock,{ifAvailable:true},async lock=>{
        if(!lock)return {status:'skipped',reason:'active-editor-or-file-operation',removed:0};
        check();return locked(async()=>{
          check();if(!canMutate())return {status:'skipped',reason:'not-primary',removed:0};
          const token=issueToken();
          const removeMany=async(ids,guard=()=>true,allowLibrary=false)=>{const remove=[];for(const key of ids){check();id(key);const row=await read(key);check();if(row&&metadata(row).library&&!allowLibrary)continue;if(row)remove.push(key);}assertToken(token);if(remove.length){if(!guard())throw new Error('Attachment references changed during cleanup.');await commit([],remove,token,guard);}return remove.length;};
          const sweep=async()=>{
            check();const retained=await storedFiles(),dir=await directory();check();let removed=0,visited=0;
            if(!sweepIterator)sweepIterator=dir.entries()[Symbol.asyncIterator]();sweepPending=true;
            try{while(visited<maxEntries){
              check();if(!sweepEntry)sweepEntry=await sweepIterator.next();check();if(sweepEntry.done){sweepIterator=null;sweepEntry=null;sweepPending=false;break;}visited++;
              const [name,entry]=sweepEntry.value;
              if(entry.kind==='file'&&opaqueFile(name)&&!retained.has(name)){assertToken(token);check();await dir.removeEntry(name);removed++;}
              sweepEntry=null;if(visited%16===0)await options.yieldTask?.();
            }}catch(error){if(error?.code!=='ASSET_MAINTENANCE_YIELDED'){sweepIterator=null;sweepEntry=null;}throw error;}return removed;
          };
          const collectibleKeys=async()=>{const pinned=new Set((await list()).filter(row=>row.library).map(row=>row.id));return(await keys()).filter(key=>!pinned.has(key));};
          return scan(Object.freeze({keys:collectibleKeys,removeMany,sweep,status:()=>Object.freeze({sweepPending})}));
        });
      });
    }
    // Explicit user deletion commits logical identities while readers retain bytes.
    // Physical reclamation remains exclusively in collect().sweep().
    async function removeMetadata(ids,guard=()=>true,options={}){return locked(async()=>{
      if(!canMutate())throw new Error('Take control before deleting attachments.');
      const token=issueToken(),remove=[...new Set(ids.map(id))];
      assertToken(token);if(!guard())throw new Error('Attachment references changed during deletion.');
      const present=[];for(const key of remove)if(await read(key))present.push(key);
      assertToken(token);if(present.length)await commit([],present,token,guard,options.deletionState||null);return present.length;
    });}
    async function rename(key,name){id(key);const token=issueToken();return locked(async()=>{const row=metadata(await read(key));assertToken(token);const updated={...row,name:cleanName(name)};await commit([[key,updated]],[],token);return updated;});}
    async function setLibrary(key,value){id(key);const token=issueToken();return locked(async()=>{const row=metadata(await read(key)),next=!!value;if(row.library===next)return row;assertToken(token);const updated={...row,library:next};await commit([[key,updated]],[],token);return updated;});}
    async function verifiedMetadataRows(rows,options={}){
      if(!Array.isArray(rows))throw new TypeError('Attachment metadata verification input is invalid.');
      const incoming=[],seen=new Set(),verifiedPhysical=new Set();
      for(const value of rows){const key=id(value?.id);if(seen.has(key))throw new Error('Duplicate attachment identity in rollback metadata.');seen.add(key);const row=metadata(value),physicalKey=row.file+'\u0000'+row.hash+'\u0000'+row.size;if(!verifiedPhysical.has(physicalKey)){if(!await ingest.verify(row.file,row.hash,row.size,options))throw new Error('Attachment rollback content is missing or failed verification. Preserve browser storage and restore from an external backup before making changes.');verifiedPhysical.add(physicalKey);}incoming.push([key,row]);}
      return incoming;
    }
    async function verifyMetadata(rows,options={}){available();return (await verifiedMetadataRows(rows,options)).length;}
    async function restoreMetadata(rows,options={}){const token=issueToken(),incoming=await verifiedMetadataRows(rows,options);return locked(async()=>{assertToken(token);if(incoming.length)await commit(incoming,[],token,()=>true,options.deletionState||null);return incoming.length;});}
    async function publish(rows,token,check=()=>{},options={}){
      const incoming=[],seen=new Set(),dir=await directory();
      for(const [key,value] of rows){id(key);if(seen.has(key))throw new Error('Duplicate attachment identity.');seen.add(key);const row=metadata(value),blob=await file(dir,row.file);if(!blob||blob.size!==row.size)throw new Error('Attachment file is missing or incomplete.');incoming.push([key,row]);}
      return locked(async()=>{
        const canonical=new Map(),upserts=new Map();
        for(const [,row] of incoming){const group=row.hash+':'+row.size;if(!canonical.has(group))canonical.set(group,row.file);}
        for(const [rowId,value] of await allEntries()){
          if(value==null)continue;if(legacyMetadata(value))throw new Error(`Attachment ${rowId} uses historical metadata and must be migrated before normal runtime access.`);
          const row=metadata(value),fileName=canonical.get(row.hash+':'+row.size);
          if(fileName&&row.file!==fileName){upserts.set(rowId,{...row,file:fileName});}
        }
        for(const [key,row] of incoming){
          const previous=await read(key),old=previous?metadata(previous):null;
          if(old&&(old.hash!==row.hash||old.type!==row.type||old.size!==row.size))throw new Error('Attachment identity conflicts with an existing file.');
          const fileName=canonical.get(row.hash+':'+row.size),proposed={...row,file:fileName};
          upserts.set(key,old&&!options.restoreLabels?{...proposed,name:old.name,library:old.library||proposed.library}:proposed);
        }
        const removed=options.replaceAll?(await keys()).filter(key=>!seen.has(key)):[];
        for(const key of removed)upserts.delete(key);
        check();assertToken(token);await commit([...upserts],removed,token,()=>{check();return true;},options.deletionState||null);
        return incoming.length;
      });
    }
    async function discard(rows){
      if(!Array.isArray(rows)||!rows.length)return 0;
      return locked(async()=>{const retained=await storedFiles();let removed=0;
        for(const value of rows){let row;try{row=metadata(value);}catch{continue;}if(!retained.has(row.file)){await ingest.remove(row.file);removed++;}}
        return removed;
      });
    }
    return Object.freeze({get,put,keys,retain,during,collect,shallowAudit,removeMetadata,supported,requireAvailable:available,list,rename,setLibrary,publish,discard,verifyMetadata,restoreMetadata,cleanupLegacy,verifyLegacyClean});
  }
  return freeze({format:'study-director.asset-storage',contractVersion:3,createLease,create});
});
})();
