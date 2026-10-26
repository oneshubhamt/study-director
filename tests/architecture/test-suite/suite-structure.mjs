import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RELEASE_TEST_SCRIPTS,RELEASE_TEST_SET} from '../../helpers/release-tests.mjs';
import {BROWSER_TEST_MANIFEST,browserTestDomains,selectedBrowserTests} from '../../helpers/browser-tests.mjs';

// Test inventory and execution topology: one canonical home and one execution route per test.

{ // test-suite-taxonomy
const layers=['unit','integration','browser','architecture'];
const supportRoots=['fixtures','helpers'];
const allowedDomains=new Set([
  'app','library','attachments','backup','build','exports','insights','plans','pwa','review',
  'rich-text','search','security','storage','test-suite','ui'
]);

function executableFiles(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const target=path.join(directory,entry.name);
    if(entry.isDirectory())return executableFiles(target);
    return entry.isFile()&&entry.name.endsWith('.mjs')?[target.split(path.sep).join('/')]:[];
  });
}

const testFiles=[];
const counts={};
for(const layer of layers){
  const directory=path.join('tests',layer);
  assert.ok(fs.statSync(directory).isDirectory(),`missing test layer: ${layer}`);
  const files=executableFiles(directory).sort();
  assert.ok(files.length>0,`${layer} must not be empty`);
  counts[layer]=files.length;
  for(const file of files){
    const relative=file.slice(`tests/${layer}/`.length);
    const parts=relative.split('/');
    assert.equal(parts.length,2,`test must have exactly one authoritative product-domain home: ${file}`);
    const [domain,name]=parts;
    assert.ok(allowedDomains.has(domain),`unknown product domain ${domain}: ${file}`);
    assert.match(name,/^[a-z0-9]+(?:-[a-z0-9]+)*\.mjs$/,`non-semantic test filename: ${file}`);
    assert.ok(!/(?:^|-)(?:sdv[ab]\d|[lr]\d+[a-z0-9.]*)|^n\d+-/i.test(name),`release-era test filename: ${file}`);
    assert.ok(!/(?:^|[-_])(tmp|temp|debug|repro)(?:[-_.]|$)/i.test(name),`diagnostic test leaked into suite: ${file}`);
    testFiles.push(file);
  }
}
for(const support of supportRoots)assert.ok(fs.statSync(path.join('tests',support)).isDirectory(),`missing support root: ${support}`);
assert.equal(fs.existsSync('tests/release-only'),false,'release cadence must not be represented as a structural test type');
assert.deepEqual(fs.readdirSync('tests',{withFileTypes:true}).filter(entry=>entry.isFile()&&entry.name.endsWith('.mjs')),[],'executable tests/runners must live in a layer or helpers');
assert.equal(fs.existsSync('qa'),false,'historical QA evidence must not live in the source tree');
assert.equal(new Set(testFiles).size,testFiles.length,'classified test paths must be unique');

