import {coverageSelection} from '../../helpers/coverage-selection.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {builtinModules} from 'node:module';
import {RELEASE_TEST_SET} from '../../helpers/release-tests.mjs';
import {spawnSync} from 'node:child_process';
import {Worker} from 'node:worker_threads';

// Test-execution policy: behavioral layers execute behavior and the fast suite remains hermetic at source and runtime boundaries.

{ // behavioral-test-policy
function filesUnder(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const target=path.join(directory,entry.name);
    return entry.isDirectory()?filesUnder(target):entry.isFile()&&/\.(?:mjs|mts)$/u.test(entry.name)?[target]:[];
  });
}

const violations=[];
const behavioralFiles=['unit','integration','browser'].flatMap(layer=>filesUnder(`tests/${layer}`));
for(const file of behavioralFiles){
  const source=fs.readFileSync(file,'utf8');
  const tainted=new Set();
  for(const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*\breadFileSync\s*\(/g))tainted.add(match[1]);
  if(/\b(?:const|let|var)\s+read\s*=\s*[^;\n]*readFileSync/.test(source)){
    for(const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*read\s*\(\s*['"](?:source|rich-text|portable|build|vendor)\//g))tainted.add(match[1]);
  }
  let changed=true;
  while(changed){
    changed=false;
    for(const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\.(?:match|slice|replace|replaceAll)\s*\(/g)){
      if(tainted.has(match[2])&&!tainted.has(match[1])){tainted.add(match[1]);changed=true;}
    }
  }
  for(const name of tainted){
    const q=name.replace(/[$]/g,'\\$&');
    const forbidden=[
      new RegExp(`assert\\.(?:match|doesNotMatch)\\(\\s*${q}\\b`),
      new RegExp(`assert\\.(?:ok|equal|strictEqual)\\([^\\n;]*\\b${q}\\.includes\\(`),
      new RegExp(`assert\\.(?:ok|equal|strictEqual)\\([^\\n;]*\\.test\\(\\s*${q}\\b`)
    ];
    if(forbidden.some(pattern=>pattern.test(source)))violations.push(`${file}: static assertion over source variable ${name}`);
  }
  if(/assert\.(?:match|doesNotMatch)\(\s*(?:read|fs\.readFileSync)\s*\(/.test(source))violations.push(`${file}: direct source-text assertion`);
}

assert.deepEqual(violations,[],`Behavioral tests must execute behavior rather than assert source text:\n${violations.join('\n')}`);
console.log(JSON.stringify({status:'PASS',policy:'behavioral-layers-execute-behavior',files:behavioralFiles.length},null,2));
}

{ // fast-suite-hermeticity
const builtin=new Set(builtinModules.flatMap(name=>[name,`node:${name}`]));
const forbiddenNetworkBuiltins=new Set(['http','https','http2','net','tls','dns','dns/promises','dgram','cluster','node:http','node:https','node:http2','node:net','node:tls','node:dns','node:dns/promises','node:dgram','node:cluster']);
function filesUnder(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const target=path.join(directory,entry.name);
    return entry.isDirectory()?filesUnder(target):entry.isFile()&&/\.(?:mjs|mts)$/u.test(entry.name)?[target.split(path.sep).join('/')]:[];
  });
}
const fastFiles=['unit','integration','architecture'].flatMap(layer=>filesUnder(`tests/${layer}`)).filter(file=>!RELEASE_TEST_SET.has(file));
const violations=[];
for(const file of fastFiles){
  const source=fs.readFileSync(file,'utf8');
  for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\()\s*['"]([^'"]+)['"]/g)){
    const specifier=match[1];
    if(forbiddenNetworkBuiltins.has(specifier))violations.push(`${file}: network builtin ${specifier}`);
    else if(!builtin.has(specifier)&&!specifier.startsWith('.')&&!specifier.startsWith('/')&&!specifier.startsWith('file:'))violations.push(`${file}: installed package ${specifier}`);
  }
  if(/\b(?:spawn|spawnSync|execFile|execFileSync|fork)\s*\(/u.test(source)&&!file.endsWith('suite-policy.mjs'))violations.push(`${file}: child process invocation`);
  if(/(?:^|[^\w$.])(?:exec|execSync)\s*\(/um.test(source))violations.push(`${file}: shell execution`);
  if(/\b(?:writeFile|writeFileSync|appendFile|appendFileSync|rename|renameSync|unlink|unlinkSync)\s*\([^\n]*(?:process\.cwd\(\)|['"](?:source|rich-text|portable|build|dist|tests)\/)/u.test(source))violations.push(`${file}: repository write`);
}
assert.deepEqual(violations,[],`Fast tests must be dependency-free, offline and repository-clean:\n${violations.join('\n')}`);

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(pkg.scripts?.test,'node tests/helpers/run-category.mjs fast','npm test must be a thin wrapper over the dependency-free Node runner.');
assert.equal(pkg.scripts?.['test:fast'],'node tests/helpers/run-category.mjs fast');
assert.equal(pkg.scripts?.['test:coverage'],'node tests/helpers/coverage.mjs','coverage must remain stock-Node and npm-package independent');
assert.equal(pkg.scripts?.['test:mutation'],'node tests/helpers/mutation.mjs','mutation testing must remain stock-Node and npm-package independent');
const runner=fs.readFileSync('tests/helpers/run-category.mjs','utf8');
assert.match(runner,/hermetic-loader\.mjs/);
assert.match(runner,/hermetic-runtime\.mjs/);
const runtime=fs.readFileSync('tests/helpers/hermetic-runtime.mjs','utf8'),loader=fs.readFileSync('tests/helpers/hermetic-loader.mjs','utf8');
assert.match(runtime,/spawnSync/);assert.match(runtime,/childProcess\[name\]/);assert.match(runtime,/hermetic-worker\.cjs/);assert.match(loader,/node:http2/);assert.match(loader,/node:dns\/promises/);
assert.match(runner,/repositoryDiff\(baseline,repositorySnapshot\(\)\)/);
assert.match(runner,/SD_ENCRYPTED_TEST:'0',SD_MINIFIED_TEST:'0'/);
assert.match(runner,/Node\.js 22\.23\.4\+/);

console.log(JSON.stringify({status:'PASS',policy:'fast-suite-hermetic',fastTests:fastFiles.length,npmRequired:false,networkAllowed:false,repositoryWritesAllowed:false},null,2));
}

{ // hermetic-runtime-enforcement
assert.throws(()=>spawnSync(process.execPath,['-e','process.exit(0)']),/Fast tests cannot use child_process\.spawnSync/,'fast tests must not escape through child Node processes');
const networkError=await new Promise((resolve,reject)=>{
  const worker=new Worker("require('node:http')",{eval:true});
  worker.once('error',resolve);worker.once('exit',code=>{if(code===0)reject(new Error('worker unexpectedly loaded node:http'));});
});
assert.match(String(networkError?.message||networkError),/cannot load network-capable builtin module/,'worker threads must inherit hermetic network restrictions');
console.log(JSON.stringify({status:'PASS',childProcessesBlocked:true,workerNetworkBlocked:true}));
}


{ // focused coverage must never imply full-suite certification
  assert.equal(coverageSelection([]).targeted,false);
  const focused=coverageSelection(['--test','tests/unit/app/canonical.mts','--file','source/core/canonical.ts','--json','/tmp/coverage.json']);
  assert.equal(focused.targeted,true);assert.deepEqual(focused.tests,['tests/unit/app/canonical.mts']);assert.deepEqual(focused.files,['source/core/canonical.ts']);
  for(const args of [['--test','only-test'],['--file','only-source'],['--test'],['--typo','value'],['--json','a','--json','b']])assert.throws(()=>coverageSelection(args));
}
