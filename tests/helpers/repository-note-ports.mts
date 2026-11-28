import assert from 'node:assert/strict';
import {method} from './registered-exports.mts';
import {noteKeys,titleKey} from './note-ids.mts';
import {jsonArray,jsonObject,jsonString} from './verification/read-verification.mts';

// The repository executes in a classic-script VM. Keep the actual returned
// fields, but validate the fields used by Notes tests before reading them.
export function required<T>(value:T|null|undefined):T{assert.ok(value!==null&&value!==undefined,'expected persisted or live note evidence');return value;}
export type StoredNote=Record<string,unknown>&{key:string;label:string;text:string;updatedAt:string;version:number;links?:string[]};
export function storedRow(value:unknown):StoredNote{
  const row=jsonObject(value),version=row['version'];assert.equal(typeof version,'number');if(typeof version!=='number')throw new Error('Invalid note version');
  return {...row,key:jsonString(row['key']),label:jsonString(row['label']),text:jsonString(row['text']),updatedAt:jsonString(row['updatedAt']),version,
    ...(Object.hasOwn(row,'links')?{links:Array.from(jsonArray(row['links']),jsonString)}:{})};
}
export function storedNote(map:ReadonlyMap<string,unknown>,title:string){
  const wanted=titleKey(title);
  for(const value of map.values()){const row=storedRow(value);if(noteKeys.isId(row.key)&&titleKey(row.label)===wanted)return row;}
  return undefined;
}
export function requiredStoredNote(map:ReadonlyMap<string,unknown>,title:string){return required(storedNote(map,title));}
export function notePayload(value:unknown):Record<string,StoredNote>{
  return Object.fromEntries(Object.entries(jsonObject(value)).map(([key,row])=>[key,storedRow(row)]));
}
export function storedLinks(row:StoredNote){return required(row.links);}
function view(value:unknown){
  const row=jsonObject(value);
  return {...row,id:jsonString(row['id']),key:jsonString(row['key']),label:jsonString(row['label']),text:jsonString(row['text']),updatedAt:jsonString(row['updatedAt']),links:Array.from(jsonArray(row['links']),jsonString)};
}
function records(value:unknown){return Array.from(jsonArray(value),jsonObject);}
export function rescueEntry(local:ReadonlyMap<string,unknown>,id:string):unknown{
  const rescue=local.get('noteRescue');if(rescue==null)return undefined;
  const entries=jsonObject(rescue)['entries'];return entries==null?undefined:jsonObject(entries)[id];
}
export function notesPort(app:unknown){
  const owner=jsonObject(app)['notes'];
  const call=(name:string,...args:unknown[])=>method(owner,name)(...args);
  const get=(key:string)=>{const value=call('get',key);return value===null?null:view(value);};
  const status=(value:unknown)=>{const row=jsonObject(value);return {...row,status:jsonString(row['status'])};};
  return {
    get,getRequired:(key:string)=>required(get(key)),
    load:async()=>call('load'),reloadFresh:async()=>call('reloadFresh'),
    recoverAfterStorageLoss:async(check?:()=>void)=>call('recoverAfterStorageLoss',check),
    update:(key:string,label:string,text:string,revision:string)=>status(call('update',key,label,text,revision)),
    link:(key:string,id:string,options?:{on?:boolean;label?:string})=>status(call('link',key,id,options)),
    flush:async(options?:{strict?:boolean;backupCapture?:boolean})=>call('flush',options),
    failure:()=>{const row=jsonObject(call('failure'));return {failed:row['failed'],message:jsonString(row['message'])};},
    trash:async(key:string)=>jsonString(await call('trash',key)),
    restore:async(key:string|null)=>jsonString(await call('restore',key)),
    remove:async(key:string,options?:{expectedRevision?:string})=>call('remove',key,options),
    rename:async(key:string,label:string,options?:{merge:(existing:string,moved:string)=>string})=>status(await call('rename',key,label,options)),
    exportPayload:()=>notePayload(call('exportPayload')),
    readFreshPayload:async()=>notePayload(await call('readFreshPayload')),
    normalizePayload:(payload:unknown)=>notePayload(call('normalizePayload',payload)),
    alignByTitle:(payload:unknown,deletedIds?:readonly string[])=>notePayload(call('alignByTitle',payload,deletedIds)),
    replace:async(payload:unknown)=>call('replace',payload),
    reconcile:async(payload:unknown,deletions?:unknown)=>notePayload(await call('reconcile',payload,deletions)),
    clearAll:async()=>call('clearAll'),
    metadataSnapshot:()=>({records:records(jsonObject(call('metadataSnapshot'))['records'])}),
    searchSnapshot:()=>({documents:records(jsonObject(call('searchSnapshot'))['documents'])}),
    trashSnapshot:()=>records(call('trashSnapshot')),
    linkedFrom:(key:string)=>Array.from(jsonArray(call('linkedFrom',key)),view),
    purgeExpiredTrash:()=>call('purgeExpiredTrash'),
    protectUnsaved:()=>call('protectUnsaved')
  };
}
