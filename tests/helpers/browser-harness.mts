import {resolveChromiumExecutable} from './browser-executable.mts';
import {readRuntimeSource} from './runtime-source.mts';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {spawn} from 'node:child_process';

type Row=Record<string,unknown>;
type BuildKind='development'|'deployment';
type Viewport={width:number;height:number;mobile?:boolean;scale?:number};
type ScreenshotClip={x:number;y:number;width:number;height:number;scale?:number};
type WaitOptions={timeout?:number;interval?:number;label?:string};
type PageSettings={bypassServiceWorker?:boolean;timezoneId?:string;userAgent?:string;platform?:string;viewport?:Viewport;preload?:string};
type LaunchOptions={executable?:string;profilePrefix?:string;args?:string[]};
type PageEvent={kind:string;text:string;url?:string};
type Pending={resolve:(row:Row)=>void;reject:(error:unknown)=>void};
function row(value:unknown):Row{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid object in browser protocol.');
  return Object.fromEntries(Object.entries(value).map(([key,entry]:[string,unknown])=>[key,entry]));
}
function rows(value:unknown):Row[]{if(!Array.isArray(value))throw new Error('Invalid array in browser protocol.');return value.map(row);}
function str(value:unknown,fallback=''):string{return typeof value==='string'?value:fallback;}
function point(value:unknown):{x:number;y:number}{const p=row(value);if(typeof p['x']!=='number'||typeof p['y']!=='number'||!Number.isFinite(p['x'])||!Number.isFinite(p['y']))throw new Error('Invalid browser point.');return {x:p['x'],y:p['y']};}
function errorText(error:unknown):string{return error instanceof Error?error.message:String(error);}
function exceptionText(value:unknown,fallback:string):string{const detail=row(value),exception=detail['exception'];return str(exception&&row(exception)['description'])||str(detail['text'])||fallback;}
export const root=process.cwd();
export const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
export async function waitFor<T>(fn:()=>T|Promise<T>,{timeout=45000,interval=100,label='condition'}:WaitOptions={}):Promise<T>{
  const started=Date.now();let last:unknown;
  while(Date.now()-started<timeout){
    try{const result=await fn();last=result;if(result)return result;}catch(error){last=error;}
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${label}${last instanceof Error?`: ${last.message}`:''}`);
}

// The first-start form opens only after an async storage check, so a single
// Skip click can land before it exists. Skip it once it opens and wait until
// this page's profile has finished its first start (secondary pages never open it).
export async function skipFirstStart(page:CdpPage,{timeout=45000}={}){
  return waitFor(()=>page.evaluate(`(()=>{const dialog=document.getElementById('first-start-dialog');if(dialog&&dialog.open){document.querySelector('[data-action="first-start-skip"]').click();return false;}const scope=window[Symbol.for('studyDirector.profileScope.v1')];let list=null;try{list=JSON.parse(localStorage.getItem(scope.registryKey)||'null');}catch{}const mine=Array.isArray(list&&list.profiles)?list.profiles.find(entry=>entry&&entry.scope===scope.scope):null;return !!mine&&mine.fresh!==true;})()`),{timeout,label:'first start finished'});
}

// Pane entrances and dialog surfaces animate opacity and scale for a moment.
// Wait for those finite animations to end before measuring colours or sizes
// (looping indicators are left alone).
export async function settleMotion(page:CdpPage,{timeout=5000}={}){
  return page.evaluate(`(()=>{const finite=document.getAnimations().filter(a=>a.playState==='running'&&Number.isFinite(a.effect?.getComputedTiming?.().endTime));
    return Promise.race([Promise.all(finite.map(a=>a.finished.catch(()=>{}))),new Promise(r=>setTimeout(r,${Number(timeout)}))]).then(()=>finite.length);})()`);
}

function readBuildManifest(){
  const manifest=row(JSON.parse(readRuntimeSource(path.join(root,'dist','build-manifest.json'))) as unknown);if(typeof manifest['main']!=='string'||!manifest['main'])throw new Error('Invalid build manifest main.');return {...manifest,main:manifest['main']};
}

function contentType(name:string){
  if(name.endsWith('.html'))return 'text/html; charset=utf-8';
  if(name.endsWith('.js'))return 'application/javascript; charset=utf-8';
  if(name.endsWith('.css'))return 'text/css; charset=utf-8';
  if(name.endsWith('.webmanifest'))return 'application/manifest+json; charset=utf-8';
  if(name.endsWith('.woff2'))return 'font/woff2';
  if(name.endsWith('.png'))return 'image/png';
  if(name.endsWith('.json'))return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

// A paste as the browser delivers it, for use inside page.evaluate: the
// "paste" event, then (unless a handler took it) "beforeinput" insertFromPaste
// carrying the data and the selection's range. Wordgard reads the second.
export const pasteInPage=`((target,data)=>{const paste=new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true});target.dispatchEvent(paste);if(paste.defaultPrevented)return paste;const selection=getSelection(),range=selection&&selection.rangeCount?selection.getRangeAt(0):null;const input=new InputEvent('beforeinput',{inputType:'insertFromPaste',dataTransfer:data,targetRanges:range?[new StaticRange(range)]:[],bubbles:true,cancelable:true});target.dispatchEvent(input);return input;})`;
export function withoutPwaChecks(html:string){
  let disabled=html.replace(/void\s+(?:PwaRuntime|PwaLifecycle)\s*\.\s*install\s*\(\s*\)(?:\s*\.\s*then\s*\(\s*\(\s*\)\s*=>\s*schedulePwaUpdateCheck\s*\(\s*750\s*\)\s*\))?\s*;/u,'/* Dedicated PWA browser tests cover installation. */');
  disabled=disabled.replace(/async\s+function\s+checkPwaUpdateIfDue\([^\n]+\)\{/u,match=>match+' return false; /* Dedicated PWA browser tests cover update checks. */');
  if(/\b(?:PwaRuntime|PwaLifecycle)\s*\.\s*install\s*\(/u.test(disabled))throw new Error('PWA install call remained in a PWA-disabled browser fixture.');
  return disabled;
}
export function instrumentedHtml(kind:BuildKind='deployment',options:{disablePwa?:boolean}={}){
  const manifest=readBuildManifest();
  let html=readRuntimeSource(path.join(root,'dist',kind,manifest.main));
  const marker='/* PUBLIC PLUGIN API */';
  if(!html.includes(marker))throw new Error(`PWA6 instrumentation marker missing from ${kind}.`);
  const exposure=`window.__PWA6=Object.freeze({StartupLifecycle,SessionLifecycle,AppOwnership,TimerState,TimerEngine,PracticePacer,Interactions,SystemNotifications,Pomodoro,NoticeCoordinator,AppData,PlanData,DailyReflectionPersistence,restoreSessionStateThroughLifecycle,IndexedDb,UnsupportedData,Profiles,BackupController,BackupProviderRuntime,DeviceBackup,NativeCapabilities,PwaLifecycle,SessionEvidenceGateway,ReviewModel,ReviewView,ReviewEditor,LibraryView,PlanDraftEditor,KeptVersions,BackupPresentation,applySchedule,goTab,commitTaskNoteEditor,setStudyQuality,saveDayRecord,flushLiveDraft,todayISO,readStorageHealth,loadScheduleIntoDraft,resetTodaySession,markDone,togglePause,setCurrentTask,refreshPnote,checkSessionOwnershipClaim,RichTextRuntime,RichTextAssets,RecoveryAssetMaintenancePause,renderRichTextContent});\n`;
  html=html.replace(marker,exposure+marker);
  if(options.disablePwa!==false)html=withoutPwaChecks(html);
  return html;
}

// Use the same test API with the staged assets and the actual minified host.
export function instrumentedMinifiedHtml(server:Awaited<ReturnType<typeof startReleaseServer>>, directory:string, fixtureHtml:string) {
  const exposure = fixtureHtml.match(/window\.__PWA6=Object\.freeze\(\{[^;]+;\n/);
  const publication = 'HOST_WINDOW.StudyDirector=StudyDirectorPublicAPI;';
  const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
  if (!exposure || html.split(publication).length !== 2) throw new Error('Missing or ambiguous minified host instrumentation.');
  for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
    if (entry.isFile()) server.setOverride('deployment', entry.name, fs.readFileSync(path.join(directory, entry.name)));
  }
  return withoutPwaChecks(html.replace(publication, () => exposure[0]! + publication));
}

export async function startReleaseServer(){
  const manifest=readBuildManifest();
  const overrides=new Map<string,string|Buffer>(),failures=new Map<string,{remaining:number;status:number;body:string}>(),requests:{method:string;path:string;at:number}[]=[];let offline=false;
  const server=http.createServer((request,response)=>{
    const url=new URL(request.url||'/','http://127.0.0.1');
    requests.push({method:request.method||'GET',path:url.pathname,at:Date.now()});
    if(offline){request.socket.destroy();return;}
    const match=url.pathname.match(/^\/(development|deployment)\/(.*)$/);
    if(!match){response.writeHead(404);response.end('not found');return;}
    const kind=match[1]==='development'?'development':'deployment',relative=decodeURIComponent(match[2]||'index.html');
    if(relative.includes('..')){response.writeHead(400);response.end('bad path');return;}
    const pathname=`/${kind}/${relative}`;
    const failure=failures.get(pathname);
    if(failure&&failure.remaining>0){
      failure.remaining-=1;
      response.writeHead(failure.status||503,{'content-type':'text/plain','cache-control':'no-store'});
      response.end(failure.body||'injected network failure');return;
    }
    const override=overrides.get(pathname);
    if(override!==undefined){
      response.writeHead(200,{'content-type':contentType(relative),'cache-control':'no-store','service-worker-allowed':`/${kind}/`});
      response.end(override);return;
    }
    if(relative==='instrumented.html'){
      response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
      response.end(instrumentedHtml(kind));return;
    }
    const base=path.resolve(root,'dist',kind),file=path.resolve(base,relative||manifest.main);
    if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
      response.writeHead(404);response.end('not found');return;
    }
    const headers:Record<string,string>={'content-type':contentType(relative),'cache-control':relative==='sw.js'?'no-cache, no-store, must-revalidate':relative==='index.html'||relative==='manifest.webmanifest'?'no-cache, must-revalidate':'public, max-age=31536000, immutable'};
    if(relative==='sw.js')headers['service-worker-allowed']=`/${kind}/`;
    response.writeHead(200,headers);response.end(fs.readFileSync(file));
  });
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address();if(!address||typeof address==='string')throw new Error('Release server has no TCP address.');
  const origin=`http://127.0.0.1:${address.port}`;
  return Object.freeze({
    origin,manifest,requests,
    url:(kind='deployment',name='index.html')=>`${origin}/${kind}/${name}`,
    setOverride:(kind:BuildKind,name:string,body:string|Buffer)=>overrides.set(`/${kind}/${name}`,body),
    clearOverride:(kind:BuildKind,name:string)=>overrides.delete(`/${kind}/${name}`),
    failNext:(kind:BuildKind,name:string,count=1,status=503,body='injected network failure')=>failures.set(`/${kind}/${name}`,{remaining:count,status,body}),
    setOffline:(value:boolean)=>{offline=value===true;},
    close:()=>new Promise<void>(resolve=>{
      server.close(()=>resolve());
      if(typeof server.closeAllConnections==='function')server.closeAllConnections();
      setTimeout(resolve,1000);
    })
  });
}

