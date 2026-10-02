import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium,waitFor} from '../../helpers/browser-harness.mjs';

const bundle=fs.readFileSync('source/external/rich-text.js','utf8');
const browser=await launchChromium({profilePrefix:'qa-image-memory-',args:['--js-flags=--expose-gc']});let page;
try{
  page=await browser.createPage('about:blank',{viewport:{width:1280,height:900,mobile:false,scale:1}});
  await page.send('HeapProfiler.enable');
  await page.evaluate(bundle,{returnByValue:false});
  const setup=await page.evaluate(`(async()=>{
    document.body.innerHTML='<main style="width:960px;margin:20px"></main>';
    const main=document.querySelector('main'),assetMap=new Map();window.assetMap=assetMap;
    let created=0,revoked=0;const live=new Set(),nativeCreate=URL.createObjectURL.bind(URL),nativeRevoke=URL.revokeObjectURL.bind(URL);
    URL.createObjectURL=blob=>{const url=nativeCreate(blob);created++;live.add(url);return url};
    URL.revokeObjectURL=url=>{if(live.delete(url))revoked++;return nativeRevoke(url)};
    window.urlStats=()=>({created,revoked,live:live.size});
    const assets={get:async id=>assetMap.get(id)||null,put:async(id,blob)=>assetMap.set(id,blob),remove:async id=>assetMap.delete(id)};window.assets=assets;
    const seed=document.createElement('textarea');seed.id='seed';main.append(seed);
    const seedMount=await StudyDirectorRichText.mountRichTextEditor({field:seed,label:'Seed',initialValue:'',maxWords:10000,maxBytes:917504,assets});
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;canvas.getContext('2d').fillRect(0,0,1200,900);
    const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.72)),dt=new DataTransfer();dt.items.add(new File([blob],'seed.jpg',{type:'image/jpeg'}));
    document.querySelector('#seed + .sd-rte .sd-rte-editor').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));
    while(!seed.value.includes('SDImage'))await new Promise(r=>setTimeout(r,20));
    const parsed=JSON.parse(seed.value.slice(4)),image=parsed.doc.content.find(n=>n.type==='SDImage'),paragraph=parsed.doc.content.find(n=>n.type==='Paragraph')||{type:'Paragraph'};
    const canonicalBlob=[...assetMap.values()][0];await seedMount.destroy();seed.remove();
    window.mounts=[];
    for(let editorIndex=0;editorIndex<3;editorIndex++){
      const content=[];
      for(let i=0;i<20;i++){
        const id=('img-mem-'+editorIndex+'-'+i+'-').padEnd(24,'x');assetMap.set(id,canonicalBlob);
        content.push({...image,param:{...image.param,assetId:id}});
      }
      content.push(paragraph);
      const field=document.createElement('textarea');field.id='mem'+editorIndex;field.value='WG1:'+JSON.stringify({version:1,doc:{...parsed.doc,content}});main.append(field);
      const mount=await StudyDirectorRichText.mountRichTextEditor({field,label:'Memory '+editorIndex,initialValue:field.value,maxWords:10000,maxBytes:917504,assets});mounts.push(mount);
    }
    return {editors:document.querySelectorAll('.sd-rte-wordgard').length,figures:document.querySelectorAll('.sd-rte-image').length,images:document.querySelectorAll('.sd-rte-image img').length,urls:urlStats()};
  })()`);
  assert.equal(setup.editors,3);
  assert.equal(setup.figures,60,'three image-heavy editors should expose all 60 image nodes');
  await waitFor(()=>page.evaluate(`document.querySelectorAll('.sd-rte-image img').length>=60&&urlStats().live>=60`),{timeout:10000,label:'image-heavy object URL hydration'});
  const peakUrls=await page.evaluate(`urlStats()`);
  const peakDom=await page.send('Memory.getDOMCounters');
  const peakHeap=await page.send('Runtime.getHeapUsage');
  assert.ok(peakUrls.live>=60,`expected >=60 live image URLs, got ${peakUrls.live}`);

  const released=await page.evaluate(`(async()=>{for(const mount of mounts)await mount.destroy();if(typeof gc==='function')gc();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {urls:urlStats(),editors:document.querySelectorAll('.sd-rte-wordgard').length,images:document.querySelectorAll('.sd-rte-image img').length,wrappers:document.querySelectorAll('.sd-rte').length}})()`);
  await page.send('HeapProfiler.collectGarbage');
  const finalDom=await page.send('Memory.getDOMCounters');
  const finalHeap=await page.send('Runtime.getHeapUsage');
  assert.equal(released.urls.live,0,'destroying image-heavy editors must revoke every active object URL');
  assert.equal(released.editors,0,'destroying image-heavy editors must release Wordgard editor DOM');
  assert.equal(released.images,0,'destroying image-heavy editors must release image DOM');
  assert.ok(released.urls.revoked>=peakUrls.live,'object URL revocation count must cover hydrated image URLs');
  assert.ok(finalDom.nodes<peakDom.nodes,`DOM nodes did not decrease after teardown (${peakDom.nodes} -> ${finalDom.nodes})`);
  assert.deepEqual(page.events,[],'QA_FIXTURE image-memory test produced runtime errors');
  console.log(JSON.stringify({status:'PASS',suite:'image-memory',editors:3,images:60,objectUrls:{peak:peakUrls.live,final:released.urls.live,created:released.urls.created,revoked:released.urls.revoked},domNodes:{peak:peakDom.nodes,final:finalDom.nodes},jsHeapBytes:{peak:peakHeap.usedSize,final:finalHeap.usedSize}},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();}
