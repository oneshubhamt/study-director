import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {captureProcess} from '../../helpers/subprocess.mjs';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const roots=['source','build','tests'];
const files=[];
function walk(directory){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const absolute=path.join(directory,entry.name);
    if(entry.isDirectory())walk(absolute);
    else if(/\.(?:js|mjs)$/.test(entry.name))files.push(absolute);
  }
}
roots.forEach(relative=>walk(path.join(ROOT,relative)));
files.sort();

const rawObjectTokens=new Set([
  'PRODUCTION_LIMITS','LOCAL_STORAGE_KEYS','SESSION_STORAGE_KEYS','APP_META_KEYS','APP_META_REGISTRY',
  'RUNTIME_DATA_CONTRACT','INDEXED_DB_STORE_NAMES','CACHE_STORAGE_IDENTITIES','EXTERNAL_REPOSITORY_IDENTITIES'
]);
function renderSyntaxTemplate(source){
  return source.replace(/@@SD_([A-Z_]+)@@/gu,(_match,name)=>{
    if(rawObjectTokens.has(name))return '{}';
    if(name==='LEGACY_BACKUP_SCHEMA_VERSION')return '1';
    if(name==='PWA_ASSET_MANIFEST')return '[]';
    return 'qa';
  });
}

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sd-syntax-'));
try{
  let renderedTemplates=0;
  for(const file of files){
    let target=file;
    if(file.startsWith(path.join(ROOT,'source')+path.sep)){
      const source=fs.readFileSync(file,'utf8');
      if(/@@SD_[A-Z_]+@@/u.test(source)){
        const rendered=renderSyntaxTemplate(source);
        assert.doesNotMatch(rendered,/@@SD_[A-Z_]+@@/u,`Unresolved syntax template token in ${path.relative(ROOT,file)}.`);
        target=path.join(tempRoot,`${renderedTemplates++}-${path.basename(file)}`);
        fs.writeFileSync(target,rendered);
      }
    }
    const checked=captureProcess(process.execPath,['--check',target],{encoding:'utf8'});
    assert.equal(checked.status,0,`Syntax check failed for ${path.relative(ROOT,file)}:\n${checked.stderr||checked.stdout}`);
  }
  console.log(JSON.stringify({status:'PASS',files:files.length,templateAware:true,renderedTemplates},null,2));
}finally{fs.rmSync(tempRoot,{recursive:true,force:true});}
