import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {captureOutcome} from './subprocess.mts';
import {classify,parseEvidence} from './mutation-evidence.mts';
import type {ChildOutcome,MutationOutcome} from './mutation-evidence.mts';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
type Mutation={id:string;file:string;find:string;replace:string;tests:readonly string[]};
const mutations:readonly Mutation[]=Object.freeze([
  Object.freeze({id:'canonical-sorts-object-keys',file:'source/core/canonical.ts',find:'Object.keys(input).sort()',replace:'Object.keys(input)',tests:Object.freeze(['tests/unit/app/canonical.mts'])}),
  Object.freeze({id:'save-lane-retries-only-current-value',file:'source/core/save-lane.ts',find:'if(sequence===taken)',replace:'if(true)',tests:Object.freeze(['tests/integration/storage/save-lane.mjs'])}),
  Object.freeze({
    id:'settlement-clears-its-deadline',file:'source/core/operation-lifecycle.ts',
    find:'if(timer!==null)clear(timer);',replace:'if(false)clear(timer);',
    tests:Object.freeze(['tests/unit/app/operation-lifecycle.mjs'])
  }),
  Object.freeze({
    id:'diagnostic-history-keeps-live-operations',file:'source/core/backup-operation-diagnostics.ts',
    find:"records=records.filter(row=>row.status==='running'||keep.has(row));",replace:'records=records.filter(row=>keep.has(row));',
    tests:Object.freeze(['tests/unit/backup/backup-operation-diagnostics.mjs'])
  }),
  Object.freeze({
    id:'partial-integrity-remains-unfinished',file:'source/core/operation-lifecycle.ts',
    find:'details.complete===false',replace:'false',
    tests:Object.freeze(['tests/unit/app/operation-lifecycle.mjs'])
  }),
  Object.freeze({
    id:'encrypted-backup-password-verifier-is-enforced',file:'portable/stream-encryption.ts',
    find:"if(!await crypto.subtle.verify('HMAC',hmac,bytes.slice(32),VERIFIER_PROOF))throw invalid('The password is incorrect.','BACKUP_AUTH_FAILED');",replace:"if(false)throw invalid('The password is incorrect.','BACKUP_AUTH_FAILED');",
    tests:Object.freeze(['tests/integration/backup/encryption.mjs'])
  }),
  Object.freeze({
    id:'backup-chunk-integrity-is-enforced',file:'source/core/backup-codec.ts',
    find:'if(checksum!==entry.checksum)throw new Error(`Backup chunk ${entry.seq} failed its integrity check.`);',
    replace:'if(false)throw new Error(`Backup chunk ${entry.seq} failed its integrity check.`);',
    tests:Object.freeze(['tests/integration/backup/portable-backup.mjs'])
  }),
  Object.freeze({
    id:'attachment-metadata-failure-rolls-references-back',file:'source/core/attachments.ts',
    find:'if(!referenceChange?.rollback)return error;',replace:'return error;',
    tests:Object.freeze(['tests/integration/attachments/attachment-deletion.mjs'])
  }),
  Object.freeze({
    id:'restore-verifies-committed-saved-days',file:'source/core/backup.ts',
    find:'if(!Canonical.same(byDate.get(record.date),sanitizeCurrentDailyRecord(record)))throw new Error(`Post-restore verification failed for saved day ${record.date}.`);',
    replace:'if(false)throw new Error(`Post-restore verification failed for saved day ${record.date}.`);',
    tests:Object.freeze(['tests/integration/backup/backup-persistence.mjs'])
  }),
  Object.freeze({
    id:'reconciliation-verifies-committed-saved-days',file:'source/core/backup.ts',
    find:'if(!intended||!committed||!Canonical.same(committed,intended))throw new Error(`Saved-Day reconciliation commit did not match the resolved state for ${record.date}.`);',
    replace:'if(false)throw new Error(`Saved-Day reconciliation commit did not match the resolved state for ${record.date}.`);',
    tests:Object.freeze(['tests/integration/backup/backup-persistence.mjs'])
  }),
  Object.freeze({
    id:'library-clear-restores-durable-journal',file:'source/core/library-clear.ts',
    find:'await ports.restore(journal.payload);',replace:'await Promise.resolve();',
    tests:Object.freeze(['tests/integration/library/library-clear.mjs'])
  }),
  // The rule-based tests: a sync keeps the other edit, Hourly keeps only
  // versions whose notes changed, and a backward clock jump moves the timer's start.
  Object.freeze({
    id:'sync-keeps-the-other-edit',file:'source/core/backup.ts',
    find:'held.kept.text=sides.incomingNewer?conflict.localValue:conflict.incomingValue;',replace:'held.kept.text=sides.incomingNewer?conflict.incomingValue:conflict.localValue;',
    tests:Object.freeze(['tests/integration/backup/sync-shared-base.mjs'])
  }),
  Object.freeze({
    id:'hourly-keeps-only-changed-notes',file:'source/core/managed-repository.ts',
    find:'if(hour(row)===hour(after)||notes(row)&&notes(row)===notes(after))continue;',replace:'if(hour(row)===hour(after))continue;',
    tests:Object.freeze(['tests/unit/backup/repository-retention.mjs'])
  }),
  Object.freeze({
    id:'clock-jump-rebases-timer-start',file:'source/core/timer-engine.ts',
    find:'TimerState.patchRuntime({startMs:Number(TimerState.runtime.startMs)+delta});',replace:'void delta;',
    tests:Object.freeze(['tests/unit/app/timer-engine-logic.mjs'])
  })
]);

