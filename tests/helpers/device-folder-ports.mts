import assert from 'node:assert/strict';
import {method} from './registered-exports.mts';
import {field} from './repository-safety-ports.mts';
import {jsonObject,jsonArray,jsonString} from './verification/read-verification.mts';
import {numberValue} from './asset-storage-port.mts';
type Kind='object'|'checkpoint'|'commit';
type Identity={kind:string;id:string;digest?:string};
type RangeOptions={offset:number;length:number};
type RangeResult={blob:Blob;totalBytes:number;version:string};
function historySummary(value:unknown){
 if(value===undefined||value===null)return null;
 const row=jsonObject(value),counts=jsonObject(row['counts']),retention=jsonObject(row['retention']);
 return {...row,counts:{dailyRecord:numberValue(counts['dailyRecord']),note:numberValue(counts['note'])},retention:{...retention,calendar:jsonObject(retention['calendar'])},attachmentsMissing:row['attachmentsMissing']};
}
function item(value:unknown){
 const row=jsonObject(value);
 return {...row,kind:jsonString(row['kind']),id:jsonString(row['id']),name:jsonString(row['name']),size:numberValue(row['size']),remoteVersion:jsonString(row['remoteVersion']),verificationScope:jsonString(row['verificationScope']),digest:row['digest']===undefined?'':jsonString(row['digest']),history:historySummary(row['history']),locked:row['locked'],unreadable:row['unreadable']};
}
function lease(value:unknown){
 const row=jsonObject(value);
 return {...row,id:jsonString(row['id']),name:jsonString(row['name']),createdAt:jsonString(row['createdAt']),renews:row['renews']};
}
function blob(value:unknown):Blob{assert.ok(value instanceof Blob,'Expected downloaded file bytes');return value;}
export function folderStoragePort(owner:unknown){
 const call=(name:string,...args:unknown[])=>method(owner,name)(...args);
 const leases=async(name:string)=>{const row=jsonObject(await call(name));return {...row,items:Array.from(jsonArray(row['items']),lease)};};
 async function download(ref:Identity,options:RangeOptions):Promise<RangeResult>;
 async function download(ref:Identity):Promise<Blob>;
 async function download(ref:Identity,options?:RangeOptions):Promise<Blob|RangeResult>{
  const value=options===undefined?await call('download',ref):await call('download',ref,options);
  if(options===undefined)return blob(value);
  const row=jsonObject(value);return {blob:blob(row['blob']),totalBytes:numberValue(row['totalBytes']),version:jsonString(row['version'])};
 }
 return {list:async(options:{kind:Kind;freshDigests?:boolean})=>{const row=jsonObject(await call('list',options));return {...row,items:Array.from(jsonArray(row['items']),item)};},
  upload:async(value:unknown)=>item(await call('upload',value)),download,delete:async(ref:Identity)=>call('delete',ref),scope:async()=>jsonString(await call('scope')),
  beginOperation:(options:unknown)=>folderStoragePort(call('beginOperation',options)),
  beginPublication:async()=>lease(await call('beginPublication')),listPublications:()=>leases('listPublications'),assertPublication:async(value:unknown)=>call('assertPublication',value),renewPublication:async(value:unknown)=>lease(await call('renewPublication',value)),endPublication:async(value:unknown)=>call('endPublication',value),
  beginMaintenance:async()=>lease(await call('beginMaintenance')),listMaintenances:()=>leases('listMaintenances'),assertMaintenance:async(value:unknown)=>call('assertMaintenance',value),renewMaintenance:async(value:unknown)=>lease(await call('renewMaintenance',value)),endMaintenance:async(value:unknown)=>call('endMaintenance',value)};
}
export function deviceControllerPort(owner:unknown){
 const call=(name:string,...args:unknown[])=>method(owner,name)(...args);
 return {install:async()=>call('install'),connect:async()=>call('connect'),disconnect:async()=>call('disconnect'),refreshPermission:async()=>jsonObject(await call('refreshPermission')),status:()=>jsonObject(call('status')),
  wake:()=>call('wake'),cancelForeground:(reason:string)=>call('cancelForeground',reason),backupNow:async()=>call('backupNow'),deleteBackups:async()=>jsonString(await call('deleteBackups')),rememberAfterStorageReset:async()=>call('rememberAfterStorageReset')};
}
export function deviceRuntimePort(owner:unknown){
 const call=(name:string,...args:unknown[])=>method(owner,name)(...args);
 return {list:(options:unknown)=>Array.from(jsonArray(call('list',options)),jsonObject),automaticActive:()=>call('automaticActive'),automaticWaiting:()=>call('automaticWaiting'),flushAutomatic:async(reason:string)=>call('flushAutomatic',reason),wakeBackground:(reason:string)=>call('wakeBackground',reason),
 history:async(id:string,options:{interactive:boolean})=>{const row=jsonObject(await call('history',id,options));return {...row,available:row['available'],entries:Array.from(jsonArray(row['entries']),value=>{const item=jsonObject(value);return {...item,location:jsonObject(item['location']),counts:item['counts'],locked:item['locked']};})};},
 createProtectedSafety:async(id:string,reason:string)=>{const row=jsonObject(await call('createProtectedSafety',id,reason));return {...row,verified:row['verified'],checkpointId:jsonString(row['checkpointId'])};},
 removeRepositoryProviderVersion:async(id:string,checkpoint:string,check:()=>void)=>jsonObject(await call('removeRepositoryProviderVersion',id,checkpoint,check)),
 diagnosticConnections:()=>Array.from(jsonArray(call('diagnosticConnections')),row=>({id:field(row,'id'),formats:field(row,'formats')}))};
}
