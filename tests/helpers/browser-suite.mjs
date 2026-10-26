import releaseConfig from '../../release.config.mjs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveChromiumExecutable} from './browser-harness.mjs';
import fs from 'node:fs';
import {BROWSER_TEST_MANIFEST,selectedBrowserTests} from './browser-tests.mjs';
import {quarantinedBrowserScripts} from './quarantine.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const chromium=resolveChromiumExecutable();
const timeoutMs=Math.max(30000,Number(process.env.BROWSER_TEST_TIMEOUT_MS)||120000);
const tier=process.argv[2]||process.env.BROWSER_TEST_TIER||'smoke';
const domain=process.argv[3]||process.env.BROWSER_TEST_DOMAIN||'';
const requested=selectedBrowserTests(tier,domain);
const all=[
  ...BROWSER_TEST_MANIFEST.smoke.map(entry=>({...entry,tier:'smoke'})),
  ...BROWSER_TEST_MANIFEST.feature.map(entry=>({...entry,tier:'feature'})),
  ...BROWSER_TEST_MANIFEST.extended.map(entry=>({...entry,tier:'extended'})),
];
const quarantined=quarantinedBrowserScripts({browserEntries:all});
const skipped=requested.filter(entry=>quarantined.has(entry.script));
const entries=requested.filter(entry=>!quarantined.has(entry.script)),scripts=entries.map(entry=>entry.script);
if(new Set(entries.map(entry=>entry.id)).size!==entries.length)throw new Error(`Duplicate browser-test id in ${tier}.`);
for(const entry of all)if(!fs.existsSync(path.join(root,entry.script)))throw new Error(`Browser-test manifest path is missing: ${entry.script}`);
if(!entries.length&&requested.length)throw new Error(`Browser-test tier ${tier}${domain?` for domain ${domain}`:''} has no runnable tests after quarantine.`);
if(!requested.length)throw new Error(`Browser-test tier ${tier}${domain?` for domain ${domain}`:''} selected no tests.`);
if(skipped.length)console.warn(`[browser] QUARANTINED (${skipped.length}): ${skipped.map(entry=>entry.script).join(', ')}`);

function run(script,limitMs=timeoutMs){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[script],{cwd:root,stdio:['inherit','pipe','pipe'],env:{...process.env,CHROMIUM_PATH:chromium}});
    let stdout='',stderr='',timedOut=false;
    child.stdout.on('data',chunk=>{stdout+=chunk;});
    child.stderr.on('data',chunk=>{stderr+=chunk;});
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},limitMs);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',(code,signal)=>{
      clearTimeout(timer);
      if(stdout)process.stdout.write(stdout);
      if(stderr)process.stderr.write(stderr);
      if(timedOut)reject(new Error(`${script} exceeded the ${limitMs} ms browser-test limit.`));
      else if(code===0)resolve();
      else reject(new Error(`${script} failed with ${signal||`exit ${code}`}.`));
    });
  });
}

// Up to 2 tests at once by default (BROWSER_TEST_JOBS=N changes it; 1 is fully
// serial). Tests marked alone always run afterwards with nothing else running.
const jobs=Math.max(1,Math.min(8,Math.floor(Number(process.env.BROWSER_TEST_JOBS)||2)));
const runEntry=entry=>{console.log(`\n[browser] ${entry.script}`);return run(entry.script,Math.max(timeoutMs,Number(entry.timeoutMs)||0));};
const failures=[];
const attempt=async entry=>{try{await runEntry(entry);}catch(error){failures.push(error);}};
const shared=jobs===1?entries:entries.filter(entry=>!entry.alone);let next=0;
await Promise.all(Array.from({length:Math.min(jobs,shared.length)},async()=>{while(next<shared.length)await attempt(shared[next++]);}));
if(jobs>1)for(const entry of entries.filter(entry=>entry.alone))await attempt(entry);
// Run everything, then report every failure together.
if(failures.length)throw new AggregateError(failures,`${failures.length} browser test(s) failed: ${failures.map(error=>error.message).join(' | ')}`);
console.log(JSON.stringify({status:'PASS',release:releaseConfig.release,tier,domain:domain||null,chromium,tests:scripts.length,quarantined:skipped.length,timeoutMs,jobs},null,2));
