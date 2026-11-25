/*
  Study Director native Google Drive connection
  Copyright © 2026 Shubham Tiwari and Dr Satyam Kumar. All rights reserved.
  Source-available for personal and noncommercial use only.
  See LICENSE.txt and NOTICE.txt for full terms.
*/
// The browser-facing owner carries only opaque native session and transfer
// identities. Google credentials, HTTP and repository admission stay in Rust.
const createStudyDirectorDriveConnection=ports=>{
  'use strict';
  const {Platform,requirePlatform,profileEmail,profileFolder,onInvalidated}=ports;
  const available=window.__SD_NATIVE_DRIVE_AVAILABLE__===true&&typeof window.__TAURI_INTERNALS__?.invoke==='function';
  const invoke=available?window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__):null;
  const MAX_CHUNK=2*1024*1024,MAX_REPLY=8*1024*1024,MAX_READ=256*1024;
  const listeners=new Set();
  let session=null,opening=null,auth=null,admitted=false,previous=false,flight=null,retiring=null,epoch=0,expiresAt=0;
  const identity=()=>auth;
  const notify=()=>{for(const listener of [...listeners])try{listener();}catch{}};
  const changed=()=>new Error('Google Drive authorization changed. Start a new operation.');
  const aborted=signal=>signal?.reason instanceof Error?signal.reason:Object.assign(new Error('Google Drive request was cancelled.'),{name:'AbortError'});
  const check=(expected,signal)=>{if(signal?.aborted)throw aborted(signal);if(!expected||expected!==auth||expected.session!==session)throw changed();};
  async function call(command){
    if(!invoke)throw new Error('Native Google Drive is not configured in this build.');
    try{return await invoke('native_drive',{command});}catch(error){throw new Error(typeof error==='string'?error:String(error?.message||'Native Google Drive operation failed.'));}
  }
  function clear(expected){
    if(expected&&expected!==auth)return false;
    epoch++;auth=null;admitted=false;expiresAt=0;onInvalidated();notify();return true;
  }
  async function prepare(){
    requirePlatform();
    if(!available)throw new Error('Native Google Drive is not configured in this build.');
    if(session)return session;
    if(!opening){
      const scope=String(window[Symbol.for('studyDirector.profileScope.v1')]?.scope||'');
      opening=call({op:'open',scope,email:profileEmail()||null}).then(row=>{
        if(!row||!/^[-_a-zA-Z0-9]{43}$/u.test(row.session)||!Number.isSafeInteger(row.generation)||row.generation<=0)throw changed();
        session=row.session;return session;
      }).finally(()=>{opening=null;});
    }
    return opening;
  }
  function cancel(handle){if(handle)void call({op:'cancel',session:handle.session,id:handle.id}).catch(()=>{});}
  async function allocate(owner,generation,signal){
    if(signal?.aborted)throw aborted(signal);
    const id=await call({op:'allocate',session:owner,generation});
    if(typeof id!=='string'||!/^[-_a-zA-Z0-9]{43}$/u.test(id))throw changed();
    const handle=Object.freeze({session:owner,generation,id});
    if(signal?.aborted){cancel(handle);throw aborted(signal);}
    return handle;
  }
  function interruptible(work,handle,signal){
    if(!signal)return work;
    if(signal.aborted){cancel(handle);void work.catch(()=>{});return Promise.reject(aborted(signal));}
    let listener;
    const stop=new Promise((_,reject)=>{listener=()=>{cancel(handle);reject(aborted(signal));};signal.addEventListener('abort',listener,{once:true});});
    return Promise.race([work,stop]).finally(()=>signal.removeEventListener('abort',listener));
  }
  async function authorize({operation='connect',signal=null,restore=false}={}){
    if(retiring)await retiring;
    if(signal?.aborted)throw aborted(signal);
    if(auth)return auth;
    const interactive=operation==='connect'&&!restore;
    if(!interactive&&!restore)throw new Error('Connect Google Drive first.');
    if(flight){
      try{await flight;}catch(error){if(!interactive)throw error;}
      if(signal?.aborted)throw aborted(signal);
      if(auth)return auth;
    }
    const started=epoch;
    const work=(async()=>{
      const owner=await prepare();
      if(started!==epoch||signal?.aborted)throw signal?.aborted?aborted(signal):changed();
      const generation=await call({op:'generation',session:owner});
      if(!Number.isSafeInteger(generation)||generation<=0||started!==epoch)throw changed();
      const handle=await allocate(owner,generation,signal);
      try{
        if(started!==epoch)throw changed();
        const row=await interruptible(call({op:'authorize',session:owner,generation,id:handle.id,interactive}),handle,signal);
        if(started!==epoch||owner!==session||signal?.aborted)throw signal?.aborted?aborted(signal):changed();
        if(!row||!Number.isSafeInteger(row.generation)||row.generation<generation||!Number.isSafeInteger(row.remaining_seconds)||row.remaining_seconds<0||typeof row.email!=='string'||!row.email.includes('@'))throw changed();
        if(profileEmail()&&profileEmail()!==row.email)throw new Error('Google authorization belongs to a different account.');
        auth=Object.freeze({session:owner,generation:row.generation});previous=true;expiresAt=Date.now()+row.remaining_seconds*1000;
        onInvalidated();return auth;
      }finally{cancel(handle);}
    })();
    flight=work;
    try{return await work;}finally{if(flight===work)flight=null;}
  }
  async function restoreSession(){
    // Never let background restoration choose/adopt a foreign library.
    if(!available||!profileEmail()||!profileFolder())return false;
    try{return await authorize({operation:'restore',restore:true});}catch{return false;}
  }
  async function admit(expected,folder,profile,signal){
    check(expected,signal);
    await call({op:'admit',session:expected.session,generation:expected.generation,folder,profile});
    check(expected,signal);
  }
  function confirmAdmission(expected){
    check(expected);
    if(!admitted){admitted=true;notify();}
  }
  async function invalidate(expected){
    if(!expected||expected!==auth)return false;
    const work=call({op:'invalidate',session:expected.session,generation:expected.generation}).catch(()=>{});
    retiring=work;
    clear(expected);
    try{await work;}finally{if(retiring===work)retiring=null;}
    return true;
  }
  async function disconnect(expected){
    if(expected&&expected!==auth)return false;
    if(!session&&!previous)return true;
    const original=auth,started=epoch;
    if(retiring)await retiring;
    const owner=await prepare(),generation=expected?.generation??await call({op:'generation',session:owner});
    if(started!==epoch||original!==auth)throw changed();
    const work=call({op:'disconnect',session:owner,generation});
    retiring=work;
    clear(original);previous=false;
    try{await work;return true;}finally{if(retiring===work)retiring=null;}
  }
  function encode(bytes){
    if(bytes.byteLength>MAX_CHUNK)throw new Error('Native Google Drive upload chunk is too large.');
    if(typeof bytes.toBase64==='function')return bytes.toBase64();
    let text='';for(let i=0;i<bytes.length;i+=0x8000)text+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return btoa(text);
  }
  function decode(value,max){
    if(typeof value!=='string'||value.length>Math.ceil(max/3)*4)throw new Error('Native Google Drive returned an invalid response.');
    let bytes;
    if(typeof Uint8Array.fromBase64==='function')bytes=Uint8Array.fromBase64(value);
    else{const text=atob(value);bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);}
    if(bytes.byteLength>max)throw new Error('Native Google Drive returned an oversized response.');return bytes;
  }
  async function bodyBytes(body){
    if(body===undefined||body===null)return new Uint8Array();
    if(typeof body==='string')return new TextEncoder().encode(body);
    if(body instanceof Platform.Blob&&body.size<=MAX_CHUNK)return new Uint8Array(await body.arrayBuffer());
    throw new Error('Native Google Drive request body is unsupported or too large.');
  }
  function prepareRequest(url,options,expected){
    check(expected);
    const method=String(options.method||'GET').toUpperCase(),headers=Object.fromEntries(new Platform.Headers(options.headers||{}));
    if(Object.hasOwn(headers,'authorization'))throw new Error('Native Google Drive does not accept browser credentials.');
    return async(signal,progress)=>{
      check(expected,signal);
      const body=encode(await bodyBytes(options.body));check(expected,signal);
      const handle=await allocate(expected.session,expected.generation,signal);
      let handedOff=false;
      try{
        check(expected,signal);
        const row=await interruptible(call({op:'request',session:handle.session,generation:handle.generation,id:handle.id,request:{url,method,headers,body}}),handle,signal);
        check(expected,signal);
        if(!row||!Number.isInteger(row.status)||row.status<200||row.status>599||typeof row.stream!=='boolean'||!row.headers||typeof row.headers!=='object')throw new Error('Native Google Drive returned an invalid response.');
        const responseHeaders=new Platform.Headers(row.headers);
        if(responseHeaders.has('authorization'))throw new Error('Native Google Drive returned unexpected credentials.');
        if(!row.stream){
          const bytes=decode(row.body,MAX_REPLY);
          progress?.();
          return new Platform.Response([204,205,304,308,401].includes(row.status)?null:bytes,{status:row.status,headers:responseHeaders});
        }
        if(method!=='GET'||!row.status||row.status>=300||row.body!=='')throw new Error('Native Google Drive returned an invalid media stream.');
        let closed=false;
        const cleanup=()=>{if(closed)return;closed=true;signal?.removeEventListener('abort',stop);cancel(handle);};
        const stop=()=>cleanup();
        const stream=new ReadableStream({
          async pull(controller){
            if(closed){controller.error(signal?.aborted?aborted(signal):changed());return;}
            try{
              check(expected,signal);
              const chunk=await interruptible(call({op:'read',session:handle.session,generation:handle.generation,id:handle.id}),handle,signal);
              check(expected,signal);
              if(!chunk||typeof chunk.done!=='boolean')throw new Error('Native Google Drive returned an invalid media chunk.');
              const bytes=decode(chunk.body,MAX_READ);
              if(chunk.done){if(bytes.length)throw new Error('Native Google Drive returned bytes after stream completion.');cleanup();controller.close();}
              else{if(!bytes.length)throw new Error('Native Google Drive returned an empty media chunk.');progress?.();controller.enqueue(bytes);}
            }catch(error){cleanup();controller.error(error);}
          },
          cancel(){cleanup();}
        },{highWaterMark:0});
        signal?.addEventListener('abort',stop,{once:true});
        if(signal?.aborted)stop();
        const response=new Platform.Response(stream,{status:row.status,headers:responseHeaders});
        handedOff=true;return response;
      }catch(error){
        if(expected===auth&&/authorization changed|authorization was revoked|Connect Google Drive first|different account|secure Windows credential/u.test(String(error?.message||'')))void invalidate(expected);
        throw error;
      }finally{if(!handedOff)cancel(handle);}
    };
  }
  return Object.freeze({kind:'native',available,identity,prepare,authorize,admit,confirmAdmission,restoreSession,disconnect,invalidate,prepareRequest,
    connected:()=>admitted&&!!auth,automaticConfigured:()=>previous||admitted,connectionExpiresAt:()=>admitted?expiresAt:0,
    subscribeConnection:listener=>{if(typeof listener!=='function')return ()=>{};listeners.add(listener);return ()=>listeners.delete(listener);},
    release:async({operation}={})=>{if(operation==='connect'&&!admitted&&auth)await invalidate(auth);}
  });
};
