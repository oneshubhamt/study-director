import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const internal=fs.readFileSync('source/core/internal.js','utf8');
const navigationSource=fs.readFileSync('source/core/navigation.js','utf8');

function deferred(){
  let resolve;
  const promise=new Promise(res=>{resolve=res;});
  return {promise,resolve};
}
function createWindow(url='https://study-director.web.app/',{native=false}={}){
  let current=new URL(url);
  const listeners=new Map();
  const entries=[{url:current.href,state:{seed:true}}];
  let index=0;
  const addEventListener=(type,handler)=>{
    const bucket=listeners.get(type)||[];bucket.push(handler);listeners.set(type,bucket);
  };
  const dispatch=(type,event={})=>(listeners.get(type)||[]).map(handler=>handler(event));
  const location={
    get href(){return current.href;},set href(value){current=new URL(value,current.href);},
    get origin(){return current.origin;},get pathname(){return current.pathname;},get hash(){return current.hash;}
  };
  const win={location,addEventListener,_dispatch:dispatch,_listeners:listeners,_lastTraversal:Promise.resolve()};
  const navigationListeners=[];
  if(native){
    win.navigation={
      addEventListener(type,handler){if(type==='navigate')navigationListeners.push(handler);},
      _listeners:navigationListeners,
      _dispatch(event){for(const handler of navigationListeners)handler(event);}
    };
  }
  function dispatchTraversal(){
    const entry=entries[index];
    if(native){
      let intercepted=null;
      const event={
        navigationType:'traverse',canIntercept:true,
        destination:{url:entry.url,getState:()=>entry.state},
        intercept(options){intercepted=options;}
      };
      win.navigation._dispatch(event);
      win._lastTraversal=intercepted?Promise.resolve().then(()=>intercepted.handler()):Promise.resolve();
      return win._lastTraversal;
    }
    const results=dispatch('popstate',{state:entry.state});
    win._lastTraversal=Promise.all(results.map(value=>Promise.resolve(value)));
    return win._lastTraversal;
  }
  const history={
    get state(){return entries[index].state;},
    get length(){return entries.length;},
    pushState(state,_title,value){current=new URL(value,current.href);entries.splice(index+1);entries.push({url:current.href,state});index=entries.length-1;},
    replaceState(state,_title,value){current=new URL(value,current.href);entries[index]={url:current.href,state};},
    go(delta){
      const next=index+Number(delta||0);
      if(!Number.isInteger(next)||next<0||next>=entries.length||next===index)return false;
      index=next;current=new URL(entries[index].url,current.href);dispatchTraversal();return true;
    },
    back(){return this.go(-1);},forward(){return this.go(1);},
    _entries:entries,
    _index:()=>index,
    _set(value,state={}){current=new URL(value,current.href);entries[index]={url:current.href,state};}
  };
  win.history=history;
  win._traverse=async delta=>{history.go(delta);await win._lastTraversal;await Promise.resolve();await win._lastTraversal;};
  return win;
}
function loadModule(){
  const context=vm.createContext({console,URL,Symbol,Object,Set,Map,Promise,TypeError,Error,globalThis:null});
  context.globalThis=context;
  vm.runInContext(internal,context,{filename:'internal.js'});
  vm.runInContext(navigationSource,context,{filename:'navigation.js'});
  return context[Symbol.for('studyDirector.internalModules.v1')].require('navigation',1);
}
function harness(options={}){
  const module=loadModule();
  const win=createWindow(options.url,options);
  let active=options.active||'plan',workspace=options.workspace||null;
  const commits=[];const prepares=[];const presentations=[];const ready=[];const reports=[];const workspaceReconciles=[];
  let prepareImpl=options.prepare||(()=>true);
  const presentImpl=options.present||((_context,update)=>update());
  const readyImpl=options.ready||(()=>true);
  const controller=module.createController(Object.freeze({
    window:win,
    host:Object.freeze({
      currentTab:()=>active,
      prepare:async context=>{prepares.push(context);return prepareImpl(context);},
      present:async (context,update)=>{presentations.push(context);return presentImpl(context,update);},
      commit:async context=>{commits.push(context);const ok=options.commit?await options.commit(context):true;if(ok!==false)active=context.to;return ok;},
      ready:async context=>{ready.push(context);return readyImpl(context);},
      report:(boundary,error)=>reports.push({boundary,error}),
      workspace:Object.freeze({
        current:()=>workspace,
        reconcile:async (desired,context)=>{
          workspaceReconciles.push({desired,context});
          workspace=options.reconcileWorkspace?await options.reconcileWorkspace(desired,context,workspace):desired;
          return workspace;
        }
      })
    })
  }));
  return {module,win,controller,commits,prepares,presentations,ready,reports,workspaceReconciles,get active(){return active;},set active(value){active=value;},get workspace(){return workspace;},set workspace(value){workspace=value;},setPrepare(value){prepareImpl=value;}};
}
function routeState(win){return win.history.state?.studyDirectorRoute||null;}

