import {readRuntimeSource} from './runtime-source.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
export function createNotifications(source='test',options={}){
  const key=Symbol.for('studyDirector.internalModules.v1');
  if(!globalThis[key])vm.runInThisContext(readRuntimeSource('source/core/internal.ts'),{filename:'source/core/internal.ts'});
  const registry=globalThis[key];
  if(!registry.status().modules.some(row=>row.name==='notice-coordinator'))vm.runInThisContext(readRuntimeSource('source/core/notice-coordinator.ts'),{filename:'source/core/notice-coordinator.ts'});
  const coordinator=registry.require('notice-coordinator',1).createCoordinator(Object.freeze({setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},clearTimeout,...options}));
  return {coordinator,port:coordinator.presentation(source)};
}
