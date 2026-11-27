import {jsonObject,jsonFile,jsonArray,jsonString,hostingHeaders} from './read-verification.mts';
import {readRuntimeSource} from '../../helpers/runtime-source.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {captureProcess} from '../../helpers/subprocess.mts';
import {renderBuild,validateBuild} from '../../../build/build.mts';

const root=path.resolve(new URL('../../..',import.meta.url).pathname);
const read=(relative:string)=>readRuntimeSource(path.join(root,relative));
const sourceCommit='a'.repeat(40),previousSourceCommit=process.env['SD_SOURCE_COMMIT'];process.env['SD_SOURCE_COMMIT']=sourceCommit;
const build=renderBuild();assert.equal(validateBuild(build),true);assert.equal(build.identity.sourceCommit,sourceCommit);
const manifest=jsonObject(JSON.parse(read('source/platform/manifest.webmanifest')) as unknown);
const merge=jsonObject(JSON.parse(read('source/platform/firebase-hosting-headers.merge.json')) as unknown);

assert.ok(build.deployment.has('firebase-hosting-headers.merge.json'));
const deploymentIndex=build.deployment.get(build.identity.main),richTextName=build.externalNames.deployment.get('rich-text');
assert.ok(typeof deploymentIndex==='string');assert.ok(deploymentIndex.includes(`<link rel="preload" as="script" href="${richTextName}">`),'deployment must preload the blocking RichText runtime');
assert.equal(build.deployment.has('firebase.json'),false,'generated Firebase project configuration must remain outside public build output');
assert.equal(Object.prototype.hasOwnProperty.call(jsonObject(merge['hosting']),'public'),false,'the merge file must not replace the existing public directory setting');
const headers=new Map(hostingHeaders(merge).map(item=>[item.source,new Map(item.headers.map(row=>[row.key.toLowerCase(),row.value]))]));
assert.match(headers.get('/sw.js')?.get('cache-control')??'',/no-cache.*no-store.*must-revalidate/);
assert.match(headers.get('/index.html')?.get('cache-control')??'',/no-cache.*must-revalidate/);
assert.match(headers.get('/manifest.webmanifest')?.get('content-type')??'',/application\/manifest\+json/);
assert.match(headers.get('/sd.*.js')?.get('cache-control')??'',/immutable/);
assert.match(headers.get('/assets/**')?.get('cache-control')??'',/immutable/);

assert.deepEqual(manifest['related_applications'],[{platform:'webapp',url:'./manifest.webmanifest',id:'./'}]);
assert.equal(manifest['prefer_related_applications'],false);

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-stage-'));
const isolatedRoot=path.join(temp,'repo');
try{
  fs.cpSync(root,isolatedRoot,{recursive:true,filter:source=>{
    const relative=path.relative(root,source).split(path.sep)[0];
    return !['dist','node_modules','.git','tests'].includes(relative??'');
  }});
  const staged=captureProcess(process.execPath,['build/stage-firebase.mjs'],{cwd:isolatedRoot,encoding:'utf8',env:{...process.env,SD_SOURCE_COMMIT:sourceCommit}});
  assert.equal(staged.status,0,staged.stderr||staged.stdout);
  const firebaseStage=path.join(isolatedRoot,'dist','firebase-project'),publicDir=path.join(firebaseStage,'public');
  const listFiles=(directory:string,prefix=''):string[]=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const relative=path.posix.join(prefix,entry.name),absolute=path.join(directory,entry.name);
    return entry.isDirectory()?listFiles(absolute,relative):[relative];
  });
  assert.ok(fs.existsSync(path.join(firebaseStage,'firebase-hosting-headers.merge.json')));
  assert.ok(fs.existsSync(path.join(firebaseStage,'firebase.json')));
  assert.ok(fs.existsSync(path.join(firebaseStage,'firebase.enforcement-candidate.json')),'staging must include the Trusted Types enforcement candidate');
  assert.ok(fs.existsSync(path.join(firebaseStage,'.firebaserc')));
  assert.ok(fs.existsSync(path.join(firebaseStage,'README.md')));
  assert.ok(fs.existsSync(path.join(publicDir,'index.html')));
  assert.ok(readRuntimeSource(path.join(publicDir,'index.html')).includes(`<meta name="study-director-source-commit" content="${sourceCommit}">`),'staged app must carry exact source commit provenance');
  assert.ok(fs.existsSync(path.join(publicDir,'assets','icons','icon-192.png')));
  assert.equal(fs.existsSync(path.join(publicDir,'firebase.json')),false);
  assert.equal(fs.existsSync(path.join(publicDir,'.firebaserc')),false);
    const firebaseConfig=jsonFile(path.join(firebaseStage,'firebase.json'));
    const enforcementConfig=jsonFile(path.join(firebaseStage,'firebase.enforcement-candidate.json'));
    const firebaseRc=jsonFile(path.join(firebaseStage,'.firebaserc'));
  const rendered=build.deployment.get('firebase-hosting-headers.merge.json');assert.ok(typeof rendered==='string');const renderedMerge=jsonObject(JSON.parse(rendered) as unknown);
  assert.equal(jsonObject(firebaseConfig['hosting'])['public'],'public');
  assert.deepEqual(jsonObject(firebaseConfig['hosting'])['rewrites'],[{source:'**',destination:'/index.html'}]);
  assert.deepEqual(hostingHeaders(firebaseConfig),hostingHeaders(renderedMerge));
  assert.equal(jsonObject(firebaseRc['projects'])['default'],'study-director');
  const defaultHeaders=new Map(hostingHeaders(firebaseConfig).flatMap(rule=>rule.headers.map(header=>[header.key,header.value])));
  const enforcementHeaders=new Map(hostingHeaders(enforcementConfig).flatMap(rule=>rule.headers.map(header=>[header.key,header.value])));
  assert.equal(defaultHeaders.has('Content-Security-Policy-Report-Only'),false);assert.match(defaultHeaders.get('Content-Security-Policy')??'',/require-trusted-types-for 'script'/,'default Firebase config must enforce Trusted Types');
  assert.equal(enforcementHeaders.has('Content-Security-Policy-Report-Only'),false,'enforcement candidate must remove the report-only Trusted Types header');
  assert.match(enforcementHeaders.get('Content-Security-Policy')||'',/require-trusted-types-for 'script'/);
  assert.match(enforcementHeaders.get('Content-Security-Policy')||'',/trusted-types sd-inert-html sd-assets sd-legal-html sd-insights-worker sd-google-signin/);
  assert.deepEqual(listFiles(publicDir).sort(),[...build.deployment.keys()].filter(name=>name!=='firebase-hosting-headers.merge.json').sort(),'the staged public directory must contain only the current release inventory');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
  if(previousSourceCommit===undefined)delete process.env['SD_SOURCE_COMMIT'];else process.env['SD_SOURCE_COMMIT']=previousSourceCommit;
}

console.log(JSON.stringify({
  status:'PASS',selfContainedFirebaseProject:true,cacheHeaderMerge:true,samePwaManifestRelation:true,trustedTypesCandidate:true
},null,2));