{
  const h=harness();
  assert.equal(h.controller.install(),'history');
  await h.controller.hydrate({source:'startup',explicitOnly:true});
  assert.deepEqual({...routeState(h.win)},{version:1,tab:'plan',position:0});
  const result=await h.controller.request('execute',{source:'test'});
  assert.equal(result.ok,true);assert.equal(result.tab,'execute');assert.equal(result.changed,true);
  assert.equal(h.active,'execute');assert.equal(new URL(h.win.location.href).searchParams.get('tab'),'execute');
  assert.equal(h.win.history._entries.length,2);assert.equal(h.win.history.state.seed,undefined);
  assert.deepEqual({...routeState(h.win)},{version:1,tab:'execute',position:1});
  const same=await h.controller.request('execute',{source:'same'});
  assert.equal(same.reason,'same-tab');assert.equal(h.win.history._entries.length,2);assert.equal(h.commits.length,1);
}

{
  const h=harness();
  h.controller.install();
  await h.controller.hydrate({source:'startup',explicitOnly:true});
  const result=await h.controller.request('not-a-tab',{source:'invalid-programmatic'});
  assert.equal(result.ok,false);assert.equal(result.reason,'invalid-destination');assert.equal(result.tab,'plan');
  assert.equal(h.win.history._entries.length,1);assert.equal(h.commits.length,0);
}

{
  const h=harness({active:'review',url:'https://study-director.web.app/?tab=review',prepare:()=>false});
  h.controller.install();
  await h.controller.hydrate({source:'direct',explicitOnly:true});
  const before=h.win.location.href;
  const result=await h.controller.request('library',{source:'blocked'});
  assert.equal(result.ok,false);assert.equal(result.reason,'departure-blocked');
  assert.equal(h.active,'review');assert.equal(h.win.location.href,before);assert.equal(h.commits.length,0);
}

{
  const gate=deferred();
  const h=harness({prepare:context=>context.to==='library'?gate.promise:true});
  h.controller.install();
  await h.controller.hydrate({source:'startup',explicitOnly:true});
  const first=h.controller.request('library',{source:'first'});
  await Promise.resolve();
  const second=await h.controller.request('execute',{source:'second'});
  assert.equal(second.ok,true);assert.equal(h.active,'execute');
  gate.resolve(true);
  const stale=await first;
  assert.equal(stale.ok,false);assert.equal(stale.reason,'superseded');assert.equal(h.active,'execute');
  assert.deepEqual(h.commits.map(row=>row.to),['execute']);
  assert.equal(h.controller.status().lastResult.generation,second.generation);
}

{
  const gate=deferred();
  const h=harness({present:(context,update)=>context.to==='library'?gate.promise.then(update):update()});
  h.controller.install();
  await h.controller.hydrate({source:'startup',explicitOnly:true});
  const first=h.controller.request('library',{source:'slow-presentation'});
  await Promise.resolve();
  const second=await h.controller.request('execute',{source:'newer-route'});
  assert.equal(second.ok,true);assert.equal(h.active,'execute');
  gate.resolve(true);
  const stale=await first;
  assert.equal(stale.ok,false);assert.equal(stale.reason,'superseded');assert.equal(h.active,'execute');
  assert.deepEqual(h.commits.map(row=>row.to),['execute']);
  assert.deepEqual(h.win.history._entries.map(row=>new URL(row.url).searchParams.get('tab')),['plan','execute']);
}

