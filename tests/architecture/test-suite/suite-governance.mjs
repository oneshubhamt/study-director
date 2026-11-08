import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {BROWSER_TEST_MANIFEST} from '../../helpers/browser-tests.mjs';
import {RELEASE_TEST_SET} from '../../helpers/release-tests.mjs';
import {validateBrowserQuarantineEntries,validateBrowserQuarantines} from '../../helpers/quarantine.mjs';
import {externalOutputPath,repositoryRoot} from '../../helpers/output-paths.mjs';
import {evaluateBugRegressionPolicy} from '../../helpers/bug-regression-policy.mjs';

const layers=['unit','integration','browser','architecture'];
const generatedRoots=['qa','coverage','.nyc_output','test-results','.study-director-test-artifacts'];
function walk(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const target=path.join(directory,entry.name);
    return entry.isDirectory()?walk(target):entry.isFile()&&entry.name.endsWith('.mjs')?[target.split(path.sep).join('/')]:[];
  });
}
function normalizedSource(file){return fs.readFileSync(file,'utf8').replace(/\r\n?/g,'\n').replace(/[ \t]+$/gm,'').replace(/\n{3,}/g,'\n\n').trim();}
function normalizedFingerprint(file){return crypto.createHash('sha256').update(normalizedSource(file)).digest('hex');}
const tests=layers.flatMap(layer=>walk(`tests/${layer}`)).sort();
assert.ok(tests.length>0,'classified suite must not be empty');
const allowedRoots=new Set([...layers,'fixtures','helpers']);
const actualRoots=fs.readdirSync('tests',{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name);
for(const root of actualRoots)assert.ok(allowedRoots.has(root),`orphan test/support root is not part of the canonical taxonomy: tests/${root}`);
for(const root of allowedRoots)assert.ok(actualRoots.includes(root),`canonical test/support root is missing: tests/${root}`);

// Exact/format-only duplicate files are never legitimate, regardless of layer.
const byFingerprint=new Map();
for(const file of tests){
  const fingerprint=normalizedFingerprint(file),previous=byFingerprint.get(fingerprint);
  assert.equal(previous,undefined,`duplicate test implementation: ${previous} and ${file}`);byFingerprint.set(fingerprint,file);
}

const browserEntries=[...BROWSER_TEST_MANIFEST.smoke.map(entry=>({...entry,tier:'smoke'})),...BROWSER_TEST_MANIFEST.feature.map(entry=>({...entry,tier:'feature'})),...BROWSER_TEST_MANIFEST.extended.map(entry=>({...entry,tier:'extended'}))];
const quarantines=validateBrowserQuarantines({browserEntries});
assert.throws(()=>validateBrowserQuarantineEntries([{script:BROWSER_TEST_MANIFEST.feature[0].script,reason:'Known browser flake under investigation',tracking:'QA-EXPIRED',introducedOn:'2026-08-01',expiresOn:'2026-08-05'}],{now:new Date('2026-08-06T12:00:00Z'),browserEntries}),/EXPIRED browser quarantine/);
assert.throws(()=>validateBrowserQuarantineEntries([{script:BROWSER_TEST_MANIFEST.smoke[0].script,reason:'Synthetic smoke quarantine should fail',tracking:'QA-SMOKE',introducedOn:'2026-08-01',expiresOn:'2026-08-05'}],{now:new Date('2026-08-02T12:00:00Z'),browserEntries}),/Smoke browser tests cannot be quarantined/);
assert.throws(()=>validateBrowserQuarantineEntries([{script:BROWSER_TEST_MANIFEST.feature[0].script,reason:'Impossible calendar date must fail',tracking:'QA-DATE',introducedOn:'2026-02-31',expiresOn:'2026-03-02'}],{now:new Date('2026-02-20T12:00:00Z'),browserEntries}),/introducedOn is invalid/,'calendar-invalid quarantine dates must not normalize silently');

// Every classified test must have exactly one execution route: fast, release, or browser manifest.
const browserScripts=new Set(browserEntries.map(entry=>entry.script));
for(const file of tests){const layer=file.split('/')[1],routes=[];if(layer==='browser'&&browserScripts.has(file))routes.push('browser');if(layer!=='browser'&&!RELEASE_TEST_SET.has(file))routes.push('fast');if(RELEASE_TEST_SET.has(file))routes.push('release');assert.equal(routes.length,1,`orphan or multiply-routed test (${routes.join(', ')||'none'}): ${file}`);}

// QA evidence belongs outside the repository.
for(const directory of generatedRoots)assert.equal(fs.existsSync(directory),false,`generated QA evidence leaked into source tree: ${directory}`);
assert.throws(()=>externalOutputPath(repositoryRoot,'QA output'),/outside the source tree/);
assert.throws(()=>externalOutputPath(path.join(repositoryRoot,'tests','evidence.json'),'QA output'),/outside the source tree/);
assert.doesNotThrow(()=>externalOutputPath(path.join(path.dirname(repositoryRoot),'study-director-evidence.json'),'QA output'));
const gitignore=fs.readFileSync('.gitignore','utf8');
for(const entry of ['node_modules/','dist/','qa/','coverage/','.nyc_output/','test-results/','.study-director-test-artifacts/'])assert.ok(gitignore.split(/\r?\n/).includes(entry),`.gitignore must protect generated output: ${entry}`);

// CI policy.
const fastWorkflow=fs.readFileSync('.github/workflows/qa-fast.yml','utf8'),promotionWorkflow=fs.readFileSync('.github/workflows/qa-promotion.yml','utf8');
assert.match(fastWorkflow,/pull_request:/);assert.match(fastWorkflow,/push:/);assert.match(fastWorkflow,/node tests\/helpers\/run-category\.mjs targeted/,'automatic checks must run the explicit targeted contracts');assert.match(fastWorkflow,/npm ci --ignore-scripts/,'strict compiler and typed lint require the locked toolchain');assert.match(fastWorkflow,/npm run check:types/,'automatic checks must enforce strict TypeScript and typed lint');
assert.match(fastWorkflow,/bug-regression-policy\.mjs/,'bug-like PRs must be machine-checked for regression protection');
// Promotion runs only when started by hand; no push or schedule runs it.
const promotionTriggerBlock=promotionWorkflow.match(/^on:\n([\s\S]*?)^permissions:/m)?.[1]||'';
assert.deepEqual([...promotionTriggerBlock.matchAll(/^  ([a-z_]+):/gm)].map(([,name])=>name),['workflow_dispatch'],'full promotion must start only from Run workflow');
assert.match(promotionWorkflow,/default: false/,'manual browser certification must remain opt-in');
assert.match(promotionWorkflow,/if: inputs\.run_browser\n/,'only explicit browser selection may enable browser certification');
assert.match(promotionWorkflow,/if: inputs\.run_browser && always\(\)/,'the performance gate must follow the same browser-selection policy');
assert.match(promotionWorkflow,/node tests\/helpers\/mutation\.mjs/);
assert.match(promotionWorkflow,/npm run test:release/);
assert.match(promotionWorkflow,/npm run test:coverage:browser/,'promotion QA must collect browser/build runtime coverage');

assert.match(fastWorkflow,/node build\/build\.mjs/);assert.match(fastWorkflow,/node build\/verify-build\.mjs/);
assert.doesNotMatch(fastWorkflow,/npm run test:coverage:browser|browser-suite\.mjs|coverage\.mjs/,'automatic repository checks must not expand to browser QA or coverage');
assert.equal(fs.readFileSync('LICENSE','utf8'),fs.readFileSync('source/legal/LICENSE.txt','utf8'),'repository and served application must retain the same licence');
assert.ok(fs.existsSync('CONTRIBUTING.md'));
const prTemplate=fs.readFileSync('.github/pull_request_template.md','utf8');assert.match(prTemplate,/regression test/i);assert.match(prTemplate,/correct layer/i);
assert.equal(evaluateBugRegressionPolicy({title:'fix: restore rollback',changedFiles:['source/core/backup.ts']}).passed,false);
assert.equal(evaluateBugRegressionPolicy({title:'fix: restore rollback',changedFiles:['source/core/backup.ts','tests/integration/backup/backup-persistence.mjs']}).passed,true);
assert.equal(evaluateBugRegressionPolicy({title:'feat: new theme',changedFiles:['source/app.html']}).required,false);

console.log(JSON.stringify({status:'PASS',tests:tests.length,exactDuplicates:0,quarantines:quarantines.length},null,2));
