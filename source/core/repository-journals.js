(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('repository-journals',1,()=>{
  const freeze=Object.freeze;
  // Version 5 renamed the note deletion list to noteDeletions.
  const RESTORE_JOURNAL_VERSION=5;
  function exactValue(value,keys){return !!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|'));}
  function createAppMetaValidators(input){
    exactObject(input,['limits'],'Repository journal appMeta validators input');
    if(!Object.isFrozen(input.limits))throw new TypeError('Repository journal appMeta limits must be frozen.');
    const APP_LIMITS=input.limits,iso=value=>Number.isFinite(Date.parse(String(value||'')));
    const backupFile=value=>!!(value&&exactValue(value,['name','size','hash'])&&/^backup-[a-f0-9-]{36}$/u.test(String(value.name||''))&&Number.isSafeInteger(Number(value.size))&&Number(value.size)>0&&Number(value.size)<=APP_LIMITS.backupMaxFileBytes&&/^[a-f0-9]{64}$/u.test(String(value.hash||'')));
    const blob=value=>!!(value&&typeof value.arrayBuffer==='function'&&Number.isFinite(Number(value.size))&&Number(value.size)>0&&Number(value.size)<=(APP_LIMITS.backupMaxFileBytes||APP_LIMITS.backupMaxCompressedBytes));
    const savedDeletions=value=>Array.isArray(value)&&value.length<=APP_LIMITS.maxImportRecords&&value.every(entry=>entry&&exactValue(entry,['date','deletedAt'])&&/^\d{4}-\d{2}-\d{2}$/u.test(String(entry.date||''))&&iso(entry.deletedAt));
    const noteDeletions=value=>Array.isArray(value)&&value.length<=APP_LIMITS.maxNotes&&value.every(entry=>entry&&exactValue(entry,['key','deletedAt'])&&String(entry.key||'').trim()&&iso(entry.deletedAt));
    const attachmentDeletions=value=>Array.isArray(value)&&value.length<=50000&&value.every(entry=>entry&&exactValue(entry,['assetId','deletedAt'])&&/^(?:att|img)-[a-z0-9-]{20,80}$/u.test(String(entry.assetId||''))&&iso(entry.deletedAt));
    return freeze({
      libraryClearJournalState:value=>!!(value&&exactValue(value,['format','version','id','phase','chunkCount','byteLength','sha256','signatureHash','createdAt','updatedAt'])&&value.format==='study-director.library-clear-journal'&&Number(value.version)===1&&/^libraryclear_[a-z0-9_-]{8,96}$/u.test(String(value.id||''))&&/^[a-z][a-z0-9-]{1,48}$/u.test(String(value.phase||''))&&Number.isSafeInteger(value.chunkCount)&&value.chunkCount>0&&Number.isSafeInteger(value.byteLength)&&value.byteLength>0&&/^[a-f0-9]{64}$/u.test(String(value.sha256||''))&&/^[a-f0-9]{64}$/u.test(String(value.signatureHash||''))&&iso(value.createdAt)&&iso(value.updatedAt)),
      libraryClearJournalPayloadPrefix:(value,context)=>!!(value&&exactValue(value,['format','version','id','index','bytes'])&&value.format==='study-director.library-clear-journal'&&Number(value.version)===1&&/^libraryclear_[a-z0-9_-]{8,96}$/u.test(String(value.id||''))&&Number.isSafeInteger(Number(value.index))&&Number(value.index)>=0&&(value.bytes instanceof Uint8Array||value.bytes instanceof ArrayBuffer)&&context.suffix===`${String(value.id)}:${String(value.index).padStart(8,'0')}`),
      restoreJournalState:value=>!!(value&&exactValue(value,['format','version','id','phase','createdAt','updatedAt'])&&value.format==='study-director.restore-journal'&&Number(value.version)===1&&/^restore_[a-z0-9_-]{8,96}$/u.test(String(value.id||''))&&/^[a-z][a-z0-9-]{1,48}$/u.test(String(value.phase||''))&&iso(value.createdAt)&&iso(value.updatedAt)),
      restoreJournalPayload:value=>{
        if(!value||value.format!=='study-director.restore-journal'||!/^restore_[a-z0-9_-]{8,96}$/u.test(String(value.id||''))||(!backupFile(value.backupFile)&&!blob(value.blob))||typeof value.filename!=='string'||value.filename.length>APP_LIMITS.maxBackupFilenameChars||typeof value.scheduleText!=='string'||value.scheduleText.length>APP_LIMITS.maxScheduleChars)return false;
        const storageKey=value.backupFile?'backupFile':'blob';
        return Number(value.version)===RESTORE_JOURNAL_VERSION&&exactValue(value,['format','version','id',storageKey,'filename','scheduleText','savedDayDeletions','noteDeletions','attachmentDeletions'])&&savedDeletions(value.savedDayDeletions)&&noteDeletions(value.noteDeletions)&&attachmentDeletions(value.attachmentDeletions);
      },
      mutationLease:value=>!!(value&&exactValue(value,['format','version','id','owner','kind','expiresAt','updatedAt'])&&value.format==='study-director.mutation-lease'&&Number(value.version)===1&&/^mutation_[a-z0-9_-]{8,96}$/u.test(String(value.id||''))&&/^tab_[a-z0-9_-]{8,160}$/u.test(String(value.owner||''))&&/^[a-z][a-z0-9-]{0,47}$/u.test(String(value.kind||''))&&Number.isFinite(Number(value.expiresAt))&&Number(value.expiresAt)>0&&iso(value.updatedAt))
    });
  }
  function create(input){
    exactObject(input,['appMeta','limits','helpers','clock'],'Repository journals input');
    if(!Object.isFrozen(input.appMeta)||!Object.isFrozen(input.limits))throw new TypeError('Repository journal contracts must be frozen.');
    if(input.appMeta.format!=='study-director.app-meta-owner'||input.appMeta.contractVersion!==1||input.appMeta.owner!=='repository-journals')throw new TypeError('Repository journal appMeta capability is invalid.');
    functions(input.helpers,['clampText'],'Repository journal helper contract');functions(input.clock,['nowMs'],'Repository journal clock');
    const APP_LIMITS=input.limits,Meta=input.appMeta,clampText=input.helpers.clampText,decisionNowMs=input.clock.nowMs;
    const LIBRARY_CLEAR_JOURNAL_FORMAT='study-director.library-clear-journal',LIBRARY_CLEAR_JOURNAL_CHUNK_BYTES=512*1024;
    function validLibraryClearJournalId(value){return /^libraryclear_[a-z0-9_-]{8,96}$/u.test(String(value||''));}
    function libraryChunkSuffix(id,index){return `${String(id)}:${String(index).padStart(8,'0')}`;}
    function libraryClearDigest(bytes){if(!globalThis.crypto?.subtle)throw new Error('Library-clear journal integrity verification is unavailable.');return globalThis.crypto.subtle.digest('SHA-256',bytes).then(buffer=>Array.from(new Uint8Array(buffer),value=>value.toString(16).padStart(2,'0')).join(''));}
    async function prepareLibraryClearJournal(value={}){
      const id=String(value.id||'');if(!validLibraryClearJournalId(id)||!value.payload||typeof value.payload!=='object')throw new Error('Library-clear rollback journal input is invalid. No Library data was changed.');
      let bytes;try{bytes=new TextEncoder().encode(JSON.stringify(value.payload));}catch{throw new Error('Library-clear rollback journal could not serialize its safety snapshot. No Library data was changed.');}
      if(!bytes.byteLength)throw new Error('Library-clear rollback journal payload is empty. No Library data was changed.');
      const chunks=[];for(let offset=0;offset<bytes.byteLength;offset+=LIBRARY_CLEAR_JOURNAL_CHUNK_BYTES)chunks.push(bytes.slice(offset,Math.min(bytes.byteLength,offset+LIBRARY_CLEAR_JOURNAL_CHUNK_BYTES)));
      const [sha256,signatureHash]=await Promise.all([libraryClearDigest(bytes),libraryClearDigest(new TextEncoder().encode(String(value.signature||'')))]),now=new Date().toISOString();
      const state={format:LIBRARY_CLEAR_JOURNAL_FORMAT,version:1,id,phase:'prepared',chunkCount:chunks.length,byteLength:bytes.byteLength,sha256,signatureHash,createdAt:now,updatedAt:now};
      return Meta.transaction('readwrite',(meta,tx,finish)=>{
        const stateHandle=meta.get('libraryClearJournalState');stateHandle.request.onerror=()=>finish(false,stateHandle.request.error||new Error('Library-clear journal state read failed'));
        stateHandle.request.onsuccess=()=>{
          let existing;try{existing=stateHandle.value();}catch(error){finish(false,error);return;}if(existing){try{tx.abort();}catch{}finish(false,new Error('An interrupted Library clear still requires recovery. No new Library clear was started.'));return;}
          const chunksHandle=meta.getAll('libraryClearJournalPayloadPrefix');chunksHandle.request.onerror=()=>finish(false,chunksHandle.request.error||new Error('Library-clear journal chunk cleanup failed'));
          chunksHandle.request.onsuccess=()=>{let entries;try{entries=chunksHandle.entries();}catch(error){finish(false,error);return;}for(const entry of entries)meta.remove('libraryClearJournalPayloadPrefix',entry.suffix);meta.put('libraryClearJournalState',state,{updatedAt:now});chunks.forEach((chunk,index)=>meta.put('libraryClearJournalPayloadPrefix',{format:LIBRARY_CLEAR_JOURNAL_FORMAT,version:1,id,index,bytes:chunk},{suffix:libraryChunkSuffix(id,index),updatedAt:now}));tx.oncomplete=()=>finish(true,freeze({state:freeze({...state}),payload:value.payload}));};
        };
      },{strict:true,abortMessage:'Library-clear journal preparation aborted'});
    }
    async function readLibraryClearJournal(){
      const state=await Meta.read('libraryClearJournalState');if(!state)return null;
      const rows=(await Meta.list('libraryClearJournalPayloadPrefix')).filter(entry=>entry.suffix.startsWith(`${state.id}:`)).sort((a,b)=>Number(a.value.index)-Number(b.value.index));
      if(rows.length!==state.chunkCount)throw new Error('The interrupted Library-clear journal is incomplete. Preserve browser storage and restore from an external backup before making changes.');
      let length=0;const chunks=[];for(let index=0;index<rows.length;index++){const value=rows[index].value,raw=value.bytes,chunk=raw instanceof Uint8Array?raw:new Uint8Array(raw);if(value.id!==state.id||value.index!==index)throw new Error('The interrupted Library-clear journal contains invalid payload chunks. Preserve browser storage and restore from an external backup before making changes.');chunks.push(chunk);length+=chunk.byteLength;}
      if(length!==state.byteLength)throw new Error('The interrupted Library-clear journal payload length does not verify. Preserve browser storage and restore from an external backup before making changes.');
      const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}if(await libraryClearDigest(bytes)!==state.sha256)throw new Error('The interrupted Library-clear journal failed integrity verification. Preserve browser storage and restore from an external backup before making changes.');
      let payload;try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('The interrupted Library-clear journal payload is unreadable. Preserve browser storage and restore from an external backup before making changes.');}
      if(await libraryClearDigest(new TextEncoder().encode(String(payload?.planSignature||'')))!==state.signatureHash)throw new Error('The interrupted Library-clear journal plan signature does not verify. Preserve browser storage and restore from an external backup before making changes.');
      return freeze({state:freeze({...state}),payload});
    }
    async function markLibraryClearJournal(id,phase){
      const journalId=String(id||''),cleanPhase=String(phase||'').trim();if(!validLibraryClearJournalId(journalId)||!/^[a-z][a-z0-9-]{1,48}$/u.test(cleanPhase))throw new Error('Library-clear journal phase is invalid.');
      return Meta.transaction('readwrite',(meta,tx,finish)=>{const handle=meta.get('libraryClearJournalState');handle.request.onerror=()=>finish(false,handle.request.error||new Error('Library-clear journal phase read failed'));handle.request.onsuccess=()=>{let current;try{current=handle.value();}catch(error){finish(false,error);return;}if(!current||current.id!==journalId){finish(false,new Error('Library-clear journal identity changed unexpectedly.'));return;}const updated={...current,phase:cleanPhase,updatedAt:new Date().toISOString()};meta.put('libraryClearJournalState',updated,{updatedAt:updated.updatedAt});tx.oncomplete=()=>finish(true,freeze(updated));};},{strict:true,abortMessage:'Library-clear journal phase update aborted'});
    }
    async function clearLibraryClearJournal(id=''){
      const expected=String(id||'');return Meta.transaction('readwrite',(meta,tx,finish)=>{const stateHandle=meta.get('libraryClearJournalState');stateHandle.request.onerror=()=>finish(false,stateHandle.request.error||new Error('Library-clear journal cleanup read failed'));stateHandle.request.onsuccess=()=>{let current;try{current=stateHandle.value();}catch(error){finish(false,error);return;}if(expected&&current&&current.id!==expected){finish(false,new Error('Library-clear journal identity changed before cleanup.'));return;}const target=current&&current.id||expected,chunksHandle=meta.getAll('libraryClearJournalPayloadPrefix');chunksHandle.request.onerror=()=>finish(false,chunksHandle.request.error||new Error('Library-clear journal chunk cleanup failed'));chunksHandle.request.onsuccess=()=>{let entries;try{entries=chunksHandle.entries();}catch(error){finish(false,error);return;}for(const entry of entries)if(!target||entry.suffix.startsWith(`${target}:`))meta.remove('libraryClearJournalPayloadPrefix',entry.suffix);meta.remove('libraryClearJournalState');tx.oncomplete=()=>finish(true);};};},{strict:true,abortMessage:'Library-clear journal cleanup aborted'});
    }
    const RESTORE_JOURNAL_FORMAT='study-director.restore-journal',MUTATION_LEASE_FORMAT='study-director.mutation-lease';
    function validRestoreJournalId(value){return /^restore_[a-z0-9_-]{8,96}$/u.test(String(value||''));}
    function cleanMutationLease(value={}){const id=String(value.id||''),owner=String(value.owner||''),kind=String(value.kind||'mutation').slice(0,48),expiresAt=Math.floor(Number(value.expiresAt)||0);if(!/^mutation_[a-z0-9_-]{8,96}$/u.test(id)||!/^tab_[a-z0-9_-]{8,160}$/u.test(owner)||!/^[a-z][a-z0-9-]{0,47}$/u.test(kind)||expiresAt<=0)return null;return {format:MUTATION_LEASE_FORMAT,version:1,id,owner,kind,expiresAt,updatedAt:new Date().toISOString()};}
    async function acquireMutationLease(value={}){
      const requested=cleanMutationLease(value);if(!requested)throw new Error('The durable mutation lock request is invalid. No changes were made.');
      return Meta.transaction('readwrite',(meta,tx,finish)=>{const handle=meta.get('mutationLease');handle.request.onerror=()=>finish(false,handle.request.error||new Error('durable mutation lock read failed'));handle.request.onsuccess=()=>{let current;try{current=handle.value();}catch(error){finish(false,error);return;}if(current&&current.id!==requested.id&&Number(current.expiresAt)>decisionNowMs()){tx.oncomplete=()=>finish(true,freeze({acquired:false,holder:freeze({...current})}));return;}const put=meta.put('mutationLease',requested,{updatedAt:requested.updatedAt});put.onerror=()=>finish(false,put.error||new Error('durable mutation lock write failed'));tx.oncomplete=()=>finish(true,freeze({acquired:true,lease:freeze({...requested})}));};},{strict:true,abortMessage:'durable mutation lock acquisition aborted'});
    }
    async function releaseMutationLease(id){const expected=String(id||'');if(!/^mutation_[a-z0-9_-]{8,96}$/u.test(expected))return false;return Meta.transaction('readwrite',(meta,tx,finish)=>{let removed=false;const handle=meta.get('mutationLease');handle.request.onerror=()=>finish(false,handle.request.error||new Error('durable mutation lock release read failed'));handle.request.onsuccess=()=>{let current;try{current=handle.value();}catch(error){finish(false,error);return;}if(current&&current.id===expected){meta.remove('mutationLease');removed=true;}tx.oncomplete=()=>finish(true,removed);};},{abortMessage:'durable mutation lock release aborted'});}
    function cleanSavedDayDeletions(values){const source=values===undefined?[]:values;if(!Array.isArray(source)||source.length>APP_LIMITS.maxImportRecords)throw new Error('Restore rollback deletion ledger is invalid.');const byDate=new Map();for(const value of source){const date=String(value&&value.date||''),deletedAt=String(value&&value.deletedAt||'');if(!/^\d{4}-\d{2}-\d{2}$/u.test(date)||!Number.isFinite(Date.parse(deletedAt)))throw new Error('Restore rollback deletion ledger is invalid.');const previous=byDate.get(date);if(!previous||Date.parse(deletedAt)>Date.parse(previous.deletedAt))byDate.set(date,{date,deletedAt:new Date(Date.parse(deletedAt)).toISOString()});}return freeze([...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(value=>freeze(value)));}
    function cleanKeyedDeletions(values,{kind='entry',keyName='key',limit=10000}={}){const source=values===undefined?[]:values;if(!Array.isArray(source)||source.length>limit)throw new Error(`Restore rollback ${kind} deletion ledger is invalid.`);const byKey=new Map();for(const value of source){const key=String(value&&value[keyName]||'').trim(),deletedAt=String(value&&value.deletedAt||'');if(!key||!Number.isFinite(Date.parse(deletedAt)))throw new Error(`Restore rollback ${kind} deletion ledger is invalid.`);const previous=byKey.get(key),clean={[keyName]:key,deletedAt:new Date(Date.parse(deletedAt)).toISOString()};if(!previous||Date.parse(clean.deletedAt)>Date.parse(previous.deletedAt))byKey.set(key,clean);}return freeze([...byKey.values()].sort((a,b)=>String(a[keyName]).localeCompare(String(b[keyName]))).map(value=>freeze(value)));}
    async function prepareRestoreJournal(value={}){
      const id=String(value.id||''),blob=value.blob,backupFile=value.backupFile,fileValid=backupFile&&/^backup-[a-f0-9-]{36}$/u.test(backupFile.name)&&Number.isSafeInteger(backupFile.size)&&backupFile.size>0&&/^[a-f0-9]{64}$/u.test(backupFile.hash);if(!validRestoreJournalId(id)||(!fileValid&&(!blob||typeof blob.arrayBuffer!=='function'||!Number.isFinite(Number(blob.size))||Number(blob.size)>(APP_LIMITS.backupMaxFileBytes||APP_LIMITS.backupMaxCompressedBytes))))throw new Error('Restore rollback journal input is invalid. No restore changes were made.');
      const savedDayDeletions=cleanSavedDayDeletions(value.savedDayDeletions),noteDeletions=cleanKeyedDeletions(value.noteDeletions,{kind:'Note',keyName:'key',limit:APP_LIMITS.maxNotes}),attachmentDeletions=cleanKeyedDeletions(value.attachmentDeletions,{kind:'Attachment',keyName:'assetId',limit:50000}),now=new Date().toISOString(),state={format:RESTORE_JOURNAL_FORMAT,version:1,id,phase:'prepared',createdAt:now,updatedAt:now},payload={format:RESTORE_JOURNAL_FORMAT,version:RESTORE_JOURNAL_VERSION,id,...(fileValid?{backupFile}:{blob}),filename:clampText(value.filename||'safety-copy.sdbackup',APP_LIMITS.maxBackupFilenameChars),scheduleText:clampText(value.scheduleText||'',APP_LIMITS.maxScheduleChars),savedDayDeletions,noteDeletions,attachmentDeletions};
      return Meta.transaction('readwrite',(meta,tx,finish)=>{
        // Both halves are checked inside the same durable transaction. Even an
        // orphaned half must stop preparation: it may be the only recovery proof.
        const header=meta.get('restoreJournalState'),body=meta.get('restoreJournalPayload');
        let read=0;
        const fail=error=>{try{tx.abort();}catch{}finish(false,error);};
        const check=()=>{
          if(++read!==2)return;
          let currentHeader,currentBody;
          try{currentHeader=header.value();currentBody=body.value();}catch(error){fail(error);return;}
          if(currentHeader||currentBody){fail(new Error('An interrupted restore still requires recovery. No new restore journal was started.'));return;}
          try{
            meta.put('restoreJournalState',state,{updatedAt:now});
            meta.put('restoreJournalPayload',payload,{updatedAt:now});
            tx.oncomplete=()=>finish(true,freeze({state,payload}));
          }catch(error){fail(error);}
        };
        header.request.onsuccess=check;body.request.onsuccess=check;
        header.request.onerror=()=>fail(header.request.error||new Error('Restore journal state read failed.'));
        body.request.onerror=()=>fail(body.request.error||new Error('Restore journal payload read failed.'));
      },{strict:true,abortMessage:'restore journal preparation aborted'});
    }
    async function readRestoreJournal(){
      return Meta.transaction('readonly',(meta,tx,finish)=>{
        const header=meta.get('restoreJournalState'),body=meta.get('restoreJournalPayload');
        let read=0;
        const fail=error=>finish(false,error);
        const check=()=>{
          if(++read!==2)return;
          try{
            const state=header.value(),payload=body.value();
            if(!state&&!payload){tx.oncomplete=()=>finish(true,null);return;}
            if(!state||!payload||state.format!==RESTORE_JOURNAL_FORMAT||payload.format!==RESTORE_JOURNAL_FORMAT||state.version!==1||Number(payload.version)!==RESTORE_JOURNAL_VERSION||!validRestoreJournalId(state.id)||state.id!==payload.id||(!payload.backupFile&&(!payload.blob||typeof payload.blob.arrayBuffer!=='function')))throw new Error('The interrupted-restore journal is incomplete or corrupted. Preserve browser storage and use an external backup before making changes.');
            const savedDayDeletions=cleanSavedDayDeletions(payload.savedDayDeletions),noteDeletions=cleanKeyedDeletions(payload.noteDeletions,{kind:'Note',keyName:'key',limit:APP_LIMITS.maxNotes}),attachmentDeletions=cleanKeyedDeletions(payload.attachmentDeletions,{kind:'Attachment',keyName:'assetId',limit:50000});
            const result=freeze({state:freeze({...state}),payload:freeze({...payload,savedDayDeletions,noteDeletions,attachmentDeletions})});
            tx.oncomplete=()=>finish(true,result);
          }catch(error){fail(error);}
        };
        header.request.onsuccess=check;body.request.onsuccess=check;
        header.request.onerror=()=>fail(header.request.error||new Error('Restore journal state read failed.'));
        body.request.onerror=()=>fail(body.request.error||new Error('Restore journal payload read failed.'));
      },{abortMessage:'Restore journal read aborted'});
    }
    async function markRestoreJournal(id,phase){const journalId=String(id||''),cleanPhase=String(phase||'').trim();if(!validRestoreJournalId(journalId)||!/^[a-z][a-z0-9-]{1,48}$/u.test(cleanPhase))throw new Error('Restore journal phase is invalid.');return Meta.transaction('readwrite',(meta,tx,finish)=>{const handle=meta.get('restoreJournalState');handle.request.onerror=()=>finish(false,handle.request.error||new Error('restore journal phase read failed'));handle.request.onsuccess=()=>{let current;try{current=handle.value();}catch(error){finish(false,error);return;}if(!current||current.id!==journalId){finish(false,new Error('Restore journal identity changed unexpectedly.'));return;}const updated={...current,phase:cleanPhase,updatedAt:new Date().toISOString()};meta.put('restoreJournalState',updated,{updatedAt:updated.updatedAt});tx.oncomplete=()=>finish(true,freeze(updated));};},{strict:true,abortMessage:'restore journal phase update aborted'});}
    async function clearRestoreJournal(id=''){
      const expected=String(id||'');
      return Meta.transaction('readwrite',(meta,tx,finish)=>{
        const header=meta.get('restoreJournalState'),body=meta.get('restoreJournalPayload');
        let read=0;
        const fail=error=>{try{tx.abort();}catch{}finish(false,error);};
        const check=()=>{
          if(++read!==2)return;
          let state,payload;
          try{state=header.value();payload=body.value();}catch(error){fail(error);return;}
          if(!!state!==!!payload||state&&payload&&state.id!==payload.id){fail(new Error('Restore journal is incomplete or mismatched. Recovery evidence was preserved.'));return;}
          if(expected&&state&&state.id!==expected){fail(new Error('Restore journal identity changed before cleanup.'));return;}
          try{
            if(state){meta.remove('restoreJournalState');meta.remove('restoreJournalPayload');}
            tx.oncomplete=()=>finish(true,true);
          }catch(error){fail(error);}
        };
        header.request.onsuccess=check;body.request.onsuccess=check;
        header.request.onerror=()=>fail(header.request.error||new Error('Restore journal state cleanup read failed.'));
        body.request.onerror=()=>fail(body.request.error||new Error('Restore journal payload cleanup read failed.'));
      },{strict:true,abortMessage:'restore journal cleanup aborted'});
    }
    return freeze({format:'study-director.repository-journal-set',contractVersion:1,restoreJournal:freeze({prepare:prepareRestoreJournal,read:readRestoreJournal,diagnostics:()=>Meta.read('restoreJournalState'),mark:markRestoreJournal,clear:clearRestoreJournal}),libraryClearJournal:freeze({prepare:prepareLibraryClearJournal,read:readLibraryClearJournal,diagnostics:()=>Meta.read('libraryClearJournalState'),mark:markLibraryClearJournal,clear:clearLibraryClearJournal}),mutationLease:freeze({acquire:acquireMutationLease,release:releaseMutationLease})});
  }
  return freeze({format:'study-director.repository-journals',contractVersion:1,createAppMetaValidators,create});
});
})();
