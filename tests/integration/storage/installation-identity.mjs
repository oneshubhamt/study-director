import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function runtime(seed={}){
  const backing=new Map(Object.entries(seed));
  const localStorage={
    getItem:key=>backing.has(String(key))?backing.get(String(key)):null,
    setItem:(key,value)=>backing.set(String(key),String(value)),
    removeItem:key=>backing.delete(String(key))
  };
  const context=vm.createContext({
    console,Date,Math,JSON,RegExp,Error,TypeError,Object,Array,String,Number,Map,Set,Promise,Uint8Array,
    crypto:globalThis.crypto,localStorage,globalThis:null
  });
  context.globalThis=context;
  for(const file of ['internal','persistence'])vm.runInContext(fs.readFileSync(`source/core/${file}.js`,'utf8'),context,{filename:`${file}.js`});
  const persistence=context[Symbol.for('studyDirector.internalModules.v1')].require('persistence',1);
  const local=persistence.createLocalStorage();
  const identity=persistence.createInstallationIdentity(Object.freeze({local,keys:Object.freeze({installationId:'installation'})}));
  return {backing,identity};
}

const current=runtime({installation:'inst_current_installation',legacyDevice:'dev_old'});
assert.equal(current.identity.contractVersion,3);
assert.equal(current.identity.getId(),'inst_current_installation','current installation identity must remain stable');
assert.equal(current.backing.get('legacyDevice'),'dev_old','ordinary installation identity must not read, rewrite, or retire historical device identity state');
assert.equal(Object.hasOwn(current.identity,'compatibilityDeviceId'),false);
assert.equal(Object.hasOwn(current.identity,'retireLegacy'),false);
assert.equal(Object.hasOwn(current.identity,'verifyRetired'),false);

const fresh=runtime({legacyDevice:'dev_legacy_installation'});
const generated=fresh.identity.getId();
assert.match(generated,/^inst_[a-z0-9_]{8,128}$/i);
assert.equal(fresh.backing.get('installation'),generated,'fresh current identity must be durable');
assert.equal(fresh.backing.get('legacyDevice'),'dev_legacy_installation','historical identity must remain exclusively for the compatibility facade to migrate/retire');


console.log(JSON.stringify({status:'PASS',suite:'installation-identity',currentOnly:true,legacyMigrationIsolated:true},null,2));
