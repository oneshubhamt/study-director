(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
registry.define('navigation',1,()=>{
  const freeze=Object.freeze;
  const TABS=freeze(['plan','execute','review','library','insights','guide']);
  const TAB_SET=new Set(TABS);
  const WORKSPACE_KINDS=new Set(['legal','focus','pdf','audio','prompt']);
  const ROUTE_STATE_KEY='studyDirectorRoute';
  const WORKSPACE_STATE_KEY='studyDirectorWorkspace';
  const ROUTE_STATE_VERSION=1;
  const WORKSPACE_STATE_VERSION=1;
  function validTab(value){
    const tab=String(value||'').trim().toLowerCase();
    return TAB_SET.has(tab)?tab:null;
  }
  function cleanTab(value){return validTab(value)||'plan';}
  function parseUrl(value,base){
    const url=new URL(value,base);
    const raw=url.searchParams.get('tab');
    const explicit=raw!==null;
    const valid=!explicit||TAB_SET.has(String(raw||'').trim().toLowerCase());
    return freeze({tab:valid?cleanTab(raw):'plan',explicit,valid,url});
  }
  function routeUrl(value,tab){
    const url=new URL(value);
    url.searchParams.set('tab',cleanTab(tab));
    return url.href;
  }
  function sameDocument(value,location){
    const url=new URL(value,location.href);
    return url.origin===location.origin&&url.pathname===location.pathname;
  }
  function statePosition(state){
    const route=state&&state[ROUTE_STATE_KEY];
    const position=route&&route.version===ROUTE_STATE_VERSION?Number(route.position):NaN;
    return Number.isSafeInteger(position)&&position>=0?position:null;
  }
  function cleanWorkspace(value){
    if(!value||typeof value!=='object')return null;
    const kind=String(value.kind||'').trim().toLowerCase();
    const token=String(value.token||'').trim();
    const key=String(value.key||'').trim();
    if(!WORKSPACE_KINDS.has(kind)||!/^[A-Za-z0-9:_-]{1,96}$/.test(token))return null;
    if(key&&!/^[A-Za-z0-9._-]{1,120}$/.test(key))return null;
    const out={version:WORKSPACE_STATE_VERSION,kind,token};
    if(key)out.key=key;
    return freeze(out);
  }
  function legalWorkspaceFromUrl(value,base){
    const url=new URL(value,base),match=/^#legal\/([A-Za-z0-9._-]{1,120})$/.exec(url.hash||'');
    if(!match)return null;
    const key=match[1];
    return cleanWorkspace({kind:'legal',token:`legal:${key}`,key});
  }
  function workspaceFromState(state,url,base){
    return legalWorkspaceFromUrl(url,base)||cleanWorkspace(state&&state[WORKSPACE_STATE_KEY]);
  }
  function sameWorkspace(a,b){
    if(!a&&!b)return true;
    return !!a&&!!b&&a.kind===b.kind&&a.token===b.token&&(a.key||'')===(b.key||'');
  }
  function workspaceUrl(value,tab,workspace){
    const url=new URL(routeUrl(value,tab));
    const descriptor=cleanWorkspace(workspace);
    if(descriptor?.kind==='legal'&&descriptor.key)url.hash=`legal/${descriptor.key}`;
    else if(/^#legal\//.test(url.hash||''))url.hash='';
    return url.href;
  }
  function routeState(tab,position,workspace=null){
    const safePosition=Number.isSafeInteger(position)&&position>=0?position:0;
    const state={[ROUTE_STATE_KEY]:freeze({version:ROUTE_STATE_VERSION,tab:cleanTab(tab),position:safePosition})};
    const descriptor=cleanWorkspace(workspace);
    if(descriptor)state[WORKSPACE_STATE_KEY]=descriptor;
    return state;
  }
  function createController(input){
    if(!input||!Object.isFrozen(input))throw new TypeError('Navigation input must be frozen.');
    const win=input.window;
    const host=input.host;
    if(!win||!host||!Object.isFrozen(host))throw new TypeError('Navigation environment or host adapter is incomplete.');
    for(const key of ['currentTab','prepare','present','commit','ready','report'])if(typeof host[key]!=='function')throw new TypeError('Navigation host adapter is incomplete.');
    const workspaceHost=host.workspace&&Object.isFrozen(host.workspace)?host.workspace:null;
    if(workspaceHost&&['current','reconcile'].some(key=>typeof workspaceHost[key]!=='function'))throw new TypeError('Navigation workspace host adapter is incomplete.');
    let generation=0;
    let installed=false;
    let driver='none';
    let position=statePosition(win.history?.state)??0;
    let reconciliation=null;
    let lastResult=freeze({ok:true,tab:cleanTab(host.currentTab()),changed:false,reason:'initial',generation:0,source:'initial'});
    const native=win.navigation&&typeof win.navigation.addEventListener==='function';
    const location=()=>win.location;
    const activeTab=()=>cleanTab(host.currentTab());
    const activeWorkspace=()=>cleanWorkspace(workspaceHost?.current?.());
    const result=(ok,tab,changed,reason,revision,source)=>freeze({ok:!!ok,tab:cleanTab(tab),changed:!!changed,reason:String(reason||''),generation:revision,source:String(source||'programmatic')});
    function publish(next){if(next.generation>=lastResult.generation)lastResult=next;return next;}
    function write(mode,tab,urlOverride=null,positionOverride=null,workspace=null){
      if(mode==='none')return true;
      const history=win.history;
      if(!history)return false;
      const descriptor=cleanWorkspace(workspace);
      const href=urlOverride||workspaceUrl(location().href,tab,descriptor);
      const nextPosition=Number.isSafeInteger(positionOverride)&&positionOverride>=0
        ?positionOverride
        :(mode==='push'?position+1:position);
      const state=routeState(tab,nextPosition,descriptor);
      if(mode==='replace')history.replaceState(state,'',href);
      else history.pushState(state,'',href);
      position=nextPosition;
      return true;
    }
    function takeReconciliation(url,state){
      if(!reconciliation)return null;
      const parsed=parseUrl(url,location().href);
      const targetPosition=statePosition(state);
      const targetWorkspace=workspaceFromState(state,url,location().href);
      if(parsed.tab!==reconciliation.tab||targetPosition!==reconciliation.position||!sameWorkspace(targetWorkspace,reconciliation.workspace))return null;
      const match=reconciliation;reconciliation=null;position=match.position;return match;
    }
    async function replayReconciliation(match,source){
      if(!workspaceHost)return true;
      try{await workspaceHost.reconcile(match.workspace,freeze({from:activeTab(),to:match.tab,source,generation,traversal:true,reconciliation:true,current:()=>true}));}
      catch(error){host.report('navigation.workspace-reconcile',error);}
      return true;
    }
    function restoreAfterFailedTraversal(tab,originPosition,targetPosition,originWorkspace=null){
      const history=win.history,descriptor=cleanWorkspace(originWorkspace);
      if(Number.isSafeInteger(originPosition)&&Number.isSafeInteger(targetPosition)&&originPosition!==targetPosition&&typeof history?.go==='function'){
        reconciliation=freeze({tab:cleanTab(tab),position:originPosition,workspace:descriptor});
        position=originPosition;
        history.go(originPosition-targetPosition);
        return true;
      }
      reconciliation=null;
      return write('replace',tab,workspaceUrl(location().href,tab,descriptor),originPosition,descriptor);
    }
    async function reconcileWorkspace(desired,context,{normalize=false}={}){
      const target=cleanWorkspace(desired);
      if(!workspaceHost)return freeze({matched:!target,actual:null});
      let actual=activeWorkspace();
      if(sameWorkspace(actual,target))return freeze({matched:true,actual});
      try{actual=cleanWorkspace(await workspaceHost.reconcile(target,context));}
      catch(error){host.report('navigation.workspace',error);actual=activeWorkspace();}
      const matched=sameWorkspace(actual,target);
      if(!matched&&normalize){
        write('replace',context.to,workspaceUrl(location().href,context.to,actual),position,actual);
      }
      return freeze({matched,actual});
    }
    async function settleAndCommit(tab,options={}){
      const source=String(options.source||'programmatic');
      const revision=++generation;
      const from=activeTab();
      const target=validTab(tab);
      const originPosition=position;
      const originWorkspace=activeWorkspace();
      const traversalPosition=Number.isSafeInteger(options.traversalPosition)?options.traversalPosition:null;
      const workspaceSpecified=options.workspaceSpecified===true;
      const desiredWorkspace=workspaceSpecified?cleanWorkspace(options.workspace):null;
      if(!target){
        return publish(result(false,from,false,'invalid-destination',revision,source));
      }
      const context=freeze({
        from,to:target,source,generation:revision,traversal:options.traversal===true,
        restoreScroll:options.restoreScroll!==false,
        current:()=>revision===generation
      });
      if(from===target&&options.force!==true){
        if(options.traversal===true&&traversalPosition!==null)position=traversalPosition;
        let workspaceMatch=true;
        if(workspaceSpecified){
          const reconciled=await reconcileWorkspace(desiredWorkspace,context,{normalize:options.traversal===true||options.normalize===true});
          workspaceMatch=reconciled.matched;
        }
        if(options.normalize===true){
          const actual=workspaceSpecified?activeWorkspace():null;
          write('replace',target,options.url||workspaceUrl(location().href,target,actual),traversalPosition??position,actual);
        }else if(options.ensureEntry===true){
          const actual=workspaceSpecified?activeWorkspace():null;
          write('replace',target,options.url||workspaceUrl(location().href,target,actual),position,actual);
        }
        return publish(result(true,target,false,workspaceMatch?'same-tab':'workspace-normalized',revision,source));
      }
      let prepared=false;
      try{prepared=await host.prepare(freeze({from,to:target,source,generation:revision,traversal:options.traversal===true}));}
      catch(error){host.report('navigation.prepare',error);prepared=false;}
      if(revision!==generation)return publish(result(false,target,false,'superseded',revision,source));
      if(prepared===false){
        if(options.traversal===true)restoreAfterFailedTraversal(from,originPosition,traversalPosition,originWorkspace);
        return publish(result(false,from,false,'departure-blocked',revision,source));
      }
      if(workspaceHost&&originWorkspace){
        const cleared=await reconcileWorkspace(null,context);
        if(revision!==generation)return publish(result(false,target,false,'superseded',revision,source));
        if(!cleared.matched){
          if(options.traversal===true)restoreAfterFailedTraversal(from,originPosition,traversalPosition,originWorkspace);
          return publish(result(false,from,false,'workspace-departure-blocked',revision,source));
        }
      }
      let committed=false,commitAttempted=false,commitPromise=null,historyWritten=false;
      const commit=()=>{
        if(revision!==generation)return Promise.resolve(false);
        if(commitPromise)return commitPromise;
        if(options.traversal!==true){
          const mode=options.history||'push';
          historyWritten=mode!=='none'&&write(mode,target,options.url||null,null,null);
        }
        commitAttempted=true;
        commitPromise=(async()=>{
          try{committed=await host.commit(context);}
          catch(error){host.report('navigation.commit',error);committed=false;}
          return committed;
        })();
        return commitPromise;
      };
      try{await host.present(context,commit);}
      catch(error){
        host.report('navigation.present',error);
        if(!commitAttempted&&revision===generation)await commit();
        else if(commitPromise)await commitPromise;
      }
      if(revision!==generation&&!commitAttempted)return publish(result(false,target,false,'superseded',revision,source));
      if(committed===false){
        if(options.traversal===true)restoreAfterFailedTraversal(from,originPosition,traversalPosition,originWorkspace);
        else if(historyWritten&&(options.history||'push')==='push')restoreAfterFailedTraversal(from,originPosition,position,originWorkspace);
        else if(historyWritten)write('replace',from,workspaceUrl(location().href,from,originWorkspace),originPosition,originWorkspace);
        return publish(result(false,from,false,'commit-failed',revision,source));
      }
      if(options.traversal===true){
        if(traversalPosition!==null)position=traversalPosition;
        if(options.normalize===true)write('replace',target,options.url||workspaceUrl(location().href,target,desiredWorkspace),position,desiredWorkspace);
      }
      try{await host.ready(context);}
      catch(error){host.report('navigation.ready',error);}
      if(revision!==generation)return publish(result(false,target,true,'superseded-after-commit',revision,source));
      let workspaceMatched=true;
      if(workspaceSpecified){
        const reconciled=await reconcileWorkspace(desiredWorkspace,context,{normalize:true});
        workspaceMatched=reconciled.matched;
      }
      if(revision!==generation)return publish(result(false,target,true,'superseded-after-workspace',revision,source));
      return publish(result(true,target,true,workspaceMatched?'committed':'workspace-normalized',revision,source));
    }
    async function restoreDestination(url,state,source='history'){
      const parsed=parseUrl(url,location().href);
      const desiredWorkspace=workspaceFromState(state,url,location().href);
      const targetPosition=statePosition(state);
      const targetTab=desiredWorkspace?.kind==='legal'&&!parsed.explicit?'guide':parsed.tab;
      const normalizedUrl=parsed.valid?null:workspaceUrl(parsed.url.href,'plan',null);
      return settleAndCommit(targetTab,{source,history:'none',traversal:true,traversalPosition:targetPosition,normalize:!parsed.valid,url:normalizedUrl,workspaceSpecified:true,workspace:desiredWorkspace});
    }
    function install(){
      if(installed)return driver;
      installed=true;
      if(native){
        driver='navigation';
        const handler=event=>{
          if(event.navigationType!=='traverse'||!event.destination?.url||!sameDocument(event.destination.url,location()))return;
          const state=typeof event.destination.getState==='function'?event.destination.getState():null;
          const match=takeReconciliation(event.destination.url,state);
          if(match){
            if(event.canIntercept!==false){
              try{event.intercept({focusReset:'manual',scroll:'manual',handler:()=>replayReconciliation(match,'navigation-reconcile-return')});}catch(error){host.report('navigation.reconcile-intercept',error);void replayReconciliation(match,'navigation-reconcile-fallback');}
            }else void replayReconciliation(match,'navigation-reconcile-unintercepted');
            return;
          }
          if(event.canIntercept===false){
            Promise.resolve().then(()=>restoreDestination(event.destination.url,state,'navigation-unintercepted'));
            return;
          }
          try{
            event.intercept({focusReset:'manual',scroll:'manual',handler:()=>restoreDestination(event.destination.url,state,'navigation-traverse')});
          }catch(error){
            host.report('navigation.intercept',error);
            Promise.resolve().then(()=>restoreDestination(event.destination.url,state,'navigation-reconcile'));
          }
        };
        win.navigation.addEventListener('navigate',handler);
      }else{
        driver='history';
        win.addEventListener('popstate',event=>{
          const state=event?.state??win.history?.state??null;
          const match=takeReconciliation(location().href,state);
          if(match)return replayReconciliation(match,'history-reconcile-return');
          return restoreDestination(location().href,state,'history-traverse');
        });
      }
      return driver;
    }
    async function hydrate(options={}){
      const parsed=parseUrl(location().href,location().href);
      const desiredWorkspace=workspaceFromState(win.history?.state,location().href,location().href);
      const legalDirect=desiredWorkspace?.kind==='legal';
      if(options.explicitOnly===true&&!parsed.explicit&&!legalDirect){
        const current=activeTab();
        write('replace',current,workspaceUrl(location().href,current,null),position,null);
        return publish(result(true,current,false,'implicit-route',++generation,options.source||'startup-route'));
      }
      const targetTab=legalDirect&&!parsed.explicit?'guide':parsed.tab;
      const url=parsed.valid?workspaceUrl(parsed.url.href,targetTab,desiredWorkspace):workspaceUrl(parsed.url.href,'plan',null);
      return settleAndCommit(targetTab,{source:options.source||'startup-route',history:'replace',normalize:true,ensureEntry:true,url,restoreScroll:false,workspaceSpecified:true,workspace:parsed.valid?desiredWorkspace:null});
    }
    function workspaceOpen(raw,options={}){
      const descriptor=cleanWorkspace(raw);
      if(!descriptor)return false;
      const tab=activeTab(),mode=options.replace===true?'replace':'push';
      return write(mode,tab,options.url||workspaceUrl(location().href,tab,descriptor),null,descriptor);
    }
    function workspaceClose(raw){
      const descriptor=cleanWorkspace(raw),current=workspaceFromState(win.history?.state,location().href,location().href),history=win.history;
      if(!descriptor||!sameWorkspace(descriptor,current)||position<=0||typeof history?.back!=='function')return false;
      history.back();return true;
    }
    function workspaceDrop(raw){
      const descriptor=cleanWorkspace(raw),current=workspaceFromState(win.history?.state,location().href,location().href);
      if(!descriptor||!sameWorkspace(descriptor,current))return false;
      return write('replace',activeTab(),workspaceUrl(location().href,activeTab(),null),position,null);
    }
    function status(){
      return freeze({format:'study-director.navigation-status',contractVersion:1,driver,installed,generation,position,workspace:workspaceFromState(win.history?.state,location().href,location().href),lastResult});
    }
    return freeze({
      format:'study-director.navigation-controller',contractVersion:1,
      install,hydrate,status,
      request:(tab,options={})=>settleAndCommit(tab,options),
      workspace:freeze({open:workspaceOpen,replace:(descriptor,options={})=>workspaceOpen(descriptor,{...options,replace:true}),close:workspaceClose,drop:workspaceDrop})
    });
  }
  return freeze({format:'study-director.navigation-module',contractVersion:1,createController});
});
})();
