import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root,startReleaseServer,launchChromium,waitForStudyDirector,waitFor,settleMotion} from '../../helpers/browser-harness.mjs';

const axeSource=fs.readFileSync(path.join(root,'node_modules','axe-core','axe.min.js'),'utf8');
const preload=`(()=>{const d=new Date();localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Presentation Accessibility QA',updatedAt:d.toISOString()}));localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]}));})();`;
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'study-director-p511b-a11y-'});let page=null;
const result={status:'PASS',release:server.manifest.release,matrix:[],checks:{}};

async function axe(label){
  await settleMotion(page);
  const violations=await page.evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}).then(report=>report.violations.filter(row=>row.impact==='serious'||row.impact==='critical').map(row=>({id:row.id,impact:row.impact,nodes:row.nodes.map(node=>({target:node.target,summary:node.failureSummary}))})))`);
  assert.deepEqual(violations,[],`${label}: ${JSON.stringify(violations)}`);
  result.matrix.push(label);
}
async function selectAppearance(presentation,theme){
  await page.click(`.theme-btn[data-theme-id="${theme}"]`);
  await waitFor(()=>page.evaluate(`document.documentElement.dataset.theme===${JSON.stringify(theme)}`),{label:`theme ${theme}`});
  await page.click(`.presentation-btn[data-presentation-id="${presentation}"]`);
  await waitFor(()=>page.evaluate(`document.documentElement.dataset.presentation===${JSON.stringify(presentation)}`),{label:`presentation ${presentation}`});
  await page.settle(3);
  const controls=await page.evaluate(`(()=>{const root=document.documentElement,theme=root.dataset.theme,presentation=root.dataset.presentation,themeButton=document.querySelector('.theme-btn[data-theme-id="'+theme+'"]'),presentationButton=document.querySelector('.presentation-btn[data-presentation-id="'+presentation+'"]'),meta=document.querySelector('meta[name="theme-color"]');return {theme,presentation,themePressed:themeButton?.getAttribute('aria-pressed'),presentationPressed:presentationButton?.getAttribute('aria-pressed'),focus:document.activeElement===presentationButton,meta:meta?.getAttribute('content')||'',computed:getComputedStyle(root).getPropertyValue('--sd-meta-theme-color').trim()};})()`);
  assert.deepEqual({theme:controls.theme,presentation:controls.presentation,themePressed:controls.themePressed,presentationPressed:controls.presentationPressed,focus:controls.focus},{theme,presentation,themePressed:'true',presentationPressed:'true',focus:true});
  assert.equal(controls.meta,controls.computed,`${presentation}/${theme} browser chrome follows presentation tokens`);
}
async function readyPane(pane){
  await page.evaluate(`__PWA6.goTab(${JSON.stringify(pane)})`);
  if(pane==='insights')await waitFor(()=>page.evaluate(`document.getElementById('pane-insights')?.getAttribute('aria-busy')==='false'&&document.querySelector('.insights-risk-key,.insights-empty')!==null`),{label:'presentation accessibility Insights'});
  if(pane==='guide')await waitFor(()=>page.evaluate(`document.querySelector('.guide-wrap')!==null`),{label:'presentation accessibility Guide'});
  await page.settle(2);
}

try{
  page=await browser.createPage(server.url('deployment','instrumented.html'),{preload,viewport:{width:1280,height:860,mobile:false,scale:1}});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'presentation accessibility ownership'});
  await page.evaluate(axeSource,{returnByValue:false});
  await page.evaluate(`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=new Date(),m=now.getHours()*60+now.getMinutes()-2,fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0');document.getElementById('plan-input').value=[fmt(m)+' | 30 | Presentation Cardiology | work | Medicine > Cardiology | pages | 20',fmt(m+30)+' | 15 | Presentation Questions | work | Assessment | questions | 15'].join('\\n');d.applySchedule({skipNotify:true});d.goTab('execute');await wait(80);const note=document.getElementById('pn-extra');note.value='Presentation accessibility evidence';d.commitTaskNoteEditor(note,note.value);await d.AppData.notes.flush();d.goTab('review');await wait(80);const reflection=document.getElementById('daily-reflection');reflection.value='Presentation accessibility reflection.';d.setStudyQuality(4,{save:false});d.ReviewEditor.saveReview({strict:true});await d.ReviewEditor.flushPending();await d.ReviewEditor.settled();await d.saveDayRecord();d.goTab('plan');})()`);

  const panes=['plan','execute','review','library','insights','guide'];
  for(const presentation of ['director-current','glass','aurora']){
    for(const theme of ['dark','light']){
      await selectAppearance(presentation,theme);
      for(const pane of panes){await readyPane(pane);await axe(`${presentation}:${theme}:desktop:${pane}`);}
    }
  }
  result.checks.desktopMatrix=true;

  await page.setViewport({width:390,height:844,mobile:true,scale:2});
  for(const presentation of ['director-current','glass','aurora']){
    for(const theme of ['dark','light']){
      await selectAppearance(presentation,theme);
      await readyPane('plan');
      const sizes=await page.evaluate(`(()=>{const theme=document.querySelector('.theme-btn[aria-pressed="true"]')?.getBoundingClientRect(),presentation=document.querySelector('.presentation-btn[aria-pressed="true"]')?.getBoundingClientRect(),trigger=document.getElementById('display-tools-trigger')?.getBoundingClientRect();return {theme:{w:theme?.width||0,h:theme?.height||0},presentation:{w:presentation?.width||0,h:presentation?.height||0},trigger:{w:trigger?.width||0,h:trigger?.height||0}};})()`);
      for(const [name,rect] of Object.entries(sizes))assert.ok(rect.w>=44&&rect.h>=44,`${presentation}/${theme} ${name} touch target is ${JSON.stringify(rect)}`);
      await axe(`${presentation}:${theme}:mobile:plan`);
    }
  }
  result.checks.mobileControls=true;
  assert.equal(result.matrix.length,42);
  const unexpected=page.events.filter(event=>!/favicon|ResizeObserver loop/i.test(event.text||''));
  assert.deepEqual(unexpected,[]);
  result.checks.noRuntimeErrors=true;
}finally{
  if(page)await browser.closePage(page).catch(()=>{});
  await browser.close();
  await server.close();
}
console.log(JSON.stringify(result,null,2));
