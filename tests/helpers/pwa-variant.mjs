import crypto from 'node:crypto';
import fs from 'node:fs';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex'),scripts=html=>[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gu)].filter(row=>! /\bsrc\s*=/u.test(row[1])).map(row=>row[2]);
// Synthetic browser releases must update both boot identities and CSP hashes.
// This helper only constructs fixtures; browser execution remains separate.
export function createPwaVariant(build,label,{corruptAsset=''}={}){
 const base=build.pwa.deployment,original=build.deployment.get(build.identity.main),assetId=sha(JSON.stringify({base:base.assetId,label})).slice(0,24),index=original.replaceAll(base.assetId,assetId).replace('</head>',`<!-- ${label} -->\n</head>`);
 const precache=base.precache.map(asset=>({...asset,sha256:asset.path==='./index.html'?sha(index):asset.sha256}));
 if(corruptAsset){const asset=precache.find(row=>row.path.endsWith(corruptAsset));if(!asset)throw new Error('Corrupt fixture asset is missing.');asset.sha256='0'.repeat(64);}
 const workerTemplate=fs.readFileSync('source/platform/sw.js','utf8'),releaseId=sha(JSON.stringify({precache,worker:sha(workerTemplate)})).slice(0,24),worker=build.deployment.get('sw.js').replace(`const RELEASE_ID='${base.releaseId}';`,`const RELEASE_ID='${releaseId}';`).replace(`const ASSET_ID='${base.assetId}';`,`const ASSET_ID='${assetId}';`).replace(JSON.stringify(base.precache),JSON.stringify(precache));
 const headers=JSON.parse(build.deployment.get('firebase-hosting-headers.merge.json')).hosting.headers.find(row=>row.source==='/**').headers,originalCsp=headers.find(row=>row.key==='Content-Security-Policy').value+'; '+(headers.find(row=>row.key==='Content-Security-Policy-Report-Only')?.value||'');
 let csp=originalCsp;const oldScripts=scripts(original),newScripts=scripts(index);oldScripts.forEach((source,i)=>{if(source!==newScripts[i])csp=csp.replaceAll(`'sha256-${crypto.createHash('sha256').update(source).digest('base64')}'`,`'sha256-${crypto.createHash('sha256').update(newScripts[i]).digest('base64')}'`);});
 return Object.freeze({label,index,assetId,worker,releaseId,precache,csp});
}

// True once the registration has no waiting or installing worker and its active
// worker is activated. Wait on this, not on messages to the workers: Chromium
// activates a waiting worker only when the old one is idle, so messaging the
// old worker in a polling loop delays activation, badly so under CPU load.
export const REGISTRATION_SETTLED=`navigator.serviceWorker.getRegistration().then(registration=>!!registration&&!registration.waiting&&!registration.installing&&registration.active?.state==='activated')`;
export async function registrationsSettled(pages){
  return (await Promise.all(pages.map(page=>page.evaluate(REGISTRATION_SETTLED)))).every(Boolean);
}
