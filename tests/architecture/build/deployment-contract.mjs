import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {captureProcess} from '../../helpers/subprocess.mjs';
import {renderBuild,validateBuild} from '../../../build/build.mjs';

const root=path.resolve(new URL('../../..',import.meta.url).pathname);
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const build=renderBuild();assert.equal(validateBuild(build),true);
const manifest=JSON.parse(read('source/platform/manifest.webmanifest'));
const merge=JSON.parse(read('source/platform/firebase-hosting-headers.merge.json'));

assert.ok(build.deployment.has('firebase-hosting-headers.merge.json'));
assert.equal(build.deployment.has('firebase.json'),false,'generated Firebase project configuration must remain outside public build output');
assert.equal(Object.prototype.hasOwnProperty.call(merge.hosting,'public'),false,'the merge file must not replace the existing public directory setting');
const headers=new Map(merge.hosting.headers.map(item=>[item.source,new Map(item.headers.map(row=>[row.key.toLowerCase(),row.value]))]));
assert.match(headers.get('/sw.js').get('cache-control'),/no-cache.*no-store.*must-revalidate/);
assert.match(headers.get('/index.html').get('cache-control'),/no-cache.*must-revalidate/);
assert.match(headers.get('/manifest.webmanifest').get('content-type'),/application\/manifest\+json/);
assert.match(headers.get('/sd.*.js').get('cache-control'),/immutable/);
assert.match(headers.get('/assets/**').get('cache-control'),/immutable/);

assert.deepEqual(manifest.related_applications,[{platform:'webapp',url:'./manifest.webmanifest',id:'./'}]);
assert.equal(manifest.prefer_related_applications,false);

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-stage-'));
const isolatedRoot=path.join(temp,'repo');
try{
  fs.cpSync(root,isolatedRoot,{recursive:true,filter:source=>{
    const relative=path.relative(root,source).split(path.sep)[0];
    return !['dist','node_modules','.git','tests'].includes(relative);
  }});
  const staged=captureProcess(process.execPath,['build/stage-firebase.mjs'],{cwd:isolatedRoot,encoding:'utf8'});
  assert.equal(staged.status,0,staged.stderr||staged.stdout);
  const firebaseStage=path.join(isolatedRoot,'dist','firebase-project'),publicDir=path.join(firebaseStage,'public');
  const listFiles=(directory,prefix='')=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const relative=path.posix.join(prefix,entry.name),absolute=path.join(directory,entry.name);
    return entry.isDirectory()?listFiles(absolute,relative):[relative];
  });
  assert.ok(fs.existsSync(path.join(firebaseStage,'firebase-hosting-headers.merge.json')));
  assert.ok(fs.existsSync(path.join(firebaseStage,'firebase.json')));
  assert.ok(fs.existsSync(path.join(firebaseStage,'firebase.enforcement-candidate.json')),'staging must include the Trusted Types enforcement candidate');
  assert.ok(fs.existsSync(path.join(firebaseStage,'.firebaserc')));
  assert.ok(fs.existsSync(path.join(firebaseStage,'README.md')));
  assert.ok(fs.existsSync(path.join(publicDir,'index.html')));
  assert.ok(fs.existsSync(path.join(publicDir,'assets','icons','icon-192.png')));
  assert.equal(fs.existsSync(path.join(publicDir,'firebase.json')),false);
  assert.equal(fs.existsSync(path.join(publicDir,'.firebaserc')),false);
    const firebaseConfig=JSON.parse(fs.readFileSync(path.join(firebaseStage,'firebase.json'),'utf8'));
    const enforcementConfig=JSON.parse(fs.readFileSync(path.join(firebaseStage,'firebase.enforcement-candidate.json'),'utf8'));
    const firebaseRc=JSON.parse(fs.readFileSync(path.join(firebaseStage,'.firebaserc'),'utf8'));
  const renderedMerge=JSON.parse(build.deployment.get('firebase-hosting-headers.merge.json'));
  assert.equal(firebaseConfig.hosting.public,'public');
  assert.deepEqual(firebaseConfig.hosting.rewrites,[{source:'**',destination:'/index.html'}]);
  assert.deepEqual(firebaseConfig.hosting.headers,renderedMerge.hosting.headers);
  assert.equal(firebaseRc.projects.default,'study-director');
  const defaultHeaders=new Map(firebaseConfig.hosting.headers.flatMap(rule=>rule.headers.map(header=>[header.key,header.value])));
  const enforcementHeaders=new Map(enforcementConfig.hosting.headers.flatMap(rule=>rule.headers.map(header=>[header.key,header.value])));
  assert.equal(defaultHeaders.has('Content-Security-Policy-Report-Only'),false);assert.match(defaultHeaders.get('Content-Security-Policy'),/require-trusted-types-for 'script'/,'default Firebase config must enforce Trusted Types');
  assert.equal(enforcementHeaders.has('Content-Security-Policy-Report-Only'),false,'enforcement candidate must remove the report-only Trusted Types header');
  assert.match(enforcementHeaders.get('Content-Security-Policy')||'',/require-trusted-types-for 'script'/);
  assert.match(enforcementHeaders.get('Content-Security-Policy')||'',/trusted-types sd-inert-html sd-assets sd-legal-html sd-insights-worker sd-google-signin/);
  assert.deepEqual(listFiles(publicDir).sort(),[...build.deployment.keys()].filter(name=>name!=='firebase-hosting-headers.merge.json').sort(),'the staged public directory must contain only the current release inventory');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}

console.log(JSON.stringify({
  status:'PASS',selfContainedFirebaseProject:true,cacheHeaderMerge:true,samePwaManifestRelation:true,trustedTypesCandidate:true
},null,2));