const witnesses:Readonly<Record<string,readonly string[]>>={
  "canonical-sorts-object-keys": [
    "assert.equal(canonical.signature(original),"
  ],
  "save-lane-retries-only-current-value": [
    "assert.equal(newerSettled,true,",
    "assert.equal(finalSettled,true,",
    "assert.deepEqual(writes,['old','new'],'no superseded value"
  ],
  "settlement-clears-its-deadline": [
    "assert.equal(timers.size,0,'settled operations clear the deadline');"
  ],
  "diagnostic-history-keeps-live-operations": [
    "assert.equal(concurrent.snapshot().find(row=>row.id===foregroundId)?.status,'running'"
  ],
  "partial-integrity-remains-unfinished": [
    "assert.equal(lifecycle.outcome(details),expected,JSON.stringify(details));"
  ],
  "encrypted-backup-password-verifier-is-enforced": [
    "await assert.rejects(verifyPasswordVerifier(verifier,await passwordKey('wrong password'))"
  ],
  "backup-chunk-integrity-is-enforced": [
    "await assert.rejects(()=>codec.inspectCurrent(codec.createV10Container(tamperedMetadata"
  ],
  "attachment-metadata-failure-rolls-references-back": [
    "assert.equal(s.rollbacks,1,'Metadata failure must roll reference surgery back.');"
  ],
  "restore-verifies-committed-saved-days": [
    "assert.ok(finalVerificationFailure instanceof Error);",
    "assert.match(finalVerificationFailure.message,/Post-restore verification failed for saved day/u);"
  ],
  "reconciliation-verifies-committed-saved-days": [
    "assert.ok(verificationFailure instanceof Error);",
    "assert.match(verificationFailure.message,/Saved-Day reconciliation commit did not match the resolved state/u);"
  ],
  "library-clear-restores-durable-journal": [
    "assert.equal(t.state().restored,1,'metadata failure restores journaled state');",
    "assert.equal(t.state().restored,1,'startup replays journaled state');"
  ],
  "sync-keeps-the-other-edit": [
    "assert.equal(keptNote.kept.text,'one, A again",
    "assert.equal(held[0].kept.text,older.text,label);"
  ],
  "hourly-keeps-only-changed-notes": [
    "assert.ok(!matches,'an Hourly version differs from the next one kept in hour and notes');",
    "assert.deepEqual(hourlyOf(repository.selectRetention(changes,"
  ],
  "clock-jump-rebases-timer-start": [
    "assert.equal(timerState.runtime.startMs,wakeNow-100000);"
  ]
};