{
  const commitGate=deferred();
  let updateCalls=0;
  const h=harness({
    present:(_context,update)=>{updateCalls+=1;void update();throw new Error('presentation failed after update start');},
    commit:()=>commitGate.promise
  });
  h.controller.install();
  await h.controller.hydrate({source:'startup',explicitOnly:true});
  const request=h.controller.request('library',{source:'presentation-error'});
  await Promise.resolve();
  commitGate.resolve(true);
  const result=await request;
  assert.equal(result.ok,true);assert.equal(h.active,'library');assert.equal(updateCalls,1);
  assert.deepEqual(h.commits.map(row=>row.to),['library']);
  assert.equal(h.reports.filter(row=>row.boundary==='navigation.present').length,1);
}

{
  const h=harness({url:'https://study-director.web.app/?tab=bogus'});
  h.controller.install();
  const result=await h.controller.hydrate({source:'direct',explicitOnly:true});
  assert.equal(result.ok,true);assert.equal(result.tab,'plan');
  assert.equal(new URL(h.win.location.href).searchParams.get('tab'),'plan');
  assert.equal(h.win.history._entries.length,1);
  assert.deepEqual({...routeState(h.win)},{version:1,tab:'plan',position:0});
}

{
  const h=harness({active:'execute'});
  h.controller.install();
  const result=await h.controller.hydrate({source:'startup',explicitOnly:true});
  assert.equal(result.reason,'implicit-route');
  assert.equal(new URL(h.win.location.href).searchParams.get('tab'),'execute');
  assert.equal(h.win.history._entries.length,1);
  assert.deepEqual({...routeState(h.win)},{version:1,tab:'execute',position:0});
}

{
  const h=harness();
  h.controller.install();
  const recovered=await h.controller.request('review',{source:'startup-recovery',history:'none'});
  assert.equal(recovered.ok,true);assert.equal(h.active,'review');assert.equal(h.win.history.length,1);
  assert.equal(new URL(h.win.location.href).searchParams.has('tab'),false);
  const hydrated=await h.controller.hydrate({source:'startup',explicitOnly:true});
  assert.equal(hydrated.reason,'implicit-route');assert.equal(h.active,'review');assert.equal(h.win.history.length,1);
  assert.equal(new URL(h.win.location.href).searchParams.get('tab'),'review');
}

{
  const h=harness({url:'https://study-director.web.app/?tab=library'});
  h.controller.install();
  const recovered=await h.controller.request('review',{source:'startup-recovery',history:'none'});
  assert.equal(recovered.ok,true);assert.equal(h.active,'review');assert.equal(h.win.history.length,1);
  assert.equal(new URL(h.win.location.href).searchParams.get('tab'),'library');
  const hydrated=await h.controller.hydrate({source:'startup',explicitOnly:true});
  assert.equal(hydrated.ok,true);assert.equal(hydrated.tab,'library');assert.equal(h.active,'library');
  assert.equal(h.win.history.length,1);assert.equal(new URL(h.win.location.href).searchParams.get('tab'),'library');
}

for(const tab of ['plan','execute','review','library','insights','guide']){
  const h=harness({url:`https://study-director.web.app/?tab=${tab}`});
  h.controller.install();
  const result=await h.controller.hydrate({source:'direct',explicitOnly:true});
  assert.equal(result.ok,true);assert.equal(result.tab,tab);assert.equal(h.active,tab);
  assert.equal(h.win.history.length,1);assert.deepEqual({...routeState(h.win)},{version:1,tab,position:0});
}

for(const native of [false,true]){
  const h=harness({native});
  assert.equal(h.controller.install(),native?'navigation':'history');
  await h.controller.hydrate({source:'startup',explicitOnly:true});
  await h.controller.request('library',{source:'route-a'});
  await h.controller.request('execute',{source:'route-b'});
  assert.equal(h.win.history.length,3);
  await h.win._traverse(-1);
  assert.equal(h.active,'library');assert.equal(h.win.history._index(),1);assert.equal(h.controller.status().position,1);
  await h.win._traverse(1);
  assert.equal(h.active,'execute');assert.equal(h.win.history._index(),2);assert.equal(h.controller.status().position,2);
}

