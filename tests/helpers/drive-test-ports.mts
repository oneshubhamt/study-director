import assert from 'node:assert/strict';
import {method,registeredExports} from './registered-exports.mts';
import {field,bool,errorMessage} from './repository-safety-ports.mts';
import {required} from './repository-note-ports.mts';
import {jsonArray,jsonObject,jsonString} from './verification/read-verification.mts';
import {numberValue} from './asset-storage-port.mts';
import {readCoreScript} from './core-script.mts';
import vm from 'node:vm';
import {createDriveHarness} from './drive-harness.mts';

type DownloadOptions={signal?:AbortSignal;onProgress?:()=>void};
type RangeOptions=DownloadOptions&{offset:number;length:number};
function blob(value:unknown):Blob{assert.ok(value instanceof Blob,'Expected downloaded bytes');return value;}
function history(value:unknown){if(value===null||value===undefined)return null;const row=jsonObject(value);return {...row,attachmentsMissing:row['attachmentsMissing'],retention:jsonObject(row['retention'])};}
function item(value:unknown){
 const row=jsonObject(value);
 return {...row,kind:jsonString(row['kind']),id:jsonString(row['id']),name:jsonString(row['name']),size:numberValue(row['size']),digest:jsonString(row['digest']),serverDigest:jsonString(row['serverDigest']),remoteId:jsonString(row['remoteId']),remoteVersion:jsonString(row['remoteVersion']),verificationScope:jsonString(row['verificationScope']),history:history(row['history'])};
}
export type DriveItem=ReturnType<typeof item>;
function lease(value:unknown){
 const row=jsonObject(value);
 return {...row,id:jsonString(row['id']),kind:jsonString(row['kind']),name:jsonString(row['name']),remoteId:jsonString(row['remoteId']),createdAt:jsonString(row['createdAt']),expiresAt:jsonString(row['expiresAt']),renews:row['renews'],sameDevice:row['sameDevice'],startedAt:row['startedAt']===undefined?undefined:jsonString(row['startedAt'])};
}
function listResult<T>(value:unknown,decode:(value:unknown)=>T){const row=jsonObject(value);return {...row,items:Array.from(jsonArray(row['items']),decode),overflow:row['overflow'],ignored:row['ignored']};}
function releasePort(value:unknown){return {blob:blob(field(value,'blob')),release:async()=>method(value,'release')()};}
function driveMethods(owner:unknown){
 const call=(name:string,...args:unknown[])=>method(owner,name)(...args);
 async function download(ref:unknown,options:RangeOptions):Promise<{blob:Blob;totalBytes:number;version:string}>;
 async function download(ref:unknown,options?:DownloadOptions):Promise<ReturnType<typeof releasePort>>;
 async function download(ref:unknown,options?:DownloadOptions|RangeOptions){
  const value=await call('download',ref,options);
  return options&&'offset' in options?{blob:blob(field(value,'blob')),totalBytes:numberValue(field(value,'totalBytes')),version:jsonString(field(value,'version'))}:releasePort(value);
 }
 return {
  list:async(options:{kind:string;signal?:AbortSignal})=>listResult(await call('list',options),item),
  upload:async(value:unknown,options?:{signal?:AbortSignal})=>item(await call('upload',value,options)),download,delete:async(ref:unknown)=>call('delete',ref),
  listSessionClaims:async()=>listResult(await call('listSessionClaims'),item),uploadSessionClaim:async(value:unknown)=>item(await call('uploadSessionClaim',value)),downloadSessionClaim:async(value:unknown)=>releasePort(await call('downloadSessionClaim',value)),deleteSessionClaim:async(value:unknown)=>call('deleteSessionClaim',value),
  beginPublication:async()=>lease(await call('beginPublication')),listPublications:async()=>listResult(await call('listPublications'),lease),assertPublication:async(ref:unknown)=>lease(await call('assertPublication',ref)),renewPublication:async(ref:unknown)=>lease(await call('renewPublication',ref)),endPublication:async(ref:unknown)=>call('endPublication',ref),
  beginMaintenance:async()=>lease(await call('beginMaintenance')),listMaintenances:async()=>listResult(await call('listMaintenances'),lease),assertMaintenance:async(ref:unknown)=>lease(await call('assertMaintenance',ref)),renewMaintenance:async(ref:unknown)=>lease(await call('renewMaintenance',ref)),endMaintenance:async(ref:unknown)=>call('endMaintenance',ref),
  scope:async()=>jsonString(await call('scope')),now:()=>numberValue(call('now')),discardUploads:()=>call('discardUploads'),historyReadConcurrency:numberValue(field(owner,'historyReadConcurrency'))
 };
}
type Transport=ReturnType<typeof driveMethods>&{beginOperation(options?:unknown):Transport};
function driveRepositoryPort(owner:unknown):Transport{return {...driveMethods(owner),beginOperation:(options?:unknown)=>driveRepositoryPort(method(owner,'beginOperation')(options))};}
export function checkedDrive(options:Parameters<typeof createDriveHarness>[0]={}){
 const h=createDriveHarness(options),owner=h.provider;
 return {...h,rawProvider:owner,provider:{prepare:async()=>method(owner,'prepare')(),authorize:async()=>method(owner,'authorize')(),disconnect:async()=>method(owner,'disconnect')(),release:async()=>method(owner,'release')(),connected:()=>bool(method(owner,'connected')()),backgroundAvailable:()=>bool(method(owner,'backgroundAvailable')()),connectionExpiresAt:()=>numberValue(method(owner,'connectionExpiresAt')()),subscribeConnection:(listener:()=>void)=>{const fn=method(owner,'subscribeConnection')(listener);assert.ok(typeof fn==='function');return ()=>{Reflect.apply(fn,undefined,[]);};},repository:driveRepositoryPort(field(owner,'repository'))}};
}
type BackgroundClock={now():number;setTimeout(fn:()=>void,ms:number):number;clearTimeout(id:number):void};
export function repositoryBackground(h:{context:object;clock:BackgroundClock}){
 for(const name of ['internal','operation-lifecycle','repository-background'])vm.runInContext(readCoreScript(name),h.context);
 const lifecycle=registeredExports(h.context,'operation-lifecycle'),background=registeredExports(h.context,'repository-background',Object.freeze({lifecycle}));
 const owner=method(background,'createCoordinator')(Object.freeze({target:'google-drive',environment:Object.freeze({AbortController,now:h.clock.now,setTimeout:h.clock.setTimeout,clearTimeout:h.clock.clearTimeout})}));
 function scope(value:unknown){const signal=field(value,'signal');assert.ok(signal instanceof AbortSignal);return {signal,release:()=>method(value,'release')()};}
 return {
  beginBackground:async(kind:string,options?:unknown)=>scope(await method(owner,'beginBackground')(kind,options)),
  beginForeground:()=>{const value=required(method(owner,'beginForeground')());return {settled:Promise.resolve(field(value,'settled')),release:()=>method(value,'release')()};},
  status:()=>({active:jsonArray(field(method(owner,'status')(),'active'))}),
  registerJob:(kind:string,options:unknown)=>{const job=method(owner,'registerJob')(kind,options);return {run:async(reason:string)=>method(job,'run')(reason)};},
  wake:(reason:string)=>method(owner,'wake')(reason),clearAllScheduled:()=>method(owner,'clearAllScheduled')()
 };
}
export type Outcome<T>={ok:true;value:T;error?:never}|{ok:false;error:Readonly<{message:string}>;value?:never};
export function observe<T>(task:Promise<T>){
 const result:{current?:Outcome<T>}={};
 void task.then(value=>{result.current={ok:true,value};},(error:unknown)=>{result.current={ok:false,error:{message:errorMessage(error)}};});
 return result;
}
