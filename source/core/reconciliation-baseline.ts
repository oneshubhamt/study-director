import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {BaselineNote,BaselineDays,BaselineHeader,BaselineNoteRecord,BaselineDayRecord,BaselineCodecInput,BaselineStoreInput} from '../../types/reconciliation-baseline.ts';
import type {MetaEntry} from '../../types/app-meta.ts';
const sdReconciliationBaselineFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'reconciliation-baseline','study-director.reconciliation-baseline-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
const createModule=()=>{
  const freeze=Object.freeze;
  function exactKeys(value:unknown,keys:readonly string[]):value is Record<string,unknown>{return !!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|'));}
  function hex(bytes:ArrayBuffer){return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');}
  function createCodec(input:BaselineCodecInput){
    exactObject(input,['limits','isNoteKey'],'Reconciliation baseline codec input');
    if(!Object.isFrozen(input.limits)||typeof input.isNoteKey!=='function')throw new TypeError('Reconciliation baseline codec dependencies are invalid.');
    const limits=input.limits,isNoteKey=input.isNoteKey,encoder=new TextEncoder();
    // The base is what this device last shared through Drive: each note's
    // title and text under its stored key, one fingerprint per Saved Day
    // (kept per month), and one each for plans and settings and for the
    // Active Session. Combine compares both sides with it to tell which side
    // changed what.
    const HEX=/^[a-f0-9]{64}$/u,MONTH=/^\d{4}-(?:0[1-9]|1[0-2])$/u;
    function cleanKey(raw:unknown){const key=String(raw||'');return isNoteKey(key)?key:'';}
    function textValue(raw:unknown){const text=String(raw??'');return encoder.encode(text).byteLength<=Number(limits.maxRichTextBytes||2097152)?text:null;}
    function labelValue(raw:unknown){return typeof raw==='string'&&raw.length<=Number(limits.maxAreaNameChars||160)?raw:null;}
    // A fingerprint is '' when the base had nothing (or did not know).
    function fingerprint(raw:unknown){return typeof raw==='string'&&(raw===''||HEX.test(raw));}
    function noteState(raw:unknown){if(!exactKeys(raw,['label','text']))return null;const label=labelValue(raw['label']),text=textValue(raw['text']);return label===null||text===null?null:freeze({label,text});}
    function normalizeHeader(value:unknown):BaselineHeader|null{
      if(!value||!exactKeys(value,['format','version','checkpointId','establishedAt','noteCount','noteKeyFingerprint','personalFingerprint','sessionFingerprint'])||value['format']!=='study-director.reconciliation-base'||Number(value['version'])!==3||!/^cp_[a-f0-9]{32}$/u.test(String(value['checkpointId']||''))||!Number.isFinite(Date.parse(String(value['establishedAt']||''))))return null;
      const noteCount=Number(value['noteCount']);if(!Number.isInteger(noteCount)||noteCount<0||noteCount>Number(limits.maxNotes||1000)||!HEX.test(String(value['noteKeyFingerprint']||''))||!fingerprint(value['personalFingerprint'])||!fingerprint(value['sessionFingerprint']))return null;
      return freeze({format:'study-director.reconciliation-base',version:3,checkpointId:String(value['checkpointId']),establishedAt:new Date(String(value['establishedAt'])).toISOString(),noteCount,noteKeyFingerprint:String(value['noteKeyFingerprint']),personalFingerprint:String(value['personalFingerprint']),sessionFingerprint:String(value['sessionFingerprint'])});
    }
    function normalizeNote(value:unknown,context:{suffix?:string}={}):BaselineNoteRecord|null{
      if(!value||!exactKeys(value,['format','version','key','label','text'])||value['format']!=='study-director.reconciliation-base-note'||Number(value['version'])!==1)return null;
      const key=cleanKey(value['key']),state=noteState({label:value['label'],text:value['text']}),suffix=String(context&&context.suffix||'');if(!key||!state||suffix!==encodeURIComponent(key))return null;
      return freeze({format:'study-director.reconciliation-base-note',version:1,key,label:state.label,text:state.text});
    }
    // One month of Saved-Day fingerprints, keyed by date.
    function monthDays(month:string,raw:unknown){
      if(!MONTH.test(String(month||''))||!raw||typeof raw!=='object'||Array.isArray(raw))return null;const out=Object.create(null) as Record<string,string>;let count=0;
      for(const [date,value] of Object.entries(raw)){if(!/^\d{4}-\d{2}-\d{2}$/u.test(date)||date.slice(0,7)!==month||!HEX.test(String(value||''))||++count>31)return null;out[date]=String(value);}
      return count?freeze(out):null;
    }
    function normalizeDays(value:unknown,context:{suffix?:string}={}):BaselineDayRecord|null{
      if(!value||!exactKeys(value,['format','version','month','days'])||value['format']!=='study-director.reconciliation-base-days'||Number(value['version'])!==1||String(context&&context.suffix||'')!==String(value['month']||''))return null;
      const days=monthDays(String(value['month']),value['days']);return days?freeze({format:'study-director.reconciliation-base-days',version:1,month:String(value['month']),days}):null;
    }
    // {month: {date: fingerprint}} to write, or null to remove that month.
    function normalizeDayUpdates(value:unknown,{full=false}:{full?:boolean}={}){
      if(!value||typeof value!=='object'||Array.isArray(value))return null;const out=Object.create(null) as Record<string,BaselineDays|null>;
      for(const [month,raw] of Object.entries(value)){if(!MONTH.test(month))return null;if(raw===null&&!full){out[month]=null;continue;}const days=monthDays(month,raw);if(!days)return null;out[month]=days;}
      return freeze(out);
    }
    function normalizeKeys(values:unknown){
      if(!Array.isArray(values))return null;const out:string[]=[],seen=new Set<string>();for(const raw of values as unknown[]){const key=cleanKey(raw);if(!key||seen.has(key))return null;seen.add(key);out.push(key);}if(out.length>Number(limits.maxNotes||1000))return null;return freeze(out.sort());
    }
    function normalizeUpdates(value:unknown){
      if(!value||typeof value!=='object'||Array.isArray(value))return null;const out=Object.create(null) as Record<string,BaselineNote>;for(const [rawKey,raw] of Object.entries(value)){const key=cleanKey(rawKey),state=noteState(raw);if(!key||!state)return null;out[key]=state;}return freeze(out);
    }
    async function keyFingerprint(keys:unknown){
      const normalized=normalizeKeys(keys);if(!normalized)throw new TypeError('Reconciliation baseline note keys are invalid.');
      if(!globalThis.crypto?.subtle?.digest)throw new Error('SHA-256 is unavailable for reconciliation baseline metadata.');
      return hex(await globalThis.crypto.subtle.digest('SHA-256',encoder.encode(JSON.stringify(normalized))));
    }
    return freeze({format:'study-director.reconciliation-baseline-codec',contractVersion:1,normalizeHeader,normalizeNote,normalizeDays,normalizeDayUpdates,normalizeKeys,normalizeUpdates,keyFingerprint});
  }
  function createStore(input:BaselineStoreInput){
    exactObject(input,['codec','families','meta'],'Reconciliation baseline store input');
    const codec=input.codec,meta=input.meta,families=exactObject(input.families,['days','header','notes'],'Reconciliation baseline families');
    if(!codec||codec.format!=='study-director.reconciliation-baseline-codec'||codec.contractVersion!==1)throw new TypeError('Reconciliation baseline codec is invalid.');
    if(!meta||meta.format!=='study-director.app-meta-owner'||meta.contractVersion!==1)throw new TypeError('Reconciliation baseline appMeta capability is invalid.');
    for(const name of ['read','readEntry','write','remove','list','transaction','view'] as const)if(typeof meta[name]!=='function')throw new TypeError('Reconciliation baseline appMeta capability is missing '+name+'.');
    const noteValue=(key:string,state:BaselineNote)=>freeze({format:'study-director.reconciliation-base-note',version:1,key,label:state.label,text:state.text});
    const dayValue=(month:string,days:BaselineDays)=>freeze({format:'study-director.reconciliation-base-days',version:1,month,days});
    const sameDays=(a:BaselineDays|undefined,b:BaselineDays)=>!!a&&!!b&&Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([date,value])=>b[date]===value);
    async function readHeader(){return codec.normalizeHeader(await meta.read(families.header).catch(()=>null));}
    async function readNotes(keys:unknown):Promise<Readonly<Record<string,BaselineNote>>>{
      const normalized=codec.normalizeKeys(keys);if(!normalized)return freeze({});const rows=await Promise.all(normalized.map(async key=>{const value=await meta.read(families.notes,encodeURIComponent(key)).catch(()=>null),note=codec.normalizeNote(value,{suffix:encodeURIComponent(key)});return note?freeze([key,freeze({label:note.label,text:note.text})] as const):null;})),out=Object.create(null) as Record<string,BaselineNote>;for(const row of rows)if(row)out[row[0]]=row[1];return freeze(out);
    }
    // The base's fingerprint for each of these dates that it holds.
    async function readDays(dates:unknown){
      const wanted=new Set((Array.isArray(dates)?dates:[]).map(String).filter(date=>/^\d{4}-\d{2}-\d{2}$/u.test(date))),months=[...new Set([...wanted].map(date=>date.slice(0,7)))],out=Object.create(null) as Record<string,string>;
      for(const row of await Promise.all(months.map(async month=>codec.normalizeDays(await meta.read(families.days,month).catch(()=>null),{suffix:month}))))if(row)for(const [date,value] of Object.entries(row.days))if(wanted.has(date))out[date]=value;
      return freeze(out);
    }
    const SPEC_KEYS=['format','version','full','baseCheckpointId','noteCount','noteKeyFingerprint','personalFingerprint','sessionFingerprint','noteKeys','updates','deletes','days'];
    async function write(checkpointId:unknown,spec:unknown){
      const id=String(checkpointId||'');if(!/^cp_[a-f0-9]{32}$/u.test(id)||!spec||!exactKeys(spec,SPEC_KEYS)||spec['format']!=='study-director.reconciliation-base-update'||Number(spec['version'])!==2)return false;
      const full=spec['full']===true,updates=codec.normalizeUpdates(spec['updates']),deletes=codec.normalizeKeys(spec['deletes']||[]),days=codec.normalizeDayUpdates(spec['days'],{full}),baseCheckpointId=String(spec['baseCheckpointId']||'');if(!updates||!deletes||!days||(!full&&!/^cp_[a-f0-9]{32}$/u.test(baseCheckpointId)))return false;
      let noteKeys:readonly string[]|null=null,noteCount=Number(spec['noteCount']),fingerprint=String(spec['noteKeyFingerprint']||'');
      if(full){
        noteKeys=codec.normalizeKeys(spec['noteKeys']);if(!noteKeys)return false;noteCount=noteKeys.length;fingerprint=await codec.keyFingerprint(noteKeys);
        const noteSet=new Set(noteKeys),deleteSet=new Set(deletes);for(const key of Object.keys(updates))if(!noteSet.has(key)||deleteSet.has(key))return false;for(const key of deletes)if(noteSet.has(key))return false;
      }else{
        if(spec['noteKeys']!==null||!Number.isInteger(noteCount)||noteCount<0||!/^[a-f0-9]{64}$/u.test(fingerprint))return false;
        const deleteSet=new Set(deletes);for(const key of Object.keys(updates))if(deleteSet.has(key))return false;
      }
      // An update that did not read plans and settings, or the session, keeps the base's fingerprint (null).
      const establishedAt=new Date().toISOString(),personal=spec['personalFingerprint'],session=spec['sessionFingerprint'],kept=(value:unknown,current:unknown)=>value===null?String(current||''):value;
      const headerFor=(current:BaselineHeader|null)=>codec.normalizeHeader({format:'study-director.reconciliation-base',version:3,checkpointId:id,establishedAt,noteCount,noteKeyFingerprint:fingerprint,personalFingerprint:kept(personal,current&&current.personalFingerprint),sessionFingerprint:kept(session,current&&current.sessionFingerprint)});
      if(full&&(personal===null||session===null)||!headerFor(null))return false;
      return meta.transaction<boolean>('readwrite',(view,tx,finish)=>{
        const currentHandle=view.get(families.header),noteHandle=full?view.getAll(families.notes):null,dayHandle=full?view.getAll(families.days):null,handles=[currentHandle,noteHandle,dayHandle].filter(handle=>handle!==null);let ready=0;
        const fail=(error:unknown)=>{try{tx.abort();}catch{}finish(false,error);};
        const apply=()=>{
          if(++ready<handles.length)return;
          let current:BaselineHeader|null=null,notes:readonly (MetaEntry|null)[]=[],dayRows:readonly (MetaEntry|null)[]=[];try{current=codec.normalizeHeader(currentHandle.value());if(full){notes=noteHandle!.entries();dayRows=dayHandle!.entries();}}catch(error){fail(error);return;}
          if(!full&&(!current||current.checkpointId!==baseCheckpointId)){tx.oncomplete=()=>finish(true,false);return;}
          // A full base rewrites only rows that differ.
          const noteRows=new Map(notes.map(entry=>[String(entry!.suffix||''),entry!.value])),monthRows=new Map(dayRows.map(entry=>[String(entry!.suffix||''),entry!.value]));
          if(full){const suffixes=new Set(noteKeys!.map(key=>encodeURIComponent(key)));for(const suffix of noteRows.keys())if(!suffixes.has(suffix))view.remove(families.notes,suffix);for(const month of monthRows.keys())if(!Object.prototype.hasOwnProperty.call(days,month))view.remove(families.days,month);}
          for(const key of deletes)view.remove(families.notes,encodeURIComponent(key));
          for(const [key,state] of Object.entries(updates)){const suffix=encodeURIComponent(key),old=noteRows.get(suffix) as {label?:unknown;text?:unknown}|null|undefined;if(old&&old.label===state.label&&old.text===state.text)continue;view.put(families.notes,noteValue(key,state),{suffix,updatedAt:establishedAt});}
          for(const [month,value] of Object.entries(days)){if(value===null){view.remove(families.days,month);continue;}if(sameDays((monthRows.get(month) as {days?:BaselineDays}|null|undefined)?.days,value))continue;view.put(families.days,dayValue(month,value),{suffix:month,updatedAt:establishedAt});}
          view.put(families.header,headerFor(current),{updatedAt:establishedAt});tx.oncomplete=()=>finish(true,true);
        };
        for(const handle of handles){handle.request.onerror=()=>fail(handle.request.error||new Error('Reconciliation baseline read failed.'));handle.request.onsuccess=apply;}
      },{strict:true,abortMessage:'reconciliation baseline update aborted'});
    }
    // Forgets what was last shared (the Drive library changed): the next sync
    // is a first sync, a two-way merge. The next full base rewrites the rows.
    function clear(){return meta.remove(families.header,'',{strict:true});}
    return freeze({format:'study-director.reconciliation-baseline-store',contractVersion:1,readHeader,readNotes,readDays,write,clear});
  }
  return freeze({format:'study-director.reconciliation-baseline-module',contractVersion:1,createCodec,createStore});
};
registry.define('reconciliation-baseline',1,createModule);
return createModule;
})();
export type ReconciliationBaselineModule=ReturnType<typeof sdReconciliationBaselineFactory>;
