import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {EXTERNAL_REPOSITORY_IDENTITIES} from '../../contracts/canonical-identities.mjs';
const source=fs.readFileSync(new URL('../../source/external/drive.js',import.meta.url),'utf8')
 .replaceAll('@@SD_RELEASE@@','QA_FIXTURE').replaceAll('@@SD_RELEASE_ID@@','vb8')
 .replaceAll('@@SD_GOOGLE_OAUTH_CLIENT_ID@@','306494096916-p48tjuv0ni01c11a0dp4ini9gp3dafdi.apps.googleusercontent.com')
 .replaceAll('@@SD_DRIVE_SESSION_STORAGE_KEY@@','studyDirector.driveSession.v1')
 .replaceAll('@@SD_EXTERNAL_REPOSITORY_IDENTITIES@@',JSON.stringify(EXTERNAL_REPOSITORY_IDENTITIES));
const policyContext=vm.createContext({});
for(const file of ['internal','repository-policy'])vm.runInContext(fs.readFileSync(new URL(`../../source/core/${file}.js`,import.meta.url),'utf8'),policyContext);
const repositoryPolicy=policyContext[Symbol.for('studyDirector.internalModules.v1')].require('repository-policy',1).protocol;
// Digests run on a background thread; tests on a fake clock wait for them
// (pendingRepositoryDigests) before moving simulated time on.
let digestsInFlight=0;
export const pendingRepositoryDigests=()=>digestsInFlight;
export const repositoryDigest=async blob=>{digestsInFlight+=1;try{return Buffer.from(await webcrypto.subtle.digest('SHA-256',await blob.arrayBuffer())).toString('hex');}finally{digestsInFlight-=1;}};
const digest=repositoryDigest;
function json(payload,status=200,headers={}){return new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json',...headers}});}
export const QA_PROFILE_ID='prof_qa_mve00000_abcdef01';
// The profile this test's page belongs to and how it settles a Drive folder:
// its own folder continues, an unmarked one is claimed.
const defaultBind=async info=>info.mine?'continue':'claim';
export function createDriveHarness({expiresIn=3600,clock=null,registerProvider=null,uploadProgressTransport=true,localStorage=undefined,remoteState=null,addEventListener=()=>{},profileId=()=>QA_PROFILE_ID,profileName=()=>'',bind=defaultBind,email='qa@example.com',device=()=>'inst_qa_harness_mve00000_abcdef01'}={}){
  const state={email,folderProperties:new Map(),folderNames:new Map(),deletionMarkers:[],deletedSignals:[],libraryControl:null,binds:[],rangeMode:'valid',expiresIn,folders:[],files:new Map(),uploads:new Map(),requests:[],deletions:[],trashedFolders:new Set(),nextId:1,nextFolderId:1,nextVersion:1,scope:'https://www.googleapis.com/auth/drive.file',force401Once:false,evilUploadLocation:false,networkFailPutOnce:false,networkFailCoordinationPostOnce:false,networkFailCoordinationDeleteOnce:false,folderShared:false,folderCreateDenied:false,folderListGate:null,folderListStarted:0,uploadPutGate:null,uploadPutStarted:0};
  // A new browser page has fresh JavaScript upload state, but Drive's remote
  // files and partially acknowledged sessions survive page termination.
  // Share only server-side fixtures; never share the provider's in-memory map.
  if(remoteState)for(const key of ['folders','folderProperties','folderNames','deletionMarkers','files','uploads','trashedFolders','nextId','nextFolderId','nextVersion'])if(remoteState[key]!==undefined)state[key]=remoteState[key];
  const folderMetadata=(id='folder-1')=>({id,name:state.folderNames.get(id)||EXTERNAL_REPOSITORY_IDENTITIES.driveFolder,mimeType:'application/vnd.google-apps.folder',ownedByMe:true,shared:!!state.folderShared,trashed:state.trashedFolders.has(id),appProperties:{studyDirectorFolder:'true',...(state.folderProperties.get(id)||{})},capabilities:{canAddChildren:true}});
  const fileMetadata=file=>({id:file.id,name:file.name,size:String(file.content.size),version:String(file.version||''),modifiedTime:file.modifiedTime,createdTime:file.createdTime,mimeType:file.mimeType,parents:[...file.parents],ownedByMe:file.ownedByMe,shared:file.shared,trashed:file.trashed,sha256Checksum:String(file.sha256Checksum||''),appProperties:{...file.appProperties},capabilities:{canDownload:file.canDownload}});
  const findId=pathname=>decodeURIComponent(pathname.split('/').at(-1));
  const delay=(ms,signal)=>new Promise((resolve,reject)=>{let timer;const clear=()=>{harnessClearTimeout(timer);signal?.removeEventListener('abort',abort);},abort=()=>{clear();reject(signal.reason||Object.assign(new Error('QA_FIXTURE request cancelled'),{name:'AbortError'}));};timer=harnessSetTimeout(()=>{clear();resolve();},ms);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});
  async function mockFetch(input,options={}){
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
      let closed=false,abort;const body={signal:options.signal,aborted:false,cancelled:false,finish:null};(state.bodies??=[]).push(body);
      const stream=new ReadableStream({
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
      const deleted=q.match(/key='studyDirectorDeletedProfile' and value='([^']+)'/u);
      if(deleted)return json({files:state.deletionMarkers.filter(row=>row.profile===deleted[1]).map(row=>({id:row.id}))});
      if(q.includes("mimeType='application/vnd.google-apps.folder'")){state.folderListStarted+=1;if(state.folderListGate)await state.folderListGate;return json({files:state.folders.filter(id=>!state.trashedFolders.has(id)).map(folderMetadata)});}
      let rows=[...state.files.values()].filter(file=>!file.trashed);
      const kindMatch=q.match(/key='studyDirectorRepositoryKind' and value='([^']+)'/u),idMatch=q.match(/key='studyDirectorRepositoryId' and value='([^']+)'/u);
      if(kindMatch)rows=rows.filter(file=>String(file.appProperties?.studyDirectorRepositoryKind||'')===kindMatch[1]);
      if(idMatch)rows=rows.filter(file=>String(file.appProperties?.studyDirectorRepositoryId||'')===idMatch[1]);
      const files=rows.map(fileMetadata).sort((a,b)=>String(b.createdTime).localeCompare(String(a.createdTime)));
      const offset=Number(url.searchParams.get('pageToken')||0),size=state.pageSizes?.[kindMatch?.[1]]||(state.pageSize&&kindMatch?.[1]==='object'?state.pageSize:Number(url.searchParams.get('pageSize'))||1000);
      if(state.pageDelayMs&&kindMatch?.[1]==='object'){
        state.objectPageStarts=(state.objectPageStarts||0)+1;state.activeObjectPages=(state.activeObjectPages||0)+1;
        try{await delay(state.pageDelayMs,options.signal);}
        finally{state.activeObjectPages--;}
      }
      return json({files:files.slice(offset,offset+size),...(offset+size<files.length?{nextPageToken:state.repeatPageKinds?.has(kindMatch?.[1])?'1':String(offset+size)}:{}),...(state.incompleteSearchKinds?.has(kindMatch?.[1])?{incompleteSearch:true}:{})});
    }
    if(url.pathname==='/drive/v3/files'&&method==='POST'){
      if(state.folderCreateDenied)return json({error:{message:'folder creation denied'}},403);
      const metadata=JSON.parse(String(options.body||'{}'));
      if(metadata.mimeType==='application/vnd.google-apps.folder'&&metadata.appProperties?.studyDirectorDeletedProfile){
        const id=`marker-${state.deletionMarkers.length+1}`;state.deletionMarkers.push({id,name:String(metadata.name||''),profile:String(metadata.appProperties.studyDirectorDeletedProfile)});return json({id});
      }
      if(metadata.mimeType==='application/vnd.google-apps.folder'){
        const id=`folder-${state.nextFolderId++}`;state.folders.push(id);if(metadata.name)state.folderNames.set(id,String(metadata.name));const {studyDirectorFolder:_marker,...properties}=metadata.appProperties||{};state.folderProperties.set(id,properties);return json(folderMetadata(id));
      }
      const id=`repo-${state.nextId++}`,stamp=new (clock?.Date||Date)().toISOString(),file={id,name:metadata.name,mimeType:metadata.mimeType||'application/octet-stream',parents:[...(metadata.parents||[])],appProperties:{...(metadata.appProperties||{})},content:new Blob([]),ownedByMe:true,shared:false,trashed:false,canDownload:true,version:state.nextVersion++,createdTime:stamp,modifiedTime:stamp};state.files.set(id,file);
      if(state.networkFailCoordinationPostOnce&&['publication','maintenance'].includes(String(metadata.appProperties?.studyDirectorRepositoryKind||''))){state.networkFailCoordinationPostOnce=false;throw new TypeError('simulated ambiguous coordination create');}
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
        const metadata=JSON.parse(body.subarray(metadataStart,metadataEnd).toString('utf8')),content=new Blob([body.subarray(binaryStart,binaryEnd)]),id=`repo-${state.nextId++}`,stamp=new Date(Date.UTC(2026,0,1,0,0,state.files.size)).toISOString();
        const file={id,name:metadata.name,mimeType:metadata.mimeType||'application/octet-stream',parents:[...(metadata.parents||[])],appProperties:{...(metadata.appProperties||{})},content,sha256Checksum:await digest(content),ownedByMe:true,shared:false,trashed:false,canDownload:true,version:state.nextVersion++,createdTime:stamp,modifiedTime:stamp};state.files.set(id,file);return json(fileMetadata(file));
      }
      const metadata=JSON.parse(String(options.body||'{}')),uploadId=`upload-${state.nextId++}`,id=`repo-${state.nextId++}`;
      state.uploads.set(uploadId,{id,metadata});
      const location=state.evilUploadLocation?'https://attacker.example/upload?upload_id=stolen':`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=${uploadId}`;
      state.evilUploadLocation=false;return json({},200,{Location:location});
    }
    if(url.pathname==='/upload/drive/v3/files'&&method==='PUT'){
      const uploadId=url.searchParams.get('upload_id'),pending=state.uploads.get(uploadId);if(!pending)return json({error:{message:'Upload session expired.'}},404);
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
      const content=new Blob(pending.parts),stamp=new Date(Date.UTC(2026,0,1,0,0,state.files.size)).toISOString(),file={id:pending.id,name:pending.metadata.name,mimeType:pending.metadata.mimeType,parents:[...pending.metadata.parents],appProperties:{...pending.metadata.appProperties},content,sha256Checksum:await digest(content),ownedByMe:true,shared:false,trashed:false,canDownload:true,version:state.nextVersion++,createdTime:stamp,modifiedTime:stamp};state.files.set(pending.id,file);return json(fileMetadata(file),200);
    }
    if(url.pathname.startsWith('/drive/v3/files/')&&method==='GET'){
      const id=findId(url.pathname);
      if(state.folders.includes(id)&&url.searchParams.get('alt')!=='media')return json(folderMetadata(id));
      const file=state.files.get(id);
      if(file&&url.searchParams.get('alt')==='media'&&(state.failMediaKinds?.has(file.appProperties?.studyDirectorRepositoryKind)||state.failMediaIds?.has(id)))return json({error:{message:'QA_FIXTURE temporarily unavailable backup metadata'}},404);if(!file)return json({error:{message:'not found'}},404);
      if(url.searchParams.get('alt')==='media'){
        if(state.historyReadDelayMs&&['checkpoint','commit'].includes(file.appProperties?.studyDirectorRepositoryKind)){
          state.activeHistoryReads=(state.activeHistoryReads||0)+1;state.maxHistoryReads=Math.max(state.maxHistoryReads||0,state.activeHistoryReads);
          try{await delay(state.historyReadDelayMs,options.signal);}finally{state.activeHistoryReads--;}
        }
        if(['checkpoint','commit'].includes(file.appProperties?.studyDirectorRepositoryKind))(state.historyReadCompletions??=[]).push(id);
        const range=headers.get('Range');if(range&&state.rangeMode!=='ignored'){
          const match=/^bytes=(\d+)-(\d+)$/u.exec(range),start=Number(match[1]),end=Number(match[2]);let content=file.content.slice(start,end+1);if(state.rangeMode==='truncated')content=content.slice(0,-1);
          if(state.rangeChunkDelayMs){
            const bytes=new Uint8Array(await content.arrayBuffer());let offset=0,timer=null,pullDone=null;const transfer={loaded:0,cancelled:false};(state.rangeTransfers??=[]).push(transfer);
            content=new ReadableStream({pull(controller){if(offset===bytes.length){controller.close();return;}return new Promise(resolve=>{pullDone=resolve;timer=harnessSetTimeout(()=>{timer=null;const chunk=state.rangeMode==='empty-progress'?new Uint8Array():bytes.slice(offset,offset+Math.max(1,state.rangeChunkBytes||262144));offset+=chunk.byteLength;transfer.loaded=offset;controller.enqueue(chunk);pullDone=null;resolve();},state.rangeChunkDelayMs);});},cancel(){transfer.cancelled=true;if(timer!==null)harnessClearTimeout(timer);pullDone?.();}});
          }
          return new Response(content,{status:206,headers:{'Content-Range':state.rangeMode==='wrong-range'?`bytes 1-2/${file.content.size}`:`bytes ${start}-${end}/${file.content.size}`}});
        }
        return new Response(file.content,{status:200,headers:{'Content-Length':String(file.content.size),'Content-Type':file.mimeType}});
      }
      return json(fileMetadata(file));
    }
    if(url.pathname==='/drive/v3/about'&&method==='GET')return json({user:{emailAddress:state.email}});
    if(url.pathname.startsWith('/drive/v3/files/')&&method==='PATCH'){
      const id=findId(url.pathname);if(!state.folders.includes(id))return json({error:{message:'not found'}},404);
      const metadata=JSON.parse(String(options.body||'{}'));if(metadata.trashed===true){state.trashedFolders.add(id);return json({id});}if(state.folderRenameFails&&metadata.name)return json({error:{message:'rename failed'}},500);if(metadata.name)state.folderNames.set(id,String(metadata.name));state.folderProperties.set(id,{...(state.folderProperties.get(id)||{}),...(metadata.appProperties||{})});return json(folderMetadata(id));
    }
    if(url.pathname.startsWith('/drive/v3/files/')&&method==='DELETE'){
      const id=findId(url.pathname),file=state.files.get(id),kind=String(file?.appProperties?.studyDirectorRepositoryKind||'');
      if(state.networkFailCoordinationDeleteOnce&&['publication','maintenance'].includes(kind)){state.networkFailCoordinationDeleteOnce=false;throw new TypeError('simulated ambiguous coordination delete');}
      state.deletions.push(id);state.files.delete(id);return new Response(null,{status:204});
    }
    throw new Error(`unhandled Drive request ${method} ${url.href}`);
  }
  let provider=null;const scripts=[];
  const document={scripts,head:{appendChild(node){scripts.push(node);queueMicrotask(()=>node.onload&&node.onload());return node;}},body:{appendChild(){return null;}},createElement(tag){return {tagName:String(tag).toUpperCase(),remove(){},setAttribute(){},appendChild(){},style:{},src:'',async:false,defer:false,onload:null,onerror:null};},getElementById(){return null;}};
  const oauth={hasGrantedAllScopes(response,scope){return String(response.scope||'').split(/\s+/).includes(scope);},initTokenClient(config){return {requestAccessToken(){queueMicrotask(()=>config.callback({access_token:`token-${state.requests.length+1}`,expires_in:state.expiresIn,token_type:'Bearer',scope:state.scope}));}};},revoke(token,callback){queueMicrotask(()=>callback({successful:true}));}};
  state.releasedDownloads=0;
  const api={capabilities:{pluginApi:1,backupController:1,backupProviders:1},backup:{repositoryPolicy,receiveStream:async(stream,size,options={})=>{if(options.signal?.aborted)throw new Error('cancelled');const blob=await new Response(stream).blob();assert.equal(blob.size,size);options.onProgress?.({phase:'downloading',loaded:blob.size,total:size});return blob;},releaseFile:async()=>{state.releasedDownloads+=1;},limits:{maxFileBytes:20*1024*1024},device:()=>device(),profile:{id:()=>profileId(),name:()=>profileName(),bind:async info=>{state.binds.push(info);return bind(info);},deleted:info=>{state.deletedSignals.push(info);},controls:control=>{state.libraryControl=control;}},providers:{register(config){provider=config;return registerProvider?registerProvider(config):true;}}}};
  const harnessSetTimeout=(fn,ms,...args)=>{if(clock)return clock.setTimeout(()=>fn(...args),ms);const timer=setTimeout(fn,ms,...args);if(Number(ms)>5000)timer.unref?.();return timer;};
  const harnessClearTimeout=id=>clock?clock.clearTimeout(id):clearTimeout(id);
  class MockXMLHttpRequest{
    constructor(){this.upload={};this.headers=new Headers();this.controller=new AbortController();}
    open(method,url,async){assert.equal(async,true);this.method=method;this.url=url;}
    setRequestHeader(key,value){this.headers.set(key,value);}
    getAllResponseHeaders(){return [...this.response.headers].map(([key,value])=>key+': '+value).join('\r\n');}
    abort(){this.controller.abort();state.uploadAborts=(state.uploadAborts||0)+1;this.onabort?.();}
    send(body){void (async()=>{
      try{
        state.uploadProgressStarted=(state.uploadProgressStarted||0)+1;
        const steps=state.uploadProgressSteps||1;
        const stepMs=typeof state.uploadProgressStepMs==='function'?Number(state.uploadProgressStepMs(body)):Number(state.uploadProgressStepMs)||0;
        for(let step=1;step<=steps;step++){if(stepMs>0){state.awaitingUploadProgress=(state.awaitingUploadProgress||0)+1;try{await delay(stepMs,this.controller.signal);}finally{state.awaitingUploadProgress--;}}this.upload.onprogress?.({loaded:state.uploadRepeatProgress?1:Math.ceil(body.size*step/steps),total:body.size});}
        if(this.controller.signal.aborted)return;
        // Native Blob/crypto work implements the fake server's zero-delay
        // response. Do not let a virtual network clock outrun that real work.
        state.nativeUploadReplies=(state.nativeUploadReplies||0)+1;
        try{this.response=await mockFetch(this.url,{method:this.method,headers:this.headers,body,signal:this.controller.signal});this.status=this.response.status;this.responseText=await this.response.text();}
        finally{state.nativeUploadReplies--;}
        if(this.controller.signal.aborted)return;
        this.onprogress?.({loaded:this.responseText.length});this.onload?.();
      }catch(error){if(!this.controller.signal.aborted)this.onerror?.(error);}
    })();}
  }
  const context=vm.createContext({Error,TypeError,Date:clock?.Date||Date,console,setTimeout:harnessSetTimeout,clearTimeout:harnessClearTimeout,queueMicrotask,Blob,Headers,Response,XMLHttpRequest:uploadProgressTransport?MockXMLHttpRequest:undefined,ReadableStream,TextEncoder,URL,URLSearchParams,Uint8Array,AbortController,crypto:webcrypto,fetch:mockFetch,document,Event:class Event{constructor(type){this.type=type;}},CustomEvent:class CustomEvent{},localStorage,addEventListener,removeEventListener(){},dispatchEvent(){},google:{accounts:{oauth2:oauth}},StudyDirector:{registerPlugin(descriptor){return descriptor.setup(api);}}});
  context.window=context;context.globalThis=context;context[Symbol.for('studyDirector.profileScope.v1')]=Object.freeze({scoped:name=>String(name)});vm.runInContext(source,context,{filename:'source/external/drive.js'});assert.ok(provider,'Drive provider must register');return {state,provider,context,fetch:mockFetch};
}
