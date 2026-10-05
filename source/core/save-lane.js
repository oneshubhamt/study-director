(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject}=registry.contracts;
// The one save engine shared by Ongoing Notes, Diary reflections and the
// Review reflection. Each stored target gets a lane: an edit is written a
// moment after typing pauses, one write at a time, always with the latest
// value. A failed write keeps that value and retries after a growing pause
// until it is saved or replaced by a newer one. Where the data is stored, and
// how a clash with stored data is resolved, stay with the caller's write.
registry.define('save-lane',1,()=>{
  const freeze=Object.freeze;
  const DELAY_MS=250;
  const RETRY_DELAYS_MS=freeze([2000,5000,15000,30000,60000]);
  // Editors that group keystrokes publish them before any lane writes, so a
  // write always carries what is on screen.
  let beforeFlush=null,preparing=false;
  function onBeforeFlush(callback){if(typeof callback!=='function')throw new TypeError('Save lane flush preparation must be a function.');beforeFlush=callback;}
  function prepareFlush(){if(!beforeFlush||preparing)return;preparing=true;try{beforeFlush();}catch{}finally{preparing=false;}}
  function reasonOf(error){return String(error&&error.message||error||'storage is unavailable').replace(/[.\s]+$/u,'');}
  // The same wording for every lane while a retry is pending.
  function failureMessage(label,error){return `${label} could not be saved: ${reasonOf(error)}. Study Director keeps retrying; keep this tab open or export a backup.`;}
  function createLane(input){
    exactObject(input,['label','write','onState','environment'],'Save lane input');
    const environment=exactObject(input.environment,['setTimeout','clearTimeout'],'Save lane environment');
    if(typeof input.write!=='function'||typeof input.onState!=='function'||typeof environment.setTimeout!=='function'||typeof environment.clearTimeout!=='function')throw new TypeError('Save lane ports are invalid.');
    const label=String(input.label||'Changes'),write=input.write,onState=input.onState,{setTimeout,clearTimeout}=environment;
    let timer=0,pending=false,value,sequence=0,tail=Promise.resolve(),attempt=0,lastError=null,writing=0;
    function arm(delay){if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=0;void flush().catch(()=>{});},delay);}
    function report(state,error=null){try{onState(state,error);}catch{}}
    // Records the latest value and saves it once typing pauses.
    function schedule(next){value=next;pending=true;sequence++;attempt=0;arm(DELAY_MS);report('saving');return true;}
    // Writes the pending value now; resolves when this lane has written it.
    function flush(options={}){
      prepareFlush();
      if(timer){clearTimeout(timer);timer=0;}
      if(!pending)return tail;
      const current=value,taken=sequence;pending=false;value=undefined;writing++;
      tail=tail.catch(()=>{}).then(()=>write(current,options)).then(result=>{
        writing--;lastError=null;attempt=0;if(!pending&&!writing)report('saved');return result;
      },error=>{
        writing--;lastError=error;
        // Retry this value only if nothing newer was scheduled since.
        if(!pending&&sequence===taken){pending=true;value=current;}
        arm(RETRY_DELAYS_MS[Math.min(attempt,RETRY_DELAYS_MS.length-1)]);attempt++;
        report('error',error);throw error;
      });
      return tail;
    }
    function cancel(){if(timer)clearTimeout(timer);timer=0;pending=false;value=undefined;attempt=0;}
    return freeze({
      schedule,flush,cancel,
      pending:()=>pending,writing:()=>writing>0,
      tail:()=>tail,settled:()=>tail.then(()=>true,()=>false),
      failure:()=>lastError?freeze({error:lastError,message:failureMessage(label,lastError)}):null
    });
  }
  return freeze({format:'study-director.save-lane-module',contractVersion:1,DELAY_MS,RETRY_DELAYS_MS,createLane,failureMessage,onBeforeFlush,prepareFlush});
});
})();
