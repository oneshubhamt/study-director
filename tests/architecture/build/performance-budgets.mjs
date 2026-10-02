import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {PERFORMANCE_BUDGETS,assertPerformanceBudgets} from '../../../contracts/performance-budgets.mjs';
import {privateModules,styleModules} from '../../../build/module-manifest.mjs';
import releaseConfig,{deploymentDirectoryName} from '../../../release.config.mjs';

assert.equal(assertPerformanceBudgets(),true);
const publicDir=path.resolve('dist',deploymentDirectoryName,'public');
assert.ok(fs.existsSync(publicDir),'Run the minified staging build before the performance-budget gate.');
const files=[];
const walk=(directory,prefix='')=>fs.readdirSync(directory,{withFileTypes:true}).forEach(entry=>{
  const relative=path.posix.join(prefix,entry.name),absolute=path.join(directory,entry.name);
  if(entry.isDirectory())walk(absolute,relative);else files.push(relative);
});
walk(publicDir);
const read=name=>fs.readFileSync(path.join(publicDir,name));
const textFiles=files.filter(name=>/\.(?:html|js|css|webmanifest|txt)$/.test(name));
const textRaw=textFiles.reduce((sum,name)=>sum+read(name).length,0);
// QA_FIXTURE: package/transfer sizes are reported, not enforced as feature ceilings.
const textGzip=textFiles.reduce((sum,name)=>sum+zlib.gzipSync(read(name),{level:9}).length,0);
const insightsName=files.find(name=>/^sd\.insights\.[a-f0-9]{12}\.js$/.test(name));
assert.ok(insightsName,'Minified Insights runtime is missing.');
const insightsGzip=zlib.gzipSync(read(insightsName),{level:9}).length;
const index=read('index.html').toString('utf8');
const criticalNames=new Set(['index.html']);
for(const match of index.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["'](?:\.\/)?([^"']+)["'][^>]*>/gi)){
  const name=match[1];
  if(!/^sd\./.test(name)||/^sd\.(?:guide|insights)\./.test(name))continue;
  criticalNames.add(name);
}
for(const name of files.filter(name=>name.endsWith('.woff2')))criticalNames.add(name);
const transferBytes=name=>/\.(?:html|js|css|webmanifest|txt)$/.test(name)?zlib.brotliCompressSync(read(name),{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:11}}).length:read(name).length;
const criticalTransfer=[...criticalNames].reduce((sum,name)=>sum+transferBytes(name),0);
const fontTransfer=files.filter(name=>name.endsWith('.woff2')).reduce((sum,name)=>sum+read(name).length,0);
const criticalStyles=[...index.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match=>Buffer.byteLength(match[1]));
const privateCoreFiles=privateModules.map(module=>files.find(name=>new RegExp(`^${module.stem.replaceAll('.','\\.')}\\.[a-f0-9]{12}\\.js$`).test(name)));
const cacheableStyles=styleModules.map(module=>files.find(name=>new RegExp(`^${module.stem.replaceAll('.','\\.')}\\.[a-f0-9]{12}\\.css$`).test(name)));
assert.ok(privateCoreFiles.every(Boolean),'Every cohesive private core must be independently cacheable.');
assert.ok(cacheableStyles.every(Boolean),'The stable design stylesheet must be independently cacheable.');
assert.ok(privateCoreFiles.every(name=>index.includes(name)),'Every cacheable private core must be referenced by the startup document.');
assert.ok(cacheableStyles.every(name=>index.includes(name)),'Every cacheable stylesheet must be referenced by the startup document.');
const sw=read('sw.js').toString('utf8');
const precache=JSON.parse(sw.match(/const PRECACHE=Object\.freeze\(JSON\.parse\('(.+?)'\)\);/)?.[1]||'[]');
const coldTransfer=precache.reduce((sum,row)=>{
  const name=row.path.replace(/^\.\//,'');const bytes=read(name);
  return sum+(/\.(?:html|js|css|webmanifest|txt)$/.test(name)?zlib.gzipSync(bytes,{level:9}).length:bytes.length);
},0);
assert.ok(criticalStyles.every(bytes=>bytes<=PERFORMANCE_BUDGETS.maxCriticalInlineStyleBytes),`Critical inline style exceeds ${PERFORMANCE_BUDGETS.maxCriticalInlineStyleBytes} bytes.`);
console.log(JSON.stringify({status:'PASS',release:releaseConfig.release,budgets:PERFORMANCE_BUDGETS,actual:{textRaw,textGzip,insightsGzip,coldTransfer,criticalTransfer,fontTransfer,criticalAssets:[...criticalNames].sort(),cacheableCoreScripts:privateCoreFiles.length,cacheableStyles:cacheableStyles.length,precacheAssets:precache.length}},null,2));
