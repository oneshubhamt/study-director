import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {ProfileEntry,ProfileListState,ProfilesController,ProfilesInput} from '../../types/profiles.ts';

const sdProfilesFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'profiles','study-director.profiles-module'>|undefined;
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
const {exactFrozenObject:exactObject,declaredFunctions:requireFunctions}=registry.contracts;
const createModule=()=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    scope:freeze(['pattern','registryKey','scope','separator']),
    storage:freeze(['keys','read','remove','write']),
    names:freeze(['database','directories','keys']),
    platform:freeze(['deleteDatabase','listen','now','random','reload','removeDirectory']),
    limits:freeze(['maxName'])
  });
  const VERSION=1 as const,MAX_PROFILES=12;
  const objectRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object';

  function createController(input:Readonly<ProfilesInput>):Readonly<ProfilesController>{
    exactObject(input,['ports'],'Profiles input');
    const ports=input.ports;
    exactObject(ports,Object.keys(PORT_FIELDS),'Profiles ports');
    exactObject(ports.scope,PORT_FIELDS.scope,'Profiles scope port');
    requireFunctions(ports.storage,PORT_FIELDS.storage,'Profiles storage port');
    exactObject(ports.names,PORT_FIELDS.names,'Profiles names port');
    requireFunctions(ports.platform,PORT_FIELDS.platform,'Profiles platform port');
    exactObject(ports.limits,PORT_FIELDS.limits,'Profiles limits port');

    const {registryKey,separator,pattern}=ports.scope,pageScope=String(ports.scope.scope||''),storage=ports.storage,platform=ports.platform,names=ports.names;
    const maxName=Math.max(1,Number(ports.limits.maxName)||60);
    const validId=(id:unknown):id is string=>typeof id==='string'&&pattern.test(id);
    const cleanName=(value:unknown)=>String(value||'').replace(/\s+/gu,' ').trim().slice(0,maxName);
    const cleanEmail=(value:unknown)=>{const email=String(value||'').trim().toLowerCase();return /^[^\s@]{1,128}@[^\s@]{1,190}$/u.test(email)?email:'';};
    const cleanFolder=(value:unknown)=>/^[A-Za-z0-9_-]{1,200}$/u.test(String(value||''))?String(value):'';
    const time=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';

    function entry(value:unknown):Readonly<ProfileEntry>|null{
      if(!objectRecord(value)||!validId(value['id'])||!(value['scope']===''||validId(value['scope'])))return null;
      const from=value['from']===''||validId(value['from'])?value['from']:null;
      return freeze({
        id:value['id'],scope:value['scope'],name:cleanName(value['name']),email:cleanEmail(value['email']),folder:cleanFolder(value['folder']),
        createdAt:time(value['createdAt']),fresh:value['fresh']===true,from:value['fresh']===true?from:null
      });
    }

    let lastText:string|null=null;
    function read():Readonly<ProfileListState>{
      const text=storage.read();if(text)lastText=text;
      let raw:unknown=null,parsed=true;
      try{raw=JSON.parse(text||'null') as unknown;}catch{raw=null;parsed=false;}
      const rawRecord=objectRecord(raw)?raw:null;
      const unsupported=text!==null&&text!==''&&(!parsed||!rawRecord||rawRecord['version']!==VERSION);
      const profiles:Readonly<ProfileEntry>[]=[],ids=new Set<string>(),scopes=new Set<string>();
      const rawProfiles=rawRecord&&Array.isArray(rawRecord['profiles'])?rawRecord['profiles']:[];
      if(rawRecord&&(rawRecord['version']===VERSION||unsupported)){
        for(const value of rawProfiles.slice(0,MAX_PROFILES)){
          const row=entry(value);if(!row||ids.has(row.id)||scopes.has(row.scope))continue;
          ids.add(row.id);scopes.add(row.scope);profiles.push(row);
        }
      }
      const rawRemoving=!unsupported&&rawRecord&&Array.isArray(rawRecord['removing'])?rawRecord['removing']:[];
      const removing=[...new Set(rawRemoving.filter((scope:unknown):scope is string=>(scope===''||validId(scope))&&!scopes.has(scope)))];
      const candidateActive=rawRecord?.['active'];
      const active=typeof candidateActive==='string'&&profiles.some(row=>row.id===candidateActive)?candidateActive:(profiles[0]?.id||'');
      return freeze({version:VERSION,active,profiles:freeze(profiles),removing:freeze(removing),unsupported});
    }

    function unsupportedError(){
      return Object.assign(new Error('The profile list on this device was saved by a newer version of Study Director. Update the app to add, switch or remove profiles.'),{code:'STUDY_DIRECTOR_PROFILES_UNSUPPORTED'});
    }
    function write(next:Readonly<{active:string;profiles:readonly Readonly<ProfileEntry>[];removing:readonly string[]}>):Readonly<ProfileListState>{
      if(read().unsupported)throw unsupportedError();
      const value={version:VERSION,active:next.active,profiles:next.profiles.map(row=>({...row})),removing:[...next.removing]};
      if(!storage.write(JSON.stringify(value)))throw new Error('The profile list on this device could not be saved.');
      return read();
    }
    function newId(name:unknown){
      const slug=cleanName(name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/gu,'').slice(0,24)||'profile';
      return `prof_${slug}_${Math.floor(platform.now()).toString(36)}_${String(platform.random(4))}`;
    }
    const current=(list:Readonly<ProfileListState>=read())=>list.profiles.find(row=>row.scope===pageScope)||null;
    function update(change:(mine:Readonly<ProfileEntry>,list:Readonly<ProfileListState>)=>Readonly<Partial<ProfileEntry>>|null):Readonly<ProfileEntry>|null{
      const list=read(),mine=current(list);if(!mine)return null;
      if(list.unsupported)return mine;
      const next=change(mine,list);if(!next)return mine;
      const profiles=list.profiles.map(row=>{
        if(row.scope!==pageScope)return row;
        const updated=entry({...row,...next});
        if(!updated)throw new Error('Profile update produced invalid state.');
        return updated;
      });
      return current(write({...list,profiles,active:list.active===mine.id&&next.id?String(next.id):list.active}));
    }

    function ensure(name:string,{fresh=false}:Readonly<{fresh?:boolean}>={}):Readonly<ProfileEntry>|null{
      const list=read(),mine=current(list);if(mine||list.unsupported)return mine;
      if(list.profiles.length>=MAX_PROFILES)throw new Error('This device already holds the most profiles it can.');
      const row=entry({id:newId(name),scope:pageScope,name,email:'',folder:'',createdAt:new Date(platform.now()).toISOString(),fresh:fresh===true,from:null});
      if(!row)throw new Error('A new profile could not be created.');
      const next=write({...list,profiles:[...list.profiles,row],active:list.profiles.some(other=>other.id===list.active&&other.scope!==pageScope)?list.active:row.id,removing:list.removing.filter(scope=>scope!==pageScope)});
      return current(next);
    }
    const rename=(name:string)=>update(mine=>{const clean=cleanName(name);return clean===mine.name?null:{name:clean};});
    const setAccount=(account:Readonly<{email?:unknown;folder?:unknown}>={})=>update(mine=>{const next={email:cleanEmail(account.email),folder:cleanFolder(account.folder)};return next.email!==mine.email||next.folder!==mine.folder?next:null;});
    function adopt(id:string){
      const list=read();if(!validId(id))return false;
      if(list.profiles.some(row=>row.id===id))return current(list)?.id===id;
      return update(()=>({id}))?.id===id;
    }
    const finishFirstStart=()=>update(mine=>mine.fresh?{fresh:false,from:null}:null);
    function activate(id:string,list=read()){
      if(!list.profiles.some(row=>row.id===id))return false;
      write({...list,active:id});platform.reload();return true;
    }
    function add(){
      const list=read(),mine=current(list);
      if(list.profiles.length>=MAX_PROFILES)throw new Error('This device already holds the most profiles it can.');
      const id=newId('profile'),row=entry({id,scope:id,name:'',email:'',folder:'',createdAt:new Date(platform.now()).toISOString(),fresh:true,from:mine?mine.scope:null});
      if(!row)throw new Error('A new profile could not be created.');
      return activate(id,write({...list,profiles:[...list.profiles,row]}));
    }
    const switchTo=(id:string)=>{const list=read();return id!==current(list)?.id&&activate(id,list);};
    function remove(){
      const list=read(),mine=current(list),others=list.profiles.filter(row=>row.scope!==pageScope);
      if(!mine)return false;
      const removing=[...new Set([...list.removing,pageScope])];
      if(!others.length){
        const id=newId('profile'),row=entry({id,scope:id,name:'',email:'',folder:'',createdAt:new Date(platform.now()).toISOString(),fresh:true,from:null});
        if(!row)throw new Error('A replacement profile could not be created.');
        write({...list,profiles:[row],active:id,removing});platform.reload();return true;
      }
      const back=mine.from!==null?others.find(row=>row.scope===mine.from):null,next=back||others.find(row=>row.id===list.active&&row.scope!==pageScope)||others[0];
      if(!next)return false;
      write({...list,profiles:others,active:next.id,removing});platform.reload();return true;
    }
    const renew=()=>update(mine=>({id:newId(mine.name),email:'',folder:''}));

    async function collect(){
      if(read().unsupported)return freeze({removed:false,error:null});
      const pending=read().removing.filter(scope=>scope!==pageScope);
      for(const scope of pending){
        const scoped=(name:string)=>scope?`${name}${separator}${scope}`:String(name);
        const assertPending=()=>{
          const state=read();
          if(state.unsupported||!state.removing.includes(scope)||state.profiles.some(row=>row.scope===scope))throw new Error('Profile removal state changed during cleanup. No further data was deleted.');
        };
        try{
          assertPending();
          await platform.deleteDatabase(scoped(names.database));
          assertPending();
          for(const directory of names.directories){await platform.removeDirectory(scoped(directory));assertPending();}
          for(const key of storage.keys()){
            if(!(scope?key.endsWith(separator+scope):names.keys.includes(key)))continue;
            assertPending();
            if(storage.remove(key)!==true)throw new Error('Removed profile browser recovery storage could not be cleared. Cleanup will be retried.');
          }
          const list=read();assertPending();write({...list,removing:list.removing.filter(value=>value!==scope)});
        }catch(error){return freeze({removed:false,error});}
      }
      return freeze({removed:pending.length>0,error:null});
    }
    function watch(){
      return platform.listen(key=>{
        if(key!==registryKey&&key!==null)return;
        if(!storage.read()&&lastText){storage.write(lastText);return;}
        const list=read(),mine=current(list),active=list.profiles.find(row=>row.id===list.active);
        if(list.unsupported)return;
        if(!mine||(active&&active.scope!==pageScope))platform.reload();
      });
    }
    const list=()=>read().profiles;
    const removalPending=()=>read().removing.filter(scope=>scope!==pageScope).length;
    const unsupported=()=>read().unsupported;
    return freeze({current:()=>current(),list,ensure,rename,setAccount,adopt,renew,finishFirstStart,add,switchTo,remove,collect,watch,removalPending,unsupported});
  }
  return freeze({format:'study-director.profiles-module',contractVersion:1,createController});
};
registry.define('profiles',1,createModule);return createModule;
})();
export type ProfilesModule=ReturnType<typeof sdProfilesFactory>;
