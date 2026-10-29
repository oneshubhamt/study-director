import type {BrowserRegistry} from '../../types/browser-registry.ts';
import type {AppMetaModule,MetaDefinition,MetaValidator,MetaContext,MetaEntry,MetaOwner,MetaOperation,MetaWriteOptions} from '../../types/app-meta.ts';
import type {DbTransaction} from '../../types/persistence.ts';
(()=>{
'use strict';
const registry=(globalThis as typeof globalThis & {[key:symbol]:BrowserRegistry|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('app-meta',1,()=>{
  const freeze=Object.freeze;
  function create(input:Parameters<AppMetaModule["create"]>[0]){
    exactObject(input,['indexedDb','store','registry'],'appMeta gateway input');
    if(!Object.isFrozen(input.indexedDb)||!Object.isFrozen(input.registry))throw new TypeError('appMeta gateway contracts must be frozen.');
    functions(input.indexedDb,['transaction','strictTransaction','get','getAll'],'appMeta IndexedDB contract');
    const storeName=String(input.store||'');if(!storeName)throw new TypeError('appMeta store name is required.');
    const definitions=new Map<string,Readonly<MetaDefinition>>(),exactKeys=new Map<string,Readonly<MetaDefinition>>(),prefixes:Readonly<MetaDefinition>[]=[];
    for(const [name,raw] of Object.entries(input.registry)){
      exactObject(raw,['name','kind','key','owner','validatorOwner','schema','protection'],`appMeta registry ${name}`);
      if(raw.name!==name||!['exact','prefix'].includes(raw.kind)||!raw.key||!raw.owner||!raw.validatorOwner||!raw.schema||!raw.protection)throw new TypeError(`appMeta registry ${name} is invalid.`);
      const definition=freeze({name,kind:raw.kind,key:String(raw.key),owner:String(raw.owner),validatorOwner:String(raw.validatorOwner),schema:String(raw.schema),protection:String(raw.protection)});
      definitions.set(name,definition);
      if(definition.kind==='exact'){
        if(exactKeys.has(definition.key))throw new Error(`Duplicate appMeta exact identity ${definition.key}.`);
        exactKeys.set(definition.key,definition);
      }else prefixes.push(definition);
    }
    prefixes.sort((a,b)=>b.key.length-a.key.length);
    for(let i=0;i<prefixes.length;i++)for(let j=i+1;j<prefixes.length;j++)if(prefixes[i]!.key.startsWith(prefixes[j]!.key)||prefixes[j]!.key.startsWith(prefixes[i]!.key))throw new Error('appMeta prefixes must not overlap.');
    for(const key of exactKeys.keys())for(const definition of prefixes)if(key.startsWith(definition.key))throw new Error(`appMeta exact identity ${key} collides with prefix ${definition.key}.`);
    const validators=new Map<string,MetaValidator>(),capabilities=new Map<string,Readonly<MetaOwner>>();
    function resolveKey(key:unknown){
      const clean=String(key||''),exact=exactKeys.get(clean);if(exact)return freeze({definition:exact,key:clean,suffix:''});
      for(const definition of prefixes)if(clean.startsWith(definition.key)&&clean.length>definition.key.length)return freeze({definition,key:clean,suffix:clean.slice(definition.key.length)});
      return null;
    }
    function family(name:string,owner:string){
      const definition=definitions.get(String(name||''));
      if(!definition)throw new TypeError(`Unknown appMeta family ${String(name||'?')}.`);
      if(definition.owner!==owner)throw new TypeError(`appMeta family ${definition.name} is owned by ${definition.owner}, not ${owner}.`);
      return definition;
    }
    function identity(definition:Readonly<MetaDefinition>,suffix=''){
      if(definition.kind==='exact'){
        if(String(suffix||''))throw new TypeError(`Exact appMeta family ${definition.name} does not accept a suffix.`);
        return definition.key;
      }
      const tail=String(suffix||'');if(!tail)throw new TypeError(`Prefix appMeta family ${definition.name} requires a suffix.`);
      return definition.key+tail;
    }
    function canonicalEnvelope(row:unknown,key:string):row is {key:string;version:unknown;updatedAt:unknown;value:unknown}{
      if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join('|')!=='key|updatedAt|value|version')return false;
      return (row as {key:unknown}).key===key&&Number((row as {version:unknown}).version)===1&&Number.isFinite(Date.parse(String((row as {updatedAt:unknown}).updatedAt||'')));
    }
    function validatorFor(definition:Readonly<MetaDefinition>){
      const validator=validators.get(definition.name);if(typeof validator!=='function')throw new Error(`appMeta validator ${definition.name} is not registered.`);return validator;
    }
    function validateValue(definition:Readonly<MetaDefinition>,value:unknown,key:string,suffix:string){
      let valid=false;try{valid=validatorFor(definition)(value,freeze({family:definition.name,key,suffix,schema:definition.schema,owner:definition.owner,validatorOwner:definition.validatorOwner}))===true;}catch(error){throw new TypeError(`appMeta ${definition.name} validation failed: ${error&&(error as {message?:unknown}).message||error}`);}
      if(!valid)throw new TypeError(`appMeta ${definition.name} value is not canonical (${definition.schema}).`);
      return value;
    }
    function entryFromRow(definition:Readonly<MetaDefinition>,key:string,suffix:string,row:unknown):MetaEntry|null{
      if(!row)return null;
      if(!canonicalEnvelope(row,key))throw new TypeError(`appMeta ${definition.name} envelope is not canonical.`);
      validateValue(definition,row.value,key,suffix);
      return freeze({family:definition.name,key,suffix,value:row.value,updatedAt:String(row.updatedAt)});
    }
    function rowFor(definition:Readonly<MetaDefinition>,key:string,suffix:string,value:unknown,updatedAt=''){
      validateValue(definition,value,key,suffix);
      const timestamp=updatedAt?String(updatedAt):new Date().toISOString();
      if(!Number.isFinite(Date.parse(timestamp)))throw new TypeError(`appMeta ${definition.name} updatedAt is invalid.`);
      return {key,version:1,value,updatedAt:new Date(timestamp).toISOString()};
    }
    function createView(owner:string,tx:DbTransaction){
      if(!tx||typeof tx.objectStore!=='function')throw new TypeError('appMeta transaction view requires an IndexedDB transaction.');
      const store=tx.objectStore(storeName);
      function target(name:string,suffix=''){const definition=family(name,owner),key=identity(definition,suffix);return {definition,key,suffix:String(suffix||'')};}
      function get(name:string,suffix=''){
        const t=target(name,suffix),request=store.get(t.key);
        return freeze({request,entry:()=>entryFromRow(t.definition,t.key,t.suffix,request.result),value:()=>entryFromRow(t.definition,t.key,t.suffix,request.result)?.value??null});
      }
      function getAll(name:string){
        const definition=family(name,owner),Range=globalThis.IDBKeyRange,range=definition.kind==='prefix'&&Range&&typeof Range.bound==='function'?Range.bound(definition.key,`${definition.key}\uffff`):null,request=range?store.getAll(range):store.getAll();
        return freeze({request,entries:()=>{
          const out=[];for(const row of request.result||[]){const resolved=resolveKey(row&&(row as {key?:unknown}).key);if(!resolved||resolved.definition.name!==definition.name)continue;out.push(entryFromRow(definition,resolved.key,resolved.suffix,row));}
          return freeze(out);
        }});
      }
      function put(name:string,value:unknown,options:MetaWriteOptions={}){
        const suffix=String(options&&options.suffix||''),t=target(name,suffix),row=rowFor(t.definition,t.key,t.suffix,value,options&&options.updatedAt||'');
        return store.put(row);
      }
      function remove(name:string,suffix=''){const t=target(name,suffix);return store.delete(t.key);}
      return freeze({get,getAll,put,remove});
    }
    function registerValidators(validationOwner:string,ownerValidators:Readonly<Record<string,MetaValidator>>){
      const cleanOwner=String(validationOwner||'');if(!cleanOwner)throw new TypeError('appMeta validation owner is required.');
      if(!ownerValidators||!Object.isFrozen(ownerValidators))throw new TypeError(`appMeta validators for ${cleanOwner} must be frozen.`);
      const expected=[...definitions.values()].filter(definition=>definition.validatorOwner===cleanOwner).map(definition=>definition.name).sort(),actual=Object.keys(ownerValidators).sort();
      if(!expected.length)throw new TypeError(`Unknown appMeta validation owner ${cleanOwner}.`);
      if(actual.join('|')!==expected.join('|'))throw new TypeError(`appMeta validators for ${cleanOwner} do not exactly match its registry families.`);
      for(const name of expected){if(typeof ownerValidators[name]!=='function')throw new TypeError(`appMeta validator ${name} must be a function.`);if(validators.has(name))throw new Error(`appMeta validator ${name} is already registered.`);validators.set(name,ownerValidators[name]!);}
      return true;
    }
    function bind(owner:string){
      const cleanOwner=String(owner||'');if(!cleanOwner)throw new TypeError('appMeta owner is required.');
      if(capabilities.has(cleanOwner))throw new Error(`appMeta owner ${cleanOwner} is already bound.`);
      const owned=[...definitions.values()].filter(definition=>definition.owner===cleanOwner);
      if(!owned.length)throw new TypeError(`Unknown appMeta owner ${cleanOwner}.`);
      const missing=owned.filter(definition=>!validators.has(definition.name));if(missing.length)throw new Error(`appMeta owner ${cleanOwner} cannot bind before validators are registered for ${missing.map(definition=>definition.name).join(', ')}.`);
      function target(name:string,suffix=''){const definition=family(name,cleanOwner),key=identity(definition,suffix);return {definition,key,suffix:String(suffix||'')};}
      async function readEntry(name:string,suffix=''){
        const t=target(name,suffix),row=await input.indexedDb.get(storeName,t.key,'app metadata read aborted');return entryFromRow(t.definition,t.key,t.suffix,row);
      }
      async function read(name:string,suffix=''){return (await readEntry(name,suffix))?.value??null;}
      function transaction<T>(mode:IDBTransactionMode,operation:MetaOperation<T>,options:MetaWriteOptions={}){
        if(!['readonly','readwrite'].includes(mode)||typeof operation!=='function')throw new TypeError('appMeta transaction request is invalid.');
        const strict=options&&options.strict===true;if(strict&&mode!=='readwrite')throw new TypeError('Strict appMeta transactions require readwrite mode.');
        const runner=strict?input.indexedDb.strictTransaction:input.indexedDb.transaction;
        return runner<T>(storeName,mode,(tx,finish)=>operation(createView(cleanOwner,tx),tx,finish),String(options&&options.abortMessage||'app metadata transaction aborted'));
      }
      function write<T>(name:string,value:T,options:MetaWriteOptions={}){
        const updatedAt=options&&options.updatedAt?new Date(String(options.updatedAt)).toISOString():new Date().toISOString(),writeOptions={...options,updatedAt};
        return transaction<Readonly<{family:string;value:T;updatedAt:string}>>('readwrite',(view,tx,finish)=>{const request=view.put(name,value,writeOptions);request.onerror=()=>finish(false,request.error||new Error('app metadata write failed'));tx.oncomplete=()=>finish(true,freeze({family:String(name),value,updatedAt}));},{strict:options&&options.strict===true,abortMessage:options&&options.abortMessage||'app metadata write aborted'});
      }
      function remove(name:string,suffix='',options:MetaWriteOptions={}){
        return transaction<boolean>('readwrite',(view,tx,finish)=>{const request=view.remove(name,suffix);request.onerror=()=>finish(false,request.error||new Error('app metadata removal failed'));tx.oncomplete=()=>finish(true,true);},{strict:options&&options.strict===true,abortMessage:options&&options.abortMessage||'app metadata removal aborted'});
      }
      function list(name:string){
        const definition=family(name,cleanOwner);if(definition.kind!=='prefix')throw new TypeError(`appMeta family ${definition.name} is not a prefix family.`);
        return transaction<readonly (MetaEntry|null)[]>('readonly',(view,tx,finish)=>{const handle=view.getAll(name);handle.request.onerror=()=>finish(false,handle.request.error||new Error('app metadata list failed'));handle.request.onsuccess=()=>{try{finish(true,handle.entries());}catch(error){finish(false,error);}};},{abortMessage:'app metadata list aborted'});
      }
      const capability=freeze({format:'study-director.app-meta-owner',contractVersion:1,owner:cleanOwner,read,readEntry,write,remove,list,transaction,view:(tx:DbTransaction)=>createView(cleanOwner,tx)});
      capabilities.set(cleanOwner,capability);return capability;
    }
    // Whether this build reads a stored row: a family it knows, the current
    // envelope and a value its validator accepts.
    function readable(row:unknown){
      const resolved=resolveKey(row&&(row as {key?:unknown}).key);if(!resolved)return false;
      try{entryFromRow(resolved.definition,resolved.key,resolved.suffix,row);return true;}catch{return false;}
    }
    async function verifyAll(){
      const issues:string[]=[];let rows:unknown[]=[];
      try{rows=await input.indexedDb.getAll(storeName,'app metadata verification aborted');}
      catch(error){return freeze({ok:false,rows:0,issues:freeze([`read:${String(error&&(error as {message?:unknown}).message||error)}`])});}
      for(const row of rows||[]){
        const key=String(row&&(row as {key?:unknown}).key||''),resolved=resolveKey(key);if(!resolved){issues.push(`unclassified:${key||'?'}`);continue;}
        try{entryFromRow(resolved.definition,resolved.key,resolved.suffix,row);}catch(error){issues.push(`${resolved.definition.name}:${String(error&&(error as {message?:unknown}).message||error)}`);}
      }
      return freeze({ok:issues.length===0,rows:(rows||[]).length,issues:freeze(issues)});
    }
    return freeze({format:'study-director.app-meta-gateway',contractVersion:1,registerValidators,bind,resolve:(key:unknown)=>{const resolved=resolveKey(key);return resolved&&freeze({family:resolved.definition.name,kind:resolved.definition.kind,key:resolved.key,suffix:resolved.suffix,owner:resolved.definition.owner,validatorOwner:resolved.definition.validatorOwner,schema:resolved.definition.schema,protection:resolved.definition.protection});},readable,verifyAll});
  }
  return freeze({format:'study-director.app-meta',contractVersion:1,create});
});
})();
