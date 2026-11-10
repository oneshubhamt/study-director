import {readHostHtml} from '../../../build/host-source.mjs';
import {createNotifications} from '../../helpers/notifications.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=readHostHtml();
const start=source.indexOf('function openPdfWorkspace('),end=source.indexOf('const {SystemNotifications}=',start);
const adapter=source.split('\n').find(line=>line.trim().startsWith('openPdf:')).trim().slice('openPdf:'.length,-1);
const {coordinator}=createNotifications();
let options,mode='open',releases=0,revokes=0;
const sandbox={NoticeCoordinator:coordinator,Blob,URL:{createObjectURL:()=> 'blob:pdf-test',revokeObjectURL:()=>revokes++},document:{createElement:()=>({append(){}})},prefersNativePdfNavigation:()=>false,WorkspaceOverlay:{open:value=>{options=value;if(mode==='throw')throw Error('overlay failed');return mode==='busy'?null:{};}},Interactions:{notify:coordinator.notify},reopenPdfWorkspace:()=>{}};
vm.createContext(sandbox);vm.runInContext(source.slice(start,end)+`\nglobalThis.openPdf=${adapter};`,sandbox);
const file=new Blob(['pdf'],{type:'application/pdf'}),row={id:'att-pdf',type:'application/pdf',name:'Test PDF'};
assert.equal(sandbox.openPdf(row,file,null,()=>releases++),true);assert.equal(releases,0,'reader remains retained while viewer is open');options.onAfterClose();options.onAfterClose();assert.equal(releases,1,'host adapter forwards release and close is idempotent');assert.equal(revokes,1);
mode='busy';assert.equal(sandbox.openPdf(row,file,null,()=>releases++),false);assert.equal(releases,2);
mode='throw';assert.throws(()=>sandbox.openPdf(row,file,null,()=>releases++),/overlay failed/);assert.equal(releases,3);assert.equal(revokes,3);


mode='open';assert.equal(sandbox.openPdf(row,file,null,()=>releases++),true);assert.equal(coordinator.readEvent('attachments','pdf-overlay-busy'),null,'successful reopen clears the earlier persistent warning');options.onAfterClose();mode='busy';sandbox.openPdf(row,file,null,()=>releases++);assert.equal(coordinator.readEvent('attachments','pdf-overlay-busy').lifecycle,'failed','a recurring open failure is visible again');coordinator.clear();

const pdfStart=source.indexOf('const PDF_DOWNLOAD_HANDOFF_MS=');
assert.ok(pdfStart>=0,'the PDF lifetime helper must be present in production');
const pdfRuntime=source.slice(pdfStart,end);
function lifetimeHarness(){
  const timeouts=new Map(),intervals=new Map(),pageHandlers=new Map(),elements=[],windows=[];
  let now=0,timerId=0,overlay=null,openMode='blocked',readerReleases=0,revoked=0,createdUrls=0;
  const setTimeout=(callback,delay)=>{const id=++timerId;timeouts.set(id,{callback,due:now+delay});return id;};
  const clearTimeout=id=>timeouts.delete(id);
  const setInterval=(callback,delay)=>{const id=++timerId;intervals.set(id,{callback,delay});return id;};
  const clearInterval=id=>intervals.delete(id);
  const window={
    matchMedia:()=>({matches:true}),
    addEventListener:(type,callback)=>{if(!pageHandlers.has(type))pageHandlers.set(type,new Set());pageHandlers.get(type).add(callback);},
    removeEventListener:(type,callback)=>pageHandlers.get(type)?.delete(callback),
    open:()=>{
      if(['blocked','overlay-busy','overlay-throws'].includes(openMode))return null;
      const next={closed:false,opener:{},url:null,
        location:{replace(url){next.url=url;if(openMode==='replace-fails')throw new Error('viewer unavailable');}},
        close(){next.closed=true;}
      };
      windows.push(next);return next;
    }
  };
  const document={createElement:tag=>{
    const listeners=new Map(),element={tag,children:[],append(...nodes){this.children.push(...nodes);},
      addEventListener:(type,fn)=>listeners.set(type,fn),
      click(){const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};listeners.get('click')?.(event);return event;}};
    elements.push(element);return element;
  }};
  const context=vm.createContext({
    window,document,Blob,prefersNativePdfNavigation:()=>true,
    URL:{createObjectURL:()=> 'blob:handoff-'+(++createdUrls),revokeObjectURL:()=>{revoked++;}},
    WorkspaceOverlay:{open:value=>{
      overlay=value;
      if(openMode==='overlay-throws')throw new Error('overlay unavailable');
      if(openMode==='overlay-busy')return null;
      return {close(){value.onBeforeClose?.();value.onAfterClose?.();}};
    }},
    Interactions:{notify:()=>{}},
    NoticeCoordinator:{resolveEvent:()=>{}},
    setTimeout,clearTimeout,setInterval,clearInterval
  });
  vm.runInContext(pdfRuntime,context,{filename:'source/app.html'});
  const triggerTimeouts=()=>{
    let worked=true;
    while(worked){
      worked=false;
      for(const [id,item] of [...timeouts])if(item.due<=now){timeouts.delete(id);item.callback();worked=true;}
    }
  };
  const advance=ms=>{now+=ms;triggerTimeouts();};
  const poll=()=>{for(const {callback} of [...intervals.values()])callback();};
  const pagehide=()=>{for(const cb of [...pageHandlers.get('pagehide')||[]])cb({persisted:true});};
  const stats=()=>({revoked,readerReleases,intervals:intervals.size,timeouts:timeouts.size,pageHandlers:pageHandlers.get('pagehide')?.size||0});
  const row={id:'att-pdf',type:'application/pdf',name:'Study.pdf'};
  return {open:()=>context.openPdfWorkspace(row,new Blob(['test'],{type:'application/pdf'}),null,()=>readerReleases++),
    setMode:value=>{openMode=value;},overlay:()=>overlay,windows,stats,advance,poll,pagehide,
    nodes:tag=>elements.filter(node=>node.tag===tag)};
}

