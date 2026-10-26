import type {PilotRegistry, LaneInput, FlushOptions, SaveState} from '../../types/pilot.ts';
(()=>{
'use strict';
// Narrow bridge to the unchanged JS registry; runtime identity is checked below.
const registry=(globalThis as typeof globalThis & {[key: symbol]: PilotRegistry | undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject}=registry.contracts;
// The one save engine shared by notes, Diary reflections and the
// Review reflection. Each stored target gets a lane: the first edit after a
// quiet moment is written at once, and while typing continues the latest value
// is written again every DELAY_MS, one write at a time. What a crash can lose
// is therefore bounded by DELAY_MS plus one write. A failed write keeps its
// value and retries after a growing pause until it is saved or replaced by a
// newer one. Where the data is stored, and how a clash with stored data is
// resolved, stay with the caller's write.
registry.define('save-lane',1,()=>{
  const freeze=Object.freeze;
  const DELAY_MS=250;
  const RETRY_DELAYS_MS=freeze([2000,5000,15000,30000,60000] as const);
  // Editors that group keystrokes publish them before any lane writes, so a
  // write always carries what is on screen.
  let beforeFlush: (()=>void) | null=null,preparing=false;
  function onBeforeFlush(callback: ()=>void){if(typeof callback!=='function')throw new TypeError('Save lane flush preparation must be a function.');beforeFlush=callback;}
  function prepareFlush(){if(!beforeFlush||preparing)return;preparing=true;try{beforeFlush();}catch{}finally{preparing=false;}}
  function reasonOf(error: unknown){return String(error&&(error as {readonly message?: unknown}).message||error||'storage is unavailable').replace(/[.\s]+$/u,'');}
  // The same wording for every lane while a retry is pending.
  function failureMessage(label: string,error: unknown){return `${label} could not be saved: ${reasonOf(error)}. Study Director keeps retrying; keep this tab open or export a backup.`;}
  function createLane<T, R>(input: Readonly<LaneInput<T, R>>){
    exactObject(input,['label','write','onState','environment'],'Save lane input');
    const environment=exactObject(input.environment,['setTimeout','clearTimeout'],'Save lane environment');
    if(typeof input.write!=='function'||typeof input.onState!=='function'||typeof environment.setTimeout!=='function'||typeof environment.clearTimeout!=='function')throw new TypeError('Save lane ports are invalid.');
    const label=String(input.label||'Changes'),write=input.write,onState=input.onState,{setTimeout,clearTimeout}=environment;
    // timer: the next automatic write (now, or after a failed write's pause).
    // cooling: the pause after a write starts, during which new values wait.
    let timer=0,cooling=0,pending=false,value: T | undefined,sequence=0,tail: Promise<R | void>=Promise.resolve(),attempt=0,lastError: unknown=null,writing=0;
    function arm(delay: number){if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=0;void flush().catch(()=>{});},delay);}
    function report(state: SaveState,error: unknown=null){try{onState(state,error);}catch{}}
    // Starts the next automatic write when nothing holds it back.
    function wake(){if(pending&&!writing&&!cooling&&!timer)arm(0);}
    // Records the latest value. A newer value ends a failed write's retry pause.
    function schedule(next: T){
      value=next;pending=true;sequence++;
      if(attempt){attempt=0;if(timer){clearTimeout(timer);timer=0;}}
      wake();report('saving');return true;
    }
    // Writes the pending value now; resolves when this lane has written it.
    function flush(options: FlushOptions={}){
      prepareFlush();
      if(timer){clearTimeout(timer);timer=0;}
      if(!pending)return tail;
      // pending is set only by schedule or retry, both of which retain a T.
      const current=value as T,taken=sequence;pending=false;value=undefined;writing++;
      if(cooling)clearTimeout(cooling);
      cooling=setTimeout(()=>{cooling=0;wake();},DELAY_MS);
      tail=tail.catch(()=>{}).then(()=>write(current,options)).then(result=>{
        writing--;lastError=null;attempt=0;
        if(!pending&&!writing)report('saved');else wake();
        return result;
      },(error: unknown)=>{
        writing--;lastError=error;
        // Only a value nothing has replaced is retried after a pause. A newer
        // value keeps its own timing.
        // attempt starts at zero and increments; this index is clamped to the nonempty tuple.
        if(sequence===taken){pending=true;value=current;arm(RETRY_DELAYS_MS[Math.min(attempt,RETRY_DELAYS_MS.length-1)]!);attempt++;}
        else wake();
        report('error',error);throw error;
      });
      return tail;
    }
    // Drops the pending value; a write already running is not retried.
    function cancel(){if(timer)clearTimeout(timer);if(cooling)clearTimeout(cooling);timer=0;cooling=0;pending=false;value=undefined;attempt=0;sequence++;}
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