export class CdpPage{
  readonly socket:WebSocket;
  readonly targetId:string;
  private nextId=0;
  private pending=new Map<number,Pending>();
  readonly events:PageEvent[]=[];
  readonly warnings:string[]=[];
  loadCount=0;
  coverageStarted=false;
  closed=false;
  private listeners=new Map<string,Set<(params:Row)=>void>>();
  constructor(socket:WebSocket,targetId:string){
    this.socket=socket;this.targetId=targetId;
    socket.onclose=()=>this.retire();
    socket.onmessage=event=>{
      const data:unknown=event.data;
      try{
        if(typeof data!=='string')throw new Error('Non-text CDP message.');
        const message=row(JSON.parse(data) as unknown);
        if(typeof message['id']==='number'){
          const pending=this.pending.get(message['id']);if(!pending)return;
          this.pending.delete(message['id']);
          if(message['error'])pending.reject(new Error(JSON.stringify(message['error'])));
          else{try{pending.resolve(row(message['result']??{}));}catch(error){pending.reject(error);}}
          return;
        }
        const method=str(message['method']),params=row(message['params']??{});
        for(const listener of this.listeners.get(method)||[]){try{listener(params);}catch(error){this.events.push({kind:'listener-error',text:error instanceof Error?error.stack||error.message:String(error)});}}
        if(method==='Page.loadEventFired')this.loadCount+=1;
        if(method==='Runtime.exceptionThrown')this.events.push({kind:'exception',text:exceptionText(params['exceptionDetails'],'Runtime exception')});
        if(method==='Runtime.consoleAPICalled'&&(params['type']==='error'||params['type']==='warning')){
          const text=rows(params['args']).map(arg=>String(arg['value']??arg['description']??'')).join(' ');
          if(params['type']==='error')this.events.push({kind:'console-error',text});else this.warnings.push(text);
        }
        if(method==='Log.entryAdded'){
          const entry=row(params['entry']);
          if(entry['level']==='error')this.events.push({kind:'log-error',text:str(entry['text']),...(entry['url']?{url:str(entry['url'])}:{})});
        }
      }catch(error){this.events.push({kind:'protocol-error',text:errorText(error)});this.retire();}
    };
  }
  static async connect(url:string,targetId:string){
    const socket=new WebSocket(url);await new Promise<void>((resolve,reject)=>{socket.onopen=()=>resolve();socket.onerror=reject;});
    return new CdpPage(socket,targetId);
  }
  on(method:string,listener:(params:Row)=>void){const listeners=this.listeners.get(method)??new Set<(params:Row)=>void>();this.listeners.set(method,listeners);listeners.add(listener);return ()=>listeners.delete(listener);}
  retire(){
    this.closed=true;
    const error=new Error('Chromium CDP page closed: '+this.targetId);
    for(const request of this.pending.values())request.reject(error);
    this.pending.clear();
  }
  send(method:string,params:Row={}):Promise<Row>{
    if(this.closed||this.socket.readyState!==WebSocket.OPEN)return Promise.reject(new Error('Chromium CDP page is closed: '+this.targetId));
    return new Promise<Row>((resolve,reject)=>{
      const id=++this.nextId;this.pending.set(id,{resolve,reject});
      try{this.socket.send(JSON.stringify({id,method,params}));}
      catch(error){this.pending.delete(id);reject(error);}
    });
  }
  async startCoverage(){
    if(!process.env['SD_BROWSER_COVERAGE_DIR']||this.coverageStarted)return;
    await this.send('Profiler.enable');await this.send('Debugger.enable');
    await this.send('Profiler.startPreciseCoverage',{callCount:true,detailed:true});this.coverageStarted=true;
  }
  async collectCoverage(){
    if(!this.coverageStarted||this.closed)return null;
    const taken=await this.send('Profiler.takePreciseCoverage'),scripts:Row[]=[];
    for(const item of rows(taken['result']??[])){
      if(!/^https?:\/\/127\.0\.0\.1(?::\d+)?\//u.test(str(item['url'])))continue;
      let source='';try{source=str((await this.send('Debugger.getScriptSource',{scriptId:item['scriptId']}))['scriptSource']);}catch{}
      if(source)scripts.push({...item,source});
    }
    await this.send('Profiler.stopPreciseCoverage').catch(()=>{});this.coverageStarted=false;
    if(!scripts.length)return null;
    const coverageDirectory=process.env['SD_BROWSER_COVERAGE_DIR'];if(!coverageDirectory)throw new Error('Browser coverage directory disappeared.');
    const directory=path.resolve(coverageDirectory);fs.mkdirSync(directory,{recursive:true});
    const file=path.join(directory,`browser-coverage-${process.pid}-${this.targetId||'page'}-${Date.now()}.json`);
    fs.writeFileSync(file,JSON.stringify({scripts},null,2));return file;
  }
  async evaluate(expression:string,{awaitPromise=true,returnByValue=true,userGesture=true}={}){
    const result=await this.send('Runtime.evaluate',{expression,awaitPromise,returnByValue,userGesture});
    if(result['exceptionDetails'])throw new Error(exceptionText(result['exceptionDetails'],'Evaluation failed'));
    const remote=row(result['result']);return returnByValue?remote['value']:remote;
  }
  async assertHealthyNavigation(expectedUrl=''){
    const state=row(await this.evaluate(`({href:location.href,title:document.title})`));
    if(String(state['href']||'').startsWith('chrome-error://')){
      throw new Error(`Chromium could not load local Study Director test origin${expectedUrl?`: ${expectedUrl}`:''}`);
    }
    return state;
  }
  async navigate(url:string){
    const previous=await this.evaluate('performance.timeOrigin');
    const result=await this.send('Page.navigate',{url});
    if(result['errorText'])throw new Error(`Chromium navigation failed for ${url}: ${result['errorText']}`);
    await waitFor(()=>this.evaluate(`performance.timeOrigin!==${previous}&&document.readyState==='complete'`),{label:`navigation ${url}`});
    await this.assertHealthyNavigation(url);
  }
  async reload(){const previous=await this.evaluate('performance.timeOrigin');await this.send('Page.reload',{ignoreCache:false});await waitFor(()=>this.evaluate(`performance.timeOrigin!==${previous}&&document.readyState==='complete'`),{label:'reload'});await this.assertHealthyNavigation('reload');}
  async settle(frames=2){
    const count=Math.max(1,Math.min(8,Number(frames)||2));
    await this.evaluate(`new Promise(resolve=>{let remaining=${count};const step=()=>{remaining-=1;if(remaining<=0)resolve(true);else requestAnimationFrame(step)};requestAnimationFrame(step)})`);
  }
  async setViewport({width,height,mobile=false,scale=1}:Viewport){
    await this.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:scale,mobile});
    await this.send('Emulation.setTouchEmulationEnabled',mobile?{enabled:true,maxTouchPoints:5}:{enabled:false});
  }
  async elementPoint(selector:string){
    // Disclosures and panes animate open; aim only once the layout has stopped.
    await settleMotion(this);
    // Preserve the page's position when the target is already available to a
    // user. Forced centering would contaminate scroll-stability assertions.
    await this.evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)return;const r=element.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(!hit||!(hit===element||element.contains(hit)))element.scrollIntoView({block:'center',inline:'nearest'});})()`);
    await this.settle();
    const location=point(await this.evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw new Error('Missing input target: '+${JSON.stringify(selector)});element.scrollIntoView({block:'nearest',inline:'nearest'});const rect=element.getBoundingClientRect(),style=getComputedStyle(element);if(rect.width<=0||rect.height<=0||style.display==='none'||style.visibility==='hidden')throw new Error('Hidden input target: '+${JSON.stringify(selector)});return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`));
    await this.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:location.x,y:location.y});
    await this.settle();
    const hit=row(await this.evaluate(`(()=>{const target=document.querySelector(${JSON.stringify(selector)}),hit=document.elementFromPoint(${location.x},${location.y});return {ok:!!hit&&(hit===target||target.contains(hit)),hit:hit?.outerHTML.slice(0,300)};})()`));
    if(!hit['ok'])throw new Error(`Covered input target: ${selector}; hit=${hit['hit']}`);
    return location;
  }
  async click(selector:string){
    const point=await this.elementPoint(selector);
    await this.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
    await this.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});
    await this.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});
  }
  async tap(selector:string){
    const point=await this.elementPoint(selector),touch={x:point.x,y:point.y,id:1,radiusX:2,radiusY:2,force:1};
    await this.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});
    await this.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  async setOffline(value:boolean){
    await this.send('Network.emulateNetworkConditions',{offline:value===true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  }
  async screenshot(file:string,clip:ScreenshotClip|null=null){
    const params:Row={format:'png',captureBeyondViewport:false,fromSurface:true};
    if(clip)params.clip={x:clip.x,y:clip.y,width:clip.width,height:clip.height,scale:clip.scale||1};
    const result=await this.send('Page.captureScreenshot',params);
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(str(result['data']),'base64'));return file;
  }
  close(){this.retire();this.socket.close();}
}

