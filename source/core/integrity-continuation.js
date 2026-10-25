(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
registry.define('integrity-continuation',1,()=>{
  const freeze=Object.freeze,CHUNK=1024*1024;
  function normalize(value){
    if(!value||value.version!==1||!/^obj_[a-f0-9]{32}$/u.test(value.objectId)||!/^[a-f0-9]{64}$/u.test(value.storedChecksum)||!Number.isSafeInteger(value.storedBytes)||value.storedBytes<1||!['stored','plain','verified'].includes(value.phase))return null;
    const part=(row,required)=>{
      if(!row)return required?null:freeze({name:'',offset:0,hash:null,frame:0});
      const hash=row.hash,validHash=hash&&hash.version===1&&Number.isSafeInteger(hash.length)&&hash.length===row.offset&&Array.isArray(hash.state)&&hash.state.length===8&&hash.state.every(v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff)&&Array.isArray(hash.tail)&&hash.tail.length===hash.length%64&&hash.tail.every(v=>Number.isInteger(v)&&v>=0&&v<=255);
      if(typeof row.name!=='string'||row.name&&!/^backup-[a-f0-9-]{36}$/u.test(row.name)||required&&!row.name||!Number.isSafeInteger(row.offset)||row.offset<0||row.offset>value.storedBytes||row.offset&&!validHash||!Number.isSafeInteger(row.frame)||row.frame<0)return null;
      return freeze({name:row.name,offset:row.offset,hash:validHash?freeze({version:1,length:hash.length,state:freeze([...hash.state]),tail:freeze([...hash.tail])}):null,frame:row.frame});
    };
    const stored=part(value.stored,true),plain=part(value.plain,false);if(!stored||!plain||value.phase==='stored'&&stored.offset>=value.storedBytes||value.phase!=='stored'&&stored.offset!==value.storedBytes||plain.hash&&plain.frame!==Math.ceil(plain.offset/CHUNK)+(value.phase==='verified'?1:0))return null;
    return freeze({version:1,objectId:value.objectId,storedChecksum:value.storedChecksum,storedBytes:value.storedBytes,phase:value.phase,sourceVersion:typeof value.sourceVersion==='string'?value.sourceVersion.slice(0,160):'',stored,plain});
  }
  function create({files,processing,protection,yieldTask=async()=>{},maxSegments=32}){
    registry.contracts.declaredFunctions(files,['stage','resume','release'],'Integrity files');registry.contracts.declaredFunctions(processing,['run','scope'],'Integrity processing');registry.contracts.declaredFunctions(protection,['verifyFrame','unprotect'],'Integrity protection');
    maxSegments=Math.max(1,Math.min(64,Math.floor(Number(maxSegments)||32)));
    async function verify({entry,manifest,readRange,checkpoint=null,onCheckpoint,signal}){
      let state=normalize(checkpoint),stored=null,plain=null,handedOff=false;
      const check=()=>{if(signal?.aborted)throw signal.reason instanceof Error?signal.reason:Object.assign(new Error('Integrity verification yielded.'),{name:'AbortError'});};
      const save=async()=>{state=normalize(state);if(!state)throw new Error('Integrity continuation state is invalid.');await onCheckpoint(state);};
      const reset=async()=>{state=null;await onCheckpoint(null);};
      try{
        check();if(state&&(state.objectId!==entry.objectId||state.storedChecksum!==entry.storedChecksum||state.storedBytes!==entry.storedBytes))await reset();
        if(state){try{stored=await files.resume(state.stored.name);if(state.plain.name)plain=await files.resume(state.plain.name);}catch(error){await reset();throw error;}}
        else{stored=await files.stage();state={version:1,objectId:entry.objectId,storedChecksum:entry.storedChecksum,storedBytes:entry.storedBytes,phase:'stored',sourceVersion:'',stored:{name:stored.name,offset:0,hash:null,frame:0},plain:{name:'',offset:0,hash:null,frame:0}};await save();}
        let units=0;
        while(state.phase==='stored'&&units++<maxSegments){
          check();const offset=state.stored.offset,length=Math.min(CHUNK,entry.storedBytes-offset),part=await readRange(entry,{offset,length,signal});check();
          if(!part||!(part.blob instanceof Blob)||part.blob.size!==length||part.totalBytes!==entry.storedBytes||typeof part.version!=='string'||!part.version||part.version.length>160)throw new Error('The repository range could not be verified.');
          if(state.sourceVersion&&state.sourceVersion!==part.version){await reset();throw Object.assign(new Error('The repository object changed during verification. Verification will restart.'),{code:'REPOSITORY_OBJECT_CHANGED'});}
          const result=await processing.run('integrity.append',{chunk:part.blob,offset,hash:state.stored.hash,output:{kind:'opfs',name:stored.name,directory:stored.directory}},{signal});
          state={...state,sourceVersion:part.version,stored:{...state.stored,offset:result.offset,hash:result.hash}};
          if(result.offset===entry.storedBytes){if(result.checksum!==entry.storedChecksum)throw Object.assign(new Error('Repository object failed stored-byte verification.'),{code:'REPOSITORY_INTEGRITY_CORRUPT'});state.phase=manifest.encrypted?'plain':'verified';}
          await save();await yieldTask();
        }
        if(state.phase==='stored')return freeze({complete:false,checkpoint:state});
        const storedFile=await stored.handle.getFile();check();if(storedFile.size!==entry.storedBytes){await reset();throw new Error('Integrity scratch file is incomplete. Verification will restart.');}
        async function proveStaging(offset,length){
          const end=offset+length;
          while(offset<end){
            check();const count=Math.min(CHUNK,end-offset),part=await readRange(entry,{offset,length:count,signal});check();
            if(!part||!(part.blob instanceof Blob)||part.blob.size!==count||part.totalBytes!==entry.storedBytes||typeof part.version!=='string'||!part.version)throw new Error('The current repository object is unavailable.');
            if(part.version!==state.sourceVersion){await reset();throw Object.assign(new Error('The repository object changed during verification. Verification will restart.'),{code:'REPOSITORY_OBJECT_CHANGED'});}
            const current=new Uint8Array(await part.blob.arrayBuffer()),staged=new Uint8Array(await storedFile.slice(offset,offset+count).arrayBuffer());
            if(current.length!==staged.length||current.some((byte,index)=>byte!==staged[index])){await reset();throw new Error('Local verification staging is damaged. Object verification will restart.');}
            offset+=count;
          }
        }
        // A locked or interrupted plaintext pass may resume days later. Bind
        // it to the current source version before trusting cached ciphertext.
        await proveStaging(0,Math.min(64,entry.storedBytes));
        const info=await processing.run('crypto.info',{file:storedFile},{signal});
        if(!!manifest.encrypted!==!!info)throw Object.assign(new Error('Repository object protection does not match its checkpoint.'),{code:'REPOSITORY_INTEGRITY_CORRUPT'});
        if(state.phase==='plain'){
          if(entry.kind!=='attachment'&&!plain){plain=await files.stage();state={...state,plain:{...state.plain,name:plain.name}};await save();}
          while(state.phase==='plain'&&units++<maxSegments){
            check();let result;
            try{result=await protection.verifyFrame({file:storedFile,hash:state.plain.hash,frame:state.plain.frame,output:plain?{kind:'opfs',name:plain.name,directory:plain.directory}:null},{signal});}
            catch(error){
              if(error?.code==='BACKUP_AUTH_FAILED'){
                // Distinguish a wrong key from local staging damage with at
                // most two source ranges, rather than restarting a huge hash.
                const offset=64+state.plain.offset+state.plain.frame*16;
                await proveStaging(offset,Math.min(CHUNK,info.size-state.plain.offset)+16);
              }
              throw error;
            }
            state={...state,plain:{...state.plain,offset:result.offset,hash:result.hash,frame:result.frame},phase:result.complete?'verified':'plain'};
            if(result.complete&&entry.kind==='attachment'&&(result.size!==entry.sourceBytes||result.checksum!==entry.fingerprint))throw Object.assign(new Error('Repository attachment failed plaintext verification.'),{code:'REPOSITORY_INTEGRITY_CORRUPT'});
            await save();await yieldTask();
          }
          if(state.phase==='plain')return freeze({complete:false,checkpoint:state});
        }
        if(entry.kind==='attachment'){
          if(!manifest.encrypted&&(entry.storedBytes!==entry.sourceBytes||entry.storedChecksum!==entry.fingerprint))throw Object.assign(new Error('Repository attachment plaintext metadata is inconsistent.'),{code:'REPOSITORY_INTEGRITY_CORRUPT'});
          return freeze({complete:true});
        }
        // Semantic failures must concern repository data, not a damaged local
        // staging file. Check the stored staging copy before handing it over.
        if(await processing.run('checksum',{value:storedFile},{signal})!==entry.storedChecksum){await reset();throw new Error('Integrity scratch verification failed. The repository will be read again.');}
        const blob=await (plain||stored).handle.getFile();
        if(plain&&await processing.run('checksum',{value:blob},{signal})!==await processing.run('integrity.digest',{hash:state.plain.hash},{signal})){await reset();throw new Error('Decrypted integrity scratch verification failed. Verification will restart.');}
        handedOff=true;
        return freeze({complete:true,opened:freeze({blob,release:async()=>{await files.release(stored.name);if(plain)await files.release(plain.name);}})});
      }finally{if(!handedOff){if(stored)await files.release(stored.name);if(plain)await files.release(plain.name);}}
    }
    return freeze({verify:options=>processing.scope(()=>verify(options))});
  }
  return freeze({format:'study-director.integrity-continuation-module',contractVersion:1,normalize,create});
});
})();
