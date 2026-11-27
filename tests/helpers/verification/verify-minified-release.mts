import {jsonObject,jsonFile,jsonArray,jsonString,hostingHeaders} from './read-verification.mts';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import releaseConfig,{deploymentDirectoryName} from '../../../release.config.mts';
import {CACHE_STORAGE_IDENTITIES} from '../../../contracts/canonical-identities.mts';
import {privateModules,styleModules} from '../../../build/module-manifest.mts';

const root=process.cwd();
const staged=path.join(root,'dist/firebase-project');
const minified=path.join(root,'dist',deploymentDirectoryName);
const publicDir=path.join(minified,'public');
const originalPublic=path.join(staged,'public');
const sha=(value:string|Buffer)=>crypto.createHash('sha256').update(value).digest('hex');
const read=(base:string,name:string)=>fs.readFileSync(path.join(base,name));
const walk=(directory:string)=>{const out:string[]=[];const visit=(current:string,prefix=''):void=>{for(const entry of fs.readdirSync(current,{withFileTypes:true})){const relative=path.posix.join(prefix,entry.name),absolute=path.join(current,entry.name);if(entry.isDirectory())visit(absolute,relative);else out.push(relative);}};visit(directory);return out.sort();};
assert.ok(fs.existsSync(publicDir),'Run npm run stage:firebase:minified first.');

const files=walk(publicDir),externalScripts=files.filter(name=>/^sd\.(?:glass|guide|insights|drive|richtext|note-search)\.[a-f0-9]{12}\.js$/.test(name));
assert.equal(externalScripts.length,6,'Expected six content-addressed external scripts, including eager rich text and the lazy search worker.');
const privateScripts=privateModules.map(module=>files.find(name=>new RegExp(`^${module.stem.replaceAll('.','\\.')}\\.[a-f0-9]{12}\\.js$`).test(name)));
assert.ok(privateScripts.every(Boolean),'Every private core module must be a content-addressed deployment script.');
const styleFiles=styleModules.map(module=>files.find(name=>new RegExp(`^${module.stem.replaceAll('.','\\.')}\\.[a-f0-9]{12}\\.css$`).test(name)));
assert.ok(styleFiles.every(Boolean),'Every stable stylesheet must be content-addressed.');
assert.ok(privateScripts.every((name):name is string=>typeof name==='string'));assert.ok(styleFiles.every((name):name is string=>typeof name==='string'));
const scripts=[...privateScripts,...externalScripts];
for(const name of scripts){
  const source=read(publicDir,name).toString('utf8');
  assert.equal(name.split('.').at(-2),sha(source).slice(0,12),name);
  new vm.Script(source,{filename:name});
  if(/^sd\.richtext\./.test(name)){
    const originalName=walk(originalPublic).find(file=>/^sd\.richtext\.[a-f0-9]{12}\.js$/.test(file));
    assert.ok(originalName,'Original eager rich-text runtime is missing.');
    const originalSource=read(originalPublic,originalName);
    const output=Buffer.from(source);
    assert.ok(output.length<=originalSource.length,`Rich-text minification grew raw bytes: ${originalSource.length} -> ${output.length}.`);
    assert.ok(zlib.gzipSync(output,{level:9}).length<=zlib.gzipSync(originalSource,{level:9}).length,'Rich-text minification grew gzip bytes.');
  }
}
for(const name of styleFiles){
  const source=read(publicDir,name);
  assert.equal(name.split('.').at(-2),sha(source).slice(0,12),name);
  assert.ok(source.length>0,`${name} is empty.`);
}

const index=read(publicDir,'index.html').toString('utf8');
assert.ok(index.includes(`<meta name="study-director-build" content="${releaseConfig.buildId}">`),'Minified index has the wrong build identity.');
const inline=[...index.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match=>match[1]!);
assert.ok(inline.length>0);inline.forEach((source,index)=>new vm.Script(source,{filename:`index-inline-${index+1}.js`}));
for(const name of scripts)assert.ok(index.includes(name),`index.html does not reference ${name}`);
for(const name of styleFiles)assert.ok(index.includes(name),`index.html does not reference ${name}`);
const richScript=externalScripts.find(name=>/^sd\.richtext\./.test(name));
assert.ok(richScript&&new RegExp(`<script[^>]+src=[\"'](?:\./)?${richScript.replaceAll('.','\\.')}[\"']`,'i').test(index),'Rich-text runtime must be statically loaded.');

