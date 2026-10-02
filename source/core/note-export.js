(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
registry.define('note-export',2,()=>{
  const freeze=Object.freeze;
  const MAX_EXPORT_BYTES=128*1024*1024;
  const MIME_EXTENSION=Object.freeze({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/avif':'avif'});
  function cleanBaseName(value,fallback='Untitled Note'){
    let name=String(value||'').normalize('NFC').replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g,' ').replace(/\s+/g,' ').trim().replace(/^[. ]+|[. ]+$/g,'');
    if(!name||name==='.'||name==='..')name=fallback;if(/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(name))name=`Note ${name}`;if(name.length>120)name=name.slice(0,120).trim().replace(/^[. ]+|[. ]+$/g,'')||fallback;return name;
  }
  function uniqueName(base,used){let candidate=base,index=2;while(used.has(candidate.toLocaleLowerCase()))candidate=`${base} (${index++})`;used.add(candidate.toLocaleLowerCase());return candidate;}
  function assetFilename(id,mime){const ext=MIME_EXTENSION[String(mime||'').toLowerCase()]||'bin',safe=String(id||'asset').replace(/[^A-Za-z0-9_-]/g,'_').slice(0,120)||'asset';return `${safe}.${ext}`;}
  function createExporter({ports}){
    for(const [name,methods] of Object.entries({notes:['get'],assets:['get'],richText:['assetIds','document'],output:['chooseSave','save'],processing:['job','run','cancel','check'],scheduling:['yieldTask','budget']})){if(!Object.isFrozen(ports?.[name])||methods.some(method=>typeof ports[name][method]!=='function'))throw new TypeError('Note export '+name+' port is incomplete.');}
    const {notes,assets,richText,output,processing,scheduling}=ports;
    async function exportKeys(keys){
      const selected=[...new Set((keys||[]).map(String))].map(key=>notes.get(key)).filter(entry=>entry&&String(entry.text||'').trim());
      if(!selected.length)return freeze({status:'empty',notes:0,assets:0});
      const referenced=new Set(selected.length===1?richText.assetIds(selected[0].text):[]);
      const packageNeeded=selected.length>1||referenced.size>0;
      const filename=(selected.length===1?cleanBaseName(selected[0].label||selected[0].key):'Study-Director-Notes')+(packageNeeded?'.zip':'.md');
      // Picker is acquired before the first await. A cancelled picker never downloads.
      try{return await processing.job(async()=>{
        const handle=await output.chooseSave(filename,packageNeeded?{'application/zip':['.zip']}:{'text/markdown':['.md']}),assetMap=new Map(),files=[],usedNames=new Set();let bytes=0,missing=0;
        const shouldYield=scheduling.budget();
        if(selected.length>1)for(const entry of selected){processing.check();if(shouldYield())await scheduling.yieldTask();processing.check();for(const id of richText.assetIds(entry.text))referenced.add(id);}
        for(const id of referenced){processing.check();let blob=null;try{blob=await assets.get(id);}catch{}if(blob&&blob.size>0&&MIME_EXTENSION[blob.type]){bytes+=blob.size;assetMap.set(id,blob);}else missing++;if(bytes>MAX_EXPORT_BYTES)return freeze({status:'too-large',maxBytes:MAX_EXPORT_BYTES});}
        for(const entry of selected){
          processing.check();
          const base=uniqueName(cleanBaseName(entry.label||entry.key),usedNames),multi=selected.length>1,paths=Object.create(null);
          for(const [id,blob] of assetMap)paths[id]=(multi?'../assets/':'assets/')+assetFilename(id,blob.type);
          const document=richText.document(entry.text),markdown=await processing.run('markdown',{...document,paths});
          const libraryHint=/#attachment=(?:att|img)-[a-z0-9-]{20,80}/.test(entry.text)?'\n\nAttachment-library links open inside Study Director. Export the attachment library separately to preserve those files.\n':'';
          const blob=new Blob([markdown,libraryHint],{type:'text/markdown;charset=utf-8'});bytes+=blob.size;
          if(bytes>MAX_EXPORT_BYTES)return freeze({status:'too-large',maxBytes:MAX_EXPORT_BYTES});
          files.push({name:(multi?'notes/':'')+base+'.md',blob});
        }
        for(const [id,blob] of assetMap)files.push({name:'assets/'+assetFilename(id,blob.type),blob});
        const blob=packageNeeded?await processing.run('zip',{files,date:new Date().toISOString()}):files[0].blob;
        const result=await output.save({blob,filename},handle);
        return freeze({...result,kind:packageNeeded?'zip':'markdown',notes:selected.length,assets:assetMap.size,missing});
      });}catch(error){if(error.fileWritten)throw new Error('Notes were written, but verification did not finish: '+error.message);if(error.name==='AbortError'||error.code==='STUDY_DIRECTOR_IMPORT_CANCELLED')return freeze({status:'cancelled'});throw error;}
    }
    return freeze({format:'study-director.note-exporter',contractVersion:2,exportKeys,cancel:processing.cancel});
  }
  return freeze({format:'study-director.note-export-module',contractVersion:2,createExporter,limits:freeze({maxExportBytes:MAX_EXPORT_BYTES}),testing:freeze({cleanBaseName})});
});
})();
