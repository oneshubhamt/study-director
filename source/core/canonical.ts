import type {PilotRegistry} from '../../types/pilot.ts';
(()=>{
'use strict';
// Narrow bridge to the unchanged JS registry; runtime identity is checked below.
const registry=(globalThis as typeof globalThis & {[key: symbol]: PilotRegistry | undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
registry.define('canonical',1,()=>{
  function value(input: unknown): unknown{
    if(Array.isArray(input))return input.map(value);
    if(input&&typeof input==='object')return Object.fromEntries(Object.keys(input).sort().map(key=>[key,value((input as Record<string, unknown>)[key])]));
    return input;
  }
  function signature(input: unknown){return JSON.stringify(value(input));}
  function same(a: unknown,b: unknown){return signature(a)===signature(b);}
  return Object.freeze({format:'study-director.canonical',contractVersion:1,signature,same});
});
})();
