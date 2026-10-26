import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {RELEASE_TEST_SET} from './release-tests.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const categories=Object.freeze(['unit','integration','architecture']);
const allowed=new Set([...categories,'fast','targeted']);
const target=String(process.argv[2]||'fast');
if(!allowed.has(target))throw new Error(`Unknown fast-test target: ${target}`);

const selected=target==='targeted'?[...new Set(process.argv.slice(3).map(file=>file.split(path.sep).join('/')))]:[];
if(target==='targeted'&&!selected.length)throw new Error('Targeted QA requires explicit test paths.');

const ignoredRoots=new Set(['.git','node_modules']);
function discover(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())return discover(file);
    return entry.isFile()&&/\.(?:mjs|mts)$/u.test(entry.name)?[file]:[];
  });
}
function fastFiles(category){
  return discover(path.join(root,'tests',category))
    .map(file=>path.relative(root,file).split(path.sep).join('/'))
    .filter(file=>!RELEASE_TEST_SET.has(file))
    .sort();
}
function repositorySnapshot(){
  const rows=new Map();
  const walk=(directory,prefix='')=>{
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      if(!prefix&&ignoredRoots.has(entry.name))continue;
      const relative=prefix?`${prefix}/${entry.name}`:entry.name;
      const absolute=path.join(directory,entry.name);
      if(entry.isDirectory()){walk(absolute,relative);continue;}
      const stat=fs.lstatSync(absolute,{bigint:true});
      const extra=entry.isSymbolicLink()?`:${fs.readlinkSync(absolute)}`:'';
      rows.set(relative,`${stat.mode}:${stat.size}:${stat.mtimeNs}${extra}`);
    }
  };
  walk(root);
  return rows;
}
function repositoryDiff(before,after){
  const changed=[];
  for(const [file,state] of before)if(!after.has(file)||after.get(file)!==state)changed.push(file);
  for(const file of after.keys())if(!before.has(file))changed.push(file);
  return [...new Set(changed)].sort();
}
function isolatedEnvironment(tempRoot){
  const env={...process.env};
  for(const key of ['NODE_OPTIONS','NODE_PATH','SD_ENCRYPTED_TEST','SD_MINIFIED_TEST','SD_TEST_ARTIFACT_DIR'])delete env[key];
  Object.assign(env,{
    TZ:'UTC',TERM:'dumb',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',NO_COLOR:'1',FORCE_COLOR:'0',CI:'1',
    HOME:path.join(tempRoot,'home'),TMPDIR:path.join(tempRoot,'tmp'),TEMP:path.join(tempRoot,'tmp'),TMP:path.join(tempRoot,'tmp'),
    XDG_CACHE_HOME:path.join(tempRoot,'cache'),SD_TEST_ARTIFACT_DIR:path.join(tempRoot,'artifacts'),
    SD_ENCRYPTED_TEST:'0',SD_MINIFIED_TEST:'0'
  });
  if(process.env.SD_COVERAGE_DIR)env.SD_COVERAGE_DIR=path.resolve(process.env.SD_COVERAGE_DIR);
  for(const directory of [env.HOME,env.TMPDIR,env.XDG_CACHE_HOME,env.SD_TEST_ARTIFACT_DIR])fs.mkdirSync(directory,{recursive:true});
  return env;
}
function runtimePreflight(){
  const [major,minor,patch]=process.versions.node.split('.').map(Number);
  const supported=major===22&&(minor>23||minor===23&&patch>=4)||major===24&&minor>=15||major>=26;
  if(!supported)throw new Error(`Fast tests require Node.js 22.23.4+; found ${process.versions.node}. npm is not required.`);
  for(const [name,value] of [['Blob',globalThis.Blob],['structuredClone',globalThis.structuredClone],['crypto',globalThis.crypto],['MessageChannel',globalThis.MessageChannel]]){
    if(value===undefined)throw new Error(`Fast-test runtime is missing ${name}; use a current Node.js runtime. npm is not required.`);
  }
}

const loader=pathToFileURL(path.join(root,'tests/helpers/hermetic-loader.mjs')).href;
const runtime=pathToFileURL(path.join(root,'tests/helpers/hermetic-runtime.mjs')).href;
if(target==='targeted'){
  const available=new Set(categories.flatMap(fastFiles));
  for(const file of selected)if(!available.has(file))throw new Error(`Unknown fast-test path: ${file}`);
}
const baseline=repositorySnapshot();
let total=0;
runtimePreflight();

for(const category of ['fast','targeted'].includes(target)?categories:[target]){
  const files=target==='targeted'?selected.filter(file=>file.startsWith(`tests/${category}/`)).sort():fastFiles(category);
  if(target==='targeted'&&!files.length)continue;
  if(!files.length)throw new Error(`No fast ${category} tests found.`);
  for(const relative of files){
    total++;
    process.stdout.write(`\n[${category}] ${relative.slice(`tests/${category}/`.length)}\n`);
    const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-fast-'));
    try{
      const args=['--no-warnings','--experimental-loader',loader,'--import',runtime];
      if(process.env.SD_COVERAGE_DIR)args.push('--import',pathToFileURL(path.join(root,'tests/helpers/coverage-runtime.mjs')).href);
      args.push(relative);
      const result=spawnSync(process.execPath,args,{
        cwd:root,
        env:isolatedEnvironment(tempRoot),
        stdio:'inherit',
        timeout:Math.max(30000,Number(process.env.TEST_FILE_TIMEOUT_MS)||180000)
      });
      if(result.error)throw result.error;
      if(result.status!==0)process.exit(result.status??1);
      const changed=repositoryDiff(baseline,repositorySnapshot());
      if(changed.length)throw new Error(`Fast test modified the repository: ${changed.slice(0,12).join(', ')}${changed.length>12?` (+${changed.length-12} more)`:''}`);
    }finally{
      fs.rmSync(tempRoot,{recursive:true,force:true});
    }
  }
  console.log(JSON.stringify({status:'PASS',category,tests:files.length},null,2));
}
console.log(JSON.stringify({status:'PASS',suite:target,tests:total,hermetic:true,npmRequired:false},null,2));
