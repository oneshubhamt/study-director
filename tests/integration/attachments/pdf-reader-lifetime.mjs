import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const context={console,Blob,Map,Set,Object,Promise,Number,String,Math,URL};
context.globalThis=context;
vm.createContext(context);
for(const file of ['source/core/internal.ts','source/core/document-host.ts'])vm.runInContext(readScript(file),context,{filename:file});
const documentHost=context[Symbol.for('studyDirector.internalModules.v1')].require('document-host',1);
assert.equal(documentHost.format,'study-director.document-host-module');

function element(tag='div'){
  const listeners=new Map();
  return {
    tag,children:[],dataset:{},className:'',textContent:'',href:'',target:'',rel:'',download:'',title:'',src:'',
    append(...nodes){this.children.push(...nodes);},
    addEventListener(type,fn){listeners.set(type,fn);},
    click(){const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};listeners.get('click')?.(event);return event;},
    querySelectorAll(){return []}
  };
}
function lifetimeHarness({coarse=true}={}){
  const timeouts=new Map(),intervals=new Map(),pageHandlers=new Map(),elements=[],windows=[];
  let now=0,timerId=0,overlayOptions=null,overlayHandle=null,openMode='blocked',readerReleases=0,revoked=0,createdUrls=0;
  const setTimeout=(callback,delay=0)=>{const id=++timerId;timeouts.set(id,{callback,due:now+delay});return id;};
  const clearTimeout=id=>timeouts.delete(id);
  const setInterval=(callback,delay=0)=>{const id=++timerId;intervals.set(id,{callback,delay});return id;};
  const clearInterval=id=>intervals.delete(id);
  const window={
    matchMedia:()=>({matches:coarse}),
    addEventListener(type,callback){if(!pageHandlers.has(type))pageHandlers.set(type,new Set());pageHandlers.get(type).add(callback);},
    removeEventListener(type,callback){pageHandlers.get(type)?.delete(callback);},
    setTimeout,clearTimeout,setInterval,clearInterval,
    open(){
      if(['blocked','overlay-busy','overlay-throws'].includes(openMode))return null;
      const next={closed:false,opener:{},url:null,
        location:{replace(url){next.url=url;if(openMode==='replace-fails')throw new Error('viewer unavailable');}},
        close(){next.closed=true;}
      };
      windows.push(next);return next;
    }
  };
  const document={createElement(tag){const node=element(tag);elements.push(node);return node;}};
  const overlay={open(value){
    overlayOptions=value;
    if(openMode==='overlay-throws')throw new Error('overlay unavailable');
    if(openMode==='overlay-busy')return null;
    let closed=false;
    overlayHandle={close(){if(closed)return false;closed=true;value.onBeforeClose?.();value.onAfterClose?.();return true;}};
    return overlayHandle;
  }};
  const notifications={notify(){},resolve(){}};
  const controller=documentHost.createPdfController(Object.freeze({
    document,window,
    urls:Object.freeze({createObjectURL:()=> 'blob:handoff-'+(++createdUrls),revokeObjectURL:()=>{revoked++;}}),
    store:Object.freeze({retain:async()=>()=>{},list:async()=>[],get:async()=>null}),
    overlay:Object.freeze(overlay),notifications:Object.freeze(notifications),
    diagnostics:Object.freeze({capture(){}})
  }));
  const triggerTimeouts=()=>{let worked=true;while(worked){worked=false;for(const [id,item] of [...timeouts])if(item.due<=now){timeouts.delete(id);item.callback();worked=true;}}};
  const advance=ms=>{now+=ms;triggerTimeouts();};
  const poll=()=>{for(const {callback} of [...intervals.values()])callback();};
  const pagehide=()=>{for(const callback of [...pageHandlers.get('pagehide')||[]])callback({persisted:true});};
  const row={id:'att-pdf',type:'application/pdf',name:'Study.pdf',size:4,hash:'f'.repeat(64),library:false,version:2,storage:'opfs',file:'attblob-test'};
  const file=new Blob(['test'],{type:'application/pdf'});
  const open=(reserved=null)=>controller.open(row,file,reserved,()=>readerReleases++);
  const stats=()=>({revoked,readerReleases,intervals:intervals.size,timeouts:timeouts.size,pageHandlers:pageHandlers.get('pagehide')?.size||0});
  return {
    controller,open,setMode:value=>{openMode=value;},overlay:()=>overlayOptions,handle:()=>overlayHandle,windows,stats,advance,poll,pagehide,
    nodes:tag=>elements.filter(node=>node.tag===tag)
  };
}

