import {messageObject,type SearchReply} from '../portable/worker-contracts';
/* Study Director transient notes search worker. No persistence, DOM, or Wordgard editor runtime. */
import {wg1ToPlainText} from './wg1-codec';

export type {SearchDocument} from '../portable/worker-contracts';
type SearchInput={key?:unknown;revision?:unknown;value?:unknown;plain?:unknown};
type CachedDocument={revision:string;text:string};
const corpus=new Map<string,CachedDocument>();

function cleanKey(value:unknown){return String(value??'').trim()}
function cleanRevision(value:unknown){return String(value??'')}
function normalizeSearchText(value:unknown){return String(value??'').toLowerCase()}
function derive(record:SearchInput){return normalizeSearchText(record.plain===undefined?wg1ToPlainText(record.value??''):record.plain)}
function upsert(value:unknown){
  const record:SearchInput=messageObject(value);
  const key=cleanKey(record&&record.key);if(!key)return false;
  const revision=cleanRevision(record.revision),current=corpus.get(key);
  if(record.plain===undefined&&current&&current.revision===revision)return false;
  corpus.set(key,{revision,text:derive(record)});return true;
}
function remove(key:unknown){const clean=cleanKey(key);return clean?corpus.delete(clean):false}
function batch(documents:unknown){for(const record of Array.isArray(documents)?(documents as unknown[]):[])upsert(record)}
function sync(documents:unknown){corpus.clear();batch(documents)}
function search(query:unknown){
  const needle=normalizeSearchText(query).trim();if(!needle)return [];
  const matches:string[]=[];for(const [key,entry] of corpus)if(entry.text.includes(needle))matches.push(key);return matches;
}

self.addEventListener('message',(event:MessageEvent<unknown>)=>{
  const message=messageObject(event.data);
  try{
    if(message['type']==='sync'){sync(message['documents']);return}
    if(message['type']==='batch'){batch(message['documents']);return}
    if(message['type']==='upsert'){upsert(message['document']);return}
    if(message['type']==='delete'){remove(message['key']);return}
    if(message['type']==='query')self.postMessage({type:'result',id:message['id'],keys:search(message['query'])} satisfies SearchReply);
  }catch(error){self.postMessage({type:'error',id:message['id']} satisfies SearchReply)}
});
