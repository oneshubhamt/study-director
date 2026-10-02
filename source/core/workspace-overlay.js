(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject}=registry.contracts;
registry.define('workspace-overlay',1,()=>{
  const freeze=Object.freeze;
  const HISTORY_KINDS=new Set(['focus','pdf','audio']);
  const REPLAY_LIMIT=32;
  const CLOSE_FALLBACK_MS=220;
  function createController(controllerInput){
    exactObject(controllerInput,['ports'],'Workspace overlay input');
    const rawPorts=controllerInput.ports,portKeys=rawPorts&&typeof rawPorts==='object'?Object.keys(rawPorts).sort():[];
    if(!rawPorts||!Object.isFrozen(rawPorts)||!['environment','environment|history'].includes(portKeys.join('|')))throw new TypeError('Workspace overlay ports are incomplete, mutable, or contain unexpected fields.');
    const environment=exactObject(rawPorts.environment,['document'],'Workspace overlay environment');
    const historyPort=rawPorts.history||null;
    if(historyPort)exactObject(historyPort,['closed','opened','requestClose'],'Workspace overlay history port');
    if(historyPort&&['closed','opened','requestClose'].some(key=>typeof historyPort[key]!=='function'))throw new TypeError('Workspace overlay history port must contain functions only.');
    const {document}=environment;
    const stack=[];
    const replay=new Map();
    const nonce=String(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9_-]/g,'').slice(0,24)||'session';
    let sequence=0,historySequence=0,baseOverflow='',physicalDialogs=0;
    const closingByToken=new Map();

    function supportsDialog(dialog){return !!(dialog&&typeof dialog.showModal==='function'&&typeof dialog.close==='function');}
    function cleanLabel(value){const text=String(value??'').trim();return text.slice(0,180)||'Study Director';}
    function cleanKey(value){const key=String(value??'').trim();return /^[A-Za-z0-9._-]{1,120}$/.test(key)?key:'';}
    function cleanToken(value){const token=String(value??'').trim();return /^[A-Za-z0-9:_-]{1,96}$/.test(token)?token:'';}
    function descriptor(raw,parentToken=''){
      if(!raw||typeof raw!=='object')return null;
      const kind=String(raw.kind||'').trim().toLowerCase();if(!HISTORY_KINDS.has(kind))return null;
      const token=cleanToken(raw.token)||`ws:${nonce}:${++historySequence}`;
      const key=cleanKey(raw.key),out={kind,token};if(key)out.key=key;
      const value=freeze(out);
      if(typeof raw.reopen==='function'){
        replay.set(token,freeze({descriptor:value,parentToken:cleanToken(parentToken),reopen:raw.reopen,valid:typeof raw.valid==='function'?raw.valid:null}));
        while(replay.size>REPLAY_LIMIT)replay.delete(replay.keys().next().value);
      }
      return value;
    }
    function addClass(node,name){if(node.classList?.add)node.classList.add(name);else if(!String(node.className||'').split(/\s+/).includes(name))node.className=`${node.className||''} ${name}`.trim();}
    function removeClass(node,name){if(node.classList?.remove)node.classList.remove(name);else node.className=String(node.className||'').split(/\s+/).filter(value=>value&&value!==name).join(' ');}
    function reducedMotion(){try{return !!document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches}catch{return false}}
    function frame(callback){const raf=document.defaultView?.requestAnimationFrame||globalThis.requestAnimationFrame;return typeof raf==='function'?raf(callback):globalThis.setTimeout(callback,0);}
    function after(delay,callback){return globalThis.setTimeout(callback,delay);}
    function currentEntry(){return stack[stack.length-1]||null;}
    function historyDescriptor(){return currentEntry()?.descriptor||null;}
    function forget(token){const key=cleanToken(token);return key?replay.delete(key):false;}
    function open(rawOptions){
      const options=rawOptions&&typeof rawOptions==='object'?rawOptions:{};
      if(!(options.content instanceof HTMLElement))throw new TypeError('Workspace overlay content must be an HTMLElement.');
      if(options.headerContent!==undefined&&!(options.headerContent instanceof HTMLElement))throw new TypeError('Workspace overlay header content must be an HTMLElement.');
      const dialog=document.createElement('dialog');
      if(!supportsDialog(dialog))throw new Error('This browser does not support the Study Director workspace overlay.');
      const parentToken=historyDescriptor()?.token||'',historyConfig=options.history&&typeof options.history==='object'?options.history:null,historyDescriptorValue=descriptor(historyConfig,parentToken);
      const fromHistory=!!cleanToken(historyConfig?.token);
      const id=`sd-workspace-overlay-title-${++sequence}`,restoreFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
      dialog.className=`workspace-overlay${options.className?` ${String(options.className).replace(/[^a-z0-9_-]+/gi,' ').trim()}`:''}`;
      dialog.dataset.sdWorkspaceOverlay='1';dialog.setAttribute('aria-labelledby',id);
      const shell=document.createElement('section');shell.className='workspace-overlay-shell';
      const header=document.createElement('header');header.className='workspace-overlay-head';
      const title=document.createElement('div');title.className='workspace-overlay-title';title.id=id;title.textContent=cleanLabel(options.label);
      const slot=document.createElement('div');slot.className='workspace-overlay-header-content';if(options.headerContent)slot.append(options.headerContent);
      const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='workspace-overlay-close';closeButton.setAttribute('aria-label',String(options.closeLabel||'Close'));closeButton.textContent='×';
      const body=document.createElement('div');body.className='workspace-overlay-body';body.append(options.content);
      header.append(title,slot,closeButton);shell.append(header,body);dialog.append(shell);document.body.append(dialog);
      let closing=false,closed=false,closeTimer=0,closeEndHandler=null,resolveClosed=()=>{};
      const whenClosed=new Promise(resolve=>{resolveClosed=resolve;});
      const onCancel=event=>{event.preventDefault();};
      let handle=null;
      const clearCloseWait=()=>{
        if(closeTimer)globalThis.clearTimeout(closeTimer);closeTimer=0;
        if(closeEndHandler){dialog.removeEventListener('transitionend',closeEndHandler);closeEndHandler=null;}
      };
      const finalize=()=>{
        if(closed)return false;closed=true;clearCloseWait();
        dialog.removeEventListener('cancel',onCancel);
        try{if(dialog.open)dialog.close();}catch{}
        dialog.remove();
        try{if(typeof options.onAfterClose==='function')options.onAfterClose();}catch{}
        physicalDialogs=Math.max(0,physicalDialogs-1);
        if(historyDescriptorValue?.token&&closingByToken.get(historyDescriptorValue.token)===whenClosed)closingByToken.delete(historyDescriptorValue.token);
        if(!physicalDialogs)document.body.style.overflow=baseOverflow;
        if(restoreFocus?.isConnected)restoreFocus.focus({preventScroll:true});
        resolveClosed(true);return true;
      };
      const beginClose=(meta={})=>{
        if(closing||closed)return false;closing=true;
        const index=stack.findIndex(item=>item.handle===handle);if(index>=0)stack.splice(index,1);
        if(historyDescriptorValue?.token)closingByToken.set(historyDescriptorValue.token,whenClosed);
        try{if(typeof options.onBeforeClose==='function')options.onBeforeClose();}finally{
          if(historyDescriptorValue)historyPort?.closed(historyDescriptorValue,freeze({fromHistory:meta.fromHistory===true,historyPending:meta.historyPending===true}));
          removeClass(dialog,'is-open');addClass(dialog,'is-closing');
          if(reducedMotion())finalize();
          else{
            closeEndHandler=event=>{if(event.target===dialog)finalize();};
            dialog.addEventListener('transitionend',closeEndHandler);
            closeTimer=after(CLOSE_FALLBACK_MS,finalize);
          }
        }
        return true;
      };
      const requestClose=()=>{
        if(closing||closed)return false;
        const historyPending=!!(historyDescriptorValue&&historyPort?.requestClose(historyDescriptorValue));
        return beginClose({historyPending});
      };
      const closeFromHistory=()=>beginClose({fromHistory:true});
      closeButton.addEventListener('click',requestClose);
      dialog.addEventListener('cancel',onCancel);
      try{dialog.showModal()}catch(error){dialog.removeEventListener('cancel',onCancel);dialog.remove();throw error}
      if(!physicalDialogs)baseOverflow=document.body.style.overflow;
      physicalDialogs+=1;document.body.style.overflow='hidden';
      handle=freeze({dialog,close:requestClose,closeFromHistory,whenClosed,historyToken:historyDescriptorValue?.token||'',forget:()=>historyDescriptorValue?forget(historyDescriptorValue.token):false});
      stack.push({handle,descriptor:historyDescriptorValue});
      if(historyDescriptorValue&&!fromHistory)historyPort?.opened(historyDescriptorValue,freeze({replace:historyConfig?.replace===true,url:String(historyConfig?.url||'')}));
      frame(()=>{if(!closing&&!closed)addClass(dialog,'is-open');});
      return handle;
    }
    function close(){const top=currentEntry();return top?top.handle.close():false;}
    async function closeToIndex(index){
      while(stack.length-1>index){const top=currentEntry();if(!top)break;top.handle.closeFromHistory();await top.handle.whenClosed;}
    }
    async function ensureToken(token,seen=new Set()){
      const key=cleanToken(token);if(!key||seen.has(key))return false;seen.add(key);
      const closing=closingByToken.get(key);if(closing)await closing;
      const existing=stack.findIndex(item=>item.descriptor?.token===key);
      if(existing>=0){await closeToIndex(existing);return true;}
      const record=replay.get(key);if(!record)return false;
      if(record.valid){let valid=false;try{valid=record.valid()===true}catch{}if(!valid){replay.delete(key);return false;}}
      if(record.parentToken&&!await ensureToken(record.parentToken,seen))return false;
      let opened=false;try{opened=await record.reopen(record.descriptor)===true}catch{opened=false;}
      return opened&&historyDescriptor()?.token===key;
    }
    async function reconcile(rawDesired){
      const desired=rawDesired&&typeof rawDesired==='object'&&HISTORY_KINDS.has(String(rawDesired.kind||'').toLowerCase())?rawDesired:null;
      if(!desired){await closeToIndex(-1);return historyDescriptor();}
      const targetToken=cleanToken(desired.token);if(!targetToken){await closeToIndex(-1);return historyDescriptor();}
      const existing=stack.findIndex(item=>item.descriptor?.token===targetToken);
      if(existing>=0){await closeToIndex(existing);return historyDescriptor();}
      await ensureToken(targetToken);return historyDescriptor();
    }
    return freeze({format:'study-director.workspace-overlay',contractVersion:1,open,close,reconcile,historyDescriptor});
  }
  return freeze({format:'study-director.workspace-overlay-module',contractVersion:1,createController});
});
})();
