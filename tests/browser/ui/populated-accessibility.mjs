import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root,startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

const axeSource=fs.readFileSync(path.join(root,'node_modules','axe-core','axe.min.js'),'utf8');
const preload=`(()=>{const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Accessibility QA',updatedAt:new Date().toISOString()}));(localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));})();`;
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'study-director-qa-a11y-'});let page=null;
const result={status:'PASS',release:server.manifest.release,matrix:[],checks:{}};
async function axe(label){
  const violations=await page.evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}).then(report=>report.violations.filter(row=>row.impact==='serious'||row.impact==='critical').map(row=>({id:row.id,impact:row.impact,nodes:row.nodes.map(node=>{const el=document.querySelector(node.target[0]),style=el?getComputedStyle(el):null,rect=el?.getBoundingClientRect(),top=rect?document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2):null,ancestors=[];for(let cur=el;cur;cur=cur.parentElement){const cs=getComputedStyle(cur);if(cs.opacity!=='1'||cs.filter!=='none'||cs.transform!=='none')ancestors.push({tag:cur.tagName,id:cur.id,className:cur.className,opacity:cs.opacity,filter:cs.filter,transform:cs.transform});}return {target:node.target,html:node.html,summary:node.failureSummary,style:style?{color:style.color,background:style.backgroundColor,opacity:style.opacity,filter:style.filter}:null,rect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,top:top?{tag:top.tagName,id:top.id,className:top.className}:null,ancestors};})})))`);
  assert.deepEqual(violations,[],`${label}: ${JSON.stringify(violations)}`);result.matrix.push(label);
}
async function pressKey(key,code=key){
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{}),windowsVirtualKeyCode:{Enter:13,Escape:27,ArrowRight:39,Home:36,End:35}[key]||0});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:{Enter:13,Escape:27,ArrowRight:39,Home:36,End:35}[key]||0});
}
try{
  page=await browser.createPage(server.url('deployment','instrumented.html'),{preload,viewport:{width:1280,height:860,mobile:false,scale:1}});await waitForStudyDirector(page,{instrumented:true});await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'accessibility ownership'});await page.evaluate(axeSource,{returnByValue:false});
  await page.evaluate(`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=new Date(),m=now.getHours()*60+now.getMinutes()-2,fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0');document.getElementById('plan-input').value=[fmt(m)+' | 30 | Populated Cardiology | work | Medicine > Cardiology | pages | 20',fmt(m+30)+' | 15 | Populated Questions | work | Assessment | questions | 15'].join('\\n');d.applySchedule({skipNotify:true});d.goTab('execute');await wait(80);const note=document.getElementById('pn-extra');note.value='Populated ongoing evidence';d.commitTaskNoteEditor(note,note.value);await d.AppData.notes.flush();d.goTab('review');await wait(80);const reflection=document.getElementById('daily-reflection');reflection.value='Populated daily reflection with evidence and next action.';d.setStudyQuality(4,{save:false});d.ReviewEditor.saveReview({strict:true});await d.ReviewEditor.flushPending();await d.ReviewEditor.settled();await d.saveDayRecord();const base=await d.AppData.dailyRecords.get(d.todayISO()),clones=[];for(let offset=1;offset<=30;offset++){const day=new Date(d.todayISO()+'T12:00:00');day.setDate(day.getDate()-offset);const date=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-'),stamp=new Date(Date.now()-offset*86400000).toISOString();clones.push({...Object.fromEntries(["version", "recordKind", "date", "savedAt", "updatedAt", "sourceRevision", "reflection", "quote", "studyQuality", "realTimeSnapshot", "schedule", "results", "practiceRuns", "carryForwardDraft"].map(key=>[key,base[key]])),date,savedAt:stamp,updatedAt:stamp,studyQuality:1+(offset%5),reflection:'Populated history '+offset});}await d.AppData.dailyRecords.saveBatch(clones);d.goTab('plan');})()`);
  const panes=['plan','execute','review','library','insights','guide'];
  for(const theme of ['director-dark','director-light']){
    await page.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);await page.settle(3);
    for(const pane of panes){await page.evaluate(`__PWA6.goTab(${JSON.stringify(pane)})`);if(pane==='insights')await waitFor(()=>page.evaluate(`document.getElementById('pane-insights')?.getAttribute('aria-busy')==='false'&&document.querySelector('.insights-risk-key,.insights-empty')!==null`),{label:'populated Insights'});if(pane==='guide')await waitFor(()=>page.evaluate(`document.querySelector('.guide-wrap')!==null`),{label:'Guide'});await page.settle(2);await axe(`${theme}:desktop:${pane}`);}
  }
  await page.setViewport({width:768,height:1024,mobile:true,scale:1});
  for(const theme of ['director-dark','director-light']){
    await page.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);await page.settle(3);
    for(const pane of panes){await page.evaluate(`__PWA6.goTab(${JSON.stringify(pane)})`);if(pane==='insights')await waitFor(()=>page.evaluate(`document.getElementById('pane-insights').getAttribute('aria-busy')==='false'`));await page.settle(2);await axe(`${theme}:tablet:${pane}`);}
  }
  await page.setViewport({width:390,height:844,mobile:true,scale:2});
  for(const theme of ['director-dark','director-light']){
    await page.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);await page.settle(3);
    for(const pane of panes){await page.evaluate(`__PWA6.goTab(${JSON.stringify(pane)})`);if(pane==='insights')await waitFor(()=>page.evaluate(`document.getElementById('pane-insights').getAttribute('aria-busy')==='false'`));await page.settle(2);await axe(`${theme}:mobile:${pane}`);}
  }
  await page.setViewport({width:640,height:430,mobile:false,scale:2});await page.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});
  for(const theme of ['director-dark','director-light']){
    await page.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);await page.settle(3);
    for(const pane of panes){
      await page.evaluate(`__PWA6.goTab(${JSON.stringify(pane)})`);
      if(pane==='insights')await waitFor(()=>page.evaluate(`document.getElementById('pane-insights')?.getAttribute('aria-busy')==='false'&&document.querySelector('.insights-risk-key,.insights-empty')!==null`),{label:'zoomed Insights'});
      if(pane==='guide')await waitFor(()=>page.evaluate(`document.querySelector('.guide-wrap')!==null`),{label:'zoomed Guide'});
      await page.settle(2);await axe(`${theme}:200-percent:${pane}`);
      const reflow=await page.evaluate(`(()=>{const active=document.querySelector('.pane.on'),root=document.documentElement;return {documentOverflow:root.scrollWidth-root.clientWidth,activeOverflow:active?active.scrollWidth-active.clientWidth:0,activeVisible:!!active&&active.getBoundingClientRect().width>0};})()`);
      assert.equal(reflow.activeVisible,true,`${theme}:${pane} active surface is not reachable at 200%.`);
      assert.ok(reflow.documentOverflow<=2,`${theme}:${pane} causes document-level horizontal clipping at 200%: ${JSON.stringify(reflow)}`);
    }
  }
  await page.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});

  await page.setViewport({width:1280,height:860,mobile:false,scale:1});
  await page.evaluate(`__PWA6.goTab('plan');document.getElementById('tab-plan').focus()`);
  const primaryTabs=['execute','review','library','insights','guide'];
  for(const expected of primaryTabs){await pressKey('ArrowRight');assert.equal(await page.evaluate('document.activeElement.dataset.tab'),expected);await pressKey('Enter');await waitFor(()=>page.evaluate(`document.querySelector('.nav-item.on')?.dataset.tab===${JSON.stringify(expected)}`),{label:`keyboard navigation to ${expected}`});}
  await pressKey('Home');await pressKey('Enter');await waitFor(()=>page.evaluate(`document.querySelector('.nav-item.on')?.dataset.tab==='plan'`),{label:'keyboard Home navigation'});
  await pressKey('End');await pressKey('Enter');await waitFor(()=>page.evaluate(`document.querySelector('.nav-item.on')?.dataset.tab==='guide'`),{label:'keyboard End navigation'});result.checks.completePrimaryKeyboardNavigation=true;
  await page.evaluate(`__PWA6.goTab('review')`);const reviewSummary='.review-execution-details>summary';await page.evaluate(`document.querySelector(${JSON.stringify(reviewSummary)}).parentElement.open=false`);await page.evaluate(`document.querySelector(${JSON.stringify(reviewSummary)}).focus()`);await pressKey('Enter');assert.equal(await page.evaluate(`document.querySelector(${JSON.stringify(reviewSummary)}).parentElement.open`),true);await pressKey('Escape');await pressKey('Enter');assert.equal(await page.evaluate(`document.querySelector(${JSON.stringify(reviewSummary)}).parentElement.open`),false);result.checks.reviewDisclosureKeyboard=true;
  await page.evaluate(`__PWA6.goTab('insights')`);await waitFor(()=>page.evaluate(`document.querySelector('.insights-risk-key .row')!==null`),{label:'risk keyboard row'});
  const keyboard=await page.evaluate(`(()=>{const row=document.querySelector('.insights-risk-key .row');row.focus();const before=document.activeElement===row;row.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return {before,role:row.getAttribute('role'),tabindex:row.getAttribute('tabindex'),label:row.getAttribute('aria-label'),height:row.getBoundingClientRect().height};})()`);
  assert.equal(keyboard.before,true);assert.ok(keyboard.label);assert.ok(keyboard.height>=32);result.checks.riskRowsKeyboardAndGeometry=true;
  const semantics=await page.evaluate(`(()=>{const region=document.getElementById('notice-region'),notice=document.getElementById('install-notice'),announcer=document.getElementById('install-notice-announcer'),empty=document.querySelector('.review-block-empty'),breakNote=document.getElementById('break-note');return {regionRole:region.getAttribute('role'),regionLabel:region.getAttribute('aria-label'),noticeRole:notice.getAttribute('role'),labelledby:notice.getAttribute('aria-labelledby'),announcerRole:announcer.getAttribute('role'),emptyColor:empty?getComputedStyle(empty).color:'not-rendered',breakColor:getComputedStyle(breakNote).color};})()`);
  assert.deepEqual({regionRole:semantics.regionRole,regionLabel:semantics.regionLabel,noticeRole:semantics.noticeRole,labelledby:semantics.labelledby,announcerRole:semantics.announcerRole},{regionRole:'region',regionLabel:'Application notices',noticeRole:'group',labelledby:'install-notice-title',announcerRole:'status'});result.checks.installRegionAndLiveAnnouncementSeparated=true;
  const unexpected=page.events.filter(event=>!/favicon|ResizeObserver loop/i.test(event.text||''));assert.deepEqual(unexpected,[]);result.checks.noRuntimeErrors=true;
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();await server.close();}
assert.equal(result.matrix.length,48);console.log(JSON.stringify(result,null,2));
