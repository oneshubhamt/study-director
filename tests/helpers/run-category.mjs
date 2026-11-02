import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {RELEASE_TEST_SET} from './release-tests.mjs';

// Runs the fast suite (or one category, or chosen files). Each test file runs in
// its own Node process with its own temporary folders and a clean environment;
// up to --jobs files run at once (default: CPU count, at most 4). Every failure
// is reported, not just the first; --bail stops starting new files after one.

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const categories=Object.freeze(['unit','integration','architecture']);
const allowed=new Set([...categories,'fast','targeted']);

const argv=process.argv.slice(2),positional=[];let bail=false,jobsFlag=null;
for(let index=0;index<argv.length;index++){
  const value=argv[index];
  if(value==='--bail')bail=true;
  else if(value==='--jobs')jobsFlag=argv[++index];
  else if(value.startsWith('--jobs='))jobsFlag=value.slice(7);
  else if(value.startsWith('--'))throw new Error(`Unknown option: ${value}`);
  else positional.push(value);
}
const target=String(positional[0]||'fast');
if(!allowed.has(target))throw new Error(`Unknown fast-test target: ${target}`);
const jobs=Number(jobsFlag??process.env.TEST_JOBS??Math.min(4,os.availableParallelism?.()||os.cpus().length||1));
if(!Number.isInteger(jobs)||jobs<1)throw new Error(`--jobs must be a positive whole number; got ${jobsFlag??process.env.TEST_JOBS}`);
const timeoutMs=Math.max(30000,Number(process.env.TEST_FILE_TIMEOUT_MS)||180000);

const selected=target==='targeted'?[...new Set(positional.slice(1).map(file=>file.split(path.sep).join('/')))]:[];
if(target==='targeted'&&!selected.length)throw new Error('Targeted QA requires explicit test paths.');

const ignoredRoots=new Set(['.git','node_modules']);
function discover(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())return discover(file);
    return entry.isFile()&&entry.name.endsWith('.mjs')?[file]:[];
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
  for(const key of ['NODE_OPTIONS','NODE_PATH','SD_ENCRYPTED_TEST','SD_MINIFIED_TEST','SD_TEST_ARTIFACT_DIR','TEST_JOBS'])delete env[key];
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
  const major=Number(process.versions.node.split('.')[0]);
  if(!Number.isInteger(major)||major<20)throw new Error(`Fast tests require Node.js 20+; found ${process.versions.node}. npm is not required.`);
  for(const [name,value] of [['Blob',globalThis.Blob],['structuredClone',globalThis.structuredClone],['crypto',globalThis.crypto],['MessageChannel',globalThis.MessageChannel]]){
    if(value===undefined)throw new Error(`Fast-test runtime is missing ${name}; use a current Node.js runtime. npm is not required.`);
  }
}

const loader=pathToFileURL(path.join(root,'tests/helpers/hermetic-loader.mjs')).href;
const runtime=pathToFileURL(path.join(root,'tests/helpers/hermetic-runtime.mjs')).href;
const coverageRuntime=pathToFileURL(path.join(root,'tests/helpers/coverage-runtime.mjs')).href;

const categoryOf=relative=>relative.split('/')[1];

// One test file in its own process. Output goes to files, not pipes, so it also
// works where subprocess pipes are not allowed, and parallel output never mixes.
function runFile(relative){
  const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-fast-'));
  const captureRoot=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-fast-output-'));
  const stdoutPath=path.join(captureRoot,'stdout'),stderrPath=path.join(captureRoot,'stderr');
  const stdout=fs.openSync(stdoutPath,'w'),stderr=fs.openSync(stderrPath,'w');
  const args=['--no-warnings','--experimental-loader',loader,'--import',runtime];
  // Coverage measures what behaviour tests execute; architecture tests read source.
  if(process.env.SD_COVERAGE_DIR&&categoryOf(relative)!=='architecture')args.push('--import',coverageRuntime);
  args.push(relative);
  const started=performance.now();
  return new Promise(resolve=>{
    let timedOut=false,settled=false;
    const finish=(status,signal,launchError=null)=>{
      if(settled)return;settled=true;clearTimeout(timer);
      fs.closeSync(stdout);fs.closeSync(stderr);
      const read=file=>{try{return fs.readFileSync(file,'utf8');}catch{return '';}};
      const result={relative,status,signal,timedOut,launchError,seconds:(performance.now()-started)/1000,stdout:read(stdoutPath),stderr:read(stderrPath)};
      fs.rmSync(captureRoot,{recursive:true,force:true});fs.rmSync(tempRoot,{recursive:true,force:true});
      resolve(result);
    };
    let child;
    try{child=spawn(process.execPath,args,{cwd:root,env:isolatedEnvironment(tempRoot),stdio:['ignore',stdout,stderr]});}
    catch(error){finish(null,null,error);return;}
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeoutMs);
    child.once('error',error=>finish(null,null,error));
    child.once('exit',(status,signal)=>finish(status,signal));
  });
}

