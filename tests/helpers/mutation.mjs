import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {captureProcess} from './subprocess.mjs';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mutations=Object.freeze([
  Object.freeze({
    id:'settlement-clears-its-deadline',file:'source/core/operation-lifecycle.js',
    find:'if(timer!==null)clear(timer);',replace:'if(false)clear(timer);',
    tests:Object.freeze(['tests/unit/app/operation-lifecycle.mjs'])
  }),
  Object.freeze({
    id:'diagnostic-history-keeps-live-operations',file:'source/core/backup-operation-diagnostics.js',
    find:"records=records.filter(row=>row.status==='running'||keep.has(row));",replace:'records=records.filter(row=>keep.has(row));',
    tests:Object.freeze(['tests/unit/backup/backup-operation-diagnostics.mjs'])
  }),
  Object.freeze({
    id:'partial-integrity-remains-unfinished',file:'source/core/operation-lifecycle.js',
    find:'details.complete===false',replace:'false',
    tests:Object.freeze(['tests/unit/app/operation-lifecycle.mjs'])
  }),
  Object.freeze({
    id:'encrypted-backup-password-verifier-is-enforced',file:'portable/stream-encryption.js',
    find:"if(!await crypto.subtle.verify('HMAC',hmac,bytes.slice(32),VERIFIER_PROOF))throw invalid('The password is incorrect.','BACKUP_AUTH_FAILED');",replace:"if(false)throw invalid('The password is incorrect.','BACKUP_AUTH_FAILED');",
    tests:Object.freeze(['tests/integration/backup/encryption.mjs'])
  }),
  Object.freeze({
    id:'backup-chunk-integrity-is-enforced',file:'source/core/backup-codec.js',
    find:'if(checksum!==entry.checksum)throw new Error(`Backup chunk ${entry.seq} failed its integrity check.`);',
    replace:'if(false)throw new Error(`Backup chunk ${entry.seq} failed its integrity check.`);',
    tests:Object.freeze(['tests/integration/backup/portable-backup.mjs'])
  }),
  Object.freeze({
    id:'attachment-metadata-failure-rolls-references-back',file:'source/core/attachments.js',
    find:'if(!referenceChange?.rollback)return error;',replace:'return error;',
    tests:Object.freeze(['tests/integration/attachments/attachment-deletion.mjs'])
  }),
  Object.freeze({
    id:'reconciliation-verifies-committed-saved-days',file:'source/core/backup.js',
    find:'if(!intended||!committed||!Canonical.same(committed,intended))throw new Error(`Saved-Day reconciliation commit did not match the resolved state for ${record.date}.`);',
    replace:'if(false)throw new Error(`Saved-Day reconciliation commit did not match the resolved state for ${record.date}.`);',
    tests:Object.freeze(['tests/integration/backup/backup-persistence.mjs'])
  }),
  Object.freeze({
    id:'library-clear-restores-durable-journal',file:'source/core/library-clear.js',
    find:'await ports.restore(journal.payload);',replace:'await Promise.resolve();',
    tests:Object.freeze(['tests/integration/library/library-clear.mjs'])
  })
]);

function isolatedEnvironment(tempRoot){
  const env={...process.env};
  for(const key of ['NODE_OPTIONS','NODE_PATH','NODE_V8_COVERAGE','SD_COVERAGE_DIR','SD_ENCRYPTED_TEST','SD_MINIFIED_TEST','SD_TEST_ARTIFACT_DIR'])delete env[key];
  Object.assign(env,{TZ:'UTC',TERM:'dumb',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',NO_COLOR:'1',FORCE_COLOR:'0',CI:'1',HOME:path.join(tempRoot,'home'),TMPDIR:path.join(tempRoot,'tmp'),TEMP:path.join(tempRoot,'tmp'),TMP:path.join(tempRoot,'tmp'),XDG_CACHE_HOME:path.join(tempRoot,'cache'),SD_TEST_ARTIFACT_DIR:path.join(tempRoot,'artifacts'),SD_ENCRYPTED_TEST:'0',SD_MINIFIED_TEST:'0'});
  for(const directory of [env.HOME,env.TMPDIR,env.XDG_CACHE_HOME,env.SD_TEST_ARTIFACT_DIR])fs.mkdirSync(directory,{recursive:true});
  return env;
}
function applyMutation(clone,mutation){
  const target=path.join(clone,mutation.file),source=fs.readFileSync(target,'utf8');
  const first=source.indexOf(mutation.find),last=source.lastIndexOf(mutation.find);
  if(first<0)throw new Error(`${mutation.id}: mutation anchor not found in ${mutation.file}`);
  if(first!==last)throw new Error(`${mutation.id}: mutation anchor is not unique in ${mutation.file}`);
  fs.writeFileSync(target,source.slice(0,first)+mutation.replace+source.slice(first+mutation.find.length));
}
function copyRepository(target){
  fs.cpSync(root,target,{recursive:true,filter:source=>{
    const relative=path.relative(root,source).split(path.sep).join('/');
    return relative!=='.git'&&!relative.startsWith('.git/')&&relative!=='node_modules'&&!relative.startsWith('node_modules/');
  }});
}
function runTest(clone,test,tempRoot){
  const loader=pathToFileURL(path.join(clone,'tests/helpers/hermetic-loader.mjs')).href;
  const runtime=pathToFileURL(path.join(clone,'tests/helpers/hermetic-runtime.mjs')).href;
  return captureProcess(process.execPath,['--no-warnings','--experimental-loader',loader,'--import',runtime,test],{cwd:clone,env:isolatedEnvironment(tempRoot),encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024});
}

const requested=process.argv.slice(2).filter(value=>!value.startsWith('-'));
const selected=requested.length?mutations.filter(mutation=>requested.includes(mutation.id)):mutations;
if(requested.length&&selected.length!==requested.length)throw new Error(`Unknown mutation id. Available: ${mutations.map(item=>item.id).join(', ')}`);
const results=[];
for(const mutation of selected){
  const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-mutant-')),clone=path.join(tempRoot,'repo');
  let killed=false,killer='';
  try{
    copyRepository(clone);applyMutation(clone,mutation);
    for(const test of mutation.tests){
      const result=runTest(clone,test,tempRoot);
      if(result.error&&result.error.code==='ETIMEDOUT')throw new Error(`${mutation.id}: ${test} timed out.`);
      if(result.status!==0){killed=true;killer=test;break;}
    }
  }finally{fs.rmSync(tempRoot,{recursive:true,force:true});}
  results.push({id:mutation.id,file:mutation.file,killed,killer});
  console.log(`${killed?'KILLED':'SURVIVED'} ${mutation.id}${killer?` ← ${killer}`:''}`);
}
const survived=results.filter(result=>!result.killed);
console.log(JSON.stringify({status:survived.length?'FAIL':'PASS',mutants:results.length,killed:results.length-survived.length,survived:survived.map(result=>result.id)},null,2));
if(survived.length)process.exitCode=1;