const hosting=jsonFile(path.join(minified,'firebase-hosting-headers.merge.json'));
const firebase=jsonFile(path.join(minified,'firebase.json'));
const enforcement=jsonFile(path.join(minified,'firebase.enforcement-candidate.json'));
const firebaseRc=jsonFile(path.join(minified,'.firebaserc'));
assert.equal(jsonObject(firebase['hosting'])['public'],'public');
assert.deepEqual(jsonObject(firebase['hosting'])['rewrites'],[{source:'**',destination:'/index.html'}]);
assert.deepEqual(hostingHeaders(firebase),hostingHeaders(hosting));
assert.equal(jsonObject(firebaseRc['projects'])['default'],'study-director');
const defaultRule=hostingHeaders(firebase).find(rule=>rule.source==='/**');
const enforcementRule=hostingHeaders(enforcement).find(rule=>rule.source==='/**');
assert.ok(defaultRule&&enforcementRule);const csp=hostingHeaders(hosting).find(rule=>rule.source==='/**')?.headers.find(header=>header.key==='Content-Security-Policy')?.value??'';
const defaultReportOnly=defaultRule.headers.find(header=>header.key==='Content-Security-Policy-Report-Only')?.value||'';
const enforcementCsp=enforcementRule.headers.find(header=>header.key==='Content-Security-Policy')?.value||'';
assert.equal(defaultReportOnly,'');assert.match(csp,/require-trusted-types-for 'script'/,'Default Firebase config must enforce Trusted Types.');
assert.equal(enforcementRule.headers.some(header=>header.key==='Content-Security-Policy-Report-Only'),false,'Enforcement candidate must remove report-only Trusted Types.');
assert.match(enforcementCsp,/require-trusted-types-for 'script'/);
assert.match(enforcementCsp,/trusted-types sd-inert-html sd-assets sd-legal-html sd-insights-worker sd-google-signin/);
for(const source of inline){const digest=crypto.createHash('sha256').update(source).digest('base64');assert.ok(csp.includes(`'sha256-${digest}'`),`CSP omitted inline hash ${digest}`);assert.ok(enforcementCsp.includes(`'sha256-${digest}'`),`Enforcement CSP omitted inline hash ${digest}`);}

