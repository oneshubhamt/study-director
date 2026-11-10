import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const internal=readRuntimeSource('source/core/internal.ts');
const overlayModule=readRuntimeSource('source/core/workspace-overlay.ts');
const bundle=richTextRuntimeSource();
const css=fs.readFileSync('source/styles/core.css','utf8');
const browser=await launchChromium({profilePrefix:'qa-overlay-'});let page;
try{
  page=await browser.createPage('about:blank',{viewport:{width:1000,height:700,mobile:false,scale:1}});
  await page.evaluate(`(()=>{document.head.innerHTML=${JSON.stringify('<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>'+css+'</style>')};document.body.innerHTML='<main id="page" style="padding:24px"><textarea id="f" style="width:100%;height:320px;font-size:16px;line-height:1.55;padding:18px 20px"></textarea></main>'})()`);
  await page.evaluate(internal,{returnByValue:false});
  await page.evaluate(overlayModule,{returnByValue:false});
  await page.evaluate(bundle,{returnByValue:false});
  await page.evaluate(`(async()=>{const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')],mod=registry.require('workspace-overlay',1);window.overlay=mod.createController(Object.freeze({ports:Object.freeze({environment:Object.freeze({document}),history:Object.freeze({opened:()=>true,requestClose:()=>false,closed:()=>true})})}));window.port=Object.freeze({open:options=>overlay.open(options)});window.assets={get:async()=>null,put:async()=>{},remove:async()=>{}};f.value='A '.repeat(2500);window.m=await StudyDirectorRichText.mountRichTextEditor({field:f,label:'Focus note',initialValue:f.value,maxWords:10000,maxBytes:917504,assets,workspaceOverlay:port});const editor=document.querySelector('#f + .sd-rte .sd-rte-editor'),text=editor.querySelector('p').firstChild,r=document.createRange(),s=getSelection();editor.focus();r.setStart(text,0);r.setEnd(text,3);s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'));editor.closest('.sd-rte-wordgard').querySelector('wg-scroller').scrollTop=120;window.before={selection:s.toString(),scroll:editor.closest('.sd-rte-wordgard').querySelector('wg-scroller').scrollTop};})()`);await page.settle();
  await page.click('#f + .sd-rte .sd-rte-focus-trigger');await page.settle();
  const desktop=await page.evaluate(`(()=>{const d=document.querySelector('dialog.workspace-overlay'),r=d.getBoundingClientRect(),close=d.querySelector('.workspace-overlay-close'),beforeCancel=d.open,ev=new Event('cancel',{cancelable:true});d.dispatchEvent(ev);return {openBefore:beforeCancel,openAfter:d.open,cancelPrevented:ev.defaultPrevented,x:r.x,y:r.y,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight,close:{w:close.getBoundingClientRect().width,h:close.getBoundingClientRect().height},focusInside:d.contains(document.activeElement),wrapperInside:!!d.querySelector('.sd-rte')}})()`);
  assert.equal(desktop.openBefore,true);assert.equal(desktop.openAfter,true);assert.equal(desktop.cancelPrevented,true);assert.ok(desktop.x>0&&desktop.y>0,JSON.stringify(desktop));assert.ok(desktop.w<desktop.vw&&desktop.h<desktop.vh,JSON.stringify(desktop));assert.equal(desktop.wrapperInside,true);assert.equal(desktop.focusInside,true);
  await page.click('.workspace-overlay-close');await waitFor(()=>page.evaluate(`!document.querySelector('dialog.workspace-overlay')`),{label:'workspace overlay close'});
  const restored=await page.evaluate(`(()=>{const editor=document.querySelector('#f + .sd-rte .sd-rte-editor'),wg=editor.closest('.sd-rte-wordgard'),scroller=wg.querySelector('wg-scroller'),s=getSelection();return {dialog:!!document.querySelector('dialog.workspace-overlay'),wrapper:!!document.querySelector('#f + .sd-rte'),focus:editor.contains(document.activeElement)||editor===document.activeElement,selection:s.toString(),scroll:scroller.scrollTop}})()`);
  assert.equal(restored.dialog,false);assert.equal(restored.wrapper,true);assert.equal(restored.focus,true);assert.ok(restored.scroll>=100,JSON.stringify(restored));

  await page.setViewport({width:390,height:700,mobile:true,scale:3});await page.settle();await page.tap('#f + .sd-rte .sd-rte-focus-trigger');await page.settle();
  const mobile=await page.evaluate(`(()=>{const d=document.querySelector('dialog.workspace-overlay'),r=d.getBoundingClientRect(),c=d.querySelector('.workspace-overlay-close').getBoundingClientRect(),shell=d.querySelector('.workspace-overlay-shell');return {x:r.x,y:r.y,right:innerWidth-r.right,bottom:innerHeight-r.bottom,w:r.width,h:r.height,close:{w:c.width,h:c.height},scrollWidth:shell.scrollWidth,clientWidth:shell.clientWidth}})()`);
  assert.ok(Math.abs(mobile.x)<=1&&Math.abs(mobile.y)<=1&&Math.abs(mobile.right)<=1&&Math.abs(mobile.bottom)<=1,JSON.stringify(mobile));assert.equal(Math.round(mobile.w),390,JSON.stringify(mobile));assert.equal(Math.round(mobile.h),700,JSON.stringify(mobile));assert.ok(mobile.close.w>=44&&mobile.close.h>=44,JSON.stringify(mobile));assert.ok(mobile.scrollWidth<=mobile.clientWidth+1,JSON.stringify(mobile));
  await page.tap('.workspace-overlay-close');await waitFor(()=>page.evaluate(`!document.querySelector('dialog.workspace-overlay')`),{label:'mobile workspace overlay close'});

  const surfaces=['reflection','note','execute-note'];
  const viewports=[
    {label:'laptop',width:1440,height:768,mobile:false,scale:1},
    {label:'tablet',width:1024,height:1366,mobile:true,scale:2},
    {label:'phone-portrait',width:390,height:844,mobile:true,scale:3},
    {label:'phone-landscape',width:844,height:390,mobile:true,scale:3}
  ];
  const focusSizing=[];
  for(const viewport of viewports){
    await page.setViewport(viewport);await page.settle();
    for(const surface of surfaces){
      await page.evaluate(`(async()=>{await window.m?.destroy?.();const host=document.querySelector('#page');host.style.cssText='box-sizing:border-box;width:100%;height:100dvh;padding:24px';host.innerHTML='<textarea id=\"f\" style=\"box-sizing:border-box;width:100%;height:320px;font-size:16px;line-height:1.55;padding:18px 20px\"></textarea>';f.value='Focus sizing '+${JSON.stringify('x '.repeat(200))};window.m=await StudyDirectorRichText.mountRichTextEditor({field:f,label:'Focus sizing',initialValue:f.value,maxWords:10000,maxBytes:917504,assets,workspaceOverlay:port,surface:${JSON.stringify(surface)}})})()`);await page.settle();
      await page.click('#f + .sd-rte .sd-rte-focus-trigger');await page.settle();
      const state=await page.evaluate(`(()=>{const body=document.querySelector('.sd-rte-focus-body'),wrapper=body?.querySelector(':scope > .sd-rte'),host=wrapper?.querySelector('.sd-rte-editor-host'),scroller=wrapper?.querySelector('wg-scroller'),toolbar=wrapper?.querySelector('.sd-rte-toolbar')||document.querySelector('.sd-rte-focus-header .sd-rte-toolbar'),status=wrapper?.querySelector('.sd-rte-status');if(!body||!wrapper||!host||!scroller||!toolbar||!status)throw new Error('Focus sizing nodes are unavailable.');const R=e=>e.getBoundingClientRect(),br=R(body),wr=R(wrapper),hr=R(host),sr=R(scroller),tr=R(toolbar),str=R(status),toolbarInBody=body.contains(toolbar),remaining=wr.height-hr.height-(toolbarInBody?tr.height:0)-str.height;return {body:br.height,wrapper:wr.height,host:hr.height,scroller:sr.height,toolbar:tr.height,status:str.height,toolbarInBody,remaining,pageOverflow:document.documentElement.scrollWidth-innerWidth};})()`);
      focusSizing.push({viewport:viewport.label,surface,...state});
      assert.ok(Math.abs(state.wrapper-state.body)<=2,`${viewport.label}/${surface}: focus wrapper does not fill overlay body: ${JSON.stringify(state)}`);
      assert.ok(Math.abs(state.scroller-state.host)<=2,`${viewport.label}/${surface}: editor scroller does not fill host: ${JSON.stringify(state)}`);
      assert.ok(state.host>=state.body*.72,`${viewport.label}/${surface}: editor host leaves excessive unused focus space: ${JSON.stringify(state)}`);
      assert.ok(Math.abs(state.remaining)<=3,`${viewport.label}/${surface}: focus-mode grid has unexplained vertical gap: ${JSON.stringify(state)}`);
      assert.ok(state.pageOverflow<=1,`${viewport.label}/${surface}: focus mode creates page-level horizontal overflow: ${JSON.stringify(state)}`);
      await page.click('.workspace-overlay-close');await waitFor(()=>page.evaluate(`!document.querySelector('dialog.workspace-overlay')`),{label:`${viewport.label}/${surface} focus close`});
    }
  }
  assert.deepEqual(page.events,[]);
  console.log(JSON.stringify({status:'PASS',suite:'workspace-overlay',checks:['desktop modal perimeter','explicit-only close','live editor/scroll restore','390px full-viewport focus mode','44px close target','reflection/ongoing/timer focus surfaces fill available height on laptop/tablet/phone portrait/phone landscape'],focusSizing},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();}
