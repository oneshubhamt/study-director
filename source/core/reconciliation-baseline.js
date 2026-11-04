(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('reconciliation-baseline',1,()=>{
  const freeze=Object.freeze;
  function exactKeys(value,keys){return !!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|'));}
  function hex(bytes){return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');}
  function createCodec(input){
    exactObject(input,['limits','isNoteKey'],'Reconciliation baseline codec input');
    if(!Object.isFrozen(input.limits)||typeof input.isNoteKey!=='function')throw new TypeError('Reconciliation baseline codec dependencies are invalid.');
    const limits=input.limits,isNoteKey=input.isNoteKey,encoder=new TextEncoder();
    // The base is what this device last shared through Drive: each note's
    // title and text under its stored key, one fingerprint per Saved Day
    // (kept per month), and one each for plans and settings and for the
    // Active Session. Combine compares both sides with it to tell which side
    // changed what.
    const HEX=/^[a-f0-9]{64}$/u,MONTH=/^\d{4}-(?:0[1-9]|1[0-2])$/u;
    function cleanKey(raw){const key=String(raw||'');return isNoteKey(key)?key:'';}
    function textValue(raw){const text=String(raw??'');return encoder.encode(text).byteLength<=Number(limits.maxRichTextBytes||2097152)?text:null;}
    function labelValue(raw){return typeof raw==='string'&&raw.length<=Number(limits.maxAreaNameChars||160)?raw:null;}
    // A fingerprint is '' when the base had nothing (or did not know).
    function fingerprint(raw){return typeof raw==='string'&&(raw===''||HEX.test(raw));}
    function noteState(raw){if(!exactKeys(raw,['label','text']))return null;const label=labelValue(raw.label),text=textValue(raw.text);return label===null||text===null?null:freeze({label,text});}
    const PREFERENCE_KEYS=freeze(['studentName','theme','presentation','quote','practiceCueMode','fontScale','practiceTargetMs','soundMode']);
    const NUDGE_KEYS=freeze(['present','enabled','sound','nudgeAfter','breakMinutes']);
    const PLAN_ID=/^plan-[a-z0-9-]{8,64}$/u;
    // Only opaque hashes and stable plan ids are stored in the local header.
    // A null map explicitly means no per-field ancestry is provable.
    function normalizePersonalFields(raw){
      if(raw===null)return null;
      if(!exactKeys(raw,['format','version','preferences','nudge','draft','defaultId','savedPlanOrder','savedPlans','order'])||
        raw.format!=='study-director.reconciliation-personal-fields'||raw.version!==1||
        !exactKeys(raw.preferences,PREFERENCE_KEYS)||!exactKeys(raw.nudge,NUDGE_KEYS)||
        ![raw.draft,raw.defaultId,raw.savedPlanOrder,...Object.values(raw.preferences),...Object.values(raw.nudge)].every(value=>typeof value==='string'&&HEX.test(value)))return null;
      const plans=raw.savedPlans,order=raw.order;
      if(!plans||typeof plans!=='object'||Array.isArray(plans)||!Array.isArray(order)||order.length>100||
        Object.keys(plans).length!==order.length)return null;
      const ids=new Set();
      for(const id of order)if(typeof id!=='string'||!PLAN_ID.test(id)||ids.has(id)||!HEX.test(String(plans[id]||''))){return null;}else ids.add(id);
      for(const id of Object.keys(plans))if(!ids.has(id))return null;
      return freeze({format:'study-director.reconciliation-personal-fields',version:1,
        preferences:freeze(Object.fromEntries(PREFERENCE_KEYS.map(key=>[key,raw.preferences[key]]))),
        nudge:freeze(Object.fromEntries(NUDGE_KEYS.map(key=>[key,raw.nudge[key]]))),
        draft:raw.draft,defaultId:raw.defaultId,savedPlanOrder:raw.savedPlanOrder,
        savedPlans:freeze(Object.fromEntries(Object.entries(plans).sort(([a],[b])=>a.localeCompare(b)))),order:freeze([...order])});
    }
    function normalizeHeader(value){
      const version=value?.version,legacy=version===3,semantic=version===5,
        keys=legacy?
          ['format','version','checkpointId','establishedAt','noteCount','noteKeyFingerprint','personalFingerprint','sessionFingerprint']:
          ['format','version','checkpointId','establishedAt','noteCount','noteKeyFingerprint','personalFingerprint','sessionFingerprint','personalFields',...(semantic?['sessionContentFingerprint']:[])];
      if(!value||![3,4,5].includes(version)||!exactKeys(value,keys)||value.format!=='study-director.reconciliation-base'||
        !/^cp_[a-f0-9]{32}$/u.test(String(value.checkpointId||''))||
        !Number.isFinite(Date.parse(String(value.establishedAt||''))))return null;
      const noteCount=Number(value.noteCount);
      if(!Number.isInteger(noteCount)||noteCount<0||noteCount>Number(limits.maxNotes||1000)||
        !HEX.test(String(value.noteKeyFingerprint||''))||!fingerprint(value.personalFingerprint)||!fingerprint(value.sessionFingerprint))return null;
      const fields=legacy?null:normalizePersonalFields(value.personalFields);
      if(!legacy&&value.personalFields!==null&&!fields||fields&&!value.personalFingerprint)return null;
      const sessionContentFingerprint=semantic?value.sessionContentFingerprint:null;
      if(semantic&&sessionContentFingerprint!==null&&
        (!fingerprint(sessionContentFingerprint)||Boolean(sessionContentFingerprint)!==Boolean(value.sessionFingerprint)))return null;
      return freeze({format:'study-director.reconciliation-base',version,
        checkpointId:String(value.checkpointId),establishedAt:new Date(String(value.establishedAt)).toISOString(),
        noteCount,noteKeyFingerprint:String(value.noteKeyFingerprint),personalFingerprint:String(value.personalFingerprint),
        sessionFingerprint:String(value.sessionFingerprint),sessionContentFingerprint,personalFields:fields});
    }
        function normalizeNote(value,context={}){
      if(!value||!exactKeys(value,['format','version','key','label','text'])||value.format!=='study-director.reconciliation-base-note'||Number(value.version)!==1)return null;
      const key=cleanKey(value.key),state=noteState({label:value.label,text:value.text}),suffix=String(context&&context.suffix||'');if(!key||!state||suffix!==encodeURIComponent(key))return null;
      return freeze({format:'study-director.reconciliation-base-note',version:1,key,label:state.label,text:state.text});
    }
    // One month of Saved-Day fingerprints, keyed by date.
    function monthDays(month,raw){
      if(!MONTH.test(String(month||''))||!raw||typeof raw!=='object'||Array.isArray(raw))return null;const out=Object.create(null);let count=0;
      for(const [date,value] of Object.entries(raw)){if(!/^\d{4}-\d{2}-\d{2}$/u.test(date)||date.slice(0,7)!==month||!HEX.test(String(value||''))||++count>31)return null;out[date]=String(value);}
      return count?freeze(out):null;
    }
    function sameDayKeys(a,b){
      return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>Object.hasOwn(b,key));
    }
    function normalizeDays(value,context={}){
      const semantic=value?.version===2;
      if(!value||![1,2].includes(value.version)||!exactKeys(value,['format','version','month','days',...(semantic?['semanticDays']:[])])||
        value.format!=='study-director.reconciliation-base-days'||String(context&&context.suffix||'')!==String(value.month||''))return null;
      const month=String(value.month),days=monthDays(month,value.days),semanticDays=semantic?monthDays(month,value.semanticDays):null;
      if(!days||semantic&&(!semanticDays||!sameDayKeys(days,semanticDays)))return null;
      return freeze({format:'study-director.reconciliation-base-days',version:value.version,month,days,semanticDays});
    }
        // {month: {date: fingerprint}} to write, or null to remove that month.
    function normalizeDayUpdates(value,{full=false}={}){
      if(!value||typeof value!=='object'||Array.isArray(value))return null;const out=Object.create(null);
      for(const [month,raw] of Object.entries(value)){if(!MONTH.test(month))return null;if(raw===null&&!full){out[month]=null;continue;}const days=monthDays(month,raw);if(!days)return null;out[month]=days;}
      return freeze(out);
    }
    function normalizeKeys(values){
      if(!Array.isArray(values))return null;const out=[],seen=new Set();for(const raw of values){const key=cleanKey(raw);if(!key||seen.has(key))return null;seen.add(key);out.push(key);}if(out.length>Number(limits.maxNotes||1000))return null;return freeze(out.sort());
    }
    function normalizeUpdates(value){
      if(!value||typeof value!=='object'||Array.isArray(value))return null;const out=Object.create(null);for(const [rawKey,raw] of Object.entries(value)){const key=cleanKey(rawKey),state=noteState(raw);if(!key||!state)return null;out[key]=state;}return freeze(out);
    }
    async function keyFingerprint(keys){
      const normalized=normalizeKeys(keys);if(!normalized)throw new TypeError('Reconciliation baseline note keys are invalid.');
      if(!globalThis.crypto?.subtle?.digest)throw new Error('SHA-256 is unavailable for reconciliation baseline metadata.');
      return hex(await globalThis.crypto.subtle.digest('SHA-256',encoder.encode(JSON.stringify(normalized))));
    }
    return freeze({format:'study-director.reconciliation-baseline-codec',contractVersion:1,normalizeHeader,normalizePersonalFields,normalizeNote,normalizeDays,normalizeDayUpdates,normalizeKeys,normalizeUpdates,keyFingerprint});
  }
  function createStore(input){
    exactObject(input,['codec','families','meta'],'Reconciliation baseline store input');
    const codec=input.codec,meta=input.meta,families=exactObject(input.families,['days','header','notes'],'Reconciliation baseline families');
    if(!codec||codec.format!=='study-director.reconciliation-baseline-codec'||codec.contractVersion!==1)throw new TypeError('Reconciliation baseline codec is invalid.');
    if(!meta||meta.format!=='study-director.app-meta-owner'||meta.contractVersion!==1)throw new TypeError('Reconciliation baseline appMeta capability is invalid.');
    for(const name of ['read','readEntry','write','remove','list','transaction','view'])if(typeof meta[name]!=='function')throw new TypeError('Reconciliation baseline appMeta capability is missing '+name+'.');
    const noteValue=(key,state)=>freeze({format:'study-director.reconciliation-base-note',version:1,key,label:state.label,text:state.text});
    const dayValue=(month,days,semanticDays=null)=>freeze({format:'study-director.reconciliation-base-days',version:semanticDays?2:1,month,days,...(semanticDays?{semanticDays}:{})});
    const sameDays=(a,b)=>!!a&&!!b&&Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([date,value])=>b[date]===value);
    async function readHeader(){return codec.normalizeHeader(await meta.read(families.header).catch(()=>null));}
    async function readNotes(keys){
      const normalized=codec.normalizeKeys(keys);if(!normalized)return freeze({});const rows=await Promise.all(normalized.map(async key=>{const value=await meta.read(families.notes,encodeURIComponent(key)).catch(()=>null),note=codec.normalizeNote(value,{suffix:encodeURIComponent(key)});return note?freeze([key,freeze({label:note.label,text:note.text})]):null;})),out=Object.create(null);for(const row of rows)if(row)out[row[0]]=row[1];return freeze(out);
    }
    // Full-record hashes keep their original meaning, including in v2 rows.
    // For legacy v1 rows, semantic ancestry is explicitly unknown.
    async function readDayHashes(dates,semantic=false){
      const wanted=new Set((Array.isArray(dates)?dates:[]).map(String).filter(date=>/^\d{4}-\d{2}-\d{2}$/u.test(date))),months=[...new Set([...wanted].map(date=>date.slice(0,7)))],out=Object.create(null);
      for(const row of await Promise.all(months.map(async month=>codec.normalizeDays(await meta.read(families.days,month).catch(()=>null),{suffix:month}))))if(row)for(const [date,value] of Object.entries(semantic?row.semanticDays||{}:row.days))if(wanted.has(date))out[date]=value;
      return freeze(out);
    }
    const readDays=dates=>readDayHashes(dates);
    const readSemanticDays=dates=>readDayHashes(dates,true);
        const SPEC_KEYS=['format','version','full','baseCheckpointId','noteCount','noteKeyFingerprint','personalFingerprint','personalFields','sessionFingerprint','noteKeys','updates','deletes','days'];
    async function write(checkpointId,spec){
      const id=String(checkpointId||''),semantic=spec?.version===4;
      if(!/^cp_[a-f0-9]{32}$/u.test(id)||!spec||![3,4].includes(spec.version)||
        !exactKeys(spec,[...SPEC_KEYS,...(semantic?['sessionContentFingerprint','semanticDays']:[])])||
        spec.format!=='study-director.reconciliation-base-update')return false;
      const full=spec.full===true,updates=codec.normalizeUpdates(spec.updates),deletes=codec.normalizeKeys(spec.deletes||[]),days=codec.normalizeDayUpdates(spec.days,{full}),baseCheckpointId=String(spec.baseCheckpointId||''),
        semanticDays=semantic?codec.normalizeDayUpdates(spec.semanticDays,{full}):null;
      if(!updates||!deletes||!days||semantic&&!semanticDays||(!full&&!/^cp_[a-f0-9]{32}$/u.test(baseCheckpointId)))return false;
      if(semantic&&(!sameDayKeys(days,semanticDays)||Object.entries(days).some(([month,values])=>
        values===null?semanticDays[month]!==null:!sameDayKeys(values,semanticDays[month]))))return false;
            let noteKeys=null,noteCount=Number(spec.noteCount),fingerprint=String(spec.noteKeyFingerprint||'');
      if(full){
        noteKeys=codec.normalizeKeys(spec.noteKeys);if(!noteKeys)return false;noteCount=noteKeys.length;fingerprint=await codec.keyFingerprint(noteKeys);
        const noteSet=new Set(noteKeys),deleteSet=new Set(deletes);for(const key of Object.keys(updates))if(!noteSet.has(key)||deleteSet.has(key))return false;for(const key of deletes)if(noteSet.has(key))return false;
      }else{
        if(spec.noteKeys!==null||!Number.isInteger(noteCount)||noteCount<0||!/^[a-f0-9]{64}$/u.test(fingerprint))return false;
        const deleteSet=new Set(deletes);for(const key of Object.keys(updates))if(deleteSet.has(key))return false;
      }
      // A checkpoint update that did not read Personal Data carries both
      // its whole-object hash AND its per-field hashes forward unchanged.
      // If Personal Data was read but field hashes were unavailable, clear
      // the field ancestor rather than associating stale hashes with new data.
      const establishedAt=new Date().toISOString(),personal=spec.personalFingerprint,
        fields=spec.personalFields===null?null:codec.normalizePersonalFields(spec.personalFields),session=spec.sessionFingerprint,
        semanticSession=semantic?spec.sessionContentFingerprint:null,
        kept=(value,current)=>value===null?String(current||''):value;
      if(spec.personalFields!==null&&!fields||personal===null&&spec.personalFields!==null||
        personal!==null&&personal!==''&&fields===null||full&&(personal===null||session===null)||
        semantic&&(session===null&&semanticSession!==null||session!==null&&
          (!fingerprint(semanticSession)||Boolean(session)!==Boolean(semanticSession))||full&&semanticSession===null))return false;
      const headerFor=current=>codec.normalizeHeader({format:'study-director.reconciliation-base',version:semantic?5:4,checkpointId:id,establishedAt,noteCount,
        noteKeyFingerprint:fingerprint,personalFingerprint:kept(personal,current&&current.personalFingerprint),
        personalFields:personal===null?current?.personalFields||null:fields,
        sessionFingerprint:kept(session,current&&current.sessionFingerprint),
        ...(semantic?{sessionContentFingerprint:session===null?current?.sessionContentFingerprint??null:semanticSession}:{})});
      if(!headerFor(null))return false;
      return meta.transaction('readwrite',(view,tx,finish)=>{
        const currentHandle=view.get(families.header),noteHandle=full?view.getAll(families.notes):null,dayHandle=full?view.getAll(families.days):null,handles=[currentHandle,noteHandle,dayHandle].filter(Boolean);let ready=0;
        const fail=error=>{try{tx.abort();}catch{}finish(false,error);};
        const apply=()=>{
          if(++ready<handles.length)return;
          let current=null,notes=[],dayRows=[];try{current=codec.normalizeHeader(currentHandle.value());if(full){notes=noteHandle.entries();dayRows=dayHandle.entries();}}catch(error){fail(error);return;}
          if(!full&&(!current||current.checkpointId!==baseCheckpointId)){tx.oncomplete=()=>finish(true,false);return;}
          // A full base rewrites only rows that differ.
          const noteRows=new Map(notes.map(entry=>[String(entry.suffix||''),entry.value])),monthRows=new Map(dayRows.map(entry=>[String(entry.suffix||''),entry.value]));
          if(full){const suffixes=new Set(noteKeys.map(key=>encodeURIComponent(key)));for(const suffix of noteRows.keys())if(!suffixes.has(suffix))view.remove(families.notes,suffix);for(const month of monthRows.keys())if(!Object.prototype.hasOwnProperty.call(days,month))view.remove(families.days,month);}
          for(const key of deletes)view.remove(families.notes,encodeURIComponent(key));
          for(const [key,state] of Object.entries(updates)){const suffix=encodeURIComponent(key),old=noteRows.get(suffix);if(old&&old.label===state.label&&old.text===state.text)continue;view.put(families.notes,noteValue(key,state),{suffix,updatedAt:establishedAt});}
          for(const [month,value] of Object.entries(days)){if(value===null){view.remove(families.days,month);continue;}const before=monthRows.get(month),evidence=semantic?semanticDays[month]:null;if(sameDays(before?.days,value)&&(!semantic||before?.version===2&&sameDays(before?.semanticDays,evidence)))continue;view.put(families.days,dayValue(month,value,evidence),{suffix:month,updatedAt:establishedAt});}
          view.put(families.header,headerFor(current),{updatedAt:establishedAt});tx.oncomplete=()=>finish(true,true);
        };
        for(const handle of handles){handle.request.onerror=()=>fail(handle.request.error||new Error('Reconciliation baseline read failed.'));handle.request.onsuccess=apply;}
      },{strict:true,abortMessage:'reconciliation baseline update aborted'});
    }
    // Forgets what was last shared (the Drive library changed): the next sync
    // is a first sync, a two-way merge. The next full base rewrites the rows.
    function clear(){return meta.remove(families.header,'',{strict:true});}
    return freeze({format:'study-director.reconciliation-baseline-store',contractVersion:1,readHeader,readNotes,readDays,readSemanticDays,write,clear});
  }
  return freeze({format:'study-director.reconciliation-baseline-module',contractVersion:1,createCodec,createStore});
});
})();
