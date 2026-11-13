import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

// An image dropped into a note is attached where it lands, a file dropped
// elsewhere never opens in a new tab, and the image opens in a full view that
// fits it to the screen, zooms, pans and closes.
const preload=`(()=>{
  localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Viewer QA',updatedAt:new Date().toISOString()}));
  (localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));
})()`;
const server=await startReleaseServer();
const browser=await launchChromium({profilePrefix:'qa-image-viewer-'});
try{
  const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().state==='primary'&&__PWA6.SessionLifecycle.status().ready`),{label:'primary ownership'});
  const result=await page.evaluate(`(async()=>{
    const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),out={};
    const until=async(test,ms=8000)=>{const start=Date.now();while(Date.now()-start<ms){const value=test();if(value)return value;await wait(16);}throw new Error('timeout');};
    d.AppData.notes.update('physics','Physics','<p>x</p>');await d.AppData.notes.flush();
    d.goTab('library');d.LibraryView.showSection('notes');await wait(200);
    [...document.querySelectorAll('[data-note-key]')].find(row=>row.dataset.noteKey==='physics').click();
    const content=await until(()=>document.querySelector('#library-notes-editor [contenteditable="true"]'));
    const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;const g=canvas.getContext('2d');g.fillStyle='#246';g.fillRect(0,0,1600,1000);
    const file=new File([await new Promise(r=>canvas.toBlob(r,'image/png'))],'chart.png',{type:'image/png'});
    const transfer=()=>{const data=new DataTransfer();data.items.add(file);return data;},rect=content.getBoundingClientRect(),at={clientX:rect.left+20,clientY:rect.top+10,bubbles:true,cancelable:true};
    const over=new DragEvent('dragover',{...at,dataTransfer:transfer()});content.dispatchEvent(over);
    const drop=new DragEvent('drop',{...at,dataTransfer:transfer()});content.dispatchEvent(drop);
    out.dropTaken=over.defaultPrevented&&drop.defaultPrevented;
    await until(()=>document.querySelector('#library-notes-editor .sd-rte-image img'));
    const outside=new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer()});document.querySelector('.library-notes-nav').dispatchEvent(outside);
    out.outsideRefused=outside.defaultPrevented&&document.querySelectorAll('#library-notes-editor .sd-rte-image').length===1;
    document.querySelector('#library-notes-editor .sd-rte-image-expand').click();
    const viewer=await until(()=>document.querySelector('.workspace-image-viewer.ready'));
    const level=()=>document.querySelector('.workspace-image-level').textContent,img=viewer.querySelector('img'),box=viewer.getBoundingClientRect(),shown=()=>img.getBoundingClientRect();
    out.fits=level()==='Fit'&&shown().width<=box.width+1&&shown().height<=box.height+1;
    document.querySelector('.workspace-image-zoom[aria-label="Zoom in"]').click();out.zoomIn=level();
    viewer.dispatchEvent(new WheelEvent('wheel',{deltaY:-300,clientX:box.left+40,clientY:box.top+40,bubbles:true,cancelable:true}));out.wheel=level();
    const before=shown().left;
    viewer.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,button:0,pointerType:'mouse',clientX:box.left+300,clientY:box.top+300,bubbles:true}));
    viewer.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,pointerType:'mouse',clientX:box.left+200,clientY:box.top+250,bubbles:true}));
    viewer.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,pointerType:'mouse',bubbles:true}));
    out.panned=Math.round(before-shown().left);
    viewer.dispatchEvent(new KeyboardEvent('keydown',{key:'0',bubbles:true}));out.refit=level();
    viewer.closest('dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    document.querySelector('.workspace-overlay-image .workspace-overlay-close')?.click();
    await until(()=>!document.querySelector('.workspace-overlay-image'));out.closed=true;
    return out;
  })()`);
  assert.equal(result.dropTaken,true,'a dropped image is taken by the editor, not the browser');
  assert.equal(result.outsideRefused,true,'a file dropped outside the editor is ignored');
  assert.equal(result.fits,true,'the full view opens fitted to the screen');
  assert.match(result.zoomIn,/^\d+%$/,'+ zooms in');
  assert.ok(parseInt(result.wheel)>parseInt(result.zoomIn),'the wheel zooms further');
  assert.equal(result.panned,100,'dragging moves the zoomed image');
  assert.equal(result.refit,'Fit','0 fits it again');
  assert.equal(result.closed,true);
  assert.deepEqual(page.events,[],'no runtime errors');
  console.log(JSON.stringify({status:'PASS',checks:['drop-attaches','outside-drop-refused','opens-fitted','zoom-buttons','wheel-zoom','drag-pan','keyboard-fit','close']},null,2));
}finally{await browser.close?.();await server.close?.();}
