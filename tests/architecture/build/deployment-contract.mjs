import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {captureProcess} from '../../helpers/subprocess.mjs';
import {renderBuild,validateBuild} from '../../../build/build.mjs';

const root=path.resolve(new URL('../../..',import.meta.url).pathname);
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const sourceCommit='a'.repeat(40),previousSourceCommit=process.env.SD_SOURCE_COMMIT;process.env.SD_SOURCE_COMMIT=sourceCommit;
const webOnly=renderBuild(),build=renderBuild({includeNative:true});assert.equal(validateBuild(build),true);assert.equal(build.identity.sourceCommit,sourceCommit);
assert.deepEqual(build.development,webOnly.development,'native generation must not change the web development target');
assert.deepEqual(build.deployment,webOnly.deployment,'native generation must not change the PWA deployment target');
assert.deepEqual(build.pwa,webOnly.pwa,'native generation must not change PWA identities');
const nativeIndex=build.native.get(build.identity.main);
assert.match(nativeIndex,/const RUNTIME_PLATFORM='tauri';/u);
assert.match(nativeIndex,/navigator:PlatformRuntime\.pwaUpdates\?navigator:null/u,'native must not acquire the browser updater capability');
assert.doesNotMatch(nativeIndex,/<link[^>]+rel="manifest"/iu);
assert.equal(build.native.has('sw.js'),false);
assert.equal(build.native.has('manifest.webmanifest'),false);
assert.equal(build.native.has('firebase-hosting-headers.merge.json'),false);
assert.equal(build.native.has(build.externalNames.development.get('drive')),false);
assert.ok(build.native.has(build.nativeDriveName));
assert.match(build.native.get(build.nativeDriveName),/kind:'native'/u);
assert.match(build.native.get(build.nativeDriveName),/invoke\('native_drive'/u);
assert.doesNotMatch(build.native.get(build.nativeDriveName),/accounts\.google\.com\/gsi\/client/u);
new vm.Script(build.native.get(build.nativeDriveName));
assert.ok(![...build.native.values()].some(value=>typeof value==='string'&&value.includes('const GOOGLE_OAUTH_CLIENT_ID=')),'native assets must not contain the web OAuth provider');
assert.notEqual(build.nativeAssetId,build.pwa.development.assetId);
// Execute the actual early platform composition and install capture, not a
// copy of the policy. A malformed target must never fall back to web.
const platformScript=html=>[...html.matchAll(/<script>([\s\S]*?)<\/script>/gu)].find(match=>match[1].includes('const RUNTIME_PLATFORM='))[1];
function platformWitness(script,configured=false){
  const events=[],window={addEventListener:name=>events.push(name),...(configured?{__SD_NATIVE_DRIVE_AVAILABLE__:true,__TAURI_INTERNALS__:{invoke(){}}}:{})};
  const capabilities=vm.runInNewContext(script+'\nPlatformRuntime;', {window});
  return {capabilities,events,installCapture:!!window[Symbol.for('studyDirector.installCapture.v1')]};
}
for(const [html,kind,web] of [[nativeIndex,'tauri',false],[build.development.get(build.identity.main),'web',true],[build.deployment.get(build.identity.main),'web',true]]){
  const {capabilities,events,installCapture}=platformWitness(platformScript(html));
  assert.equal(capabilities.kind,kind);
  assert.equal(Object.isFrozen(capabilities),true);
  for(const key of ['pwaUpdates','webDrive','drive','browserDeviceFolder','browserNotifications','browserPdfWindow'])assert.equal(capabilities[key],web,key);
  assert.deepEqual(events,web?['beforeinstallprompt','appinstalled']:[]);
  assert.equal(installCapture,web);
}
const configured=platformWitness(platformScript(nativeIndex),true).capabilities;
assert.equal(configured.drive,true);assert.equal(configured.webDrive,false);assert.equal(configured.pwaUpdates,false);
assert.throws(()=>platformWitness(platformScript(nativeIndex).replace("RUNTIME_PLATFORM='tauri'","RUNTIME_PLATFORM='invalid'")),/Unknown Study Director runtime platform/);
assert.match(nativeIndex,/if\(!Object\.isFrozen\(PlatformRuntime\)\)throw new Error\('Study Director runtime platform is unavailable\.'\);\s*const INTERNAL_MODULES=/u);
const pickerExpression=nativeIndex.match(/showDirectoryPicker:(PlatformRuntime\.browserDeviceFolder[^\n]+),/u)[1];
let pickerReads=0;
const pickerWindow={get showDirectoryPicker(){pickerReads++;return ()=> 'folder';}};
const picker=(platform)=>vm.runInNewContext(pickerExpression,{PlatformRuntime:platform,window:pickerWindow});
assert.equal(picker(platformWitness(platformScript(nativeIndex)).capabilities),null);
assert.equal(pickerReads,0,'native must not touch the browser folder API');
assert.equal(picker(platformWitness(platformScript(build.development.get(build.identity.main))).capabilities)({}),'folder');
assert.equal(pickerReads,2,'web folder picker remains admitted');
assert.match(nativeIndex,/function supported\(\)\{return PlatformRuntime\.browserNotifications&&'Notification' in window/);
const platform=platformWitness(platformScript(nativeIndex)).capabilities;
const firstStartConnect=nativeIndex.slice(nativeIndex.indexOf("  async function connect(){\n    if(!PlatformRuntime.drive)"),nativeIndex.indexOf("  async function finish(){",nativeIndex.indexOf("  async function connect(){\n    if(!PlatformRuntime.drive)")));
assert.ok(firstStartConnect.includes('applyPassword()'),'witness must cover the actual first-start action');
let calls=0;
const result=await vm.runInNewContext(firstStartConnect+'\nconnect();',{PlatformRuntime:platform,connectDriveForProfile:()=>{calls++;return false;}});
assert.equal(result,false);assert.equal(calls,1,'native unavailable action must return before changing name or password');
const restoreChoices=nativeIndex.match(/function backupRestoreChoices\(\)\{[^\n]+\}/u)[0];
assert.equal(vm.runInNewContext(restoreChoices+'\nbackupRestoreChoices();',{PlatformRuntime:platform}),'a backup file');
const webPlatform=platformWitness(platformScript(build.development.get(build.identity.main))).capabilities;
assert.equal(vm.runInNewContext(restoreChoices+'\nbackupRestoreChoices();',{PlatformRuntime:webPlatform,DeviceBackup:{status:()=>({supported:true})}}),'your Device Folder, Google Drive or a backup file');
assert.equal(vm.runInNewContext(restoreChoices+'\nbackupRestoreChoices();',{PlatformRuntime:webPlatform,DeviceBackup:{status:()=>({supported:false})}}),'Google Drive or a backup file');
const nativePdf=nativeIndex.match(/function prefersNativePdfNavigation\(\)\{[^\n]+\}/u)[0];
const pdfPreference=(platform,window)=>vm.runInNewContext(nativePdf+'\nprefersNativePdfNavigation();',{PlatformRuntime:platform,window});
assert.equal(pdfPreference(platform,{matchMedia(){throw new Error('Native popup path accessed');}}),false);
assert.equal(pdfPreference(webPlatform,{matchMedia:()=>({matches:true})}),true);
const driveRender=nativeIndex.slice(nativeIndex.indexOf('function renderDriveBackup(){'),nativeIndex.indexOf('// One Back up now'));
const driveStatus={textContent:'Not connected'},driveButton={hidden:false,disabled:false};
vm.runInNewContext(driveRender+'\nrenderDriveBackup();',{PlatformRuntime:platform,BackupProviderRuntime:{locationStatus:()=>null},document:{getElementById:id=>id==='backup-provider-row-status-google-drive'?driveStatus:driveButton}});
assert.equal(driveStatus.textContent,'Unavailable');assert.equal(driveButton.hidden,true);assert.equal(driveButton.disabled,true);
const checkUpdate=nativeIndex.slice(nativeIndex.indexOf('async function checkUnsupportedUpdate(){'),nativeIndex.indexOf('function renderKeptVersions(){'));
let updateNotice;
assert.equal(await vm.runInNewContext(checkUpdate+'\ncheckUnsupportedUpdate();',{PlatformRuntime:platform,Interactions:{notify:value=>{updateNotice=value;}}}),false);
assert.equal(updateNotice.key,'native-update-unavailable');
// Parse every staged native inline script; the web generated-syntax suite
// does not exercise the native target.
for(const match of nativeIndex.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/giu))new vm.Script(match[1]);

const tauri=JSON.parse(read('src-tauri/tauri.conf.json'));
assert.equal(tauri.identifier,'app.studydirector.taurispike');
assert.equal(tauri.build.frontendDist,'../dist/tauri');
assert.equal(tauri.build.beforeBuildCommand,'node build/stage-tauri.mjs');
assert.equal(Object.hasOwn(tauri.build,'devUrl'),false,'packaged-origin acceptance cannot depend on a dev server');
assert.equal(tauri.app.withGlobalTauri,false);
assert.deepEqual(tauri.app.security.capabilities.map(row=>({windows:row.windows,permissions:row.permissions})),[{windows:['main'],permissions:['allow-native-drive']}]);
assert.equal(tauri.app.security.assetProtocol.enable,false);
assert.match(tauri.app.security.csp,/connect-src 'self' ipc: http:\/\/ipc\.localhost https:\/\/ipc\.localhost;/u);
assert.match(tauri.app.security.csp,/require-trusted-types-for 'script'/u);
assert.doesNotMatch(tauri.app.security.csp,/accounts\.google\.com|googleapis\.com|'unsafe-eval'/u);
assert.equal(tauri.app.windows.length,1);
assert.equal(tauri.app.windows[0].create,false,'the Rust navigation policy must be installed before creating the window');
assert.equal(tauri.app.windows[0].useHttpsScheme,true);
assert.equal(tauri.app.windows[0].incognito,false);
assert.equal(tauri.app.windows[0].dragDropEnabled,false);
assert.equal(tauri.bundle.active,false,'no installer or publication in the initial shell');
const shell=read('src-tauri/src/main.rs');
assert.match(shell,/\.on_navigation\(packaged_origin\)/u);
assert.match(shell,/\.on_new_window\(\|_, _\| NewWindowResponse::Deny\)/u);
assert.match(shell,/invoke_handler\(tauri::generate_handler!\[drive_ipc::native_drive\]\)/u);
assert.doesNotMatch(shell,/\.plugin\(/u);
const ipc=read('src-tauri/src/drive_ipc.rs');
assert.match(ipc,/window\.label\(\)\s*!=\s*"main"\s*\|\|\s*!super::packaged_origin/u);
assert.match(read('src-tauri/build.rs'),/AppManifest::new\(\)\.commands\(&\["native_drive"\]\)/u);
const manifest=JSON.parse(read('source/platform/manifest.webmanifest'));
const merge=JSON.parse(read('source/platform/firebase-hosting-headers.merge.json'));

assert.ok(build.deployment.has('firebase-hosting-headers.merge.json'));
const deploymentIndex=build.deployment.get(build.identity.main),richTextName=build.externalNames.deployment.get('rich-text');
assert.ok(deploymentIndex.includes(`<link rel="preload" as="script" href="${richTextName}">`),'deployment must preload the blocking RichText runtime');
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
  const staged=captureProcess(process.execPath,['build/stage-firebase.mjs'],{cwd:isolatedRoot,encoding:'utf8',env:{...process.env,SD_SOURCE_COMMIT:sourceCommit}});
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
  assert.ok(fs.readFileSync(path.join(publicDir,'index.html'),'utf8').includes(`<meta name="study-director-source-commit" content="${sourceCommit}">`),'staged app must carry exact source commit provenance');
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
  const webBefore=listFiles(publicDir).sort().map(name=>[name,fs.readFileSync(path.join(publicDir,name))]);
  const nativeStage=path.join(isolatedRoot,'dist','tauri');
  fs.mkdirSync(nativeStage,{recursive:true});fs.writeFileSync(path.join(nativeStage,'stale.js'),'stale');
  const nativeResult=captureProcess(process.execPath,['build/stage-tauri.mjs'],{cwd:isolatedRoot,encoding:'utf8',env:{...process.env,SD_SOURCE_COMMIT:sourceCommit}});
  assert.equal(nativeResult.status,0,nativeResult.stderr||nativeResult.stdout);
  assert.deepEqual(listFiles(nativeStage).sort(),[...build.native.keys()].sort(),'native staging must replace stale assets and contain only the native inventory');
  for(const [name,bytes] of build.native)assert.deepEqual(fs.readFileSync(path.join(nativeStage,name)),Buffer.from(bytes),`native staged bytes differ: ${name}`);
  assert.deepEqual(listFiles(publicDir).sort().map(name=>[name,fs.readFileSync(path.join(publicDir,name))]),webBefore,'native staging must not alter Firebase staging');
  const ico=fs.readFileSync(path.join(isolatedRoot,'dist','tauri-resources','icon.ico'));
  const png=fs.readFileSync(path.join(isolatedRoot,'source','assets','icons','favicon-32.png'));
  assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),1);
  assert.equal(ico[6],32);assert.equal(ico[7],32);
  assert.equal(ico.readUInt32LE(14),png.length);assert.equal(ico.readUInt32LE(18),22);
  assert.deepEqual(ico.subarray(22),png,'native icon must derive exactly from the existing application asset');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
  if(previousSourceCommit===undefined)delete process.env.SD_SOURCE_COMMIT;else process.env.SD_SOURCE_COMMIT=previousSourceCommit;
}

console.log(JSON.stringify({
  status:'PASS',selfContainedFirebaseProject:true,cacheHeaderMerge:true,samePwaManifestRelation:true,trustedTypesCandidate:true
},null,2));
