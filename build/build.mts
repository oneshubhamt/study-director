import {readHostHtml} from './host-source.mts';
import {compileScript} from './source-script.mts';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import releaseConfig from '../release.config.mts';
import {generatedRuntimeDirectory,generatedRuntimePath} from './generated-runtime-paths.mts';
import {PRODUCTION_LIMITS,assertProductionLimits} from '../contracts/production-limits.mts';
import {LOCAL_STORAGE_KEYS,DEVICE_WIDE_LOCAL_STORAGE_KEYS,PROFILE_SCOPE_SEPARATOR,SESSION_STORAGE_KEYS,APP_META_KEYS,APP_META_RUNTIME_REGISTRY,assertDataArchitecture} from '../contracts/data-architecture.mts';
import {RUNTIME_DATA_CONTRACT,INDEXED_DB_STORE_NAMES,OPFS_IDENTITIES,CACHE_STORAGE_IDENTITIES,EXTERNAL_REPOSITORY_IDENTITIES,assertCanonicalIdentities} from '../contracts/canonical-identities.mts';
import {
  privateModules,authoredExternalModules,generatedRuntimeModules,externalModules,styleModules,trustedExternalModuleIds,runtimeDependencies,htmlSource,privateModuleMarker,hostScripts,
  platformFiles,staticAssets,legalReaderAssets
} from './module-manifest.mts';

import type {BuildTarget,ExternalModule} from './module-manifest.mts';
type BuildValue=string|Buffer;
type FileMap=ReadonlyMap<string,BuildValue>;
type Identity=ReturnType<typeof releaseIdentity>;
type PwaIdentity=Readonly<{releaseId:string;assetId:string;precache:readonly Readonly<{path:string;sha256:string}>[]}>;
function required<K,V>(map:ReadonlyMap<K,V>,key:K):V{const value=map.get(key);if(value===undefined)throw new Error(`Missing build entry: ${String(key)}`);return value;}
function requiredText(map:FileMap,key:string):string{const value=required(map,key);if(typeof value!=='string')throw new Error(`Expected build text: ${key}`);return value;}
function dependencyList(id:string):readonly string[]{const value=runtimeDependencies[id];if(!value)throw new Error(`Missing runtime dependency row: ${id}`);return value;}
const asRecord=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Expected build JSON object.');return Object.fromEntries(Object.entries(value).map(([key,entry]:[string,unknown])=>[key,entry]));};
function asRows(value:unknown):Record<string,unknown>[]{if(!Array.isArray(value))throw new Error('Expected build JSON array.');return value.map(asRecord);}
const HERE=path.dirname(fileURLToPath(import.meta.url));
export const WORK=path.resolve(HERE,'..');
export const SOURCE=path.join(WORK,'source');
export const GENERATED_RUNTIME=generatedRuntimeDirectory(WORK);
export const DIST=path.join(WORK,'dist');

