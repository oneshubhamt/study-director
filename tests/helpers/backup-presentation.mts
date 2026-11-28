import {readRuntimeSource} from './runtime-source.mts';
import {method,registeredExports} from './registered-exports.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';
type NoticeOptions={now?:()=>number;setTimeout?:(fn:()=>void,ms:number)=>unknown;clearTimeout?:(handle:unknown)=>void;render?:(state:unknown)=>void;capture?:(scope:string,error:unknown)=>void;installationCooldownMs?:number};
export function createBackupPresentation(options:NoticeOptions={}){
  const registry:unknown=Reflect.get(globalThis,Symbol.for('studyDirector.internalModules.v1'));
  for(const name of ['notice-coordinator','backup-presentation']){
    const status=method(registry,'status')();
    assert.ok(status&&typeof status==='object'&&'modules' in status&&Array.isArray(status.modules));
    if(!status.modules.some((row:unknown)=>row&&typeof row==='object'&&'name' in row&&row.name===name))vm.runInThisContext(readRuntimeSource(`source/core/${name}.ts`),{filename:`source/core/${name}.ts`});
  }
  const notifications=method(registeredExports(globalThis,'notice-coordinator'),'createCoordinator')(Object.freeze({setTimeout:(fn:()=>void,ms:number)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},clearTimeout,...options}));
  return method(registeredExports(globalThis,'backup-presentation'),'createPresentation')(Object.freeze({notifications}));
}
