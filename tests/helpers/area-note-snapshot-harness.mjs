import assert from 'node:assert/strict';
import vm from 'node:vm';
import {RUNTIME_DATA_CONTRACT} from '../../contracts/canonical-identities.mjs';

function functionSource(source,name){
  const marker=`function ${name}(`,start=source.indexOf(marker);
  assert.ok(start>=0,`Function ${name} was not found.`);
  const brace=source.indexOf('{',start);let depth=0;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`Function ${name} is unterminated.`);
}

function areaNoteSnapshotImplementation(repositoriesSource){
  const declaration='let snapshotRevision=0,metadataSnapshotCache=null,searchSnapshotCache=null;';
  assert.ok(repositoriesSource.includes(declaration),'Area Note snapshot declaration was not found.');
  return [declaration,'touchSnapshot','metadataSnapshot','searchSnapshot'].map((part,index)=>index?functionSource(repositoriesSource,part):part).join('\n');
}

export function createAreaNoteSnapshotHarness(repositoriesSource,entries){
  const implementation=areaNoteSnapshotImplementation(repositoriesSource);
  const notes=Object.create(null);
  for(const entry of entries||[])notes[String(entry.key||'')]={...entry};
  const trashPrefix=RUNTIME_DATA_CONTRACT.schemas.AreaNote.trashKeyPrefix;
  const sandbox={notes,Object,Number,String,hasContent:entry=>!!(entry&&String(entry.text||'').trim()),isTrashKey:key=>String(key||'').startsWith(trashPrefix)};
  vm.createContext(sandbox);
  vm.runInContext(`${implementation}\nglobalThis.__snapshotApi=Object.freeze({touchSnapshot,metadataSnapshot,searchSnapshot});`,sandbox,{filename:'area-note-snapshot-runtime.js'});
  return Object.freeze({api:sandbox.__snapshotApi,notes,implementation});
}