function invariant(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(message);}
function sha256(value:BuildValue){return crypto.createHash('sha256').update(value).digest('hex');}
function sha256Base64(value:BuildValue){return crypto.createHash('sha256').update(value).digest('base64');}
function normalizePath(value:string){return value.split(path.sep).join('/');}
const PWA_RELEASE_SENTINEL='0'.repeat(24);
function sourceFile(relative:string){return fs.readFileSync(path.join(SOURCE,relative),'utf8');}
function sourceBytes(relative:string){return fs.readFileSync(path.join(SOURCE,relative));}
function generatedRuntimeFile(relative:string){return fs.readFileSync(generatedRuntimePath(WORK,relative),'utf8');}
function authoredModuleSourceFiles(module:ExternalModule){return module.sources?[...module.sources]:module.source?[module.source]:[];}
function generatedModuleFiles(module:ExternalModule){return module.generatedSources?[...module.generatedSources]:module.generated?[module.generated]:[];}
function externalModuleFiles(module:ExternalModule){
  const authored=authoredModuleSourceFiles(module),generated=generatedModuleFiles(module);
  invariant((authored.length===0)!==(generated.length===0),`External module ${module.id} must have exactly one source origin.`);
  return authored.length?authored.map(file=>({origin:'source',file})):generated.map(file=>({origin:'generated',file}));
}
function externalModuleSource(module:ExternalModule){return externalModuleFiles(module).map(row=>row.origin==='source'?sourceFile(row.file):generatedRuntimeFile(row.file)).join('\n');}
function authoredExternalSourceFiles(){return authoredExternalModules.flatMap(authoredModuleSourceFiles);}
function generatedRuntimeFiles(){return generatedRuntimeModules.flatMap(generatedModuleFiles);}
function relativeFiles(directory:string){
  const files:string[]=[];
  function walk(current:string,prefix=''){
    for(const entry of fs.readdirSync(current,{withFileTypes:true})){
      const relative=prefix?`${prefix}/${entry.name}`:entry.name,absolute=path.join(current,entry.name);
      if(entry.isDirectory())walk(absolute,relative);else files.push(relative);
    }
  }
  walk(directory);return files.sort();
}
function assertGeneratedRuntime(){
  invariant(fs.existsSync(GENERATED_RUNTIME),'Generated runtime directory is missing; run the runtime bundle builder.');
  const expected=generatedRuntimeFiles().sort(),actual=relativeFiles(GENERATED_RUNTIME);
  invariant(JSON.stringify(actual)===JSON.stringify(expected),'Generated runtime inventory differs from the generated-module manifest.');
}
function escapeRegExp(value:unknown){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function escapeHtml(value:unknown){return String(value).replace(/[&<>]/g,character=>(character==='&'?'&amp;':character==='<'?'&lt;':'&gt;'));}

function sourceCommit(){
  for(const raw of [process.env['SD_SOURCE_COMMIT'],process.env['GITHUB_SHA']]){
    const value=String(raw||'').trim().toLowerCase();if(/^[a-f0-9]{40}$/u.test(value))return value;
  }
  try{
    const result=spawnSync('git',['rev-parse','HEAD'],{cwd:WORK,encoding:'utf8',stdio:['ignore','pipe','ignore']});
    const value=result.status===0?String(result.stdout||'').trim().toLowerCase():'';
    if(/^[a-f0-9]{40}$/u.test(value))return value;
  }catch{}
  return '';
}

function legalReaderHtml(reader:typeof legalReaderAssets[number],text:string){
  const links=[['Privacy','privacy.html','privacy'],['Terms','terms.html','terms'],['Security','security.html','security'],['License','license.html','license'],['Notices','notices.html','notices']];
  const navigation=links.map(([label,href,id])=>`<a href="${href}"${id===reader.active?' aria-current="page"':''}>${label}</a>`).join('');
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<meta name="referrer" content="no-referrer">\n<meta name="color-scheme" content="dark light">\n<title>${reader.title} · Study Director</title>\n<link rel="stylesheet" href="legal.css">\n</head>\n<body>\n<main>\n<header>\n<div class="kicker">Study Director · ${reader.kicker}</div>\n<h1>${reader.title}</h1>\n<nav aria-label="Legal documents"><a href="./">Study Director</a>${navigation}</nav>\n</header>\n<pre class="legal-plain-text">${escapeHtml(text)}</pre>\n</main>\n</body>\n</html>\n`;
}

export function releaseIdentity(){
  const release=releaseConfig.release;
  const buildId=String(releaseConfig.buildId||'').trim();
  invariant(/^SDV[A-Z]\d+(?:[a-z]{0,2}|[a-z]{1,2}\d+(?:[a-z]\d?)?)(?:[NR]\d+)?$/i.test(release),'Release must match SDV<series-letter><number><optional letters or letter+numeric promotion with optional correction digit><optional-N-or-R-pass>.');
  invariant(release.slice(0,4)===release.slice(0,4).toUpperCase(),'Release prefix must be uppercase SDV<series-letter>.');
  const expectedBuildId=new RegExp(`^${escapeRegExp(release.toLowerCase())}-[0-9]{8}-r[1-9][0-9]*$`,'u');
  invariant(expectedBuildId.test(buildId),`${release} internal build id is missing or malformed.`);
  const id=release.toLowerCase().replace(/^sd/,'');
  const commit=sourceCommit();invariant(!commit||/^[a-f0-9]{40}$/u.test(commit),'Source commit identity is malformed.');
  return Object.freeze({release,id,buildId,sourceCommit:commit,main:'index.html'});
}

function filename(module:{stem:string},value:BuildValue){return `${module.stem}.${sha256(value).slice(0,12)}.js`;}
function styleFilename(module:{stem:string},value:BuildValue){return `${module.stem}.${sha256(value).slice(0,12)}.css`;}
function renderTokens(value:string,identity:Identity,sourceName:string){
  assertProductionLimits(PRODUCTION_LIMITS);
  assertCanonicalIdentities();
  assertDataArchitecture();
  const rendered=value
    .replaceAll('@@SD_RELEASE@@',identity.release)
    .replaceAll('@@SD_RELEASE_ID@@',identity.id)
    .replaceAll('@@SD_BUILD_ID@@',identity.buildId)
    .replaceAll('@@SD_SOURCE_COMMIT@@',identity.sourceCommit)
    .replaceAll('@@SD_PRODUCTION_LIMITS@@',JSON.stringify(PRODUCTION_LIMITS))
    .replaceAll('@@SD_PRODUCTION_LIMITS_URI@@',encodeURIComponent(JSON.stringify(PRODUCTION_LIMITS)))
    .replaceAll('@@SD_LOCAL_STORAGE_KEYS@@',JSON.stringify(LOCAL_STORAGE_KEYS))
    .replaceAll('@@SD_LOCAL_STORAGE_KEYS_URI@@',encodeURIComponent(JSON.stringify(LOCAL_STORAGE_KEYS)))
    .replaceAll('@@SD_THEME_STORAGE_KEY@@',LOCAL_STORAGE_KEYS.theme)
    .replaceAll('@@SD_PRESENTATION_STORAGE_KEY@@',LOCAL_STORAGE_KEYS.presentation)
    .replaceAll('@@SD_DRIVE_SESSION_STORAGE_KEY@@',LOCAL_STORAGE_KEYS.driveSession)
    .replaceAll('@@SD_PROFILES_STORAGE_KEY@@',LOCAL_STORAGE_KEYS.profiles)
    .replaceAll('@@SD_PROFILE_SCOPE_SEPARATOR@@',PROFILE_SCOPE_SEPARATOR)
    .replaceAll('@@SD_DEVICE_WIDE_LOCAL_STORAGE_KEYS@@',JSON.stringify(DEVICE_WIDE_LOCAL_STORAGE_KEYS))
    .replaceAll('@@SD_DEVICE_WIDE_LOCAL_STORAGE_KEYS_URI@@',encodeURIComponent(JSON.stringify(DEVICE_WIDE_LOCAL_STORAGE_KEYS)))
    .replaceAll('@@SD_SESSION_STORAGE_KEYS@@',JSON.stringify(SESSION_STORAGE_KEYS))
    .replaceAll('@@SD_SESSION_STORAGE_KEYS_URI@@',encodeURIComponent(JSON.stringify(SESSION_STORAGE_KEYS)))
    .replaceAll('@@SD_APP_META_KEYS@@',JSON.stringify(APP_META_KEYS))
    .replaceAll('@@SD_APP_META_KEYS_URI@@',encodeURIComponent(JSON.stringify(APP_META_KEYS)))
    .replaceAll('@@SD_APP_META_REGISTRY@@',JSON.stringify(APP_META_RUNTIME_REGISTRY))
    .replaceAll('@@SD_APP_META_REGISTRY_URI@@',encodeURIComponent(JSON.stringify(APP_META_RUNTIME_REGISTRY)))
    .replaceAll('@@SD_RUNTIME_DATA_CONTRACT@@',JSON.stringify(RUNTIME_DATA_CONTRACT))
    .replaceAll('@@SD_RUNTIME_DATA_CONTRACT_URI@@',encodeURIComponent(JSON.stringify(RUNTIME_DATA_CONTRACT)))
    .replaceAll('@@SD_INDEXED_DB_STORE_NAMES@@',JSON.stringify(INDEXED_DB_STORE_NAMES))
    .replaceAll('@@SD_INDEXED_DB_STORE_NAMES_URI@@',encodeURIComponent(JSON.stringify(INDEXED_DB_STORE_NAMES)))
    .replaceAll('@@SD_ATTACHMENT_OPFS_DIRECTORY@@',OPFS_IDENTITIES.attachments)
    .replaceAll('@@SD_BACKUP_FILES_OPFS_DIRECTORY@@',OPFS_IDENTITIES.backupFiles)
    .replaceAll('@@SD_CACHE_STORAGE_IDENTITIES@@',JSON.stringify(CACHE_STORAGE_IDENTITIES))
    .replaceAll('@@SD_CACHE_STORAGE_IDENTITIES_URI@@',encodeURIComponent(JSON.stringify(CACHE_STORAGE_IDENTITIES)))
    .replaceAll('@@SD_EXTERNAL_REPOSITORY_IDENTITIES@@',JSON.stringify(EXTERNAL_REPOSITORY_IDENTITIES))
    .replaceAll('@@SD_EXTERNAL_REPOSITORY_IDENTITIES_URI@@',encodeURIComponent(JSON.stringify(EXTERNAL_REPOSITORY_IDENTITIES)))

  invariant(!/@@SD_[A-Z_]+@@/.test(rendered),`Unresolved release token in ${sourceName}.`);
  return rendered;
}
function renderPlatformTokens(value:string,identity:Identity,sourceName:string,tokens:Readonly<Record<string,unknown>>={}){
  let rendered=value;
  Object.entries(tokens).forEach(([name,replacement])=>{rendered=rendered.replaceAll(`@@SD_${name}@@`,String(replacement));});
  return renderTokens(rendered,identity,sourceName);
}
function renderExternalModule(module:ExternalModule,identity:Identity,tokens:Readonly<Record<string,unknown>>={}){
  return externalModuleFiles(module).map(({origin,file})=>{
    const sourceName=origin==='source'?file:`generated/runtime/${file}`;
    const value=origin==='source'?sourceFile(file):generatedRuntimeFile(file);
    const rendered=renderPlatformTokens(value,identity,sourceName,tokens);
    return file.endsWith('.ts')?compileScript(rendered,sourceName):rendered;
  }).join('\n');
}
function assertCanonicalSource(){
  const expected=[
    htmlSource,...hostScripts.map(row=>row.source),...privateModules.map(row=>row.source),...authoredExternalSourceFiles(),...styleModules.map(row=>row.source),
    ...Object.values(platformFiles).map(row=>row.source),...staticAssets.map(row=>row.source)
  ].sort();
  const actual=relativeFiles(SOURCE);
  invariant(!actual.some(name=>name.endsWith('.js')),'Canonical source must not contain JavaScript runtime artifacts.');
  invariant(JSON.stringify(actual)===JSON.stringify(expected),'Canonical source inventory differs from the module manifest.');
  const joined=[
    htmlSource,...hostScripts.map(row=>row.source),...privateModules.map(row=>row.source),...authoredExternalSourceFiles(),...styleModules.map(row=>row.source),
    ...Object.values(platformFiles).map(row=>row.source)
  ].map(name=>sourceFile(name)).join('\n');
  invariant(!/\bSDV[A-Z]\d+[a-z]*(?:[NR]\d+)?\b/.test(joined),'Canonical source contains a stamped SDV release.');
  invariant(!/\b(?:sd)?v[a-z]\d+[a-z]*(?:[nr]\d+)?\b/.test(joined),'Canonical source contains a stamped SDV release id.');
  const html=readHostHtml(SOURCE);
  invariant(html.split(privateModuleMarker).length===2,'Canonical HTML must contain exactly one private-module marker.');
  const ids=privateModules.map(module=>module.id);
  invariant(privateModules[0]?.id==='internal','The internal registry must be the first private module.');
  invariant(new Set(ids).size===ids.length,'Private module ids must be unique.');
  invariant(new Set(privateModules.map(module=>module.source)).size===privateModules.length,'Private module sources must be unique.');
  invariant(new Set(privateModules.map(module=>module.stem)).size===privateModules.length,'Private module output stems must be unique.');
  invariant(Object.keys(runtimeDependencies).sort().join('|')===[...ids].sort().join('|'),'Runtime dependency graph inventory differs from private modules.');
  const position=new Map(ids.map((id,index)=>[id,index]));
  for(const id of ids){
    const dependencies=dependencyList(id);
    invariant(Boolean(Array.isArray(dependencies))&&Object.isFrozen(dependencies),`Runtime dependencies for ${id} must be a frozen array.`);
    invariant(new Set(dependencies).size===dependencies.length,`Runtime dependencies for ${id} contain a duplicate edge.`);
    for(const dependency of dependencies){
      invariant(position.has(dependency),`Runtime dependency ${id} -> ${dependency} is undeclared.`);
      invariant(required(position,dependency)<required(position,id),`Runtime dependency graph is cyclic or not topologically ordered at ${id} -> ${dependency}.`);
    }
  }
  for(const module of privateModules){
    const value=sourceFile(module.source);
    invariant(!/<\/script/i.test(value),`Private module ${module.id} contains a closing script tag and cannot be safely inlined.`);
    invariant(!/\bregistry\.require\s*\(/.test(value),`Private module ${module.id} resolves another private module directly.`);
    if(module.id!=='internal'){
      const registryId=module.registryId||module.id;
      const definitions=value.match(new RegExp(`registry\\.define\\('${escapeRegExp(registryId)}',`,'g'))||[];
      invariant(definitions.length===1,`Private module ${module.id} must define exactly one matching registry entry.`);
    }
  }
  const requiredRegistryIds=[...html.matchAll(/INTERNAL_MODULES\.load\('([^']+)'/g)].map(match=>match[1]).sort();
  const expectedRequired=privateModules.filter(module=>module.id!=='internal').map(module=>module.registryId||module.id).sort();
  invariant(JSON.stringify(requiredRegistryIds)===JSON.stringify(expectedRequired),'The host must resolve every private application module exactly once and no others.');
  invariant(!/INTERNAL_MODULES\.require\(/u.test(html),'The host must validate private-module exports through the canonical loader.');
  for(const module of externalModules){
    const value=externalModuleSource(module);
    invariant(!value.includes("Symbol.for('studyDirector.internalModules.v1')"),`External module ${module.id} reaches into the private registry.`);
  }
  invariant(externalModules.map(module=>module.id).join('|')===trustedExternalModuleIds.join('|'),'External runtime modules differ from the fixed reviewed allowlist.');
  invariant(externalModules.every(module=>module.execution==='startup'||module.execution==='on-demand'||module.execution==='worker'),'External runtime execution mode is invalid.');
  const insightsModule=externalModules.find(module=>module.id==='insights');
  const insightsSources=insightsModule?authoredModuleSourceFiles(insightsModule):[];
  invariant(JSON.stringify(insightsSources)===JSON.stringify(['external/insights-model.ts','external/insights-protocol.ts','external/insights-worker.ts','external/insights-compute.ts','external/insights-rendering.ts','external/insights-runtime.ts']),'The checked Insights model, protocol, worker bridge, renderer and retained runtime must remain ordered inside one runtime asset.');
  const insightsPortable=insightsSources.slice(0,2).map(sourceFile).join('\n');
  invariant(!/\b(?:document|localStorage|sessionStorage|requestAnimationFrame|Worker|querySelector|createElement)\b/u.test(insightsPortable),'Insights model/protocol must remain independent of DOM, browser storage, animation, and worker APIs.');
}

export function renderBuild(){
  assertGeneratedRuntime();
  assertCanonicalSource();
  const identity=releaseIdentity();
  const privateSources=new Map(privateModules.map(module=>[
    module.id,
    compileScript(renderTokens(sourceFile(module.source),identity,module.source),module.source)
  ]));
  const oauth=releaseConfig.googleOAuth;
  const productionClientId=String(oauth.productionClientId||'').trim();
  const developmentClientId=String(oauth.developmentClientId||'').trim();
  invariant(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/u.test(productionClientId),'Production Google OAuth client ID is missing or malformed.');
  invariant(!developmentClientId||/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/u.test(developmentClientId),'Development Google OAuth client ID is malformed.');
  invariant(!developmentClientId||developmentClientId!==productionClientId,'Development and production must not share a Google OAuth client.');
  const externalSources=Object.freeze({
    development:new Map(externalModules.map(module=>[
      module.id,
      renderExternalModule(module,identity,{GOOGLE_OAUTH_CLIENT_ID:module.id==='drive'?developmentClientId:productionClientId})
    ])),
    deployment:new Map(externalModules.map(module=>[
      module.id,
      renderExternalModule(module,identity,{GOOGLE_OAUTH_CLIENT_ID:productionClientId})
    ]))
  });
  const styleSources=new Map(styleModules.map(module=>[
    module.id,renderTokens(sourceFile(module.source),identity,module.source)
  ]));
  const privateNames=new Map(privateModules.map(module=>[module.id,filename(module,required(privateSources,module.id))]));
  const styleNames=new Map(styleModules.map(module=>[module.id,styleFilename(module,required(styleSources,module.id))]));
  const externalNames=Object.freeze({
    development:new Map(externalModules.map(module=>[module.id,filename(module,required(externalSources.development,module.id))])),
    deployment:new Map(externalModules.map(module=>[module.id,filename(module,required(externalSources.deployment,module.id))]))
  });
  const templateSource=readHostHtml(SOURCE);
  const template=(target:BuildTarget)=>renderPlatformTokens(templateSource,identity,htmlSource,{
    EXTERNAL_GLASS_FILENAME:required(externalNames[target],'glass'),
    EXTERNAL_AURORA_FILENAME:required(externalNames[target],'aurora'),
    EXTERNAL_GUIDE_FILENAME:required(externalNames[target],'guide'),
    EXTERNAL_INSIGHTS_FILENAME:required(externalNames[target],'insights'),
    EXTERNAL_DRIVE_FILENAME:required(externalNames[target],'drive'),
    RICH_TEXT_FILENAME:required(externalNames[target],'rich-text'),
    EXPORT_WORKER_FILENAME:required(externalNames[target],'export-worker'),
    SEARCH_WORKER_FILENAME:required(externalNames[target],'search-worker'),
    IMAGE_WORKER_FILENAME:required(externalNames[target],'image-worker'),
    ATTACHMENT_WORKER_FILENAME:required(externalNames[target],'attachment-worker'),
    CORE_STYLE_FILENAME:required(styleNames,'core')
  });
  const developmentTags=privateModules.map(module=>`<script src="${required(privateNames,module.id)}"></script>`).join('\n');
  const deploymentTags=developmentTags;
  const manifestSource=renderTokens(sourceFile(platformFiles.manifest.source),identity,platformFiles.manifest.source);
  const serviceWorkerTemplate=compileScript(sourceFile(platformFiles.serviceWorker.source),platformFiles.serviceWorker.source);
  const staticSources=new Map(staticAssets.map(asset=>[
    asset.source,
    asset.template?Buffer.from(renderTokens(sourceFile(asset.source),identity,asset.source),'utf8'):sourceBytes(asset.source)
  ]));
  const legalReaderSources=new Map(legalReaderAssets.map(reader=>[reader.output,legalReaderHtml(reader,sourceFile(reader.source))]));
  const renderTarget=(target:BuildTarget,html:string)=>{
    const files=new Map<string,BuildValue>([[identity.main,html]]);
    for(const module of privateModules)files.set(required(privateNames,module.id),required(privateSources,module.id));
    for(const module of externalModules)files.set(required(externalNames[target],module.id),required(externalSources[target],module.id));
    for(const module of styleModules)files.set(required(styleNames,module.id),required(styleSources,module.id));
    files.set(platformFiles.manifest.output,manifestSource);
    for(const asset of staticAssets){
      if(asset.targets.includes(target))files.set(asset.output,required(staticSources,asset.source));
    }
    for(const reader of legalReaderAssets)files.set(reader.output,required(legalReaderSources,reader.output));
    // The page needs a non-circular identity for the assets it actually booted.
    // Hash the fully rendered inventory before replacing this HTML sentinel.
    const assetId=sha256(JSON.stringify([...files].sort(([a],[b])=>a.localeCompare(b)).map(([name,value])=>[name,sha256(value)]))).slice(0,24);
    html=html.replaceAll('__SD_PAGE_ASSET_ID__',assetId);files.set(identity.main,html);
    if(target==='deployment'){
      const inlineScripts=[...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match=>`'sha256-${sha256Base64(match[1]??'')}'`);
      invariant(inlineScripts.length>0,'Deployment CSP has no inline application scripts to authorize.');
      const contentSecurityPolicy=[
        "default-src 'self'",
        `script-src 'self' ${inlineScripts.join(' ')} https://accounts.google.com`,
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "img-src 'self' data: blob:",
        "connect-src 'self' https://accounts.google.com https://www.googleapis.com",
        "frame-src https://accounts.google.com blob:",
        "worker-src 'self'",
        "manifest-src 'self'",
        "media-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
        "require-trusted-types-for 'script'",
        "trusted-types sd-inert-html sd-assets sd-legal-html sd-insights-worker sd-google-signin"
      ].join('; ');
      const hostingHeadersSource=renderPlatformTokens(sourceFile(platformFiles.hostingHeaders.source),identity,platformFiles.hostingHeaders.source,{CONTENT_SECURITY_POLICY:contentSecurityPolicy});
      files.set(platformFiles.hostingHeaders.output,hostingHeadersSource);
    }
    const precacheNames=[
      identity.main,platformFiles.manifest.output,
      ...[...files.keys()].filter(name=>name.endsWith('.js')||name.endsWith('.css')),
      ...staticAssets.filter(asset=>asset.precache&&asset.targets.includes(target)).map(asset=>asset.output),
      ...legalReaderAssets.map(reader=>reader.output)
    ].filter((name,index,names)=>name!==platformFiles.serviceWorker.output&&names.indexOf(name)===index).sort();
    const precache=precacheNames.map(name=>Object.freeze({path:`./${normalizePath(name)}`,sha256:sha256(required(files,name))}));
    // Derive the release from the actual rendered worker contract, normalized
    // only at its self-referential release field.
    const workerForIdentity=renderPlatformTokens(serviceWorkerTemplate,identity,platformFiles.serviceWorker.source,{
      PWA_RELEASE_ID:PWA_RELEASE_SENTINEL,
      PAGE_ASSET_ID:assetId,
      PWA_ASSET_MANIFEST:JSON.stringify(precache)
    });
    const pwaReleaseId=sha256(JSON.stringify({precache,worker:sha256(workerForIdentity)})).slice(0,24);
    const releaseNeedle=`const RELEASE_ID='${PWA_RELEASE_SENTINEL}';`,releaseValue=`const RELEASE_ID='${pwaReleaseId}';`;
    invariant(workerForIdentity.split(releaseNeedle).length===2,'Service Worker release sentinel is missing or duplicated.');
    const serviceWorker=workerForIdentity.replace(releaseNeedle,releaseValue);
    files.set(platformFiles.serviceWorker.output,serviceWorker);
    return Object.freeze({files,pwa:Object.freeze({releaseId:pwaReleaseId,assetId,precache:Object.freeze(precache)})});
  };
  const developmentTarget=renderTarget('development',template('development').replace(privateModuleMarker,()=>developmentTags));
  const deploymentTarget=renderTarget('deployment',template('deployment').replace(privateModuleMarker,()=>deploymentTags));
  return Object.freeze({
    identity,
    development:developmentTarget.files,
    deployment:deploymentTarget.files,
    pwa:Object.freeze({development:developmentTarget.pwa,deployment:deploymentTarget.pwa}),
    privateSources,externalSources,styleSources,privateNames,externalNames,styleNames,staticSources,legalReaderSources
  });
}

