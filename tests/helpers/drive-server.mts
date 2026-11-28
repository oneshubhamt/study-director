import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {EXTERNAL_REPOSITORY_IDENTITIES} from '../../contracts/canonical-identities.mts';
import type {createFakeClock} from './fake-clock.mts';
import {jsonObject,jsonArray,jsonString} from './verification/read-verification.mts';
import {required} from './repository-note-ports.mts';

type Properties=Record<string,string>;
type DriveMetadata={name?:string;mimeType?:string;parents?:string[];appProperties?:Properties;trashed?:boolean};
type RemoteFile={id:string;name:string;mimeType:string;parents:string[];appProperties:Properties;content:Blob;ownedByMe:boolean;shared:boolean;trashed:boolean;canDownload:boolean;version:number;createdTime:string;modifiedTime:string;sha256Checksum?:string};
type RemoteUpload={id:string;metadata:DriveMetadata;received?:number;parts?:Blob[]};
export type RemoteState={
 folders:string[];folderProperties:Map<string,Properties>;folderNames:Map<string,string>;deletionMarkers:{id:string;name:string;profile:string}[];
 files:Map<string,RemoteFile>;uploads:Map<string,RemoteUpload>;trashedFolders:Set<string>;sequence:{file:number;folder:number;version:number};
};
type BodyProbe={signal:AbortSignal|null|undefined;aborted:boolean;cancelled:boolean;finish:(()=>void)|null};
type RangeProbe={loaded:number;cancelled:boolean};
type JsonFault={mode:string;remaining?:number;status?:number;payload?:unknown};
type RequestLog={url:string;method:string;authorization:string;contentRange:string};
export type DriveState=RemoteState&{
 email:string;deletedSignals:unknown[];libraryControl:unknown;binds:unknown[];rangeMode:string;expiresIn:number;requests:RequestLog[];deletions:string[];
 scope:string;force401Once:boolean;evilUploadLocation:boolean;networkFailPutOnce:boolean;networkFailCoordinationPostOnce:boolean;networkFailCoordinationDeleteOnce:boolean;
 folderShared:boolean;folderCreateDenied:boolean;folderListGate:PromiseLike<unknown>|null;folderListStarted:number;uploadPutGate:PromiseLike<unknown>|null;uploadPutStarted:number;
 authorizationHold:boolean;authorizationResponder:(()=>void)|null;authorizationRequests:number;releasedDownloads:number;
 offline?:boolean;driveClockAheadMs?:number;requestDelayMs?:((request:{url:URL;method:string})=>number)|null;
 jsonFault?:JsonFault|null;bodyRequests?:number;bodies?:BodyProbe[];listPage?:(query:string,params:URLSearchParams)=>unknown;
 pageSizes?:Record<string,number>;pageSize?:number;pageDelayMs?:number;objectPageStarts?:number;activeObjectPages?:number;
 repeatPageKinds?:Set<string>;incompleteSearchKinds?:Set<string>;failMediaKinds?:Set<string>;failMediaIds?:Set<string>;
 historyReadDelayMs?:number;activeHistoryReads?:number;maxHistoryReads?:number;historyReadCompletions?:string[];
 rangeChunkDelayMs?:number;rangeChunkBytes?:number;rangeTransfers?:RangeProbe[];folderRenameFails?:boolean;
 uploadAborts?:number;uploadProgressStarted?:number;uploadProgressSteps?:number;uploadProgressStepMs?:number|((body:Blob)=>number);
 awaitingUploadProgress?:number;uploadRepeatProgress?:boolean;nativeUploadReplies?:number;
};
export type Timer=ReturnType<typeof setTimeout>|number;
export type Timers={set:(callback:()=>void,ms:number)=>Timer;clear:(timer:Timer)=>void};
type Clock=ReturnType<typeof createFakeClock>|null;
type FetchOptions={method?:string;headers?:ConstructorParameters<typeof Headers>[0];signal?:AbortSignal|null;body?:Blob|string|null};
let digestsInFlight=0;
export const pendingRepositoryDigests=()=>digestsInFlight;
export const repositoryDigest=async(blob:Blob)=>{digestsInFlight+=1;try{return Buffer.from(await webcrypto.subtle.digest('SHA-256',await blob.arrayBuffer())).toString('hex');}finally{digestsInFlight-=1;}};
const digest=repositoryDigest;
function json(payload:unknown,status=200,headers:Record<string,string>={}){return new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json',...headers}});}
function readMetadata(text:string):DriveMetadata{
 const input:unknown=JSON.parse(text),row=jsonObject(input),result:DriveMetadata={};
 if(row['name']!==undefined)result.name=jsonString(row['name']);
 if(row['mimeType']!==undefined)result.mimeType=jsonString(row['mimeType']);
 if(row['parents']!==undefined)result.parents=Array.from(jsonArray(row['parents']),jsonString);
 if(row['appProperties']!==undefined)result.appProperties=Object.fromEntries(Object.entries(jsonObject(row['appProperties'])).map(([key,value])=>[key,jsonString(value)]));
 if(row['trashed']!==undefined){const value=row['trashed'];assert.equal(typeof value,'boolean');if(typeof value!=='boolean')throw new TypeError('Invalid trash flag');result.trashed=value;}
 return result;
}
export function createDriveServer({email,expiresIn,clock,remoteState,timers}:{email:string;expiresIn:number;clock:Clock;remoteState:Partial<RemoteState>|null;timers:Timers}){
 const harnessSetTimeout=timers.set,harnessClearTimeout=timers.clear;
  const state:DriveState={email,folderProperties:remoteState?.folderProperties??new Map(),folderNames:remoteState?.folderNames??new Map(),deletionMarkers:remoteState?.deletionMarkers??[],deletedSignals:[],libraryControl:null,binds:[],rangeMode:'valid',expiresIn,folders:remoteState?.folders??[],files:remoteState?.files??new Map(),uploads:remoteState?.uploads??new Map(),requests:[],deletions:[],trashedFolders:remoteState?.trashedFolders??new Set(),sequence:remoteState?.sequence??{file:1,folder:1,version:1},scope:'https://www.googleapis.com/auth/drive.file',force401Once:false,evilUploadLocation:false,networkFailPutOnce:false,networkFailCoordinationPostOnce:false,networkFailCoordinationDeleteOnce:false,folderShared:false,folderCreateDenied:false,folderListGate:null,folderListStarted:0,uploadPutGate:null,uploadPutStarted:0,authorizationHold:false,authorizationResponder:null,authorizationRequests:0,releasedDownloads:0};
  // state.offline: the browser says it is offline (navigator.onLine).
  // state.driveClockAheadMs: how far Drive's clock is ahead of this device's
  // (negative: behind) for the files it creates without content (markers).
  // A new browser page has fresh JavaScript upload state, but Drive's remote
  // files and partially acknowledged sessions survive page termination.
  // Share only server-side fixtures; never share the provider's in-memory map.
  const folderMetadata=(id='folder-1')=>({id,name:state.folderNames.get(id)||EXTERNAL_REPOSITORY_IDENTITIES.driveFolder,mimeType:'application/vnd.google-apps.folder',ownedByMe:true,shared:!!state.folderShared,trashed:state.trashedFolders.has(id),appProperties:{studyDirectorFolder:'true',...(state.folderProperties.get(id)||{})},capabilities:{canAddChildren:true}});
  const fileMetadata=(file:RemoteFile)=>({id:file.id,name:file.name,size:String(file.content.size),version:String(file.version||''),modifiedTime:file.modifiedTime,createdTime:file.createdTime,mimeType:file.mimeType,parents:[...file.parents],ownedByMe:file.ownedByMe,shared:file.shared,trashed:file.trashed,sha256Checksum:String(file.sha256Checksum||''),appProperties:{...file.appProperties},capabilities:{canDownload:file.canDownload}});
  const findId=(pathname:string)=>decodeURIComponent(required(pathname.split('/').at(-1)));
  const delay=(ms:number,signal?:AbortSignal|null)=>new Promise<void>((resolve,reject)=>{let timer:Timer|undefined;const clear=()=>{if(timer!==undefined)harnessClearTimeout(timer);signal?.removeEventListener('abort',abort);},abort=()=>{clear();const reason:unknown=signal?.reason;reject(reason||Object.assign(new Error('QA_FIXTURE request cancelled'),{name:'AbortError'}));};timer=harnessSetTimeout(()=>{clear();resolve();},ms);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});
  async function mockFetch(input:string|URL,options:FetchOptions={}){
    const url=new URL(String(input)),method=String(options.method||'GET').toUpperCase(),headers=new Headers(options.headers||{});
    state.requests.push({url:url.href,method,authorization:headers.get('Authorization')||'',contentRange:headers.get('Content-Range')||''});
    assert.equal(url.origin,'https://www.googleapis.com','token-bearing requests must remain on the exact Google API origin');
    assert.match(headers.get('Authorization')||'',/^Bearer token-/u);
    const requestDelay=Number(state.requestDelayMs?.({url,method})||0);if(requestDelay>0)await delay(requestDelay,options.signal);
    const fault=state.jsonFault;
    if(fault&&url.pathname==='/drive/v3/files'&&method==='GET'&&!String(url.searchParams.get('q')||'').includes("mimeType='application/vnd.google-apps.folder'")&&(fault.remaining===undefined||fault.remaining>0)){
      if(fault.remaining!==undefined)fault.remaining--;
      state.bodyRequests=(state.bodyRequests||0)+1;
      const status=fault.status||200;
      if(fault.mode==='invalid')return new Response('{truncated',{status,headers:{'Content-Type':'application/json'}});
      if(fault.mode==='shape')return json(fault.payload,status);
      if(fault.mode==='complete')return json(fault.payload,status);
      let closed=false,abort:()=>void=()=>{};const body:BodyProbe={signal:options.signal,aborted:false,cancelled:false,finish:null};(state.bodies??=[]).push(body);
      const stream=new ReadableStream<Uint8Array>({
        start(controller){
          const close=()=>{if(closed)return;closed=true;options.signal?.removeEventListener('abort',abort);controller.enqueue(new TextEncoder().encode('{"files":[]}'));controller.close();};body.finish=close;
          abort=()=>{body.aborted=true;if(closed)return;closed=true;options.signal?.removeEventListener('abort',abort);controller.error(Object.assign(new Error('QA_FIXTURE body aborted'),{name:'AbortError'}));};
          options.signal?.addEventListener('abort',abort,{once:true});
          if(fault.mode==='interrupted'){closed=true;options.signal?.removeEventListener('abort',abort);controller.error(new TypeError('QA_FIXTURE network body read interrupted'));}
          else if(options.signal?.aborted)abort();
        },
        cancel(){body.cancelled=true;closed=true;options.signal?.removeEventListener('abort',abort);}
      });
      return new Response(stream,{status,headers:{'Content-Type':'application/json'}});
    }
    if(state.force401Once){state.force401Once=false;return json({error:{message:'expired token'}},401);}
    if(url.pathname==='/drive/v3/files'&&method==='GET'){
      const q=url.searchParams.get('q')||'';
      const page=state.listPage?.(q,url.searchParams);
      if(page!==undefined)return json(page);
      const deleted=q.match(/key='studyDirectorDeletedProfile' and value='([^']+)'/u);
      if(deleted)return json({files:state.deletionMarkers.filter(row=>row.profile===deleted[1]).map(row=>({id:row.id}))});
      if(q.includes("mimeType='application/vnd.google-apps.folder'")){state.folderListStarted+=1;if(state.folderListGate)await state.folderListGate;return json({files:state.folders.filter(id=>!state.trashedFolders.has(id)).map(folderMetadata)});}
      const parent=q.match(/'([^']+)' in parents/u)?.[1];
      let rows=[...state.files.values()].filter(file=>!file.trashed&&(!parent||file.parents?.includes(parent)));
      const kindMatch=q.match(/key='studyDirectorRepositoryKind' and value='([^']+)'/u),idMatch=q.match(/key='studyDirectorRepositoryId' and value='([^']+)'/u);
      if(kindMatch)rows=rows.filter(file=>String(file.appProperties?.['studyDirectorRepositoryKind']||'')===kindMatch[1]);
      if(idMatch)rows=rows.filter(file=>String(file.appProperties?.['studyDirectorRepositoryId']||'')===idMatch[1]);
      const files=rows.map(fileMetadata).sort((a,b)=>String(b.createdTime).localeCompare(String(a.createdTime)));
      const offset=Number(url.searchParams.get('pageToken')||0),size=state.pageSizes?.[kindMatch?.[1]??'']||(state.pageSize&&kindMatch?.[1]==='object'?state.pageSize:Number(url.searchParams.get('pageSize'))||1000);
      if(state.pageDelayMs&&kindMatch?.[1]==='object'){
        state.objectPageStarts=(state.objectPageStarts||0)+1;state.activeObjectPages=(state.activeObjectPages||0)+1;
        try{await delay(state.pageDelayMs,options.signal);}
        finally{state.activeObjectPages--;}
      }
      return json({files:files.slice(offset,offset+size),...(offset+size<files.length?{nextPageToken:state.repeatPageKinds?.has(kindMatch?.[1]??'')?'1':String(offset+size)}:{}),...(state.incompleteSearchKinds?.has(kindMatch?.[1]??'')?{incompleteSearch:true}:{})});
    }
    if(url.pathname==='/drive/v3/files'&&method==='POST'){
      if(state.folderCreateDenied)return json({error:{message:'folder creation denied'}},403);
      const metadata=readMetadata(String(options.body||'{}'));
      if(metadata.mimeType==='application/vnd.google-apps.folder'&&metadata.appProperties?.['studyDirectorDeletedProfile']){
        const id=`marker-${state.deletionMarkers.length+1}`;state.deletionMarkers.push({id,name:String(metadata.name||''),profile:String(metadata.appProperties['studyDirectorDeletedProfile'])});return json({id});
      }
      if(metadata.mimeType==='application/vnd.google-apps.folder'){
        const id=`folder-${state.sequence.folder++}`;state.folders.push(id);if(metadata.name)state.folderNames.set(id,String(metadata.name));const {studyDirectorFolder:_marker,...properties}=metadata.appProperties||{};state.folderProperties.set(id,properties);return json(folderMetadata(id));
      }
      const id=`repo-${state.sequence.file++}`,stamp=new (clock?.Date||Date)((clock?.Date||Date).now()+(Number(state.driveClockAheadMs)||0)).toISOString(),file={id,name:required(metadata.name),mimeType:metadata.mimeType||'application/octet-stream',parents:[...(metadata.parents||[])],appProperties:{...(metadata.appProperties||{})},content:new Blob([]),ownedByMe:true,shared:false,trashed:false,canDownload:true,version:state.sequence.version++,createdTime:stamp,modifiedTime:stamp};state.files.set(id,file);
      if(state.networkFailCoordinationPostOnce&&['publication','maintenance'].includes(String(metadata.appProperties?.['studyDirectorRepositoryKind']||''))){state.networkFailCoordinationPostOnce=false;throw new TypeError('simulated ambiguous coordination create');}
      return json(fileMetadata(file));
    }
    if(url.pathname==='/upload/drive/v3/files'&&method==='POST'){
      const uploadType=String(url.searchParams.get('uploadType')||'');
      if(uploadType==='multipart'){
        if(state.networkFailPutOnce){state.networkFailPutOnce=false;throw new TypeError('simulated transient upload network loss');}
        state.uploadPutStarted+=1;if(state.uploadPutGate)await state.uploadPutGate;
        assert.ok(options.body instanceof Blob,'multipart upload body must be a Blob');
        const contentType=String(headers.get('Content-Type')||''),boundary=contentType.match(/boundary=([^;]+)/u)?.[1];assert.ok(boundary,'multipart upload must declare a boundary');
        const body=Buffer.from(await options.body.arrayBuffer()),headerEnd=Buffer.from('\r\n\r\n'),delimiter=Buffer.from(`\r\n--${boundary}`);
        const metadataStart=body.indexOf(headerEnd)+headerEnd.length,metadataEnd=body.indexOf(delimiter,metadataStart),binaryHeaderEnd=body.indexOf(headerEnd,metadataEnd),binaryStart=binaryHeaderEnd+headerEnd.length,binaryEnd=body.indexOf(Buffer.from(`\r\n--${boundary}--`),binaryStart);
        assert.ok(metadataStart>=headerEnd.length&&metadataEnd>metadataStart&&binaryHeaderEnd>metadataEnd&&binaryEnd>=binaryStart,'multipart upload must contain intact metadata and binary parts');
        const metadata=readMetadata(body.subarray(metadataStart,metadataEnd).toString('utf8')),content=new Blob([body.subarray(binaryStart,binaryEnd)]),id=`repo-${state.sequence.file++}`,stamp=new Date(Date.UTC(2026,0,1,0,0,state.files.size)).toISOString();
        const file={id,name:required(metadata.name),mimeType:metadata.mimeType||'application/octet-stream',parents:[...(metadata.parents||[])],appProperties:{...(metadata.appProperties||{})},content,sha256Checksum:await digest(content),ownedByMe:true,shared:false,trashed:false,canDownload:true,version:state.sequence.version++,createdTime:stamp,modifiedTime:stamp};state.files.set(id,file);return json(fileMetadata(file));
      }
      const metadata=readMetadata(String(options.body||'{}')),uploadId=`upload-${state.sequence.file++}`,id=`repo-${state.sequence.file++}`;
      state.uploads.set(uploadId,{id,metadata});
      const location=state.evilUploadLocation?'https://attacker.example/upload?upload_id=stolen':`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=${uploadId}`;
      state.evilUploadLocation=false;return json({},200,{Location:location});
    }
    if(url.pathname==='/upload/drive/v3/files'&&method==='PUT'){
      const uploadId=url.searchParams.get('upload_id'),pending=state.uploads.get(uploadId??'');if(!pending)return json({error:{message:'Upload session expired.'}},404);
      const range=String(headers.get('Content-Range')||'');
      if(range.startsWith('bytes */')){
        const complete=state.files.get(pending.id);if(complete)return json(fileMetadata(complete),200);
        const received=Math.max(0,Number(pending.received)||0);return new Response(null,{status:308,headers:received?{'Range':`bytes=0-${received-1}`}:{}});
      }
      if(state.networkFailPutOnce){state.networkFailPutOnce=false;throw new TypeError('simulated transient upload network loss');}
      state.uploadPutStarted+=1;if(state.uploadPutGate)await state.uploadPutGate;
      const match=range.match(/^bytes (\d+)-(\d+)\/(\d+)$/u);assert.ok(match,'resumable PUT must declare a valid byte range');const start=Number(match[1]),end=Number(match[2]),total=Number(match[3]);assert.equal(start,Math.max(0,Number(pending.received)||0),'resumable chunks must continue from the confirmed server offset');
      const chunk=options.body instanceof Blob?options.body:new Blob([options.body||'']);assert.equal(chunk.size,end-start+1);pending.parts=pending.parts||[];pending.parts.push(chunk);pending.received=end+1;
      if(pending.received<total)return new Response(null,{status:308,headers:{'Range':`bytes=0-${end}`}});
      const content=new Blob(pending.parts),stamp=new Date(Date.UTC(2026,0,1,0,0,state.files.size)).toISOString(),file={id:pending.id,name:required(pending.metadata.name),mimeType:required(pending.metadata.mimeType),parents:[...required(pending.metadata.parents)],appProperties:{...pending.metadata.appProperties},content,sha256Checksum:await digest(content),ownedByMe:true,shared:false,trashed:false,canDownload:true,version:state.sequence.version++,createdTime:stamp,modifiedTime:stamp};state.files.set(pending.id,file);return json(fileMetadata(file),200);
    }
    if(url.pathname.startsWith('/drive/v3/files/')&&method==='GET'){
      const id=findId(url.pathname);
      if(state.folders.includes(id)&&url.searchParams.get('alt')!=='media')return json(folderMetadata(id));
      const file=state.files.get(id);
      if(file&&url.searchParams.get('alt')==='media'&&(state.failMediaKinds?.has(file.appProperties?.['studyDirectorRepositoryKind']??'')||state.failMediaIds?.has(id)))return json({error:{message:'QA_FIXTURE temporarily unavailable backup metadata'}},404);if(!file)return json({error:{message:'not found'}},404);
      if(url.searchParams.get('alt')==='media'){
        if(state.historyReadDelayMs&&['checkpoint','commit'].includes(file.appProperties?.['studyDirectorRepositoryKind']??'')){
          state.activeHistoryReads=(state.activeHistoryReads||0)+1;state.maxHistoryReads=Math.max(state.maxHistoryReads||0,state.activeHistoryReads);
          try{await delay(state.historyReadDelayMs,options.signal);}finally{state.activeHistoryReads--;}
        }
        if(['checkpoint','commit'].includes(file.appProperties?.['studyDirectorRepositoryKind']??''))(state.historyReadCompletions??=[]).push(id);
        const range=headers.get('Range');if(range&&state.rangeMode!=='ignored'){
          const match=/^bytes=(\d+)-(\d+)$/u.exec(range);assert.ok(match,'range request must declare two offsets');const start=Number(match[1]),end=Number(match[2]);let content=file.content.slice(start,end+1);if(state.rangeMode==='truncated')content=content.slice(0,-1);
          let responseBody:Blob|ReadableStream<Uint8Array>=content;
          if(state.rangeChunkDelayMs){
            const delayMs=state.rangeChunkDelayMs,bytes=new Uint8Array(await content.arrayBuffer());let offset=0,timer:Timer|null=null,pullDone:(()=>void)|null=null;const transfer={loaded:0,cancelled:false};(state.rangeTransfers??=[]).push(transfer);
            responseBody=new ReadableStream<Uint8Array>({pull(controller){if(offset===bytes.length){controller.close();return;}return new Promise<void>(resolve=>{pullDone=resolve;timer=harnessSetTimeout(()=>{timer=null;const chunk=state.rangeMode==='empty-progress'?new Uint8Array():bytes.slice(offset,offset+Math.max(1,state.rangeChunkBytes||262144));offset+=chunk.byteLength;transfer.loaded=offset;controller.enqueue(chunk);pullDone=null;resolve();},delayMs);});},cancel(){transfer.cancelled=true;if(timer!==null)harnessClearTimeout(timer);pullDone?.();}});
          }
          return new Response(responseBody,{status:206,headers:{'Content-Range':state.rangeMode==='wrong-range'?`bytes 1-2/${file.content.size}`:`bytes ${start}-${end}/${file.content.size}`}});
        }
        return new Response(file.content,{status:200,headers:{'Content-Length':String(file.content.size),'Content-Type':file.mimeType}});
      }
      return json(fileMetadata(file));
    }
    if(url.pathname==='/drive/v3/about'&&method==='GET')return json({user:{emailAddress:state.email}});
    if(url.pathname.startsWith('/drive/v3/files/')&&method==='PATCH'){
      const id=findId(url.pathname);if(!state.folders.includes(id))return json({error:{message:'not found'}},404);
      const metadata=readMetadata(String(options.body||'{}'));if(metadata.trashed===true){state.trashedFolders.add(id);return json({id});}if(state.folderRenameFails&&metadata.name)return json({error:{message:'rename failed'}},500);if(metadata.name)state.folderNames.set(id,String(metadata.name));state.folderProperties.set(id,{...(state.folderProperties.get(id)||{}),...(metadata.appProperties||{})});return json(folderMetadata(id));
    }
    if(url.pathname.startsWith('/drive/v3/files/')&&method==='DELETE'){
      const id=findId(url.pathname),file=state.files.get(id),kind=String(file?.appProperties?.['studyDirectorRepositoryKind']||'');
      if(state.networkFailCoordinationDeleteOnce&&['publication','maintenance'].includes(kind)){state.networkFailCoordinationDeleteOnce=false;throw new TypeError('simulated ambiguous coordination delete');}
      state.deletions.push(id);state.files.delete(id);return new Response(null,{status:204});
    }
    throw new Error(`unhandled Drive request ${method} ${url.href}`);
  }
  return {state,fetch:mockFetch,delay};
}
