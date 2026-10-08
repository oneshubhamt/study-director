import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {spawn} from 'node:child_process';

export const root=process.cwd();
export const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function waitFor(fn,{timeout=45000,interval=100,label='condition'}={}){
  const started=Date.now();let last;
  while(Date.now()-started<timeout){
    try{last=await fn();if(last)return last;}catch(error){last=error;}
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${label}${last instanceof Error?`: ${last.message}`:''}`);
}

function readBuildManifest(){
  return JSON.parse(fs.readFileSync(path.join(root,'dist','build-manifest.json'),'utf8'));
}

function contentType(name){
  if(name.endsWith('.html'))return 'text/html; charset=utf-8';
  if(name.endsWith('.js'))return 'application/javascript; charset=utf-8';
  if(name.endsWith('.css'))return 'text/css; charset=utf-8';
  if(name.endsWith('.webmanifest'))return 'application/manifest+json; charset=utf-8';
  if(name.endsWith('.woff2'))return 'font/woff2';
  if(name.endsWith('.png'))return 'image/png';
  if(name.endsWith('.json'))return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

export function instrumentedHtml(kind='deployment',options={}){
  const manifest=readBuildManifest();
  let html=fs.readFileSync(path.join(root,'dist',kind,manifest.main),'utf8');
  const marker='/* PUBLIC PLUGIN API */';
  if(!html.includes(marker))throw new Error(`PWA6 instrumentation marker missing from ${kind}.`);
  const exposure=`window.__PWA6=Object.freeze({StartupLifecycle,SessionLifecycle,AppOwnership,TimerState,TimerEngine,PracticePacer,Interactions,SystemNotifications,Pomodoro,NoticeCoordinator,AppData,IndexedDb,BackupController,BackupProviderRuntime,DeviceBackup,NativeCapabilities,PwaLifecycle,SessionEvidenceGateway,ReviewModel,ReviewView,ReviewEditor,LibraryView,PlanDraftEditor,applySchedule,goTab,commitTaskNoteEditor,setStudyQuality,saveDayRecord,flushLiveDraft,todayISO,readStorageHealth,loadScheduleIntoDraft,resetTodaySession,markDone,togglePause,setCurrentTask,refreshPnote,RichTextRuntime,RichTextAssets,renderRichTextContent});\n`;
  html=html.replace(marker,exposure+marker);
  if(options.disablePwa!==false)html=html.replace(/void PwaLifecycle\.install\(\)(?:\.then\(\(\)=>schedulePwaUpdateCheck\(750\)\))?;/,'/* PWA6 instrumented runtime: sealed PWA lifecycle tested separately. */');
  return html;
}

export async function startReleaseServer(){
  const manifest=readBuildManifest();
  const overrides=new Map(),failures=new Map(),requests=[];let offline=false;
  const server=http.createServer((request,response)=>{
    const url=new URL(request.url||'/','http://127.0.0.1');
    requests.push({method:request.method||'GET',path:url.pathname,at:Date.now()});
    if(offline){request.socket.destroy();return;}
    const match=url.pathname.match(/^\/(development|deployment)\/(.*)$/);
    if(!match){response.writeHead(404);response.end('not found');return;}
    const kind=match[1],relative=decodeURIComponent(match[2]||'index.html');
    if(relative.includes('..')){response.writeHead(400);response.end('bad path');return;}
    const pathname=`/${kind}/${relative}`;
    const failure=failures.get(pathname);
    if(failure&&failure.remaining>0){
      failure.remaining-=1;
      response.writeHead(failure.status||503,{'content-type':'text/plain','cache-control':'no-store'});
      response.end(failure.body||'injected network failure');return;
    }
    if(relative==='instrumented.html'){
      response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
      response.end(instrumentedHtml(kind));return;
    }
    const override=overrides.get(pathname);
    if(override!==undefined){
      response.writeHead(200,{'content-type':contentType(relative),'cache-control':'no-store','service-worker-allowed':`/${kind}/`});
      response.end(override);return;
    }
    const base=path.resolve(root,'dist',kind),file=path.resolve(base,relative||manifest.main);
    if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
      response.writeHead(404);response.end('not found');return;
    }
    const headers={'content-type':contentType(relative),'cache-control':relative==='sw.js'?'no-cache, no-store, must-revalidate':relative==='index.html'||relative==='manifest.webmanifest'?'no-cache, must-revalidate':'public, max-age=31536000, immutable'};
    if(relative==='sw.js')headers['service-worker-allowed']=`/${kind}/`;
    response.writeHead(200,headers);response.end(fs.readFileSync(file));
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const origin=`http://127.0.0.1:${server.address().port}`;
  return Object.freeze({
    origin,manifest,requests,
    url:(kind='deployment',name='index.html')=>`${origin}/${kind}/${name}`,
    setOverride:(kind,name,body)=>overrides.set(`/${kind}/${name}`,body),
    clearOverride:(kind,name)=>overrides.delete(`/${kind}/${name}`),
    failNext:(kind,name,count=1,status=503,body='injected network failure')=>failures.set(`/${kind}/${name}`,{remaining:count,status,body}),
    setOffline:value=>{offline=value===true;},
    close:()=>new Promise(resolve=>{
      server.close(()=>resolve());
      if(typeof server.closeAllConnections==='function')server.closeAllConnections();
      setTimeout(resolve,1000);
    })
  });
}

export class CdpPage{
  constructor(socket,targetId){
    this.socket=socket;this.targetId=targetId;this.nextId=0;this.pending=new Map();this.events=[];this.coverageStarted=false;this.closed=false;
    socket.onmessage=event=>{
      const message=JSON.parse(event.data);
      if(message.id){
        const pending=this.pending.get(message.id);if(!pending)return;
        this.pending.delete(message.id);
        message.error?pending.reject(new Error(JSON.stringify(message.error))):pending.resolve(message.result);return;
      }
      if(message.method==='Runtime.exceptionThrown')this.events.push({kind:'exception',text:message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text||'Runtime exception'});
      if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')this.events.push({kind:'console-error',text:message.params.args.map(arg=>arg.value??arg.description??'').join(' ')});
      if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')this.events.push({kind:'log-error',text:message.params.entry.text});
    };
  }
  static async connect(url,targetId){
    const socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
    return new CdpPage(socket,targetId);
  }
  send(method,params={}){
    return new Promise((resolve,reject)=>{const id=++this.nextId;this.pending.set(id,{resolve,reject});this.socket.send(JSON.stringify({id,method,params}));});
  }
  async startCoverage(){
    if(!process.env.SD_BROWSER_COVERAGE_DIR||this.coverageStarted)return;
    await this.send('Profiler.enable');await this.send('Debugger.enable');
    await this.send('Profiler.startPreciseCoverage',{callCount:true,detailed:true});this.coverageStarted=true;
  }
  async collectCoverage(){
    if(!this.coverageStarted||this.closed)return null;
    const taken=await this.send('Profiler.takePreciseCoverage'),scripts=[];
    for(const item of taken.result||[]){
      if(!/^https?:\/\/127\.0\.0\.1(?::\d+)?\//u.test(item.url||''))continue;
      let source='';try{source=(await this.send('Debugger.getScriptSource',{scriptId:item.scriptId})).scriptSource||'';}catch{}
      if(source)scripts.push({...item,source});
    }
    await this.send('Profiler.stopPreciseCoverage').catch(()=>{});this.coverageStarted=false;
    if(!scripts.length)return null;
    const directory=path.resolve(process.env.SD_BROWSER_COVERAGE_DIR);fs.mkdirSync(directory,{recursive:true});
    const file=path.join(directory,`browser-coverage-${process.pid}-${this.targetId||'page'}-${Date.now()}.json`);
    fs.writeFileSync(file,JSON.stringify({scripts},null,2));return file;
  }
  async evaluate(expression,{awaitPromise=true,returnByValue=true,userGesture=true}={}){
    const result=await this.send('Runtime.evaluate',{expression,awaitPromise,returnByValue,userGesture});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Evaluation failed');
    return returnByValue?result.result.value:result.result;
  }
  async assertHealthyNavigation(expectedUrl=''){
    const state=await this.evaluate(`({href:location.href,title:document.title})`);
    if(String(state?.href||'').startsWith('chrome-error://')){
      throw new Error(`Chromium could not load local Study Director test origin${expectedUrl?`: ${expectedUrl}`:''}`);
    }
    return state;
  }
  async navigate(url){
    const result=await this.send('Page.navigate',{url});
    if(result?.errorText)throw new Error(`Chromium navigation failed for ${url}: ${result.errorText}`);
    await waitFor(()=>this.evaluate(`document.readyState==='complete'`),{label:`navigation ${url}`});
    await this.assertHealthyNavigation(url);
  }
  async reload(){await this.send('Page.reload',{ignoreCache:false});await waitFor(()=>this.evaluate(`document.readyState==='complete'`),{label:'reload'});await this.assertHealthyNavigation('reload');}
  async settle(frames=2){
    const count=Math.max(1,Math.min(8,Number(frames)||2));
    await this.evaluate(`new Promise(resolve=>{let remaining=${count};const step=()=>{remaining-=1;if(remaining<=0)resolve(true);else requestAnimationFrame(step)};requestAnimationFrame(step)})`);
  }
  async setViewport({width,height,mobile=false,scale=1}){
    await this.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:scale,mobile});
    await this.send('Emulation.setTouchEmulationEnabled',mobile?{enabled:true,maxTouchPoints:5}:{enabled:false});
  }
  async elementPoint(selector){
    const point=await this.evaluate(`(async()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw new Error('Missing input target: '+${JSON.stringify(selector)});element.scrollIntoView({block:'nearest',inline:'nearest'});const animations=[];for(let node=element;node;node=node.parentElement)animations.push(...node.getAnimations().filter(animation=>animation.playState==='running'&&animation.effect.getComputedTiming().iterations!==Infinity));await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));const rect=element.getBoundingClientRect(),style=getComputedStyle(element);if(rect.width<=0||rect.height<=0||style.display==='none'||style.visibility==='hidden')throw new Error('Hidden input target: '+${JSON.stringify(selector)});return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
    return point;
  }
  async click(selector){
    const point=await this.elementPoint(selector);
    await this.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
    await this.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});
    await this.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});
  }
  async tap(selector){
    const point=await this.elementPoint(selector),touch={x:point.x,y:point.y,id:1,radiusX:2,radiusY:2,force:1};
    await this.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});
    await this.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  async setOffline(value){
    await this.send('Network.emulateNetworkConditions',{offline:value===true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  }
  async screenshot(file,clip=null){
    const params={format:'png',captureBeyondViewport:false,fromSurface:true};
    if(clip)params.clip={x:clip.x,y:clip.y,width:clip.width,height:clip.height,scale:clip.scale||1};
    const result=await this.send('Page.captureScreenshot',params);
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(result.data,'base64'));return file;
  }
  close(){this.closed=true;this.socket.close();}
}

export function resolveChromiumExecutable(preferred=''){
  const candidates=[
    preferred,
    process.env.CHROMIUM_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/tmp/chromium'
  ].filter(Boolean);
  const match=candidates.find(candidate=>{try{return fs.existsSync(candidate)&&fs.statSync(candidate).isFile();}catch{return false;}});
  if(!match)throw new Error(`Chromium is unavailable. Checked: ${candidates.join(', ')}`);
  return match;
}

export async function launchChromium(options={}){
  const chromium=resolveChromiumExecutable(options.executable||'');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),options.profilePrefix||'study-director-pwa6-'));
  const args=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank',...(options.args||[])];
  const processHandle=spawn(chromium,args,{stdio:['ignore','ignore','pipe'],env:{...process.env,TERM:process.env.TERM||'xterm'}});
  let stderr='';processHandle.stderr.on('data',chunk=>{stderr+=chunk;});
  const activePath=path.join(profile,'DevToolsActivePort');
  await waitFor(()=>fs.existsSync(activePath),{timeout:20000,label:'Chromium DevTools port'});
  const [port]=fs.readFileSync(activePath,'utf8').trim().split(/\r?\n/);
  await waitFor(async()=>{try{return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;}catch{return false;}},{label:'Chromium CDP endpoint'});
  const pages=new Set();
  async function createPage(url,settings={}){
    const target=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
    const page=await CdpPage.connect(target.webSocketDebuggerUrl,target.id);
    pages.add(page);await page.send('Runtime.enable');await page.send('Page.enable');await page.send('Log.enable');await page.send('Network.enable');await page.send('Accessibility.enable');await page.startCoverage();
    await page.send('Emulation.setTimezoneOverride',{timezoneId:'Asia/Kolkata'});
    if(settings.userAgent)await page.send('Network.setUserAgentOverride',{userAgent:settings.userAgent,platform:settings.platform||''});
    await page.setViewport(settings.viewport||{width:1365,height:900,mobile:false,scale:1});
    if(settings.preload)await page.send('Page.addScriptToEvaluateOnNewDocument',{source:String(settings.preload)});
    await page.navigate(url);
    return page;
  }
  async function closePage(page){
    try{await page.collectCoverage();}catch(error){if(process.env.SD_BROWSER_COVERAGE_DIR)console.warn(`[coverage] ${error.message}`);}
    try{await Promise.race([page.send('Page.close'),sleep(2000)]);}catch{}
    pages.delete(page);page.close();
  }
  async function close(){
    for(const page of [...pages]){try{await page.collectCoverage();}catch(error){if(process.env.SD_BROWSER_COVERAGE_DIR)console.warn(`[coverage] ${error.message}`);}}
    processHandle.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>processHandle.once('exit',resolve)),sleep(3000)]);
    if(processHandle.exitCode===null){processHandle.kill('SIGKILL');await Promise.race([new Promise(resolve=>processHandle.once('exit',resolve)),sleep(1000)]);}
    for(let attempt=0;attempt<10;attempt++){
      try{fs.rmSync(profile,{recursive:true,force:true});break;}catch(error){
        if(error?.code!=='ENOTEMPTY'||attempt===9)throw error;
        await sleep(150);
      }
    }
  }
  return Object.freeze({port,profile,process:processHandle,stderr:()=>stderr,createPage,closePage,close});
}

export async function waitForStudyDirector(page,{instrumented=false,timeout=45000}={}){
  const expression=instrumented
    ? `!!(window.StudyDirector&&window.__PWA6&&__PWA6.StartupLifecycle.status().fullyInitialized)`
    : `!!(window.StudyDirector&&document.documentElement.dataset.studyDirectorReady==='true')`;
  return waitFor(()=>page.evaluate(expression),{timeout,label:'Study Director startup'});
}
