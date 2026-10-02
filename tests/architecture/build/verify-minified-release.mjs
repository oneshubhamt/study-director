import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import releaseConfig,{deploymentDirectoryName} from '../../../release.config.mjs';
import {CACHE_STORAGE_IDENTITIES} from '../../../contracts/canonical-identities.mjs';
import {privateModules,styleModules} from '../../../build/module-manifest.mjs';

const root=process.cwd();
const staged=path.join(root,'dist/firebase-project');
const minified=path.join(root,'dist',deploymentDirectoryName);
const publicDir=path.join(minified,'public');
const originalPublic=path.join(staged,'public');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const read=(base,name)=>fs.readFileSync(path.join(base,name));
const walk=directory=>{const out=[];const visit=(current,prefix='')=>{for(const entry of fs.readdirSync(current,{withFileTypes:true})){const relative=path.posix.join(prefix,entry.name),absolute=path.join(current,entry.name);if(entry.isDirectory())visit(absolute,relative);else out.push(relative);}};visit(directory);return out.sort();};
assert.ok(fs.existsSync(publicDir),'Run npm run stage:firebase:minified first.');

const files=walk(publicDir),externalScripts=files.filter(name=>/^sd\.(?:glass|guide|insights|drive|richtext|note-search)\.[a-f0-9]{12}\.js$/.test(name));
assert.equal(externalScripts.length,6,'Expected six content-addressed external scripts, including eager rich text and the lazy search worker.');
const privateScripts=privateModules.map(module=>files.find(name=>new RegExp(`^${module.stem.replaceAll('.','\\.')}\\.[a-f0-9]{12}\\.js$`).test(name)));
assert.ok(privateScripts.every(Boolean),'Every private core module must be a content-addressed deployment script.');
const styleFiles=styleModules.map(module=>files.find(name=>new RegExp(`^${module.stem.replaceAll('.','\\.')}\\.[a-f0-9]{12}\\.css$`).test(name)));
assert.ok(styleFiles.every(Boolean),'Every stable stylesheet must be content-addressed.');
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
const inline=[...index.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match=>match[1]);
assert.ok(inline.length>0);inline.forEach((source,index)=>new vm.Script(source,{filename:`index-inline-${index+1}.js`}));
for(const name of scripts)assert.ok(index.includes(name),`index.html does not reference ${name}`);
for(const name of styleFiles)assert.ok(index.includes(name),`index.html does not reference ${name}`);
const richScript=externalScripts.find(name=>/^sd\.richtext\./.test(name));
assert.ok(richScript&&new RegExp(`<script[^>]+src=[\"'](?:\./)?${richScript.replaceAll('.','\\.')}[\"']`,'i').test(index),'Rich-text runtime must be statically loaded.');

const hosting=JSON.parse(read(minified,'firebase-hosting-headers.merge.json'));
const firebase=JSON.parse(read(minified,'firebase.json'));
const enforcement=JSON.parse(read(minified,'firebase.enforcement-candidate.json'));
const firebaseRc=JSON.parse(read(minified,'.firebaserc'));
assert.equal(firebase.hosting.public,'public');
assert.deepEqual(firebase.hosting.rewrites,[{source:'**',destination:'/index.html'}]);
assert.deepEqual(firebase.hosting.headers,hosting.hosting.headers);
assert.equal(firebaseRc.projects.default,'study-director');
const defaultRule=firebase.hosting.headers.find(rule=>rule.source==='/**');
const enforcementRule=enforcement.hosting.headers.find(rule=>rule.source==='/**');
const csp=hosting.hosting.headers.find(rule=>rule.source==='/**').headers.find(header=>header.key==='Content-Security-Policy').value;
const defaultReportOnly=defaultRule.headers.find(header=>header.key==='Content-Security-Policy-Report-Only')?.value||'';
const enforcementCsp=enforcementRule.headers.find(header=>header.key==='Content-Security-Policy')?.value||'';
assert.equal(defaultReportOnly,'');assert.match(csp,/require-trusted-types-for 'script'/,'Default Firebase config must enforce Trusted Types.');
assert.equal(enforcementRule.headers.some(header=>header.key==='Content-Security-Policy-Report-Only'),false,'Enforcement candidate must remove report-only Trusted Types.');
assert.match(enforcementCsp,/require-trusted-types-for 'script'/);
assert.match(enforcementCsp,/trusted-types sd-inert-html sd-assets sd-legal-html sd-insights-worker sd-google-signin/);
for(const source of inline){const digest=crypto.createHash('sha256').update(source).digest('base64');assert.ok(csp.includes(`'sha256-${digest}'`),`CSP omitted inline hash ${digest}`);assert.ok(enforcementCsp.includes(`'sha256-${digest}'`),`Enforcement CSP omitted inline hash ${digest}`);}

