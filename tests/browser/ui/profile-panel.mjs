import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor,settleMotion} from '../../helpers/browser-harness.mjs';

// The profile panel (docs/areas/status-indicator.md, panel) on a laptop and a phone:
// Done stays in view however long the panel is; Recent shows the three newest
// and Show all lists the rest; a live pop-up's Recent row opens what its
// button opens; the name renames in place (Enter saves, Escape keeps it and
// leaves the panel open).
const preload=`(()=>{localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'QA',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]}));})();`;
// Six closed pop-ups, then one that stays on screen with a button that opens something.
const seed=`(async()=>{const n=__PWA6.NoticeCoordinator,wait=ms=>new Promise(r=>setTimeout(r,ms));window.__opened=[];
  n.setPaused('qa',true);
  for(let i=1;i<=6;i++)n.notify({key:'qa-'+i,kind:'success',duration:12000,title:'Result '+i,message:'Done.'});
  await wait(200);n.dismissAll();await wait(200);
  n.notify({source:'sync',key:'qa-review',kind:'warning',tier:'news',title:'Needs review',message:'Google Drive has changes that need your review.',action:{label:'Review',opens:true,run:()=>window.__opened.push('review')}});
  await wait(200);})()`;
const panel=`(()=>{const dialog=document.getElementById('profile-dialog'),done=dialog.querySelector('[data-action="close-profile"]').getBoundingClientRect(),body=dialog.querySelector('.profile-body');
  return {open:dialog.open,doneInView:done.top>=0&&done.bottom<=innerHeight,bodyScrolls:body.scrollHeight>body.clientHeight,
    rows:[...document.querySelectorAll('#profile-recent-list .profile-recent-item')].map(row=>row.querySelector('.profile-recent-title').textContent),
    more:document.getElementById('profile-recent-more').hidden?'':document.getElementById('profile-recent-more').textContent};})()`;
const name=`({heading:document.querySelector('#profile-name-button .profile-name-text').textContent,editing:!document.getElementById('profile-name-input').hidden,focused:document.activeElement?.id||'',tag:document.querySelector('#profile-tag .profile-tag-name')?.textContent||''})`;
const key=async(page,keyName,code,windowsVirtualKeyCode)=>{for(const type of ['keyDown','keyUp'])await page.send('Input.dispatchKeyEvent',{type,key:keyName,code,windowsVirtualKeyCode});};
const server=await startReleaseServer();let browser=null;
const checks={};
try{
  for(const [device,viewport,opener] of [['laptop',{width:1280,height:800,mobile:false,scale:1},'#profile-tag'],['phone',{width:390,height:844,mobile:true,scale:2},'#profile-badge']]){
    browser=await launchChromium({profilePrefix:'sd-profile-panel-'+device+'-'});
    const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload,viewport});
    await waitForStudyDirector(page,{instrumented:true});
    await page.evaluate(seed);
    const open=async()=>{await page.click(opener);await waitFor(()=>page.evaluate(`document.getElementById('profile-dialog').open`),{label:`${device}: profile panel open`});await settleMotion(page);};
    await open();

    // Done stays in view; the middle scrolls.
    let state=await page.evaluate(panel);
    assert.equal(state.doneInView,true,`${device}: Done is in view`);assert.equal(state.bodyScrolls,true,`${device}: the middle scrolls`);
    await page.evaluate(`document.querySelector('#profile-dialog .profile-body').scrollTop=1e6`);await page.settle(2);
    assert.equal((await page.evaluate(panel)).doneInView,true,`${device}: Done is in view when scrolled`);

    // Recent: the three newest, then Show all and Show fewer.
    assert.deepEqual(state.rows,['Needs review','Result 6','Result 5']);assert.equal(state.more,'Show all (7)');
    await page.click('#profile-recent-more');await page.settle(2);
    state=await page.evaluate(panel);assert.equal(state.rows.length,7);assert.equal(state.more,'Show fewer');
    assert.equal(await page.evaluate(`document.getElementById('profile-recent-more').getAttribute('aria-expanded')`),'true');
    await page.click('#profile-recent-more');await page.settle(2);
    assert.equal((await page.evaluate(panel)).rows.length,3);
    checks[`${device}FrameAndRecent`]=true;

    if(device==='laptop'){
      // A live pop-up's row opens what its button opens, from anywhere on the row.
      assert.equal(await page.evaluate(`document.querySelector('#profile-recent-list .profile-recent-item').dataset.opens`),'true');
      await page.click('#profile-recent-list .profile-recent-item .profile-recent-message');
      await waitFor(()=>page.evaluate(`!document.getElementById('profile-dialog').open`),{label:'the panel closes for Review'});
      assert.deepEqual(await page.evaluate(`window.__opened`),['review']);
      await waitFor(()=>page.evaluate(`![...document.querySelectorAll('#sd-toast-region .interaction-toast:not(.leaving)')].some(card=>card.textContent.includes('Needs review'))`),{label:'and the pop-up closes',timeout:4000});
      checks.recentRowOpens=true;

      // The name renames in place: Enter saves; Escape keeps it and the panel stays open.
      await open();
      await page.click('#profile-name-button');await page.settle(2);
      let current=await page.evaluate(name);assert.equal(current.editing,true);assert.equal(current.focused,'profile-name-input');
      await page.send('Input.insertText',{text:'Asha'});await key(page,'Enter','Enter',13);await page.settle(3);
      current=await page.evaluate(name);
      assert.deepEqual([current.heading,current.editing,current.focused],['Asha',false,'profile-name-button'],'Enter saves the new name');
      assert.equal(current.tag,'Asha','the sidebar shows the new name');
      await page.click('#profile-name-button');await page.settle(2);
      await page.send('Input.insertText',{text:'Zed'});await key(page,'Escape','Escape',27);await page.settle(3);
      current=await page.evaluate(name);
      assert.deepEqual([current.heading,current.editing],['Asha',false],'Escape keeps the name');
      assert.equal(await page.evaluate(`document.getElementById('profile-dialog').open`),true,'Escape while renaming leaves the panel open');
      await page.click('[data-action="close-profile"]');
      await page.navigate(server.url('deployment','instrumented.html'));await waitForStudyDirector(page,{instrumented:true});
      assert.equal(await page.evaluate(`document.querySelector('#profile-tag .profile-tag-name')?.textContent`),'Asha','the name is kept after a reload');
      checks.renameInPlace=true;
    }
    assert.deepEqual(page.events.filter(event=>!/favicon|ResizeObserver loop/iu.test(event.text||'')),[]);
    await browser.closePage(page);await browser.close();browser=null;
  }
}finally{if(browser)await browser.close();await server.close();}
console.log(JSON.stringify({status:'PASS',suite:'profile-panel',checks}));