// Native viewer is long-lived by design: the lease follows actual window
// closure, and pagehide tears down polling and readers even in BFCache.
{
  const h=lifetimeHarness();h.setMode('popup');
  assert.equal(h.open(),true);
  assert.equal(h.stats().readerReleases,0);
  assert.equal(h.stats().intervals,1);
  h.poll();assert.equal(h.stats().revoked,0,'an open viewer retains its Blob URL');
  h.windows[0].closed=true;h.poll();h.pagehide();
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}
{
  const h=lifetimeHarness();h.setMode('popup');h.open();h.pagehide();
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}

// A blocked native popup shows options, and cancelling them releases the lease.
{
  const h=lifetimeHarness();h.setMode('blocked');assert.equal(h.open(),true);
  assert.match(h.overlay().className,/fallback/u);
  assert.equal(h.stats().readerReleases,0);
  h.overlay().onBeforeClose();h.overlay().onBeforeClose();
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}

// BFCache must not restore stale fallback actions after their URL is revoked.
{
  const h=lifetimeHarness();h.open();
  const options=h.overlay(),previous=options.onBeforeClose;let closed=0;
  options.onBeforeClose=()=>{closed++;previous();};
  h.pagehide();
  assert.equal(closed,1,'pagehide closes options that would contain dead Blob links');
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}

// A reserved popup may fail navigation without leaking the URL before showing
// the fallback; closing those options still releases exactly once.
{
  const h=lifetimeHarness();h.setMode('replace-fails');
  assert.equal(h.open(),true);
  assert.equal(h.windows.length,1);
  assert.equal(h.windows[0].closed,true);
  h.overlay().onBeforeClose();
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}

// An explicit second user gesture can open a tracked viewer even if the
// initial non-gesture popup was blocked.
{
  const h=lifetimeHarness();h.open();h.setMode('popup');
  const link=h.nodes('a')[0],clicked=link.click();
  assert.equal(clicked.defaultPrevented,true,'tracked popup replaces anchor default');
  h.advance(0);
  assert.equal(h.stats().readerReleases,0,'overlay closure must not revoke live popup');
  h.windows[0].closed=true;h.poll();
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}

// No popup handle: retain a conservative, finite lifetime for the noopener
// link, then release exactly once even if pagehide follows.
{
  const h=lifetimeHarness(),tenMinutes=10*60*1000;h.open();
  const event=h.nodes('a')[0].click();
  assert.equal(event.defaultPrevented,false,'untracked link uses native noopener navigation');
  h.advance(0);
  assert.equal(h.stats().readerReleases,0,'no immediate revocation after navigation');
  h.advance(tenMinutes-1);assert.equal(h.stats().readerReleases,0);
  h.advance(1);h.pagehide();
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}

// Download follows the native anchor action, with bounded lease lifetime.
{
  const h=lifetimeHarness();h.open();
  const download=h.nodes('a')[1],event=download.click();
  assert.equal(event.defaultPrevented,false);
  assert.equal(download.download,'Study.pdf');
  h.advance(0);assert.equal(h.stats().readerReleases,0);
  h.advance(2*60*1000);assert.equal(h.stats().readerReleases,1);
  h.pagehide();assert.equal(h.stats().revoked,1);
}

// Busy and thrown fallback overlay must not strand an OPFS lease.
for(const mode of ['overlay-busy','overlay-throws']){
  const h=lifetimeHarness();h.setMode(mode);
  if(mode==='overlay-throws')assert.throws(()=>h.open(),/overlay unavailable/u);
  else assert.equal(h.open(),false);
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}
console.log(JSON.stringify({status:'PASS',suite:'pdf-reader-lifetime',openRetains:true,closeReleases:true,busyAndFailureRelease:true,handOffAndPagehide:true}));
