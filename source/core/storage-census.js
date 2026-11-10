(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
// What this site's browser storage holds, measured by the app itself, and a
// small record of the database's life kept outside it. Counts, sizes, times
// and error names only: never a name, key or piece of content. The census is
// read-only: it writes, locks and deletes nothing. A part that runs out of
// time reports what it counted so far as partial.
registry.define('storage-census',1,()=>{
  const freeze=Object.freeze;
  const STORE_FIELDS=freeze({dailyRecords:'savedDay',dailySummaries:'summary',notes:'note',activeSessions:'session',appMeta:'meta',assets:'attachment'});
  // appMeta keys grouped by what they hold; the key itself is never shown.
  const META_FAMILIES=freeze([['reconciliationBase','reconciliation'],['pendingReview:','review'],['libraryClearJournal','journal'],['restoreJournal','journal'],['backupPreparationUnit:','preparation'],['savedDayDeletion:','deletion'],['noteDeletion:','deletion'],['attachmentDeletion:','deletion'],['planDraft','plan'],['planLibrary','plan']]);
  // The browser's own breakdown (StorageManager usageDetails, where offered).
  const REPORTED=freeze({indexedDB:'reportedDatabaseBytes',fileSystem:'reportedFileBytes',caches:'reportedCacheBytes',serviceWorkerRegistrations:'reportedWorkerBytes'});
  const FOLDER_KINDS=freeze(['attachment','scratch','oldFolder']);
  // Storage error names worth keeping; anything else is an app-level refusal,
  // not a storage fault.
  const ERROR_NAMES=freeze(['AbortError','ConstraintError','DataCloneError','DataError','InvalidAccessError','InvalidStateError','NotFoundError','NotReadableError','QuotaExceededError','ReadOnlyError','SecurityError','TimeoutError','TransactionInactiveError','UnknownError','VersionError','IDB_OPEN_TIMEOUT','IDB_OPEN_BLOCKED']);
  const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;

  // Approximate stored size of a value: string length, buffer and file sizes,
  // 8 per number. Bounded, so a pathological record cannot stall the census.
  function sizeOf(value){
    let bytes=0,nodes=0;const stack=[value],seen=new WeakSet();
    while(stack.length&&nodes<200000){
      const item=stack.pop();nodes++;
      if(item===null||item===undefined)continue;
      const type=typeof item;
      if(type==='string'){bytes+=item.length;continue;}
      if(type==='number'||type==='bigint'||type==='boolean'){bytes+=8;continue;}
      if(type!=='object'||seen.has(item))continue;
      seen.add(item);
      if(typeof Blob!=='undefined'&&item instanceof Blob){bytes+=item.size;continue;}
      if(item instanceof ArrayBuffer){bytes+=item.byteLength;continue;}
      if(ArrayBuffer.isView(item)){bytes+=item.byteLength;continue;}
      if(item instanceof Date){bytes+=8;continue;}
      if(item instanceof Map){for(const [key,entry] of item)stack.push(key,entry);continue;}
      if(item instanceof Set||Array.isArray(item)){for(const entry of item)stack.push(entry);continue;}
      for(const key of Object.keys(item)){bytes+=key.length;stack.push(item[key]);}
    }
    return bytes;
  }
  function metaFamily(key){
    const text=typeof key==='string'?key:'';
    for(const [prefix,family] of META_FAMILIES)if(text===prefix||text.startsWith(prefix))return family;
    return 'other';
  }

  async function readEstimate(estimate){
    const value=await estimate();
    if(!value||typeof value!=='object')return {state:'unavailable'};
    const out={state:'observed'},usage=Number(value.usage),quota=Number(value.quota);
    if(Number.isFinite(usage)&&usage>=0)out.usageBytes=usage;
    if(Number.isFinite(quota)&&quota>=0)out.quotaBytes=quota;
    if(value.usageDetails&&typeof value.usageDetails==='object'){
      let other=0;
      for(const [name,raw] of Object.entries(value.usageDetails)){
        const bytes=Number(raw);if(!Number.isFinite(bytes)||bytes<0)continue;
        if(REPORTED[name])out[REPORTED[name]]=bytes;else other+=bytes;
      }
      out.reportedOtherBytes=other;
    }
    return out;
  }
  // readStore(name,visit) walks one store and resolves true when it reached
  // the end; visit(key,value) returns false to stop early.
  async function measureDatabase(readStore,stores,expired){
    const out={state:'observed',records:0,databaseBytes:0},meta={state:'observed',metaRecords:0};
    for(const {id,name} of stores){
      const field=STORE_FIELDS[id]||'other';let records=0,bytes=0;
      let complete=false;
      try{
        complete=await readStore(name,(key,value)=>{
          if(expired())return false;
          const size=sizeOf(key)+sizeOf(value);records++;bytes+=size;
          if(id==='appMeta'){const family=metaFamily(key)+'MetaBytes';meta[family]=(meta[family]||0)+size;meta.metaRecords++;}
          return true;
        })===true;
      }catch{complete=false;}
      out[field+'Records']=(out[field+'Records']||0)+records;out[field+'Bytes']=(out[field+'Bytes']||0)+bytes;
      out.records+=records;out.databaseBytes+=bytes;
      if(!complete){out.state='partial';if(id==='appMeta')meta.state='partial';}
    }
    return {database:out,meta};
  }
  // Every file under the browser's file storage (OPFS), grouped by the folder
  // at its root: attachments, backup scratch, the retired attachment folder,
  // or anything else (a folder an older release left, a stray file).
  async function walk(directory,expired,total){
    const stack=[directory];
    while(stack.length){
      const folder=stack.pop();
      for await (const handle of folder.values()){
        if(expired())return false;
        if(handle.kind==='directory'){stack.push(handle);continue;}
        total.files++;
        try{total.bytes+=Number((await handle.getFile()).size)||0;}catch{total.unreadable++;}
      }
    }
    return true;
  }
  async function measureFiles(root,classify,expired){
    const out={state:'observed',files:0,fileBytes:0,unreadableFiles:0,otherEntries:0};
    for(const kind of [...FOLDER_KINDS,'other']){out[kind+'Files']=0;out[kind+'FileBytes']=0;}
    for await (const [name,handle] of root.entries()){
      if(expired()){out.state='partial';break;}
      const kind=handle.kind==='directory'?classify(name):'other',total={files:0,bytes:0,unreadable:0};
      if(kind==='other')out.otherEntries++;
      let complete=true;
      try{
        if(handle.kind==='directory')complete=await walk(handle,expired,total);
        else{total.files=1;try{total.bytes=Number((await handle.getFile()).size)||0;}catch{total.unreadable=1;}}
      }catch{complete=false;}
      const key=FOLDER_KINDS.includes(kind)?kind:'other';
      out[key+'Files']+=total.files;out[key+'FileBytes']+=total.bytes;
      out.files+=total.files;out.fileBytes+=total.bytes;out.unreadableFiles+=total.unreadable;
      if(!complete){out.state='partial';break;}
    }
    return out;
  }
  async function measureCaches(cacheStorage,expired){
    const out={state:'observed',caches:0,cacheRequests:0,cacheBytes:0,unmeasuredResponses:0};
    for(const name of await cacheStorage.keys()){
      out.caches++;
      const cache=await cacheStorage.open(name);
      for(const request of await cache.keys()){
        if(expired()){out.state='partial';return out;}
        out.cacheRequests++;
        const response=await cache.match(request);
        if(!response||response.type==='opaque'){out.unmeasuredResponses++;continue;}
        try{out.cacheBytes+=Number((await response.blob()).size)||0;}catch{out.unmeasuredResponses++;}
      }
    }
    return out;
  }
  async function measure(input){
    const now=typeof input.now==='function'?input.now:Date.now,started=now(),deadline=started+Math.max(100,Number(input.budgetMs)||2000),expired=()=>now()>=deadline;
    const part=async(available,run,fallback)=>{if(!available)return fallback;try{return await run();}catch{return fallback;}};
    const unavailable={state:'unavailable'};
    const [estimate,data,files,caches]=await Promise.all([
      part(typeof input.estimate==='function',()=>readEstimate(input.estimate),unavailable),
      part(typeof input.readStore==='function',()=>measureDatabase(input.readStore,input.stores||[],expired),{database:unavailable,meta:unavailable}),
      part(typeof input.fileRoot==='function',async()=>{const root=await input.fileRoot();return root?measureFiles(root,input.classifyFolder||(()=>'other'),expired):unavailable;},unavailable),
      part(!!input.caches,()=>measureCaches(input.caches,expired),unavailable)
    ]);
    const parts=[data.database,files,caches],complete=parts.every(row=>row.state==='observed');
    const measured=count(data.database.databaseBytes)+count(files.fileBytes)+count(caches.cacheBytes);
    const anything=estimate.state!=='unavailable'||parts.some(row=>row.state!=='unavailable');
    const summary={...estimate,state:complete&&estimate.state==='observed'?'observed':anything?'partial':'unavailable',measuredBytes:measured,tookMs:Math.max(0,now()-started)};
    // The gap is meaningful only when every part was counted to the end.
    if(complete&&Number.isFinite(summary.usageBytes))summary.unexplainedBytes=Math.max(0,summary.usageBytes-measured);
    return freeze({summary:freeze(summary),database:freeze(data.database),meta:freeze(data.meta),files:freeze(files),caches:freeze(caches)});
  }

  // The database's life, kept in browser storage because that survives when
  // the database does not. `current` describes this start; `beforeLoss` is the
  // last start's record from before the database was found missing, kept
  // until the next loss replaces it.
  const LIFECYCLE_FORMAT='study-director.database-lifecycle',LIFECYCLE_VERSION=1;
  const COUNT_FIELDS=freeze(Object.values(STORE_FIELDS).map(field=>field+'Records'));
  const time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
  const errorName=value=>ERROR_NAMES.includes(value)?value:value?'Error':'';
  function cleanStart(raw){
    if(!raw||typeof raw!=='object')return null;
    const out={startedAt:time(raw.startedAt),fresh:raw.fresh===true,foundVersion:count(raw.foundVersion),openedVersion:count(raw.openedVersion),countedAt:time(raw.countedAt),
      lastWriteAt:time(raw.lastWriteAt),storageErrors:count(raw.storageErrors),lastError:errorName(raw.lastError),lastErrorAt:time(raw.lastErrorAt),unexpectedCloses:count(raw.unexpectedCloses),versionChanges:count(raw.versionChanges)};
    if(!out.startedAt)return null;
    if(Number.isSafeInteger(raw.records)&&raw.records>=0){out.records=raw.records;for(const field of COUNT_FIELDS)out[field]=count(raw[field]);}
    if(raw.detectedAt)out.detectedAt=time(raw.detectedAt);
    return freeze(out);
  }
  function readLifecycle(raw){
    if(!raw||typeof raw!=='object'||raw.format!==LIFECYCLE_FORMAT||raw.version!==LIFECYCLE_VERSION)return freeze({format:LIFECYCLE_FORMAT,version:LIFECYCLE_VERSION,current:null,beforeLoss:null});
    return freeze({format:LIFECYCLE_FORMAT,version:LIFECYCLE_VERSION,current:cleanStart(raw.current),beforeLoss:cleanStart(raw.beforeLoss)});
  }
  // A start that found no database, after one that saw records or a write,
  // keeps that earlier start as the evidence of what was lost.
  const heldData=start=>!!start&&(count(start.records)>0||!!start.lastWriteAt);
  function noteLoss(record,detectedAt){
    const stored=readLifecycle(record);
    if(!heldData(stored.current))return stored;
    return freeze({...stored,beforeLoss:cleanStart({...stored.current,detectedAt})});
  }
  function startLifecycle(record,start){
    const stored=readLifecycle(record),current=cleanStart({...start,records:undefined});
    const kept=start.fresh===true?noteLoss(stored,start.startedAt):stored;
    return freeze({...kept,current});
  }
  // Fold the database's in-memory counters and the store counts into this start.
  // `counts` holds each store's record count by store id.
  function updateLifecycle(record,patch){
    const stored=readLifecycle(record);if(!stored.current)return stored;
    const {counts:storeCounts,...rest}=patch&&typeof patch==='object'?patch:{},next={...stored.current,...rest};
    if(storeCounts&&typeof storeCounts==='object'){
      let total=0;
      for(const [id,field] of Object.entries(STORE_FIELDS)){const records=count(storeCounts[id]);next[field+'Records']=records;total+=records;}
      next.records=total;
    }
    return freeze({...stored,current:cleanStart(next)});
  }

  return freeze({format:'study-director.storage-census',contractVersion:1,measure,sizeOf,lifecycle:freeze({read:readLifecycle,start:startLifecycle,update:updateLifecycle,noteLoss})});
});
})();