for(const native of [false,true]){
  let blockLibraryExit=false;
  const h=harness({native,prepare:context=>!(blockLibraryExit&&context.from==='library')});
  h.controller.install();
  await h.controller.hydrate({source:'startup',explicitOnly:true});
  await h.controller.request('library',{source:'route-a'});
  await h.controller.request('execute',{source:'route-b'});
  await h.win._traverse(-1);
  assert.equal(h.active,'library');assert.equal(h.win.history._index(),1);

  blockLibraryExit=true;
  const length=h.win.history.length;
  await h.win._traverse(1);
  await h.win._lastTraversal;
  assert.equal(h.active,'library');assert.equal(h.win.history._index(),1);assert.equal(h.win.history.length,length);
  assert.equal(new URL(h.win.location.href).searchParams.get('tab'),'library');

  blockLibraryExit=false;
  await h.win._traverse(1);
  assert.equal(h.active,'execute');assert.equal(h.win.history._index(),2);assert.equal(h.win.history.length,length);
}

for(const native of [false,true]){
  let blockLibraryExit=false;
  const h=harness({native,prepare:context=>!(blockLibraryExit&&context.from==='library')});
  h.controller.install();
  await h.controller.hydrate({source:'startup',explicitOnly:true});
  await h.controller.request('library',{source:'route-a'});
  blockLibraryExit=true;
  const length=h.win.history.length;
  await h.win._traverse(-1);
  await h.win._lastTraversal;
  assert.equal(h.active,'library');assert.equal(h.win.history._index(),1);assert.equal(h.win.history.length,length);
  assert.equal(new URL(h.win.location.href).searchParams.get('tab'),'library');
  blockLibraryExit=false;
  await h.win._traverse(-1);
  assert.equal(h.active,'plan');assert.equal(h.win.history._index(),0);
}

for(const native of [false,true]){
  const h=harness({native});
  h.controller.install();
  await h.controller.hydrate({source:'startup',explicitOnly:true});
  const focus=Object.freeze({kind:'focus',token:'ws:test:focus'});
  h.workspace=focus;
  assert.equal(h.controller.workspace.open(focus),true);
  assert.equal(h.win.history.length,2);assert.equal(h.controller.status().position,1);
  assert.deepEqual({...h.win.history.state.studyDirectorWorkspace},{version:1,kind:'focus',token:'ws:test:focus'});
  await h.win._traverse(-1);
  assert.equal(h.active,'plan');assert.equal(h.workspace,null);assert.equal(h.controller.status().position,0);
  await h.win._traverse(1);
  assert.equal(h.active,'plan');assert.equal(h.workspace.token,focus.token);assert.equal(h.controller.status().position,1);
}

for(const native of [false,true]){
  let allowReplay=true;
  const h=harness({native,reconcileWorkspace:(desired,_context,current)=>{
    if(desired?.kind==='focus'&&!allowReplay)return null;
    return desired;
  }});
  h.controller.install();
  await h.controller.hydrate({source:'startup',explicitOnly:true});
  const focus=Object.freeze({kind:'focus',token:'ws:test:stale'});
  h.workspace=focus;h.controller.workspace.open(focus);
  await h.win._traverse(-1);assert.equal(h.workspace,null);
  allowReplay=false;
  await h.win._traverse(1);
  assert.equal(h.workspace,null,'expired Forward workspace must not replay');
  assert.equal(h.win.history.state.studyDirectorWorkspace,undefined,'expired Forward entry must normalize to its parent route');
  assert.equal(h.win.history.length,2,'normalization must not manufacture history entries');
}

for(const native of [false,true]){
  const h=harness({native,reconcileWorkspace:(desired,_context,current)=>desired?.kind==='prompt'?current:desired});
  h.controller.install();
  await h.controller.hydrate({source:'startup',explicitOnly:true});
  const focus=Object.freeze({kind:'focus',token:'ws:test:prompt-parent'});
  const prompt=Object.freeze({kind:'prompt',token:'prompt:test:expired'});
  h.workspace=focus;h.controller.workspace.open(focus);
  h.workspace=prompt;h.controller.workspace.open(prompt);
  assert.equal(h.win.history.length,3);assert.equal(h.win.history._index(),2);
  await h.win._traverse(-1);
  assert.equal(h.workspace.token,focus.token,'Back from a prompt must reveal its live parent workspace');
  await h.win._traverse(1);
  assert.equal(h.workspace.token,focus.token,'expired Forward prompt must preserve the live parent workspace');
  assert.equal(h.win.history._index(),2);assert.equal(h.win.history.length,3);
  assert.deepEqual({...h.win.history.state.studyDirectorWorkspace},{version:1,kind:'focus',token:focus.token},'expired prompt entry must normalize to the live parent descriptor');
}

