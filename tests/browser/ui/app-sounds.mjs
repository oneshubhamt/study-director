import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';

// The cues are made in code: a real gesture unlocks sound, Test sound plays the
// begin cue at its full length, the rest are made in idle moments, and no sound
// file is ever requested.
const preload=`localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'SoundQA QA',updatedAt:new Date().toISOString()}));
window.__sounds={made:[],played:[]};
const makeBuffer=BaseAudioContext.prototype.createBuffer;
BaseAudioContext.prototype.createBuffer=function(...args){window.__sounds.made.push(args[1]);return makeBuffer.apply(this,args);};
const start=AudioBufferSourceNode.prototype.start;
AudioBufferSourceNode.prototype.start=function(...args){window.__sounds.played.push({length:this.buffer.length,rate:this.buffer.sampleRate,state:this.context.state});return start.apply(this,args);};`;
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'study-director-qa-sounds-'});let page=null;
const result={status:'PASS',release:server.manifest.release,checks:{}};
try{
  page=await browser.createPage(server.url('deployment','instrumented.html'),{preload,viewport:{width:1280,height:860,mobile:false,scale:1}});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'primary ownership'});
  assert.deepEqual(await page.evaluate(`window.__sounds.made`),[],'nothing is made before sound is unlocked');result.checks.nothingBeforeUnlock=true;

  // A real pointer gesture unlocks sound, as a person's first click does.
  for(const type of ['mousePressed','mouseReleased'])await page.send('Input.dispatchMouseEvent',{type,x:640,y:20,button:'left',clickCount:1});
  await page.evaluate(`__PWA6.NoticeCoordinator.testSound()`);
  const played=await waitFor(()=>page.evaluate(`window.__sounds.played[0]||null`),{label:'test sound playing'});
  assert.deepEqual(played,{length:24916,rate:22050,state:'running'},'Test sound plays the full begin cue');result.checks.testSoundPlays=true;

  const cues=await page.evaluate(`window[Symbol.for('studyDirector.internalModules.v1')].require('audio-engine',1).cues.length`);
  const made=await waitFor(()=>page.evaluate(`window.__sounds.made.length>=${cues}?window.__sounds.made:null`),{label:'every cue made in idle moments'});
  assert.equal(made.length,cues,'each cue is made once');assert.ok(made.includes(24916)&&made.includes(33957));result.checks.allCuesMadeOnce=true;

  assert.deepEqual(server.requests.filter(request=>request.path.includes('/assets/sounds/')),[],'no sound file is requested');result.checks.noSoundFiles=true;
  const unexpected=page.events.filter(event=>!/favicon|ResizeObserver loop/i.test(event.text||''));assert.deepEqual(unexpected,[]);result.checks.noRuntimeErrors=true;
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close();await server.close();}
console.log(JSON.stringify(result,null,2));
