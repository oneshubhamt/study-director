import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readScript} from '../../../build/source-script.mts';
import type {PilotRegistry} from '../../../types/pilot.ts';

// The typed bridge must retain the original rejection of absent/incompatible registries.
for(const file of ['source/core/canonical.ts','source/core/save-lane.ts']){
  for(const seed of ['', "globalThis[Symbol.for('studyDirector.internalModules.v1')]={format:'wrong',version:1};", "globalThis[Symbol.for('studyDirector.internalModules.v1')]={format:'study-director.internal-module-registry',version:2};"]){
    const rejected=vm.createContext({});vm.runInContext(seed,rejected);
    assert.throws(()=>vm.runInContext(readScript(file),rejected,{filename:file}),/registry is unavailable or incompatible/);
  }
}
const context=vm.createContext({});
for(const file of ['source/core/internal.ts','source/core/canonical.ts']){
  vm.runInContext(readScript(file),context,{filename:file});
}
// The VM executes the real JS registry and checked canonical implementation.
const registry=vm.runInContext("globalThis[Symbol.for('studyDirector.internalModules.v1')]",context) as PilotRegistry;
const canonical=registry.load('canonical',1,'study-director.canonical',1);
const original={z:[{z:1,a:2},null],a:{b:false,a:'text'}};
const copy=structuredClone(original);
assert.equal(canonical.signature(original),'{"a":{"a":"text","b":false},"z":[{"a":2,"z":1},null]}');
assert.deepEqual(original,copy,'canonical comparison never mutates input');
assert.equal(canonical.same({b:2,a:1},{a:1,b:2}),true);
assert.equal(canonical.same([1,2],[2,1]),false,'array order is significant');
assert.equal(canonical.signature(undefined),undefined);
assert.equal(canonical.signature([undefined,NaN,Infinity]),'[null,null,null]');
assert.equal(canonical.signature({absent:undefined}), '{}');
assert.equal(canonical.signature(new Date(0)), '{}','preserve current enumerable-property semantics');
assert.equal(canonical.signature(-0),'0');
assert.throws(()=>canonical.signature(1n),/BigInt/);
const cyclic: {self?: unknown}={};cyclic.self=cyclic;
assert.throws(()=>canonical.signature(cyclic),/call stack/);
assert.ok(Object.isFrozen(canonical));
console.log(JSON.stringify({status:'PASS',suite:'canonical',unchangedInput:true,orderedArrays:true,jsonSemantics:true}));
