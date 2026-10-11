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
    // The base holds notes under their stored keys.
    function cleanKey(raw){const key=String(raw||'');return isNoteKey(key)?key:'';}
    function textValue(raw){const text=String(raw??'');return encoder.encode(text).byteLength<=Number(limits.maxRichTextBytes||2097152)?text:null;}
    function normalizeHeader(value){
      if(!value||!exactKeys(value,['format','version','checkpointId','establishedAt','noteCount','noteKeyFingerprint'])||value.format!=='study-director.reconciliation-base'||Number(value.version)!==2||!/^cp_[a-f0-9]{32}$/u.test(String(value.checkpointId||''))||!Number.isFinite(Date.parse(String(value.establishedAt||''))))return null;
      const noteCount=Number(value.noteCount);if(!Number.isInteger(noteCount)||noteCount<0||noteCount>Number(limits.maxOngoingNotes||1000)||!/^[a-f0-9]{64}$/u.test(String(value.noteKeyFingerprint||'')))return null;
      return freeze({format:'study-director.reconciliation-base',version:2,checkpointId:String(value.checkpointId),establishedAt:new Date(String(value.establishedAt)).toISOString(),noteCount,noteKeyFingerprint:String(value.noteKeyFingerprint)});
    }
    function normalizeNote(value,context={}){
      if(!value||!exactKeys(value,['format','version','key','text'])||value.format!=='study-director.reconciliation-base-note'||Number(value.version)!==1)return null;
      const key=cleanKey(value.key),text=textValue(value.text),suffix=String(context&&context.suffix||'');if(!key||text===null||suffix!==encodeURIComponent(key))return null;
      return freeze({format:'study-director.reconciliation-base-note',version:1,key,text});
    }
    function normalizeKeys(values){
      if(!Array.isArray(values))return null;const out=[],seen=new Set();for(const raw of values){const key=cleanKey(raw);if(!key||seen.has(key))return null;seen.add(key);out.push(key);}if(out.length>Number(limits.maxOngoingNotes||1000))return null;return freeze(out.sort());
    }
    function normalizeUpdates(value){
      if(!value||typeof value!=='object'||Array.isArray(value))return null;const out=Object.create(null);for(const [rawKey,rawText] of Object.entries(value)){const key=cleanKey(rawKey),text=textValue(rawText);if(!key||text===null)return null;out[key]=text;}return freeze(out);
    }
    async function keyFingerprint(keys){
      const normalized=normalizeKeys(keys);if(!normalized)throw new TypeError('Reconciliation baseline note keys are invalid.');
      if(!globalThis.crypto?.subtle?.digest)throw new Error('SHA-256 is unavailable for reconciliation baseline metadata.');
      return hex(await globalThis.crypto.subtle.digest('SHA-256',encoder.encode(JSON.stringify(normalized))));
    }
    return freeze({format:'study-director.reconciliation-baseline-codec',contractVersion:1,normalizeHeader,normalizeNote,normalizeKeys,normalizeUpdates,keyFingerprint});
  }
  function createStore(input){
    exactObject(input,['codec','families','meta'],'Reconciliation baseline store input');
    const codec=input.codec,meta=input.meta,families=exactObject(input.families,['header','notes'],'Reconciliation baseline families');
    if(!codec||codec.format!=='study-director.reconciliation-baseline-codec'||codec.contractVersion!==1)throw new TypeError('Reconciliation baseline codec is invalid.');
    if(!meta||meta.format!=='study-director.app-meta-owner'||meta.contractVersion!==1)throw new TypeError('Reconciliation baseline appMeta capability is invalid.');
    for(const name of ['read','readEntry','write','remove','list','transaction','view'])if(typeof meta[name]!=='function')throw new TypeError('Reconciliation baseline appMeta capability is missing '+name+'.');
    const noteValue=(key,text)=>freeze({format:'study-director.reconciliation-base-note',version:1,key,text:String(text??'')});
    async function readHeader(){return codec.normalizeHeader(await meta.read(families.header).catch(()=>null));}
    async function readNotes(keys){
      const normalized=codec.normalizeKeys(keys);if(!normalized)return freeze({});const rows=await Promise.all(normalized.map(async key=>{const value=await meta.read(families.notes,encodeURIComponent(key)).catch(()=>null),note=codec.normalizeNote(value,{suffix:encodeURIComponent(key)});return note?freeze([key,note.text]):null;})),out=Object.create(null);for(const row of rows)if(row)out[row[0]]=row[1];return freeze(out);
    }
    async function write(checkpointId,spec){
      const id=String(checkpointId||'');if(!/^cp_[a-f0-9]{32}$/u.test(id)||!spec||!exactKeys(spec,['format','version','full','baseCheckpointId','noteCount','noteKeyFingerprint','noteKeys','updates','deletes'])||spec.format!=='study-director.reconciliation-base-update'||Number(spec.version)!==1)return false;
      const full=spec.full===true,updates=codec.normalizeUpdates(spec.updates),deletes=codec.normalizeKeys(spec.deletes||[]),baseCheckpointId=String(spec.baseCheckpointId||'');if(!updates||!deletes||(!full&&!/^cp_[a-f0-9]{32}$/u.test(baseCheckpointId)))return false;
      let noteKeys=null,noteCount=Number(spec.noteCount),fingerprint=String(spec.noteKeyFingerprint||'');
      if(full){
        noteKeys=codec.normalizeKeys(spec.noteKeys);if(!noteKeys)return false;noteCount=noteKeys.length;fingerprint=await codec.keyFingerprint(noteKeys);
        const noteSet=new Set(noteKeys),deleteSet=new Set(deletes);for(const key of Object.keys(updates))if(!noteSet.has(key)||deleteSet.has(key))return false;for(const key of deletes)if(noteSet.has(key))return false;
      }else{
        if(spec.noteKeys!==null||!Number.isInteger(noteCount)||noteCount<0||!/^[a-f0-9]{64}$/u.test(fingerprint))return false;
        const deleteSet=new Set(deletes);for(const key of Object.keys(updates))if(deleteSet.has(key))return false;
      }
      const establishedAt=new Date().toISOString(),header=codec.normalizeHeader({format:'study-director.reconciliation-base',version:2,checkpointId:id,establishedAt,noteCount,noteKeyFingerprint:fingerprint});if(!header)return false;
      return meta.transaction('readwrite',(view,tx,finish)=>{
        const currentHandle=view.get(families.header),allHandle=full?view.getAll(families.notes):null;let currentReady=false,allReady=!allHandle;
        const fail=error=>{try{tx.abort();}catch{}finish(false,error);};
        const apply=()=>{
          if(!currentReady||!allReady)return;
          let current=null,existing=[];try{current=codec.normalizeHeader(currentHandle.value());if(allHandle)existing=allHandle.entries();}catch(error){fail(error);return;}
          if(!full&&(!current||current.checkpointId!==baseCheckpointId)){tx.oncomplete=()=>finish(true,false);return;}
          if(full){const suffixes=new Set(noteKeys.map(key=>encodeURIComponent(key)));for(const entry of existing)if(!suffixes.has(String(entry.suffix||'')))view.remove(families.notes,entry.suffix);}
          for(const key of deletes)view.remove(families.notes,encodeURIComponent(key));
          for(const [key,text] of Object.entries(updates))view.put(families.notes,noteValue(key,text),{suffix:encodeURIComponent(key),updatedAt:establishedAt});
          view.put(families.header,header,{updatedAt:establishedAt});tx.oncomplete=()=>finish(true,true);
        };
        currentHandle.request.onerror=()=>fail(currentHandle.request.error||new Error('Reconciliation baseline header read failed.'));currentHandle.request.onsuccess=()=>{currentReady=true;apply();};
        if(allHandle){allHandle.request.onerror=()=>fail(allHandle.request.error||new Error('Reconciliation baseline note scan failed.'));allHandle.request.onsuccess=()=>{allReady=true;apply();};}
      },{strict:true,abortMessage:'reconciliation baseline update aborted'});
    }
    return freeze({format:'study-director.reconciliation-baseline-store',contractVersion:1,readHeader,readNotes,write});
  }
  return freeze({format:'study-director.reconciliation-baseline-module',contractVersion:1,createCodec,createStore});
});
})();
