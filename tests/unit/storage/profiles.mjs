import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Profiles (5.3): the device list of people, each with storage of their own.
// Every page is one profile; the list is shared by every page on the device.
const context=vm.createContext({console,Error,TypeError,Object,Array,String,Number,Map,Set,JSON,Date,Math,Symbol,Promise,RegExp});
context.globalThis=context;
for(const file of ['internal','profiles'])vm.runInContext(fs.readFileSync(`source/core/${file}.js`,'utf8'),context,{filename:`${file}.js`});
const ProfilesModule=context[Symbol.for('studyDirector.internalModules.v1')].require('profiles',1);
const freeze=Object.freeze,REGISTRY='studyDirector.profiles.v1',pattern=/^prof_[a-z0-9]{1,24}_[a-z0-9]{6,12}_[a-f0-9]{8}$/u;

function device(){
  const store=new Map(),events={reloads:0,databases:[],directories:[]},listeners=new Set();let clock=Date.UTC(2026,9,18,9,0,0),counter=0;
  function page(scope=''){
    return ProfilesModule.createController(freeze({ports:freeze({
      scope:freeze({pattern,registryKey:REGISTRY,scope,separator:'~'}),
      storage:freeze({keys:()=>[...store.keys()],read:()=>store.get(REGISTRY)??null,remove:key=>store.delete(key),write:text=>{store.set(REGISTRY,text);for(const listener of listeners)listener(REGISTRY);return true;}}),
      names:freeze({database:'sdmLocalAppDB.v1',directories:freeze(['study-director-assets-v2','study-director-backup-files-v1']),keys:freeze(['studyDirector.theme.v1','studyDirector.noteRescue.v1']),legacyDirectory:'study-director-assets'}),
      platform:freeze({deleteDatabase:async name=>{events.databases.push(name);return true;},listen:handler=>{listeners.add(handler);return ()=>listeners.delete(handler);},now:()=>clock,random:bytes=>(++counter).toString(16).padStart(bytes*2,'0'),reload:()=>{events.reloads+=1;},removeDirectory:async name=>{events.directories.push(name);}}),
      limits:freeze({maxName:60})
    })}));
  }
  return {store,events,page,list:()=>JSON.parse(store.get(REGISTRY)),tick:ms=>{clock+=ms;}};
}

