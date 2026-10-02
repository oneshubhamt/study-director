import fs from 'node:fs';
import vm from 'node:vm';
export function createNotifications(source='test',options={}){
  const key=Symbol.for('studyDirector.internalModules.v1');
  if(!globalThis[key])vm.runInThisContext(fs.readFileSync('source/core/internal.js','utf8'),{filename:'source/core/internal.js'});
  const registry=globalThis[key];
  if(!registry.status().modules.some(row=>row.name==='notice-coordinator'))vm.runInThisContext(fs.readFileSync('source/core/notice-coordinator.js','utf8'),{filename:'source/core/notice-coordinator.js'});
  const coordinator=registry.require('notice-coordinator',1).createCoordinator(Object.freeze({setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},clearTimeout,...options}));
  return {coordinator,port:coordinator.presentation(source)};
}
