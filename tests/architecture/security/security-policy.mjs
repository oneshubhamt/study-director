import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {renderBuild,validateBuild} from '../../../build/build.mjs';
import {externalModules,trustedExternalModuleIds} from '../../../build/module-manifest.mjs';

const read=file=>fs.readFileSync(new URL(`../../../${file}`,import.meta.url),'utf8');
const app=read('source/app.html');
const drive=read('source/external/drive.js');
const review=read('source/core/review.js');
const plan=read('source/core/plan.js');
const timer=read('source/core/timer-engine.ts');
const insightsModel=read('source/external/insights-model.js');
const insightsView=read('source/external/insights.js');
const insights=insightsModel+'\n'+insightsView;
const sw=read('source/platform/sw.js');

// Static security policy: forbidden capabilities and trust boundaries only.
assert.match(drive,/https:\/\/www\.googleapis\.com\/auth\/drive\.file/u,'Drive must request only the app-file OAuth scope.');
assert.doesNotMatch(drive,/www\.googleapis\.com\/auth\/drive(?!\.file)|emptyTrash|\/permissions|permission-management/iu,'Broad Drive scope or permission-management capability is forbidden.');
assert.equal((app.match(/import\s*\(/gu)||[]).length,0,'Runtime dynamic JavaScript imports are forbidden.');
assert.deepEqual([...trustedExternalModuleIds],['glass','aurora','guide','insights','drive','rich-text','search-worker','image-worker','attachment-worker','export-worker']);
assert.deepEqual(externalModules.map(module=>module.id),[...trustedExternalModuleIds],'Only reviewed external runtime modules may be loadable.');
assert.match(app,/script\.src=trustedAssetURL\(descriptor\.src\)/u,'On-demand scripts must cross the trusted-asset boundary.');

for(const [name,source] of [['app',app],['review',review],['plan',plan],['timer',timer],['insights',insights],['drive',drive]]){
  assert.doesNotMatch(source,/\beval\s*\(|new Function\s*\(/u,`${name} must not use string-to-code execution.`);
}
for(const source of [app,review,plan,timer,insights]){
  assert.doesNotMatch(source,/querySelector(?:All)?\(`[^`]*\$\{/u,'Runtime values must not be interpolated into CSS selectors.');
}
assert.doesNotMatch(drive,/innerHTML\s*=.*file\.(?:name|modifiedTime|createdTime)/u,'Drive metadata must never be rendered as HTML.');
assert.match(sw,/candidate\.origin===scope\.origin&&candidate\.pathname\.startsWith\(scope\.pathname\)/u,'Service-worker navigation fallback must remain same-origin and scope-confined.');

// Rendered deployment policy is the authoritative CSP/header contract.
const build=renderBuild();
assert.equal(validateBuild(build),true);
const headers=JSON.parse(build.deployment.get('firebase-hosting-headers.merge.json'));
const rule=headers.hosting.headers.find(item=>item.source==='/**');
assert.ok(rule,'Deployment must define default security headers.');
const values=Object.fromEntries(rule.headers.map(item=>[item.key,item.value]));
assert.equal(values['X-Content-Type-Options'],'nosniff');
assert.equal(values['Referrer-Policy'],'no-referrer');
assert.equal(values['X-Frame-Options'],'DENY');
assert.match(values['Permissions-Policy'],/camera=\(\).*microphone=\(\).*geolocation=\(\)/u);
assert.match(values['Content-Security-Policy'],/script-src 'self' .*https:\/\/accounts\.google\.com/u);
assert.match(values['Content-Security-Policy'],/connect-src 'self' https:\/\/accounts\.google\.com https:\/\/www\.googleapis\.com/u);
assert.match(values['Content-Security-Policy'],/frame-ancestors 'none'/u);
assert.doesNotMatch(values['Content-Security-Policy'],/script-src[^;]*'unsafe-inline'|script-src[^;]*'unsafe-eval'/u);
assert.match(values['Content-Security-Policy']||'',/require-trusted-types-for 'script'/u,'Trusted Types enforcement belongs to default deployment architecture.');

const html=build.deployment.get('index.html');
const inlineHashes=[...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/giu)]
  .map(match=>`'sha256-${crypto.createHash('sha256').update(match[1]).digest('base64')}'`);
assert.ok(inlineHashes.length>0,'Deployment must account for inline bootstrap scripts.');
for(const hash of inlineHashes)assert.ok(values['Content-Security-Policy'].includes(hash),`CSP is missing inline-script hash ${hash}.`);

const driveName=[...build.deployment.keys()].find(name=>/^sd\.drive\.[a-f0-9]{12}\.js$/u.test(name));
const developmentDriveName=[...build.development.keys()].find(name=>/^sd\.drive\.[a-f0-9]{12}\.js$/u.test(name));
assert.ok(driveName&&developmentDriveName,'Drive runtime must be content-addressed in both builds.');
const productionClientId='306494096916-p48tjuv0ni01c11a0dp4ini9gp3dafdi.apps.googleusercontent.com';
assert.ok(build.deployment.get(driveName).includes(productionClientId),'Production build must contain the production OAuth client.');
assert.ok(!build.development.get(developmentDriveName).includes(productionClientId),'Development build must not contain the production OAuth client.');

console.log(JSON.stringify({status:'PASS',policy:'static security boundaries',checks:{oauthScope:true,moduleAllowlist:true,forbiddenCodeExecution:true,inertRendering:true,serviceWorkerScope:true,csp:true,oauthSeparation:true}},null,2));
