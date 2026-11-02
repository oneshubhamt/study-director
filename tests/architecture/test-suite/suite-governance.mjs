import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {BROWSER_TEST_MANIFEST} from '../../helpers/browser-tests.mjs';
import {RELEASE_TEST_SET} from '../../helpers/release-tests.mjs';
import {validateBrowserQuarantineEntries,validateBrowserQuarantines} from '../../helpers/quarantine.mjs';
import {externalOutputPath,repositoryRoot} from '../../helpers/output-paths.mjs';
import {evaluateBugRegressionPolicy} from '../../helpers/bug-regression-policy.mjs';
import {FEATURE_CONTRACTS,FEATURE_DOMAINS} from '../../helpers/feature-contracts.mjs';

const layers=['unit','integration','browser','architecture'];
const generatedRoots=['qa','coverage','.nyc_output','test-results','.study-director-test-artifacts'];
const crossLayerContracts=new Map([
  ['backup/encryption','Integration protects cryptographic/backup behavior; browser protects the user-facing password and file workflow.'],
  ['exports/exports','Integration protects export processing/contracts; browser protects the complete user export workflow.'],
  ['ui/interactions','Integration protects interaction-controller behavior and prompt lifecycle ownership; browser protects real dialogs, guidance, and asynchronous History API traversal ordering.'],
]);
const overlapExceptions=new Map();
const semanticThreshold=0.55;
const structuralContainmentThreshold=0.30;

function walk(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const target=path.join(directory,entry.name);
    return entry.isDirectory()?walk(target):entry.isFile()&&entry.name.endsWith('.mjs')?[target.split(path.sep).join('/')]:[];
  });
}
function normalizedSource(file){return fs.readFileSync(file,'utf8').replace(/\r\n?/g,'\n').replace(/[ \t]+$/gm,'').replace(/\n{3,}/g,'\n\n').trim();}
function normalizedFingerprint(file){return crypto.createHash('sha256').update(normalizedSource(file)).digest('hex');}
function semanticTokens(file){
  const stop=new Set(['assert','equal','true','false','const','await','async','function','return','string','status','pass','error','im'+'port','fr'+'om','node','tests','helpers','source','object','json','console','undefined','includes','length','message','value','values','file','files','path','root','result','results','test']);
  return new Set((normalizedSource(file).match(/[A-Za-z_][A-Za-z0-9_-]{3,}/gu)||[]).map(token=>token.toLowerCase()).filter(token=>!stop.has(token)));
}
function jaccard(a,b){let common=0;for(const item of a)if(b.has(item))common++;return common/(a.size+b.size-common||1);}
function pairKey(a,b){return [a,b].sort().join('|');}
function structuralShingles(file){
  const lines=normalizedSource(file).split('\n').map(line=>line.trim().replace(/\s+/gu,' ')).filter(line=>line&&!line.startsWith('import ')&&!line.startsWith('//')&&!line.startsWith('console.log'));
  return new Set(lines.slice(0,-1).map((line,index)=>`${line}\n${lines[index+1]}`));
}
function containment(a,b){let common=0;for(const item of a)if(b.has(item))common++;return common/(Math.min(a.size,b.size)||1);}

const tests=layers.flatMap(layer=>walk(`tests/${layer}`)).sort();
assert.ok(tests.length>0,'classified suite must not be empty');
const allowedRoots=new Set([...layers,'fixtures','helpers']);
const actualRoots=fs.readdirSync('tests',{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name);
for(const root of actualRoots)assert.ok(allowedRoots.has(root),`orphan test/support root is not part of the canonical taxonomy: tests/${root}`);
for(const root of allowedRoots)assert.ok(actualRoots.includes(root),`canonical test/support root is missing: tests/${root}`);

// Historical release archaeology is forbidden anywhere in the active test system, not merely in filenames.
for(const file of [...tests,...walk('tests/helpers')])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/\bSDV[AB]\d[A-Za-z0-9]*/iu,`historical release token leaked into active test code: ${file}`);

// Exact/format-only duplicate files are never legitimate, regardless of layer.
const byFingerprint=new Map();
for(const file of tests){
  const fingerprint=normalizedFingerprint(file),previous=byFingerprint.get(fingerprint);
  assert.equal(previous,undefined,`duplicate test implementation: ${previous} and ${file}`);byFingerprint.set(fingerprint,file);
}