const behavioralSourceAssertionPatterns=[
  /sourceContract\s*\(/,
  /assert\.(?:match|doesNotMatch)\s*\(\s*(?:source|app|worker|workerSource|editor|library|repositories|repository|storage|drive|html|script|codecTs|workerTs|editorSource|limitsSource)\b/,
  /assert\.(?:match|doesNotMatch)\s*\(\s*read\s*\(/,
  /assert\.ok\s*\(\s*(?:source|app|worker|workerSource|editor|library|repositories|repository|storage|drive|html|script)\.includes\s*\(/,
];
for(const file of executableFiles(path.join('tests','integration'))){
  const body=fs.readFileSync(file,'utf8');
  for(const pattern of behavioralSourceAssertionPatterns)
    assert.doesNotMatch(body,pattern,`integration test asserts implementation source shape instead of behavior: ${file}`);
}
const browserSourceAssertionPatterns=[
  /sourceContract\s*\(/,
  /assert\.(?:match|doesNotMatch)\s*\(\s*(?:source|workerSource|editorSource|repositories|repository|bundle|codecTs|workerTs|limitsSource)\b/,
  /assert\.(?:match|doesNotMatch)\s*\(\s*read\s*\(/,
];
for(const file of executableFiles(path.join('tests','browser'))){
  const body=fs.readFileSync(file,'utf8');
  for(const pattern of browserSourceAssertionPatterns)
    assert.doesNotMatch(body,pattern,`browser test asserts implementation source shape instead of behavior: ${file}`);
}

for(const file of RELEASE_TEST_SCRIPTS){
  assert.ok(RELEASE_TEST_SET.has(file));
  assert.ok(testFiles.includes(file),`release-gated test must retain one authoritative layer/domain home: ${file}`);
}
assert.equal(new Set(RELEASE_TEST_SCRIPTS).size,RELEASE_TEST_SCRIPTS.length,'release manifest paths must be unique');

const packageScripts=JSON.parse(fs.readFileSync('package.json','utf8')).scripts||{};
const scripts=JSON.stringify(packageScripts);
assert.doesNotMatch(scripts,/tests\/(?:sdv[ab]\d|n\d+-)/i,'package scripts must not reference release-era test names');
assert.doesNotMatch(scripts,/tests\/(?:_?tmp|.*repro)/i,'package scripts must not reference diagnostics');
for(const layer of ['unit','integration','architecture'])
  assert.equal(packageScripts[`test:${layer}`],`node tests/helpers/run-category.mjs ${layer}`,`${layer} must have one recursive discovery entrypoint`);
const releaseCommands=Object.entries(packageScripts).filter(([name])=>name.startsWith('test:release')).map(([,command])=>command).join(' ');
for(const file of RELEASE_TEST_SCRIPTS)assert.ok(releaseCommands.includes(file),`release manifest test has no canonical package entrypoint: ${file}`);

console.log(JSON.stringify({status:'PASS',tests:testFiles.length,layers:counts,releaseGated:RELEASE_TEST_SCRIPTS.length,domains:[...allowedDomains].sort()},null,2));
}

{ // test-suite-browser-manifest
function browserFiles(directory='tests/browser'){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const target=path.join(directory,entry.name);
    if(entry.isDirectory())return browserFiles(target);
    return entry.isFile()&&entry.name.endsWith('.mjs')?[target.split(path.sep).join('/')]:[];
  });
}

const tiers=['smoke','feature','extended'];
const entries=tiers.flatMap(tier=>BROWSER_TEST_MANIFEST[tier]);
const ids=entries.map(entry=>entry.id);
const scripts=entries.map(entry=>entry.script);
const files=browserFiles().sort();

for(const tier of tiers)assert.ok(Object.isFrozen(BROWSER_TEST_MANIFEST[tier]),`${tier} manifest must be frozen`);
assert.ok(BROWSER_TEST_MANIFEST.smoke.length>=8&&BROWSER_TEST_MANIFEST.smoke.length<=12,'smoke browser QA must remain 8–12 critical journeys');
assert.ok(BROWSER_TEST_MANIFEST.smoke.length<BROWSER_TEST_MANIFEST.feature.length,'feature tier should contain deeper targeted coverage than smoke');
assert.ok(BROWSER_TEST_MANIFEST.extended.length<BROWSER_TEST_MANIFEST.feature.length,'extended tier must remain a small expensive edge/stress set');
assert.equal(new Set(ids).size,ids.length,'browser-test ids must be unique');
assert.equal(new Set(scripts).size,scripts.length,'browser-test scripts must be listed exactly once');
assert.deepEqual([...scripts].sort(),files,'every browser test must be represented exactly once in the canonical manifest');
for(const entry of entries){
  assert.match(entry.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'browser id must be semantic kebab-case');
  assert.match(entry.script,/^tests\/browser\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.mjs$/,'browser path must include one semantic product domain');
  assert.ok(fs.existsSync(entry.script),`browser test is missing: ${entry.script}`);
  assert.ok(Array.isArray(entry.coverage)&&entry.coverage.length>0,`${entry.id} needs coverage metadata`);
  assert.equal(new Set(entry.coverage).size,entry.coverage.length,`${entry.id} coverage metadata must not contain duplicates`);
  for(const tag of entry.coverage)assert.match(tag,/^[a-z0-9]+(?:-[a-z0-9]+)*$/,`${entry.id} coverage tag must be semantic kebab-case`);
  assert.ok(Number.isFinite(entry.timeoutMs)&&entry.timeoutMs>=0&&entry.timeoutMs<=300000,`${entry.id} timeout must be a bounded non-negative duration`);
  assert.equal(typeof entry.alone,'boolean',`${entry.id} must say whether it runs alone`);
  assert.ok(!/(?:regression|legacy|historical|sdv[ab]|^n\d)/i.test(entry.id),`${entry.id} must describe current behavior, not test history`);
  assert.ok(!/(?:sdv[ab]|^n\d)/i.test(path.basename(entry.script)),`${entry.id} must not use release-era naming`);
}
const release=selectedBrowserTests('release');
assert.equal(release.length,entries.length,'release browser QA must include every active browser test');
// Diagnosed load-sensitive tests; tests/README.md says why each one runs alone.
assert.deepEqual(entries.filter(entry=>entry.alone).map(entry=>entry.id).sort(),['pwa-update','site-data-clear'],'only diagnosed contention-sensitive browser tests run alone');
assert.deepEqual(selectedBrowserTests('smoke'),[...BROWSER_TEST_MANIFEST.smoke]);
assert.deepEqual(selectedBrowserTests('feature'),[...BROWSER_TEST_MANIFEST.feature]);
assert.deepEqual(selectedBrowserTests('extended'),[...BROWSER_TEST_MANIFEST.extended]);
for(const domain of browserTestDomains()){
  const filtered=selectedBrowserTests('feature',domain);
  assert.ok(filtered.every(entry=>entry.script.startsWith(`tests/browser/${domain}/`)),`feature domain filter leaked outside ${domain}`);
}
const packageScripts=JSON.parse(fs.readFileSync('package.json','utf8')).scripts||{};
assert.equal(packageScripts['test:browser'],'node tests/helpers/browser-suite.mjs smoke');
assert.equal(packageScripts['test:browser:feature'],'node tests/helpers/browser-suite.mjs feature');
assert.equal(packageScripts['test:browser:extended'],'node tests/helpers/browser-suite.mjs extended');
assert.equal(packageScripts['test:browser:release'],'node tests/helpers/browser-suite.mjs release');

console.log(JSON.stringify({status:'PASS',browserTests:entries.length,tiers:Object.fromEntries(tiers.map(tier=>[tier,BROWSER_TEST_MANIFEST[tier].length])),domains:browserTestDomains()},null,2));
}
