import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {ReviewHostInput,ReviewHostModule as ReviewHostContract} from '../../types/review-host.ts';

const sdReviewHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'review-host','study-director.review-host-module'>|undefined;
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
const freeze=Object.freeze;

function objectRecord(value:unknown):value is Record<string,unknown>{
  return !!value&&typeof value==='object'&&!Array.isArray(value);
}
function exactObject(value:unknown,keys:readonly string[],label:string):asserts value is Record<string,unknown>{
  if(!objectRecord(value))throw new TypeError(`${label} must be an object.`);
  const actual=Object.keys(value).sort(),expected=[...keys].sort();
  if(actual.length!==expected.length||actual.some((key,index)=>key!==expected[index]))throw new TypeError(`${label} is incomplete or contains unexpected fields.`);
}
function createSubsystem(input:Readonly<ReviewHostInput>){
  exactObject(input,['module','subsystem'],'Review host input');
  if(input.module.format!=='study-director.review'||input.module.contractVersion!==1)throw new TypeError('Review module is unavailable or incompatible.');
  if(!Object.isFrozen(input.subsystem))throw new TypeError('Review subsystem composition must be frozen.');
  const subsystem=input.module.createReviewSubsystem(input.subsystem);
  if(!Object.isFrozen(subsystem)||subsystem.format!=='study-director.review-subsystem'||subsystem.contractVersion!==1){
    throw new TypeError('Study Director Review subsystem is unavailable or incompatible.');
  }
  return subsystem;
}
const createModule=():ReviewHostContract=>freeze({format:'study-director.review-host-module',contractVersion:1,createSubsystem});
registry.define('review-host',1,createModule);
return createModule;
})();
export type ReviewHostModule=ReturnType<typeof sdReviewHostFactory>;