// High lexical overlap is a maintenance smell. It needs an explicit durable rationale.
const tokens=new Map(tests.map(file=>[file,semanticTokens(file)]));
const actualSemanticExceptions=new Set();
for(let i=0;i<tests.length;i++)for(let j=i+1;j<tests.length;j++){
  const left=tests[i],right=tests[j],score=jaccard(tokens.get(left),tokens.get(right));
  if(score<semanticThreshold)continue;
  const key=pairKey(left,right),rationale=overlapExceptions.get(key);
  assert.ok(rationale&&rationale.length>=32,`probable semantic duplicate (${score.toFixed(3)}): ${left} <> ${right}`);
  actualSemanticExceptions.add(key);
}

const structural=new Map(tests.map(file=>[file,structuralShingles(file)])),actualStructuralExceptions=new Set();
for(let i=0;i<tests.length;i++)for(let j=i+1;j<tests.length;j++){
  const left=tests[i],right=tests[j],score=containment(structural.get(left),structural.get(right));
  if(score<structuralContainmentThreshold)continue;
  const key=pairKey(left,right),rationale=overlapExceptions.get(key);
  assert.ok(rationale&&rationale.length>=32,`probable structural duplicate (${score.toFixed(3)} containment): ${left} <> ${right}`);
  actualStructuralExceptions.add(key);
}
for(const key of overlapExceptions.keys())assert.ok(actualSemanticExceptions.has(key)||actualStructuralExceptions.has(key),`stale overlap exception: ${key}`);

// Same semantic domain/name across layers is allowed only when the layers prove different things.
const byContract=new Map();
for(const file of tests){const [,layer,domain,name]=file.split('/');const key=`${domain}/${name.replace(/\.mjs$/,'')}`;const list=byContract.get(key)||[];list.push({layer,file});byContract.set(key,list);}
const actualCrossLayer=new Set();
for(const [key,entries] of byContract){
  if(entries.length<2)continue;actualCrossLayer.add(key);const rationale=crossLayerContracts.get(key);
  assert.ok(rationale&&rationale.length>=24,`cross-layer duplicate contract needs an explicit rationale: ${key}`);
  assert.equal(new Set(entries.map(entry=>entry.layer)).size,entries.length,`duplicate contract within one layer: ${key}`);
}
for(const key of crossLayerContracts.keys())assert.ok(actualCrossLayer.has(key),`stale cross-layer duplicate exception: ${key}`);

// Durable product contracts must keep one explicit authoritative behavioral home.
const featureIds=new Set(),featureOwners=new Set(),featureDomains=new Set();
for(const feature of FEATURE_CONTRACTS){
  assert.match(feature.id,/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u,`invalid feature-contract id: ${feature.id}`);
  assert.equal(featureIds.has(feature.id),false,`duplicate feature-contract id: ${feature.id}`);featureIds.add(feature.id);
  assert.ok(tests.includes(feature.owner),`feature contract has no classified owner: ${feature.id} -> ${feature.owner}`);
  assert.notEqual(feature.owner.split('/')[1],'architecture',`product behavior cannot be architecture-only: ${feature.id}`);
  featureOwners.add(feature.owner);featureDomains.add(feature.id.split('.')[0]);
}
for(const domain of FEATURE_DOMAINS)assert.ok(featureDomains.has(domain),`durable feature domain has no contract inventory: ${domain}`);
for(const entry of BROWSER_TEST_MANIFEST.smoke)assert.ok(featureOwners.has(entry.script),`smoke workflow lacks an authoritative durable feature contract: ${entry.script}`);

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
assert.match(fastWorkflow,/pull_request:/);assert.match(fastWorkflow,/push:/);assert.match(fastWorkflow,/run: node tests\/helpers\/run-category\.mjs fast\n/,'automatic checks must run the whole fast suite');assert.doesNotMatch(fastWorkflow,/npm (?:ci|install)/);
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
assert.equal(evaluateBugRegressionPolicy({title:'fix: restore rollback',changedFiles:['source/core/backup.js']}).passed,false);
assert.equal(evaluateBugRegressionPolicy({title:'fix: restore rollback',changedFiles:['source/core/backup.js','tests/integration/backup/backup-persistence.mjs']}).passed,true);
assert.equal(evaluateBugRegressionPolicy({title:'feat: new theme',changedFiles:['source/app.html']}).required,false);

console.log(JSON.stringify({status:'PASS',tests:tests.length,exactDuplicates:0,semanticOverlapThreshold:semanticThreshold,structuralContainmentThreshold,overlapExceptions:[...new Set([...actualSemanticExceptions,...actualStructuralExceptions])],crossLayerContracts:[...actualCrossLayer],quarantines:quarantines.length,orphanTests:0,historicalReleaseTokens:0,generatedEvidenceInsideRepository:false,ciGovernance:true,featureContracts:FEATURE_CONTRACTS.length,featureDomains:FEATURE_DOMAINS.length},null,2));
