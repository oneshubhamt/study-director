(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,declaredFunctions:requireFunctions}=registry.contracts;
// The people who use Study Director on this device. The list belongs to the
// device (one localStorage key); everything else belongs to one profile. The
// first profile keeps the plain storage names; a later one adds ~<its scope>
// to each (see the profile scope at the top of app.html). A profile's id is
// made once from its name and never changes with it; its scope never changes
// at all, so a profile that takes a Drive library's id keeps its storage.
registry.define('profiles',1,()=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    scope:freeze(['pattern','registryKey','scope','separator']),
    storage:freeze(['keys','read','remove','write']),
    names:freeze(['database','directories','keys']),
    platform:freeze(['deleteDatabase','listen','now','random','reload','removeDirectory']),
    limits:freeze(['maxName'])
  });
  const VERSION=1,MAX_PROFILES=12;
  function createController(input){
    exactObject(input,['ports'],'Profiles input');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Profiles ports');
    exactObject(ports.scope,PORT_FIELDS.scope,'Profiles scope port');requireFunctions(ports.storage,PORT_FIELDS.storage,'Profiles storage port');exactObject(ports.names,PORT_FIELDS.names,'Profiles names port');requireFunctions(ports.platform,PORT_FIELDS.platform,'Profiles platform port');exactObject(ports.limits,PORT_FIELDS.limits,'Profiles limits port');
    const {registryKey,separator,pattern}=ports.scope,pageScope=String(ports.scope.scope||''),storage=ports.storage,platform=ports.platform,names=ports.names;
    const maxName=Math.max(1,Number(ports.limits.maxName)||60);
    const validId=id=>typeof id==='string'&&pattern.test(id);
    const cleanName=value=>String(value||'').replace(/\s+/gu,' ').trim().slice(0,maxName);
    const cleanEmail=value=>{const email=String(value||'').trim().toLowerCase();return /^[^\s@]{1,128}@[^\s@]{1,190}$/u.test(email)?email:'';};
    const cleanFolder=value=>/^[A-Za-z0-9_-]{1,200}$/u.test(String(value||''))?String(value):'';
    const time=value=>Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
    function entry(value){
      if(!value||typeof value!=='object'||!validId(value.id)||!(value.scope===''||validId(value.scope)))return null;
      // fresh: its first start is not finished. from: the profile it was
      // added from, which Cancel goes back to (null for a device's first).
      const from=value.from===''||validId(value.from)?value.from:null;
      return freeze({id:value.id,scope:value.scope,name:cleanName(value.name),email:cleanEmail(value.email),folder:cleanFolder(value.folder),createdAt:time(value.createdAt),fresh:value.fresh===true,from:value.fresh===true?from:null});
    }
    // The list as stored, or an empty one. Duplicate ids or scopes keep the
    // first. A list this build cannot read (a newer version's, or one it
    // cannot parse) is unsupported: what can be read of it is used, nothing
    // of it is changed, and adding, switching or removing profiles waits for
    // an update (removed profiles' data is not deleted meanwhile).
    // The list this page last saw, put back if the browser's site data is
    // cleared (the app then writes back what it holds; the profile keeps its id).
    let lastText=null;
    function read(){
      const text=storage.read();if(text)lastText=text;let raw=null,parsed=true;try{raw=JSON.parse(text||'null');}catch{raw=null;parsed=false;}
      const unsupported=text!==null&&text!==''&&(!parsed||!raw||typeof raw!=='object'||raw.version!==VERSION);
      const profiles=[],ids=new Set(),scopes=new Set();
      if(raw&&(raw.version===VERSION||unsupported)&&Array.isArray(raw.profiles))for(const value of raw.profiles.slice(0,MAX_PROFILES)){const row=entry(value);if(!row||ids.has(row.id)||scopes.has(row.scope))continue;ids.add(row.id);scopes.add(row.scope);profiles.push(row);}
      const removing=!unsupported&&raw&&Array.isArray(raw.removing)?[...new Set(raw.removing.filter(scope=>(scope===''||validId(scope))&&!scopes.has(scope)))]:[];
      const active=profiles.some(row=>row.id===raw?.active)?raw.active:(profiles[0]?.id||'');
      return freeze({version:VERSION,active,profiles:freeze(profiles),removing:freeze(removing),unsupported});
    }
    function unsupportedError(){return Object.assign(new Error('The profile list on this device was saved by a newer version of Study Director. Update the app to add, switch or remove profiles.'),{code:'STUDY_DIRECTOR_PROFILES_UNSUPPORTED'});}
    function write(next){
      if(read().unsupported)throw unsupportedError();
      const value={version:VERSION,active:next.active,profiles:next.profiles.map(row=>({...row})),removing:[...next.removing]};
      if(!storage.write(JSON.stringify(value)))throw new Error('The profile list on this device could not be saved.');
      return read();
    }
    // prof_<name>_<time>_<random>: the name in plain letters and digits
    // (or "profile"), so the id says whose it is without being unique by name.
    function newId(name){
      const slug=cleanName(name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/gu,'').slice(0,24)||'profile';
      return `prof_${slug}_${Math.floor(platform.now()).toString(36)}_${String(platform.random(4))}`;
    }
    const current=(list=read())=>list.profiles.find(row=>row.scope===pageScope)||null;
    function update(change){
      const list=read(),mine=current(list);if(!mine)return null;
      if(list.unsupported)return mine;
      const next=change(mine,list);if(!next)return mine;
      return current(write({...list,profiles:list.profiles.map(row=>row.scope===pageScope?entry({...row,...next}):row),active:list.active===mine.id&&next.id?next.id:list.active}));
    }
    // The page's profile. A device's first is made here: for someone new its
    // first start is still to come (fresh), for existing data it is done.
    function ensure(name,{fresh=false}={}){
      const list=read(),mine=current(list);if(mine||list.unsupported)return mine;
      if(list.profiles.length>=MAX_PROFILES)throw new Error('This device already holds the most profiles it can.');
      const row=entry({id:newId(name),scope:pageScope,name,email:'',folder:'',createdAt:new Date(platform.now()).toISOString(),fresh:fresh===true,from:null});
      const next=write({...list,profiles:[...list.profiles,row],active:list.profiles.some(other=>other.id===list.active&&other.scope!==pageScope)?list.active:row.id,removing:list.removing.filter(scope=>scope!==pageScope)});
      return current(next);
    }
    // The name shown in the list follows the library's name. Until its first
    // start is finished and while no Drive library knows it, the id follows
    // the name too.
    const rename=name=>update(mine=>{const clean=cleanName(name);if(clean===mine.name)return null;return mine.fresh&&!mine.folder&&clean?{name:clean,id:newId(clean)}:{name:clean};});
    // The Google account and the Drive library this profile syncs with.
    const setAccount=({email,folder}={})=>update(mine=>{const next={email:cleanEmail(email),folder:cleanFolder(folder)};return next.email!==mine.email||next.folder!==mine.folder?next:null;});
    // Takes the id of a Drive library this device has not seen (the same
    // person's library from another device). Never another local profile's.
    function adopt(id){
      const list=read();if(!validId(id))return false;
      if(list.profiles.some(row=>row.id===id))return current(list)?.id===id;
      return update(()=>({id}))?.id===id;
    }
    const finishFirstStart=()=>update(mine=>mine.fresh?{fresh:false,from:null}:null);
    function activate(id,list=read()){if(!list.profiles.some(row=>row.id===id))return false;write({...list,active:id});platform.reload();return true;}
    // Add profile: a new entry, opened at once; its first start shows the
    // first-start form, whose Cancel comes back here.
    function add(){
      const list=read(),mine=current(list);
      if(list.profiles.length>=MAX_PROFILES)throw new Error('This device already holds the most profiles it can.');
      const id=newId('profile'),row=entry({id,scope:id,name:'',email:'',folder:'',createdAt:new Date(platform.now()).toISOString(),fresh:true,from:mine?mine.scope:null});
      return activate(id,write({...list,profiles:[...list.profiles,row]}));
    }
    const switchTo=id=>{const list=read();return id!==current(list)?.id&&activate(id,list);};
    // Removes the page's profile from this device and opens another; its data
    // is deleted from this device once no tab holds it (collect). The last
    // profile is replaced by a new, empty one, which starts with its first start.
    function remove(){
      const list=read(),mine=current(list),others=list.profiles.filter(row=>row.scope!==pageScope);
      if(!mine)return false;
      const removing=[...new Set([...list.removing,pageScope])];
      if(!others.length){
        const id=newId('profile'),row=entry({id,scope:id,name:'',email:'',folder:'',createdAt:new Date(platform.now()).toISOString(),fresh:true,from:null});
        write({...list,profiles:[row],active:id,removing});platform.reload();return true;
      }
      const back=mine.from!==null?others.find(row=>row.scope===mine.from):null,next=back||others.find(row=>row.id===list.active&&row.scope!==pageScope)||others[0];
      write({...list,profiles:others,active:next.id,removing});
      platform.reload();return true;
    }
    // Kept on this device after it was deleted everywhere else: the profile
    // takes a new id and leaves its Google account, so a later sign-in starts
    // a new library instead of meeting the deletion again.
    const renew=()=>update(mine=>({id:newId(mine.name),email:'',folder:''}));
    // Deletes what removed profiles left on this device.
    async function collect(){
      if(read().unsupported)return freeze({removed:false,error:null});
      const pending=read().removing.filter(scope=>scope!==pageScope);
      for(const scope of pending){
        const scoped=name=>scope?`${name}${separator}${scope}`:String(name);
        try{
          for(const key of storage.keys())if(scope?key.endsWith(separator+scope):names.keys.includes(key))storage.remove(key);
          await platform.deleteDatabase(scoped(names.database));
          for(const directory of names.directories)await platform.removeDirectory(scoped(directory));
          const list=read();write({...list,removing:list.removing.filter(value=>value!==scope)});
        }catch(error){return freeze({removed:false,error});}
      }
      return freeze({removed:pending.length>0,error:null});
    }
    // Another tab switched, added or removed a profile: every tab follows.
    function watch(){
      return platform.listen(key=>{if(key!==registryKey&&key!==null)return;
        if(!storage.read()&&lastText){storage.write(lastText);return;}
        const list=read(),mine=current(list),active=list.profiles.find(row=>row.id===list.active);if(list.unsupported)return;if(!mine||active&&active.scope!==pageScope)platform.reload();});
    }
    const list=()=>read().profiles;
    // Removed profiles whose data still waits to be deleted here (diagnostics).
    const removalPending=()=>read().removing.filter(scope=>scope!==pageScope).length;
    // The list on this device is a newer version's: profiles cannot change here.
    const unsupported=()=>read().unsupported;
    return freeze({current:()=>current(),list,ensure,rename,setAccount,adopt,renew,finishFirstStart,add,switchTo,remove,collect,watch,removalPending,unsupported});
  }
  return freeze({format:'study-director.profiles-module',contractVersion:1,createController});
});
})();
