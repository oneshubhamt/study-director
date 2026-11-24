import {artifactPath,writeArtifact} from '../../helpers/artifacts.mjs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor,instrumentedHtml,instrumentedMinifiedHtml,pasteInPage} from '../../helpers/browser-harness.mjs';
import {deploymentDirectoryName} from '../../../release.config.mjs';
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'qa-runtime-security-'});
const policy="worker-src 'self'; require-trusted-types-for 'script'; trusted-types sd-inert-html sd-assets sd-legal-html sd-insights-worker sd-google-signin";
let html=instrumentedHtml();
if(process.env.SD_MINIFIED_TEST==='1'){
 html=instrumentedMinifiedHtml(server,path.resolve('dist',deploymentDirectoryName,'public'),html);
}

server.setOverride('deployment','runtime-security.html',html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+policy+'">').replace('Object.freeze({StartupLifecycle,','Object.freeze({BackupProtectionStorage,ExportsAppMeta,trustedAssetURL,trustedTypeViolations,StartupLifecycle,'));
const preload=`(()=>{const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Security QA',updatedAt:d.toISOString()}));(localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));})();`;
let page;
try{
 page=await browser.createPage(server.url('deployment','runtime-security.html'),{preload,bypassServiceWorker:true});await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate('__PWA6.AppOwnership.status().hasControl'));
 const imageWorkerName=html.match(/sd\.image-worker\.[a-f0-9]+\.js/)[0];
 assert.equal(await page.evaluate(`new Promise((resolve,reject)=>{const w=new Worker(__PWA6.trustedAssetURL(${JSON.stringify(imageWorkerName)}));w.onmessage=({data})=>{w.terminate();resolve(data.result?.width)};w.onerror=()=>{w.terminate();reject(Error('Image worker failed under Trusted Types'))};w.postMessage({file:new Blob([Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),c=>c.charCodeAt(0))],{type:'image/gif'}),mimeType:'image/gif'})})`),1);

 const searchWorkerName=html.match(/sd\.note-search\.[a-f0-9]+\.js/)[0];
 assert.deepEqual(await page.evaluate(`new Promise((resolve,reject)=>{const w=new Worker(__PWA6.trustedAssetURL(${JSON.stringify(searchWorkerName)}));w.onmessage=({data})=>{w.terminate();resolve(data.keys)};w.onerror=()=>{w.terminate();reject(Error('Search worker failed under Trusted Types'))};w.postMessage({type:'sync',documents:[{key:'qa',plain:'search boundary'}]});w.postMessage({type:'query',id:1,query:'boundary'})})`),['qa']);
 const policyWrites=await page.evaluate(`(async()=>{
   const storage=__PWA6.BackupProtectionStorage,record={version:3,id:'qa-policy',verifier:new Blob(['proof']),key:null,setAt:new Date().toISOString()};
   const writes=await Promise.allSettled([storage.write('backupProtection',record,{expectedId:'',check(){}}),storage.write('backupProtection',{...record,id:'stale-policy'},{expectedId:'',check(){}})]);
   const current=await __PWA6.ExportsAppMeta.read('backupProtection');
   const refused=await storage.remove('backupProtection',{expectedId:current.id,check(){throw Error('ownership lost')}}).then(()=>false,()=>true);
   const retained=(await __PWA6.ExportsAppMeta.read('backupProtection')).id===current.id;
   await storage.remove('backupProtection',{expectedId:current.id,check(){}});
   return {commits:writes.filter(x=>x.status==='fulfilled').length,refused,retained};
 })()`);
 assert.deepEqual(policyWrites,{commits:1,refused:true,retained:true});

 const openDisplayTools=async()=>{
   await waitFor(()=>page.evaluate(`!document.documentElement.hasAttribute('data-sd-appearance-reveal')`),{label:'appearance transition finished before physical click'});
   if(await page.evaluate(`document.getElementById('display-tools-menu').hidden`))await page.click('#display-tools-trigger');
   await waitFor(()=>page.evaluate(`!document.getElementById('display-tools-menu').hidden`),{label:'visible Display Tools'});
 };
 const chooseAppearance=async(presentation,theme,{expectFocus=true}={})=>{
   await openDisplayTools();
   await page.click(`.theme-btn[data-theme-id="${theme}"]`);
   await waitFor(()=>page.evaluate(`document.documentElement.dataset.theme===${JSON.stringify(theme)}`),{label:`theme ${theme}`});
   await openDisplayTools();
   await page.click(`.presentation-btn[data-presentation-id="${presentation}"]`);
   await waitFor(()=>page.evaluate(`document.documentElement.dataset.presentation===${JSON.stringify(presentation)}`),{label:`presentation ${presentation}`});
   const state=await page.evaluate(`(()=>({theme:document.documentElement.dataset.theme,presentation:document.documentElement.dataset.presentation,themePressed:document.querySelector('.theme-btn[data-theme-id="${theme}"]')?.getAttribute('aria-pressed'),presentationPressed:document.querySelector('.presentation-btn[data-presentation-id="${presentation}"]')?.getAttribute('aria-pressed'),focus:document.activeElement?.dataset?.presentationId||'',themeColor:document.querySelector('meta[name="theme-color"]')?.getAttribute('content')||'',computedThemeColor:getComputedStyle(document.documentElement).getPropertyValue('--sd-meta-theme-color').trim()}))()`);
   assert.deepEqual({theme:state.theme,presentation:state.presentation,themePressed:state.themePressed,presentationPressed:state.presentationPressed},{theme,presentation,themePressed:'true',presentationPressed:'true'});
   if(expectFocus)assert.equal(state.focus,presentation,`${presentation}/${theme} user-driven selection must restore focus to the selected skin control`);
   assert.equal(state.themeColor,state.computedThemeColor,`${presentation}/${theme} metadata must follow the active presentation token`);
 };

 const overlappingReveal=await page.evaluate(`(async()=>{
   const own=Object.getOwnPropertyDescriptor(document,'startViewTransition'),hadOwn=Object.prototype.hasOwnProperty.call(document,'startViewTransition'),finishes=[];
   Object.defineProperty(document,'startViewTransition',{configurable:true,value:change=>{change();let resolve;const finished=new Promise(done=>{resolve=done;});finishes.push(resolve);return {ready:Promise.resolve(),finished};}});
   const snapshot=()=>({reveal:document.documentElement.hasAttribute('data-sd-appearance-reveal'),x:document.documentElement.style.getPropertyValue('--sd-reveal-x'),y:document.documentElement.style.getPropertyValue('--sd-reveal-y'),radius:document.documentElement.style.getPropertyValue('--sd-reveal-radius')});
   try{
     window.StudyDirector.appearance.theme.set('light');
     window.StudyDirector.appearance.presentation.set('aurora');
     const before=snapshot();
     finishes[0]();await Promise.resolve();await Promise.resolve();
     const afterOlder=snapshot();
     finishes[1]();await Promise.resolve();await Promise.resolve();
     const afterNewest=snapshot();
     return {before,afterOlder,afterNewest,theme:document.documentElement.dataset.theme,presentation:document.documentElement.dataset.presentation};
   }finally{
     if(hadOwn&&own)Object.defineProperty(document,'startViewTransition',own);else delete document.startViewTransition;
   }
 })()`);
 assert.equal(overlappingReveal.before.reveal,true,'newest appearance transition must own reveal state while both transitions are pending');
 assert.ok(overlappingReveal.before.x&&overlappingReveal.before.y&&overlappingReveal.before.radius,'newest appearance transition must publish its reveal geometry');
 assert.deepEqual(overlappingReveal.afterOlder,overlappingReveal.before,'settling an older appearance transition must not clear the newer reveal state');
 assert.deepEqual(overlappingReveal.afterNewest,{reveal:false,x:'',y:'',radius:''},'settling the newest appearance transition must clear its reveal state exactly once');
 assert.deepEqual({theme:overlappingReveal.theme,presentation:overlappingReveal.presentation},{theme:'light',presentation:'aurora'});

 for(const presentation of ['director-current','glass','aurora'])for(const theme of ['dark','light'])await chooseAppearance(presentation,theme);

 await chooseAppearance('director-current','light');
 await openDisplayTools();await page.click('[data-action="font-larger"]');
 await waitFor(()=>page.evaluate(`document.documentElement.dataset.fontScale==='1.08'`),{label:'font scale persisted selection'});
 await waitFor(()=>page.evaluate(`__PWA6.AppData.personalPreferences.read().then(value=>value?.presentation==='director-current'&&value?.theme==='light'&&value?.fontScale===1.08)`),{label:'canonical appearance preferences'});
 assert.deepEqual(await page.evaluate(`({theme:localStorage.getItem('studyDirector.theme.v1'),presentation:localStorage.getItem('studyDirector.presentation.v1'),fontScale:localStorage.getItem('studyDirector.fontScale.v1')})`),{theme:'light',presentation:'director-current',fontScale:'1.08'});

 await page.reload();await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'appearance ownership after reload'});
 const reloadedAppearance=await page.evaluate(`(()=>({theme:document.documentElement.dataset.theme,presentation:document.documentElement.dataset.presentation,fontScale:document.documentElement.dataset.fontScale,themePressed:document.querySelector('.theme-btn[data-theme-id="light"]')?.getAttribute('aria-pressed'),presentationPressed:document.querySelector('.presentation-btn[data-presentation-id="director-current"]')?.getAttribute('aria-pressed'),themeColor:document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),computedThemeColor:getComputedStyle(document.documentElement).getPropertyValue('--sd-meta-theme-color').trim()}))()`);
 assert.deepEqual({theme:reloadedAppearance.theme,presentation:reloadedAppearance.presentation,fontScale:reloadedAppearance.fontScale,themePressed:reloadedAppearance.themePressed,presentationPressed:reloadedAppearance.presentationPressed},{theme:'light',presentation:'director-current',fontScale:'1.08',themePressed:'true',presentationPressed:'true'},'a physically selected saved appearance must survive a real built-page reload');
 assert.equal(reloadedAppearance.themeColor,reloadedAppearance.computedThemeColor,'reloaded browser chrome follows the saved appearance');

 const originalProfile=await page.evaluate(`__PWA6.Profiles.current()`);
 await page.evaluate(`setTimeout(()=>__PWA6.Profiles.add(),0)`);
 await new Promise(resolve=>setTimeout(resolve,1700));await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'new profile ownership'});
 const addedProfile=await page.evaluate(`__PWA6.Profiles.current()`);
 assert.notEqual(addedProfile.id,originalProfile.id,'a distinct profile must open');
 const freshAppearance=await page.evaluate(`(()=>({theme:document.documentElement.dataset.theme,presentation:document.documentElement.dataset.presentation,fontScale:document.documentElement.dataset.fontScale,themeColor:document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),computedThemeColor:getComputedStyle(document.documentElement).getPropertyValue('--sd-meta-theme-color').trim()}))()`);
 assert.deepEqual({theme:freshAppearance.theme,presentation:freshAppearance.presentation,fontScale:freshAppearance.fontScale},{theme:'dark',presentation:'glass',fontScale:'1'},'fresh profile must start from implicit Glass/Dark without inheriting appearance');
 assert.equal(freshAppearance.themeColor,freshAppearance.computedThemeColor,'fresh profile browser chrome follows Glass/Dark');
 assert.equal(await page.evaluate(`document.getElementById('first-start-dialog')?.open===true`),true,'new profile setup is presented before appearance changes');
 await page.click('#first-start-continue');
 await waitFor(()=>page.evaluate(`document.getElementById('first-start-dialog')?.open!==true`),{label:'new profile setup completed'});
 assert.equal(await page.evaluate(`__PWA6.Profiles.current().id`),addedProfile.id,'completing first-start must keep the newly added profile active');
 await chooseAppearance('aurora','light',{expectFocus:false});
 await waitFor(()=>page.evaluate(`__PWA6.AppData.personalPreferences.read().then(value=>value?.presentation==='aurora'&&value?.theme==='light')`),{label:'second profile canonical appearance'});
 const scopedMirrors=await page.evaluate(`(()=>{const scope=__PWA6.Profiles.current().scope,suffix=scope?'~'+scope:'';return {theme:localStorage.getItem('studyDirector.theme.v1'+suffix),presentation:localStorage.getItem('studyDirector.presentation.v1'+suffix)};})()`);
 assert.deepEqual(scopedMirrors,{theme:'light',presentation:'aurora'});

 await page.evaluate(`setTimeout(()=>__PWA6.Profiles.switchTo(${JSON.stringify(originalProfile.id)}),0)`);
 await new Promise(resolve=>setTimeout(resolve,1700));await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'original profile ownership'});
 const restoredAppearance=await page.evaluate(`(()=>({theme:document.documentElement.dataset.theme,presentation:document.documentElement.dataset.presentation,fontScale:document.documentElement.dataset.fontScale,themePressed:document.querySelector('.theme-btn[data-theme-id="light"]')?.getAttribute('aria-pressed'),presentationPressed:document.querySelector('.presentation-btn[data-presentation-id="director-current"]')?.getAttribute('aria-pressed'),themeColor:document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),computedThemeColor:getComputedStyle(document.documentElement).getPropertyValue('--sd-meta-theme-color').trim()}))()`);
 assert.deepEqual({theme:restoredAppearance.theme,presentation:restoredAppearance.presentation,fontScale:restoredAppearance.fontScale,themePressed:restoredAppearance.themePressed,presentationPressed:restoredAppearance.presentationPressed},{theme:'light',presentation:'director-current',fontScale:'1.08',themePressed:'true',presentationPressed:'true'},'switching profiles must restore canonical appearance, first-paint mirrors and controls');
 assert.equal(restoredAppearance.themeColor,restoredAppearance.computedThemeColor,'restored profile browser chrome follows Director/Light');
 await page.evaluate(`window.dispatchEvent(new CustomEvent('studydirector:ready'));window.dispatchEvent(new CustomEvent('studydirector:ready'))`);
 assert.deepEqual(await page.evaluate(`({glassStyles:document.querySelectorAll('#sd-glass-presentation-v1').length,auroraStyles:document.querySelectorAll('#sd-aurora-presentation-v1').length,glassObserver:document.documentElement.dataset.glassOverlayCoordinator,auroraObserver:document.documentElement.dataset.auroraOverlayCoordinator})`),{glassStyles:1,auroraStyles:1,glassObserver:'installed',auroraObserver:'installed'},'pack retries must retain one stylesheet and one effective coordinator marker');


 await page.evaluate(`(()=>{const d=__PWA6,now=new Date(),m=now.getHours()*60+now.getMinutes(),fmt=v=>String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0');document.getElementById('plan-input').value=fmt(m)+' | 30 | Ethics study | work | Ethics | pages | 10';d.applySchedule({skipNotify:true});d.goTab('execute');d.TimerEngine.startCur(30);})()`);
 assert.equal(await page.evaluate('document.querySelector(".pane.on").id'),'pane-execute');
 assert.equal(await page.evaluate('__PWA6.TimerState.paused'),false);
 await page.click('#cd-card');assert.equal(await page.evaluate('__PWA6.TimerState.paused'),true);
 await page.click('#cd-card');assert.equal(await page.evaluate('__PWA6.TimerState.paused'),false);

 await chooseAppearance('aurora','light');
 assert.equal(await page.evaluate(`__PWA6.Pomodoro.timerEvent('tick',{activeSec:3600})`),true,'real Pomodoro path must open the blocking overlay');
 await waitFor(()=>page.evaluate(`document.getElementById('nudge-overlay').classList.contains('on')`),{label:'Pomodoro overlay'});
 await page.evaluate(`__PWA6.NoticeCoordinator.publish('qa-pwa-update',{visible:true,kind:'update',title:'Update ready',message:'Presentation overlay priority check.'});document.getElementById('display-tools-trigger').click()`);
 await waitFor(()=>page.evaluate(`document.documentElement.dataset.auroraOverlayActive==='update'&&!document.getElementById('display-tools-menu').hidden&&document.getElementById('nudge-overlay').classList.contains('sd-aurora-surface-suppressed')`),{label:'Aurora overlay priority'});
 await openDisplayTools();await page.click('.presentation-btn[data-presentation-id="glass"]');
 await waitFor(()=>page.evaluate(`document.documentElement.dataset.presentation==='glass'&&document.documentElement.dataset.glassOverlayActive==='update'`),{label:'Glass overlay handoff'});
 assert.deepEqual(await page.evaluate(`({auroraActive:document.documentElement.dataset.auroraOverlayActive||'',auroraSuppressed:document.getElementById('nudge-overlay').classList.contains('sd-aurora-surface-suppressed'),glassSuppressed:document.getElementById('nudge-overlay').classList.contains('sd-glass-surface-suppressed'),menuHidden:document.getElementById('display-tools-menu').hidden})`),{auroraActive:'',auroraSuppressed:false,glassSuppressed:true,menuHidden:false});
 await openDisplayTools();await page.click('.presentation-btn[data-presentation-id="director-current"]');
 await waitFor(()=>page.evaluate(`document.documentElement.dataset.presentation==='director-current'`),{label:'Director overlay cleanup'});
 assert.deepEqual(await page.evaluate(`({glassActive:document.documentElement.dataset.glassOverlayActive||'',auroraActive:document.documentElement.dataset.auroraOverlayActive||'',glassSuppressed:document.getElementById('nudge-overlay').classList.contains('sd-glass-surface-suppressed'),auroraSuppressed:document.getElementById('nudge-overlay').classList.contains('sd-aurora-surface-suppressed'),menuHidden:document.getElementById('display-tools-menu').hidden})`),{glassActive:'',auroraActive:'',glassSuppressed:false,auroraSuppressed:false,menuHidden:false});
 await openDisplayTools();await page.click('.presentation-btn[data-presentation-id="aurora"]');
 await waitFor(()=>page.evaluate(`document.documentElement.dataset.auroraOverlayActive==='update'`),{label:'Aurora overlay reacquire'});
 await page.evaluate(`__PWA6.NoticeCoordinator.publish('qa-pwa-update',null)`);
 await waitFor(()=>page.evaluate(`document.documentElement.dataset.auroraOverlayActive==='nudge'&&document.getElementById('display-tools-menu').hidden&&document.getElementById('display-tools-trigger').getAttribute('aria-expanded')==='false'`),{label:'blocking overlay closes display tools'});
 assert.equal(await page.evaluate(`document.getElementById('nudge-overlay').classList.contains('sd-aurora-surface-suppressed')`),false);
 assert.equal(await page.evaluate(`(()=>{const menu=document.getElementById('display-tools-menu');return typeof menu.showPopover==='function'?menu.matches(':popover-open'):false;})()`),false,'blocking overlay closure must also leave the native popover top-layer state closed');
 await page.evaluate(`__PWA6.Pomodoro.timerEvent('clear-cue')`);
 await waitFor(()=>page.evaluate(`!document.documentElement.dataset.auroraOverlayActive`),{label:'blocking overlay released'});
 await openDisplayTools();
 assert.equal(await page.evaluate(`document.getElementById('display-tools-trigger').getAttribute('aria-expanded')`),'true','Display Tools controller must remain reusable after a pack-forced close');
 await page.click('#display-tools-trigger');

 // Repeat HTML paste to catch duplicate policy creation under enforcement.
 await page.evaluate(`(async()=>{const field=document.createElement('textarea');field.id='security-note';document.body.appendChild(field);window.testEditor=await StudyDirectorRichText.mountRichTextEditor({field,label:'Security paste',initialValue:'',maxWords:10000,maxBytes:917504,assets:{get:async()=>null,put:async()=>{},remove:async()=>{}}});for(let i=0;i<2;i++){const editor=document.querySelector('#security-note + .sd-rte .sd-rte-editor');editor.focus();const data=new DataTransfer();data.setData('text/html','<p><strong>Safe text</strong><img src=x onerror="window.badPaste=true"><a href="javascript:alert(1)">bad link</a></p>');data.setData('text/plain','Safe text');${pasteInPage}(editor,data);await new Promise(r=>setTimeout(r,50));}})()`);
 assert.equal(await page.evaluate('window.badPaste===true'),false);
 assert.match(await page.evaluate('document.querySelector("#security-note + .sd-rte").textContent'),/Safe text/);
 assert.equal(await page.evaluate('document.querySelector("#security-note + .sd-rte a[href^=javascript]")===null'),true);
 await page.evaluate('testEditor.destroy();document.getElementById("security-note").remove()');

 // P5.13a: hold the first optional Guide script request, leave the tab while
 // it is pending, fail it late, then return and retry through ordinary tab UI.
 await page.evaluate(`(()=>{
   const head=document.head,append=head.appendChild.bind(head);
   window.__p513Optional={append,held:null,intercepted:false};
   head.appendChild=function(node){
     if(node instanceof HTMLScriptElement&&node.dataset.studyDirectorPluginTab==='guide'&&!window.__p513Optional.intercepted){
       window.__p513Optional.intercepted=true;window.__p513Optional.held=node;return node;
     }
     return append(node);
   };
 })()`);
 await page.click('[data-tab="guide"]');
 await waitFor(()=>page.evaluate(`!!window.__p513Optional?.held&&document.querySelector('.pane.on')?.id==='pane-guide'&&StudyDirector.plugins.status().optionalFiles.find(row=>row.tabId==='guide')?.state==='loading'`),{label:'held optional Guide load'});
 await page.click('[data-tab="plan"]');
 await waitFor(()=>page.evaluate(`document.querySelector('.pane.on')?.id==='pane-plan'`),{label:'switch away during optional load'});
 await page.evaluate(`(()=>{const qa=window.__p513Optional,held=qa.held;document.head.appendChild=qa.append;held.onerror?.call(held,new Event('error'));})()`);
 await waitFor(()=>page.evaluate(`StudyDirector.plugins.status().optionalFiles.find(row=>row.tabId==='guide')?.state==='missing'`),{label:'late optional load failure'});
 assert.equal(await page.evaluate(`document.querySelector('.pane.on')?.id`),'pane-plan','late optional failure must not steal active-tab ownership');
 await page.click('[data-tab="guide"]');
 await waitFor(()=>page.evaluate(`document.querySelector('#pane-guide .ui-panel .mini-btn')?.textContent==='Retry loading'`),{label:'optional retry control'});
 await page.click('#pane-guide .ui-panel .mini-btn');
 await waitFor(()=>page.evaluate(`!!document.querySelector("#pane-guide .guide-life-node[data-guide-step=plan]")&&StudyDirector.plugins.status().optionalFiles.find(row=>row.tabId==='guide')?.state==='registered'`),{label:'Guide retry registration'});
 const pluginContract=await page.evaluate(`(()=>{
   let malformedSetup=0,incompatibleSetup=0,setup=0,contextPreserved=false;
   const malformed={name:'qa-p513-malformed',version:'1',requires:{pluginApi:'1'},setup(){malformedSetup++;return true;}};
   const bad={name:'qa-p513-incompatible',version:'1',requires:{missingCapability:1},setup(){incompatibleSetup++;return true;}};
   const good={name:'qa-p513-single',version:'1',requires:{pluginApi:1,tabRegistry:1},setup(api){setup++;return api.ui.registerTab({id:'qa-p513-tab',label:'QA P5.13',icon:'Q',render(){}});}};
   const contextPlugin={name:'qa-p513-context',version:'1',setup(){contextPreserved=this===contextPlugin;return true;}};
   const malformedResult=StudyDirector.registerPlugin(malformed),contextResult=StudyDirector.registerPlugin(contextPlugin);
   const badFirst=StudyDirector.registerPlugin(bad),badSecond=StudyDirector.registerPlugin(bad);
   const goodFirst=StudyDirector.registerPlugin(good),goodSecond=StudyDirector.registerPlugin(good);
   const state=StudyDirector.plugins.status();
   return {malformedResult,malformedSetup,contextResult,contextPreserved,badFirst,badSecond,incompatibleSetup,goodFirst,goodSecond,setup,navs:document.querySelectorAll('[data-tab="qa-p513-tab"]').length,malformedState:state.registered.find(row=>row.name==='qa-p513-malformed')?.state||'',badState:state.registered.find(row=>row.name==='qa-p513-incompatible')?.state||'',goodState:state.registered.find(row=>row.name==='qa-p513-single')?.state||'',apiFrozen:Object.isFrozen(StudyDirector)&&Object.isFrozen(StudyDirector.backup)&&Object.isFrozen(StudyDirector.appearance)&&Object.isFrozen(StudyDirector.appearance.theme)&&Object.isFrozen(StudyDirector.appearance.theme.supported)&&Object.isFrozen(StudyDirector.ui),statusFrozen:Object.isFrozen(state)&&Object.isFrozen(state.optionalFiles)&&Object.isFrozen(state.registered)&&state.registered.every(Object.isFrozen)};
 })()`);
 assert.deepEqual(pluginContract,{malformedResult:false,malformedSetup:0,contextResult:true,contextPreserved:true,badFirst:false,badSecond:false,incompatibleSetup:0,goodFirst:true,goodSecond:true,setup:1,navs:1,malformedState:'',badState:'incompatible',goodState:'registered',apiFrozen:true,statusFrozen:true});
 await page.evaluate('delete window.__p513Optional');

 await page.evaluate(`__PWA6.goTab('guide')`);await waitFor(()=>page.evaluate('!!document.getElementById("pane-guide")'));
 await waitFor(()=>page.evaluate('!!document.querySelector("#pane-guide .guide-life-node[data-guide-step=plan]")'));
 await page.evaluate('document.querySelector("#pane-guide .guide-life-node[data-guide-step=plan]").focus()');
 await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});
 await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});
 assert.deepEqual(await page.evaluate(`(()=>({focus:document.activeElement?.dataset?.guideStep||'',selected:document.querySelector('#pane-guide .guide-life-node[aria-selected=true]')?.dataset?.guideStep||'',panel:document.querySelector('#guide-stage-panel')?.getAttribute('aria-labelledby')||''}))()`),{focus:'execute',selected:'execute',panel:'guide-step-execute'});

 const acceptedDraft='06:15 | 30 | Existing draft before Guide | work | Existing | block | 1';
 await page.evaluate(`(()=>{document.getElementById('plan-input').value=${JSON.stringify(acceptedDraft)};document.querySelector('#pane-guide .guide-template .mini-btn').click();})()`);
 await waitFor(()=>page.evaluate(`document.getElementById('sd-interaction-dialog')?.open&&document.querySelector('.interaction-title')?.textContent==='Replace current draft?'`),{label:'Guide template replacement'});
 await page.evaluate(`document.querySelector('#sd-interaction-dialog .interaction-actions .primary').click()`);
 await waitFor(()=>page.evaluate(`document.querySelector('.pane.on')?.id==='pane-plan'&&document.getElementById('plan-input')?.value.includes('Deep Study Block 1')`),{label:'Guide template accepted'});
 await page.evaluate(`__PWA6.goTab('guide')`);
 await page.evaluate(`(()=>{document.getElementById('plan-input').value='06:45 | 35 | Keep this draft on cancel | work | Existing | block | 1';[...document.querySelectorAll('#pane-guide .guide-template .mini-btn')][1].click();})()`);
 await waitFor(()=>page.evaluate(`document.getElementById('sd-interaction-dialog')?.open&&document.querySelector('.interaction-title')?.textContent==='Replace current draft?'`),{label:'Guide template cancellation'});
 await page.evaluate(`document.querySelector('#sd-interaction-dialog [data-interaction-cancel]').click()`);
 await waitFor(()=>page.evaluate(`!document.getElementById('sd-interaction-dialog')?.open&&document.querySelector('#pane-guide .guide-status')?.textContent.trim()==='Current draft kept.'`),{label:'Guide template cancelled'});
 assert.equal(await page.evaluate(`document.getElementById('plan-input').value`),'06:45 | 35 | Keep this draft on cancel | work | Existing | block | 1');

 // Loading into an empty draft starts the real storage write immediately and
 // avoids a confirmation dialog's own Back navigation competing with the tab action.
 assert.equal(await page.evaluate(`(async()=>{
   document.getElementById('plan-input').value='';
   document.querySelectorAll('#pane-guide .guide-template .mini-btn')[1].click();
   return await __PWA6.goTab('review');
 })()`),true,'the navigation to Review commits');
 await waitFor(()=>page.evaluate(`__PWA6.AppData.planData.read().then(value=>value.draft?.includes('GS Static Study')&&value.draft===document.getElementById('plan-input').value)`),{label:'template saved after leaving Guide'});
 await page.evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
 assert.equal(await page.evaluate(`document.querySelector('.pane.on')?.id`),'pane-review','Guide completion must preserve a later navigation');
 await page.evaluate(`__PWA6.goTab('guide')`);

 await page.evaluate(`(()=>{
   const originalFetch=window.fetch.bind(window),pending={};
   window.__guideLegalQA={pending,originalFetch,resolve(id){const finish=pending[id];if(finish){delete pending[id];finish();}},restore(){window.fetch=originalFetch;delete window.__guideLegalQA;}};
   window.fetch=(input,init)=>{
     const url=typeof input==='string'?input:String(input?.url||input),match=url.match(/(?:^|\\/)(privacy|terms|security)\\.html(?:[?#]|$)/i);
     if(!match)return originalFetch(input,init);
     const id=match[1].toLowerCase();
     return new Promise(resolve=>{pending[id]=()=>resolve(new Response('<main><h1>'+id.toUpperCase()+'_SENTINEL</h1><script>window.__guideBadScript=true<\\/script><a id="unsafe-link" href="javascript:alert(1)">Unsafe</a></main>',{status:200,headers:{'Content-Type':'text/html'}}));});
   };
   [...document.querySelectorAll('#pane-guide .guide-legal-links button')].find(button=>button.textContent.trim()==='Privacy').click();
 })()`);
 await waitFor(()=>page.evaluate(`!!window.__guideLegalQA?.pending?.privacy&&!document.querySelector('.legal-center-overlay')?.hidden`),{label:'delayed Privacy'});
 await page.evaluate(`document.querySelector('.legal-center-nav-button[data-legal-document=terms]').click()`);
 await waitFor(()=>page.evaluate(`!!window.__guideLegalQA?.pending?.terms&&document.querySelector('.legal-center-title')?.textContent==='Terms'`),{label:'delayed Terms'});
 await page.evaluate(`window.__guideLegalQA.resolve('privacy')`);await new Promise(resolve=>setTimeout(resolve,60));
 assert.deepEqual(await page.evaluate(`({title:document.querySelector('.legal-center-title')?.textContent||'',busy:document.querySelector('.legal-center-content')?.getAttribute('aria-busy')||'',privacy:/PRIVACY_SENTINEL/.test(document.querySelector('.legal-center-content')?.textContent||'')})`),{title:'Terms',busy:'true',privacy:false});
 await page.evaluate(`window.__guideLegalQA.resolve('terms')`);
 await waitFor(()=>page.evaluate(`document.querySelector('.legal-center-content')?.getAttribute('aria-busy')==='false'&&/TERMS_SENTINEL/.test(document.querySelector('.legal-center-content')?.textContent||'')`),{label:'Terms legal completion'});
 assert.deepEqual(await page.evaluate(`({script:!!document.querySelector('.legal-center-document script'),unsafe:document.querySelector('.legal-center-document #unsafe-link')?.getAttribute('href')||null,executed:window.__guideBadScript===true})`),{script:false,unsafe:null,executed:false});
 await page.evaluate('history.back()');
 await waitFor(()=>page.evaluate('document.querySelector(".legal-center-overlay")?.hidden===true'));
 await waitFor(()=>page.evaluate(`document.activeElement?.textContent?.trim()==='Privacy'&&!!document.activeElement?.closest?.('.guide-legal-links')`),{label:'Legal Back focus restoration'});

 await page.evaluate(`(()=>{
   const privacy=[...document.querySelectorAll('#pane-guide .guide-legal-links button')].find(button=>button.textContent.trim()==='Privacy');
   const security=[...document.querySelectorAll('#pane-guide .guide-legal-links button')].find(button=>button.textContent.trim()==='Security');
   privacy.click();document.querySelector('.legal-center-close').click();security.click();
 })()`);
 await waitFor(()=>page.evaluate(`!!window.__guideLegalQA?.pending?.security&&!document.querySelector('.legal-center-overlay')?.hidden&&document.querySelector('.legal-center-title')?.textContent==='Security'`),{label:'Legal close-reopen ownership'});
 await page.evaluate(`document.querySelector('.legal-center-close').click()`);
 await waitFor(()=>page.evaluate(`document.querySelector('.legal-center-overlay')?.hidden===true`),{label:'Legal close while pending'});
 await waitFor(()=>page.evaluate(`document.activeElement?.textContent?.trim()==='Security'&&!!document.activeElement?.closest?.('.guide-legal-links')`),{label:'Legal close focus restoration'});
 await page.evaluate(`window.__guideLegalQA.resolve('security')`);await new Promise(resolve=>setTimeout(resolve,60));
 assert.deepEqual(await page.evaluate(`({hidden:document.querySelector('.legal-center-overlay')?.hidden===true,security:/SECURITY_SENTINEL/.test(document.querySelector('.legal-center-content')?.textContent||''),focused:document.activeElement?.textContent?.trim()||'',overflow:document.body.style.overflow})`),{hidden:true,security:false,focused:'Security',overflow:''});
 await page.evaluate(`window.__guideLegalQA.restore()`);
 const rapidClose=await page.evaluate(`(async()=>{
   const trigger=[...document.querySelectorAll('.guide-legal-links button')].find(control=>control.textContent.trim()==='Terms');
   const media=window.matchMedia;
   window.matchMedia=query=>query.includes('prefers-reduced-motion')?{matches:true}:media.call(window,query);
   try{
     trigger.click();document.querySelector('.legal-center-close').click();
     await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
     const layer=document.querySelector('.legal-center-overlay');
     return {hidden:layer.hidden,open:layer.classList.contains('is-open'),focus:document.activeElement===trigger};
   }finally{window.matchMedia=media;}
 })()`);
 assert.deepEqual(rapidClose,{hidden:true,open:false,focus:true},'a close before the first frame must retire the pending open and return focus');

 // Export worker construction is also a TrustedScriptURL sink.
 await page.evaluate('__PWA6.BackupController.createCheckpoint()');
 assert.equal(await page.evaluate('__PWA6.trustedTypeViolations.size'),0);
 await page.evaluate('__PWA6.TimerEngine.stopExecution()');
 console.log(JSON.stringify({status:'PASS',suite:'runtime-security-boundary',strictTrustedTypes:true,repeatedPaste:true,exportWorker:true,timer:true,presentationMatrix:true,profileAppearance:true,overlayHandoff:true,packRetry:true,minified:process.env.SD_MINIFIED_TEST==='1'}));
 const errors=page.events.filter(e=>!/favicon|ResizeObserver loop/.test(e.text));assert.deepEqual(errors,[]);
}finally{if(page)await browser.closePage(page);await browser.close();await server.close();}
