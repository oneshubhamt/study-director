import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const REGISTRY='studyDirector.profiles.v1',SEPARATOR='~',KEY=Symbol.for('studyDirector.profileScope.v1');
const source=readRuntimeSource('source/host/profile-scope.ts')
  .replaceAll('@@SD_PROFILES_STORAGE_KEY@@',REGISTRY)
  .replaceAll('@@SD_PROFILE_SCOPE_SEPARATOR@@',SEPARATOR);
const idA='prof_ana_mve00000_abcdef01',idB='prof_ben_mve00000_abcdef02';
function run(value,existing=null){
  const store=new Map(value===undefined?[]:[[REGISTRY,typeof value==='string'?value:JSON.stringify(value)]]);
  const context=vm.createContext({Object,Array,String,Number,JSON,Symbol,RegExp,Map,localStorage:{getItem:key=>store.get(key)??null}});
  context.window=context;context.globalThis=context;
  if(existing)Object.defineProperty(context,KEY,{value:existing,writable:false,configurable:false});
  vm.runInContext(source,context,{filename:'source/host/profile-scope.ts'});
  return context[KEY];
}
{
  const scope=run({version:1,active:idB,profiles:[{id:idA,scope:''},{id:idB,scope:idB}]});
  assert.equal(scope.id,idB);assert.equal(scope.scope,idB);assert.equal(scope.safe,true);assert.equal(scope.scoped('db'),'db~'+idB);
}
{
  const scope=run({version:9,active:'missing',profiles:[{id:idA,scope:''},{id:'bad',scope:idB}]});
  assert.equal(scope.id,idA,'a readable newer registry still resolves the first valid profile');
  assert.equal(scope.scope,'');assert.equal(scope.safe,true);assert.equal(scope.scoped('db'),'db');
}
{
  const scope=run({version:1,active:'missing',profiles:[{id:idA,scope:''}]});
  assert.equal(scope.safe,false,'the current schema never guesses a different active profile when its active pointer is invalid');
  assert.equal(scope.scope,'__profile-registry-unreadable__');
}
{
  const absent=run(undefined);
  assert.equal(absent.id,'');assert.equal(absent.scope,'');assert.equal(absent.safe,true,'an absent registry is a genuine first-start state');
  for(const value of ['{bad json',{version:1,active:'bad',profiles:[{id:'bad',scope:''}]},{version:1,active:'',profiles:[]}]){
    const scope=run(value);
    assert.equal(scope.id,'');assert.equal(scope.safe,false,'a present registry that cannot resolve a profile must fail closed');assert.equal(scope.scope,'__profile-registry-unreadable__');assert.equal(scope.scoped('db'),'db~__profile-registry-unreadable__','unsafe startup is quarantined away from the unscoped first-profile namespace');
  }
}
{
  const existing=Object.freeze({sentinel:true}),scope=run({version:1,active:idA,profiles:[{id:idA,scope:''}]},existing);
  assert.equal(scope,existing,'the bootstrap never replaces an already-installed scope identity');
}
console.log(JSON.stringify({status:'PASS',suite:'profile-scope',cases:['active scoped profile','newer registry fallback','current active pointer fails closed','absent registry','malformed registry fails closed','existing identity preserved']},null,2));
