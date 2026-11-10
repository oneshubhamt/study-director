import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root,startReleaseServer,launchChromium,waitForStudyDirector,waitFor,sleep,settleMotion} from '../../helpers/browser-harness.mjs';

// Browser interaction-system contract: full-app guidance/safety plus real History API traversal ordering.

{ // interaction-guidance
const axeSource=readRuntimeSource(path.join(root,'node_modules','axe-core','axe.min.js'));

const identity=`(()=>{
  if(localStorage.getItem('__qaIdentitySeeded'))return;localStorage.setItem('__qaIdentitySeeded','1');
  const date=new Date(),today=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Interaction QA',updatedAt:new Date().toISOString()}));
  (localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));
})();`;
const notificationHarness=`(()=>{
  let permission='default';window.__notificationQA={permissionRequests:0,constructors:[],shown:[]};
  function FakeNotification(title,options){window.__notificationQA.constructors.push({title,options});}
  Object.defineProperty(FakeNotification,'permission',{get:()=>permission});
  FakeNotification.requestPermission=async()=>{window.__notificationQA.permissionRequests+=1;permission='granted';return permission;};
  Object.defineProperty(window,'Notification',{configurable:true,value:FakeNotification});
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:async()=>({active:{state:'activated'},showNotification:async(title,options)=>window.__notificationQA.shown.push({title,options})})}});
  window.__nativeDialogQA={confirm:0,prompt:0};window.confirm=()=>{window.__nativeDialogQA.confirm+=1;return true;};window.prompt=()=>{window.__nativeDialogQA.prompt+=1;return '';};
})();`;

const server=await startReleaseServer();
const browser=await launchChromium({profilePrefix:'study-director-qa-interactions-'}),pages=[];
const result={status:'PASS',release:server.manifest.release,checks:{}};
try{
  const page=await browser.createPage(server.url('deployment','instrumented.html'),{
    preload:identity+notificationHarness,viewport:{width:1280,height:860,mobile:false,scale:1}
  });pages.push(page);
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().state==='primary'`),{label:'primary ownership'});

  const automatic=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=new Date(),minute=now.getHours()*60+now.getMinutes()+2;
    const start=String(Math.floor((minute+1440)%1440/60)).padStart(2,'0')+':'+String((minute+1440)%1440%60).padStart(2,'0');
    d.goTab('plan');document.getElementById('plan-input').value=start+' | 20 | Permission-safe block | work | Safety | pages | 10';
    const applied=await d.applySchedule({skipNotify:true});
    d.goTab('execute');document.getElementById('ns-toggle-btn').click();document.getElementById('ns-toggle-btn').click();
    d.TimerEngine.startCur(3);await wait(30);d.TimerEngine.stopExecution();
    return {applied,requests:__notificationQA.permissionRequests,label:document.getElementById('system-alert-toggle').textContent.trim()};
  })()`);
  assert.deepEqual(automatic,{applied:true,requests:0,label:'Enable'});
  result.checks.noAutomaticPermissionPrompts=true;

  await page.evaluate(`document.getElementById('system-alert-toggle').click()`);
  await waitFor(()=>page.evaluate(`__notificationQA.permissionRequests===1&&__PWA6.SystemNotifications.status().enabled`),{label:'explicit notification permission'});
  const delivered=await page.evaluate(`(async()=>{
    const ok=await __PWA6.SystemNotifications.notify('Delivery check','Service worker path','qa-delivery','qa-delivery',true);
    return {ok,requests:__notificationQA.permissionRequests,shown:__notificationQA.shown,constructors:__notificationQA.constructors,label:document.getElementById('system-alert-toggle').textContent.trim()};
  })()`);
  assert.equal(delivered.ok,true);assert.equal(delivered.requests,1);assert.equal(delivered.shown.length,1);assert.equal(delivered.constructors.length,0);
  assert.equal(delivered.shown[0].title,'Delivery check');assert.equal(delivered.shown[0].options.tag,'qa-delivery');assert.equal(delivered.label,'On');
  result.checks.explicitPermissionAndServiceWorkerDelivery=true;

  await page.evaluate(`(()=>{
    window.__confirmValue='pending';
    __PWA6.Interactions.confirm({title:'Delete saved day?',message:'Only this saved day will be removed.',danger:true,confirmLabel:'Delete saved day',cancelLabel:'Keep saved day'}).then(value=>{window.__confirmValue=value;});
  })()`);
  await waitFor(()=>page.evaluate(`document.getElementById('sd-interaction-dialog').open`),{label:'themed confirmation'});
  // Contrast is measured on the settled dialog: mid-entry, its opacity is below 1
  // and axe's colour-contrast result depends on the exact frame it samples.
  await settleMotion(page);
  await page.evaluate(axeSource,{returnByValue:false});
  const accessibility=await page.evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}).then(value=>value.violations.filter(item=>item.impact==='serious'||item.impact==='critical').map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.length})))`);
  assert.deepEqual(accessibility,[]);
  const defaultFocus=await page.evaluate(`({title:document.querySelector('.interaction-title').textContent,focusedCancel:document.activeElement?.dataset?.interactionCancel==='true',danger:document.getElementById('sd-interaction-dialog').classList.contains('danger')})`);
  assert.deepEqual(defaultFocus,{title:'Delete saved day?',focusedCancel:true,danger:true});
  await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
  await waitFor(()=>page.evaluate(`window.__confirmValue===false`),{label:'Escape cancellation'});
  result.checks.safeDefaultFocusEscapeAndAccessibility=true;

  await page.evaluate(`(()=>{
    window.__inputValue='pending';
    __PWA6.Interactions.input({title:'New note',message:'Choose where it belongs, then name it.',inputLabel:'Area or topic name',required:true,requiredMessage:'Enter an Area or topic name.',defaultOption:'nested',options:[{value:'nested',label:'Inside Ethics'},{value:'top',label:'At top level'}],preview:(value,scope)=>scope==='nested'?'Ethics › '+(value||'…'):(value||'New top-level Area'),confirmLabel:'Create note'}).then(value=>{window.__inputValue=value;});
  })()`);
  await waitFor(()=>page.evaluate(`document.getElementById('sd-interaction-dialog').open&&!!document.querySelector('.interaction-input')`),{label:'themed note input'});
  await page.evaluate(`document.querySelector('.interaction-actions .primary').click()`);
  assert.equal(await page.evaluate(`document.getElementById('sd-interaction-error').textContent.trim()`),'Enter an Area or topic name.');
  const inputProjection=await page.evaluate(`(()=>{
    const dialog=document.getElementById('sd-interaction-dialog'),field=dialog.querySelector('.interaction-input');field.value='Cardiology';field.dispatchEvent(new Event('input',{bubbles:true}));
    dialog.querySelector('.interaction-option[data-value="top"]').click();const preview=dialog.querySelector('.interaction-preview').textContent;dialog.querySelector('.interaction-actions .primary').click();return preview;
  })()`);
  assert.equal(inputProjection,'Cardiology');
  await waitFor(()=>page.evaluate(`window.__inputValue&&window.__inputValue!=='pending'`),{label:'note input completion'});
  assert.deepEqual(await page.evaluate(`window.__inputValue`),{value:'Cardiology',option:'top'});
  result.checks.clearNoteLocationPreviewAndValidation=true;

  await page.evaluate(`(()=>{
    window.__restoreConfiguration='pending';
    __PWA6.Interactions.configure({title:'Restore this verified backup?',message:'All applicable choices appear together.',groups:[
      {id:'dailyRecords',label:'Same-date saved days',defaultValue:'keep',choices:[{value:'keep',label:'Keep local copies'},{value:'replace',label:'Use backup copies'}]},
      {id:'plans',label:'Plan draft and saved plans',defaultValue:'keep',choices:[{value:'keep',label:'Keep current plans'},{value:'replace',label:'Use backup plans'}]}
    ],confirmLabel:'Create safety copy and continue'}).then(value=>{window.__restoreConfiguration=value;});
  })()`);
  await waitFor(()=>page.evaluate(`document.getElementById('sd-interaction-dialog').open&&document.querySelectorAll('.interaction-group').length===2&&document.activeElement?.dataset?.interactionCancel==='true'`),{label:'consolidated restore choices'});
  const restoreSurface=await page.evaluate(`(()=>{
    const dialog=document.getElementById('sd-interaction-dialog');
    const initialCancel=document.activeElement?.dataset?.interactionCancel==='true';
    dialog.querySelector('.interaction-group:nth-child(1) [data-value="replace"]').click();
    dialog.querySelector('.interaction-group:nth-child(2) [data-value="replace"]').click();
    const groupCount=dialog.querySelectorAll('.interaction-group').length;
    dialog.querySelector('.interaction-actions .primary').click();
    return {groupCount,initialCancel};
  })()`);
  await waitFor(()=>page.evaluate(`window.__restoreConfiguration!=='pending'`),{label:'consolidated restore result'});
  assert.deepEqual(restoreSurface,{groupCount:2,initialCancel:true});
  assert.deepEqual(await page.evaluate(`window.__restoreConfiguration`),{dailyRecords:'replace',plans:'replace'});
  result.checks.restoreChoicesConsolidatedWithSafeFocus=true;

  await page.evaluate(`(()=>{
    window.__bulkConfiguration='pending';
    __PWA6.Interactions.configure({title:'Different Saved Days found',message:'Choose a starting point, then review any day.',groups:[
      {id:'savedDaysBulk',label:'Saved-Day conflicts · 2 days',defaultValue:'review',choices:[
        {value:'local',label:'Use this device for all',applyValues:{dayA:'localA',dayB:'localB'}},
        {value:'incoming',label:'Use backup for all',applyValues:{dayA:'remoteA',dayB:'remoteB'}},
        {value:'review',label:'Review individually',applyValues:{dayA:'localA',dayB:'localB'}}]},
      {id:'dayA',label:'Saved Day · A',defaultValue:'localA',choices:[{value:'localA',label:'This device'},{value:'remoteA',label:'Backup'}]},
      {id:'dayB',label:'Saved Day · B',defaultValue:'localB',choices:[{value:'localB',label:'This device'},{value:'remoteB',label:'Backup'}]}
    ],confirmLabel:'Continue'}).then(value=>{window.__bulkConfiguration=value;});
  })()`);
  await waitFor(()=>page.evaluate(`document.getElementById('sd-interaction-dialog').open&&document.querySelectorAll('.interaction-group').length===3`),{label:'Saved-Day bulk conflict choices'});
  const bulkProjection=await page.evaluate(`(()=>{
    const dialog=document.getElementById('sd-interaction-dialog'),groups=[...dialog.querySelectorAll('.interaction-group')];
    groups[0].querySelector('[data-value="incoming"]').click();
    const afterBulk=[groups[1].querySelector('[data-value="remoteA"]').getAttribute('aria-checked'),groups[2].querySelector('[data-value="remoteB"]').getAttribute('aria-checked')];
    groups[1].querySelector('[data-value="localA"]').click();
    dialog.querySelector('.interaction-actions .primary').click();
    return {afterBulk};
  })()`);
  await waitFor(()=>page.evaluate(`window.__bulkConfiguration!=='pending'`),{label:'Saved-Day bulk configuration result'});
  assert.deepEqual(bulkProjection,{afterBulk:['true','true']});
  assert.deepEqual(await page.evaluate(`window.__bulkConfiguration`),{savedDaysBulk:'incoming',dayA:'localA',dayB:'remoteB'});
  result.checks.savedDayBulkDefaultsRemainOverridable=true;

  const queue=await page.evaluate(`(async()=>{
    const d=__PWA6,waitOpen=()=>new Promise(resolve=>{const poll=()=>{const dialog=document.getElementById('sd-interaction-dialog');dialog.open?resolve(dialog):setTimeout(poll,10);};poll();});
    const first=d.Interactions.confirm({title:'First queued decision'}),second=d.Interactions.confirm({title:'Second queued decision'});
    let dialog=await waitOpen();const firstTitle=dialog.querySelector('.interaction-title').textContent;dialog.querySelector('.interaction-actions .primary').click();
    dialog=await waitOpen();const secondTitle=dialog.querySelector('.interaction-title').textContent;dialog.querySelector('[data-interaction-cancel]').click();
    return {firstTitle,secondTitle,values:await Promise.all([first,second])};
  })()`);
  assert.deepEqual(queue,{firstTitle:'First queued decision',secondTitle:'Second queued decision',values:[true,false]});
  result.checks.queuedDecisionsAreDeterministic=true;

  const toast=await page.evaluate(`(()=>{
    const d=__PWA6;d.Interactions.notify({key:'save-day',title:'Saved',message:'First'});d.Interactions.notify({key:'save-day',title:'Saved today',message:'Library updated'});
    const rows=[...document.querySelectorAll('#sd-toast-region .interaction-toast')].filter(item=>item.dataset.key==='save-day');return {count:rows.length,text:rows[0]?.textContent||'',pomodoroVisible:document.getElementById('nudge-overlay').classList.contains('on')};
  })()`);
  assert.equal(toast.count,1);assert.match(toast.text,/Saved today/);assert.equal(toast.pomodoroVisible,false);
  result.checks.briefFeedbackIsSeparateAndCoalesced=true;

  await page.setViewport({width:390,height:844,mobile:true,scale:2});
  await page.evaluate(`(()=>{window.__mobileConfirm='pending';__PWA6.Interactions.confirm({title:'Mobile confirmation',message:'Contained on a phone.'}).then(value=>{window.__mobileConfirm=value;});return true;})()`);
  await waitFor(()=>page.evaluate(`document.getElementById('sd-interaction-dialog').open`),{label:'mobile confirmation'});await settleMotion(page);
  const mobile=await page.evaluate(`(()=>{const dialog=document.getElementById('sd-interaction-dialog'),r=dialog.getBoundingClientRect(),buttons=[...dialog.querySelectorAll('.interaction-action')].map(button=>button.getBoundingClientRect().height);return {left:r.left,right:r.right,width:r.width,viewport:innerWidth,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,buttons};})()`);
  assert.ok(mobile.left>=-1&&mobile.right<=mobile.viewport+1&&mobile.overflow<=1);assert.ok(mobile.buttons.every(value=>value>=42));
  await page.evaluate(`document.querySelector('[data-interaction-cancel]').click()`);
  assert.deepEqual(await page.evaluate(`window.__nativeDialogQA`),{confirm:0,prompt:0});
  result.checks.mobileContainedAndNoNativeDialogs=true;

  const ipad=await browser.createPage(server.url('deployment','instrumented.html'),{
    userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 CriOS/149.0.0.0 Mobile/15E148 Safari/604.1',
    platform:'MacIntel',preload:identity+`window.addEventListener('beforeinstallprompt',event=>event.stopImmediatePropagation(),true);`,viewport:{width:820,height:1080,mobile:true,scale:2}
  });pages.push(ipad);await waitForStudyDirector(ipad,{instrumented:true});
  await ipad.evaluate(`__PWA6.goTab('guide')`);
  await waitFor(()=>ipad.evaluate(`!!document.querySelector('#guide-install-card .mini-btn:not(:disabled)')`),{timeout:60000,label:'iPad install card'});
  await ipad.evaluate(`document.querySelector('#guide-install-card .mini-btn').click()`);
  await waitFor(()=>ipad.evaluate(`!!document.getElementById('guide-install-help')`),{timeout:60000,label:'iPad install guide'});
  const guide=await ipad.evaluate(`({context:document.querySelector('.guide-install-context').textContent.trim(),steps:[...document.querySelectorAll('.guide-install-steps li')].map(item=>item.textContent.trim()),refresh:document.querySelector('#guide-install-card .mini-btn')?.textContent.trim()||''})`);
  assert.equal(guide.context,'Steps for iPad · Chrome');assert.ok(guide.steps.some(step=>/Share button/.test(step)));assert.ok(guide.steps.some(step=>/Add to Home Screen/.test(step)));assert.equal(guide.refresh,'Refresh install status');
  result.checks.contextualIPadInstallGuide=true;

  const errors=pages.flatMap(item=>item.events).filter(event=>!/favicon|ResizeObserver loop/i.test(event.text));assert.deepEqual(errors,[]);
}finally{
  for(const page of pages)await browser.closePage(page);
  await browser.close();await server.close();
}

console.log(JSON.stringify(result,null,2));
}

{ // interaction-history
const internal=readRuntimeSource('source/core/internal.ts');
const interactions=readRuntimeSource('source/core/interactions.ts');
const notices=readRuntimeSource('source/core/notice-coordinator.ts');
const browser=await launchChromium({profilePrefix:'qa-interaction-history-'});let page;
try{
  page=await browser.createPage('about:blank',{viewport:{width:800,height:600,mobile:false,scale:1}});
  await page.evaluate(`document.body.innerHTML='<dialog id="sd-interaction-dialog"></dialog><div id="sd-toast-region"></div>'`);
  await page.evaluate(internal,{returnByValue:false});
  await page.evaluate(interactions,{returnByValue:false});
  await page.evaluate(notices,{returnByValue:false});
  await page.evaluate(`(()=>{
    const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')],mod=registry.require('interactions',1),same=(a,b)=>!!a&&!!b&&a.kind===b.kind&&a.token===b.token;
    history.replaceState({workspace:null},'');window.__historyEvents=[];
    const notices=registry.require('notice-coordinator',1).createCoordinator(Object.freeze({}));
    const controller=mod.createController(Object.freeze({ports:Object.freeze({
      notifications:Object.freeze({notify:notices.notify,subscribe:notices.subscribe,dismissEvent:notices.dismissEvent,dismissAll:notices.dismissAll,pauseEvent:notices.pauseEvent,setPaused:notices.setPaused,setHidden:notices.setHidden}),
      environment:Object.freeze({clearTimeout:id=>clearTimeout(id),document,nativeConfirm:()=>false,nativePrompt:()=>null,requestAnimationFrame:callback=>requestAnimationFrame(callback),setTimeout:(callback,delay)=>setTimeout(callback,delay),window}),
      diagnostics:Object.freeze({capture:(scope,error)=>__historyEvents.push({type:'error',scope,message:String(error&&error.message||error)})}),
      history:Object.freeze({
        opened:descriptor=>{history.pushState({workspace:descriptor},'');__historyEvents.push({type:'opened',token:descriptor.token});return true;},
        requestClose:descriptor=>{const current=history.state?.workspace||null;if(!same(descriptor,current))return false;__historyEvents.push({type:'back-requested',token:descriptor.token});history.back();return true;},
        closed:(descriptor,meta)=>{__historyEvents.push({type:'closed',token:descriptor.token,fromHistory:meta.fromHistory,historyPending:meta.historyPending});return true;}
      })
    })}));
    addEventListener('popstate',()=>{const desired=history.state?.workspace||null;__historyEvents.push({type:'popstate',token:desired?.token||''});controller.reconcileHistory(desired);});
    window.__controller=controller;window.__sequentialResult='pending';
    (async()=>{
      const first=controller.choose({title:'Backup encryption',choices:[{label:'Turn off encryption',value:'disable'}]});
      document.querySelector('.interaction-choice').click();
      const firstValue=await first;
      const second=controller.confirm({title:'Turn off backup encryption?'});
      await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
      window.__secondPromise=second;
      window.__sequentialResult={firstValue,secondToken:controller.historyDescriptor()?.token||''};
    })();
  })()`);
  await waitFor(()=>page.evaluate(`window.__sequentialResult!=='pending'`),{label:'sequential prompt handoff'});
  await sleep(120);
  const state=await page.evaluate(`(()=>({result:window.__sequentialResult,open:document.getElementById('sd-interaction-dialog').open,title:document.querySelector('.interaction-title')?.textContent||'',activeToken:window.__controller.historyDescriptor()?.token||'',events:window.__historyEvents}))()`);
  assert.equal(state.result.firstValue,'disable');
  assert.equal(state.open,true,'delayed Back traversal from the first prompt must not cancel the follow-up prompt');
  assert.equal(state.title,'Turn off backup encryption?');
  assert.equal(state.activeToken,state.result.secondToken);
  assert.equal(state.events.filter(event=>event.type==='popstate').length,1,'first prompt must settle on exactly one Back traversal before second opens');
  await page.evaluate(`document.querySelector('[data-interaction-cancel]').click()`);
  await waitFor(()=>page.evaluate(`!window.__controller.historyDescriptor()`),{label:'follow-up prompt close'});
  assert.deepEqual(page.events,[]);
  console.log(JSON.stringify({status:'PASS',suite:'interaction-history-browser',checks:['real History API traversal settlement','sequential follow-up remains actionable']},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();}
}
