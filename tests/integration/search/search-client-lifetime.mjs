import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function fixture(){
  let now=0,next=0,query='planet',renders=0,failPost=false;const timers=new Map(),workers=[];
  const window={setTimeout(fn,ms){const id=++next;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)};
  const source=fs.readFileSync('source/core/library.js','utf8'),context={window,ongoingNotesSearch:()=>query,ongoingNoteSearchDocuments:()=>[{key:'one',value:'a planet orbit'}],plainTextContent:value=>value,requestOngoingNotesRender:()=>renders++,createSearchWorker:()=>{const worker={messages:[],terminated:0,postMessage(value){if(failPost)throw new Error('clone');this.messages.push(value);},terminate(){this.terminated++;}};workers.push(worker);return worker;}};
  vm.createContext(context);vm.runInContext(source.slice(source.indexOf('    const NOTE_SEARCH_IDLE_MS='),source.indexOf('    function ongoingNotesDrawer('))+';globalThis.api={filterOngoingNoteEntries,stopNoteSearch,resetNoteSearchFailure,requestNoteSearch};',context);
  return {api:context.api,workers,timers,setQuery:value=>query=value,failPost:()=>failPost=true,get renders(){return renders;},tick(ms){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}}};
}
const entries=[{key:'one',label:'Physics'},{key:'two',label:'Biology'}],cases=[];
{
  const h=fixture();assert.equal(h.api.filterOngoingNoteEntries(entries,'planet').pending,true);h.tick(0);h.tick(10000);h.setQuery('orbit');h.api.requestNoteSearch('orbit');h.tick(10000);h.api.requestNoteSearch('orbit',true);h.tick(10000);const result=h.api.filterOngoingNoteEntries(entries,'orbit');assert.equal(result.pending,false);assert.deepEqual([...result.entries].map(x=>x.key),['one']);assert.equal(h.workers[0].terminated,1);assert.equal(h.timers.size,0);cases.push('silent response and repeated queries have a fixed deadline and content fallback');
}
{
  const h=fixture();h.api.requestNoteSearch('planet');h.tick(0);const old=h.workers[0],late=old.onmessage,error=old.onerror,message=old.messages.at(-1);old.onmessageerror();assert.equal(h.timers.size,0);assert.equal(h.api.resetNoteSearchFailure(),true);h.api.requestNoteSearch('planet');h.tick(0);const current=h.workers[1],request=current.messages.at(-1);late({data:{type:'result',id:request.id,keys:['two']}});error({});assert.equal(current.terminated,0);assert.equal(h.api.filterOngoingNoteEntries(entries,'planet').pending,true);
  current.onmessage({data:{type:'result',id:message.id,keys:['two']}});assert.equal(h.api.filterOngoingNoteEntries(entries,'planet').pending,true);current.onmessage({data:{type:'result',id:request.id,keys:['one']}});assert.equal(h.api.filterOngoingNoteEntries(entries,'planet').pending,false);assert.equal(h.timers.size,0);
  h.api.requestNoteSearch('orbit');const stale=current.messages.at(-1);h.api.requestNoteSearch('');current.onmessage({data:{type:'result',id:stale.id,keys:['two']}});assert.equal(h.timers.size,0);h.api.stopNoteSearch();cases.push('messageerror, retry, stale IDs/generations and cleared query cleanup');
}
{
  const h=fixture();h.failPost();const result=h.api.filterOngoingNoteEntries(entries,'planet');assert.equal(result.pending,false);assert.equal(result.entries[0].key,'one');assert.equal(h.workers[0].terminated,1);assert.equal(h.timers.size,0);cases.push('post failure falls back and cancels build/deadline timers');
}
console.log(JSON.stringify({status:'PASS',suite:'search-client-lifetime',cases},null,2));
