(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
registry.define('asset-maintenance',1,input=>{
  registry.contracts.exactFrozenObject(input,['lifecycle'],'asset-maintenance module input');
  const Lifecycle=input.lifecycle;
  if(!Object.isFrozen(Lifecycle)||Lifecycle.format!=='study-director.operation-lifecycle'||Lifecycle.contractVersion!==1)throw new TypeError('Operation lifecycle contract is unavailable or incompatible.');
  const freeze=Object.freeze;
  const interrupted=reason=>Object.assign(new Error(`Attachment cleanup yielded: ${reason}`),{name:'AbortError',code:'ASSET_MAINTENANCE_YIELDED',reason});
  function create(ports,options={}){
    const required=['canMutate','mutationActive','collect','readRestoreJournal','readLibraryClearJournal','liveFields','getReferenceRevision','getDatasetRevision','scanReferences','readNotes','loadActiveSession','listDailyRecords','budget','yieldTask','invalidate','captureError'];
    if(!ports||required.some(key=>typeof ports[key]!=='function'))throw new TypeError('Asset-maintenance ports are incomplete.');
    const lease=options.lease;if(!lease||['protect','release','isProtected'].some(key=>typeof lease[key]!=='function'))throw new TypeError('Asset-maintenance storage lease is required.');
    const delayMs=Math.max(0,Number(options.delayMs??1800)||0),workMs=Math.max(1,Number(options.workMs)||5000),batchSize=Math.max(1,Number(options.batchSize)||128);
    const scheduleTimeout=ports.setTimeout||setTimeout,cancelTimeout=ports.clearTimeout||clearTimeout,now=ports.now||Date.now,diagnostics=ports.diagnostics;
    let rerunRequested=false,leaseRetryPending=false,scanState=null,sweepPending=false;
    const diagStart=details=>diagnostics?.start?.('asset-maintenance','Attachment storage',details)||'';
    const diagMark=(...args)=>diagnostics?.mark?.(...args),diagFinish=(...args)=>diagnostics?.finish?.(...args),diagFail=(...args)=>diagnostics?.fail?.(...args);
    const liveSnapshot=()=>ports.liveFields().map(field=>[field,String(field.value??'')]);
    const liveChanged=values=>values.some(([field,value])=>!field?.isConnected||String(field.value??'')!==value);
    function collectInto(references,value){const scan=ports.scanReferences(String(value??''));for(const id of scan.assetIds||[])references.add(id);return scan.trusted===true;}
    async function referencedAssetIds(keys,proof,liveValues,check){
      const signature=JSON.stringify([proof,keys,liveValues.map(([,value])=>value)]);
      if(!scanState||scanState.signature!==signature){scanState={signature,references:new Set(),phase:0,index:0,values:null};for(const [,value] of liveValues)if(!collectInto(scanState.references,value))return {references:scanState.references,trusted:false};}
      const state=scanState,complete=()=>keys.length>0&&keys.every(id=>state.references.has(id));let units=0;const shouldYield=ports.budget();
      while(state.phase<3&&!complete()){
        check();
        if(!state.values){
          if(state.phase===0)state.values=Object.values(await ports.readNotes()||{}).map(entry=>entry?.text);
          else if(state.phase===1){const loaded=await ports.loadActiveSession();if(loaded?.ok!==true||loaded.error)throw loaded?.error||new Error('Active Session references could not be read completely.');state.values=[loaded?.value?.snapshot?.review?.reflection];}
          else state.values=(await ports.listDailyRecords()||[]).map(record=>record?.reflection);
          check();
        }
        while(state.index<state.values.length){
          check();if(units>=batchSize)throw interrupted('budget');
          if(!collectInto(state.references,state.values[state.index])){scanState=null;return {references:state.references,trusted:false};}
          state.index++;units++;if(complete())break;if(shouldYield())await ports.yieldTask({priority:'background'});
        }
        if(complete())break;state.phase++;state.index=0;state.values=null;
      }
      return {references:state.references,trusted:true};
    }
    function schedule(delay=delayMs,trigger='requested'){
      if(job.status().busy)rerunRequested=true;
      return job.schedule(Math.max(0,Number(delay)||0),trigger);
    }
    async function runAttempt({trigger:scheduledTrigger,nextEligibleAt:scheduledEligibleAt}){
      if(ports.mutationActive()){job.schedule(15000,'foreground-busy');return freeze({status:'skipped',reason:'mutation-active',removed:0});}
      const started=Number(now()),traceId=diagStart({background:true,trigger:scheduledTrigger,nextEligibleAt:scheduledEligibleAt,actionable:true});
      const check=()=>{if(!ports.canMutate())throw interrupted('not-primary');if(ports.mutationActive())throw interrupted('foreground-busy');if(Number(now())-started>=workMs)throw interrupted('budget');};
      diagMark('asset-maintenance-eligibility',{trigger:scheduledTrigger,nextEligibleAt:scheduledEligibleAt,actionable:true},traceId);
      let removedSoFar=0;
      return Promise.resolve().then(()=>ports.collect(async store=>{
        check();const journal=await ports.readRestoreJournal();check();if(journal?.state)return freeze({status:'skipped',reason:'restore-journal',removed:0});
        const libraryJournal=await ports.readLibraryClearJournal();check();if(libraryJournal?.state)return freeze({status:'skipped',reason:'library-clear-journal',removed:0});
        const liveValues=liveSnapshot(),referenceRevision=ports.getReferenceRevision(),sourceRevision=await ports.getDatasetRevision();check();
        if(sourceRevision===null)return freeze({status:'skipped',reason:'unverified-record-source',removed:0});
        const keys=await store.keys();check();
        const scan=keys.length?await referencedAssetIds(keys,[referenceRevision,sourceRevision],liveValues,check):{references:new Set(),trusted:true};
        if(!scan.trusted){scanState=null;return freeze({status:'skipped',reason:'uncertain-rich-text',assets:keys.length,references:scan.references.size,removed:0});}
        const latest=await ports.getDatasetRevision();check();
        if(referenceRevision!==ports.getReferenceRevision()||liveChanged(liveValues)||sourceRevision!==latest){scanState=null;throw interrupted('source-changed');}
        const safe=()=>{check();return referenceRevision===ports.getReferenceRevision()&&!liveChanged(liveValues);};
        const orphaned=keys.filter(id=>!scan.references.has(id)&&!lease.isProtected(id)),selected=orphaned.slice(0,batchSize);
        removedSoFar=selected.length?await store.removeMany(selected,safe):0;check();
        const swept=await store.sweep();check();sweepPending=store.status?.().sweepPending===true;
        const more=orphaned.length>selected.length||sweepPending||keys.some(id=>!scan.references.has(id)&&lease.isProtected(id));
        return freeze({status:more?'yielded':keys.length?'completed':'clean',reason:more?'continuation':'',assets:keys.length,references:scan.references.size,removed:removedSoFar,swept:Number(swept)||0});
      },{check,maxEntries:batchSize,yieldTask:()=>ports.yieldTask({priority:'background'})})).then(async result=>{
        if(Number(result?.removed)>0)ports.invalidate();
        if(['completed','clean'].includes(result?.status)){if(rerunRequested)result=freeze({...result,status:'yielded',reason:'source-changed'});else{await ports.completed?.(result);scanState=null;}}
        leaseRetryPending=result?.reason==='active-editor-or-file-operation';
        diagFinish({status:String(result?.status||'failed'),reason:String(result?.reason||''),removed:Number(result?.removed)||0},traceId);return result;
      }).catch(error=>{
        if(removedSoFar>0)ports.invalidate();leaseRetryPending=false;
        if(error?.code==='ASSET_MAINTENANCE_YIELDED'){const result=freeze({status:'yielded',reason:error.reason,removed:removedSoFar});diagFinish(result,traceId);return result;}
        scanState=null;ports.captureError(error);diagFail(error,{background:true},traceId);return freeze({status:'failed',removed:removedSoFar,reason:error?.message||String(error)});
      }).then(result=>{
        const rerun=rerunRequested;rerunRequested=false;
        if(result.status==='failed')job.schedule(30*60*1000,'error','replace');
        else if(result.reason==='not-primary'){/* Ownership return supplies the opportunity. */}
        else if(result.status==='yielded')job.schedule(result.reason==='foreground-busy'?15000:2000,result.reason);
        else if(result.status==='skipped'&&result.reason!=='storage-unavailable')job.schedule(60000,result.reason);
        else if(rerun)job.schedule(delayMs,'rerun-requested');
        return result;
      });
    }
    const job=Lifecycle.createJob({environment:{now,setTimeout:scheduleTimeout,clearTimeout:cancelTimeout},isAvailable:()=>!ports.canMutate()?'not-primary':ports.isAvailable?ports.isAvailable():true,execute:runAttempt,capture:ports.captureError,retryMs:30*60*1000});
    const settled=()=>Lifecycle.waitForSettlement(job.status().busy?[job.settled()]:[],{setTimeout:scheduleTimeout,clearTimeout:cancelTimeout,timeoutCode:'ASSET_MAINTENANCE_UNSETTLED',timeoutMessage:'Attachment cleanup has not stopped yet. Retry after it finishes.'});
    function leaseReleased(){if(!leaseRetryPending)return false;leaseRetryPending=false;return job.schedule(0,'lease-released','replace');}
    return freeze({format:'study-director.asset-maintenance',contractVersion:1,lease,run:()=>job.run(),schedule,wake:trigger=>job.wake(trigger),leaseReleased,settled,status:()=>freeze({...job.status(),sweepPending})});
  }
  return freeze({format:'study-director.asset-maintenance-module',contractVersion:2,create});
});
})();
