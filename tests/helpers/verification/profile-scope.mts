import {readRuntimeSource} from '../../helpers/runtime-source.mts';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const REGISTRY='studyDirector.profiles.v1',SEPARATOR='~',KEY=Symbol.for('studyDirector.profileScope.v1');
const source=readRuntimeSource('source/host/profile-scope.ts')
  .replaceAll('@@SD_PROFILES_STORAGE_KEY@@',REGISTRY)
  .replaceAll('@@SD_PROFILE_SCOPE_SEPARATOR@@',SEPARATOR);
const idA='prof_ana_mve00000_abcdef01',idB='prof_ben_mve00000_abcdef02';
type Scope={id:string;scope:string;safe:boolean;scoped:(name:unknown)=>string};
function run(value:unknown):Scope;
function run<T extends object>(value:unknown,existing:T):T;
function run(value:unknown,existing:object|null=null):unknown{
  const store=new Map(value===undefined?[]:[[REGISTRY,typeof value==='string'?value:JSON.stringify(value)]]);
  const context=vm.createContext({Object,Array,String,Number,JSON,Symbol,RegExp,Map,localStorage:{getItem:(key:string)=>store.get(key)??null}});
  context['window']=context;context['globalThis']=context;
  if(existing)Object.defineProperty(context,KEY,{value:existing,writable:false,configurable:false});
  vm.runInContext(source,context,{filename:'source/host/profile-scope.ts'});
  const result:unknown=Reflect.get(context,KEY);
  if(!existing){
    assert.ok(result&&typeof result==='object'&&'id' in result&&typeof result.id==='string'&&'scope' in result&&typeof result.scope==='string'&&'safe' in result&&typeof result.safe==='boolean'&&'scoped' in result&&typeof result.scoped==='function');
  }
  return result;
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
  const rows=Array.from({length:12},(_,index)=>({id:`prof_row${index}_mve00000_${String(index+1).padStart(8,'0')}`,scope:`prof_scope${index}_mve00000_${String(index+101).padStart(8,'0')}`}));
  const lateId='prof_late_mve00000_0000abcd',lateScope='prof_latescope_mve00000_0000abce';
  const currentLate=run({version:1,active:lateId,profiles:[...rows,{id:lateId,scope:lateScope}]});
  assert.equal(currentLate.safe,false,'current-schema bootstrap cannot resolve an active profile outside the canonical 12-row registry window');
  const newerLate=run({version:9,active:lateId,profiles:[...rows,{id:lateId,scope:lateScope}]});
  assert.equal(newerLate.safe,true,'newer readable registries retain first-known fallback inside the canonical row window');
  assert.equal(newerLate.id,rows[0]!.id);assert.equal(newerLate.scope,rows[0]!.scope);
}

{
  const duplicateScope=run({version:1,active:idA,profiles:[{id:idA,scope:''},{id:idB,scope:''}]});
  assert.equal(duplicateScope.safe,false,'two valid profiles cannot share the selected storage scope');
  assert.equal(duplicateScope.scope,'__profile-registry-unreadable__');
  const duplicateId=run({version:1,active:idA,profiles:[{id:idA,scope:''},{id:idA,scope:idB}]});
  assert.equal(duplicateId.safe,false,'a duplicated selected profile id is ambiguous even when both rows are otherwise valid');
  const newerAmbiguous=run({version:9,active:'missing',profiles:[{id:idA,scope:''},{id:idB,scope:''}]});
  assert.equal(newerAmbiguous.safe,false,'newer-registry fallback must still resolve one unique storage namespace');
  const newerKnown=run({version:9,active:idB,profiles:[{id:idA,scope:idA},{id:idB,scope:idB},{id:'prof_cat_mve00000_abcdef03',scope:idA}]});
  assert.equal(newerKnown.safe,true,'unrelated newer-registry damage does not block a uniquely resolved active profile');
  assert.equal(newerKnown.id,idB);assert.equal(newerKnown.scope,idB);
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