const failureReason=result=>result.launchError?`could not start: ${result.launchError.message}`:result.timedOut?`timed out after ${Math.round(timeoutMs/1000)} s`:result.signal?`stopped by ${result.signal}`:`exit code ${result.status}`;

if(target==='targeted'){
  const available=new Set(categories.flatMap(fastFiles));
  for(const file of selected)if(!available.has(file))throw new Error(`Unknown fast-test path: ${file}`);
}
runtimePreflight();
const files=(target==='targeted'?selected.filter(file=>categories.includes(categoryOf(file))):['fast','targeted'].includes(target)?categories.flatMap(fastFiles):fastFiles(target));
if(!files.length)throw new Error(`No fast ${target} tests found.`);

// Larger files tend to run longer; starting them first shortens the tail.
const queue=[...files].sort((a,b)=>fs.statSync(path.join(root,b)).size-fs.statSync(path.join(root,a)).size||a.localeCompare(b));
const baseline=repositorySnapshot();
const started=performance.now(),results=[],failures=[],running=new Set();
let stopReason=null,repositoryChange=null,ranSinceCleanCheck=new Set();

async function worker(){
  while(queue.length&&!stopReason){
    const relative=queue.shift();running.add(relative);ranSinceCleanCheck.add(relative);
    const result=await runFile(relative);running.delete(relative);results.push(result);
    const passed=!result.launchError&&!result.timedOut&&result.status===0;
    process.stdout.write(`\n[${categoryOf(relative)}] ${relative.slice(`tests/${categoryOf(relative)}/`.length)}  ${passed?'PASS':'FAIL'}  ${result.seconds.toFixed(1)} s\n${result.stdout}${result.stderr}`);
    if(!passed){failures.push({file:relative,reason:failureReason(result),stderr:result.stderr});if(bail)stopReason=stopReason||'bail';}
    const changed=repositoryDiff(baseline,repositorySnapshot());
    if(changed.length&&!repositoryChange){
      repositoryChange={changed,suspects:[...ranSinceCleanCheck,...running].filter((file,index,all)=>all.indexOf(file)===index).sort()};
      stopReason='repository-modified';
    }else if(!changed.length)ranSinceCleanCheck=new Set(running);
  }
}
await Promise.all(Array.from({length:Math.min(jobs,queue.length)},worker));

const seconds=Math.round((performance.now()-started)/100)/10;
for(const category of categories){
  const ran=results.filter(result=>categoryOf(result.relative)===category);
  if(!ran.length)continue;
  const failed=failures.filter(failure=>categoryOf(failure.file)===category).length;
  console.log(JSON.stringify({status:failed?'FAIL':'PASS',category,tests:ran.length,...(failed?{failed}:{})},null,2));
}
const notRun=files.length-results.length;
if(repositoryChange){
  console.error(`\nFast test modified the repository: ${repositoryChange.changed.slice(0,12).join(', ')}${repositoryChange.changed.length>12?` (+${repositoryChange.changed.length-12} more)`:''}`);
  console.error(`Written by one of: ${repositoryChange.suspects.join(', ')}. Rerun those with --jobs 1 to find which.`);
}
if(failures.length||repositoryChange||notRun){
  console.error(`\n${failures.length} of ${results.length} test files failed${notRun?`; ${notRun} not run (${stopReason})`:''}:`);
  for(const failure of failures){
    const tail=failure.stderr.trim().split('\n').slice(-12).join('\n  ');
    console.error(`- ${failure.file}: ${failure.reason}${tail?`\n  ${tail}`:''}`);
  }
  console.log(JSON.stringify({status:'FAIL',suite:target,tests:files.length,ran:results.length,failed:failures.length,repositoryModified:!!repositoryChange,jobs,seconds},null,2));
  process.exit(1);
}
console.log(JSON.stringify({status:'PASS',suite:target,tests:results.length,jobs,seconds,hermetic:true,npmRequired:false},null,2));
