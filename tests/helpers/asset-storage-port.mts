import assert from 'node:assert/strict';
import {method} from './registered-exports.mts';
import {jsonObject,jsonArray,jsonString} from './verification/read-verification.mts';
export function numberValue(value:unknown):number{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError('Expected finite number');return value;}
export function assetRow(value:unknown){
 const row=jsonObject(value);
 return {...row,file:jsonString(row['file']),name:jsonString(row['name']),size:numberValue(row['size']),hash:jsonString(row['hash']),type:jsonString(row['type']),library:row['library']};
}
function scopePort(owner:unknown){
 return {keys:async()=>Array.from(jsonArray(await method(owner,'keys')()),jsonString),
  removeMany:async(ids:readonly string[],guard?:()=>boolean,allowLibrary?:boolean)=>method(owner,'removeMany')(ids,guard,allowLibrary),
  sweep:async()=>numberValue(await method(owner,'sweep')()),status:()=>jsonObject(method(owner,'status')())};
}
export function assetStoragePort(owner:unknown){
 const call=(name:string,...args:unknown[])=>method(owner,name)(...args);
 type AuditOptions={workMs?:number;now?:()=>number;progress?:unknown;shouldYield?:()=>boolean;yieldTask?:()=>Promise<unknown>;check?:()=>void;maxEntries?:number};
 type CollectOptions={check?:()=>void;maxEntries?:number;shouldYield?:()=>boolean};
 const collect=async(scan:(scope:ReturnType<typeof scopePort>)=>Promise<unknown>,options?:CollectOptions)=>call('collect',(scope:unknown)=>scan(scopePort(scope)),options);
 return {
  supported:()=>call('supported'),requireAvailable:()=>call('requireAvailable'),
  get:async(id:string)=>{const value=await call('get',id);assert.ok(value instanceof Blob);return value;},
  put:async(id:string,blob:Blob,options?:{name?:string;library?:boolean;stage?:boolean;token?:number})=>assetRow(await call('put',id,blob,options)),
  list:async()=>Array.from(jsonArray(await call('list')),assetRow),
  rename:async(id:string,name:string)=>assetRow(await call('rename',id,name)),
  setLibrary:async(id:string,value:boolean)=>assetRow(await call('setLibrary',id,value)),
  verifyMetadata:async(rows:unknown)=>call('verifyMetadata',rows),restoreMetadata:async(rows:unknown)=>call('restoreMetadata',rows),
  publish:async(rows:readonly (readonly [string,unknown])[],token:number,check:()=>void,options?:{restoreLabels?:boolean;replaceAll?:boolean})=>call('publish',rows,token,check,options),
  discard:async(rows:unknown)=>call('discard',rows),removeMetadata:async(ids:readonly string[],guard?:()=>boolean)=>call('removeMetadata',ids,guard),
  shallowAudit:async(ids:readonly string[],options?:AuditOptions)=>{const row=jsonObject(await call('shallowAudit',ids,options));const rawProgress=row['progress'],progress=rawProgress===null?null:jsonObject(rawProgress);const complete=row['complete'];assert.equal(typeof complete,'boolean');if(typeof complete!=='boolean')throw new TypeError('Expected audit completion flag');return {...row,status:jsonString(row['status']),complete,references:numberValue(row['references']),checked:numberValue(row['checked']),progress:progress===null?null:{...progress,cursor:numberValue(progress['cursor']),scanId:jsonString(progress['scanId'])},issues:Array.from(jsonArray(row['issues']),jsonObject)};},
  retain:async()=>{const release=await call('retain');assert.equal(typeof release,'function');if(typeof release!=='function')throw new TypeError('Missing lease release');return ()=>{Reflect.apply(release,undefined,[]);};},
  collect,collectReport:async(scan:Parameters<typeof collect>[0],options?:CollectOptions)=>jsonObject(await collect(scan,options))
 };
}
