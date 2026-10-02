(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
registry.define('exports',1,input=>{
  registry.contracts.exactFrozenObject(input,['lifecycle'],'exports module input');
  const Lifecycle=input.lifecycle;
  if(!Object.isFrozen(Lifecycle)||Lifecycle.format!=='study-director.operation-lifecycle'||Lifecycle.contractVersion!==1)throw new TypeError('Operation lifecycle contract is unavailable or incompatible.');
  // Temporary L7 SDENC01 reader. Current writes remain SDENC02 in the portable worker.
  const LEGACY_ENCRYPTION_MAGIC=new TextEncoder().encode('SDENC01\n'),LEGACY_ENCRYPTION_HEADER=48,LEGACY_ENCRYPTION_TAG=16,LEGACY_ENCRYPTION_ITERATIONS=600000,LEGACY_ENCRYPTION_MAX=32*1024*1024;
  const legacyEncryptionError=(message,code='BACKUP_ENCRYPTION_INVALID')=>Object.assign(new Error(message),{code});
  async function legacyEncryptionInfo(file){
    if(!(file instanceof Blob))throw legacyEncryptionError('A backup file is required.');
    const header=new Uint8Array(await file.slice(0,LEGACY_ENCRYPTION_HEADER).arrayBuffer());
    if(!LEGACY_ENCRYPTION_MAGIC.every((byte,index)=>header[index]===byte))return null;
    if(header.length!==LEGACY_ENCRYPTION_HEADER)throw legacyEncryptionError('Encrypted backup header is truncated.');
    const view=new DataView(header.buffer),size=view.getUint32(44,false);
    if(header[8]!==1||header[9]!==1||header[10]!==1||header[11]!==0||view.getUint32(12,false)!==LEGACY_ENCRYPTION_ITERATIONS)throw legacyEncryptionError('Encrypted backup version or cryptographic parameters are unsupported.');
    if(size<1||size>LEGACY_ENCRYPTION_MAX)throw legacyEncryptionError('Encrypted backups are limited to 32 MiB before encryption.','BACKUP_ENCRYPTION_LIMIT');
    if(file.size!==LEGACY_ENCRYPTION_HEADER+size+LEGACY_ENCRYPTION_TAG)throw legacyEncryptionError('Encrypted backup is truncated or has unexpected trailing data.');
    return Object.freeze({version:1,header,size});
  }
  async function legacyDecryptBackup(file,key){
    const info=await legacyEncryptionInfo(file);if(!info)throw legacyEncryptionError('This is not an encrypted Study Director backup.');
    if(!key||key.type!=='secret'||key.algorithm?.name!=='PBKDF2'||key.extractable)throw legacyEncryptionError('Unlock backup protection first.','BACKUP_LOCKED');
    const aes=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:info.header.slice(16,32),iterations:LEGACY_ENCRYPTION_ITERATIONS},key,{name:'AES-GCM',length:256},false,['decrypt']);
    const bytes=await file.slice(LEGACY_ENCRYPTION_HEADER).arrayBuffer();let plain;
    try{plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:info.header.slice(32,44),additionalData:info.header,tagLength:128},aes,bytes));}
    catch(error){if(error.name!=='OperationError')throw error;throw legacyEncryptionError('The password is incorrect or the encrypted backup is damaged.','BACKUP_AUTH_FAILED');}
    try{return new Blob([plain],{type:'application/octet-stream'});}finally{plain.fill(0);}
  }
  function cancelled(){const error=new Error('File operation cancelled.');error.name='AbortError';error.code='STUDY_DIRECTOR_IMPORT_CANCELLED';return error;}
  // OPFS scratch/journal files have opaque names and shared reader leases.
  // Durable references are metadata records; orphan collection is lock guarded.
  function createFileStore({storage,locks,retained=async()=>[],setTimeout:schedule=setTimeout,clearTimeout:clear=clearTimeout,now=Date.now,workMs=5000,maxEntries=128,onError=()=>{}}){
    const ROOT='@@SD_BACKUP_FILES_OPFS_DIRECTORY@@',held=new Map(),objects=new WeakMap();
    const valid=name=>typeof name==='string'&&/^backup-[a-f0-9-]{36}$/.test(name);
    const directory=async()=>{if(!storage?.getDirectory||!locks?.request)throw new Error('Complete backups require browser file storage. Open the hosted app in a supported browser.');return (await storage.getDirectory()).getDirectoryHandle(ROOT,{create:true});};
    async function lease(name){
      if(!valid(name))throw new Error('Invalid backup storage identity.');
      const unlock=await new Promise((resolve,reject)=>{locks.request(ROOT+':'+name,{mode:'shared'},()=>new Promise(done=>resolve(done))).catch(reject);});
      const token={name,unlock,active:true,pinCount:0,releaseRequested:false};let tokens=held.get(name);if(!tokens)held.set(name,tokens=new Set());tokens.add(token);return token;
    }
    let collection=null,collectionTimer=null,collectionDue=0,iterator=null,candidate=null,cycleBlocked=false,suspended=0,collectionPending=false,lastCollectionResult=null;
    function scheduleCollection(delay=1000){
      collectionPending=true;const due=Number(now())+delay;if(suspended)return;
      if(collectionTimer!==null&&collectionDue<=due)return;if(collectionTimer!==null)clear(collectionTimer);collectionDue=due;
      collectionTimer=schedule(()=>{collectionTimer=null;void collect().catch(onError);},delay);
    }
    function suspend(){suspended++;let released=false;return ()=>{if(released)return;released=true;suspended=Math.max(0,suspended-1);if(!suspended&&collectionPending)scheduleCollection();};}
    async function collect({signal=null}={}){
      if(collection)return collection;if(collectionTimer!==null){clear(collectionTimer);collectionTimer=null;}collectionPending=true;
      if(suspended)return lastCollectionResult=Object.freeze({status:'yielded',reason:'foreground-busy',removed:0});
      const started=Number(now());let removed=0,visited=0,blocked=false;
      const check=()=>{if(signal?.aborted||suspended||Number(now())-started>=workMs)throw Object.assign(new Error('Backup scratch collection yielded.'),{code:'BACKUP_GC_YIELDED'});};
      collection=Promise.resolve().then(async()=>{
        check();const dir=await directory();check();if(!iterator)iterator=dir.entries()[Symbol.asyncIterator]();
        while(visited<maxEntries){
          check();if(!candidate)candidate=await iterator.next();check();if(candidate.done){iterator=null;candidate=null;blocked=cycleBlocked;cycleBlocked=false;collectionPending=blocked;return Object.freeze({status:blocked?'yielded':'completed',reason:blocked?'reader-locked':'',removed,visited});}
          visited++;const [name,entry]=candidate.value;if(entry.kind!=='file'||!valid(name)||held.has(name)){candidate=null;continue;}
          await locks.request(ROOT+':'+name,{ifAvailable:true},async lock=>{
            check();if(!lock){cycleBlocked=true;return;}const keep=new Set(await retained());check();
            if(!keep.has(name)){await dir.removeEntry(name).catch(error=>{if(error.name!=='NotFoundError')throw error;});removed++;}
          });
          candidate=null;if(visited%16===0)await new Promise(resolve=>schedule(resolve,0));
        }
        return Object.freeze({status:'yielded',reason:'budget',removed,visited});
      }).catch(error=>{if(error?.code==='BACKUP_GC_YIELDED')return Object.freeze({status:'yielded',reason:'preempted-or-budget',removed,visited});iterator=null;candidate=null;cycleBlocked=false;throw error;}).then(result=>{
        lastCollectionResult=result;collection=null;if(result.status==='yielded')scheduleCollection(result.reason==='reader-locked'?5*60*1000:2000);return result;
      },error=>{lastCollectionResult={status:'failed',reason:String(error?.code||error?.name||'Error')};collection=null;collectionPending=true;scheduleCollection(30*60*1000);throw error;});return collection;
    }
    async function finishRelease(token){
      if(!token?.active)return;token.active=false;token.unlock();
      const tokens=held.get(token.name);tokens?.delete(token);if(!tokens?.size)held.delete(token.name);
      scheduleCollection();
    }
    async function releaseToken(token){
      if(!token?.active)return;token.releaseRequested=true;if(token.pinCount>0)return;await finishRelease(token);
    }
    const producers=new Map();
    async function stage(){const name='backup-'+crypto.randomUUID(),token=await lease(name);producers.set(name,token);try{return {name,handle:await(await directory()).getFileHandle(name,{create:true})};}catch(error){producers.delete(name);await releaseToken(token);throw error;}}
    async function resume(name){if(!valid(name))throw new Error('Integrity scratch identity is invalid.');const token=await lease(name);producers.set(name,token);try{return {name,handle:await(await directory()).getFileHandle(name)};}catch(error){producers.delete(name);await releaseToken(token);throw error;}}
    function bind(blob,name,token=producers.get(name)){if(!token)throw new Error('Backup file has no reader lease.');objects.set(blob,token);return blob;}
    async function release(blob){const token=typeof blob==='string'?producers.get(blob):objects.get(blob);if(!token)return;if(typeof blob!=='string')objects.delete(blob);if(producers.get(token.name)===token)producers.delete(token.name);await releaseToken(token);}
    async function read(ref){
      if(!ref||!valid(ref.name)||!Number.isSafeInteger(ref.size)||ref.size<=0||!/^[a-f0-9]{64}$/.test(ref.hash))throw new Error('Backup journal file reference is invalid.');
      const token=await lease(ref.name);
      try{const file=await(await(await directory()).getFileHandle(ref.name)).getFile();if(file.size!==ref.size)throw new Error('Backup journal file is missing or incomplete. Preserve browser storage.');return bind(file,ref.name,token);}
      catch(error){await releaseToken(token);throw error;}
    }
    const nameOf=blob=>objects.get(blob)?.name||null;
    function pin(blob){
      const token=objects.get(blob);if(!token?.active)return ()=>{};token.pinCount+=1;let released=false;
      return ()=>{if(released)return;released=true;token.pinCount=Math.max(0,token.pinCount-1);if(token.pinCount===0&&token.releaseRequested)void finishRelease(token);};
    }
    return Object.freeze({stage,resume,bind,read,release,nameOf,collect,pin,suspend,settled:()=>collection||Promise.resolve(),status:()=>Lifecycle.snapshot({busy:!!collection,pending:collectionPending,scheduled:collectionTimer!==null,suspended:suspended>0,reason:lastCollectionResult?.reason||'',nextEligibleAt:collectionTimer!==null?new Date(collectionDue).toISOString():'',lastResult:lastCollectionResult})});
  }
  function createCoordinator({createWorker,window,document,onState=()=>{},files=null}){
    let worker=null,leases=0,sequence=0,tail=Promise.resolve(),aborted=false,phase='',currentJob=null,fileJobActive=false,cancelEpoch=0;const pending=new Map(),fileProofs=new WeakMap(),streamAborts=new Set();
    const status=()=>Object.freeze({busy:leases>0,jobBusy:currentJob!==null,fileBusy:fileJobActive&&leases>0,pending:pending.size,phase});
    const publish=()=>onState(status());
    function stop(error=null){
      const stopped=worker;worker=null;if(stopped){stopped.onmessage=stopped.onerror=stopped.onmessageerror=null;try{stopped.terminate();}catch{}}
      for(const request of pending.values()){clearTimeout(request.timeout);request.reject(error||new Error('File processor stopped.'));}pending.clear();
    }
    function ensure(){
      if(worker)return worker;
      worker=createWorker();const current=worker;
      worker.onmessage=event=>{if(worker!==current)return;const result=event.data||{},request=pending.get(result.id);if(!request)return;if(result.progress){if(request.timeout)clearTimeout(request.timeout);request.timeout=setTimeout(()=>stop(new Error('File processing stopped making progress.')),request.stallTimeoutMs);try{request.onProgress?.(Object.freeze({...result.progress}));}catch{}const label=result.progress.phase==='decrypting'?'Unlocking backup':result.progress.phase==='encrypting'?'Encrypting backup':request.type==='file.hash'||request.type==='equalFiles'||request.type==='checksum'?'Verifying backup file':request.type==='file.copy'?'Preparing backup file':'Processing backup data';phase=label+' · '+Math.floor(result.progress.loaded/Math.max(1,result.progress.total)*100)+'%';publish();return;}pending.delete(result.id);clearTimeout(request.timeout);if(request.type.startsWith('crypto.')&&request.type!=='crypto.info')stop();if(result.error){const error=new Error(result.error.message);error.name=result.error.name||'Error';error.code=result.error.code;request.reject(error);}else request.resolve(result.value);};
      worker.onerror=event=>{if(worker!==current)return;event.preventDefault?.();stop(new Error('File processor failed. Retry the operation.'));};
      worker.onmessageerror=()=>{if(worker===current)stop(new Error('File processor returned an unreadable response.'));};
      return worker;
    }
    function check(){if(aborted)throw cancelled();}
    async function scope(operation){if(!leases){aborted=false;phase='Preparing files…';}const resumeCollection=files?.suspend?.();leases++;if(leases===1)publish();try{return await operation();}finally{leases--;resumeCollection?.();if(!leases){stop();phase='';publish();}}}
    function job(operation,{wait=false,surface='managed'}={}){
      if(currentJob){if(wait)return currentJob.catch(()=>{}).then(()=>job(operation,{wait,surface}));const error=new Error('Another file operation is in progress. Wait for it to finish.');error.code='FILE_JOB_BUSY';return Promise.reject(error);}
      // Run synchronously until the first await to preserve native picker activation.
      fileJobActive=surface==='file';const result=scope(operation);currentJob=result;
      return result.finally(()=>{if(currentJob===result){currentJob=null;fileJobActive=false;publish();}});
    }
    async function awaitCollection(signal=null){
      if(aborted)throw cancelled();
      await Lifecycle.waitForSettlement(files?.status?.().busy?[files.settled()]:[],{signal,timeoutCode:'BACKUP_GC_UNSETTLED',timeoutMessage:'Backup scratch cleanup has not stopped yet. Retry after it finishes.',cancelError:cancelled,subscribeCancel:abort=>{streamAborts.add(abort);return ()=>streamAborts.delete(abort);}});
    }
    function run(type,data,options={}){
      if(type==='file.release')return files?.release(data.file)||Promise.resolve();
      if(type==='file.collect')return files?.collect()||Promise.resolve();
      if(type==='file.read')return scope(async()=>{await awaitCollection(options.signal);const file=await files.read(data.ref);try{if(await run('file.hash',{file})!==data.ref.hash)throw new Error('Backup recovery file failed its integrity check. Preserve browser storage.');return file;}catch(error){await files.release(file);throw error;}});
      if(type==='file.persist')return scope(async()=>{
        let file=data.file,name=files.nameOf(file);
        if(!name){file=await run('file.copy',{file});name=files.nameOf(file);}
        let hash=fileProofs.get(file);if(!hash){hash=await run('file.hash',{file});fileProofs.set(file,hash);}
        return {name,size:file.size,hash};
      });
      return scope(async()=>{
        const task=async()=>{
          check();if(options.signal?.aborted)throw cancelled();await awaitCollection(options.signal);check();if(options.signal?.aborted)throw cancelled();
          const nextPhase=type==='crypto.verifier.create'?'Preparing protection…':type==='crypto.verifier.check'?'Unlocking backup…':type==='crypto.key'?'Preparing protection…':type==='decode.open'||type==='parseBlob'?'Reading backup…':type==='equalFiles'?'Verifying saved file…':type==='file.hash'?'Verifying backup file…':type==='file.copy'?'Preparing backup file…':type==='encode.open'?'Preparing backup…':type==='encode.write'?'Packaging backup data…':type==='encode.finish'?'Finishing backup file…':type==='zip'?'Packaging notes…':type==='markdown'?'Preparing notes…':phase;if(phase!==nextPhase){phase=nextPhase;publish();}
          let staged=null;if(type==='file.copy'||type.startsWith('crypto.stream.')){staged=await files.stage();data={...data,output:Object.freeze({kind:'opfs',name:staged.name}),proof:type==='file.copy'||type==='crypto.stream.encrypt'};}
          const id=++sequence;
          const abort=()=>stop(cancelled());options.signal?.addEventListener('abort',abort,{once:true});
          try{check();if(options.signal?.aborted)throw cancelled();const value=await new Promise((resolve,reject)=>{
            const progressBound=type==='file.hash'||type==='equalFiles'||(type==='checksum'&&data.value instanceof Blob),stallTimeoutMs=progressBound?30000:120000,timeout=setTimeout(()=>stop(new Error(progressBound?'File verification stopped making progress. Retry the operation.':'File processing timed out. Retry or use a smaller export.')),stallTimeoutMs);
            pending.set(id,{resolve,reject,timeout,type,stallTimeoutMs,onProgress:typeof options.onProgress==='function'?options.onProgress:null});
            try{ensure().postMessage({id,type,data});}catch(error){stop(error);}
          });
            if(!staged)return value;
            const proofed=value&&typeof value==='object'&&value.file instanceof Blob&&/^[a-f0-9]{64}$/u.test(String(value.hash||'')),file=proofed?value.file:value,bound=files.bind(file,staged.name);
            if(proofed)fileProofs.set(bound,String(value.hash));
            return bound;
          }catch(error){if(staged)await files.release(staged.name).catch(()=>{});throw error;}finally{options.signal?.removeEventListener('abort',abort);}
        };
        const result=tail.then(task);tail=result.catch(()=>{});return result;
      });
    }
    async function receiveStream(stream,size,{signal,onProgress}={}){
      return scope(async()=>{
        if(!Number.isSafeInteger(size)||size<=0||!stream?.getReader)throw new Error('Backup download requires a verified size and streaming response.');
        check();if(signal?.aborted)throw cancelled();
        await awaitCollection(signal);check();if(signal?.aborted)throw cancelled();const staged=await files.stage();let reader=null,writer=null,total=0;
        const abort=()=>{void reader?.cancel(cancelled()).catch(()=>{});};
        try{
          check();if(signal?.aborted)throw cancelled();
          reader=stream.getReader();streamAborts.add(abort);signal?.addEventListener('abort',abort,{once:true});
          writer=await staged.handle.createWritable({keepExistingData:false});
          for(;;){
            check();if(signal?.aborted)throw cancelled();
            let timer;const next=await Promise.race([reader.read(),new Promise((_,reject)=>{timer=setTimeout(()=>{abort();reject(new Error('Backup download stopped making progress.'));},120000);})]).finally(()=>clearTimeout(timer));
            if(next.done)break;total+=next.value.byteLength;if(total>size)throw new Error('Backup download exceeded its verified size.');
            await writer.write(next.value);const progress=Object.freeze({phase:'downloading',loaded:total,total:size});try{onProgress?.(progress);}catch{}phase='Downloading backup · '+Math.floor(total/size*100)+'%';publish();
          }
          check();if(signal?.aborted)throw cancelled();if(total!==size)throw new Error('Backup download was truncated.');
          await writer.close();writer=null;const file=await staged.handle.getFile();check();if(signal?.aborted)throw cancelled();return files.bind(file,staged.name);
        }catch(error){await writer?.abort().catch(()=>{});await files.release(staged.name).catch(()=>{});throw error;}
        finally{streamAborts.delete(abort);signal?.removeEventListener('abort',abort);await reader?.cancel().catch(()=>{});reader?.releaseLock();}
      });
    }
    function download(blob,filename){
      check();const unpin=files?.pin(blob)||(()=>{});let url='';
      try{url=window.URL.createObjectURL(blob);}
      catch(error){unpin();throw error;}
      const anchor=document.createElement('a');
      try{anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();}
      finally{anchor.remove();window.setTimeout(()=>{try{window.URL.revokeObjectURL(url);}finally{unpin();}},60000);}
      return Object.freeze({status:'downloaded',filename});
    }
    // Invoke synchronously from the click; await preparation only after this call.
    function chooseSave(filename,accept){
      if(typeof window.showSaveFilePicker!=='function')return Promise.resolve(null);
      try{return window.showSaveFilePicker({suggestedName:filename,types:[{description:'Study Director file',accept}]}).catch(error=>{if(error.name==='AbortError')throw cancelled();throw error;});}
      catch(error){return Promise.reject(error);}
    }
    async function save(file,handle=null){return scope(async()=>{
      check();await file.checkProtection?.();
      if(!handle)return download(file.blob,file.filename);
      let writable=null,closed=false;
      try{
        phase='Opening backup file…';publish();writable=await handle.createWritable({keepExistingData:false});check();for(let offset=0;offset<file.blob.size;offset+=1048576){check();await file.checkProtection?.();await writable.write(file.blob.slice(offset,offset+1048576));phase=`Writing backup file · ${Math.floor(Math.min(offset+1048576,file.blob.size)/Math.max(1,file.blob.size)*100)}%`;publish();}check();await file.checkProtection?.();phase='Finishing backup file…';publish();await writable.close();closed=true;
        phase='Reopening and verifying saved file…';publish();
        const reopened=await handle.getFile(),expectedHash=fileProofs.get(file.blob)||'';
        const verified=expectedHash?reopened.size===file.blob.size&&await run('file.hash',{file:reopened})===expectedHash:await run('equalFiles',{left:file.blob,right:reopened});
        if(!verified)throw new Error('The saved file did not match after reopening.');
        await file.checkProtection?.();return Object.freeze({status:'saved',filename:handle.name||file.filename});
      }catch(error){if(writable&&!closed)await writable.abort().catch(()=>{});if(closed)error.fileWritten=true;throw error;}
    });}
    async function open(input){
      if(typeof window.showOpenFilePicker!=='function'){input.click();return null;}
      try{const [handle]=await window.showOpenFilePicker({multiple:false,types:[{description:'Study Director backup',accept:{'application/octet-stream':['.sdbackup','.gz'],'application/json':['.json']}}]});return await handle.getFile();}
      catch(error){if(error.name==='AbortError')return null;throw error;}
    }
    return Object.freeze({scope,job,run,receiveStream,download,chooseSave,save,open,status,check,checkpoint:()=>{const epoch=cancelEpoch;return ()=>{check();if(epoch!==cancelEpoch)throw cancelled();};},cancel:()=>{cancelEpoch++;aborted=true;if(fileJobActive){phase='Cancelling standalone file…';publish();}for(const abort of streamAborts)abort();stop(cancelled());}});
  }
  // Policy is durable; password material is a non-extractable, tab-memory key only.
  function createProtection({processing,storage,interactions,settingKey,onState=()=>{},canMutate=()=>true,issueToken=()=>null,assertToken=()=>{}}){
    const SETTING=String(settingKey||'').trim(),LEGACY_PROOF='Study Director backup protection v1';
    if(!SETTING)throw new TypeError('Backup protection metadata key is required.');
    let key=null,keyId='',policy=null,keyEpoch=0,generation=new AbortController();
    const cancelled=()=>Object.assign(new Error('Backup encryption cancelled.'),{name:'AbortError',code:'STUDY_DIRECTOR_IMPORT_CANCELLED'});
    function publish(){onState(Object.freeze({enabled:!!policy,unlocked:!!key&&keyId===policy?.id}));}
    function lock(){keyEpoch++;generation.abort();generation=new AbortController();key=null;keyId='';publish();}
    async function refresh(){
      const value=await storage.read(SETTING),version=Number(value&&value.version);
      if(value&&(typeof value.id!=='string'||!value.id||value.id.length>128||![1,2].includes(version)||!(value.verifier instanceof Blob)))throw new Error('Backup encryption settings are unreadable. Backups are paused.');
      policy=value;if(!policy||keyId!==policy.id){key=null;keyId='';}publish();return policy;
    }
    function check(signal){processing.check();if(signal?.aborted)throw cancelled();}
    async function askKey({confirm=false,message='',signal}={}){
      check(signal);
      let answer=await interactions.input({title:confirm?'Encrypt backups':'Unlock backup encryption',message:message||(confirm?'Optional password encryption for local, folder and Drive backups. Use a long, unique passphrase and keep it safe; it cannot be recovered.':'Enter the password used when this backup was created.'),inputLabel:'Password',inputType:'password',confirmPassword:confirm,maxLength:1024,required:true,signal,hint:confirm?'Includes the complete attachment library. Unlock again after reopening. Notes exports and browser storage are not encrypted.':'Your password stays in this tab only.',validate:value=>!value||value.length>1024?'Enter 1–1024 characters.':confirm&&value.length<12?'Use at least 12 characters.':'',confirmLabel:confirm?'Enable encryption':'Unlock'});
      if(!answer)throw cancelled();check(signal);
      try{return await processing.run('crypto.key',{password:answer.value},{signal});}finally{answer=null;}
    }
    async function unlock(record,signal){
      const epoch=keyEpoch;
      let message='Unlock backup encryption for this tab. Encrypted folder and Drive backups can run until you lock or leave this tab.';
      for(;;){const candidate=await askKey({message,signal});try{
        if(Number(record.version)===1){
          check(signal);const proof=await legacyDecryptBackup(record.verifier,candidate);check(signal);
          if(await proof.text()!==LEGACY_PROOF)throw new Error('Backup encryption settings are invalid.');
        }else await processing.run('crypto.verifier.check',{file:record.verifier,key:candidate},{signal});
        check(signal);if(epoch!==keyEpoch)throw cancelled();let latest=await refresh();if(latest?.id!==record.id)throw new Error('Backup encryption changed in another tab. Try again.');
        if(Number(latest.version)===1){
          const verifier=await processing.run('crypto.verifier.create',{key:candidate},{signal});
          await storage.write(SETTING,{version:2,id:record.id,verifier},{expectedId:record.id,check:()=>{check(signal);if(epoch!==keyEpoch)throw cancelled();}});
          latest=await refresh();if(latest?.id!==record.id||Number(latest.version)!==2)throw new Error('Backup encryption migration could not be verified.');
        }
        key=candidate;keyId=record.id;publish();return key;
      }catch(error){if(error.code!=='BACKUP_AUTH_FAILED')throw error;message=error.message;}}
    }
    async function protect(file,{interactive=true,signal}={}){
      const epoch=keyEpoch,lifetime=generation.signal,checkOperation=processing.checkpoint?.()||processing.check;
      const record=await refresh();check(signal);
      const protectionId=record?.id||'';
      async function checkProtection(){
        checkOperation();check(signal);if(epoch!==keyEpoch||lifetime.aborted)throw cancelled();
        const latest=await refresh();
        checkOperation();check(signal);if(epoch!==keyEpoch||lifetime.aborted)throw cancelled();
        if((latest?.id||'')!==protectionId)throw Object.assign(new Error('Backup encryption changed. Retry the backup with the current settings.'),{name:'AbortError',code:'BACKUP_POLICY_CHANGED'});
      }
      await checkProtection();
      let current=key;
      if(record&&!current){if(!interactive)throw Object.assign(new Error('Encrypted automatic backups are paused. Unlock backup encryption in this tab.'),{code:'BACKUP_LOCKED'});current=await unlock(record,signal);}
      await checkProtection();
      file=typeof file==='function'?await file():file;
      await checkProtection();
      let blob=file.blob;
      if(record){
        await checkProtection();
        const controller=new AbortController(),signals=[lifetime,signal].filter(Boolean),abort=()=>controller.abort();
        for(const source of signals){source.addEventListener('abort',abort,{once:true});if(source.aborted)abort();}
        try{blob=await processing.run('crypto.stream.encrypt',{file:blob,key:current},{signal:controller.signal});}
        finally{for(const source of signals)source.removeEventListener('abort',abort);}
      }
      try{await checkProtection();}catch(error){if(blob!==file.blob)await processing.run('file.release',{file:blob});throw error;}
      return Object.freeze({...file,blob,encrypted:!!record,protectionId,protectionSignal:lifetime,checkProtection});
    }
    async function unprotect(file,{interactive=true,signal}={}){
      let info=await processing.run('crypto.info',{file},{signal});check(signal);if(!info)info=await legacyEncryptionInfo(file);check(signal);if(!info)return {blob:file,encrypted:false};
      if(![1,2].includes(Number(info.version)))throw Object.assign(new Error('This encrypted backup format is unsupported.'),{code:'BACKUP_ENCRYPTION_UNSUPPORTED'});
      await refresh();const epoch=keyEpoch,lifetime=generation.signal;let current=key,message='';
      for(;;){
        if(!current){if(!interactive)throw Object.assign(new Error('Unlock backup encryption before verifying this encrypted backup.'),{code:'BACKUP_LOCKED'});current=await askKey({message,signal});}
        const controller=new AbortController(),signals=[signal,lifetime].filter(Boolean),abort=()=>controller.abort();
        for(const source of signals){source.addEventListener('abort',abort,{once:true});if(source.aborted)abort();}
        let blob;
        try{blob=Number(info.version)===2?await processing.run('crypto.stream.decrypt',{file,key:current},{signal:controller.signal}):await legacyDecryptBackup(file,current);check(signal);if(epoch!==keyEpoch||lifetime.aborted)throw cancelled();return {blob,encrypted:true};}
        catch(error){if(blob)await processing.run('file.release',{file:blob});if(error.code!=='BACKUP_AUTH_FAILED'||!interactive)throw error;message=error.message;current=null;}
        finally{for(const source of signals)source.removeEventListener('abort',abort);}
      }
    }
    async function manage(){return processing.job(async()=>{
      if(!canMutate())throw new Error('Take control in this tab before changing backup encryption.');
      const token=issueToken(),record=await refresh();
      const action=record?(key?await interactions.choose({title:'Backup encryption',message:'Encrypted backups remain unlocked while this tab is open. Reopening the app locks encryption again.',choices:[{value:'lock',label:'Lock now'},{value:'disable',label:'Turn off encryption',description:'Future backups will be unencrypted. Existing encrypted files are unchanged.',kind:'danger'}]}):'unlock'):'enable';
      if(!action)return;
      if(action==='lock'){lock();return;}
      if(action==='unlock'){if(!key)await unlock(record);return;}
      if(action==='disable'){
        if(!key)await unlock(record);
        if(!await interactions.confirm({title:'Turn off backup encryption?',message:'Future local, folder and Drive backups will contain unencrypted data. Previously encrypted files still need their original password.',confirmLabel:'Turn off encryption',danger:true}))return;
        if(!canMutate())throw new Error('Control changed to another tab.');
        assertToken(token);check();if((await refresh())?.id!==record.id)throw cancelled();assertToken(token);
        await storage.remove(SETTING,{expectedId:record.id,check:()=>{check();assertToken(token);}});policy=null;lock();return;
      }
      const epoch=keyEpoch,candidate=await askKey({confirm:true}),verifier=await processing.run('crypto.verifier.create',{key:candidate});
      if(!canMutate())throw new Error('Control changed to another tab.');
      if(epoch!==keyEpoch)throw cancelled();assertToken(token);check();if(await refresh())throw cancelled();assertToken(token);
      const recordToSave={version:2,id:globalThis.crypto.randomUUID(),verifier};await storage.write(SETTING,recordToSave,{expectedId:'',check:()=>{check();assertToken(token);if(epoch!==keyEpoch)throw cancelled();}});
      if(epoch!==keyEpoch){await refresh();throw cancelled();}
      policy=recordToSave;key=candidate;keyId=policy.id;publish();
    });}
    async function verifyFrame(data,{signal}={}){
      await refresh();check(signal);const epoch=keyEpoch,lifetime=generation.signal,current=key;
      if(!current)throw Object.assign(new Error('Unlock backup encryption before verifying this backup.'),{code:'BACKUP_LOCKED'});
      const controller=new AbortController(),signals=[signal,lifetime].filter(Boolean),abort=()=>controller.abort();
      for(const source of signals){source.addEventListener('abort',abort,{once:true});if(source.aborted)abort();}
      try{const result=await processing.run('integrity.decrypt',{...data,key:current},{signal:controller.signal});check(signal);if(epoch!==keyEpoch||lifetime.aborted)throw cancelled();await refresh();if(current!==key)throw cancelled();return result;}
      finally{for(const source of signals)source.removeEventListener('abort',abort);}
    }
    return Object.freeze({protect,unprotect,verifyFrame,manage,refresh,lock,status:()=>Object.freeze({enabled:!!policy,unlocked:!!key&&keyId===policy?.id})});
  }
  return Object.freeze({format:'study-director.exports-module',contractVersion:1,createFileStore,createCoordinator,createProtection});
});
})();
