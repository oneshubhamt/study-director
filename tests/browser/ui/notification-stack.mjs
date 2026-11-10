import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor,settleMotion} from '../../helpers/browser-harness.mjs';

// The notification stack in the real app (docs/areas/notifications.md, stack), on
// a laptop and a phone: pinned cards, the front card with two peeking behind
// it, "+N more"; expanding into one scrolling column (clocks stop); Escape and
// a click outside fold it; a card's button and × close it; Clear all keeps the
// critical card; the Connect card counts; a swipe closes a card on a phone;
// Recent lists the day's pop-ups, survives a reload and drives the badge.
const preload=`(()=>{localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'QA',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]}));})();`;
const stack=`(()=>{const region=document.getElementById('sd-toast-region'),cards=[...region.children].filter(node=>node.matches('.interaction-toast:not(.leaving),[data-toast-card]:not([hidden])'));
  return {mode:region.dataset.stack,cards:cards.map(card=>({title:card.querySelector('.interaction-toast-title,.drive-connect-title')?.textContent||'',place:card.dataset.stackPlace,shown:card.checkVisibility()})),
    more:document.querySelector('.sd-toast-more')?.checkVisibility()?document.querySelector('.sd-toast-more').textContent:'',clear:!!document.querySelector('.sd-toast-clear')?.checkVisibility(),backdrop:!!region.querySelector('.sd-toast-backdrop')};})()`;
