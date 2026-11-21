import assert from 'node:assert/strict';
import {instrumentedHtml,startReleaseServer,launchChromium,skipFirstStart,waitFor} from '../../helpers/browser-harness.mjs';

const server=await startReleaseServer();
const source=instrumentedHtml('development');
const captureMarker="Symbol.for('studyDirector.installCapture.v1')";
const captureAt=source.indexOf(captureMarker);
const scriptEnd=captureAt>=0?source.indexOf('</script>',captureAt):-1;
assert.ok(captureAt>=0&&scriptEnd>captureAt,'early install-capture script is missing from the built shell');

const earlyPrompt=`<script>
window.__p512InstallPromptCalls=0;
window.__p512InstallPromptPrevented=false;
{
  const promptEvent=new Event('beforeinstallprompt',{cancelable:true});
  Object.defineProperties(promptEvent,{
    prompt:{value:async()=>{window.__p512InstallPromptCalls+=1;}},
    userChoice:{value:Promise.resolve({outcome:'accepted'})}
  });
  window.__p512InstallPromptEvent=promptEvent;
  window.dispatchEvent(promptEvent);
  window.__p512InstallPromptPrevented=promptEvent.defaultPrevented;
  window.__p512EarlyBridgeOwned=window[Symbol.for('studyDirector.installCapture.v1')].status().prompt===promptEvent;
  // Keep this fixture pinned to the pre-host event. Headless Chromium may
  // later synthesize its own install event; that browser-owned event is
  // covered by normal install behavior, not this early-capture ownership test.
  window.addEventListener('beforeinstallprompt',event=>event.stopImmediatePropagation(),true);
}
</script>`;
const html=source.slice(0,scriptEnd+9)+earlyPrompt+source.slice(scriptEnd+9);
server.setOverride('development','install-capture.html',html);

const browser=await launchChromium({profilePrefix:'qa-p512-install-capture-'});
let page;
try{
  page=await browser.createPage(server.url('development','install-capture.html'));
  await waitFor(()=>page.evaluate(`!!window.StudyDirector&&!!window.__PWA6`),{label:'Study Director host startup'});
  await skipFirstStart(page);
  assert.equal(await page.evaluate(`window.__p512InstallPromptPrevented`),true,'the pre-host prompt must be captured and prevented by the early bridge');
  assert.equal(await page.evaluate(`__PWA6.NativeCapabilities.status().installationAction`),'install','host startup must consume the prompt retained by the early bridge');
  assert.equal(await page.evaluate(`window.__p512EarlyBridgeOwned`),true,'the early bridge must own the exact captured prompt object before host startup');

  await page.evaluate(`__PWA6.goTab('guide')`);
  await waitFor(()=>page.evaluate(`document.querySelector('#guide-install-card .mini-btn')?.textContent.trim()==='Install app'`),{timeout:60000,label:'Guide install action'});
  assert.equal(await page.evaluate(`window.StudyDirector.installation.status().installationAction`),'install');
  await page.click('#guide-install-card .mini-btn');
  await waitFor(()=>page.evaluate(`window.__p512InstallPromptCalls===1`),{timeout:8000,label:'captured prompt consumed through Guide'});
  const installResult=await page.evaluate(`({calls:window.__p512InstallPromptCalls,state:window.StudyDirector.installation.status().installationState,feedback:window.StudyDirector.installation.status().installFeedback||''})`);
  assert.equal(installResult.calls,1,'Guide must invoke the retained prompt exactly once');
  assert.ok(installResult.state==='installing'||/accepted/i.test(installResult.feedback),'accepted prompt must reach the installation state machine');

  const errors=page.events.filter(event=>!/favicon|ResizeObserver loop/i.test(event.text));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'PASS',suite:'p512-install-capture',preHostCaptured:true,guideConsumed:true,promptCalls:1},null,2));
}finally{
  if(page)await browser.closePage(page);
  await browser.close();
  await server.close();
}