// Embedded workspace keeps the OPFS reader until the overlay is actually closed.
{
  const h=lifetimeHarness({coarse:false});h.setMode('open');
  assert.equal(h.open(),true);assert.equal(h.stats().readerReleases,0);
  h.overlay().onAfterClose();h.overlay().onAfterClose();
  assert.equal(h.stats().readerReleases,1);assert.equal(h.stats().revoked,1,'embedded close is idempotent');
}
for(const mode of ['overlay-busy','overlay-throws']){
  const h=lifetimeHarness({coarse:false});h.setMode(mode);
  if(mode==='overlay-throws')assert.throws(()=>h.open(),/overlay unavailable/u);
  else assert.equal(h.open(),false);
  assert.equal(h.stats().readerReleases,1,`${mode}: reader lease must release`);
  assert.equal(h.stats().revoked,1,`${mode}: Blob URL must revoke`);
}

// Native viewer lease follows the actual child window and page lifecycle.
{
  const h=lifetimeHarness();h.setMode('popup');assert.equal(h.open(),true);
  assert.equal(h.stats().readerReleases,0);assert.equal(h.stats().intervals,1);
  h.poll();assert.equal(h.stats().revoked,0,'open viewer retains Blob URL');
  h.windows[0].closed=true;h.poll();h.pagehide();
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}
{
  const h=lifetimeHarness();h.setMode('popup');h.open();h.pagehide();
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}

// Blocked native popup falls back to explicit actions and cancel releases once.
{
  const h=lifetimeHarness();h.setMode('blocked');assert.equal(h.open(),true);
  assert.match(h.overlay().className,/fallback/u);assert.equal(h.stats().readerReleases,0);
  h.handle().close();h.handle().close();
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}

// BFCache/pagehide closes fallback actions before their URL can become stale.
{
  const h=lifetimeHarness();h.open();h.pagehide();
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}

// Reserved popup navigation failure closes it and hands the same retained reader to fallback.
{
  const h=lifetimeHarness();h.setMode('replace-fails');assert.equal(h.open(),true);
  assert.equal(h.windows.length,1);assert.equal(h.windows[0].closed,true);
  h.handle().close();
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}

// Explicit second gesture can create a tracked viewer after initial popup blocking.
{
  const h=lifetimeHarness();h.open();h.setMode('popup');
  const clicked=h.nodes('a')[0].click();assert.equal(clicked.defaultPrevented,true);
  h.advance(0);assert.equal(h.stats().readerReleases,0,'fallback close must not revoke tracked popup');
  h.windows[0].closed=true;h.poll();
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}

// Native noopener handoff without a Window handle has a conservative finite lease.
{
  const h=lifetimeHarness(),tenMinutes=10*60*1000;h.open();
  const event=h.nodes('a')[0].click();assert.equal(event.defaultPrevented,false);
  h.advance(0);h.advance(tenMinutes-1);assert.equal(h.stats().readerReleases,0);
  h.advance(1);h.pagehide();
  assert.deepEqual(h.stats(),{revoked:1,readerReleases:1,intervals:0,timeouts:0,pageHandlers:0});
}

// Download handoff retains only for the bounded two-minute transfer interval.
{
  const h=lifetimeHarness();h.open();
  const download=h.nodes('a')[1],event=download.click();assert.equal(event.defaultPrevented,false);assert.equal(download.download,'Study.pdf');
  h.advance(0);assert.equal(h.stats().readerReleases,0);h.advance(2*60*1000);assert.equal(h.stats().readerReleases,1);h.pagehide();assert.equal(h.stats().revoked,1);
}

console.log(JSON.stringify({status:'PASS',suite:'pdf-reader-lifetime',owner:'document-host.ts',embedded:true,native:true,fallback:true,boundedHandoffs:true}));