function sourceHashes(){
  return Object.fromEntries<string>([
    htmlSource,...hostScripts.map(row=>row.source),...privateModules.map(row=>row.source),...authoredExternalSourceFiles(),...styleModules.map(row=>row.source),
    ...Object.values(platformFiles).map(row=>row.source),...staticAssets.map(row=>row.source)
  ].sort().map(name=>[name,sha256(sourceBytes(name))] as const));
}
function generatedRuntimeHashes(){
  return Object.fromEntries<string>(generatedRuntimeFiles().sort().map(name=>[name,sha256(fs.readFileSync(generatedRuntimePath(WORK,name)))] as const));
}
function outputHashes(files:FileMap){return Object.fromEntries<string>([...files].sort(([a],[b])=>a.localeCompare(b)).map(([name,value])=>[name,sha256(value)] as const));}
function validateReleaseIdentities(files:FileMap,identity:Identity,label:string){
  const allowed=new Set([identity.release,identity.id,`sd${identity.id}`]);
  for(const [name,value] of files){
    if(typeof value!=='string')continue;
    for(const match of value.matchAll(/\b(?:SDV[A-Z]\d+[a-z]*(?:[NR]\d+)?|sdv[a-z]\d+[a-z]*(?:[nr]\d+)?|v[a-z]\d+[a-z]*(?:[nr]\d+)?)\b/g)){
      invariant(allowed.has(match[0]),`${label}/${name} contains stale release identity ${match[0]}.`);
    }
  }
}

