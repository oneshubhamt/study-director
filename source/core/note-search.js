(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,declaredFunctions:requireFunctions}=registry.contracts;
// Full-text search of the notes for the Library's list. A worker holds the
// index: it is fed every note in batches when first needed, kept current as
// notes are saved, and stopped after two idle minutes. If the worker fails or
// stops answering, search falls back to reading the text on this thread.
registry.define('note-search',1,()=>{
  const freeze=Object.freeze;
  const IDLE_MS=120000,RESPONSE_MS=30000,BATCH_CHARS=2*1024*1024;
  const PORT_FIELDS=freeze({
    notes:freeze(['documents','plainText']),
    environment:freeze(['createWorker','setTimeout','clearTimeout']),
    view:freeze(['query','changed'])
  });
  function createSearch(input){
    exactObject(input,['ports'],'Note search input');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Note search ports');
    for(const [name,fields] of Object.entries(PORT_FIELDS)){exactObject(ports[name],fields,'Note search '+name+' port');requireFunctions(ports[name],fields,'Note search '+name+' port');}
    const {documents,plainText}=ports.notes,{createWorker,setTimeout,clearTimeout}=ports.environment,{query:currentQuery,changed}=ports.view;
    let deadline=0,worker=null,idleTimer=0,buildTimer=0,buildDocuments=null,buildIndex=0,building=false,searchId=0,searchQuery='',ready=false,matches=new Set(),failed=false,pendingUpdates=new Map(),fallbackText=null;

    function clearIdle(){if(idleTimer){clearTimeout(idleTimer);idleTimer=0;}}
    function clearBuild(){if(buildTimer){clearTimeout(buildTimer);buildTimer=0;}}
    function clearDeadline(){if(deadline){clearTimeout(deadline);deadline=0;}}
    function reset(){clearDeadline();searchId++;searchQuery='';ready=false;matches=new Set();}
    function stop(asFailure=false){
      clearIdle();clearBuild();searchId++;
      if(worker){const stopped=worker;worker=null;stopped.onmessage=stopped.onerror=stopped.onmessageerror=null;try{stopped.terminate();}catch{}}
      buildDocuments=null;buildIndex=0;building=false;pendingUpdates.clear();
      reset();failed=!!asFailure;if(!asFailure)fallbackText=null;
    }
    function fail(){stop(true);changed();}
    function post(message){try{worker.postMessage(message);return true;}catch{fail();return false;}}
    function watch(){
      if(deadline)return;const current=worker;
      deadline=setTimeout(()=>{deadline=0;if(worker===current)fail();},RESPONSE_MS);
    }
    function postUpdate(record){
      if(!worker||!record)return false;const key=String(record.key||'').trim();if(!key)return false;
      if(record.deleted===true)post({type:'delete',key});
      else{const document={key,revision:String(record.revision||'')};if(record.plain!==undefined)document.plain=String(record.plain||'');else document.value=String(record.value||'');post({type:'upsert',document});}
      return true;
    }
    function finishBuild(){
      building=false;buildDocuments=null;buildIndex=0;
      for(const record of pendingUpdates.values())postUpdate(record);pendingUpdates.clear();
      const query=currentQuery();if(query)request(query,true);else idle();
    }
    function feedBuild(){
      buildTimer=0;if(!worker||!building||!buildDocuments)return;
      const batch=[];let chars=0;
      while(buildIndex<buildDocuments.length){
        const record=buildDocuments[buildIndex],size=String(record?.value??record?.plain??'').length;
        if(batch.length&&chars+size>BATCH_CHARS)break;
        batch.push(record);chars+=size;buildIndex++;
      }
      if(batch.length&&!post({type:'batch',documents:batch}))return;
      if(buildIndex<buildDocuments.length)buildTimer=setTimeout(feedBuild,0);else finishBuild();
    }
    function startBuild(){
      buildDocuments=documents();buildIndex=0;building=true;pendingUpdates.clear();
      watch();if(post({type:'sync',documents:[]}))buildTimer=setTimeout(feedBuild,0);
    }
    function ensure(){
      clearIdle();if(worker)return true;if(failed)return false;
      try{
        const created=createWorker();
        created.onmessage=event=>{if(worker!==created)return;const message=event?.data||{};if(message.type==='error'){fail();return;}if(message.type!=='result'||Number(message.id)!==searchId||!searchQuery)return;clearDeadline();ready=true;matches=new Set(Array.isArray(message.keys)?message.keys.map(String):[]);changed();};
        created.onerror=event=>{if(worker!==created)return;event?.preventDefault?.();fail();};created.onmessageerror=()=>{if(worker===created)fail();};worker=created;startBuild();return worker===created;
      }catch{stop(true);return false;}
    }
    function request(query,force=false){
      const clean=String(query||'').trim().toLowerCase();if(!clean){reset();return false;}
      if(!ensure())return false;if(!force&&searchQuery===clean)return true;
      searchQuery=clean;ready=false;watch();if(building)return true;
      const id=++searchId;return post({type:'query',id,query:clean});
    }
    // A note was saved or removed: the index follows, and a shown search runs again.
    function update(record){
      if(!record)return false;clearIdle();const key=String(record.key||'').trim();if(!key)return false;
      if(fallbackText){if(record.deleted===true)fallbackText.delete(key);else fallbackText.set(key,String(record.plain===undefined?plainText(record.value||''):record.plain||'').toLowerCase());}
      if(!worker)return !!fallbackText;
      if(building)pendingUpdates.set(key,record);else postUpdate(record);
      searchQuery='';ready=false;const query=currentQuery();if(query)request(query,true);return true;
    }
    function fallback(entries,query){
      if(!fallbackText){fallbackText=new Map();for(const record of documents())fallbackText.set(String(record.key||''),plainText(record.value||'').toLowerCase());}
      return entries.filter(entry=>String(entry.label||'').toLowerCase().includes(query)||String(fallbackText.get(entry.key)||'').includes(query));
    }
    // The entries that match: by title, or by text once the worker answers
    // (pending until then).
    function filter(entries,query){
      if(!query)return {entries,pending:false};
      if(failed)return {entries:fallback(entries,query),pending:false};
      request(query);if(failed)return {entries:fallback(entries,query),pending:false};
      if(!ready||searchQuery!==query)return {entries,pending:true};
      return {entries:entries.filter(entry=>String(entry.label||'').toLowerCase().includes(query)||matches.has(entry.key)),pending:false};
    }
    // The worker stops after two idle minutes.
    function idle(){clearIdle();if(worker)idleTimer=setTimeout(()=>{idleTimer=0;stop();},IDLE_MS);}
    // Search is in use again: keep the worker, and give a failed one another try.
    function resume(){clearIdle();if(!failed||worker)return false;failed=false;fallbackText=null;reset();return true;}
    // The notes were replaced wholesale: the index starts again when next needed.
    function restart(){if(worker)stop();}
    return freeze({filter,request,update,reset,idle,resume,keep:clearIdle,restart});
  }
  return freeze({format:'study-director.note-search-module',contractVersion:1,createSearch});
});
})();