// Google's sign-in script as far as Study Director uses it, where the person
// closes Google's window: the Connect card stays with the error. Nothing
// reaches the real Google.
const closedSignIn=`window.google={accounts:{oauth2:{hasGrantedAllScopes(){return false;},initTokenClient(config){return {requestAccessToken(){setTimeout(()=>config.error_callback({type:'popup_closed'}),0);}};},revoke(token,done){done&&done({});}}}};`;
async function standInForGoogle(page){
  page.on('Fetch.requestPaused',({requestId})=>page.send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from(closedSignIn).toString('base64')}).catch(()=>{}));
  await page.send('Fetch.enable',{patterns:[{urlPattern:'https://accounts.google.com/*'}]});
}
const titles=state=>state.cards.map(card=>card.title);
const places=state=>Object.fromEntries(state.cards.map(card=>[card.title,card.place]));
const seed=`(()=>{const n=__PWA6.NoticeCoordinator;window.__acted=[];
  n.notify({key:'saved',kind:'success',duration:12000,title:'Saved',message:'Today was saved to Library.'});
  n.notify({source:'sync',key:'kept',kind:'warning',tier:'news',title:'Kept for review',message:'One version was kept where two devices changed the same thing.',action:{label:'Review',run:()=>window.__acted.push('review')}});
  n.emit({source:'google-drive',id:'permission',severity:'warning',foreground:false,surface:'toast',title:'Google Drive backup',message:'Google Drive sign-in expired.',action:{label:'Reconnect',run:()=>window.__acted.push('reconnect')}});
  n.notify({key:'copied',duration:12000,title:'Copied',message:'The report is on the clipboard.'});
  n.notify({key:'export',kind:'success',duration:12000,title:'Export ready',message:'3 notes exported.'});})()`;
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'sd-notification-stack-'});
const checks={};
try{
  { // Laptop.
    const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload,viewport:{width:1280,height:800,mobile:false,scale:1}});
    await standInForGoogle(page);
    await waitForStudyDirector(page,{instrumented:true});
    // Synthetic DOM events may originate at a text node or Document. Delegated
    // navigation and toast gestures must ignore them without throwing.
    await page.evaluate(`(()=>{const region=document.getElementById('sd-toast-region'),text=document.createTextNode('');region.append(text);
      text.dispatchEvent(new MouseEvent('click',{bubbles:true}));text.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch'}));
      for(const type of ['click','change','input','blur','keydown'])document.dispatchEvent(new Event(type,{bubbles:true}));text.remove();})()`);
    checks.nonElementEvents=true;
    // The page's own clocks would close results mid-test; hold them as an expanded stack does.
    await page.evaluate(`__PWA6.NoticeCoordinator.setPaused('qa',true)`);
    await page.evaluate(seed);await page.settle(4);await settleMotion(page);
    const escape=async()=>{await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});};
    let state=await page.evaluate(stack);
    assert.equal(state.mode,'collapsed');
    assert.deepEqual(titles(state),['Google Drive backup','Export ready','Copied','Kept for review','Saved'],'pinned first, then newest first');
    assert.deepEqual(places(state),{'Google Drive backup':'full','Export ready':'front','Copied':'behind-1','Kept for review':'behind-2','Saved':'hidden'});
    assert.equal(state.more,'+3 more');assert.equal(state.clear,true);
    const geometry=await page.evaluate(`(()=>{const rect=title=>[...document.querySelectorAll('#sd-toast-region .interaction-toast')].find(card=>card.textContent.includes(title)).getBoundingClientRect();
      const front=rect('Export ready'),one=rect('Copied'),two=rect('Kept for review');return {sameColumn:Math.abs(front.left+front.width/2-(one.left+one.width/2))<1,peek1:Math.round(one.bottom-front.bottom),peek2:Math.round(two.bottom-front.bottom),narrower:one.width<front.width&&two.width<one.width};})()`);
    assert.deepEqual(geometry,{sameColumn:true,peek1:8,peek2:16,narrower:true},'two cards peek below the front one');
    checks.collapsed=true;

    // Expand with "+3 more": one column, all cards, clocks stopped.
    await page.evaluate(`__PWA6.NoticeCoordinator.setPaused('qa',false)`);
    await page.click('.sd-toast-more');await page.settle(4);
    state=await page.evaluate(stack);
    assert.equal(state.mode,'expanded');assert.ok(state.cards.every(card=>card.place==='open'&&card.shown));assert.equal(state.more,'Show less');assert.equal(state.backdrop,true);
    await page.evaluate(`__PWA6.NoticeCoordinator.notify({key:'short',duration:1800,title:'Short'})`);await new Promise(resolve=>setTimeout(resolve,2600));
    assert.ok(titles(await page.evaluate(stack)).includes('Short'),'an expanded stack stops every clock');
    await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await page.settle(2);assert.equal((await page.evaluate(stack)).mode,'collapsed','Escape folds the stack');
    await waitFor(async()=>!titles(await page.evaluate(stack)).includes('Short'),{label:'the clock runs again once folded',timeout:5000});
    await page.evaluate(`__PWA6.NoticeCoordinator.setPaused('qa',true)`);
    await page.click('.sd-toast-more');await page.settle(3);
    await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:400,y:420,button:'left',buttons:1,clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:400,y:420,button:'left',buttons:0,clickCount:1});
    await page.settle(2);assert.equal((await page.evaluate(stack)).mode,'collapsed','a click outside folds the stack');
    checks.expandFold=true;

    // A card's own button closes it; so does ×.
    await page.click('#sd-toast-region .interaction-toast[data-tier="blocking"] .interaction-action');await page.settle(3);
    assert.deepEqual(await page.evaluate(`window.__acted`),['reconnect']);assert.ok(!titles(await page.evaluate(stack)).includes('Google Drive backup'),'pressing Reconnect closes its card');
    await page.click('#sd-toast-region [data-stack-place="front"]:not(.leaving) .interaction-toast-close');await page.settle(3);
    state=await page.evaluate(stack);assert.deepEqual(titles(state),['Copied','Kept for review','Saved'],'× closes the front card and the next comes forward');assert.equal(places(state).Copied,'front');
    checks.closeCards=true;

    // A card whose button only opens something opens it from anywhere on the
    // card and closes; one whose button changes data (Undo) expands the stack.
    await page.evaluate(`(()=>{const n=__PWA6.NoticeCoordinator;window.__acted=[];
      n.notify({key:'undo',kind:'success',duration:12000,title:'Moved to Recently deleted',message:'Physiology.',action:{label:'Undo',run:()=>window.__acted.push('undo')}});
      n.notify({source:'sync',key:'opens',kind:'warning',tier:'news',title:'Needs review',message:'Google Drive has changes that need your review.',action:{label:'Review',opens:true,run:()=>window.__acted.push('review')}});})()`);await page.settle(3);
        assert.equal(await page.evaluate(`document.querySelector('#sd-toast-region [data-stack-place="front"]:not(.leaving)').dataset.opens`),'true');
    await page.click('#sd-toast-region [data-stack-place="front"]:not(.leaving) .interaction-toast-message');await page.settle(3);
    assert.deepEqual(await page.evaluate(`window.__acted`),['review'],'a click on the card runs Review');
    state=await page.evaluate(stack);assert.ok(!titles(state).includes('Needs review'),'and closes it');
    assert.equal(places(state)['Moved to Recently deleted'],'front');assert.equal(await page.evaluate(`document.querySelector('#sd-toast-region [data-stack-place="front"]:not(.leaving)').dataset.opens`),'false');
    await page.click('#sd-toast-region [data-stack-place="front"]:not(.leaving) .interaction-toast-message');await page.settle(3);
    assert.equal((await page.evaluate(stack)).mode,'expanded','a card whose button changes data expands the stack instead');assert.deepEqual(await page.evaluate(`window.__acted`),['review'],'Undo did not run');
    await escape();await page.settle(2);
    await page.click('#sd-toast-region [data-stack-place="front"]:not(.leaving) .interaction-toast-close');await page.settle(3);
    assert.deepEqual(titles(await page.evaluate(stack)),['Copied','Kept for review','Saved']);
    checks.cardOpens=true;

    // The Connect card is a card of the stack; Clear all closes it and keeps the critical card.
    // Connect from the profile panel and close Google's window: the card stays with its error.
    await page.click('#profile-tag');await waitFor(()=>page.evaluate(`document.getElementById('profile-dialog').open`),{label:'profile panel open'});
    await page.click('#profile-drive-action');
    await waitFor(()=>page.evaluate(`document.getElementById('drive-connect-card').dataset.tone==='error'`),{label:'the Connect card shows the failed sign-in'});
    await escape();await waitFor(()=>page.evaluate(`!document.getElementById('profile-dialog').open`),{label:'profile panel closed'});await page.settle(3);
    state=await page.evaluate(stack);const connect='Google Drive wasn’t connected';
    assert.equal(titles(state)[0],connect,'the Connect card is the newest card');assert.equal(places(state)[connect],'front');assert.equal(state.more,'+3 more');
    await page.evaluate(`__PWA6.NoticeCoordinator.emit({source:'storage-reset',id:'qa-critical',severity:'warning',foreground:false,surface:'toast',tier:'critical',title:'Browser data was cleared',message:'Choose how to continue.'})`);await page.settle(3);
    assert.equal(titles(await page.evaluate(stack))[0],'Browser data was cleared','critical is pinned first');
    await page.click('.sd-toast-clear');await page.settle(4);
    state=await page.evaluate(stack);assert.deepEqual(titles(state),['Browser data was cleared'],'Clear all keeps only what cannot be closed');
    assert.equal(await page.evaluate(`document.getElementById('drive-connect-card').hidden`),true,'Clear all closes the Connect card too');
    await page.evaluate(`__PWA6.NoticeCoordinator.resolveEvent('storage-reset','qa-critical')`);
    checks.clearAll=true;

    // Recent and the badge: news that fades untouched is counted until Recent is opened.
    await page.evaluate(`__PWA6.NoticeCoordinator.setPaused('qa',false)`);
    await page.evaluate(`__PWA6.NoticeCoordinator.notify({source:'sync',key:'qa-news',tier:'news',duration:1800,title:'Synced from Laptop',message:'Two notes changed.'})`);
    await waitFor(()=>page.evaluate(`document.getElementById('profile-tag').dataset.badge==='info'`),{label:'unseen news shows the blue badge',timeout:6000});
    assert.match(await page.evaluate(`document.getElementById('profile-tag').getAttribute('aria-label')`),/1 new notification/u);
    await page.click('#profile-tag');await waitFor(()=>page.evaluate(`document.getElementById('profile-dialog').open`),{label:'profile panel'});
    await page.click('#profile-recent-more');await page.settle(2);
    const recent=await page.evaluate(`[...document.querySelectorAll('#profile-recent-list .profile-recent-item')].map(row=>({title:row.querySelector('.profile-recent-title').textContent,unseen:row.dataset.unseen==='true',time:/\\d/.test(row.querySelector('time').textContent)}))`);
    assert.deepEqual(recent.slice(0,2).map(row=>row.title),['Synced from Laptop','Browser data was cleared']);
    assert.equal(recent[0].unseen,true,'the faded news is marked while the panel is open');assert.ok(recent.every(row=>row.time));
    assert.ok(recent.some(row=>row.title==='Google Drive backup')&&recent.some(row=>row.title==='Saved'),'results and closed cards stay in Recent');
    await page.click('[data-action="close-profile"]');
    await waitFor(()=>page.evaluate(`document.getElementById('profile-tag').dataset.badge===''`),{label:'opening Recent clears the badge',timeout:4000});
    const before=await page.evaluate(`__PWA6.NoticeCoordinator.recent().entries.length`);assert.equal(recent.length,before,'Show all lists every entry');
    await page.navigate(server.url('deployment','instrumented.html'));await waitForStudyDirector(page,{instrumented:true});
    assert.equal(await page.evaluate(`__PWA6.NoticeCoordinator.recent().entries.length`),before,'Recent survives a reload in this window');
    checks.recentAndBadge=true;
    assert.deepEqual(page.events.filter(event=>!/favicon|ResizeObserver loop/iu.test(event.text||'')),[]);
    await browser.closePage(page);
  }
  { // Phone.
    const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload,viewport:{width:390,height:844,mobile:true,scale:2}});
    await waitForStudyDirector(page,{instrumented:true});
    await page.evaluate(`__PWA6.NoticeCoordinator.setPaused('qa',true)`);
    await page.evaluate(seed);
    await page.evaluate(`__PWA6.NoticeCoordinator.notify({key:'long',duration:12000,title:'Backup checked',message:'${'Every version on this device was read back and matched what was written. '.repeat(4)}'})`);await page.settle(4);
    let state=await page.evaluate(stack);
    assert.deepEqual(places(state),{'Google Drive backup':'full','Backup checked':'front','Export ready':'behind-1','Copied':'behind-2','Kept for review':'hidden','Saved':'hidden'},'one pinned card on a phone');
    assert.equal(await page.evaluate(`(()=>{const message=document.querySelector('#sd-toast-region [data-stack-place="front"]:not(.leaving) .interaction-toast-message');return message.scrollHeight>message.clientHeight+1;})()`),true,'a long message is cut short while folded');
    // A tap on the front card expands the stack; the column stays above the bottom bar and scrolls.
    for(let i=0;i<8;i++)await page.evaluate(`__PWA6.NoticeCoordinator.notify({key:'extra-${i}',duration:12000,title:'Extra ${i}',message:'Another result.'})`);
    await page.tap('#sd-toast-region [data-stack-place="front"]:not(.leaving) .interaction-toast-title');await page.settle(4);await settleMotion(page);
    const column=await page.evaluate(`(()=>{const region=document.getElementById('sd-toast-region'),rect=region.getBoundingClientRect(),bar=document.querySelector('.sd-toast-bar').getBoundingClientRect();return {mode:region.dataset.stack,scrolls:region.scrollHeight>region.clientHeight,bottom:Math.round(rect.bottom),barShown:bar.bottom<=rect.bottom+1,clamped:[...region.querySelectorAll('.interaction-toast-message')].some(message=>message.scrollHeight>message.clientHeight+1)};})()`);
    assert.equal(column.mode,'expanded');assert.equal(column.scrolls,true);assert.ok(column.bottom<=844-80,`the column ends above the bottom bar (${column.bottom})`);assert.equal(column.barShown,true);assert.equal(column.clamped,false,'expanded shows messages in full');
    await page.tap('.sd-toast-more');await page.settle(3);assert.equal((await page.evaluate(stack)).mode,'collapsed');
    // A sideways swipe closes the front card; a critical card springs back.
    const swipe=async selector=>{
      const point=await page.elementPoint(selector);
      await page.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:1}]});
      for(let dx=15;dx<=150;dx+=15)await page.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+dx,y:point.y+2,id:1}]});
      await page.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.settle(4);
    };
    const front=places(await page.evaluate(stack)),frontTitle=Object.keys(front).find(title=>front[title]==='front');
    await swipe('#sd-toast-region [data-stack-place="front"]:not(.leaving) .interaction-toast-message');
    assert.ok(!titles(await page.evaluate(stack)).includes(frontTitle),`a swipe closes ${frontTitle}`);
    await page.evaluate(`__PWA6.NoticeCoordinator.emit({source:'storage-reset',id:'qa-critical',severity:'warning',foreground:false,surface:'toast',tier:'critical',title:'Browser data was cleared',message:'Choose how to continue.'})`);await page.settle(3);
    await swipe('#sd-toast-region .interaction-toast[data-tier="critical"] .interaction-toast-message');
    assert.ok(titles(await page.evaluate(stack)).includes('Browser data was cleared'),'a critical card springs back');
    assert.equal(await page.evaluate(`document.querySelector('#sd-toast-region .interaction-toast[data-tier="critical"]').style.transform`),'');
    checks.phone=true;
    assert.deepEqual(page.events.filter(event=>!/favicon|ResizeObserver loop/iu.test(event.text||'')),[]);
    await browser.closePage(page);
  }
  console.log(JSON.stringify({status:'PASS',suite:'notification-stack',checks}));
}finally{await browser.close();await server.close();}