for(const native of [false,true]){
  let blockLibraryExit=false;
  const h=harness({native,prepare:context=>!(blockLibraryExit&&context.from==='library')});
  h.controller.install();
  await h.controller.hydrate({source:'startup',explicitOnly:true});
  await h.controller.request('library',{source:'route-a'});
  const focus=Object.freeze({kind:'focus',token:'ws:test:blocked'});
  h.workspace=focus;h.controller.workspace.open(focus);
  blockLibraryExit=true;
  const length=h.win.history.length;
  await h.win._traverse(-2);await h.win._lastTraversal;
  assert.equal(h.active,'library');assert.equal(h.workspace.token,focus.token);
  assert.equal(h.win.history._index(),2);assert.equal(h.win.history.length,length);
  assert.equal(h.controller.status().position,2,'failed traversal must return to the exact workspace entry');
}

{
  const h=harness({url:'https://study-director.web.app/#legal/privacy'});
  h.controller.install();
  const result=await h.controller.hydrate({source:'direct-legal',explicitOnly:true});
  assert.equal(result.ok,true);assert.equal(h.active,'guide');
  assert.equal(h.workspace.kind,'legal');assert.equal(h.workspace.key,'privacy');
  assert.equal(new URL(h.win.location.href).hash,'#legal/privacy');
  assert.equal(h.win.history.length,1);
}

{
  const h=harness({url:'https://study-director.web.app/#legal/security'});
  h.win.history._set(h.win.location.href,{studyDirectorRoute:{version:1,tab:'plan',position:0},studyDirectorWorkspace:{version:1,kind:'focus',token:'ws:stale:focus'}});
  h.controller.install();
  const result=await h.controller.hydrate({source:'explicit-legal-over-stale-state',explicitOnly:true});
  assert.equal(result.ok,true);assert.equal(h.active,'guide');
  assert.equal(h.workspace.kind,'legal');assert.equal(h.workspace.key,'security','explicit legal hash must outrank stale transient workspace state');
}

{
  const h=harness({native:true});
  assert.equal(h.controller.install(),'navigation');
  assert.equal((h.win._listeners.get('popstate')||[]).length,0);
  let intercepted=null;
  h.win.navigation._dispatch({
    navigationType:'traverse',canIntercept:true,
    destination:{url:'https://study-director.web.app/?tab=guide',getState:()=>({studyDirectorRoute:{version:1,tab:'guide',position:1}})},
    intercept(options){intercepted=options;}
  });
  assert.ok(intercepted);assert.equal(intercepted.focusReset,'manual');assert.equal(intercepted.scroll,'manual');
  await intercepted.handler();
  assert.equal(h.active,'guide');
  intercepted=null;
  h.win.navigation._dispatch({
    navigationType:'traverse',canIntercept:true,
    destination:{url:'https://study-director.web.app/?tab=guide#legal/privacy',getState:()=>({studyDirectorRoute:{version:1,tab:'guide',position:2},studyDirectorWorkspace:{version:1,kind:'legal',token:'legal:privacy',key:'privacy'}})},
    intercept(options){intercepted=options;}
  });
  assert.ok(intercepted,'Legal Center traversal must be owned by the shared navigation controller');
  await intercepted.handler();
  assert.equal(h.workspace.kind,'legal');assert.equal(h.workspace.key,'privacy');
}

for(const native of [false,true]){
  const h=harness({url:'https://study-director.web.app/?tab=world',native});
  await h.controller.install();await h.controller.hydrate();
  assert.equal(h.active,'world');
  await h.controller.request('plan',{source:'world-exit'});
  h.win.history.back();await h.win._lastTraversal;
  assert.equal(h.active,'world','Living World must participate in native and fallback History traversal');
}
console.log(JSON.stringify({status:'PASS',contract:'navigation-workspace-history',drivers:['history','navigation'],tabs:7,failedTraversalReconciliation:['back','forward']},null,2));
