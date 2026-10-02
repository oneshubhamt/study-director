(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
registry.define('canonical',1,()=>{
  function value(input){
    if(Array.isArray(input))return input.map(value);
    if(input&&typeof input==='object')return Object.fromEntries(Object.keys(input).sort().map(key=>[key,value(input[key])]));
    return input;
  }
  function signature(input){return JSON.stringify(value(input));}
  function same(a,b){return signature(a)===signature(b);}
  return Object.freeze({format:'study-director.canonical',contractVersion:1,signature,same});
});
})();
