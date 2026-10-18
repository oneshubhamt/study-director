(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
registry.define('exports',1,input=>{
  registry.contracts.exactFrozenObject(input,['lifecycle'],'exports module input');
  const Lifecycle=input.lifecycle;
  if(!Object.isFrozen(Lifecycle)||Lifecycle.format!=='study-director.operation-lifecycle'||Lifecycle.contractVersion!==1)throw new TypeError('Operation lifecycle contract is unavailable or incompatible.');
  function cancelled(){const error=new Error('File operation cancelled.');error.name='AbortError';error.code='STUDY_DIRECTOR_IMPORT_CANCELLED';return error;}
  // OPFS scratch/journal files have opaque names and shared reader leases.
  // Durable references are metadata records; orphan collection is lock guarded.
  function createFileStore({storage,locks,root='',retained=async()=>[],setTimeout:schedule=setTimeout,clearTimeout:clear=clearTimeout,now=Date.now,workMs=5000,maxEntries=128,isAvailable=()=>true,onError=()=>{}}){
    const ROOT=String(root||'@@SD_BACKUP_FILES_OPFS_DIRECTORY@@'),held=new Map(),objects=new WeakMap();
    const valid=name=>typeof name==='string'&&/^backup-[a-f0-9-]{36}$/.test(name);
    const directory=async()=>{if(!storage?.getDirectory||!locks?.request)throw new Error('Complete backups require browser file storage. Open the hosted app in a supported browser.');return (await storage.getDirectory()).getDirectoryHandle(ROOT,{create:true});};
    async function lease(name){
      if(!valid(name))throw new Error('Invalid backup storage identity.');
      const unlock=await new Promise((resolve,reject)=>{locks.request(ROOT+':'+name,{mode:'shared'},()=>new Promise(done=>resolve(done))).catch(reject);});
      const token={name,unlock,active:true,pinCount:0,releaseRequested:false};let tokens=held.get(name);if(!tokens)held.set(name,tokens=new Set());tokens.add(token);return token;
    }
    let iterator=null,candidate=null,cycleBlocked=false,suspended=0;
    function scheduleCollection(delay=1000){return collectionJob.schedule(delay,'collection');}
    function suspend(){suspended++;collectionJob.wake('foreground');let released=false;return ()=>{if(released)return;released=true;suspended=Math.max(0,suspended-1);if(!suspended)collectionJob.wake('resume');};}
    async function collectAttempt({options:{signal=null}}){
      const started=Number(now());let removed=0,visited=0,blocked=false;
      const check=()=>{if(signal?.aborted||suspended||visited>0&&Number(now())-started>=workMs)throw Object.assign(new Error('Backup scratch collection yielded.'),{code:'BACKUP_GC_YIELDED'});};
      return Promise.resolve().then(async()=>{
        check();const dir=await directory();check();if(!iterator)iterator=dir.entries()[Symbol.asyncIterator]();
        while(visited<maxEntries){
          check();if(!candidate)candidate=await iterator.next();check();if(candidate.done){iterator=null;candidate=null;blocked=cycleBlocked;cycleBlocked=false;return Object.freeze({status:blocked?'yielded':'completed',reason:blocked?'reader-locked':'',removed,visited});}
          const [name,entry]=candidate.value;if(entry.kind!=='file'||!valid(name)||held.has(name)){candidate=null;visited++;continue;}
          await locks.request(ROOT+':'+name,{ifAvailable:true},async lock=>{
            check();if(!lock){cycleBlocked=true;return;}const keep=new Set(await retained());check();
            if(!keep.has(name)){await dir.removeEntry(name).catch(error=>{if(error.name!=='NotFoundError')throw error;});removed++;}
          });
          candidate=null;visited++;if(visited%16===0)await new Promise(resolve=>schedule(resolve,0));
        }
        return Object.freeze({status:'yielded',reason:'budget',removed,visited});
      }).catch(error=>{if(error?.code==='BACKUP_GC_YIELDED')return Object.freeze({status:'yielded',reason:'preempted-or-budget',removed,visited});iterator=null;candidate=null;cycleBlocked=false;throw error;}).then(result=>{
        if(result.status==='yielded')scheduleCollection(result.reason==='reader-locked'?5*60*1000:2000);return result;
      },error=>{collectionJob.schedule(30*60*1000,'error','replace');throw error;});
    }
    const collectionJob=Lifecycle.createJob({environment:{now,setTimeout:schedule,clearTimeout:clear},isAvailable:()=>suspended?'foreground-busy':isAvailable(),execute:collectAttempt,capture:onError,retryMs:30*60*1000});
    // The host runs the first collection once it has started. Scheduling here
    // asked the host's availability check before the host had finished defining it.
    const collect=(options={})=>collectionJob.run('collection',options);
    async function finishRelease(token){
      if(!token?.active)return;token.active=false;token.unlock();
      const tokens=held.get(token.name);tokens?.delete(token);if(!tokens?.size)held.delete(token.name);
      scheduleCollection();
    }
    async function releaseToken(token){
      if(!token?.active)return;token.releaseRequested=true;if(token.pinCount>0)return;await finishRelease(token);
    }
    const producers=new Map();
    async function stage(){const name='backup-'+crypto.randomUUID(),token=await lease(name);producers.set(name,token);try{return {name,directory:ROOT,handle:await(await directory()).getFileHandle(name,{create:true})};}catch(error){producers.delete(name);await releaseToken(token);throw error;}}
    async function resume(name){if(!valid(name))throw new Error('Integrity scratch identity is invalid.');const token=await lease(name);producers.set(name,token);try{return {name,directory:ROOT,handle:await(await directory()).getFileHandle(name)};}catch(error){producers.delete(name);await releaseToken(token);throw error;}}
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
    return Object.freeze({stage,resume,bind,read,release,nameOf,collect,pin,suspend,wake:trigger=>collectionJob.wake(trigger),settled:collectionJob.settled,status:()=>{const state=collectionJob.status();return Object.freeze({...state,...Lifecycle.snapshot({busy:state.busy,pending:state.pending,scheduled:state.scheduled,suspended:suspended>0||state.suspended,reason:state.reason,nextEligibleAt:state.nextEligibleAt}),lastOutcome:state.lastOutcome});}});
  }
  function createCoordinator({createWorker,window,document,onState=()=>{},files=null}){
    let worker=null,leases=0,sequence=0,tail=Promise.resolve(),aborted=false,phase='',currentJob=null,fileJobActive=false,cancelEpoch=0;const pending=new Map(),persistedHashes=new WeakMap(),streamAborts=new Set();
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
        let hash=persistedHashes.get(file);if(!hash){hash=await run('file.hash',{file});persistedHashes.set(file,hash);}
        return {name,size:file.size,hash};
      });
      return scope(async()=>{
        const task=async()=>{
          check();if(options.signal?.aborted)throw cancelled();await awaitCollection(options.signal);check();if(options.signal?.aborted)throw cancelled();
          const nextPhase=type==='crypto.verifier.create'?'Preparing protection…':type==='crypto.verifier.check'?'Unlocking backup…':type==='crypto.key'?'Preparing protection…':type==='decode.open'||type==='parseBlob'?'Reading backup…':type==='equalFiles'?'Verifying saved file…':type==='file.hash'?'Verifying backup file…':type==='file.copy'?'Preparing backup file…':type==='encode.open'?'Preparing backup…':type==='encode.write'?'Packaging backup data…':type==='encode.finish'?'Finishing backup file…':type==='zip'?'Packaging notes…':type==='markdown'?'Preparing notes…':phase;if(phase!==nextPhase){phase=nextPhase;publish();}
          let staged=null;if(type==='file.copy'||type.startsWith('crypto.stream.')){staged=await files.stage();data={...data,output:Object.freeze({kind:'opfs',name:staged.name,directory:staged.directory})};}
          const id=++sequence;
          const abort=()=>stop(cancelled());options.signal?.addEventListener('abort',abort,{once:true});
          try{check();if(options.signal?.aborted)throw cancelled();const value=await new Promise((resolve,reject)=>{
            const progressBound=type==='file.hash'||type==='equalFiles'||(type==='checksum'&&data.value instanceof Blob),stallTimeoutMs=progressBound?30000:120000,timeout=setTimeout(()=>stop(new Error(progressBound?'File verification stopped making progress. Retry the operation.':'File processing timed out. Retry or use a smaller export.')),stallTimeoutMs);
            pending.set(id,{resolve,reject,timeout,type,stallTimeoutMs,onProgress:typeof options.onProgress==='function'?options.onProgress:null});
            try{ensure().postMessage({id,type,data});}catch(error){stop(error);}
          });
            return staged?files.bind(value,staged.name):value;
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
    // id lets the browser reopen the dialog in the folder last used for that kind of file.
    function chooseSave(filename,accept,{id=''}={}){
      if(typeof window.showSaveFilePicker!=='function')return Promise.resolve(null);
      try{return window.showSaveFilePicker({suggestedName:filename,types:[{description:'Study Director file',accept}],...(id?{id}:{})}).catch(error=>{if(error.name==='AbortError')throw cancelled();throw error;});}
      catch(error){return Promise.reject(error);}
    }
    // Writes go out in 8 MB pieces (few browser round trips, steady progress);
    // the browser replaces the chosen file only when the write closes.
    const SAVE_CHUNK_BYTES=8*1048576;
    async function save(file,handle=null,{onProgress=null,onVerify=null}={}){return scope(async()=>{
      check();await file.checkProtection?.();
      if(!handle)return download(file.blob,file.filename);
      let writable=null,closed=false;const total=file.blob.size,report=loaded=>{try{onProgress?.({loaded,total});}catch{}};
      try{
        phase='Opening backup file…';publish();writable=await handle.createWritable({keepExistingData:false});check();for(let offset=0;offset<total;offset+=SAVE_CHUNK_BYTES){check();await file.checkProtection?.();await writable.write(file.blob.slice(offset,offset+SAVE_CHUNK_BYTES));const written=Math.min(offset+SAVE_CHUNK_BYTES,total);phase=`Writing backup file · ${Math.floor(written/Math.max(1,total)*100)}%`;publish();report(written);}check();await file.checkProtection?.();phase='Finishing backup file…';publish();await writable.close();closed=true;
        phase='Reopening and verifying saved file…';publish();try{onVerify?.();}catch{}
        // The saved file must match the verified backup byte for byte.
        const reopened=await handle.getFile(),verified=await run('equalFiles',{left:file.blob,right:reopened},{onProgress});
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
  // The backup password of the active profile. What is stored is a check
  // value and the key made from the password (non-extractable), never the
  // password. With one profile on the device the key is used on its own; with
  // several, each person types theirs when switching in ("Not now" keeps sync
  // paused). A key typed for another device's versions is learnt here.
  function createProtection({processing,storage,interactions,settingKey,onState=()=>{},canMutate=()=>true,issueToken=()=>null,assertToken=()=>{},remember=()=>true}){
    const SETTING=String(settingKey||'').trim();
    if(!SETTING)throw new TypeError('Backup protection metadata key is required.');
    let key=null,keyId='',policy=null,keyEpoch=0,generation=new AbortController(),typed=null;
    const cancelled=()=>Object.assign(new Error('Backup encryption cancelled.'),{name:'AbortError',code:'STUDY_DIRECTOR_IMPORT_CANCELLED'});
    const validKey=value=>value===null||(typeof CryptoKey!=='undefined'&&value instanceof CryptoKey&&value.type==='secret'&&value.algorithm?.name==='PBKDF2'&&value.extractable===false);
    function publish(){onState(Object.freeze({enabled:!!policy,unlocked:!!key&&keyId===policy?.id}));}
    function lock(){keyEpoch++;generation.abort();generation=new AbortController();key=null;keyId='';publish();}
    async function refresh(){
      const value=await storage.read(SETTING),version=Number(value&&value.version);
      if(value&&(typeof value.id!=='string'||!value.id||value.id.length>128||version!==3||!(value.verifier instanceof Blob)||!validKey(value.key??null)))throw new Error('Backup encryption settings are unreadable. Backups are paused.');
      policy=value;if(!policy||keyId!==policy.id){key=null;keyId='';}
      if(policy?.key&&!key&&remember()){key=policy.key;keyId=policy.id;}
      publish();return policy;
    }
    function check(signal){processing.check();if(signal?.aborted)throw cancelled();}
    async function askKey({confirm=false,title='',message='',confirmLabel='',cancelLabel='',signal}={}){
      check(signal);
      let answer=await interactions.input({title:title||(confirm?'Set a backup password':'Backup password'),message:message||(confirm?'Encrypts Device Folder, Drive and file backups. Use a long, unique passphrase and keep it safe: it cannot be recovered.':'Enter the password used when this backup was created.'),inputLabel:'Password',inputType:'password',confirmPassword:confirm,maxLength:1024,required:true,signal,hint:confirm?'At least 12 characters. Attachments are encrypted too; notes exports and browser storage are not.':'Only a key made from it is kept on this device, never the password.',validate:value=>!value||value.length>1024?'Enter 1–1024 characters.':confirm&&value.length<12?'Use at least 12 characters.':'',confirmLabel:confirmLabel||(confirm?'Set password':'Unlock'),...(cancelLabel?{cancelLabel}:{})});
      if(!answer)throw cancelled();check(signal);
      try{return await processing.run('crypto.key',{password:answer.value},{signal});}finally{answer=null;}
    }
    // Keeps the key with a record that has none, so this device does not ask
    // again. A kept key always opens its own record (set, change and follow
    // each keep theirs), so it is never replaced.
    async function keep(record,candidate){
      if(record.key)return;
      await storage.write(SETTING,{...record,key:candidate},{expectedId:record.id,check:()=>{check();}});
      policy={...record,key:candidate};
    }
    async function unlock(record,signal,{message='',cancelLabel=''}={}){
      const epoch=keyEpoch;
      for(;;){const candidate=await askKey({message:message||'Enter this profile’s backup password. Sync and encrypted backups wait until it is entered.',cancelLabel,signal});try{
        await processing.run('crypto.verifier.check',{file:record.verifier,key:candidate},{signal});
        check(signal);if(epoch!==keyEpoch)throw cancelled();const latest=await refresh();if(latest?.id!==record.id)throw new Error('Backup encryption changed in another tab. Try again.');
        await keep(latest,candidate);key=candidate;keyId=record.id;publish();return key;
      }catch(error){if(error.code!=='BACKUP_AUTH_FAILED')throw error;message=error.message;}}
    }
    async function protect(file,{interactive=true,signal,onProgress=null}={}){
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
      if(record&&!current){if(!interactive)throw Object.assign(new Error('Sync and encrypted backups wait for this profile’s backup password.'),{code:'BACKUP_LOCKED'});current=await unlock(record,signal);}
      await checkProtection();
      file=typeof file==='function'?await file():file;
      await checkProtection();
      let blob=file.blob;
      if(record){
        await checkProtection();
        const controller=new AbortController(),signals=[lifetime,signal].filter(Boolean),abort=()=>controller.abort();
        for(const source of signals){source.addEventListener('abort',abort,{once:true});if(source.aborted)abort();}
        try{blob=await processing.run('crypto.stream.encrypt',{file:blob,key:current},{signal:controller.signal,onProgress});}
        finally{for(const source of signals)source.removeEventListener('abort',abort);}
      }
      try{await checkProtection();}catch(error){if(blob!==file.blob)await processing.run('file.release',{file:blob});throw error;}
      return Object.freeze({...file,blob,encrypted:!!record,protectionId,protectionSignal:lifetime,checkProtection});
    }
    async function unprotect(file,{interactive=true,signal}={}){
      const info=await processing.run('crypto.info',{file},{signal});check(signal);if(!info)return {blob:file,encrypted:false};
      if(Number(info.version)!==2)throw Object.assign(new Error('This encrypted backup format is unsupported.'),{code:'BACKUP_ENCRYPTION_UNSUPPORTED'});
      await refresh();const epoch=keyEpoch,lifetime=generation.signal;let current=key,message='',asked=false;
      for(;;){
        if(!current){if(!interactive)throw Object.assign(new Error('This version needs its backup password.'),{code:'BACKUP_LOCKED'});current=await askKey({message,signal});asked=true;}
        const controller=new AbortController(),signals=[signal,lifetime].filter(Boolean),abort=()=>controller.abort();
        for(const source of signals){source.addEventListener('abort',abort,{once:true});if(source.aborted)abort();}
        let blob;
        try{blob=await processing.run('crypto.stream.decrypt',{file,key:current},{signal:controller.signal});check(signal);if(epoch!==keyEpoch||lifetime.aborted)throw cancelled();if(asked)typed=Object.freeze({key:current,at:Date.now()});return {blob,encrypted:true};}
        catch(error){if(blob)await processing.run('file.release',{file:blob});if(error.code!=='BACKUP_AUTH_FAILED'||!interactive)throw error;message=error.message;current=null;}
        finally{for(const source of signals)source.removeEventListener('abort',abort);}
      }
    }
    async function setPassword(token,record,{change=false}={}){
      const epoch=keyEpoch,candidate=await askKey({confirm:true,title:change?'Change backup password':'Set a backup password',message:change?'Versions made from now on use the new password; earlier ones keep the one they were made with. Your other devices ask for the new password at their next sync.':''}),verifier=await processing.run('crypto.verifier.create',{key:candidate});
      if(!canMutate())throw new Error('Control changed to another tab.');
      if(epoch!==keyEpoch)throw cancelled();assertToken(token);check();if(((await refresh())?.id||'')!==(record?.id||''))throw cancelled();assertToken(token);
      const recordToSave={version:3,id:globalThis.crypto.randomUUID(),verifier,key:candidate,setAt:new Date().toISOString()};await storage.write(SETTING,recordToSave,{expectedId:record?.id||'',check:()=>{check();assertToken(token);if(epoch!==keyEpoch)throw cancelled();}});
      if(epoch!==keyEpoch){await refresh();throw cancelled();}
      policy=recordToSave;key=candidate;keyId=policy.id;publish();
    }
    async function removePassword(token,record){
      if(!await interactions.confirm({title:'Remove the backup password?',message:'Versions made from now on upload without encryption, to Drive too. Earlier versions still need this password.',confirmLabel:'Remove password',danger:true}))return;
      if(!canMutate())throw new Error('Control changed to another tab.');
      assertToken(token);check();if((await refresh())?.id!==record.id)throw cancelled();assertToken(token);
      await storage.remove(SETTING,{expectedId:record.id,check:()=>{check();assertToken(token);}});policy=null;lock();
    }
    // Set, change or remove the password; a locked profile is unlocked first.
    async function manage(){return processing.job(async()=>{
      if(!canMutate())throw new Error('Take control in this tab before changing the backup password.');
      const token=issueToken(),record=await refresh();
      if(!record)return setPassword(token,null);
      if(!key){await unlock(record);return;}
      const action=await interactions.choose({title:'Backup password',message:'Device Folder, Drive and file backups are encrypted with it.',choices:[{value:'change',label:'Change password'},{value:'remove',label:'Remove password',description:'Later versions upload unencrypted.',kind:'danger'}]});
      if(action==='change')return setPassword(token,record,{change:true});
      if(action==='remove')return removePassword(token,record);
    });}
    // First start: the password typed in the form, set before anything uploads.
    async function enable(password){return processing.job(async()=>{
      if(!canMutate())throw new Error('Take control in this tab before setting the backup password.');
      const token=issueToken();if(await refresh())return false;
      const candidate=await processing.run('crypto.key',{password:String(password||'')}),verifier=await processing.run('crypto.verifier.create',{key:candidate});
      assertToken(token);check();if(await refresh())return false;
      const next={version:3,id:globalThis.crypto.randomUUID(),verifier,key:candidate,setAt:new Date().toISOString()};
      await storage.write(SETTING,next,{expectedId:'',check:()=>{check();assertToken(token);}});
      policy=next;key=candidate;keyId=next.id;publish();return true;
    });}
    // Switching into a profile with a password, when the device has several.
    async function ask(){return processing.job(async()=>{const record=await refresh();if(!record||key)return true;try{await unlock(record,null,{cancelLabel:'Not now'});return true;}catch(error){if(error.name==='AbortError')return false;throw error;}});}
    // The library moved on: another device set or changed the password (the
    // one just typed for its version is kept under its id), or removed it.
    async function follow({protectionId='',encrypted=false,removedElsewhere=false}={}){
      const record=await refresh();
      if(encrypted&&protectionId&&protectionId.length<=128&&protectionId!==record?.id){
        const candidate=typed&&Date.now()-typed.at<10*60*1000?typed.key:key;typed=null;if(!candidate)return false;
        const verifier=await processing.run('crypto.verifier.create',{key:candidate}),next={version:3,id:protectionId,verifier,key:candidate,setAt:new Date().toISOString()};
        await storage.write(SETTING,next,{expectedId:record?.id||'',check:()=>check()});policy=next;key=candidate;keyId=next.id;publish();return true;
      }
      if(!encrypted&&removedElsewhere&&record){await storage.remove(SETTING,{expectedId:record.id,check:()=>check()});policy=null;lock();return true;}
      return false;
    }
    async function verifyFrame(data,{signal}={}){
      await refresh();check(signal);const epoch=keyEpoch,lifetime=generation.signal,current=key;
      if(!current)throw Object.assign(new Error('Unlock backup encryption before verifying this backup.'),{code:'BACKUP_LOCKED'});
      const controller=new AbortController(),signals=[signal,lifetime].filter(Boolean),abort=()=>controller.abort();
      for(const source of signals){source.addEventListener('abort',abort,{once:true});if(source.aborted)abort();}
      try{const result=await processing.run('integrity.decrypt',{...data,key:current},{signal:controller.signal});check(signal);if(epoch!==keyEpoch||lifetime.aborted)throw cancelled();await refresh();if(current!==key)throw cancelled();return result;}
      finally{for(const source of signals)source.removeEventListener('abort',abort);}
    }
    return Object.freeze({protect,unprotect,verifyFrame,manage,enable,ask,follow,refresh,lock,status:()=>Object.freeze({enabled:!!policy,unlocked:!!key&&keyId===policy?.id})});
  }
  return Object.freeze({format:'study-director.exports-module',contractVersion:1,createFileStore,createCoordinator,createProtection});
});
})();
