import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {BaselineNote,BaselineDays,BaselineHeader,BaselineNoteRecord,BaselineDayRecord,BaselineCodecInput,BaselineStoreInput,PersonalFields} from '../../types/reconciliation-baseline.ts';
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
  function sameDayKeys(a:Readonly<Record<string, string>>|Readonly<Record<string, Readonly<Record<string, string>> | null>>,b:Readonly<Record<string, string>>|Readonly<Record<string, Readonly<Record<string, string>> | null>>|Readonly<Record<string, string>> | undefined){return !!a&&!!b&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>Object.hasOwn(b,key));}
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
    function fingerprint(raw:unknown):raw is string{return typeof raw==='string'&&(raw===''||HEX.test(raw));}
    function noteState(raw:unknown){if(!exactKeys(raw,['label','text']))return null;const label=labelValue(raw["label"]),text=textValue(raw["text"]);return label===null||text===null?null:freeze({label,text});}
    const PREFERENCE_KEYS=freeze(['studentName','theme','presentation','quote','practiceCueMode','fontScale','practiceTargetMs','soundMode']);
    const NUDGE_KEYS=freeze(['present','enabled','sound','nudgeAfter','breakMinutes']);
    const PLAN_ID=/^plan-[a-z0-9-]{8,64}$/u;
    // Only opaque hashes and stable plan ids are stored in the local header.
    // A null map explicitly means no per-field ancestry is provable.
    function normalizePersonalFields(raw:unknown):PersonalFields|null{
      if(!exactKeys(raw,['format','version','preferences','nudge','draft','defaultId','savedPlanOrder','savedPlans','order'])||raw['format']!=='study-director.reconciliation-personal-fields'||raw['version']!==1||!exactKeys(raw['preferences'],PREFERENCE_KEYS)||!exactKeys(raw['nudge'],NUDGE_KEYS))return null;
      const preferences=raw['preferences'],nudge=raw['nudge'];
      if(![raw['draft'],raw['defaultId'],raw['savedPlanOrder'],...Object.values(preferences),...Object.values(nudge)].every(value=>typeof value==='string'&&HEX.test(value)))return null;
      const candidate=raw['savedPlans'],order=raw['order'];
      if(!candidate||typeof candidate!=='object'||Array.isArray(candidate)||!Array.isArray(order)||order.length>100||Object.keys(candidate).length!==order.length)return null;
      const plans=candidate as Record<string,unknown>,ids=new Set<string>();
      for(const id of order as unknown[]){if(typeof id!=='string'||!PLAN_ID.test(id)||ids.has(id)||typeof plans[id]!=='string'||!HEX.test(plans[id]))return null;ids.add(id);}
      if(Object.keys(plans).some(id=>!ids.has(id)))return null;
      // Exact key sets and every hash were checked above; only validated
      // fingerprint strings enter the closed canonical ancestry contract.
      return freeze({format:'study-director.reconciliation-personal-fields',version:1,preferences:freeze({...preferences}) as PersonalFields['preferences'],nudge:freeze({...nudge}) as PersonalFields['nudge'],draft:String(raw['draft']),defaultId:String(raw['defaultId']),savedPlanOrder:String(raw['savedPlanOrder']),savedPlans:freeze(Object.fromEntries(Object.entries(plans).sort(([a],[b])=>a.localeCompare(b)))) as Readonly<Record<string,string>>,order:freeze([...ids])});
    }
    // Only the canonical ReconciliationBase.v5 header is accepted.
    const HEADER_KEYS=freeze(['format','version','checkpointId','establishedAt','noteCount','noteKeyFingerprint','personalFingerprint','sessionFingerprint','personalFields','sessionContentFingerprint']);
    function normalizeHeader(value:unknown):BaselineHeader|null{
      if(!exactKeys(value,HEADER_KEYS)||value["version"]!==5||value["format"]!=='study-director.reconciliation-base'||
        !/^cp_[a-f0-9]{32}$/u.test(String(value["checkpointId"]||''))||
        !Number.isFinite(Date.parse(String(value["establishedAt"]||''))))return null;
      const noteCount=Number(value["noteCount"]);
      if(!Number.isInteger(noteCount)||noteCount<0||noteCount>Number(limits.maxNotes||1000)||
        !HEX.test(String(value["noteKeyFingerprint"]||''))||!fingerprint(value["personalFingerprint"])||!fingerprint(value["sessionFingerprint"]))return null;
      const fields=normalizePersonalFields(value["personalFields"]);
      if(value["personalFields"]!==null&&!fields||fields&&!value["personalFingerprint"])return null;
      // null: the session's study-content ancestor is not known.
      const sessionContentFingerprint=value["sessionContentFingerprint"];
      if(sessionContentFingerprint!==null&&
        (!fingerprint(sessionContentFingerprint)||Boolean(sessionContentFingerprint)!==Boolean(value["sessionFingerprint"])))return null;
      return freeze({format:'study-director.reconciliation-base',version:5,
        checkpointId:String(value["checkpointId"]),establishedAt:new Date(String(value["establishedAt"])).toISOString(),
        noteCount,noteKeyFingerprint:String(value["noteKeyFingerprint"]),personalFingerprint:String(value["personalFingerprint"]),
        sessionFingerprint:String(value["sessionFingerprint"]),sessionContentFingerprint,personalFields:fields});
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
    // ReconciliationBaseDays.v2: whole-record and study-content fingerprints
    // for the same dates.
    function normalizeDays(value:unknown,context:{suffix?:string}={}):BaselineDayRecord|null{
      if(!exactKeys(value,['format','version','month','days','semanticDays'])||value["version"]!==2||
        value["format"]!=='study-director.reconciliation-base-days'||String(context&&context.suffix||'')!==String(value["month"]||''))return null;
      const month=String(value["month"]),days=monthDays(month,value["days"]),semanticDays=monthDays(month,value["semanticDays"]);
      if(!days||!semanticDays||!sameDayKeys(days,semanticDays))return null;
      return freeze({format:'study-director.reconciliation-base-days',version:2,month,days,semanticDays});
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
    return freeze({format:'study-director.reconciliation-baseline-codec',contractVersion:1,normalizeHeader,normalizePersonalFields,normalizeNote,normalizeDays,normalizeDayUpdates,normalizeKeys,normalizeUpdates,keyFingerprint});
  }
  function createStore(input:BaselineStoreInput){
    exactObject(input,['codec','families','meta'],'Reconciliation baseline store input');
    const codec=input.codec,meta=input.meta,families=exactObject(input.families,['days','header','notes'],'Reconciliation baseline families');
    if(!codec||codec.format!=='study-director.reconciliation-baseline-codec'||codec.contractVersion!==1)throw new TypeError('Reconciliation baseline codec is invalid.');
    if(!meta||meta.format!=='study-director.app-meta-owner'||meta.contractVersion!==1)throw new TypeError('Reconciliation baseline appMeta capability is invalid.');
    for(const name of ['read','readEntry','write','remove','list','transaction','view'] as const)if(typeof meta[name]!=='function')throw new TypeError('Reconciliation baseline appMeta capability is missing '+name+'.');
    const noteValue=(key:string,state:BaselineNote)=>freeze({format:'study-director.reconciliation-base-note',version:1,key,label:state.label,text:state.text});
    const dayValue=(month:string,days:BaselineDays,semanticDays:Readonly<Record<string, string>> | null | undefined)=>freeze({format:'study-director.reconciliation-base-days',version:2,month,days,semanticDays});
    const sameDays=(a:BaselineDays|null|undefined,b:BaselineDays|null|undefined)=>!!a&&!!b&&Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([date,value])=>b[date]===value);
    async function readHeader(){return codec.normalizeHeader(await meta.read(families.header).catch(()=>null));}
    async function readNotes(keys:unknown):Promise<Readonly<Record<string,BaselineNote>>>{
      const normalized=codec.normalizeKeys(keys);if(!normalized)return freeze({});const rows=await Promise.all(normalized.map(async key=>{const value=await meta.read(families.notes,encodeURIComponent(key)).catch(()=>null),note=codec.normalizeNote(value,{suffix:encodeURIComponent(key)});return note?freeze([key,freeze({label:note.label,text:note.text})] as const):null;})),out=Object.create(null) as Record<string,BaselineNote>;for(const row of rows)if(row)out[row[0]]=row[1];return freeze(out);
    }
    async function readDays(dates:unknown){
      const wanted=new Set((Array.isArray(dates)?dates:[]).map(String).filter(date=>/^\d{4}-\d{2}-\d{2}$/u.test(date))),months=[...new Set([...wanted].map(date=>date.slice(0,7)))],out=Object.create(null) as Record<string,string>;
      for(const row of await Promise.all(months.map(async month=>codec.normalizeDays(await meta.read(families.days,month).catch(()=>null),{suffix:month}))))if(row)for(const [date,value] of Object.entries(row.days))if(wanted.has(date))out[date]=value;
      return freeze(out);
    }
    // Ancestry is only safe when all month rows belong to the exact shared
    // checkpoint being reconciled. Distinguish unreadable rows from absence.
    async function readDayAncestry(dates:readonly string[],expectedCheckpointId:string){
      const expected=String(expectedCheckpointId||''),before=await readHeader();
      if(!before||!expected||before.checkpointId!==expected)throw new Error('Shared Saved-Day ancestor changed before it could be read.');
      const wanted=new Set((Array.isArray(dates)?dates:[]).map(String).filter(date=>/^\d{4}-\d{2}-\d{2}$/u.test(date))),
        months=[...new Set([...wanted].map(date=>date.slice(0,7)))],out=Object.create(null) as Record<string,{full:string;semantic:string|undefined}>;
      for(const [month,raw] of await Promise.all(months.map(async month=>[month,await meta.read(families.days,month)] as const))){
        if(raw===null||raw===undefined)continue;
        const row=codec.normalizeDays(raw,{suffix:month});
        if(!row)throw new Error('Shared Saved-Day ancestor row is invalid.');
        for(const [date,full] of Object.entries(row.days))if(wanted.has(date))out[date]=freeze({full,semantic:row.semanticDays[date]});
      }
      const after=await readHeader();
      if(!after||after.checkpointId!==expected)throw new Error('Shared Saved-Day ancestor changed during reconciliation.');
      return freeze(out);
    }
    const SPEC_KEYS=['format','version','full','baseCheckpointId','noteCount','noteKeyFingerprint','personalFingerprint','personalFields','sessionFingerprint','noteKeys','updates','deletes','days','sessionContentFingerprint','semanticDays'];
    async function write(checkpointId:unknown,spec:unknown){
      const id=String(checkpointId||'');
      if(!/^cp_[a-f0-9]{32}$/u.test(id)||!exactKeys(spec,SPEC_KEYS)||spec["version"]!==4||
        spec["format"]!=='study-director.reconciliation-base-update')return false;
      const full=spec["full"]===true,updates=codec.normalizeUpdates(spec["updates"]),deletes=codec.normalizeKeys(spec["deletes"]||[]),days=codec.normalizeDayUpdates(spec["days"],{full}),baseCheckpointId=String(spec["baseCheckpointId"]||''),
        semanticDays=codec.normalizeDayUpdates(spec["semanticDays"],{full});
      if(!updates||!deletes||!days||!semanticDays||(!full&&!/^cp_[a-f0-9]{32}$/u.test(baseCheckpointId)))return false;
      if(!sameDayKeys(days,semanticDays)||Object.entries(days).some(([month,values])=>
        values===null?semanticDays[month]!==null:semanticDays[month]===null||!sameDayKeys(values,semanticDays[month])))return false;
      let noteKeys:readonly string[]|null=null,noteCount=Number(spec["noteCount"]),fingerprint=String(spec["noteKeyFingerprint"]||'');
      if(full){
        noteKeys=codec.normalizeKeys(spec['noteKeys']);if(!noteKeys)return false;noteCount=noteKeys.length;fingerprint=await codec.keyFingerprint(noteKeys);
        const noteSet=new Set(noteKeys),deleteSet=new Set(deletes);for(const key of Object.keys(updates))if(!noteSet.has(key)||deleteSet.has(key))return false;for(const key of deletes)if(noteSet.has(key))return false;
      }else{
        if(spec['noteKeys']!==null||!Number.isInteger(noteCount)||noteCount<0||!/^[a-f0-9]{64}$/u.test(fingerprint))return false;
        const deleteSet=new Set(deletes);for(const key of Object.keys(updates))if(deleteSet.has(key))return false;
      }
      // A checkpoint update that did not read Personal Data carries both
      // its whole-object hash AND its per-field hashes forward unchanged.
      // If Personal Data was read but field hashes were unavailable, clear
      // the field ancestor rather than associating stale hashes with new data.
      const establishedAt=new Date().toISOString(),personal=spec["personalFingerprint"],
        fields=spec["personalFields"]===null?null:codec.normalizePersonalFields(spec["personalFields"]),session=spec["sessionFingerprint"],
        semanticSession=spec["sessionContentFingerprint"],
        kept=(value:unknown,current:unknown)=>value===null?String(current||''):value;
      if(spec["personalFields"]!==null&&!fields||personal===null&&spec["personalFields"]!==null||
        personal!==null&&personal!==''&&fields===null||full&&(personal===null||session===null)||
        session===null&&semanticSession!==null||session!==null&&
          (typeof semanticSession!=='string'||semanticSession!==''&&!/^[a-f0-9]{64}$/u.test(semanticSession)||Boolean(session)!==Boolean(semanticSession))||full&&semanticSession===null)return false;
      const headerFor=(current:BaselineHeader|null)=>codec.normalizeHeader({format:'study-director.reconciliation-base',version:5,checkpointId:id,establishedAt,noteCount,
        noteKeyFingerprint:fingerprint,personalFingerprint:kept(personal,current&&current.personalFingerprint),
        personalFields:personal===null?current?.personalFields||null:fields,
        sessionFingerprint:kept(session,current&&current.sessionFingerprint),
        sessionContentFingerprint:session===null?current?.sessionContentFingerprint??null:semanticSession});
      if(!headerFor(null))return false;
      return meta.transaction('readwrite',(view,tx,finish)=>{
        const currentHandle=view.get(families.header),noteHandle=full?view.getAll(families.notes):null,dayHandle=full?view.getAll(families.days):null,handles=[currentHandle,...(noteHandle?[noteHandle]:[]),...(dayHandle?[dayHandle]:[])];let ready=0;
        const fail=(error:unknown)=>{try{tx.abort();}catch{}finish(false,error);};
        const apply=()=>{
          if(++ready<handles.length)return;
          let current:BaselineHeader|null=null,notes:readonly (MetaEntry|null)[]=[],dayRows:readonly (MetaEntry|null)[]=[];try{current=codec.normalizeHeader(currentHandle.value());if(full){notes=noteHandle!.entries();dayRows=dayHandle!.entries();}}catch(error){fail(error);return;}
          if(!full&&(!current||current.checkpointId!==baseCheckpointId)){tx.oncomplete=()=>finish(true,false);return;}
          // A full base rewrites only rows that differ.
          const noteRows=new Map<string,BaselineNoteRecord>(notes.flatMap(entry=>{if(!entry)return [];const value=codec.normalizeNote(entry.value,{suffix:entry.suffix});return value?[[String(entry.suffix||''),value] as const]:[];})),monthRows=new Map<string,BaselineDayRecord>(dayRows.flatMap(entry=>{if(!entry)return [];const value=codec.normalizeDays(entry.value,{suffix:entry.suffix});return value?[[String(entry.suffix||''),value] as const]:[];}));
          if(full){const suffixes=new Set(noteKeys!.map(key=>encodeURIComponent(key)));for(const suffix of noteRows.keys())if(!suffixes.has(suffix))view.remove(families.notes,suffix);for(const month of monthRows.keys())if(!Object.prototype.hasOwnProperty.call(days,month))view.remove(families.days,month);}
          for(const key of deletes)view.remove(families.notes,encodeURIComponent(key));
          for(const [key,state] of Object.entries(updates)){const suffix=encodeURIComponent(key),old=noteRows.get(suffix);if(old&&old.label===state.label&&old.text===state.text)continue;view.put(families.notes,noteValue(key,state),{suffix,updatedAt:establishedAt});}
          for(const [month,value] of Object.entries(days)){if(value===null){view.remove(families.days,month);continue;}const before=monthRows.get(month),evidence=semanticDays[month];if(sameDays(before?.days,value)&&sameDays(before?.semanticDays,evidence))continue;view.put(families.days,dayValue(month,value,evidence),{suffix:month,updatedAt:establishedAt});}
          view.put(families.header,headerFor(current),{updatedAt:establishedAt});tx.oncomplete=()=>finish(true,true);
        };
        for(const handle of handles){handle.request.onerror=()=>fail(handle.request.error||new Error('Reconciliation baseline read failed.'));handle.request.onsuccess=apply;}
      },{strict:true,abortMessage:'reconciliation baseline update aborted'});
    }
    // Forgets what was last shared (the Drive library changed): the next sync
    // is a first sync, a two-way merge. The next full base rewrites the rows.
    function clear(){return meta.remove(families.header,'',{strict:true});}
    return freeze({format:'study-director.reconciliation-baseline-store',contractVersion:1,readHeader,readNotes,readDays,readDayAncestry,write,clear});
  }
  return freeze({format:'study-director.reconciliation-baseline-module',contractVersion:1,createCodec,createStore});
};
registry.define('reconciliation-baseline',1,createModule);
return createModule;
})();
export type ReconciliationBaselineModule=ReturnType<typeof sdReconciliationBaselineFactory>;
