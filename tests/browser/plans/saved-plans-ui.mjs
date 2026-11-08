import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor,instrumentedHtml} from '../../helpers/browser-harness.mjs';

const server=await startReleaseServer();
const browser=await launchChromium({profilePrefix:'sd73k-plans-ui-'});
let html=instrumentedHtml();
html=html.replace('Object.freeze({StartupLifecycle,','Object.freeze({PlanData,PlanRuntime,StartupLifecycle,');
server.setOverride('deployment','plans-ui.html',html);
const preload=`(()=>{const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');if(!localStorage.getItem('studyDirector.userDefaults.v1'))localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Plan UI QA'}));(localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})))})();`;
let page;
async function ready(){await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate('__PWA6.AppOwnership.status().hasControl'));}
try{
  page=await browser.createPage(server.url('deployment','plans-ui.html'),{preload});
  await ready();
  await page.evaluate(`__PWA6.goTab('plan');document.querySelector('.plan-composer').open=true;document.getElementById('saved-plans-panel').open=true`);

  // Plan draft projection must distinguish malformed rows, timeline overlap, valid gaps, and live completion semantics.
  const planProjection=await page.evaluate(`(async()=>{const input=document.getElementById('plan-input'),state=document.getElementById('plan-board-state'),caption=document.getElementById('plan-board-caption'),status=document.getElementById('plan-status'),apply=document.querySelector('[data-action="apply-schedule"]'),probe=text=>{input.value=text;__PWA6.PlanDraftEditor.preview({enterDraft:true});return {state:state.textContent,caption:caption.textContent,status:status.textContent,tone:status.className,applyDisabled:apply.disabled}};const malformed=probe('07:00 | bad | Broken | work | Ethics | pages | 10'),overlap=probe('07:00 | 60 | Ethics | work | Ethics | pages | 10\\n07:30 | 30 | Essay | work | Essay | pages | 5'),boundary=probe('03:30 | 60 | Late work | work | Ethics | pages | 10'),gap=probe('07:00 | 30 | Ethics | work | Ethics | pages | 10\\n08:00 | 30 | Essay | work | Essay | pages | 5'),applied=await __PWA6.applySchedule({skipNotify:true}),live={state:state.textContent,status:status.textContent,tone:status.className,applyDisabled:apply.disabled};return {malformed,overlap,boundary,gap,applied,live}})()`);
  for(const invalid of [planProjection.malformed,planProjection.overlap,planProjection.boundary]){assert.equal(invalid.state,'DRAFT INVALID');assert.equal(invalid.applyDisabled,true);assert.match(invalid.tone,/err/);}
  assert.match(planProjection.malformed.status,/duration/i);assert.match(planProjection.overlap.status,/overlap/i);assert.match(planProjection.boundary.status,/04:00 study-day boundary/i);
  assert.equal(planProjection.gap.state,'DRAFT READY');assert.equal(planProjection.gap.applyDisabled,false);assert.match(planProjection.gap.status,/Unscheduled gap/i);assert.match(planProjection.gap.tone,/warn/);
  assert.equal(planProjection.applied,true);assert.equal(planProjection.live.state,'LIVE');assert.match(planProjection.live.status,/Unscheduled gap/i);assert.match(planProjection.live.tone,/warn/);

  const completion=await page.evaluate(`(()=>{const b=document.querySelector('.si-chk'),r=b.getBoundingClientRect();return {label:b.getAttribute('aria-label'),pressed:b.getAttribute('aria-pressed'),description:b.getAttribute('aria-description'),state:b.dataset.completionState,width:r.width,height:r.height}})()`);
  assert.match(completion.label,/Mark Ethics complete/i);assert.equal(completion.pressed,'false');assert.match(completion.description,/Current state: incomplete/i);assert.equal(completion.state,'incomplete');assert.ok(completion.width<=24&&completion.height<=44);
  await page.evaluate(`document.querySelector('.si-chk').focus()`);await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,nativeVirtualKeyCode:32});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32,nativeVirtualKeyCode:32});
  await waitFor(()=>page.evaluate(`document.querySelector('.si-chk')?.getAttribute('aria-pressed')==='true'`),{label:'Space completion activation'});
  assert.deepEqual(await page.evaluate(`(()=>{const b=document.querySelector('.si-chk');return {pressed:b.getAttribute('aria-pressed'),state:b.dataset.completionState,focused:document.activeElement===b}})()`),{pressed:'true',state:'complete',focused:true});
  await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await page.send('Input.dispatchKeyEvent',{type:'char',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  await waitFor(()=>page.evaluate(`document.querySelector('.si-chk')?.getAttribute('aria-pressed')==='false'`),{label:'Enter completion activation'});

  const composer=await page.evaluate(`(()=>{const load=document.querySelector('[data-action="load-default"]'),apply=document.querySelector('[data-action="apply-schedule"]'),clear=document.querySelector('[data-action="clear-schedule-draft"]');return {same:load.parentElement===apply.parentElement&&apply.parentElement===clear.parentElement,count:load.parentElement.querySelectorAll(':scope > button').length,clearGhost:clear.classList.contains('ghost'),clearClass:clear.classList.contains('plan-clear-draft')}})()`);
  assert.deepEqual(composer,{same:true,count:3,clearGhost:true,clearClass:true});

  const simplified=await page.evaluate(`(()=>({select:!!document.getElementById('saved-plan-select'),manage:[...document.querySelectorAll('#saved-plans-panel summary')].some(el=>el.textContent.includes('Manage selected plan')),list:!!document.getElementById('saved-plans-list'),copy:document.querySelector('#saved-plans-panel .plan-composer-body p')?.textContent.trim()}))()`);
  assert.deepEqual(simplified,{select:false,manage:false,list:true,copy:'Save reusable plans and load them into Draft when needed.'});

  const draft='07:00 | 60 | Revision | work | Biology | pages | 10';
  await page.evaluate(`(async()=>{document.getElementById('plan-input').value=${JSON.stringify(draft)};await __PWA6.PlanDraftEditor.save();document.getElementById('saved-plan-name').value='Revision day';await __PWA6.PlanRuntime.savedPlans.act('save')})()`);
  const firstId=await page.evaluate(`__PWA6.PlanData.library().savedPlans[0].id`);
  const row=await page.evaluate(`(()=>{const row=document.querySelector('.saved-plan-item');return {name:row?.querySelector('.saved-plan-label')?.textContent,load:row?.querySelector('[data-saved-plan="load"]')?.textContent.trim(),menu:row?.querySelector('.saved-plan-menu-trigger')?.textContent.trim(),actions:[...row.querySelectorAll('.saved-plan-menu-popover [data-saved-plan]')].map(b=>b.dataset.savedPlan)}})()`);
  assert.deepEqual(row,{name:'Revision day',load:'Load',menu:'⋯',actions:['rename','update','default','delete']});

  await page.evaluate(`document.querySelector('[data-saved-plan-id="${firstId}"] .saved-plan-menu-trigger').click()`);
  await waitFor(()=>page.evaluate(`!document.querySelector('[data-saved-plan-id="${firstId}"] .saved-plan-menu-popover').hidden`),{label:'saved-plan overflow menu opens'});
  await page.evaluate(`document.querySelector('[data-saved-plan-id="${firstId}"] [data-saved-plan="default"]').click()`);
  await waitFor(()=>page.evaluate(`__PWA6.PlanData.library().defaultId===${JSON.stringify(firstId)}`),{label:'saved-plan default action'});
  const defaultState=await page.evaluate(`(()=>{const row=document.querySelector('[data-saved-plan-id="${firstId}"]');return {badge:row?.querySelector('.saved-plan-default')?.textContent.trim(),defaultAction:!!row?.querySelector('[data-saved-plan="default"]')}})()`);
  assert.deepEqual(defaultState,{badge:'Default',defaultAction:false});

  await page.evaluate(`document.querySelector('[data-saved-plan-id="${firstId}"] .saved-plan-menu-trigger').click();document.querySelector('[data-saved-plan-id="${firstId}"] [data-saved-plan="rename"]').click()`);
  await waitFor(()=>page.evaluate(`document.querySelector('#sd-interaction-dialog[open] .interaction-input')?.value==='Revision day'`),{label:'rename dialog'});
  await page.evaluate(`(()=>{const input=document.querySelector('#sd-interaction-dialog .interaction-input');input.value='Deep work';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#sd-interaction-dialog .interaction-action.primary').click()})()`);
  await waitFor(()=>page.evaluate(`document.querySelector('[data-saved-plan-id="${firstId}"] .saved-plan-label')?.textContent==='Deep work'`),{label:'saved-plan rename action'});
  assert.equal(await page.evaluate(`document.getElementById('saved-plan-name').value`),'Revision day');

  assert.equal(await page.evaluate(`document.getElementById('saved-plan-status').textContent.trim()`),'Saved plans updated.');
  await waitFor(()=>page.evaluate(`document.getElementById('saved-plan-status').textContent===''`),{timeout:5000,label:'transient saved-plan status'});

  // Large touch devices (iPad-class) use a deliberate three-column field composition
  // rather than either the wasteful two-column fallback or the retired dense four-column override.
  await page.setViewport({width:1024,height:768,mobile:true,scale:2});
  await page.evaluate(`__PWA6.goTab('plan');__PWA6.PlanDraftEditor.preview({enterDraft:true})`);await page.settle(2);
  const tabletDraft=await page.evaluate(`(()=>{const row=document.querySelector('.si.draft'),fields=[...row.querySelectorAll('[data-draft-field]')],rect=el=>{const r=el.getBoundingClientRect();return {key:el.dataset.draftField,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};const boxes=fields.map(rect),by=Object.fromEntries(boxes.map(item=>[item.key,item]));const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;return {coarse:matchMedia('(any-pointer:coarse)').matches,columns:getComputedStyle(row.querySelector('.plan-draft-fields')).gridTemplateColumns.split(' ').filter(Boolean).length,boxes,durationSummary:getComputedStyle(row.querySelector('.si-right')).display,overlapPairs:[['start','dur'],['dur','kind'],['area','measure'],['measure','target']].filter(([a,b])=>overlaps(by[a],by[b]))}})()`);
  assert.equal(tabletDraft.coarse,true);assert.equal(tabletDraft.columns,3);assert.equal(tabletDraft.durationSummary,'none');assert.deepEqual(tabletDraft.overlapPairs,[]);assert.ok(tabletDraft.boxes.every(box=>box.width>0&&box.height>=44));const tabletBy=Object.fromEntries(tabletDraft.boxes.map(box=>[box.key,box]));assert.ok(Math.abs(tabletBy.start.height-tabletBy.dur.height)<=1,'iPad-class native Start time control must be the same closed height as Duration.');

  await page.setViewport({width:390,height:844,mobile:true,scale:1});
  const mobile=await page.evaluate(`(()=>{const root=document.documentElement,row=document.querySelector('.saved-plan-item'),save=document.querySelector('.saved-plan-save-row');return {overflow:root.scrollWidth>root.clientWidth+1,rowWidth:Math.round(row.getBoundingClientRect().width),saveWidth:Math.round(save.getBoundingClientRect().width),viewport:root.clientWidth}})()`);
  assert.equal(mobile.overflow,false);
  assert.ok(mobile.rowWidth<=mobile.viewport&&mobile.rowWidth>250);
  assert.ok(mobile.saveWidth<=mobile.viewport&&mobile.saveWidth>250);

  console.log(JSON.stringify({status:'PASS',suite:'saved-plans-ui',checks:['draft invalid/overlap/boundary/gap semantics','native completion semantics','composer controls share one row','saved-plan dropdown and management disclosure removed','compact saved-plan row and actions rendered','ellipsis menu opens through the real UI path','default action works through the overflow menu','default badge replaces redundant default action','rename uses focused interaction without overwriting save-name field','success status is transient','iPad-class touch draft uses non-overlapping three-column fields','390px layout has no horizontal overflow']},null,2));
}finally{
  if(page)await browser.closePage(page);
  await browser.close();
  await server.close();
}