const sw=read(publicDir,'sw.js').toString('utf8');new vm.Script(sw,{filename:'sw.js'});
const pageAssetId=index.match(/<meta name="study-director-assets" content="([0-9a-f]{24})">/)?.[1]||'';
const workerBuildId=sw.match(/\bBUILD_ID=['"]([^'"]+)['"]/)?.[1]||'',workerAssetId=sw.match(/\bASSET_ID=['"]([0-9a-f]{24})['"]/)?.[1]||'';
assert.match(pageAssetId,/^[0-9a-f]{24}$/u,'Minified index must carry a valid page asset identity.');
assert.equal(workerBuildId,releaseConfig.buildId,'Minified page and Service Worker must retain the same build identity.');
assert.equal(workerAssetId,pageAssetId,'Minified page and Service Worker must retain the same loaded-asset generation.');
const manifest=jsonArray(JSON.parse(sw.match(/const PRECACHE=parsePrecache\('(.+?)'\)/)?.[1]||'[]') as unknown).map(value=>{const row=jsonObject(value);return {path:jsonString(row['path']),sha256:jsonString(row['sha256'])};});
assert.ok(manifest.length>=34,'Precache inventory is unexpectedly small.');
for(const asset of manifest){const name=asset.path.replace(/^\.\//,'');assert.ok(fs.existsSync(path.join(publicDir,name)),name);assert.equal(sha(read(publicDir,name)),asset.sha256,name);}
assert.ok(richScript&&manifest.some(row=>row.path===`./${richScript}`),'Eager rich-text runtime must be install-time precached.');
const searchWorker=externalScripts.find(name=>/^sd\.note-search\./.test(name));
assert.ok(searchWorker&&manifest.some(row=>row.path===`./${searchWorker}`),'Lazy search Worker runtime must be precached without being eagerly executed.');
const normalizedWorker=sw.replace(/const RELEASE_ID='[0-9a-f]+';/u,`const RELEASE_ID='${'0'.repeat(24)}';`);const releaseId=sha(JSON.stringify({precache:manifest,worker:sha(normalizedWorker)})).slice(0,24);assert.ok(sw.includes(`const RELEASE_ID='${releaseId}';`));
assert.doesNotMatch(sw,/CompatibilityFacade|installBridgeRequired|recoveryHandoff/,'deployment must contain no historical updater bridge');
const cacheIdentityMatch=sw.match(/parseCacheIdentities\(decodeURIComponent\('([^']+)'\)\)/);
assert.ok(cacheIdentityMatch,'Service worker must embed the centralized Cache Storage identities.');
assert.deepEqual(JSON.parse(decodeURIComponent(cacheIdentityMatch[1]!)),CACHE_STORAGE_IDENTITIES,'Service-worker Cache Storage identities drifted from the canonical contract.');
assert.match(sw,/caches\.open\(CACHE_IDENTITIES\.clientState\)/,'current client acknowledgements must still protect live shell generations');
assert.match(sw,/SD_PWA_ACTIVATION_ACK/);
assert.match(sw,/SD_PWA_ACTIVATED/);
const identity=jsonFile(path.join(minified,'DEPLOYMENT-IDENTITY.json')),sourceCommit=index.match(/<meta name="study-director-source-commit" content="([0-9a-f]{40})">/)?.[1]||'';
assert.match(sourceCommit,/^[0-9a-f]{40}$/u,'Minified index must carry exact source commit provenance.');
assert.equal(identity['version'],2);assert.equal(identity['surfaceRelease'],releaseConfig.release);assert.equal(identity['buildId'],releaseConfig.buildId);assert.equal(identity['assetId'],pageAssetId);assert.equal(identity['sourceCommit'],sourceCommit);assert.equal(identity['serviceWorkerReleaseId'],releaseId);
assert.equal(identity['indexSha256'],sha(read(publicDir,'index.html')));assert.equal(identity['serviceWorkerSha256'],sha(read(publicDir,'sw.js')));
assert.equal(identity['publicFileCount'],files.length);assert.deepEqual(identity['publicFiles'],files);

for(const name of ['privacy.html','terms.html','security.html','license.html','notices.html','LICENSE.txt','NOTICE.txt','manifest.webmanifest'])assert.deepEqual(read(publicDir,name),read(originalPublic,name),`${name} changed during minification`);
assert.ok(read(publicDir,'legal.css').length<read(originalPublic,'legal.css').length,'legal.css was not minified');

const metrics=(base:string)=>walk(base).filter(name=>/\.(?:html|js|css|webmanifest|txt)$/.test(name)).reduce((totals,name)=>{const bytes=read(base,name);totals.raw+=bytes.length;totals.gzip+=zlib.gzipSync(bytes,{level:9}).length;return totals;},{raw:0,gzip:0});
const before=metrics(originalPublic),after=metrics(publicDir);
assert.ok(after.raw<before.raw,`Raw deployment did not shrink: ${before.raw} -> ${after.raw}`);
assert.ok(after.gzip<before.gzip,`Gzip deployment did not shrink: ${before.gzip} -> ${after.gzip}`);
assert.doesNotMatch(files.join('\n'),/\.map$/);
console.log(JSON.stringify({status:'PASS',release:releaseConfig.release,externalScripts:externalScripts.length,cacheableCoreScripts:privateScripts.length,cacheableStyles:styleFiles.length,inlineScripts:inline.length,precacheAssets:manifest.length,before,after,rawReductionPercent:Number(((before.raw-after.raw)/before.raw*100).toFixed(2)),gzipReductionPercent:Number(((before.gzip-after.gzip)/before.gzip*100).toFixed(2))},null,2));
