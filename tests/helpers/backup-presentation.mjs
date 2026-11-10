import {readRuntimeSource} from './runtime-source.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
export function createBackupPresentation(options={}){
  const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
  for(const name of ['notice-coordinator','backup-presentation'])if(!registry.status().modules.some(row=>row.name===name))vm.runInThisContext(readRuntimeSource(`source/core/${name}.ts`),{filename:`source/core/${name}.ts`});
  const notifications=registry.require('notice-coordinator',1).createCoordinator(Object.freeze({setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},clearTimeout,...options}));
  return registry.require('backup-presentation',1).createPresentation(Object.freeze({notifications}));
}
