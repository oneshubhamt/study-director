import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import releaseConfig from '../release.config.mjs';
import {PRODUCTION_LIMITS,assertProductionLimits} from '../contracts/production-limits.mjs';
import {LOCAL_STORAGE_KEYS,SESSION_STORAGE_KEYS,OBSOLETE_LOCAL_STORAGE_KEYS,APP_META_KEYS,OBSOLETE_APP_META_KEYS,RENAMED_APP_META_KEYS,APP_META_RUNTIME_REGISTRY,assertDataArchitecture} from '../contracts/data-architecture.mjs';
import {RUNTIME_DATA_CONTRACT,INDEXED_DB_STORE_NAMES,OBSOLETE_INDEXED_DB,OPFS_IDENTITIES,OBSOLETE_OPFS_IDENTITIES,CACHE_STORAGE_IDENTITIES,EXTERNAL_REPOSITORY_IDENTITIES,assertCanonicalIdentities} from '../contracts/canonical-identities.mjs';
import {LEGACY_BACKUP_SCHEMA_VERSION,assertCompatibilityContract} from '../contracts/compatibility.mjs';
import {
  privateModules,externalModules,styleModules,trustedExternalModuleIds,runtimeDependencies,htmlSource,privateModuleMarker,
  platformFiles,staticAssets,legalReaderAssets
} from './module-manifest.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
export const WORK=path.resolve(HERE,'..');
export const SOURCE=path.join(WORK,'source');
export const DIST=path.join(WORK,'dist');

function invariant(condition,message){if(!condition)throw new Error(message);}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function sha256Base64(value){return crypto.createHash('sha256').update(value).digest('base64');}
function normalizePath(value){return value.split(path.sep).join('/');}
function sourceFile(relative){return fs.readFileSync(path.join(SOURCE,relative),'utf8');}
function sourceBytes(relative){return fs.readFileSync(path.join(SOURCE,relative));}
function moduleSourceFiles(module){return Array.isArray(module.sources)?[...module.sources]:[module.source];}
function moduleSource(module){return moduleSourceFiles(module).map(sourceFile).join('\n');}
function externalSourceFiles(){return externalModules.flatMap(moduleSourceFiles);}
function escapeRegExp(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function escapeHtml(value){return String(value).replace(/[&<>]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[character]));}

function legalReaderHtml(reader,text){
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
  return Object.freeze({release,id,buildId,main:'index.html'});
}

