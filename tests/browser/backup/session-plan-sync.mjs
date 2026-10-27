import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {faults,ledger,sync,open,connect,markers,uploadsBy,waiting,sleep} from '../../helpers/drive-browser.mjs';

// A plan applied on one device reaches the other quickly during a session.
// The phone (B) runs today's session. The PC (A) shows it running elsewhere,
// pastes a new plan and applies it: it asks first, then uploads within
// seconds without waiting for the app to go to the background. The phone,
// open on its timer, takes it in at its next session check (every two
// minutes while a session runs) and shows the session running on the PC
// with the new plan, its Execute header naming the PC; Continue Here brings
// that plan's timer to the phone.

const sched=name=>`(()=>{const now=new Date(),m=now.getHours()*60+now.getMinutes(),fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0');return [fmt(m-5)+' | 60 | ${name} Block | work | Medicine | pages | 12',fmt(m+55)+' | 30 | ${name} Next | work | Ethics | pages | 5'].join('\\n');})()`;
// Accept the takeover question the way a person would.
const acceptDialogs=`window.__accepted=[];window.__acceptTimer=setInterval(()=>{const dialog=document.getElementById('sd-interaction-dialog');if(dialog&&dialog.open){window.__accepted.push(dialog.textContent.replace(/\\s+/g,' '));dialog.querySelector('.interaction-actions .primary,.interaction-actions .danger')?.click();}},50);`;
const pasteAndApply=name=>`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms));d.goTab('plan');await wait(100);${acceptDialogs}
  const input=document.getElementById('plan-input');input.value=${sched(name)};input.dispatchEvent(new Event('input',{bubbles:true}));await wait(400);
  document.querySelector('[data-action="apply-schedule"]').click();await wait(1500);clearInterval(window.__acceptTimer);d.goTab('execute');await wait(150);return window.__accepted;})()`;
const screen=page=>page.evaluate(`(async()=>{const d=__PWA6;d.goTab('execute');await new Promise(r=>setTimeout(r,150));const panel=document.getElementById('session-panel'),session=(await d.AppData.activeSession.load()).value;
  return {mode:d.TimerState.snapshot().mode,panel:panel.checkVisibility()?document.getElementById('session-panel-title').textContent:'',stored:String(session?.scheduleText||''),header:document.getElementById('status-session-label').textContent,overlay:document.getElementById('execute-overlay-title').textContent,now:document.getElementById('pane-execute').innerText.replace(/\\s+/g,' ').slice(0,200)};})()`);
const runSession=name=>`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms));document.getElementById('plan-input').value=${sched(name)};const result=d.applySchedule({skipNotify:true});if(result&&result.then)await result;d.goTab('execute');await wait(50);d.setCurrentTask(0);d.TimerEngine.startCur();await wait(300);await d.flushLiveDraft();return d.TimerState.snapshot().mode;})()`;
async function checkAgain(page,label){
  for(let wait=1;wait>0;){wait=(Date.parse((await sync(page)).checkedAt)||0)+61000-Date.now();if(wait>0)await sleep(wait);}
  // What the two-minute session check does.
  await page.evaluate(`__PWA6.BackupProviderRuntime.wakeBackground('session-watch')`);
}

const server=await startReleaseServer();
const first=await launchChromium({profilePrefix:'sd-plan-sync-a-'}),second=await launchChromium({profilePrefix:'sd-plan-sync-b-'});
try{
  const a=await open(first,server,'A'),b=await open(second,server,'B');
  await connect(a,'A');await waitFor(async()=>!!(await sync(a))?.syncedAt,{label:'A synced',timeout:60000});
  assert.equal(await b.evaluate(runSession('Phone')),'running','the phone runs today\'s session');
  await connect(b,'B');await waitFor(async()=>!!(await sync(b))?.syncedAt,{label:'B synced',timeout:60000});
  await waitFor(async()=>!markers()&&!await waiting(b),{label:'B settles',timeout:90000});

  await checkAgain(a,'A');
  await waitFor(async()=>(await screen(a)).panel==='Running on Another Device',{label:'the PC shows the phone\'s session',timeout:30000});
  await waitFor(async()=>!markers()&&!await waiting(a),{label:'A settles',timeout:90000});

  const before=uploadsBy('A'),asked=await a.evaluate(pasteAndApply('PC'));
  assert.ok(asked.some(text=>/Continue here|running on/iu.test(text)),`applying asks before taking over (${asked.join(' / ')})`);
  assert.equal((await screen(a)).mode,'running','the PC runs the new plan');
  await waitFor(async()=>uploadsBy('A')>before&&!await waiting(a),{label:'the PC uploads the new plan without going to the background',timeout:45000});

  await checkAgain(b,'B');
  await waitFor(async()=>/PC Block/u.test((await screen(b)).stored),{label:'the phone takes in the new plan',timeout:30000});
  const phone=await screen(b);
  assert.equal(phone.panel,'Running on Another Device','the phone shows the session running on the PC');
  assert.notEqual(phone.mode,'running','the phone stops its own timer');
  assert.match(phone.header,/^RUNNING ON /u,`the Execute header names the device running the session (${phone.header})`);
  assert.equal(phone.overlay,'Running on Another Device','the Execute card says so too');
  assert.doesNotMatch(phone.now,/No Schedule Loaded/u,'no "No Schedule Loaded" next to the panel');

  // Continue Here, once the phone has finished taking in the plan (buttons
  // are locked while a sync applies changes).
  await waitFor(async()=>!markers()&&!await waiting(b)&&await b.evaluate(`(()=>{const button=[...document.querySelectorAll('[data-action="restore-session"]')].find(item=>!item.hidden);return !!button&&!button.disabled;})()`)&&!(await sync(b)).catchingUp,{label:'the phone settles',timeout:90000});
  const returnUploads=uploadsBy('B');
  await b.evaluate(`(async()=>{${acceptDialogs}__PWA6.goTab('plan');await new Promise(r=>setTimeout(r,150));[...document.querySelectorAll('[data-action="restore-session"]')].find(item=>!item.hidden).click();})()`);
  await waitFor(async()=>{const moved=await screen(b);if(uploadsBy('B')===returnUploads)assert.notEqual(moved.mode,'running','Continue Here must not run before Drive confirms ownership');return uploadsBy('B')>returnUploads&&moved.mode==='running';},{label:'Continue Here ownership commit',timeout:60000});
  await b.evaluate(`clearInterval(window.__acceptTimer)`);
  const moved=await screen(b);
  assert.equal(moved.mode,'running','Continue Here runs only after the phone ownership checkpoint is confirmed');
  assert.equal(moved.header,'LIVE SESSION','the header follows the session back to this device');
  assert.match(moved.now,/PC Block/u,'with the plan applied on the PC');
  for(const page of [a,b])assert.deepEqual(page.warnings.filter(text=>/\[Study Director\]/u.test(text)),[]);
  assert.deepEqual(faults,[]);
  console.log(JSON.stringify({status:'PASS',checks:{asksBeforeTakeover:true,uploadsAtOnce:true,phoneShowsNewPlan:true,continueHere:true,ownershipConfirmedBeforeRun:true}}));
}catch(error){console.error(ledger.slice(-30).join('\n'));throw error;}
finally{await first.close();await second.close();await server.close();}