function expectedStaticOutputs(target:BuildTarget){return [...staticAssets.filter(asset=>asset.targets.includes(target)).map(asset=>asset.output),...legalReaderAssets.map(reader=>reader.output)];}
function verifyPwaTarget(files:FileMap,pwa:PwaIdentity,label:string){
  invariant(pwa&&/^[a-f0-9]{24}$/.test(pwa.releaseId),`${label} PWA release identity is invalid.`);
  invariant(/^[a-f0-9]{24}$/.test(pwa.assetId),`${label} page asset identity is invalid.`);
  invariant(requiredText(files,'index.html').includes(`<meta name="study-director-assets" content="${pwa.assetId}">`),`${label} boot asset identity drifted.`);
  const serviceWorker=requiredText(files,platformFiles.serviceWorker.output),releaseNeedle=`const RELEASE_ID='${pwa.releaseId}';`,normalizedRelease=`const RELEASE_ID='${PWA_RELEASE_SENTINEL}';`;
  invariant(typeof serviceWorker==='string'&&serviceWorker.split(releaseNeedle).length===2,`${label} service worker release identity drifted.`);
  const normalizedWorker=serviceWorker.replace(releaseNeedle,normalizedRelease);
  invariant(pwa.releaseId===sha256(JSON.stringify({precache:pwa.precache,worker:sha256(normalizedWorker)})).slice(0,24),`${label} worker-inclusive PWA identity drifted from actual output.`);
  invariant(Boolean(Array.isArray(pwa.precache))&&pwa.precache.length>0,`${label} precache inventory is empty.`);
  const paths=pwa.precache.map(asset=>asset.path);
  invariant(new Set(paths).size===paths.length,`${label} precache inventory contains duplicates.`);
  invariant(!paths.some(value=>/sw\.js|firebase\.json|\.sdbackup|assets\/licenses\//i.test(value)),`${label} precache inventory contains an excluded asset.`);
  for(const asset of pwa.precache){
    const name=asset.path.replace(/^\.\//,'');
    invariant(files.has(name),`${label} precache asset is missing: ${name}.`);
    invariant(sha256(required(files,name))===asset.sha256,`${label} precache hash drifted: ${name}.`);
  }
  invariant(serviceWorker.includes(`const PRECACHE=parsePrecache('${JSON.stringify(pwa.precache)}')`),`${label} service worker asset manifest drifted.`);
}

export function validateBuild(build:ReturnType<typeof renderBuild>){
  const {identity,development,deployment,pwa,privateSources,externalSources,styleSources,privateNames,externalNames,styleNames,staticSources,legalReaderSources}=build;
  const productionClientId=String(releaseConfig.googleOAuth&&releaseConfig.googleOAuth.productionClientId||'').trim();
  const platformShared=[platformFiles.manifest.output,platformFiles.serviceWorker.output];
  const devExpected=[identity.main,...privateModules.map(row=>required(privateNames,row.id)),...externalModules.map(row=>required(externalNames.development,row.id)),...styleModules.map(row=>required(styleNames,row.id)),...platformShared,...expectedStaticOutputs('development')].sort();
  const deployExpected=[identity.main,...privateModules.map(row=>required(privateNames,row.id)),...externalModules.map(row=>required(externalNames.deployment,row.id)),...styleModules.map(row=>required(styleNames,row.id)),...platformShared,platformFiles.hostingHeaders.output,...expectedStaticOutputs('deployment')].sort();
  invariant(JSON.stringify([...development.keys()].sort())===JSON.stringify(devExpected),'Development inventory is invalid.');
  invariant(JSON.stringify([...deployment.keys()].sort())===JSON.stringify(deployExpected),'Deployment inventory is invalid.');
  const devHtml=requiredText(development,identity.main),deployHtml=requiredText(deployment,identity.main);
  const srcPattern=/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi;
  const devScripts=[...devHtml.matchAll(srcPattern)].map(match=>match[1]);
  const deployScripts=[...deployHtml.matchAll(srcPattern)].map(match=>match[1]);
  const expectedDevScripts=[required(externalNames.development,'glass'),required(externalNames.development,'aurora'),...privateModules.map(row=>required(privateNames,row.id)),required(externalNames.development,'rich-text'),required(externalNames.development,'drive')];
  const expectedDeployScripts=[required(externalNames.deployment,'glass'),required(externalNames.deployment,'aurora'),...privateModules.map(row=>required(privateNames,row.id)),required(externalNames.deployment,'rich-text'),required(externalNames.deployment,'drive')];
  invariant(JSON.stringify(devScripts)===JSON.stringify(expectedDevScripts),'Development script order or inventory is invalid.');
  invariant(JSON.stringify(deployScripts)===JSON.stringify(expectedDeployScripts),'Deployment script order or inventory is invalid.');
  for(const target of ['development','deployment'] as const){
    const html=target==='development'?devHtml:deployHtml;
    for(const id of ['guide','insights']){
      const name=required(externalNames[target],id);
      invariant(html.includes(`src:'${name}'`),`${target} ${id} on-demand plugin identity is invalid.`);
    }
    const richTextName=required(externalNames[target],'rich-text');
    invariant(html.includes(`<link rel="preload" as="script" href="${richTextName}">`),`${target} rich-text startup preload is missing.`);
  }
  for(const module of privateModules){
    const name=required(privateNames,module.id),expected=required(privateSources,module.id);
    invariant(development.get(name)===expected&&deployment.get(name)===expected,`Cacheable private-module bytes drifted for ${module.id}.`);
    invariant(name===filename(module,expected),`Private-module content filename drifted for ${module.id}.`);
  }
  for(const module of styleModules){
    const name=required(styleNames,module.id),expected=required(styleSources,module.id);
    invariant(development.get(name)===expected&&deployment.get(name)===expected,`Cacheable stylesheet bytes drifted for ${module.id}.`);
    invariant(name===styleFilename(module,expected),`Stylesheet content filename drifted for ${module.id}.`);
    invariant(devHtml.includes(`href="${name}"`)&&deployHtml.includes(`href="${name}"`),`Host stylesheet identity drifted for ${module.id}.`);
  }
  for(const module of externalModules){
    const developmentName=required(externalNames.development,module.id),deploymentName=required(externalNames.deployment,module.id);
    invariant(development.get(developmentName)===required(externalSources.development,module.id),`Development external bytes drifted for ${module.id}.`);
    invariant(deployment.get(deploymentName)===required(externalSources.deployment,module.id),`Deployment external bytes drifted for ${module.id}.`);
    invariant(developmentName===filename(module,required(development,developmentName)),`Development content filename drifted for ${module.id}.`);
    invariant(deploymentName===filename(module,required(deployment,deploymentName)),`Deployment content filename drifted for ${module.id}.`);
  }
  for(const asset of staticAssets){
    const expected=required(staticSources,asset.source);
    for(const [label,files] of [['development',development],['deployment',deployment]] as const){
      if(!asset.targets.includes(label))continue;
      const actual=files.get(asset.output);
      invariant(Buffer.isBuffer(actual)&&actual.equals(expected),`${label} static asset drifted: ${asset.output}.`);
    }
  }
  for(const reader of legalReaderAssets){
    const expected=required(legalReaderSources,reader.output);
    invariant(development.get(reader.output)===expected&&deployment.get(reader.output)===expected,`Generated legal reader drifted: ${reader.output}.`);
    const plainText=expected.match(/<pre class="legal-plain-text">([\s\S]*?)<\/pre>/)?.[1]||'';
    invariant(plainText===escapeHtml(sourceFile(reader.source)),`Generated legal reader content drifted from ${reader.source}.`);
  }
  const normalizePrivateBlock=(value:string)=>value
    .replace(privateModules.map(row=>`<script src="${required(privateNames,row.id)}"></script>`).join('\n'),privateModuleMarker);
  const normalizeHost=(value:string,target:BuildTarget)=>{
    let normalized=normalizePrivateBlock(value).replaceAll(pwa[target].assetId,'__SD_PAGE_ASSET_ID__');
    for(const id of ['glass','aurora','guide','insights','drive','rich-text'])normalized=normalized.replaceAll(required(externalNames[target],id),`@@SD_EXTERNAL_${id.toUpperCase()}_FILENAME@@`);
    for(const module of styleModules)normalized=normalized.replaceAll(required(styleNames,module.id),`@@SD_${module.id.toUpperCase()}_STYLE_FILENAME@@`);
    return normalized;
  };
  invariant(normalizeHost(devHtml,'development')===normalizeHost(deployHtml,'deployment'),'Host HTML differs beyond generated module identities and the private-module packaging block.');
  validateReleaseIdentities(development,identity,'development');
  validateReleaseIdentities(deployment,identity,'deployment');
  verifyPwaTarget(development,pwa.development,'development');
  verifyPwaTarget(deployment,pwa.deployment,'deployment');
  const manifest=asRecord(JSON.parse(requiredText(deployment,platformFiles.manifest.output)) as unknown);
  const related=asRows(manifest['related_applications']),shortcuts=asRows(manifest['shortcuts']);
  invariant(manifest['id']==='./'&&manifest['start_url']==='./'&&manifest['scope']==='./','Manifest identity, start URL, or scope is unstable.');
  invariant(related.length===1&&related[0]?.['platform']==='webapp'&&related[0]?.['url']==='./manifest.webmanifest'&&related[0]?.['id']==='./','Manifest same-PWA installation relationship drifted.');
  invariant(shortcuts.map(item=>item['url']).join('|')==='./?tab=plan|./?tab=execute|./?tab=review|./?tab=library|./?tab=insights|./?tab=guide','Manifest shortcuts drifted.');
  invariant(deployment.has(platformFiles.hostingHeaders.output)&&!deployment.has('firebase.json'),'Deployment header handoff is missing or can overwrite project Firebase configuration.');
  invariant(/<link[^>]+rel="manifest"[^>]+href="manifest\.webmanifest"/i.test(deployHtml),'Application manifest link is missing.');
  invariant(!/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(deployHtml),'Deployment still depends on remote fonts.');
  const driveSource=requiredText(deployment,required(externalNames.deployment,'drive'));
  invariant(/const GOOGLE_OAUTH_CLIENT_ID='\d+-[a-z0-9]+\.apps\.googleusercontent\.com';/u.test(driveSource),'Google OAuth client ID is missing or malformed.');
  const developmentDriveSource=requiredText(development,required(externalNames.development,'drive'));
  invariant(!developmentDriveSource.includes(productionClientId),'Development build must never contain the production Google OAuth client ID.');
  const hosting=asRecord(JSON.parse(requiredText(deployment,platformFiles.hostingHeaders.output)) as unknown);
  const securityRule=asRows(asRecord(hosting['hosting'])['headers']).find(rule=>rule['source']==='/**');
  const securityHeaders=new Map<string,string>();
  for(const header of asRows(securityRule?.['headers']??[])){if(typeof header['key']!=='string'||typeof header['value']!=='string')throw new Error('Invalid hosting header.');securityHeaders.set(header['key'],header['value']);}
  const csp=securityHeaders.get('Content-Security-Policy');
  invariant(csp&&csp.includes("frame-ancestors 'none'")&&csp.includes('https://accounts.google.com')&&csp.includes('https://www.googleapis.com'),'Deployment Content Security Policy is incomplete.');
  invariant(securityHeaders.get('X-Content-Type-Options')==='nosniff'&&securityHeaders.get('Referrer-Policy')==='no-referrer'&&securityHeaders.get('X-Frame-Options')==='DENY','Deployment security headers are incomplete.');
  return true;
}

export function buildManifest(build:ReturnType<typeof renderBuild>){
  validateBuild(build);
  return Object.freeze({
    format:'study-director-build-manifest',version:2,
    release:build.identity.release,releaseId:build.identity.id,buildId:build.identity.buildId,sourceCommit:build.identity.sourceCommit,main:build.identity.main,
    sourceDateEpoch:releaseConfig.sourceDateEpoch,minified:false,
    privateModuleOrder:privateModules.map(row=>row.id),cacheableCoreFiles:privateModules.map(row=>required(build.privateNames,row.id)),cacheableStyleFiles:styleModules.map(row=>required(build.styleNames,row.id)),externalRuntimeFiles:externalModules.map(row=>required(build.externalNames.deployment,row.id)),externalExecution:Object.fromEntries(externalModules.map(row=>[row.id,row.execution])),
    developmentRuntimeFiles:[...privateModules.map(row=>required(build.privateNames,row.id)),...externalModules.map(row=>required(build.externalNames.development,row.id))],
    runtimeDependencies:Object.fromEntries(privateModules.map(row=>[row.id,[...dependencyList(row.id)]])),
    pwa:Object.freeze({
      development:Object.freeze({releaseId:build.pwa.development.releaseId,assetId:build.pwa.development.assetId,precache:build.pwa.development.precache}),
      deployment:Object.freeze({releaseId:build.pwa.deployment.releaseId,assetId:build.pwa.deployment.assetId,precache:build.pwa.deployment.precache})
    }),
    sourceSha256:sourceHashes(),
    generatedRuntimeSha256:generatedRuntimeHashes(),
    developmentSha256:outputHashes(build.development),
    deploymentSha256:outputHashes(build.deployment)
  });
}

function writeFile(target:string,value:BuildValue){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);}
function recursiveEntries(directory:string){
  const entries:string[]=[];
  function walk(current:string){
    for(const entry of fs.readdirSync(current,{withFileTypes:true})){
      const absolute=path.join(current,entry.name);
      if(entry.isDirectory())walk(absolute);else entries.push(absolute);
    }
  }
  walk(directory);return entries;
}
export function writeBuild(build=renderBuild()){
  validateBuild(build);
  const developmentDir=path.join(DIST,'development'),deploymentDir=path.join(DIST,'deployment');
  for(const directory of [developmentDir,deploymentDir]){
    if(fs.existsSync(directory))fs.rmSync(directory,{recursive:true,force:true});
    fs.mkdirSync(directory,{recursive:true});
  }
  for(const [name,value] of build.development)writeFile(path.join(developmentDir,name),value);
  for(const [name,value] of build.deployment)writeFile(path.join(deploymentDir,name),value);
  const manifest=buildManifest(build);
  writeFile(path.join(DIST,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const epoch=new Date(releaseConfig.sourceDateEpoch);
  for(const directory of [developmentDir,deploymentDir]){
    for(const target of recursiveEntries(directory))fs.utimesSync(target,epoch,epoch);
    fs.utimesSync(directory,epoch,epoch);
  }
  fs.utimesSync(path.join(DIST,'build-manifest.json'),epoch,epoch);
  return manifest;
}

export function buildCli(){
  const manifest=writeBuild();
  console.log(JSON.stringify({
    status:'PASS',release:manifest.release,
    developmentFiles:Object.keys(manifest.developmentSha256).length,
    deploymentFiles:Object.keys(manifest.deploymentSha256).length,
    pwaReleaseId:manifest.pwa.deployment.releaseId,minified:manifest.minified
  },null,2));
}
