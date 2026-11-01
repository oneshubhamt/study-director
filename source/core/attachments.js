(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
registry.define('attachments',1,()=>{
  const MiB=1048576,GiB=1024*MiB,CHUNK=MiB,MAX_IMAGE=12*MiB,MAX_PDF_AUDIO=2*GiB,MAX_ARCHIVE=Number.MAX_SAFE_INTEGER,MAX_ENTRIES=50000,MAX_META=16*MiB,DOWNLOAD_MAX=128*MiB;
  const imageTypes=new Set(['image/png','image/jpeg','image/gif','image/webp','image/avif']);
  const audioTypes=new Set(['audio/mpeg','audio/wav','audio/ogg','audio/flac','audio/mp4','audio/webm']);
  const validType=type=>imageTypes.has(type)||audioTypes.has(type)||type==='application/pdf';
  const validId=id=>typeof id==='string'&&/^(?:att|img)-[a-z0-9-]{20,80}$/.test(id);
  const limitForType=type=>imageTypes.has(type)?MAX_IMAGE:MAX_PDF_AUDIO;
  const cleanName=name=>String(name||'Attachment').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,160)||'Attachment';
  const sizeLabel=size=>size<MiB?`${Math.ceil(size/1024)} KB`:size>=1024*MiB?`${(size/GiB).toFixed(size>=10*GiB?0:1)} GB`:`${(size/MiB).toFixed(size>=100*MiB?0:1)} MB`;
  const hashPattern=/^[a-f0-9]{64}$/;
  const abort=()=>Object.assign(new Error('Attachment operation cancelled.'),{name:'AbortError'});
  async function identify(file){
    const b=new Uint8Array(await file.slice(0,64).arrayBuffer()),at=(s,n=0)=>[...s].every((v,i)=>b[n+i]===v.charCodeAt(0));let type='';
    if(at('%PDF-'))type='application/pdf';
    else if(b[0]===137&&at('PNG\r\n\x1a\n',1))type='image/png';
    else if(b[0]===255&&b[1]===216&&b[2]===255)type='image/jpeg';
    else if(at('GIF87a')||at('GIF89a'))type='image/gif';
    else if(at('RIFF')&&at('WEBP',8))type='image/webp';
    else if(at('RIFF')&&at('WAVE',8))type='audio/wav';
    else if(at('OggS'))type='audio/ogg';
    else if(at('fLaC'))type='audio/flac';
    else if(at('ID3')||(b[0]===255&&(b[1]&224)===224))type='audio/mpeg';
    else if(at('ftyp',4)){const brands=new TextDecoder().decode(b.subarray(8));type=brands.includes('avif')||brands.includes('avis')?'image/avif':'audio/mp4';}
    else if(b[0]===26&&b[1]===69&&b[2]===223&&b[3]===163)type='audio/webm';
    if(!type||!file.size||file.size>limitForType(type))throw new Error('Choose a supported image up to 12 MiB, or a PDF/audio file up to 2 GiB.');
    // Container signatures identify supported containers; native players determine codec support.
    return file.slice(0,file.size,type);
  }
  const HEADER=44;
  const magic=new TextEncoder().encode('SDAT01\r\n');
  function checkManifest(m){
    if(!m||m.format!=='study-director.attachments'||m.version!==1||!Array.isArray(m.entries)||!Array.isArray(m.files)||m.entries.length>MAX_ENTRIES||m.files.length>MAX_ENTRIES)throw new Error('Invalid attachment archive manifest.');
    const ids=new Set(),files=new Map();let total=0;
    for(const f of m.files){if(!f||!hashPattern.test(f.hash)||files.has(f.hash)||!Number.isSafeInteger(f.size)||f.size<=0||f.size>MAX_PDF_AUDIO)throw new Error('Invalid archived content.');files.set(f.hash,f);total+=f.size;}
    const used=new Set();
    for(const e of m.entries){if(!e||!validId(e.id)||ids.has(e.id)||!validType(e.type)||e.size>limitForType(e.type)||!files.has(e.hash)||files.get(e.hash).size!==e.size||typeof e.name!=='string'||e.name.length>160||typeof e.library!=='boolean')throw new Error('Invalid archived attachment.');ids.add(e.id);used.add(e.hash);}
    if(used.size!==files.size||!Number.isSafeInteger(total)||total>MAX_ARCHIVE)throw new Error('Attachment archive exceeds its supported bounds.');
    return m;
  }
  async function inspect(file){
    if(!(file instanceof Blob)||file.size<HEADER||file.size>MAX_ARCHIVE)throw new Error('Choose a valid attachment archive.');
    const header=new Uint8Array(await file.slice(0,HEADER).arrayBuffer());if(magic.some((v,i)=>header[i]!==v))throw new Error('This is not a Study Director attachment archive.');
    const length=new DataView(header.buffer).getUint32(8,true);if(length<2||length>MAX_META||HEADER+length>file.size)throw new Error('Invalid attachment archive header.');
    const bytes=await file.slice(HEADER,HEADER+length).arrayBuffer(),digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));if(digest.some((v,i)=>v!==header[12+i]))throw new Error('Attachment archive manifest failed verification.');
    const manifest=checkManifest(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));let offset=HEADER+length;const contents=new Map();
    for(const row of manifest.files){contents.set(row.hash,file.slice(offset,offset+row.size));offset+=row.size;if(!Number.isSafeInteger(offset))throw new Error('Invalid archive file offsets.');}
    if(offset!==file.size)throw new Error('Attachment archive is truncated or contains unexpected data.');return {manifest,contents};
  }
  function createReferenceCoordinator(p){
    if(!p||typeof p!=='object')throw new TypeError('Attachment reference coordinator ports are required.');
    const data=p.data,review=p.review,background=p.background,live=p.live;
    if(!data?.notes||!data?.dailyRecords||!data?.activeSession)throw new TypeError('Attachment reference data ports are incomplete.');
    if(typeof p.scan!=='function'||typeof p.rewriteReferences!=='function'||typeof p.withPersistenceSuppressed!=='function')throw new TypeError('Attachment reference mutation ports are incomplete.');
    if(!review||typeof review.hydrate!=='function'||typeof review.invalidateBindings!=='function')throw new TypeError('Attachment reference review ports are incomplete.');
    if(!background||typeof background.budget!=='function'||typeof background.yieldTask!=='function')throw new TypeError('Attachment reference background ports are incomplete.');
    if(!live||typeof live.fields!=='function'||typeof live.reviewDate!=='function'||typeof live.todayIso!=='function'||typeof live.noteKey!=='function')throw new TypeError('Attachment reference live-source ports are incomplete.');
    const clone=value=>value==null?value:structuredClone(value);
    const nowIso=()=>new Date().toISOString();
    function scan(value){
      const result=p.scan(String(value||''));
      if(!result||result.trusted!==true)throw new Error('A note could not be verified. Attachment deletion is paused.');
      return result;
    }
    function descriptor(kind,key,label,value){
      const text=String(value||''),result=scan(text);
      return Object.freeze({kind,key:String(key||''),label:String(label||key||kind),ids:new Set(result.assetIds||[]),occurrences:result.occurrences||[],value:text});
    }
    async function readSession(){
      const loaded=await data.activeSession.load(0,{strict:true});
      if(loaded?.ok!==true||loaded.error)throw loaded?.error||new Error('Active Session could not be read completely.');
      return loaded.value;
    }

    async function sources(options={}){
      const includeLive=options.includeLive!==false,priority=options.priority==='background'?'background':'user-visible',referencesOnly=options.referencesOnly===true,sources=new Map(),references=referencesOnly?new Set():null,budget=background.budget();
      const add=(kind,key,label,value)=>{if(!key)return;if(references){for(const id of scan(value).assetIds||[])references.add(id);return;}const identity=kind+':'+key;sources.set(identity,descriptor(kind,key,label,value));};
      for(const [key,note] of Object.entries(await data.notes.readFreshPayload()||{})){add('note',key,note.label||key,note.text);if(budget())await background.yieldTask({priority});}
      // Verification and reference removal require a complete canonical inventory.
      for(const day of await data.dailyRecords.list({strict:true})||[]){add('day',day.date,'Reflection · '+day.date,day.reflection);if(budget())await background.yieldTask({priority});}
      const session=await readSession(),sessionReview=session?.snapshot?.review;
      if(sessionReview){add('session',session.id||'active','Session reflection · '+(session.date||live.todayIso()),sessionReview.reflection);if(budget())await background.yieldTask({priority});}
      if(includeLive){
        for(const field of live.fields()){
          const diary=field.matches('.library-diary-textarea'),reflection=field.id==='daily-reflection';
          const reviewDate=field.dataset.reviewDate||live.reviewDate();
          // An open note is named like a stored one: by its id, or by its
          // Area while it has no stored note yet.
          const key=diary?field.dataset.diaryDate:reflection?String(session?.id||'current'):live.noteKey(field.dataset.areaKey);
          if(!key)continue;
          const kind=diary?'day':reflection?'session':'note',label=diary?'Diary edit · '+key:reflection?'Reflection · '+reviewDate:key;
          if(references){add(kind,key,label,field.value);continue;}
          const identity=kind+':'+key,current=descriptor(kind,key,label,field.value),prior=sources.get(identity);
          if(prior){const ids=new Set([...prior.ids,...current.ids]);sources.set(identity,Object.freeze({...current,ids}));}else sources.set(identity,current);
        }
      }
      return references||[...sources.values()];
    }
    async function restore(snapshot){
      if(!snapshot)return true;
      const failures=[];
      await p.withPersistenceSuppressed(async()=>{
        try{
          if(snapshot.notes?.length){
            const fresh=await data.notes.readFreshPayload()||{};
            for(const original of snapshot.notes){const current=fresh[original.key];if(!current)throw new Error('A note needed for rollback is missing.');const result=data.notes.updateValidatedRich(original.key,original.label,original.text,current.updatedAt||'');if(!['changed','unchanged'].includes(result.status))throw new Error('A note changed before rollback.');}
            await data.notes.flush({strict:true});
            const verified=await data.notes.readFreshPayload()||{};for(const original of snapshot.notes)if(verified[original.key]?.text!==original.text)throw new Error('Note rollback verification failed.');
          }
        }catch(error){failures.push(error);}
        try{
          for(const original of snapshot.days||[]){await data.dailyRecords.save(clone(original));const verified=await data.dailyRecords.get(original.date,{strict:true});if(String(verified?.reflection||'')!==String(original.reflection||''))throw new Error('Saved-Day rollback verification failed.');}
        }catch(error){failures.push(error);}
        try{
          if(snapshot.session){const current=await readSession();if(!current)throw new Error('The active-session snapshot needed for rollback is missing.');const restored={...current,revision:data.activeSession.nextRevision(),updatedAt:nowIso(),snapshot:{...current.snapshot,review:clone(snapshot.session.snapshot?.review)}};const saved=await data.activeSession.save(restored);if(!saved?.ok)throw saved?.error||new Error('Active-session rollback failed.');const verified=await readSession();if(String(verified?.snapshot?.review?.reflection||'')!==String(snapshot.session.snapshot?.review?.reflection||''))throw new Error('Active-session rollback verification failed.');review.hydrate({date:verified.date,snapshotReview:verified.snapshot?.review});review.invalidateBindings();}
        }catch(error){failures.push(error);}
      });
      if(failures.length)throw new Error(failures.map(error=>error?.message||String(error)).join(' '));
      return true;
    }
    async function verifyAbsent(id){return !(await sources({includeLive:false})).some(source=>source.ids.has(String(id||'')));}
    async function removeEverywhere(id){
      const target=String(id||''),canonical=(await sources({includeLive:false})).filter(source=>source.ids.has(target));
      if(!canonical.length)return Object.freeze({changed:false,sources:0,rollback:null});
      const snapshot={notes:[],days:[],session:null},notePayload=await data.notes.readFreshPayload()||{};
      for(const source of canonical){
        if(source.kind==='note'){const note=notePayload[source.key];if(!note||String(note.text||'')!==source.value)throw new Error('A note changed before attachment removal.');snapshot.notes.push(clone(note));}
        else if(source.kind==='day'){const day=await data.dailyRecords.get(source.key,{strict:true});if(!day||String(day.reflection||'')!==source.value)throw new Error('A Saved Day changed before attachment removal.');snapshot.days.push(clone(day));}
        else if(source.kind==='session'){const session=await readSession();if(!session||String(session.snapshot?.review?.reflection||'')!==source.value)throw new Error('The session reflection changed before attachment removal.');snapshot.session=clone(session);}
      }
      const targets=canonical.map(source=>Object.freeze({kind:source.kind,key:source.key,label:source.label,attachmentIds:Object.freeze([target]),expectedValue:source.value}));
      try{
        await p.rewriteReferences(targets);
        if(!await verifyAbsent(target))throw new Error('Attachment reference removal did not verify globally.');
      }catch(error){
        try{await restore(snapshot);}catch(rollbackError){throw new Error((error?.message||error)+' Automatic reference rollback also failed: '+(rollbackError?.message||rollbackError));}
        throw error;
      }
      let rolledBack=false;
      return Object.freeze({changed:true,sources:canonical.length,rollback:async()=>{if(rolledBack)return true;await restore(snapshot);rolledBack=true;return true;}});
    }
    return Object.freeze({format:'study-director.attachment-reference-coordinator',contractVersion:1,scan,descriptor,sources,restore,removeEverywhere,verifyAbsent});
  }
  function create(p){
    const {store,processing,document,interactions,notifications}=p;
    if(!notifications||typeof notifications.begin!=='function'||typeof notifications.feedback!=='function')throw new TypeError('Attachments require notification presentation.');
    let activeNotice=null;let busy=false,cancelled=false,activeIngestController=null,activeProcessingJob=false,ingestBusy=false,progressSequence=0,activeProgress=0,rows=[],selected='',url='',previewRelease=null,generation=0,refreshSequence=0,visibleCount=100,installed=false,reconcileQueued=false,reconcileRunning=false,reconcilePromise=Promise.resolve(),refreshHold=0,pendingInvalidation=false;
    const byId=id=>document.getElementById(id),check=()=>{processing.check();if(cancelled)throw abort();};
    const integrityIssue=id=>typeof p.integrityIssue==='function'?p.integrityIssue(String(id||'')):null;
    const integrityLabel=issue=>issue?.kind==='missing-file'?'File missing':issue?.kind==='size-mismatch'?'Stored size mismatch':issue?.kind==='metadata-invalid'?'Metadata unreadable':issue?.kind==='missing-metadata'?'Library record missing':'Storage issue';
    const integrityMessage=issue=>issue?.kind==='missing-file'?'The stored attachment file is missing. Restore it from a verified backup.':issue?.kind==='size-mismatch'?'The stored attachment file size no longer matches its metadata. Restore it from a verified backup.':issue?.kind==='metadata-invalid'?'The attachment metadata is unreadable. Preserve browser storage and restore from a verified backup.':issue?.kind==='missing-metadata'?'A note references this attachment identity, but its library metadata is missing. Restore it from a verified backup.':'Attachment storage needs attention.';
    const status=(message,notice=activeNotice,progress=null)=>{if(notice)return !!notice.update({message,progress});notifications.feedback({id:'attachment-status',surfaceId:'attachment-status',surface:'inline',cue:'none',severity:'info',lifecycle:message?'succeeded':'resolved',message});return true;};
    const formatIngestProgress=(name,progress)=>{const phase=String(progress?.phase||'preparing'),loaded=Number(progress?.loaded)||0,total=Number(progress?.total)||0,label=cleanName(name);if(phase==='copying'&&total>0)return `Copying ${label} · ${sizeLabel(loaded)} / ${sizeLabel(total)} · ${Math.min(100,Math.max(0,Math.round(loaded/total*100)))}%`;if(phase==='verifying')return `Verifying ${label}…`;if(phase==='complete')return `Finishing ${label}…`;return `Preparing ${label}…`;};
    function renderIngestProgress(name,progress,ticket=activeProgress,notice=activeNotice){if(!ticket||ticket!==activeProgress||notice?.read()?.lifecycle!=='running')return;const panel=byId('attachment-progress'),bar=byId('attachment-progress-bar'),label=byId('attachment-progress-label'),value=byId('attachment-progress-value'),message=formatIngestProgress(name,progress),phase=String(progress?.phase||'preparing'),loaded=Math.max(0,Number(progress?.loaded)||0),total=Math.max(0,Number(progress?.total)||0),percent=total>0?Math.min(100,Math.max(0,Math.round(loaded/total*100))):0;if(panel)panel.hidden=false;if(label)label.textContent=message;if(value)value.textContent=phase==='copying'||phase==='verifying'||phase==='complete'?`${phase==='verifying'?'Verify · ':''}${phase==='complete'?100:percent}%`:'';if(bar){bar.max=total>0?total:1;if(total>0&&(phase==='copying'||phase==='verifying'||phase==='complete'))bar.value=phase==='complete'?total:Math.min(total,loaded);else bar.removeAttribute('value');bar.setAttribute('aria-label',message);}status(message,notice,{stage:phase,loadedBytes:loaded,activeBytes:total});}
    function clearIngestProgress(ticket=activeProgress){if(ticket!==activeProgress)return;activeProgress=0;const panel=byId('attachment-progress'),bar=byId('attachment-progress-bar'),label=byId('attachment-progress-label'),value=byId('attachment-progress-value');if(panel)panel.hidden=true;if(bar){bar.removeAttribute('value');bar.removeAttribute('aria-label');bar.max=1;}if(label)label.textContent='Preparing attachment…';if(value)value.textContent='';}
    const element=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
    const button=(text,action,mutation=false,actionId='')=>{const el=element('button',text,'mini-btn ui-btn');el.type='button';el.dataset.attachmentAction=actionId||String(text||'action').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');if(mutation)el.dataset.ownerMutation='attachments';el.disabled=busy||(mutation&&!p.canMutate());el.addEventListener('click',()=>{try{Promise.resolve(action()).catch(error=>reportError(error));}catch(error){reportError(error);}});return el;};
    function releasePreviewResources(panel=byId('attachment-detail')){const audio=panel?.querySelector?.('audio');if(audio){audio.pause();audio.removeAttribute('src');audio.load();}if(url){URL.revokeObjectURL(url);url='';}previewRelease?.();previewRelease=null;}
    function closePreview(){generation++;refreshSequence++;releasePreviewResources();byId('attachment-preview')?.replaceChildren();}
    function reportError(error,notice=null){
      const cancelled=error.name==='AbortError',message=cancelled?'Cancelled.':(error.message||String(error))+' Keep this tab open and retry after storage or file access recovers.';
      if(notice)notice.finish(cancelled?'cancelled':'failed',message);
      else if(!cancelled)notifications.feedback({id:'attachment-access',surfaceId:'attachment-status',severity:'error',lifecycle:'failed',title:'Attachment operation failed',message});
    }
    async function operation(work,options={}){
      if(busy)return false;busy=true;cancelled=false;
      const controller=new AbortController(),processingJob=options.processingJob!==false;
      const notice=notifications.begin({id:'attachment-operation',surfaceId:'attachment-status',title:'Attachment Library',message:'Preparing attachment operation…'});
      activeNotice=notice;activeIngestController=controller;activeProcessingJob=processingJob;controls();let changed=false;
      try{
        const result=processingJob?await processing.job(()=>work(controller.signal,notice)):await work(controller.signal,notice);
        changed=result!==false;if(changed)notifications.feedback({id:'attachment-access',lifecycle:'resolved'});notice.finish(changed?'succeeded':'cancelled',changed?(notice.read()?.message||'Attachment operation completed.'):'Cancelled.');return result;
      }catch(error){reportError(error,notice);return false;}
      finally{if(activeNotice===notice)activeNotice=null;if(activeIngestController===controller)activeIngestController=null;if(activeProcessingJob===processingJob)activeProcessingJob=false;clearIngestProgress();cancelled=false;busy=false;controls();if(changed){if(options.cleanup!==false)p.cleanup?.();if(options.refresh!==false)invalidate();}}
    }
    function controls(){document.querySelectorAll('#library-attachments button,#library-attachments input,#library-attachments select').forEach(el=>{el.disabled=el.id==='attachment-cancel'?!busy:busy||el.hasAttribute('data-owner-mutation')&&!p.canMutate();});const cancel=byId('attachment-cancel'),detail=byId('attachment-detail');if(cancel)cancel.hidden=!busy;if(detail){detail.setAttribute('aria-busy',String(busy));detail.classList.toggle('attachment-busy',busy);}}
    function scheduleReconcile(){
      if(reconcileQueued)return reconcilePromise;
      reconcileQueued=true;
      reconcilePromise=Promise.resolve().then(()=>{reconcileRunning=true;return refresh();}).catch(error=>reportError(error)).finally(()=>{
        reconcileRunning=false;reconcileQueued=false;
        if(pendingInvalidation&&!refreshHold){pendingInvalidation=false;scheduleReconcile();}
      });
      return reconcilePromise;
    }
    function invalidate(){
      if(!installed)return false;
      if(refreshHold){pendingInvalidation=true;return true;}
      if(reconcileQueued){if(reconcileRunning)pendingInvalidation=true;return true;}
      scheduleReconcile();return true;
    }
    async function reconcile(){
      if(refreshHold){pendingInvalidation=true;return false;}
      if(reconcileQueued){await reconcilePromise;return true;}
      await refresh();return true;
    }
    async function batch(work){
      if(typeof work!=='function')throw new TypeError('Attachment refresh batch requires an operation.');
      refreshHold++;
      try{return await work();}
      finally{refreshHold--;if(!refreshHold&&pendingInvalidation&&!reconcileQueued){pendingInvalidation=false;scheduleReconcile();}}
    }
    async function upload(files,{signal,onProgress,notice:parentNotice}={}){
      if(ingestBusy)throw new Error('Another attachment is already being added.');
      ingestBusy=true;p.onWorkStart?.();const ticket=++progressSequence;activeProgress=ticket;
      const notice=parentNotice||notifications.begin({id:'attachment-upload',surfaceId:'attachment-status',title:'Add attachment',message:'Preparing attachment…'});
      try{
        const result=await store.during(async()=>{
          p.requireOwner();const token=p.token(),ensure=()=>{if(signal?.aborted)throw abort();};
          const current=await store.list();if(current.length+files.length>MAX_ENTRIES)throw new Error('The library supports up to 50,000 attachment entries.');const pending=[];
          try{
            for(const file of files){
              ensure();const blob=await identify(file),id='att-'+crypto.randomUUID();
              const progress=value=>{if(signal?.aborted||activeProgress!==ticket||notice.read()?.lifecycle!=='running')return;renderIngestProgress(file.name,value,ticket,notice);try{onProgress?.(value);}catch{}};
              const row=await store.put(id,blob,{stage:true,library:true,name:cleanName(file.name),token,check:ensure,signal,onProgress:progress});pending.push([id,row]);
            }
            ensure();await store.publish(pending,token,ensure);selected=pending.at(-1)?.[0]||selected;
            status(`Added ${pending.length} attachment${pending.length===1?'':'s'}.`,notice);
            return Object.freeze(pending.map(([id,row])=>Object.freeze({id,...row})));
          }catch(error){await store.discard?.(pending.map(([,row])=>row)).catch(()=>{});throw error;}
        });
        if(!parentNotice)notice.finish('succeeded',notice.read()?.message||'Attachment added.');return result;
      }catch(error){if(!parentNotice)reportError(error,notice);throw error;}
      finally{ingestBusy=false;clearIngestProgress(ticket);}
    }
    async function add(file,options={}){const published=await upload([file],options);invalidate();return published[0]||null;}
    async function importFile(file,{signal}={}){const notice=activeNotice;let accepting=true;try{return await store.during(async()=>{
      p.requireOwner();const token=p.token(),ensure=()=>{check();if(signal?.aborted)throw abort();},parsed=await inspect(file),existing=await store.list(),ids=new Set(existing.map(r=>r.id));
      if(existing.length+parsed.manifest.entries.filter(r=>!ids.has(r.id)).length>MAX_ENTRIES)throw new Error('Imported library would exceed 50,000 attachment entries.');
      const pending=[],staged=new Map(),stagedRows=[];
      try{
        for(const entry of parsed.manifest.entries){
          ensure();let row=staged.get(entry.hash);
          if(!row){status('Restoring '+entry.name+'…');const blob=await identify(parsed.contents.get(entry.hash));if(blob.type!==entry.type)throw new Error('Archived file type does not match its content.');row=await store.put(entry.id,blob,{stage:true,library:true,name:entry.name,token,check:ensure,signal,onProgress:value=>{if(accepting&&!signal?.aborted)status(formatIngestProgress(entry.name,value),notice);}});if(row.hash!==entry.hash)throw new Error('Attachment archive content failed verification. Nothing was imported.');staged.set(entry.hash,row);stagedRows.push(row);}
          if(row.type!==entry.type)throw new Error('Shared content has inconsistent file types.');pending.push([entry.id,{...row,name:cleanName(entry.name),library:true}]);
        }
        ensure();await store.publish(pending,token,ensure,{deletionState:{clear:pending.map(([assetId])=>assetId)}});status(`Imported ${pending.length} attachment entries. Existing labels were kept.`);return true;
      }catch(error){await store.discard?.(stagedRows).catch(()=>{});throw error;}
    });}finally{accepting=false;}}
    async function logicalRows(sourceRows=null){
      const candidates=sourceRows||await store.list();
      const transient=candidates.filter(row=>row&&row.library!==true);
      if(!transient.length)return candidates;
      const referenced=new Set();
      for(const source of await p.sources({includeLive:false})||[])for(const id of source.ids||[])referenced.add(id);
      return candidates.filter(row=>row&&((row.library===true)||referenced.has(row.id)));
    }
    async function archiveParts(){const entries=await logicalRows();if(entries.length>MAX_ENTRIES)throw new Error('Too many attachment entries.');const contents=new Map(),files=[];for(const row of entries){check();if(contents.has(row.hash))continue;status('Verifying '+(row.name||'image')+'…');const file=await store.get(row.id);if(await processing.run('file.hash',{file})!==row.hash)throw new Error('An attachment failed verification. Export stopped.');contents.set(row.hash,file);files.push({hash:row.hash,size:row.size});}const manifest=checkManifest({format:'study-director.attachments',version:1,entries:entries.map(({id,name,type,size,hash,library})=>({id,name:cleanName(name),type,size,hash,library})),files});const metadata=new TextEncoder().encode(JSON.stringify(manifest));if(metadata.length>MAX_META)throw new Error('Attachment manifest is too large.');const header=new Uint8Array(HEADER);header.set(magic);new DataView(header.buffer).setUint32(8,metadata.length,true);header.set(new Uint8Array(await crypto.subtle.digest('SHA-256',metadata)),12);const parts=[new Blob([header,metadata]),...contents.values()],size=parts.reduce((sum,p)=>sum+p.size,0);if(!Number.isSafeInteger(size)||size>MAX_ARCHIVE)throw new Error('Attachment archive exceeds the browser’s numeric file-size range.');return {parts,size,manifest};}
    async function exportFile(handle){return store.during(async()=>{const {parts,size,manifest}=await archiveParts();check();const filename='StudyDirector-Attachments.sdattachments';if(!handle){if(size>DOWNLOAD_MAX)throw new Error('This archive exceeds the 128 MiB download fallback. Use a browser with Save As file access for larger archives.');processing.download(new Blob(parts,{type:'application/octet-stream'}),filename);status('Attachment archive download started. It is not encrypted.');return;}let writer=null,closed=false;try{writer=await handle.createWritable({keepExistingData:false});for(const file of parts)for(let offset=0;offset<file.size;offset+=CHUNK){check();status('Writing attachment archive…');await writer.write(await file.slice(offset,offset+CHUNK).arrayBuffer());}check();await writer.close();closed=true;const parsed=await inspect(await handle.getFile());if(JSON.stringify(parsed.manifest)!==JSON.stringify(manifest))throw new Error('Saved archive manifest did not match.');for(const [hash,file] of parsed.contents){check();if(await processing.run('file.hash',{file})!==hash)throw new Error('Saved attachment archive failed verification.');}status('Attachment archive saved and verified. It is not encrypted.');}catch(error){if(writer&&!closed)await writer.abort().catch(()=>{});if(closed)error.message+=' The destination was written; verify or replace it before relying on it.';throw error;}});}
    const referenceType=ref=>ref?.kind==='note'?'Note':ref?.kind==='day'?'Saved Day Reflection':ref?.kind==='session'?'Session Reflection':'Reference';
    const referenceLabel=ref=>{const type=referenceType(ref);if(ref?.kind==='note')return `${type} · ${ref.label||ref.key}`;if(ref?.kind==='day')return `${type} · ${ref.key}`;if(ref?.kind==='session'){const detail=String(ref.label||'').replace(/^Session reflection\s*·\s*/i,'')||String(ref.key||'');return detail?`${type} · ${detail}`:type;}return String(ref?.label||type);};
    async function openReference(ref,refBox){
      if(ref.kind==='session'){
        let referencePreview=refBox.querySelector('.attachment-reference-preview');
        if(!referencePreview){referencePreview=element('div',undefined,'attachment-reference-preview');refBox.append(referencePreview);}
        p.renderReference(referencePreview,ref);return true;
      }
      const opened=await p.openSource(ref);
      if(opened===false){invalidate();status(`This referenced ${referenceType(ref)} is no longer available.`);return false;}
      return true;
    }
    async function references(id,options){return (await p.sources(options)).filter(source=>source.ids.has(id));}
    async function count(){return (await logicalRows()).length;}
    async function inventory(){return store.list();}
    async function verifyMetadata(rows){p.requireOwner();return store.verifyMetadata(rows);}
    async function removeMetadata(ids){
      p.requireOwner();store.requireAvailable();
      const unique=[...new Set((ids||[]).map(value=>String(value||'')).filter(validId))];
      if(!unique.length)return Object.freeze({status:'completed',removed:0});
      const before=new Map((await store.list()).filter(row=>unique.includes(row.id)).map(row=>[row.id,row])),record=unique.filter(id=>before.get(id)?.library===true);
      const guard=await p.deletionGuard({allowLibraryClearJournal:true});
      const removed=await store.removeMetadata(unique,guard,{deletionState:{record}}),result=Object.freeze({status:'completed',removed});
      if(!result||result.status!=='completed')throw new Error(result?.reason==='active-editor-or-file-operation'?'Close open attachment/file operations and try again.':'Attachment metadata deletion could not obtain safe storage access.');
      invalidate();return result;
    }
    async function restoreMetadata(rows){p.requireOwner();const values=Array.isArray(rows)?rows:[],restored=await store.restoreMetadata(values,{deletionState:{clear:values.map(row=>row?.id).filter(Boolean)}});invalidate();return restored;}
    async function sweepOrphans(){
      p.requireOwner();store.requireAvailable();
      const result=await store.collect(async gc=>Object.freeze({status:'completed',swept:await gc.sweep()}));
      if(!result||result.status!=='completed')throw new Error(result?.reason==='active-editor-or-file-operation'?'Close open attachment/file operations and try again.':'Attachment storage cleanup could not obtain safe storage access.');
      return Math.max(0,Number(result.swept)||0);
    }
    async function remove(id,knownLibrary=null){
      p.requireOwner();
      const initialRefs=await references(id),wasLibrary=typeof knownLibrary==='boolean'?knownLibrary:initialRefs.length===0;
      if(initialRefs.length){
        const decision=await interactions.choose({
          title:'Attachment is in use',danger:true,
          message:`This attachment is used in ${initialRefs.length} place${initialRefs.length===1?'':'s'}.`,
          details:['Review references before deleting, or remove this attachment from every surviving reference and delete it.'],
          cancelLabel:'Cancel',
          choices:[
            {value:'review',label:'Review references',description:'Keep the attachment and inspect where it is used.'},
            {value:'remove',label:'Remove references & delete',kind:'danger',description:'Remove this attachment from every surviving reference, then delete it.'}
          ]
        });
        if(!decision)return false;
        if(decision==='review'){status(`Used in ${initialRefs.length} place${initialRefs.length===1?'':'s'}. Choose a reference below to open it.`);return false;}
        if(decision!=='remove')return false;
      }else if(!await interactions.confirm({title:'Delete attachment?',message:'This permanently removes the library entry. It cannot be undone.',confirmLabel:'Delete attachment',cancelLabel:'Keep attachment'}))return false;
      let cleanupPending=false;
      const quiesce=typeof p.quiesce==='function'?p.quiesce:(work=>work());
      await batch(async()=>{
        await quiesce(()=>p.runExclusive('delete-attachment',async authority=>{
          const assertAuthority=options=>{if(authority&&typeof authority.assert==='function')authority.assert(options);};
          assertAuthority();p.requireOwner();await p.settle();assertAuthority();let referenceChange=null;
          const rollbackIfPresent=async error=>{
            if(!referenceChange?.rollback)return error;
            let present=false;
            try{assertAuthority({allowDurableProtected:true});present=(await store.list()).some(row=>row.id===id);assertAuthority({allowDurableProtected:true});}
            catch(checkError){return new Error((error?.message||error)+' Attachment metadata could not be verified, so removed references were not automatically restored: '+(checkError?.message||checkError));}
            if(!present)return error;
            try{assertAuthority({allowDurableProtected:true});await referenceChange.rollback();assertAuthority({allowDurableProtected:true});return error;}
            catch(rollbackError){return new Error((error?.message||error)+' Automatic reference rollback also failed: '+(rollbackError?.message||rollbackError));}
          };
          try{
            const refs=await references(id,{includeLive:false});
            if(refs.length){
              assertAuthority();
              referenceChange=await p.removeReferences(id,refs);
              if(!referenceChange)throw new Error('Attachment references could not be changed safely.');
              assertAuthority();
              const remaining=await references(id,{includeLive:false});
              if(remaining.length)throw new Error('Attachment references changed before deletion. The attachment was kept.');
            }
            assertAuthority();
            const guard=await p.deletionGuard();assertAuthority();const removed=await store.removeMetadata([id],guard,{deletionState:{record:wasLibrary?[id]:[]}});assertAuthority();
            let swept=0,sweepPending=false;
            try{const cleanup=await store.collect(async gc=>({status:'completed',swept:await gc.sweep()}));swept=cleanup?.swept||0;sweepPending=cleanup?.status!=='completed';}catch{sweepPending=true;}
            const result={status:'completed',removed,swept,sweepPending};
            if(!result||result.status!=='completed')throw new Error(result?.reason==='active-editor-or-file-operation'?'Close open note editors and finish other file operations before deleting.':'Attachment deletion could not obtain safe storage access.');
            if(!result.removed){
              const present=(await store.list()).some(row=>row.id===id);
              if(present)throw new Error('Attachment storage changed before deletion completed. The attachment was kept.');
            }
            cleanupPending=!!result.sweepPending;
          }catch(error){
            if(referenceChange?.rollback){try{assertAuthority({allowDurableProtected:true});}catch{return Promise.reject(error);}}
            throw await rollbackIfPresent(error);
          }
        }),{sources:initialRefs});
        invalidate();
      });
      status(cleanupPending?'Attachment deleted. Storage cleanup will finish automatically.':'Attachment deleted.');return true;
    }
    function discardPreparedDetail(prepared){if(prepared?.url)URL.revokeObjectURL(prepared.url);prepared?.release?.();}
    async function prepareDetail(id,row,epoch){
      const release=row?await store.retain():()=>{};
      try{return {...await buildDetail(id,row,epoch),release};}catch(error){release();throw error;}
    }
    async function buildDetail(id,row,epoch){
      const content=document.createDocumentFragment();
      if(!row){content.append(element('p','Select an attachment.','ui-status'));return {content,url:''};}
      const issue=integrityIssue(id);
      content.append(element('h3',row.name||'Note image','attachment-name'),element('p',`${row.type.replace('application/','')} · ${sizeLabel(row.size)}`,'ui-helper'));
      if(issue)content.append(element('p',integrityMessage(issue),'ui-status err attachment-integrity-detail'));
      const stateRow=element('div',undefined,'attachment-state-row'),usageChip=element('span','Not currently used','attachment-state-chip'),retentionChip=element('span',row.library?'Retained independently':'Removed when unused','attachment-state-chip');
      if(row.library)retentionChip.classList.add('is-retained');stateRow.append(usageChip,retentionChip);content.append(stateRow);
      const actions=element('div',undefined,'attachment-actions'),preview=element('div');preview.id='attachment-preview';content.append(actions,preview);
      content.append(element('p',row.library?'This attachment is retained independently. Remove independent retention if you want it to be eligible for cleanup after its last reference is removed.':'This attachment is kept while it is used. Retain it independently if you want it to remain after its last reference is removed.','ui-helper'));
      actions.append(button(row.library?'Remove independent retention':'Retain independently',()=>operation(async()=>{p.requireOwner();await store.setLibrary(id,!row.library);status(row.library?'Independent retention removed.':'Attachment retained independently.');return true;}),true,'retention'));
      actions.append(
        button('Rename',()=>operation(async()=>{const answer=await interactions.input({title:'Rename attachment',inputLabel:'Name',value:row.name||'Note image',defaultValue:row.name||'Note image',maxLength:160,required:true,confirmLabel:'Rename'});if(!answer)return false;p.requireOwner();await store.rename(id,cleanName(answer.value));status('Attachment renamed.');return true;}),true,'rename'),
        button('Delete',()=>operation(()=>remove(id,row.library===true),{refresh:false}),true,'delete')
      );
      const sources=await p.sources(),refs=sources.filter(r=>r.ids.has(id));if(epoch!==generation)return {stale:true,content,url:''};
      usageChip.textContent=refs.length?`Used in ${refs.length} place${refs.length===1?'':'s'}`:'Not currently used';if(refs.length)usageChip.classList.add('is-used');
      const refBox=element('div',undefined,'attachment-references');for(const ref of refs)refBox.append(button(referenceLabel(ref),()=>openReference(ref,refBox),false,`reference-${ref.kind}-${ref.key||'source'}`));if(refs.length)content.append(refBox);
      const destinations=await p.destinations();if(epoch!==generation)return {stale:true,content,url:''};
      if(destinations.length&&!issue){const linking=element('div',undefined,'attachment-actions attachment-insert-actions'),selector=element('select',undefined,'ui-field');selector.setAttribute('aria-label','Note for attachment');for(const destination of destinations){const option=element('option',destination.label);option.value=destination.key;selector.append(option);}const image=imageTypes.has(row.type),audio=audioTypes.has(row.type),inline=image||audio;linking.append(selector,button(inline?'Insert in note':'Add link to note',()=>operation(()=>{const quiesce=typeof p.quiesce==='function'?p.quiesce:(work=>work());return quiesce(()=>store.during(async()=>{p.requireOwner();if(!await store.get(id))throw new Error('This attachment is no longer available.');await p.insert(selector.value,row);status(image?'Image inserted in note.':audio?'Audio inserted in note.':'Attachment link added to note.');return true;}),{notes:true});}),true,'insert'));content.append(linking);}else if(!destinations.length&&!issue)content.append(element('p','Create a note above to use this attachment.','ui-helper'));
      if(issue&&['missing-file','size-mismatch'].includes(issue.kind))return {content,url:''};
      const file=await store.get(id);if(epoch!==generation)return {stale:true,content,url:''};if(!file)throw new Error('Attachment is missing.');const nextUrl=URL.createObjectURL(file);
      const download=element('a','Download','mini-btn ui-btn');download.href=nextUrl;download.download=row.name||'attachment';download.addEventListener('click',()=>{void store.retain().catch(reportError);},{once:true});download.addEventListener('click',()=>{const notice=notifications.begin({id:'attachment-download',title:'Download attachment',surfaceId:'attachment-status',announce:false});notice.finish('succeeded','Download started for '+(row.name||'attachment')+'.');});actions.append(download);
      if(imageTypes.has(row.type)){const img=element('img');img.src=nextUrl;img.alt=row.name||'Attachment preview';preview.append(img);}
      else if(audioTypes.has(row.type)){const audio=element('audio');audio.controls=true;audio.preload='metadata';audio.src=nextUrl;audio.addEventListener('error',()=>{if(url===nextUrl)notifications.feedback({id:'audio-playback',surfaceId:'attachment-status',severity:'warning',lifecycle:'failed',title:'Audio playback unavailable',message:'This browser cannot play this audio format. Download it to use another player.'});});audio.addEventListener('loadedmetadata',()=>{if(url===nextUrl)notifications.feedback({id:'audio-playback',lifecycle:'resolved'});});preview.append(audio);}
      else{const open=button('Open PDF',async()=>{const release=await store.retain();try{return p.openPdf(row,file,null,release);}catch(error){release();throw error;}},false,'open-pdf');preview.append(open,element('p','Opens with your browser’s PDF viewer.','ui-helper'));}
      return {content,url:nextUrl};
    }
    function commitDetail(prepared){
      const panel=byId('attachment-detail');if(!panel){discardPreparedDetail(prepared);return false;}const oldRelease=previewRelease,oldUrl=url,oldAudio=panel.querySelector?.('audio');if(oldAudio){oldAudio.pause();oldAudio.removeAttribute('src');oldAudio.load();}
      panel.replaceChildren(prepared.content);previewRelease=prepared.release;oldRelease?.();url=prepared.url||'';if(oldUrl&&oldUrl!==url)URL.revokeObjectURL(oldUrl);controls();return true;
    }
    async function select(id){
      selected=id;refreshSequence++;const epoch=++generation;if(!byId('library-attachments').open||(p.isActive&&!p.isActive()))return false;
      document.querySelectorAll('#attachment-list [data-attachment-id]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.attachmentId===id)));
      const row=rows.find(r=>r.id===id);try{const prepared=await prepareDetail(id,row,epoch);if(prepared.stale||epoch!==generation){discardPreparedDetail(prepared);return false;}notifications.feedback({id:'attachment-access',lifecycle:'resolved'});return commitDetail(prepared);}catch(error){if(epoch===generation)reportError(error);return false;}
    }
    function renderAttachmentList(sourceRows=rows,activeId=selected){
      const list=byId('attachment-list');if(!list)return false;const scrollTop=list.scrollTop||0,query=byId('attachment-search').value.trim().toLowerCase(),matching=sourceRows.filter(r=>(r.name||'Note image').toLowerCase().includes(query)),fragment=document.createDocumentFragment();
      for(const itemRow of matching.slice(0,visibleCount)){const item=button(itemRow.name||'Note image',()=>select(itemRow.id),false,`attachment-row-${itemRow.id}`),issue=integrityIssue(itemRow.id);item.classList.add('attachment-item');if(issue)item.classList.add('integrity-issue');item.dataset.attachmentId=itemRow.id;item.setAttribute('aria-pressed',String(itemRow.id===activeId));item.append(element('small',`${sizeLabel(itemRow.size)} · ${itemRow.type.replace('application/','')}`));if(issue)item.append(element('small',integrityLabel(issue),'attachment-integrity-note'));fragment.append(item);}
      if(matching.length>visibleCount)fragment.append(button('Show more',()=>{visibleCount+=100;renderAttachmentList();return true;}));if(!fragment.childNodes.length)fragment.append(element('p',sourceRows.length?'No matching attachments.':'Add images, PDFs or audio.','ui-status'));
      list.replaceChildren(fragment);list.scrollTop=scrollTop;return true;
    }
    async function refresh(){
      if(!installed)return false;
      if(refreshHold){pendingInvalidation=true;return false;}
      const sequence=++refreshSequence;
      try{
        const previousRows=rows,oldIndex=previousRows.findIndex(row=>row.id===selected),list=byId('attachment-list'),panel=byId('attachment-detail'),listScroll=list?.scrollTop||0,panelScroll=panel?.scrollTop||0,active=document.activeElement,focusAction=active?.closest?.('#library-attachments [data-attachment-action]')?.dataset?.attachmentAction||'';
        const loaded=await logicalRows();if(sequence!==refreshSequence)return false;
        let nextSelected=selected;if(nextSelected&&!loaded.some(row=>row.id===nextSelected))nextSelected=loaded.length?loaded[Math.min(Math.max(oldIndex,0),loaded.length-1)].id:'';
        rows=loaded;selected=nextSelected;const count=byId('attachment-count');if(count)count.textContent=`· ${rows.length}`;
        if(!byId('library-attachments').open||(p.isActive&&!p.isActive()))return true;
        const row=loaded.find(item=>item.id===nextSelected),epoch=++generation,prepared=await prepareDetail(nextSelected,row,epoch);
        if(sequence!==refreshSequence||epoch!==generation||prepared.stale||!byId('library-attachments').open||(p.isActive&&!p.isActive())){discardPreparedDetail(prepared);return false;}
        renderAttachmentList(rows,selected);commitDetail(prepared);
        if(list)list.scrollTop=listScroll;if(panel)panel.scrollTop=panelScroll;if(focusAction){const target=[...document.querySelectorAll('#library-attachments [data-attachment-action]')].find(node=>node.dataset.attachmentAction===focusAction);target?.focus?.({preventScroll:true});}controls();return true;
      }catch(error){reportError(error);return false;}
    }
    function install(){if(installed)return;installed=true;byId('library-attachments').addEventListener('toggle',()=>{if(byId('library-attachments').open)void refresh();else closePreview();});byId('attachment-search').addEventListener('input',()=>{visibleCount=100;renderAttachmentList();});byId('attachment-add').addEventListener('click',()=>{try{store.requireAvailable();byId('attachment-files').click();}catch(error){reportError(error);}});byId('attachment-files').addEventListener('change',event=>{const files=[...event.target.files];event.target.value='';if(files.length)void operation((signal,notice)=>upload(files,{signal,notice}),{processingJob:false});});byId('attachment-import').addEventListener('click',()=>byId('attachment-archive').click());byId('attachment-archive').addEventListener('change',event=>{const file=event.target.files[0];event.target.value='';if(file)void operation(async signal=>{const data=await inspect(file);if(!await interactions.confirm({title:'Import attachment library?',message:`Add ${data.manifest.entries.length} entries. Matching identities keep their existing labels.`,confirmLabel:'Import library'}))return false;await importFile(file,{signal});return true;});});byId('attachment-export').addEventListener('click',()=>void operation(async _signal=>{if(!await interactions.confirm({title:'Export unencrypted attachments?',message:'This separate attachment archive is not password protected, even when study-data backup encryption is enabled. Store it securely.',confirmLabel:'Export unencrypted',cancelLabel:'Cancel'}))return false;const handle=await processing.chooseSave('StudyDirector-Attachments.sdattachments',{'application/octet-stream':['.sdattachments']});await exportFile(handle);return true;},{refresh:false,cleanup:false}));byId('attachment-cancel').addEventListener('click',()=>{activeIngestController?.abort();if(activeProcessingJob){cancelled=true;processing.cancel();}});document.addEventListener('click',event=>{const href=event.target.closest?.('a[href]')?.getAttribute('href');const match=/^#attachment=((?:att|img)-[a-z0-9-]{20,80})$/.exec(href||'');if(match){event.preventDefault();event.stopImmediatePropagation();const reservedPdfWindow=p.preparePdfOpen?.()||null;void open(match[1],reservedPdfWindow).catch(reportError);}},true);}
    async function open(id,reservedPdfWindow=null){
      const closeReserved=()=>{if(!reservedPdfWindow)return;try{if(!reservedPdfWindow.closed)reservedPdfWindow.close();}catch{}};
      try{const row=(await store.list()).find(item=>item.id===id);if(row?.type==='application/pdf'){const release=await store.retain();try{const file=await store.get(id);if(!file)throw new Error('Attachment is missing.');return p.openPdf(row,file,reservedPdfWindow,release);}catch(error){release();throw error;}}closeReserved();p.openLibrary();byId('library-attachments').open=true;selected=id;void refresh();byId('library-attachments').scrollIntoView({block:'start'});return true;}catch(error){closeReserved();throw error;}
    }
    return Object.freeze({status:()=>Object.freeze({busy:busy||ingestBusy}),install,refresh,reconcile,invalidate,batch,open,close:closePreview,upload,add,importFile,exportFile,archiveParts,references,count,inventory,verifyMetadata,removeMetadata,restoreMetadata,sweepOrphans,remove,select});
  }
  return Object.freeze({format:'study-director.attachments-module',contractVersion:1,create,createReferenceCoordinator,identify,inspect,checkManifest,validId,validType,limitForType,sizeLabel,limits:Object.freeze({maxFile:MAX_PDF_AUDIO,maxImage:MAX_IMAGE,maxPdfAudio:MAX_PDF_AUDIO,maxArchive:MAX_ARCHIVE,maxEntries:MAX_ENTRIES,chunkBytes:CHUNK,downloadMax:DOWNLOAD_MAX})});
});
})();
