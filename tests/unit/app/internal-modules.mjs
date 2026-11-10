import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

vm.runInThisContext(readRuntimeSource('source/core/internal.ts'),{filename:'source/core/internal.ts'});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
assert.ok(Object.isFrozen(registry));
assert.equal(registry.format,'study-director.internal-module-registry');
assert.equal(registry.version,1);
assert.ok(Object.isFrozen(registry.contracts));

const {exactFrozenObject,functionPort,declaredFunctions}=registry.contracts;
const exact=Object.freeze({one:1,two:2});
assert.equal(exactFrozenObject(exact,['two','one'],'Exact contract'),exact);
assert.throws(()=>exactFrozenObject({one:1,two:2},['one','two'],'Exact contract'),/incomplete, mutable, or contains unexpected fields/u);
assert.throws(()=>exactFrozenObject(Object.freeze({one:1,two:2,three:3}),['one','two'],'Exact contract'),/incomplete, mutable, or contains unexpected fields/u);

const functions=Object.freeze({read:()=>1,write:()=>2});
assert.equal(functionPort(functions,['read','write'],'Function port'),functions);
assert.throws(()=>functionPort(Object.freeze({read:()=>1,write:2}),['read','write'],'Function port'),/functions only/u);
const extensible={read:()=>1,extra:true};
assert.equal(declaredFunctions(extensible,['read'],'Declared functions'),extensible,'declaredFunctions must intentionally allow additional fields and mutable objects');
assert.throws(()=>declaredFunctions({read:false},['read'],'Declared functions'),/declared functions/u);

const input=Object.freeze({token:'qa'});
registry.define('qa-contract',2,received=>Object.freeze({format:'study-director.qa-contract',contractVersion:3,received}));
const loaded=registry.load('qa-contract',2,'study-director.qa-contract',3,input);
assert.equal(loaded.received,input);
assert.throws(()=>registry.load('qa-contract',1,'study-director.qa-contract',3),/contract mismatch for qa-contract/u);
assert.throws(()=>registry.load('qa-contract',2,'study-director.wrong',3),/export contract mismatch for qa-contract/u);
assert.throws(()=>registry.load('qa-contract',2,'study-director.qa-contract',2),/export contract mismatch for qa-contract/u);

registry.define('qa-bad-export',1,()=>Object.freeze({ready:true}));
assert.throws(()=>registry.load('qa-bad-export',1,'study-director.qa-bad-export',1),/export contract mismatch for qa-bad-export/u);

console.log(JSON.stringify({status:'PASS',contract:'internal-module-registry',validatedLoader:true,sharedContracts:['exactFrozenObject','functionPort','declaredFunctions']},null,2));
