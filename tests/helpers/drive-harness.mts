import {readCoreScript} from './core-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {EXTERNAL_REPOSITORY_IDENTITIES} from '../../contracts/canonical-identities.mts';
import {compileScript} from '../../build/source-script.mts';
const source=compileScript(
 fs.readFileSync(new URL('../../source/external/drive.ts',import.meta.url),'utf8')
  .replaceAll('@@SD_RELEASE@@','QA_FIXTURE').replaceAll('@@SD_RELEASE_ID@@','vb8')
  .replaceAll('@@SD_GOOGLE_OAUTH_CLIENT_ID@@','306494096916-p48tjuv0ni01c11a0dp4ini9gp3dafdi.apps.googleusercontent.com')
  .replaceAll('@@SD_DRIVE_SESSION_STORAGE_KEY@@','studyDirector.driveSession.v1')
  .replaceAll('@@SD_EXTERNAL_REPOSITORY_IDENTITIES@@',JSON.stringify(EXTERNAL_REPOSITORY_IDENTITIES))
  .replaceAll('@@SD_EXTERNAL_REPOSITORY_IDENTITIES_URI@@',encodeURIComponent(JSON.stringify(EXTERNAL_REPOSITORY_IDENTITIES))),
 'source/external/drive.ts'
);
const policyContext=vm.createContext({});
for(const file of ['internal','repository-policy'])vm.runInContext(readCoreScript(file),policyContext);
const repositoryPolicy=field(registeredExports(policyContext,'repository-policy'),'protocol');
import {createDriveServer,type RemoteState,type Timer,type DriveClock} from './drive-server.mts';
import {method,registeredExports} from './registered-exports.mts';
import {field} from './repository-safety-ports.mts';
import {required} from './repository-note-ports.mts';
export {pendingRepositoryDigests,repositoryDigest} from './drive-server.mts';
export const QA_PROFILE_ID='prof_qa_mve00000_abcdef01';
type Clock=DriveClock;
type HarnessOptions={expiresIn?:number;clock?:Clock|null;registerProvider?:((config:Record<string,unknown>)=>unknown)|null;uploadProgressTransport?:boolean;localStorage?:unknown;remoteState?:Partial<RemoteState>|null;addEventListener?:(type:string,listener:(event:unknown)=>unknown,options?:unknown)=>unknown;profileId?:()=>string;profileName?:()=>string;bind?:(info:unknown,assertOrigin:()=>void)=>unknown;email?:string;device?:()=>string;profilePortPatch?:unknown};
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
const defaultBind=async(info:unknown)=>field(info,'mine')?'continue':'claim';
export function createDriveHarness({expiresIn=3600,clock=null,registerProvider=null,uploadProgressTransport=true,localStorage=undefined,remoteState=null,addEventListener=()=>{},profileId=()=>QA_PROFILE_ID,profileName=()=>'',bind=defaultBind,email='qa@example.com',device=()=>'inst_qa_harness_mve00000_abcdef01',profilePortPatch=null}:HarnessOptions={}){
 const harnessSetTimeout=<T extends unknown[]>(fn:(...args:T)=>void,ms:number,...args:T):Timer=>{if(clock)return clock.setTimeout(()=>fn(...args),ms);const timer=setTimeout(()=>fn(...args),ms);if(Number(ms)>5000)timer.unref?.();return timer;};
 const harnessClearTimeout=(id:Timer)=>{if(typeof id==='number'&&clock)clock.clearTimeout(id);else clearTimeout(id);};
 const {state,fetch:mockFetch,delay}=createDriveServer({email,expiresIn,clock,remoteState,timers:{set:harnessSetTimeout,clear:harnessClearTimeout}});
  let provider:Record<string,unknown>|null=null;
  type Script={tagName:string;remove():void;setAttribute():void;appendChild():void;style:Record<string,unknown>;src:string;async:boolean;defer:boolean;onload:(()=>void)|null;onerror:(()=>void)|null};
  const scripts:Script[]=[];
  const document={scripts,head:{appendChild(node:Script){scripts.push(node);queueMicrotask(()=>node.onload&&node.onload());return node;}},body:{appendChild(){return null;}},createElement(tag:string):Script{return {tagName:String(tag).toUpperCase(),remove(){},setAttribute(){},appendChild(){},style:{},src:'',async:false,defer:false,onload:null,onerror:null};},getElementById(){return null;}};
  const oauth={hasGrantedAllScopes(response:unknown,scope:string){return String(field(response,'scope')||'').split(/\s+/).includes(scope);},initTokenClient(config:{callback:(value:unknown)=>void}):unknown{return {requestAccessToken(){state.authorizationRequests+=1;const requestNumber=state.authorizationRequests,respond=()=>config.callback({access_token:`token-${requestNumber}`,expires_in:state.expiresIn,token_type:'Bearer',scope:state.scope});if(state.authorizationHold)state.authorizationResponder=()=>{state.authorizationResponder=null;queueMicrotask(respond);};else queueMicrotask(respond);}};},revoke(_token:string,callback:(value:unknown)=>void){queueMicrotask(()=>callback({successful:true}));}};
  state.releasedDownloads=0;
  const profilePort={id:()=>profileId(),name:()=>profileName(),bind:async (info:unknown,assertOrigin:()=>void)=>{state.binds.push(info);return bind(info,assertOrigin);},deleted:(info:unknown)=>{state.deletedSignals.push(info);},controls:(control:unknown)=>{state.libraryControl=control;}};if(profilePortPatch&&typeof profilePortPatch==='object')Object.assign(profilePort,profilePortPatch);
  const api={capabilities:{pluginApi:1,backupController:1,backupProviders:1},backup:{repositoryPolicy,receiveStream:async(stream:ReadableStream<Uint8Array>,size:number,options:{signal?:AbortSignal|null;onProgress?:(value:{phase:string;loaded:number;total:number})=>void}={})=>{if(options.signal?.aborted)throw new Error('cancelled');const blob=await new Response(stream).blob();assert.equal(blob.size,size);options.onProgress?.({phase:'downloading',loaded:blob.size,total:size});return blob;},releaseFile:async()=>{state.releasedDownloads+=1;},limits:{maxFileBytes:20*1024*1024},device:()=>device(),profile:profilePort,providers:{register(config:unknown){assert.ok(isRecord(config),'Drive registration must supply an object');for(const name of ['prepare','authorize','connected','disconnect','release'])method(config,name);method(config['repository'],'list');method(config['repository'],'upload');method(config['repository'],'download');provider=config;return registerProvider?registerProvider(config):true;}}}};
  class MockXMLHttpRequest{
    upload:{onprogress?:(event:{loaded:number;total:number})=>void}={};headers=new Headers();controller=new AbortController();
    method='';url='';response:Response|undefined;status=0;responseText='';
    onabort?:()=>void;onerror?:(error:unknown)=>void;onload?:()=>void;onprogress?:(event:{loaded:number})=>void;
    open(method:string,url:string,async:boolean){assert.equal(async,true);this.method=method;this.url=url;}
    setRequestHeader(key:string,value:string){this.headers.set(key,value);}
    getAllResponseHeaders(){return [...required(this.response).headers].map(([key,value])=>key+': '+value).join('\r\n');}
    abort(){this.controller.abort();state.uploadAborts=(state.uploadAborts||0)+1;this.onabort?.();}
    send(body:Blob){void (async()=>{
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
  const context={navigator:{get onLine(){return state.offline!==true;}},Error,TypeError,Date:clock?.Date||Date,console,setTimeout:harnessSetTimeout,clearTimeout:harnessClearTimeout,queueMicrotask,Blob,Headers,Response,XMLHttpRequest:uploadProgressTransport?MockXMLHttpRequest:undefined,ReadableStream,TextEncoder,URL,URLSearchParams,Uint8Array,AbortController,crypto:webcrypto,fetch:mockFetch,document,Event:class Event{readonly type:string;constructor(type:string){this.type=type;}},CustomEvent:class CustomEvent{},localStorage,addEventListener,removeEventListener(){},dispatchEvent(){},google:{accounts:{oauth2:oauth}},StudyDirector:{registerPlugin(descriptor:unknown){return method(descriptor,'setup')(api);}}};vm.createContext(context);
  Reflect.set(context,'window',context);Reflect.set(context,'globalThis',context);Reflect.set(context,Symbol.for('studyDirector.profileScope.v1'),Object.freeze({scoped:(name:string)=>String(name)}));vm.runInContext(source,context,{filename:'source/external/drive.ts'});assert.ok(provider,'Drive provider must register');return {state,provider,context,fetch:mockFetch};
}
