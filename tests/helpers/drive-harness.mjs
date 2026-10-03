import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {EXTERNAL_REPOSITORY_IDENTITIES} from '../../contracts/canonical-identities.mjs';
const source=fs.readFileSync(new URL('../../source/external/drive.js',import.meta.url),'utf8')
 .replaceAll('@@SD_RELEASE@@','QA_FIXTURE').replaceAll('@@SD_RELEASE_ID@@','vb8')
 .replaceAll('@@SD_GOOGLE_OAUTH_CLIENT_ID@@','306494096916-p48tjuv0ni01c11a0dp4ini9gp3dafdi.apps.googleusercontent.com')
 .replaceAll('@@SD_EXTERNAL_REPOSITORY_IDENTITIES@@',JSON.stringify(EXTERNAL_REPOSITORY_IDENTITIES));
const policyContext=vm.createContext({});
for(const file of ['internal','repository-policy'])vm.runInContext(fs.readFileSync(new URL(`../../source/core/${file}.js`,import.meta.url),'utf8'),policyContext);
const repositoryPolicy=policyContext[Symbol.for('studyDirector.internalModules.v1')].require('repository-policy',1).protocol;
export const repositoryDigest=async blob=>Buffer.from(await webcrypto.subtle.digest('SHA-256',await blob.arrayBuffer())).toString('hex');
const digest=repositoryDigest;
function json(payload,status=200,headers={}){return new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json',...headers}});}
export function createDriveHarness({expiresIn=3600,clock=null,registerProvider=null}={}){
  const state={rangeMode:'valid',expiresIn,folders:[],files:new Map(),uploads:new Map(),requests:[],deletions:[],trashedFolders:new Set(),nextId:1,nextFolderId:1,nextVersion:1,scope:'https://www.googleapis.com/auth/drive.file',force401Once:false,evilUploadLocation:false,networkFailPutOnce:false,networkFailCoordinationPostOnce:false,networkFailCoordinationDeleteOnce:false,folderShared:false,folderCreateDenied:false,folderListGate:null,folderListStarted:0,uploadPutGate:null,uploadPutStarted:0};
  const folderMetadata=(id='folder-1')=>({id,name:EXTERNAL_REPOSITORY_IDENTITIES.driveFolder,mimeType:'application/vnd.google-apps.folder',ownedByMe:true,shared:!!state.folderShared,trashed:state.trashedFolders.has(id),appProperties:{studyDirectorFolder:'true'},capabilities:{canAddChildren:true}});
  const fileMetadata=file=>({id:file.id,name:file.name,size:String(file.content.size),version:String(file.version||''),modifiedTime:file.modifiedTime,createdTime:file.createdTime,mimeType:file.mimeType,parents:[...file.parents],ownedByMe:file.ownedByMe,shared:file.shared,trashed:file.trashed,sha256Checksum:String(file.sha256Checksum||''),appProperties:{...file.appProperties},capabilities:{canDownload:file.canDownload}});
  const findId=pathname=>decodeURIComponent(pathname.split('/').at(-1));
  const delay=(ms,signal)=>new Promise((resolve,reject)=>{let timer;const clear=()=>{harnessClearTimeout(timer);signal?.removeEventListener('abort',abort);},abort=()=>{clear();reject(signal.reason||Object.assign(new Error('QA_FIXTURE request cancelled'),{name:'AbortError'}));};timer=harnessSetTimeout(()=>{clear();resolve();},ms);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});
  async function mockFetch(input,options={}){
    const url=new URL(String(input)),method=String(options.method||'GET').toUpperCase(),headers=new Headers(options.headers||{});
    state.requests.push({url:url.href,method,authorization:headers.get('Authorization')||''});
    assert.equal(url.origin,'https://www.googleapis.com','token-bearing requests must remain on the exact Google API origin');
    assert.match(headers.get('Authorization')||'',/^Bearer token-/u);
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
      if(metadata.mimeType==='application/vnd.google-apps.folder'){
        const id=`folder-${state.nextFolderId++}`;state.folders.push(id);return json(folderMetadata(id));
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
      const uploadId=url.searchParams.get('upload_id'),pending=state.uploads.get(uploadId);assert.ok(pending,'upload session must exist');
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
          return new Response(content,{status:206,headers:{'Content-Range':state.rangeMode==='wrong-range'?`bytes 1-2/${file.content.size}`:`bytes ${start}-${end}/${file.content.size}`}});
        }
        return new Response(file.content,{status:200,headers:{'Content-Length':String(file.content.size),'Content-Type':file.mimeType}});
      }
      return json(fileMetadata(file));
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
  const api={capabilities:{pluginApi:1,backupController:1,backupProviders:1},backup:{repositoryPolicy,receiveStream:async(stream,size,options={})=>{if(options.signal?.aborted)throw new Error('cancelled');const blob=await new Response(stream).blob();assert.equal(blob.size,size);options.onProgress?.({phase:'downloading',loaded:blob.size,total:size});return blob;},releaseFile:async()=>{state.releasedDownloads+=1;},limits:{maxFileBytes:20*1024*1024},providers:{register(config){provider=config;return registerProvider?registerProvider(config):true;}}}};
  const harnessSetTimeout=(fn,ms,...args)=>{if(clock)return clock.setTimeout(()=>fn(...args),ms);const timer=setTimeout(fn,ms,...args);if(Number(ms)>5000)timer.unref?.();return timer;};
  const harnessClearTimeout=id=>clock?clock.clearTimeout(id):clearTimeout(id);
  const context=vm.createContext({Error,TypeError,Date:clock?.Date||Date,console,setTimeout:harnessSetTimeout,clearTimeout:harnessClearTimeout,queueMicrotask,Blob,Headers,Response,ReadableStream,TextEncoder,URL,URLSearchParams,Uint8Array,AbortController,crypto:webcrypto,fetch:mockFetch,document,Event:class Event{constructor(type){this.type=type;}},CustomEvent:class CustomEvent{},addEventListener(){},removeEventListener(){},dispatchEvent(){},google:{accounts:{oauth2:oauth}},StudyDirector:{registerPlugin(descriptor){return descriptor.setup(api);}}});
  context.window=context;context.globalThis=context;vm.runInContext(source,context,{filename:'source/external/drive.js'});assert.ok(provider,'Drive provider must register');return {state,provider,context};
}