const sw=read(publicDir,'sw.js').toString('utf8');new vm.Script(sw,{filename:'sw.js'});
const manifest=JSON.parse(sw.match(/const PRECACHE=Object\.freeze\(JSON\.parse\('(.+?)'\)\);/)?.[1]||'[]');
assert.ok(manifest.length>=34,'Precache inventory is unexpectedly small.');
for(const asset of manifest){const name=asset.path.replace(/^\.\//,'');assert.ok(fs.existsSync(path.join(publicDir,name)),name);assert.equal(sha(read(publicDir,name)),asset.sha256,name);}
assert.ok(richScript&&manifest.some(row=>row.path===`./${richScript}`),'Eager rich-text runtime must be install-time precached.');
const searchWorker=externalScripts.find(name=>/^sd\.note-search\./.test(name));
assert.ok(searchWorker&&manifest.some(row=>row.path===`./${searchWorker}`),'Lazy search Worker runtime must be precached without being eagerly executed.');
const releaseId=sha(JSON.stringify(manifest)).slice(0,24);assert.ok(sw.includes(`const RELEASE_ID='${releaseId}';`));
assert.match(sw,/const CompatibilityFacade=Object\.freeze/);
const cacheIdentityMatch=sw.match(/const CACHE_IDENTITIES=Object\.freeze\((\{[^\n]+\})\);/);
assert.ok(cacheIdentityMatch,'Service worker must embed the centralized Cache Storage identities.');
assert.deepEqual(JSON.parse(cacheIdentityMatch[1]),CACHE_STORAGE_IDENTITIES,'Service-worker Cache Storage identities drifted from the canonical contract.');
assert.match(sw,/const bridgeCache=CACHE_IDENTITIES\.updateBridge/);
assert.match(sw,/const recoveryCache=CACHE_IDENTITIES\.updateRecoveryPrefix\+RELEASE_ID/);
assert.match(sw,/CompatibilityFacade\.installBridgeRequired\(\)/);
assert.match(sw,/CompatibilityFacade\.recoveryHandoff\(\)/);
assert.match(sw,/SD_PWA_ACTIVATION_ACK/);
assert.match(sw,/SD_PWA_ACTIVATED/);
const identity=JSON.parse(read(minified,'DEPLOYMENT-IDENTITY.json'));
assert.equal(identity.surfaceRelease,releaseConfig.release);assert.equal(identity.buildId,releaseConfig.buildId);assert.equal(identity.serviceWorkerReleaseId,releaseId);
assert.equal(identity.indexSha256,sha(read(publicDir,'index.html')));assert.equal(identity.serviceWorkerSha256,sha(read(publicDir,'sw.js')));
assert.equal(identity.publicFileCount,files.length);assert.deepEqual(identity.publicFiles,files);

for(const name of ['privacy.html','terms.html','security.html','license.html','notices.html','LICENSE.txt','NOTICE.txt','manifest.webmanifest'])assert.deepEqual(read(publicDir,name),read(originalPublic,name),`${name} changed during minification`);
assert.ok(read(publicDir,'legal.css').length<read(originalPublic,'legal.css').length,'legal.css was not minified');

const metrics=base=>walk(base).filter(name=>/\.(?:html|js|css|webmanifest|txt)$/.test(name)).reduce((totals,name)=>{const bytes=read(base,name);totals.raw+=bytes.length;totals.gzip+=zlib.gzipSync(bytes,{level:9}).length;return totals;},{raw:0,gzip:0});
const before=metrics(originalPublic),after=metrics(publicDir);
assert.ok(after.raw<before.raw,`Raw deployment did not shrink: ${before.raw} -> ${after.raw}`);
assert.ok(after.gzip<before.gzip,`Gzip deployment did not shrink: ${before.gzip} -> ${after.gzip}`);
assert.doesNotMatch(files.join('\n'),/\.map$/);
console.log(JSON.stringify({status:'PASS',release:releaseConfig.release,externalScripts:externalScripts.length,cacheableCoreScripts:privateScripts.length,cacheableStyles:styleFiles.length,inlineScripts:inline.length,precacheAssets:manifest.length,before,after,rawReductionPercent:Number(((before.raw-after.raw)/before.raw*100).toFixed(2)),gzipReductionPercent:Number(((before.gzip-after.gzip)/before.gzip*100).toFixed(2))},null,2));