function isolatedEnvironment(tempRoot:string):NodeJS.ProcessEnv{
  const env={...process.env};
  for(const key of ['NODE_OPTIONS','NODE_PATH','NODE_V8_COVERAGE','SD_COVERAGE_DIR','SD_ENCRYPTED_TEST','SD_MINIFIED_TEST','SD_TEST_ARTIFACT_DIR','SD_CASE_SEED','SD_CASE_FAMILY'])delete env[key];
  const directories={HOME:path.join(tempRoot,'home'),TMPDIR:path.join(tempRoot,'tmp'),XDG_CACHE_HOME:path.join(tempRoot,'cache'),SD_TEST_ARTIFACT_DIR:path.join(tempRoot,'artifacts')};
  Object.assign(env,directories,{TZ:'UTC',TERM:'dumb',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',NO_COLOR:'1',FORCE_COLOR:'0',CI:'1',TEMP:directories.TMPDIR,TMP:directories.TMPDIR,SD_ENCRYPTED_TEST:'0',SD_MINIFIED_TEST:'0',SD_MUTATION_EVIDENCE:path.join(tempRoot,'exception.json')});
  for(const directory of Object.values(directories))fs.mkdirSync(directory,{recursive:true});
  return env;
}
function uniqueIndex(source:string,anchor:string,label:string):number{
  const first=source.indexOf(anchor);
  if(first<0||first!==source.lastIndexOf(anchor))throw new Error(`${label}: anchor missing or not unique: ${anchor}`);
  return first;
}
function applyMutation(clone:string,mutation:Mutation){
  const target=path.join(clone,mutation.file),source=fs.readFileSync(target,'utf8');
  const first=uniqueIndex(source,mutation.find,mutation.id);
  const changed=source.slice(0,first)+mutation.replace+source.slice(first+mutation.find.length);
  fs.writeFileSync(target,changed);
  const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
  return {before:digest(source),after:digest(changed)};
}
function copyRepository(target:string){
  fs.cpSync(root,target,{recursive:true,filter:source=>{
    const relative=path.relative(root,source).split(path.sep).join('/');
    return relative!=='.git'&&!relative.startsWith('.git/')&&relative!=='node_modules'&&!relative.startsWith('node_modules/');
  }});
}
function runTest(clone:string,test:string,tempRoot:string,timeout:number):ChildOutcome{
  const loader=pathToFileURL(path.join(clone,'tests/helpers/hermetic-loader.mjs')).href;
  const runtime=pathToFileURL(path.join(clone,'tests/helpers/hermetic-runtime.mjs')).href;
  const observer=pathToFileURL(path.join(clone,'tests/helpers/mutation-observer.mts')).href;
  const env=isolatedEnvironment(tempRoot);
  const result=captureOutcome(process.execPath,['--no-warnings','--experimental-loader',loader,'--import',observer,'--import',runtime,test],{cwd:clone,env,encoding:'utf8',timeout,maxBuffer:8*1024*1024});
  const evidenceFile=path.join(tempRoot,'exception.json');
  return {...result,evidence:fs.existsSync(evidenceFile)?parseEvidence(fs.readFileSync(evidenceFile,'utf8')):null};
}
type RunRecord={test:string;outcome:MutationOutcome;status:number|null;signal:string|null;error:string|null;evidence:ChildOutcome['evidence'];stdout:string;stderr:string};
function record(test:string,result:ChildOutcome,outcome:MutationOutcome):RunRecord{
  return {test,outcome,status:result.status,signal:result.signal,error:result.error?.message??null,evidence:result.evidence,stdout:result.stdout,stderr:result.stderr};
}
function runMutation(mutation:Mutation,anchors:readonly string[],timeout=240000){
  const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-mutant-')),clone=path.join(tempRoot,'repo');
  const controls:RunRecord[]=[],attempts:RunRecord[]=[];
  let outcome:MutationOutcome='harness-failure',source:{before:string;after:string}|null=null,error:string|null=null;
  try{
    copyRepository(clone);
    const targets=mutation.tests.map(test=>{
      const file=path.join(clone,test),text=fs.readFileSync(file,'utf8');
      const lines=anchors.map(anchor=>text.slice(0,uniqueIndex(text,anchor,test)).split('\n').length);
      return {test,file,lines};
    });
    for(const [i,target] of targets.entries()){
      const result=runTest(clone,target.test,path.join(tempRoot,'control-'+i),timeout);
      const verdict=classify(result,target,true);controls.push(record(target.test,result,verdict));
      if(verdict!=='passed'){outcome=verdict;return {id:mutation.id,file:mutation.file,find:mutation.find,replace:mutation.replace,source,controls,attempts,outcome,error};}
    }
    source=applyMutation(clone,mutation);
    outcome='survived';
    for(const [i,target] of targets.entries()){
      const result=runTest(clone,target.test,path.join(tempRoot,'mutant-'+i),timeout);
      const verdict=classify(result,target,false);attempts.push(record(target.test,result,verdict));
      if(verdict!=='survived'){outcome=verdict;break;}
    }
  }catch(failure){outcome='harness-failure';error=failure instanceof Error?failure.message:String(failure);}
  finally{fs.rmSync(tempRoot,{recursive:true,force:true});}
  return {id:mutation.id,file:mutation.file,find:mutation.find,replace:mutation.replace,source,controls,attempts,outcome,error};
}
const requested=process.argv.slice(2);
if(requested.includes('--probe')){
  if(requested.length!==1)throw new Error('--probe must be used alone.');
  const test='tests/unit/app/canonical.mts',canonical=mutations[0]!;
  const anchor=witnesses[canonical.id]!;
  const importLine="import assert from 'node:assert/strict';";
  const probe=(id:string,replace:string,expected:MutationOutcome,timeout?:number)=>{
    const result=runMutation({id,file:test,find:importLine,replace,tests:[test]},anchor,timeout);
    console.log(JSON.stringify({...result,expected}));
    if(result.outcome!==expected)process.exitCode=1;
  };
  const noOp=runMutation({...canonical,id:'probe-no-op',replace:canonical.find},anchor);
  const real=runMutation(canonical,anchor);
  console.log(JSON.stringify({...noOp,expected:'survived'}));
  console.log(JSON.stringify({...real,expected:'killed'}));
  if(noOp.outcome!=='survived'||real.outcome!=='killed')process.exitCode=1;
  probe('probe-missing-import',importLine+" import './missing-mutation-probe.mjs';",'setup-failure');
  probe('probe-unrelated-assertion',importLine+" assert.fail('unrelated probe');",'unrelated-failure');
  probe('probe-unsettled-await',importLine+' await new Promise(()=>{});','unsettled-await');
  probe('probe-timeout',importLine+' await new Promise(resolve=>setTimeout(resolve,60000));','timeout',5000);
}else{
  const selected=requested.length?mutations.filter(mutation=>requested.includes(mutation.id)):mutations;
  if(requested.length&&selected.length!==requested.length)throw new Error(`Unknown or repeated mutation id. Available: ${mutations.map(item=>item.id).join(', ')}`);
  const results=selected.map(mutation=>{
    const anchors=witnesses[mutation.id];
    if(!anchors)throw new Error(`No intended assertions for ${mutation.id}`);
    const result=runMutation(mutation,anchors);
    console.log(JSON.stringify({...result,replay:`npm run test:mutation -- ${mutation.id}`}));
    console.log(`${result.outcome.toUpperCase()} ${mutation.id}`);
    return result;
  });
  const failed=results.filter(result=>result.outcome!=='killed');
  console.log(JSON.stringify({status:failed.length?'FAIL':'PASS',mutants:results.length,killed:results.length-failed.length,failed:failed.map(({id,outcome})=>({id,outcome}))},null,2));
  if(failed.length)process.exitCode=1;
}