{
  // Someone new: their first start is still to come; the id follows the name until it is done.
  const d=device(),first=d.page('');
  assert.equal(first.current(),null,'no profile before the first start');
  const made=first.ensure('',{fresh:true});
  assert.match(made.id,/^prof_profile_[a-z0-9]{6,12}_[a-f0-9]{8}$/u);assert.equal(made.scope,'','the first profile keeps the plain storage names');assert.equal(made.fresh,true);
  assert.equal(d.list().active,made.id);
  const named=first.rename('  Ana   María ');assert.equal(named.name,'Ana María');assert.match(named.id,/^prof_anamaria_/u,'the id says whose profile it is');assert.equal(named.scope,'');
  assert.equal(d.list().active,named.id,'the active profile follows its new id');
  first.setAccount({email:' Ana@Example.COM ',folder:'folder-1'});assert.equal(first.current().email,'ana@example.com');assert.equal(first.current().folder,'folder-1');
  assert.equal(first.rename('Ana M').id,named.id,'once a Drive library knows the profile, its id stays');
  assert.equal(first.finishFirstStart().fresh,false);
  first.setAccount({});assert.equal(first.rename('Ana').id,named.id,'after the first start the id never changes with the name');
  assert.equal(first.ensure('Someone else').id,named.id,'ensure keeps an existing profile');
}
{
  // Existing data on a device without a list: its profile is made at once, first start done.
  const d=device(),made=d.page('').ensure('Ben');
  assert.equal(made.fresh,false);assert.equal(made.from,null);assert.match(made.id,/^prof_ben_/u);
  d.store.set(REGISTRY,'{not json');assert.equal(d.page('').current(),null,'an unreadable list reads as empty');
  d.store.set(REGISTRY,JSON.stringify({version:1,active:'x',profiles:[{id:'bad',scope:''},{id:made.id,scope:'',name:'Ben'},{id:made.id,scope:'prof_dup_mve00000_00000001',name:'Dup'}],removing:[]}));
  assert.deepEqual([...d.page('').list()].map(row=>row.id),[made.id],'malformed and duplicate entries are dropped');assert.equal(d.page('').current().name,'Ben');
}
{
  // Add profile, Cancel (remove) back to where it was added from, and the removed data is deleted.
  const d=device(),first=d.page('');const ana=first.ensure('Ana');
  d.tick(1000);assert.equal(first.add(),true);assert.equal(d.events.reloads,1,'Add profile opens the new profile');
  const [,added]=d.list().profiles;assert.equal(added.scope,added.id,'a later profile is scoped by its first id');assert.equal(added.fresh,true);assert.equal(added.from,'','Cancel goes back to the profile that added it');assert.equal(d.list().active,added.id);
  const second=d.page(added.scope);assert.equal(second.current().id,added.id);
  const renamed=second.rename('Ben');assert.match(renamed.id,/^prof_ben_/u);assert.equal(renamed.scope,added.scope,'its storage stays where it is when the id follows the name');
  d.store.set('studyDirector.theme.v1~'+added.scope,'director-light');d.store.set('studyDirector.theme.v1','director-dark');
  assert.equal(second.remove(),true);assert.equal(d.events.reloads,2);
  assert.deepEqual(d.list().profiles.map(row=>row.id),[ana.id]);assert.equal(d.list().active,ana.id);assert.deepEqual(d.list().removing,[added.scope]);
  const collected=await first.collect();assert.equal(collected.removed,true);assert.equal(collected.error,null);
  assert.equal(d.store.has('studyDirector.theme.v1~'+added.scope),false,'the removed profile browser storage is deleted');assert.equal(d.store.get('studyDirector.theme.v1'),'director-dark','the open profile keeps its own');
  assert.deepEqual(d.events.databases,['sdmLocalAppDB.v1~'+added.scope]);assert.deepEqual(d.events.directories,['study-director-assets-v2~'+added.scope,'study-director-backup-files-v1~'+added.scope]);
  assert.deepEqual(d.list().removing,[],'nothing is left to delete');
  assert.equal((await first.collect()).removed,false,'collect runs once per removal');
}
{
  // Switching, and every tab following another tab's switch.
  const d=device(),first=d.page('');const ana=first.ensure('Ana');first.add();const ben=d.list().profiles[1];
  const second=d.page(ben.scope);second.finishFirstStart();
  const reloadsBefore=d.events.reloads;first.watch();second.watch();
  assert.equal(second.switchTo(ben.id),false,'switching to the open profile does nothing');
  assert.equal(second.switchTo(ana.id),true);assert.equal(d.list().active,ana.id);
  assert.equal(d.events.reloads,reloadsBefore+2,'the switching tab reloads, and so does every other tab not on the active profile');
  assert.equal(first.switchTo('prof_nobody_mve00000_00000000'),false,'an unknown profile cannot be opened');
}
{
  // The first profile removed: its plain names, database, folders and the old attachment folder go.
  const d=device(),first=d.page('');const ana=first.ensure('Ana');first.add();const ben=d.list().profiles[1];
  const second=d.page(ben.scope);second.finishFirstStart();second.switchTo(ana.id);
  d.store.set('studyDirector.theme.v1','director-dark');d.store.set('studyDirector.installationId.v1','inst_iphone_safari_mve00000_abcdef01');d.store.set('studyDirector.noteRescue.v1~'+ben.scope,'{}');
  assert.equal(first.remove(),true);assert.equal(d.list().active,ben.id,'with nothing to go back to, another profile opens');
  await second.collect();
  assert.equal(d.store.has('studyDirector.theme.v1'),false);assert.equal(d.store.has('studyDirector.installationId.v1'),true,'device-wide names stay');assert.equal(d.store.has('studyDirector.noteRescue.v1~'+ben.scope),true,'the open profile keeps its own');
  assert.deepEqual(d.events.databases,['sdmLocalAppDB.v1']);assert.deepEqual(d.events.directories,['study-director-assets-v2','study-director-backup-files-v1','study-director-assets']);
}
{
  // Adopting a Drive library id: never another local profile's.
  const d=device(),first=d.page('');first.ensure('Ana');first.add();const ben=d.list().profiles[1],second=d.page(ben.scope);
  const libraryId='prof_ana_mvd00000_0000abcd';
  assert.equal(second.adopt(d.list().profiles[0].id),false,'another local profile id is refused');
  assert.equal(second.adopt('not-an-id'),false);
  assert.equal(second.adopt(libraryId),true);assert.equal(second.current().id,libraryId);assert.equal(second.current().scope,ben.scope,'its storage stays where it is');assert.equal(d.list().active,libraryId);
  assert.equal(second.adopt(libraryId),true,'adopting the id it has changes nothing');
}
{
  // At most twelve profiles on one device.
  const d=device(),first=d.page('');first.ensure('Ana');
  for(let index=1;index<12;index++){d.tick(1);first.add();}
  assert.equal(d.list().profiles.length,12);assert.throws(()=>first.add(),/most profiles/u);
}
{
  // The last profile: a new, empty profile replaces it, and its data is deleted.
  const d=device(),first=d.page('');const ana=first.ensure('Ana');d.store.set('studyDirector.theme.v1','director-dark');
  d.tick(1000);assert.equal(first.remove(),true);assert.equal(d.events.reloads,1);
  const [fresh]=d.list().profiles;assert.equal(d.list().profiles.length,1);assert.notEqual(fresh.id,ana.id);
  assert.equal(fresh.scope,fresh.id,'the new profile has storage of its own');assert.equal(fresh.fresh,true);assert.equal(fresh.from,null,'its first start has nothing to cancel back to');
  assert.equal(d.list().active,fresh.id);assert.deepEqual(d.list().removing,['']);
  await d.page(fresh.scope).collect();
  assert.equal(d.store.has('studyDirector.theme.v1'),false,'the deleted profile data goes');assert.deepEqual(d.events.databases,['sdmLocalAppDB.v1']);assert.deepEqual(d.list().removing,[]);
}
{
  // Kept on this device after it was deleted elsewhere: a new id, no Google account, the same storage.
  const d=device(),first=d.page('');first.ensure('Ana');first.setAccount({email:'ana@example.com',folder:'folder-1'});const before=first.current();
  d.tick(1000);const kept=first.renew();
  assert.notEqual(kept.id,before.id);assert.match(kept.id,/^prof_ana_/u);assert.equal(kept.scope,before.scope);assert.equal(kept.email,'');assert.equal(kept.folder,'');assert.equal(d.list().active,kept.id);
}
console.log(JSON.stringify({status:'PASS',suite:'profiles',cases:['first start id follows the name','existing data','add, cancel and delete','switch and follow','first profile removed','adopt a library id','twelve at most','the last profile is replaced by a new one','kept after a deletion elsewhere']},null,2));
