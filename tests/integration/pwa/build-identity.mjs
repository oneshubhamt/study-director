import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createPwaVariant} from '../../helpers/pwa-variant.mjs';
import crypto from 'node:crypto';
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'sd-update-identity-'));
try{
 for(const name of ['source','build','contracts'])fs.cpSync(name,path.join(temporary,name),{recursive:true});fs.copyFileSync('release.config.mjs',path.join(temporary,'release.config.mjs'));
 const {renderBuild,validateBuild}=await import(pathToFileURL(path.join(temporary,'build/build.mjs')).href),before=renderBuild();validateBuild(before);
 const fixture=createPwaVariant(before,'synthetic-next');assert.notEqual(fixture.assetId,before.pwa.deployment.assetId);assert.ok(fixture.worker.includes(`const ASSET_ID='${fixture.assetId}'`));assert.equal(fixture.precache.find(row=>row.path==='./index.html').sha256,crypto.createHash('sha256').update(fixture.index).digest('hex'));for(const row of fixture.index.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gu))if(!/\bsrc\s*=/u.test(row[1]))assert.ok(fixture.csp.includes(`'sha256-${crypto.createHash('sha256').update(row[2]).digest('base64')}'`),'fixture CSP must authorize the changed inline boot configuration');
 const worker=path.join(temporary,'source/platform/sw.js');fs.appendFileSync(worker,'\n// Independently changed worker policy.\n');const workerChanged=renderBuild();validateBuild(workerChanged);
 for(const target of ['development','deployment']){assert.equal(workerChanged.pwa[target].assetId,before.pwa[target].assetId);assert.notEqual(workerChanged.pwa[target].releaseId,before.pwa[target].releaseId);}
 const core=path.join(temporary,'source/core/operation-lifecycle.ts');fs.appendFileSync(core,'\n// Independently changed page asset.\n');const assetsChanged=renderBuild();validateBuild(assetsChanged);
 for(const target of ['development','deployment']){assert.notEqual(assetsChanged.pwa[target].assetId,workerChanged.pwa[target].assetId);assert.notEqual(assetsChanged.pwa[target].releaseId,workerChanged.pwa[target].releaseId);}
 assert.equal(assetsChanged.identity.buildId,before.identity.buildId);console.log(JSON.stringify({status:'PASS',suite:'pwa-build-identity',workerOnlyCacheIsolation:true,sameBuildAssetIsolation:true,targets:2}));
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