// Browser tests build plans and Saved Days around the current time. A whole-hour
// zone whose local time is about noon keeps them clear of the app's 04:00
// study-day boundary and of midnight, whenever the suite runs, and keeps the
// page's calendar date equal to the UTC date the test runner uses.
export function studyTimezone(at=new Date()){
  const offset=12-at.getUTCHours();
  return offset===0?'Etc/UTC':`Etc/GMT${offset>0?'-':'+'}${Math.abs(offset)}`;
}
export {resolveChromiumExecutable};

// Chromium can create DevToolsActivePort before it has written the port, so
// read until the file holds one; under CPU load that gap gets longer.
export async function devToolsPort(profile:string,{timeout=20000}={}){
  const file=path.join(profile,'DevToolsActivePort');
  return waitFor(()=>{try{const value=readRuntimeSource(file).split(/\r?\n/)[0]?.trim()||'';return /^[1-9]\d{0,4}$/u.test(value)?value:'';}catch{return '';}},{timeout,label:'Chromium DevTools port'});
}

export async function launchChromium(options:LaunchOptions={}){
  const chromium=resolveChromiumExecutable(options.executable||'');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),options.profilePrefix||'study-director-pwa6-'));
  const args=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank',...(options.args||[])];
  const processHandle=spawn(chromium,args,{stdio:['ignore','ignore','pipe'],env:{...process.env,TERM:process.env['TERM']||'xterm'}});
  let stderr='';processHandle.stderr.setEncoding('utf8');processHandle.stderr.on('data',(chunk:string)=>{stderr+=chunk;});
  let port:string;
  try{
    port=await Promise.race([
      devToolsPort(profile),
      new Promise<never>((_,reject)=>processHandle.once('exit',(code,signal)=>reject(new Error(`Chromium exited before DevTools became ready (code=${code}, signal=${signal||'none'}).`))))
    ]);
  }catch(error){
    if(processHandle.exitCode===null)processHandle.kill('SIGTERM');
    await Promise.race([new Promise<void>(resolve=>processHandle.once('exit',()=>resolve())),sleep(1000)]);
    if(processHandle.exitCode===null)processHandle.kill('SIGKILL');
    try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
    const detail=stderr.trim().slice(-4000);
    throw new Error(`${errorText(error)}; executable=${chromium}; stderr=${detail||'(empty)'}`,{cause:error});
  }
  await waitFor(async()=>{try{return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;}catch{return false;}},{label:'Chromium CDP endpoint'});
  const pages=new Set<CdpPage>();
  async function createPage(url:string,settings:PageSettings={}){
    const target=row(await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json() as unknown);
    const page=await CdpPage.connect(str(target['webSocketDebuggerUrl']),str(target['id']));
    pages.add(page);await page.send('Runtime.enable');await page.send('Page.enable');await page.send('Log.enable');await page.send('Network.enable');await page.send('Accessibility.enable');await page.startCoverage();
    const instrumentedRoute=new URL(url).pathname.endsWith('/instrumented.html');
    if(settings.bypassServiceWorker===true||instrumentedRoute)await page.send('Network.setBypassServiceWorker',{bypass:true});
    await page.send('Emulation.setTimezoneOverride',{timezoneId:settings.timezoneId||studyTimezone()});
    if(settings.userAgent)await page.send('Network.setUserAgentOverride',{userAgent:settings.userAgent,platform:settings.platform||''});
    await page.setViewport(settings.viewport||{width:1365,height:900,mobile:false,scale:1});
    if(settings.preload)await page.send('Page.addScriptToEvaluateOnNewDocument',{source:String(settings.preload)});
    await page.navigate(url);
    return page;
  }
  async function closePage(page:CdpPage){
    try{await page.collectCoverage();}catch(error){if(process.env['SD_BROWSER_COVERAGE_DIR'])console.warn(`[coverage] ${errorText(error)}`);}
    const targetId=page.targetId;
    try{await Promise.race([page.send('Page.close'),sleep(2000)]);}catch{}
    pages.delete(page);page.close();
    await waitFor(async()=>{
      if(processHandle.exitCode!==null)return true;
      try{
        const response=await fetch(`http://127.0.0.1:${port}/json/list`);
        if(!response.ok)return false;
        const targets=rows(await response.json() as unknown);
        return !targets.some(target=>target['id']===targetId);
      }catch{return processHandle.exitCode!==null;}
    },{timeout:10000,interval:50,label:'Chromium page close'});
  }
  async function close(){
    for(const page of [...pages]){try{await page.collectCoverage();}catch(error){if(process.env['SD_BROWSER_COVERAGE_DIR'])console.warn(`[coverage] ${errorText(error)}`);}}
    processHandle.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>processHandle.once('exit',resolve)),sleep(3000)]);
    if(processHandle.exitCode===null){processHandle.kill('SIGKILL');await Promise.race([new Promise(resolve=>processHandle.once('exit',resolve)),sleep(1000)]);}
    for(let attempt=0;attempt<10;attempt++){
      try{fs.rmSync(profile,{recursive:true,force:true});break;}catch(error){
        if(!(error&&typeof error==='object'&&'code' in error&&error.code==='ENOTEMPTY')||attempt===9)throw error;
        await sleep(150);
      }
    }
  }
  return Object.freeze({port,profile,process:processHandle,stderr:()=>stderr,createPage,closePage,close});
}

export async function waitForStudyDirector(page:CdpPage,{instrumented=false,timeout=45000}={}){
  const expression=instrumented
    ? `!!(window.StudyDirector&&window.__PWA6&&__PWA6.StartupLifecycle.status().fullyInitialized)`
    : `!!(window.StudyDirector&&document.documentElement.dataset.studyDirectorReady==='true')`;
  try{return await waitFor(()=>page.evaluate(expression),{timeout,label:'Study Director startup'});}
  catch(error){const state=await page.evaluate(`({href:location.href,startup:window.__PWA6?.StartupLifecycle.status(),lifecycle:document.documentElement.dataset.studyDirectorLifecycle,body:document.body.innerText.slice(-1500)})`).catch(()=>null);throw new Error(`${errorText(error)}; state=${JSON.stringify(state)}; errors=${JSON.stringify(page.events)}`,{cause:error});}
}