function filename(module,value){return `${module.stem}.${sha256(value).slice(0,12)}.js`;}
function styleFilename(module,value){return `${module.stem}.${sha256(value).slice(0,12)}.css`;}
function renderTokens(value,identity,sourceName){
  assertProductionLimits(PRODUCTION_LIMITS);
  assertCanonicalIdentities();
  assertDataArchitecture();
  assertCompatibilityContract();
  const rendered=value
    .replaceAll('@@SD_RELEASE@@',identity.release)
    .replaceAll('@@SD_RELEASE_ID@@',identity.id)
    .replaceAll('@@SD_BUILD_ID@@',identity.buildId)
    .replaceAll('@@SD_PRODUCTION_LIMITS@@',JSON.stringify(PRODUCTION_LIMITS))
    .replaceAll('@@SD_LOCAL_STORAGE_KEYS@@',JSON.stringify(LOCAL_STORAGE_KEYS))
    .replaceAll('@@SD_THEME_STORAGE_KEY@@',LOCAL_STORAGE_KEYS.theme)
    .replaceAll('@@SD_PRESENTATION_STORAGE_KEY@@',LOCAL_STORAGE_KEYS.presentation)
    .replaceAll('@@SD_SESSION_STORAGE_KEYS@@',JSON.stringify(SESSION_STORAGE_KEYS))
    .replaceAll('@@SD_OBSOLETE_LOCAL_STORAGE_KEYS@@',JSON.stringify(OBSOLETE_LOCAL_STORAGE_KEYS))
    .replaceAll('@@SD_APP_META_KEYS@@',JSON.stringify(APP_META_KEYS))
    .replaceAll('@@SD_APP_META_REGISTRY@@',JSON.stringify(APP_META_RUNTIME_REGISTRY))
    .replaceAll('@@SD_OBSOLETE_APP_META_KEYS@@',JSON.stringify(OBSOLETE_APP_META_KEYS))
    .replaceAll('@@SD_RENAMED_APP_META_KEYS@@',JSON.stringify(RENAMED_APP_META_KEYS))
    .replaceAll('@@SD_RUNTIME_DATA_CONTRACT@@',JSON.stringify(RUNTIME_DATA_CONTRACT))
    .replaceAll('@@SD_INDEXED_DB_STORE_NAMES@@',JSON.stringify(INDEXED_DB_STORE_NAMES))
    .replaceAll('@@SD_OBSOLETE_INDEXED_DB@@',JSON.stringify(OBSOLETE_INDEXED_DB))
    .replaceAll('@@SD_ATTACHMENT_OPFS_DIRECTORY@@',OPFS_IDENTITIES.attachments)
    .replaceAll('@@SD_BACKUP_FILES_OPFS_DIRECTORY@@',OPFS_IDENTITIES.backupFiles)
    .replaceAll('@@SD_LEGACY_ATTACHMENT_OPFS_DIRECTORY@@',OBSOLETE_OPFS_IDENTITIES.attachmentsV1)
    .replaceAll('@@SD_CACHE_STORAGE_IDENTITIES@@',JSON.stringify(CACHE_STORAGE_IDENTITIES))
    .replaceAll('@@SD_EXTERNAL_REPOSITORY_IDENTITIES@@',JSON.stringify(EXTERNAL_REPOSITORY_IDENTITIES))
    .replaceAll('@@SD_LEGACY_BACKUP_SCHEMA_VERSION@@',String(LEGACY_BACKUP_SCHEMA_VERSION))

  invariant(!/@@SD_[A-Z_]+@@/.test(rendered),`Unresolved release token in ${sourceName}.`);
  return rendered;
}
function renderPlatformTokens(value,identity,sourceName,tokens={}){
  let rendered=value;
  Object.entries(tokens).forEach(([name,replacement])=>{rendered=rendered.replaceAll(`@@SD_${name}@@`,String(replacement));});
  return renderTokens(rendered,identity,sourceName);
}
function assertCanonicalSource(){
  const expected=[
    htmlSource,...privateModules.map(row=>row.source),...externalSourceFiles(),...styleModules.map(row=>row.source),
    ...Object.values(platformFiles).map(row=>row.source),...staticAssets.map(row=>row.source)
  ].sort();
  const actual=[];
  function walk(directory,prefix=''){
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      const relative=prefix?`${prefix}/${entry.name}`:entry.name;
      if(entry.isDirectory())walk(path.join(directory,entry.name),relative);
      else actual.push(relative);
    }
  }
  walk(SOURCE);
  actual.sort();
  invariant(JSON.stringify(actual)===JSON.stringify(expected),'Canonical source inventory differs from the module manifest.');
  const joined=[
    htmlSource,...privateModules.map(row=>row.source),...externalSourceFiles(),...styleModules.map(row=>row.source),
    ...Object.values(platformFiles).map(row=>row.source)
  ].map(name=>sourceFile(name)).join('\n');
  invariant(!/\bSDV[A-Z]\d+[a-z]*(?:[NR]\d+)?\b/.test(joined),'Canonical source contains a stamped SDV release.');
  invariant(!/\b(?:sd)?v[a-z]\d+[a-z]*(?:[nr]\d+)?\b/.test(joined),'Canonical source contains a stamped SDV release id.');
  const html=sourceFile(htmlSource);
  invariant(html.split(privateModuleMarker).length===2,'Canonical HTML must contain exactly one private-module marker.');
  const ids=privateModules.map(module=>module.id);
  invariant(privateModules[0]?.id==='internal','The internal registry must be the first private module.');
  invariant(new Set(ids).size===ids.length,'Private module ids must be unique.');
  invariant(new Set(privateModules.map(module=>module.source)).size===privateModules.length,'Private module sources must be unique.');
  invariant(new Set(privateModules.map(module=>module.stem)).size===privateModules.length,'Private module output stems must be unique.');
  invariant(Object.keys(runtimeDependencies).sort().join('|')===[...ids].sort().join('|'),'Runtime dependency graph inventory differs from private modules.');
  const position=new Map(ids.map((id,index)=>[id,index]));
  for(const id of ids){
    const dependencies=runtimeDependencies[id];
    invariant(Array.isArray(dependencies)&&Object.isFrozen(dependencies),`Runtime dependencies for ${id} must be a frozen array.`);
    invariant(new Set(dependencies).size===dependencies.length,`Runtime dependencies for ${id} contain a duplicate edge.`);
    for(const dependency of dependencies){
      invariant(position.has(dependency),`Runtime dependency ${id} -> ${dependency} is undeclared.`);
      invariant(position.get(dependency)<position.get(id),`Runtime dependency graph is cyclic or not topologically ordered at ${id} -> ${dependency}.`);
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
  const required=[...html.matchAll(/INTERNAL_MODULES\.load\('([^']+)'/g)].map(match=>match[1]).sort();
  const expectedRequired=privateModules.filter(module=>module.id!=='internal').map(module=>module.registryId||module.id).sort();
  invariant(JSON.stringify(required)===JSON.stringify(expectedRequired),'The host must resolve every private application module exactly once and no others.');
  invariant(!/INTERNAL_MODULES\.require\(/u.test(html),'The host must validate private-module exports through the canonical loader.');
  for(const module of externalModules){
    const value=moduleSource(module);
    invariant(!value.includes("Symbol.for('studyDirector.internalModules.v1')"),`External module ${module.id} reaches into the private registry.`);
  }
  invariant(externalModules.map(module=>module.id).join('|')===trustedExternalModuleIds.join('|'),'External runtime modules differ from the fixed reviewed allowlist.');
  invariant(externalModules.every(module=>module.execution==='startup'||module.execution==='on-demand'||module.execution==='worker'),'External runtime execution mode is invalid.');
  const insightsModule=externalModules.find(module=>module.id==='insights');
  invariant(insightsModule&&JSON.stringify(moduleSourceFiles(insightsModule))===JSON.stringify(['external/insights-model.js','external/insights.js']),'Insights must remain a two-source model/view runtime.');
  const insightsModel=sourceFile('external/insights-model.js');
  invariant(!/\b(?:document|localStorage|sessionStorage|requestAnimationFrame|Worker|querySelector|createElement)\b/u.test(insightsModel),'Insights model must remain independent of DOM, browser storage, animation, and worker APIs.');
}

export function renderBuild(){
  assertCanonicalSource();
  const identity=releaseIdentity();
  const privateSources=new Map(privateModules.map(module=>[
    module.id,
    renderTokens(sourceFile(module.source),identity,module.source)
  ]));
  const oauth=releaseConfig.googleOAuth&&typeof releaseConfig.googleOAuth==='object'?releaseConfig.googleOAuth:{};
  const productionClientId=String(oauth.productionClientId||'').trim();
  const developmentClientId=String(oauth.developmentClientId||'').trim();
  invariant(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/u.test(productionClientId),'Production Google OAuth client ID is missing or malformed.');
  invariant(!developmentClientId||/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/u.test(developmentClientId),'Development Google OAuth client ID is malformed.');
  invariant(!developmentClientId||developmentClientId!==productionClientId,'Development and production must not share a Google OAuth client.');
  const externalSources=Object.freeze({
    development:new Map(externalModules.map(module=>[
      module.id,
      renderPlatformTokens(moduleSource(module),identity,moduleSourceFiles(module).join('+'),{GOOGLE_OAUTH_CLIENT_ID:module.id==='drive'?developmentClientId:productionClientId})
    ])),
    deployment:new Map(externalModules.map(module=>[
      module.id,
      renderPlatformTokens(moduleSource(module),identity,moduleSourceFiles(module).join('+'),{GOOGLE_OAUTH_CLIENT_ID:productionClientId})
    ]))
  });
  const styleSources=new Map(styleModules.map(module=>[
    module.id,renderTokens(sourceFile(module.source),identity,module.source)
  ]));
  const privateNames=new Map(privateModules.map(module=>[module.id,filename(module,privateSources.get(module.id))]));
  const styleNames=new Map(styleModules.map(module=>[module.id,styleFilename(module,styleSources.get(module.id))]));
  const externalNames=Object.freeze({
    development:new Map(externalModules.map(module=>[module.id,filename(module,externalSources.development.get(module.id))])),
    deployment:new Map(externalModules.map(module=>[module.id,filename(module,externalSources.deployment.get(module.id))]))
  });
  const templateSource=sourceFile(htmlSource);
  const template=target=>renderPlatformTokens(templateSource,identity,htmlSource,{
    EXTERNAL_GLASS_FILENAME:externalNames[target].get('glass'),
    EXTERNAL_GUIDE_FILENAME:externalNames[target].get('guide'),
    EXTERNAL_INSIGHTS_FILENAME:externalNames[target].get('insights'),
    EXTERNAL_DRIVE_FILENAME:externalNames[target].get('drive'),
    RICH_TEXT_FILENAME:externalNames[target].get('rich-text'),
    EXPORT_WORKER_FILENAME:externalNames[target].get('export-worker'),
    SEARCH_WORKER_FILENAME:externalNames[target].get('search-worker'),
    IMAGE_WORKER_FILENAME:externalNames[target].get('image-worker'),
    ATTACHMENT_WORKER_FILENAME:externalNames[target].get('attachment-worker'),
    CORE_STYLE_FILENAME:styleNames.get('core')
  });
  const developmentTags=privateModules.map(module=>`<script src="${privateNames.get(module.id)}"></script>`).join('\n');
  const deploymentTags=developmentTags;
  const manifestSource=renderTokens(sourceFile(platformFiles.manifest.source),identity,platformFiles.manifest.source);
  const serviceWorkerTemplate=sourceFile(platformFiles.serviceWorker.source);
  const staticSources=new Map(staticAssets.map(asset=>[
    asset.source,
    asset.template?Buffer.from(renderTokens(sourceFile(asset.source),identity,asset.source),'utf8'):sourceBytes(asset.source)
  ]));
  const legalReaderSources=new Map(legalReaderAssets.map(reader=>[reader.output,legalReaderHtml(reader,sourceFile(reader.source))]));
  const renderTarget=(target,html)=>{
    const files=new Map([[identity.main,html]]);
    for(const module of privateModules)files.set(privateNames.get(module.id),privateSources.get(module.id));
    for(const module of externalModules)files.set(externalNames[target].get(module.id),externalSources[target].get(module.id));
    for(const module of styleModules)files.set(styleNames.get(module.id),styleSources.get(module.id));
    files.set(platformFiles.manifest.output,manifestSource);
    for(const asset of staticAssets){
      if(asset.targets.includes(target))files.set(asset.output,staticSources.get(asset.source));
    }
    for(const reader of legalReaderAssets)files.set(reader.output,legalReaderSources.get(reader.output));
    // The page needs a non-circular identity for the assets it actually booted.
    // Hash the fully rendered inventory before replacing this HTML sentinel.
    const assetId=sha256(JSON.stringify([...files].sort(([a],[b])=>a.localeCompare(b)).map(([name,value])=>[name,sha256(value)]))).slice(0,24);
    html=html.replaceAll('__SD_PAGE_ASSET_ID__',assetId);files.set(identity.main,html);
    if(target==='deployment'){
      const inlineScripts=[...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match=>`'sha256-${sha256Base64(match[1])}'`);
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
    const precache=precacheNames.map(name=>Object.freeze({path:`./${normalizePath(name)}`,sha256:sha256(files.get(name))}));
    // A worker-only release must not reset the cache serving identical assets.
    const pwaReleaseId=sha256(JSON.stringify({precache,worker:sha256(serviceWorkerTemplate)})).slice(0,24);
    const serviceWorker=renderPlatformTokens(serviceWorkerTemplate,identity,platformFiles.serviceWorker.source,{
      PWA_RELEASE_ID:pwaReleaseId,
      PAGE_ASSET_ID:assetId,
      PWA_ASSET_MANIFEST:JSON.stringify(precache)
    });
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
  return Object.fromEntries([
    htmlSource,...privateModules.map(row=>row.source),...externalSourceFiles(),...styleModules.map(row=>row.source),
    ...Object.values(platformFiles).map(row=>row.source),...staticAssets.map(row=>row.source)
  ].sort().map(name=>[name,sha256(sourceBytes(name))]));
}
function outputHashes(files){return Object.fromEntries([...files].sort(([a],[b])=>a.localeCompare(b)).map(([name,value])=>[name,sha256(value)]));}
function validateReleaseIdentities(files,identity,label){
  const allowed=new Set([identity.release,identity.id,`sd${identity.id}`]);
  for(const [name,value] of files){
    if(typeof value!=='string')continue;
    for(const match of value.matchAll(/\b(?:SDV[A-Z]\d+[a-z]*(?:[NR]\d+)?|sdv[a-z]\d+[a-z]*(?:[nr]\d+)?|v[a-z]\d+[a-z]*(?:[nr]\d+)?)\b/g)){
      invariant(allowed.has(match[0]),`${label}/${name} contains stale release identity ${match[0]}.`);
    }
  }
}

function expectedStaticOutputs(target){return [...staticAssets.filter(asset=>asset.targets.includes(target)).map(asset=>asset.output),...legalReaderAssets.map(reader=>reader.output)];}
function verifyPwaTarget(files,pwa,label){
  invariant(pwa&&/^[a-f0-9]{24}$/.test(pwa.releaseId),`${label} PWA release identity is invalid.`);
  invariant(/^[a-f0-9]{24}$/.test(pwa.assetId),`${label} page asset identity is invalid.`);
  invariant(files.get('index.html').includes(`<meta name="study-director-assets" content="${pwa.assetId}">`),`${label} boot asset identity drifted.`);
  invariant(pwa.releaseId===sha256(JSON.stringify({precache:pwa.precache,worker:sha256(sourceFile(platformFiles.serviceWorker.source))})).slice(0,24),`${label} worker-inclusive PWA identity drifted.`);
  invariant(Array.isArray(pwa.precache)&&pwa.precache.length>0,`${label} precache inventory is empty.`);
  const paths=pwa.precache.map(asset=>asset.path);
  invariant(new Set(paths).size===paths.length,`${label} precache inventory contains duplicates.`);
  invariant(!paths.some(value=>/sw\.js|firebase\.json|\.sdbackup|assets\/licenses\//i.test(value)),`${label} precache inventory contains an excluded asset.`);
  for(const asset of pwa.precache){
    const name=asset.path.replace(/^\.\//,'');
    invariant(files.has(name),`${label} precache asset is missing: ${name}.`);
    invariant(sha256(files.get(name))===asset.sha256,`${label} precache hash drifted: ${name}.`);
  }
  const serviceWorker=files.get(platformFiles.serviceWorker.output);
  invariant(typeof serviceWorker==='string'&&serviceWorker.includes(`const RELEASE_ID='${pwa.releaseId}';`),`${label} service worker release identity drifted.`);
  invariant(serviceWorker.includes(`const PRECACHE=Object.freeze(JSON.parse('${JSON.stringify(pwa.precache)}'));`),`${label} service worker asset manifest drifted.`);
}

export function validateBuild(build){
  const {identity,development,deployment,pwa,privateSources,externalSources,styleSources,privateNames,externalNames,styleNames,staticSources,legalReaderSources}=build;
  const productionClientId=String(releaseConfig.googleOAuth&&releaseConfig.googleOAuth.productionClientId||'').trim();
  const platformShared=[platformFiles.manifest.output,platformFiles.serviceWorker.output];
  const devExpected=[identity.main,...privateModules.map(row=>privateNames.get(row.id)),...externalModules.map(row=>externalNames.development.get(row.id)),...styleModules.map(row=>styleNames.get(row.id)),...platformShared,...expectedStaticOutputs('development')].sort();
  const deployExpected=[identity.main,...privateModules.map(row=>privateNames.get(row.id)),...externalModules.map(row=>externalNames.deployment.get(row.id)),...styleModules.map(row=>styleNames.get(row.id)),...platformShared,platformFiles.hostingHeaders.output,...expectedStaticOutputs('deployment')].sort();
  invariant(JSON.stringify([...development.keys()].sort())===JSON.stringify(devExpected),'Development inventory is invalid.');
  invariant(JSON.stringify([...deployment.keys()].sort())===JSON.stringify(deployExpected),'Deployment inventory is invalid.');
  const devHtml=development.get(identity.main),deployHtml=deployment.get(identity.main);
  const srcPattern=/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi;
  const devScripts=[...devHtml.matchAll(srcPattern)].map(match=>match[1]);
  const deployScripts=[...deployHtml.matchAll(srcPattern)].map(match=>match[1]);
  const expectedDevScripts=[externalNames.development.get('glass'),...privateModules.map(row=>privateNames.get(row.id)),externalNames.development.get('rich-text'),externalNames.development.get('drive')];
  const expectedDeployScripts=[externalNames.deployment.get('glass'),...privateModules.map(row=>privateNames.get(row.id)),externalNames.deployment.get('rich-text'),externalNames.deployment.get('drive')];
  invariant(JSON.stringify(devScripts)===JSON.stringify(expectedDevScripts),'Development script order or inventory is invalid.');
  invariant(JSON.stringify(deployScripts)===JSON.stringify(expectedDeployScripts),'Deployment script order or inventory is invalid.');
  for(const target of ['development','deployment']){
    const html=target==='development'?devHtml:deployHtml;
    for(const id of ['guide','insights']){
      const name=externalNames[target].get(id);
      invariant(html.includes(`src:'${name}'`),`${target} ${id} on-demand plugin identity is invalid.`);
    }
  }
  for(const module of privateModules){
    const name=privateNames.get(module.id),expected=privateSources.get(module.id);
    invariant(development.get(name)===expected&&deployment.get(name)===expected,`Cacheable private-module bytes drifted for ${module.id}.`);
    invariant(name===filename(module,expected),`Private-module content filename drifted for ${module.id}.`);
  }
  for(const module of styleModules){
    const name=styleNames.get(module.id),expected=styleSources.get(module.id);
    invariant(development.get(name)===expected&&deployment.get(name)===expected,`Cacheable stylesheet bytes drifted for ${module.id}.`);
    invariant(name===styleFilename(module,expected),`Stylesheet content filename drifted for ${module.id}.`);
    invariant(devHtml.includes(`href="${name}"`)&&deployHtml.includes(`href="${name}"`),`Host stylesheet identity drifted for ${module.id}.`);
  }
  for(const module of externalModules){
    const developmentName=externalNames.development.get(module.id),deploymentName=externalNames.deployment.get(module.id);
    invariant(development.get(developmentName)===externalSources.development.get(module.id),`Development external bytes drifted for ${module.id}.`);
    invariant(deployment.get(deploymentName)===externalSources.deployment.get(module.id),`Deployment external bytes drifted for ${module.id}.`);
    invariant(developmentName===filename(module,development.get(developmentName)),`Development content filename drifted for ${module.id}.`);
    invariant(deploymentName===filename(module,deployment.get(deploymentName)),`Deployment content filename drifted for ${module.id}.`);
  }
  for(const asset of staticAssets){
    const expected=staticSources.get(asset.source);
    for(const [label,files] of [['development',development],['deployment',deployment]]){
      if(!asset.targets.includes(label))continue;
      const actual=files.get(asset.output);
      invariant(Buffer.isBuffer(actual)&&actual.equals(expected),`${label} static asset drifted: ${asset.output}.`);
    }
  }
  for(const reader of legalReaderAssets){
    const expected=legalReaderSources.get(reader.output);
    invariant(development.get(reader.output)===expected&&deployment.get(reader.output)===expected,`Generated legal reader drifted: ${reader.output}.`);
    const plainText=expected.match(/<pre class="legal-plain-text">([\s\S]*?)<\/pre>/)?.[1]||'';
    invariant(plainText===escapeHtml(sourceFile(reader.source)),`Generated legal reader content drifted from ${reader.source}.`);
  }
  const normalizePrivateBlock=value=>value
    .replace(privateModules.map(row=>`<script src="${privateNames.get(row.id)}"></script>`).join('\n'),privateModuleMarker);
  const normalizeHost=(value,target)=>{
    let normalized=normalizePrivateBlock(value).replaceAll(pwa[target].assetId,'__SD_PAGE_ASSET_ID__');
    for(const id of ['glass','guide','insights','drive','rich-text'])normalized=normalized.replaceAll(externalNames[target].get(id),`@@SD_EXTERNAL_${id.toUpperCase()}_FILENAME@@`);
    for(const module of styleModules)normalized=normalized.replaceAll(styleNames.get(module.id),`@@SD_${module.id.toUpperCase()}_STYLE_FILENAME@@`);
    return normalized;
  };
  invariant(normalizeHost(devHtml,'development')===normalizeHost(deployHtml,'deployment'),'Host HTML differs beyond generated module identities and the private-module packaging block.');
  validateReleaseIdentities(development,identity,'development');
  validateReleaseIdentities(deployment,identity,'deployment');
  verifyPwaTarget(development,pwa.development,'development');
  verifyPwaTarget(deployment,pwa.deployment,'deployment');
  const manifest=JSON.parse(deployment.get(platformFiles.manifest.output));
  invariant(manifest.id==='./'&&manifest.start_url==='./'&&manifest.scope==='./','Manifest identity, start URL, or scope is unstable.');
  invariant(Array.isArray(manifest.related_applications)&&manifest.related_applications.length===1&&manifest.related_applications[0].platform==='webapp'&&manifest.related_applications[0].url==='./manifest.webmanifest'&&manifest.related_applications[0].id==='./','Manifest same-PWA installation relationship drifted.');
  invariant(Array.isArray(manifest.shortcuts)&&manifest.shortcuts.map(item=>item.url).join('|')==='./?tab=plan|./?tab=execute|./?tab=review|./?tab=library|./?tab=insights|./?tab=guide','Manifest shortcuts drifted.');
  invariant(deployment.has(platformFiles.hostingHeaders.output)&&!deployment.has('firebase.json'),'Deployment header handoff is missing or can overwrite project Firebase configuration.');
  invariant(/<link[^>]+rel="manifest"[^>]+href="manifest\.webmanifest"/i.test(deployHtml),'Application manifest link is missing.');
  invariant(!/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(deployHtml),'Deployment still depends on remote fonts.');
  const driveSource=deployment.get(externalNames.deployment.get('drive'));
  invariant(/const GOOGLE_OAUTH_CLIENT_ID='\d+-[a-z0-9]+\.apps\.googleusercontent\.com';/u.test(driveSource),'Google OAuth client ID is missing or malformed.');
  const developmentDriveSource=development.get(externalNames.development.get('drive'));
  invariant(!developmentDriveSource.includes(productionClientId),'Development build must never contain the production Google OAuth client ID.');
  const hosting=JSON.parse(deployment.get(platformFiles.hostingHeaders.output));
  const securityRule=hosting.hosting.headers.find(rule=>rule.source==='/**');
  const securityHeaders=Object.fromEntries((securityRule&&securityRule.headers||[]).map(header=>[header.key,header.value]));
  invariant(securityHeaders['Content-Security-Policy']&&securityHeaders['Content-Security-Policy'].includes("frame-ancestors 'none'")&&securityHeaders['Content-Security-Policy'].includes('https://accounts.google.com')&&securityHeaders['Content-Security-Policy'].includes('https://www.googleapis.com'),'Deployment Content Security Policy is incomplete.');
  invariant(securityHeaders['X-Content-Type-Options']==='nosniff'&&securityHeaders['Referrer-Policy']==='no-referrer'&&securityHeaders['X-Frame-Options']==='DENY','Deployment security headers are incomplete.');
  return true;
}

export function buildManifest(build){
  validateBuild(build);
  return Object.freeze({
    format:'study-director-build-manifest',version:2,
    release:build.identity.release,releaseId:build.identity.id,buildId:build.identity.buildId,main:build.identity.main,
    sourceDateEpoch:releaseConfig.sourceDateEpoch,minified:false,
    privateModuleOrder:privateModules.map(row=>row.id),cacheableCoreFiles:privateModules.map(row=>build.privateNames.get(row.id)),cacheableStyleFiles:styleModules.map(row=>build.styleNames.get(row.id)),externalRuntimeFiles:externalModules.map(row=>build.externalNames.deployment.get(row.id)),externalExecution:Object.fromEntries(externalModules.map(row=>[row.id,row.execution])),
    developmentRuntimeFiles:[...privateModules.map(row=>build.privateNames.get(row.id)),...externalModules.map(row=>build.externalNames.development.get(row.id))],
    runtimeDependencies:Object.fromEntries(privateModules.map(row=>[row.id,[...runtimeDependencies[row.id]]])),
    pwa:Object.freeze({
      development:Object.freeze({releaseId:build.pwa.development.releaseId,assetId:build.pwa.development.assetId,precache:build.pwa.development.precache}),
      deployment:Object.freeze({releaseId:build.pwa.deployment.releaseId,assetId:build.pwa.deployment.assetId,precache:build.pwa.deployment.precache})
    }),
    sourceSha256:sourceHashes(),
    developmentSha256:outputHashes(build.development),
    deploymentSha256:outputHashes(build.deployment)
  });
}

function writeFile(target,value){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);}
function recursiveEntries(directory){
  const entries=[];
  function walk(current){
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

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const manifest=writeBuild();
  console.log(JSON.stringify({
    status:'PASS',release:manifest.release,
    developmentFiles:Object.keys(manifest.developmentSha256).length,
    deploymentFiles:Object.keys(manifest.deploymentSha256).length,
    pwaReleaseId:manifest.pwa.deployment.releaseId,minified:manifest.minified
  },null,2));
}
