// Runtime registry accepts untyped classic-script producers too. Validate unknown
// values here; typed consumers use the closed module maps in types/*registry.ts.
interface InternalRecord {contractVersion:number;factory:(input:unknown)=>unknown;exports:(object & {format?:unknown;contractVersion?:unknown})|null}
(()=>{
'use strict';
const key=Symbol.for('studyDirector.internalModules.v1');
if(Object.prototype.hasOwnProperty.call(globalThis,key)){
  throw new Error('Study Director internal module registry is already installed.');
}
const records=new Map<string,InternalRecord>();
const freeze=Object.freeze;
let locked=false;
function validName(value:unknown){return /^[a-z][a-z0-9.-]*$/.test(String(value||''));}
function validVersion(value:unknown):value is number{return typeof value==='number'&&Number.isInteger(value)&&value>0;}
function exactFrozenObject<T>(value:T,keys:readonly string[],label:string){
  const actual=value&&typeof value==='object'?Object.keys(value).sort():[];
  const expected=[...keys].sort();
  if(!value||!Object.isFrozen(value)||actual.join('|')!==expected.join('|'))throw new TypeError(label+' is incomplete, mutable, or contains unexpected fields.');
  return value;
}
function functionPort<T>(value:T,keys:readonly string[],label:string){
  exactFrozenObject(value,keys,label);
  if(keys.some(key=>typeof (value as Record<string,unknown>)[key]!=='function'))throw new TypeError(label+' must contain functions only.');
  return value;
}
function declaredFunctions<T>(value:T,keys:readonly string[],label:string){
  if(keys.some(key=>typeof (value as Record<string,unknown>)[key]!=='function'))throw new TypeError(label+' must contain the declared functions.');
  return value;
}
function define(name:string,contractVersion:number,factory:unknown){
  if(locked)throw new Error('Study Director internal module registry is locked.');
  if(!validName(name))throw new TypeError('Internal module name is invalid.');
  if(!validVersion(contractVersion))throw new TypeError('Internal module contract version is invalid.');
  if(typeof factory!=='function')throw new TypeError('Internal module factory must be a function.');
  if(records.has(name))throw new Error('Internal module is already defined: '+name);
  records.set(name,{contractVersion,factory:factory as (input:unknown)=>unknown,exports:null});
  return true;
}
function requireModule(name:string,contractVersion:number,input?:unknown){
  const record=records.get(name);
  if(!record)throw new Error('Required internal module is unavailable: '+name);
  if(record.contractVersion!==contractVersion){
    throw new Error('Internal module contract mismatch for '+name+'.');
  }
  if(record.exports===null){
    if(input!==undefined&&!Object.isFrozen(input)){
      throw new TypeError('Internal module factory input must be frozen.');
    }
    const created=record.factory(input);
    if((typeof created!=='object'||created===null)&&typeof created!=='function'){
      throw new TypeError('Internal module factory returned no exports: '+name);
    }
    record.exports=Object.isFrozen(created)?created:freeze(created);
  }
  return record.exports;
}
function load(name:string,registryVersion:number,format:string,contractVersion:number,input?:unknown){
  if(typeof format!=='string'||!format)throw new TypeError('Internal module export format is invalid.');
  if(!validVersion(contractVersion))throw new TypeError('Internal module export contract version is invalid.');
  const exported=requireModule(name,registryVersion,input);
  if(exported?.format!==format||exported?.contractVersion!==contractVersion){
    throw new Error('Internal module export contract mismatch for '+name+'.');
  }
  return exported;
}
function status(){
  return freeze({
    format:'study-director.internal-module-status',
    version:1,
    locked,
    modules:freeze([...records.entries()].map(([name,record])=>freeze({
      name,
      contractVersion:record.contractVersion,
      initialized:record.exports!==null
    })))
  });
}
function lock(){locked=true;return status();}
const contracts=freeze({exactFrozenObject,functionPort,declaredFunctions});
const registry=freeze({
  format:'study-director.internal-module-registry',
  version:1,
  contracts,
  define,
  require:requireModule,
  load,
  lock,
  status
});
Object.defineProperty(globalThis,key,{value:registry,writable:false,enumerable:false,configurable:false});
})();
