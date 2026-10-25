import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';
const bundle=richTextRuntimeSource();
const browser=await launchChromium({profilePrefix:'qa-final-polish-'});let page;
try{
  page=await browser.createPage('about:blank',{viewport:{width:900,height:700,mobile:false,scale:1}});
  await page.evaluate(bundle,{returnByValue:false});
  const semantic=await page.evaluate(`(()=>{
    const para=(text,marks)=>({type:'Paragraph',content:[{type:'Text',param:text,...(marks?{marks}:{})}]});
    const cell=(type,text,marks)=>({type,marks:{SDCellWidth:50,SDCellHeight:34},content:[para(text,marks)]});
    const wrap=content=>'WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content}});
    const id='img-scan-12345678901234567890';
    const validImage=wrap([{type:'SDImage',param:{assetId:id,alt:'scan',widthPct:100}},para('tail')]);
    const malformed='WG1:{"version":1,"doc":';
    const invalidSemantic=wrap([{type:'Table',marks:{SDTableWidth:100},content:[{type:'TableRow',content:[{type:'Cell',marks:{SDCellWidth:100,SDCellHeight:34},content:[{type:'SDImage',param:{assetId:id,alt:'nested',widthPct:100}}]}]}]}]);
    const header=wrap([{type:'Table',marks:{SDTableWidth:100},content:[{type:'TableRow',content:[cell('HeaderCell','A | B'),cell('HeaderCell','C')]},{type:'TableRow',content:[cell('Cell','Bold',{Strong:null}),cell('Cell','D')]}]}]);
    const plainTable=wrap([{type:'Table',marks:{SDTableWidth:100},content:[{type:'TableRow',content:[cell('Cell','Bold',{Strong:null}),cell('Cell','A&B')]},{type:'TableRow',content:[cell('Cell','Italic',{Emphasis:null}),cell('Cell','Link',{Link:'https://example.com/'})]}]}]);
    return {
      plain:StudyDirectorRichText.scanAssetReferences('ordinary text'),
      valid:StudyDirectorRichText.scanAssetReferences(validImage),
      malformed:StudyDirectorRichText.scanAssetReferences(malformed),
      invalidSemantic:StudyDirectorRichText.scanAssetReferences(invalidSemantic),
      headerMarkdown:StudyDirectorRichText.toMarkdown(header),
      plainMarkdown:StudyDirectorRichText.toMarkdown(plainTable)
    };
  })()`);
  assert.deepEqual(semantic.plain,{trusted:true,assetIds:[]});
  assert.equal(semantic.valid.trusted,true);assert.deepEqual(semantic.valid.assetIds,['img-scan-12345678901234567890']);
  assert.equal(semantic.malformed.trusted,false,'Malformed WG1-looking text must never authorize pruning.');
  assert.equal(semantic.invalidSemantic.trusted,false,'Semantically invalid WG1 must never authorize pruning.');
  assert.match(semantic.headerMarkdown,/A \\| B/,'Header table content containing pipes must be escaped.');
  assert.match(semantic.headerMarkdown,/\*\*Bold\*\*/,'Semantic Markdown header tables should retain inline Markdown formatting.');
  assert.match(semantic.plainMarkdown,/<strong>Bold<\/strong>/,'Headerless HTML table must preserve bold semantics as HTML.');
  assert.match(semantic.plainMarkdown,/<em>Italic<\/em>/,'Headerless HTML table must preserve emphasis semantics as HTML.');
  assert.match(semantic.plainMarkdown,/<a href="https:\/\/example\.com\/">Link<\/a>/,'Headerless HTML table must preserve safe links as HTML.');
  assert.match(semantic.plainMarkdown,/A&amp;B/,'Headerless HTML table must HTML-escape cell text.');

  await page.evaluate(`(()=>{
    document.body.innerHTML='<div style="height:9000px"></div><main id="host" style="margin-top:2000px;width:700px"></main>';
    const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
    window.__blob=new Blob([bytes],{type:'image/png'});window.__gets=0;window.__created=0;window.__revoked=0;window.__live=new Set();
    const nativeCreate=URL.createObjectURL.bind(URL),nativeRevoke=URL.revokeObjectURL.bind(URL);
    URL.createObjectURL=blob=>{const url=nativeCreate(blob);__created++;__live.add(url);return url};
    URL.revokeObjectURL=url=>{if(__live.delete(url))__revoked++;return nativeRevoke(url)};
    window.__stats=()=>({gets:__gets,created:__created,revoked:__revoked,live:__live.size});
    window.__assets={get:async()=>{__gets++;return __blob},put:async()=>{},remove:async()=>{}};
    const images=Array.from({length:20},(_,i)=>({type:'SDImage',param:{assetId:('img-lazy-'+i+'-').padEnd(24,'x'),alt:'Image '+i,widthPct:100}}));images.push({type:'Paragraph',content:[{type:'Text',param:'tail'}]});
    window.__many='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:images}});
    window.__one='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content:[images[0],images.at(-1)]}});
    StudyDirectorRichText.renderRichText({container:host,value:__many,label:'Lazy read-only images',assets:__assets});
  })()`);
  await page.settle();
  const offscreen=await page.evaluate(`__stats()`);
  assert.equal(offscreen.gets,0,'Off-screen read-only images must not hit IndexedDB eagerly.');
  await page.evaluate(`host.scrollIntoView({block:'start'})`);
  await waitFor(()=>page.evaluate(`__gets>0`),{timeout:5000,label:'visible read-only image hydration'});
  await waitFor(()=>page.evaluate(`__live.size===0&&__created>0`),{timeout:5000,label:'read-only URL release after decode/load'});
  const visible=await page.evaluate(`__stats()`);
  assert.ok(visible.gets>0&&visible.gets<=20,'Visibility-aware hydration should read only observed images.');
  assert.equal(visible.live,0,'Decoded read-only images must not retain Blob URLs.');

  const cycles=12;
  for(let i=0;i<cycles;i++){
    const before=await page.evaluate(`__created`);
    await page.evaluate(`StudyDirectorRichText.renderRichText({container:host,value:__one,label:'Lifecycle '+${i},assets:__assets})`);
    await waitFor(()=>page.evaluate(`__created>${before}`),{timeout:5000,label:`read-only URL creation ${i}`});
    await page.evaluate(`host.replaceChildren()`);
    await waitFor(()=>page.evaluate(`__live.size===0`),{timeout:5000,label:`read-only URL cleanup ${i}`});
  }
  const afterCycles=await page.evaluate(`__stats()`);
  assert.equal(afterCycles.live,0,'Repeated render/remove cycles must leave zero live Blob URLs.');

  await page.evaluate(`(()=>{
    window.__pending=[];window.__assets.get=async()=>{__gets++;return await new Promise(resolve=>__pending.push(resolve))};
    StudyDirectorRichText.renderRichText({container:host,value:__one,label:'Deferred lifecycle',assets:__assets});
  })()`);
  await waitFor(()=>page.evaluate(`__pending.length>0`),{timeout:5000,label:'deferred read-only asset read'});
  const createdBeforeDeferred=await page.evaluate(`__created`);
  await page.evaluate(`host.replaceChildren();for(const resolve of __pending.splice(0))resolve(__blob)`);
  await page.settle();
  const deferred=await page.evaluate(`__stats()`);
  assert.equal(deferred.created,createdBeforeDeferred,'A detached read-only render must not create Blob URLs after an outstanding asset read resolves.');
  assert.equal(deferred.live,0,'Detached deferred hydration must leave zero live Blob URLs.');
  assert.deepEqual(page.events,[],'QA_FIXTURE final-polish browser test produced runtime errors.');
  console.log(JSON.stringify({status:'PASS',suite:'readonly-maintenance',semantic,offscreen,visible,afterCycles,deferred},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();}
