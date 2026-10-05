(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
registry.define('reconciliation-ui',1,()=>{
  const freeze=Object.freeze;
  const FORMAT='study-director.note-reconciliation-result';
  function exactObject(value,keys,label){
    const actual=value&&typeof value==='object'?Object.keys(value).sort():[],expected=[...keys].sort();
    if(!value||actual.join('|')!==expected.join('|'))throw new TypeError(label+' is incomplete or contains unexpected fields.');
    return value;
  }
  function createController(input){
    exactObject(input,['ports'],'Reconciliation UI input');
    const ports=exactObject(input.ports,['assets','configuration','diagnostics','richText','view'],'Reconciliation UI ports');
    const assets=exactObject(ports.assets,['get'],'Reconciliation UI asset port');
    const configuration=exactObject(ports.configuration,['maxBytes','maxWords'],'Reconciliation UI configuration port');
    const diagnostics=exactObject(ports.diagnostics,['capture'],'Reconciliation UI diagnostics port');
    const richText=exactObject(ports.richText,['appendIncomingAdditions','compareRichText','mergeIncomingAdditions','mergeThreeWay','mountRichTextEditor'],'Reconciliation UI rich-text port');
    const view=exactObject(ports.view,['document','requestAnimationFrame','cancelAnimationFrame'],'Reconciliation UI view port');
    if(typeof assets.get!=='function'||typeof diagnostics.capture!=='function'||typeof richText.mountRichTextEditor!=='function'||typeof richText.compareRichText!=='function'||typeof richText.mergeIncomingAdditions!=='function'||typeof richText.appendIncomingAdditions!=='function'||typeof richText.mergeThreeWay!=='function')throw new TypeError('Reconciliation UI ports are invalid.');
    const document=view.document;
    if(!document||typeof document.createElement!=='function')throw new TypeError('Reconciliation UI document is unavailable.');
    let active=null;
    function normalizedConflicts(raw){
      if(!Array.isArray(raw))throw new TypeError('Ongoing Note conflicts must be an array.');
      const seen=new Set(),out=[];
      for(const item of raw){
        const key=String(item&&item.key||'').trim(),localCandidateId=String(item&&item.localCandidateId||''),incomingCandidateId=String(item&&item.incomingCandidateId||'');
        if(!key||seen.has(key)||!localCandidateId||!incomingCandidateId)continue;
        seen.add(key);out.push(freeze({
          key,label:String(item.label||key).trim().slice(0,160)||key,
          localCandidateId,incomingCandidateId,
          localValue:String(item.localValue||''),incomingValue:String(item.incomingValue||''),ancestorAvailable:item.ancestorAvailable===true,ancestorValue:String(item.ancestorValue||''),requireContent:item.requireContent===true,
          incomingLabel:String(item.incomingLabel||'Backup copy').trim().slice(0,160)||'Backup copy'
        }));
      }
      return freeze(out);
    }
    function resultFrom(states,automaticNotes=null){
      const notes=Object.assign(Object.create(null),automaticNotes||{});
      for(const state of states)notes[state.conflict.key]=freeze({text:String(state.result??state.working),localCandidateId:state.conflict.localCandidateId,incomingCandidateId:state.conflict.incomingCandidateId});
      return freeze({format:FORMAT,version:1,notes:freeze(notes)});
    }
    async function resolve(options={}){
      if(active)throw new Error('Ongoing Note reconciliation is already open.');
      // purpose 'version' is one note compared with an earlier backup of it.
      const conflicts=normalizedConflicts(options.conflicts),manualOnly=options.manualOnly===true,version=!manualOnly&&options.purpose==='version';
      if(!conflicts.length)return freeze({format:FORMAT,version:1,notes:freeze(Object.create(null))});
      const automaticNotes=Object.create(null),manual=[];
      for(const conflict of conflicts){
        if(manualOnly){manual.push({conflict,smartValue:null});continue;}
        if(!conflict.ancestorAvailable){manual.push({conflict,smartValue:null});continue;}
        try{
          const threeWay=richText.mergeThreeWay(conflict.ancestorValue,conflict.localValue,conflict.incomingValue);
          if(threeWay.safe){automaticNotes[conflict.key]=freeze({text:threeWay.value,localCandidateId:conflict.localCandidateId,incomingCandidateId:conflict.incomingCandidateId});continue;}
          manual.push({conflict,smartValue:threeWay.value});
        }catch(error){diagnostics.capture('reconciliation-ui.three-way-preflight',error,'warn');manual.push({conflict,smartValue:null});}
      }
      if(!manual.length)return freeze({format:FORMAT,version:1,notes:freeze(automaticNotes)});
      const checkpointAssets=new Map();
      for(const item of Array.isArray(options.incomingAssets)?options.incomingAssets:[]){const id=String(item&&item.assetId||'');if(id&&item.blob instanceof Blob)checkpointAssets.set(id,item.blob);}
      const readonlyAssetStore=(preferCheckpoint=false)=>freeze({
        async get(id){
          const key=String(id||''),checkpoint=checkpointAssets.get(key)||null;
          if(preferCheckpoint&&checkpoint instanceof Blob)return checkpoint;
          try{const local=await assets.get(key);if(local instanceof Blob)return local;}catch(error){diagnostics.capture('reconciliation-ui.asset-read',error,'warn');}
          return checkpoint;
        },
        async put(){throw new Error('Attachments cannot be added while reconciling notes.');},
        async remove(){throw new Error('Attachments cannot be removed from storage while reconciling notes.');}
      });
      // Both stores are temporary read-only views. The imported editor prefers the
      // verified checkpoint bytes; the resolved/local editor prefers canonical bytes
      // and only falls back to checkpoint bytes for not-yet-published attachments.
      const localScratchAssets=readonlyAssetStore(false),incomingScratchAssets=readonlyAssetStore(true);
      const states=manual.map(item=>({conflict:item.conflict,working:item.conflict.localValue,incoming:item.conflict.incomingValue,smartValue:item.smartValue,result:null,applied:false}));
      const restoreFocus=document.activeElement;
      const dialog=document.createElement('dialog');dialog.className='sd-note-reconcile-dialog';dialog.setAttribute('aria-label',manualOnly?'Review Diary differences':'Review Ongoing Note differences');
      const shell=document.createElement('div');shell.className='sd-note-reconcile-shell';
      const header=document.createElement('header');header.className='sd-note-reconcile-header';
      const headingWrap=document.createElement('div'),kicker=document.createElement('div'),title=document.createElement('h2'),progress=document.createElement('div');kicker.className='sd-note-reconcile-kicker';kicker.textContent=manualOnly?'DIARY DIFFERENCES':version?'EARLIER VERSION':'ONGOING NOTE DIFFERENCES';title.className='sd-note-reconcile-title';progress.className='sd-note-reconcile-progress';headingWrap.append(kicker,title,progress);
      const cancel=document.createElement('button');cancel.type='button';cancel.className='sd-note-reconcile-close';cancel.textContent='Cancel';cancel.setAttribute('aria-label',manualOnly?'Cancel Diary review':'Cancel note review');header.append(headingWrap,cancel);
      const editors=document.createElement('div');editors.className='sd-note-reconcile-editors';
      const makePane=(side,label)=>{const pane=document.createElement('section'),head=document.createElement('div'),name=document.createElement('strong'),sub=document.createElement('span'),field=document.createElement('textarea');pane.className=`sd-note-reconcile-pane sd-note-reconcile-pane-${side}`;head.className='sd-note-reconcile-pane-head';name.textContent=label;sub.className='sd-note-reconcile-pane-sub';field.className='sd-note-reconcile-field';field.setAttribute('aria-label',label);field.spellcheck=true;head.append(name,sub);pane.append(head,field);return{pane,sub,field}};
      const localPane=makePane('local',manualOnly?'Resolved reflection':version?'Current note':'Resolved note'),incomingPane=makePane('incoming',manualOnly?'Imported reflection':version?'Earlier version':'Imported note');editors.append(localPane.pane,incomingPane.pane);
      const diffStatus=document.createElement('div');diffStatus.className='sd-note-reconcile-diff-status';diffStatus.setAttribute('aria-live','polite');
      const actions=document.createElement('div');actions.className='sd-note-reconcile-actions';
      const strategy=document.createElement('div');strategy.className='sd-note-reconcile-strategies';strategy.setAttribute('role','group');strategy.setAttribute('aria-label','Difference review actions');
      const action=(label,kind)=>{const button=document.createElement('button');button.type='button';button.dataset.action=kind;button.textContent=label;strategy.append(button);return button};
      const keepButton=action(version?'Keep current':'Keep local','keep'),mergeButton=action('Smart merge','merge'),appendButton=action(version?'Add what’s missing':'Append additions','append'),importButton=action(version?'Use this version':'Use imported','import'),customButton=action('Custom','custom');if(manualOnly){mergeButton.hidden=true;appendButton.hidden=true;}else customButton.hidden=true;
      const navigation=document.createElement('div');navigation.className='sd-note-reconcile-navigation';
      const previous=document.createElement('button'),next=document.createElement('button');previous.type=next.type='button';previous.textContent='← Previous';next.textContent='Next →';const retry=document.createElement('button');retry.type='button';retry.textContent='Retry editors';retry.hidden=true;navigation.append(previous,next,retry);
      const apply=document.createElement('button');apply.type='button';apply.className='sd-note-reconcile-apply';apply.textContent='Apply resolved note';
      actions.append(strategy,navigation,apply);shell.append(header,editors,diffStatus,actions);dialog.append(shell);document.body.append(dialog);
      let index=0,leftHandle=null,rightHandle=null,frame=0,settled=false,generation=0,abortHandler=null,transitionBusy=false;
      const ownedHandles=new Set(),destroyedHandles=new WeakSet();
      const transitionControls=[keepButton,mergeButton,appendButton,importButton,customButton,previous,next,apply,retry];
      const setTransitionBusy=busy=>{transitionBusy=!!busy;for(const control of transitionControls)control.disabled=!!busy;};
      const destroyHandles=async(handles,scope)=>{for(const handle of handles){if(!handle||destroyedHandles.has(handle))continue;destroyedHandles.add(handle);ownedHandles.delete(handle);try{await handle.destroy();}catch(error){diagnostics.capture(scope,error,'warn');}}};
      let resolvePromise;
      const promise=new Promise(resolve=>{resolvePromise=resolve});
      const finish=async result=>{
        if(settled)return;settled=true;generation++;setTransitionBusy(true);
        if(frame)view.cancelAnimationFrame(frame);frame=0;
        if(abortHandler&&options.signal)options.signal.removeEventListener?.('abort',abortHandler);abortHandler=null;localPane.field.oninput=null;
        const closing=[...ownedHandles];leftHandle=rightHandle=null;
        await destroyHandles(closing,'reconciliation-ui.destroy');
        dialog.remove();active=null;
        if(restoreFocus&&document.contains?.(restoreFocus)){try{restoreFocus.focus({preventScroll:true});}catch(error){diagnostics.capture('reconciliation-ui.focus',error,'warn');}}
        resolvePromise(result);
      };
      active={cancel:()=>finish(null)};
      const comparisonSummary=comparison=>{const incomingOnly=comparison.incomingOnly.length,localOnly=comparison.localOnly.length,changed=comparison.correspondences.filter(item=>item.kind==='fuzzy'||!item.formatEqual).length;const parts=[];if(incomingOnly)parts.push(`${incomingOnly} imported addition${incomingOnly===1?'':'s'}`);if(localOnly)parts.push(`${localOnly} local-only part${localOnly===1?'':'s'}`);if(changed)parts.push(`${changed} changed match${changed===1?'':'es'}`);return parts.length?parts.join(' · '):'No remaining textual differences detected.';};
      const updateComparison=()=>{if(settled||!leftHandle||!rightHandle)return;try{const comparison=richText.compareRichText(leftHandle.getValue(),rightHandle.getValue());leftHandle.setTransientRanges(comparison.localRanges);rightHandle.setTransientRanges(comparison.incomingRanges);diffStatus.textContent=comparisonSummary(comparison);}catch(error){leftHandle.setTransientRanges([]);rightHandle.setTransientRanges([]);diffStatus.textContent='Differences could not be calculated for the current scratch edit.';diagnostics.capture('reconciliation-ui.compare',error,'warn');}};
      const scheduleComparison=()=>{if(frame)view.cancelAnimationFrame(frame);frame=view.requestAnimationFrame(()=>{frame=0;updateComparison()})};
      const saveScratch=()=>{const state=states[index];if(!state||!leftHandle)return;state.working=leftHandle.getValue();};
      const markEdited=()=>{const state=states[index];if(state)state.applied=false;scheduleComparison()};
      async function mountCurrent(nextIndex){
        if(settled||transitionBusy)return;
        const token=++generation;setTransitionBusy(true);retry.hidden=true;
        let mountedLeft=null,mountedRight=null;
        try{
          saveScratch();localPane.field.oninput=null;
          const previousHandles=[leftHandle,rightHandle];leftHandle=rightHandle=null;
          await destroyHandles(previousHandles,'reconciliation-ui.transition-destroy');
          if(settled||token!==generation)return;
          index=Math.max(0,Math.min(states.length-1,nextIndex));const state=states[index],conflict=state.conflict;
          title.textContent=conflict.label;progress.textContent=version?'':`Difference ${index+1} of ${states.length}`;localPane.sub.textContent='Editable working copy · this is what will be saved';incomingPane.sub.textContent=conflict.incomingLabel+' · read-only reference';
          localPane.field.value=state.working;incomingPane.field.value=state.incoming;apply.textContent=version?'Save note':manualOnly?(states.length===1?'Apply reflection':(state.applied?'Re-apply reflection':'Apply reflection')):(states.length===1?'Apply resolved note':(state.applied?'Re-apply resolved note':'Apply resolved note'));
          const mountOptions=(field,label,value,assetStore,readOnly=false)=>freeze({field,label,initialValue:value,maxWords:configuration.maxWords,maxBytes:configuration.maxBytes,assets:assetStore,surface:'reconciliation',focusOnMount:false,allowAssetInsert:false,readOnly});
          // Keep ownership of a successful sibling even when its peer rejects.
          const mount=options=>Promise.resolve().then(()=>richText.mountRichTextEditor(options)).then(async handle=>{
            ownedHandles.add(handle);
            if(settled||token!==generation){await destroyHandles([handle],'reconciliation-ui.stale-mount');return null;}
            return handle;
          });
          const results=await Promise.allSettled([
            mount(mountOptions(localPane.field,manualOnly?'Resolved Diary Reflection':'Resolved Ongoing Note',state.working,localScratchAssets,false)),
            mount(mountOptions(incomingPane.field,manualOnly?'Imported Diary Reflection':'Imported Ongoing Note',state.incoming,incomingScratchAssets,true))
          ]);
          mountedLeft=results[0].status==='fulfilled'?results[0].value:null;mountedRight=results[1].status==='fulfilled'?results[1].value:null;
          const failure=results.find(result=>result.status==='rejected');if(failure)throw failure.reason;
          if(settled||token!==generation){await destroyHandles([mountedLeft,mountedRight],'reconciliation-ui.stale-mount');return;}
          leftHandle=mountedLeft;rightHandle=mountedRight;localPane.field.oninput=markEdited;
          setTransitionBusy(false);previous.disabled=index===0;next.disabled=index===states.length-1;scheduleComparison();
        }catch(error){
          await destroyHandles([mountedLeft,mountedRight],'reconciliation-ui.mount-cleanup');
          diagnostics.capture('reconciliation-ui.mount',error,'error');
          if(settled||token!==generation)return;
          setTransitionBusy(true);transitionBusy=false;retry.hidden=false;retry.disabled=false;
          diffStatus.textContent='The comparison editors could not be opened. Your working copies are preserved. Retry or cancel this review.';
          retry.focus?.({preventScroll:true});
        }
      }
      const setLeft=value=>{if(leftHandle&&!leftHandle.setValue(String(value??'')))throw new Error('Resolved note could not be loaded into the scratch editor.');scheduleComparison();};
      keepButton.addEventListener('click',()=>{setLeft(states[index].conflict.localValue)});
      mergeButton.addEventListener('click',()=>{try{const state=states[index],value=state.smartValue===null?richText.mergeIncomingAdditions(state.conflict.localValue,state.incoming).value:state.smartValue;setLeft(value)}catch(error){diagnostics.capture('reconciliation-ui.merge',error,'warn');diffStatus.textContent='Smart merge could not be prepared. You can still edit the resolved copy manually.';}});
      appendButton.addEventListener('click',()=>{try{setLeft(richText.appendIncomingAdditions(leftHandle.getValue(),rightHandle.getValue()).value)}catch(error){diagnostics.capture('reconciliation-ui.append',error,'warn');diffStatus.textContent='Imported additions could not be appended automatically. You can still edit the resolved copy manually.';}});
      importButton.addEventListener('click',()=>setLeft(states[index].incoming));
      customButton.addEventListener('click',()=>{if(leftHandle){leftHandle.focus?.();localPane.field.focus?.();}diffStatus.textContent='Edit the resolved reflection, then apply it.';});
      retry.addEventListener('click',()=>{void mountCurrent(index)});
      previous.addEventListener('click',()=>{void mountCurrent(index-1)});next.addEventListener('click',()=>{void mountCurrent(index+1)});
      apply.addEventListener('click',()=>{const state=states[index];saveScratch();if(manualOnly&&state.conflict.requireContent&&!String(state.working||'').trim()){state.applied=false;if(frame)view.cancelAnimationFrame(frame);frame=0;diffStatus.textContent='A diary-only entry cannot be empty. Keep one copy or enter custom text.';return;}state.result=state.working;state.applied=true;const nextUnresolved=states.findIndex((item,position)=>position>index&&!item.applied);if(nextUnresolved>=0){void mountCurrent(nextUnresolved);return}const anyUnresolved=states.findIndex(item=>!item.applied);if(anyUnresolved>=0){void mountCurrent(anyUnresolved);return}void finish(resultFrom(states,automaticNotes));});
      cancel.addEventListener('click',()=>void finish(null));
      dialog.addEventListener('cancel',event=>{event.preventDefault();void finish(null)});
      dialog.addEventListener('close',()=>{if(!settled)void finish(null)});
      if(options.signal){if(options.signal.aborted){await finish(null);return promise;}abortHandler=()=>void finish(null);options.signal.addEventListener('abort',abortHandler,{once:true});}
      try{dialog.showModal();void mountCurrent(0);}catch(error){diagnostics.capture('reconciliation-ui.open',error,'error');await finish(null);}
      return promise;
    }
    return freeze({resolve,cancel:()=>active?.cancel()||false});
  }
  return freeze({format:'study-director.reconciliation-ui-module',contractVersion:1,createController});
});
})();
