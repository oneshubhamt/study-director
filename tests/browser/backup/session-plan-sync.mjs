import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {drive,faults,ledger,sync,open,connect,markers,uploadsBy,waiting,sleep} from '../../helpers/drive-browser.mjs';

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
  return {mode:d.TimerState.snapshot().mode,panel:panel.checkVisibility()?document.getElementById('session-panel-title').textContent:'',stored:String(session?.scheduleText||''),owner:String(session?.runningOn||''),revision:Number(session?.revision)||0,header:document.getElementById('status-session-label').textContent,overlay:document.getElementById('execute-overlay-title').textContent,now:document.getElementById('pane-execute').innerText.replace(/\\s+/g,' ').slice(0,200)};})()`);
const claimsBy=who=>ledger.filter(line=>line.split(' ')[1]===who&&/ POST \S+ sc_[a-f0-9]+\.sdsessionclaim session-claim /u.test(line)).length;
async function latestClaim(){
  const rows=[...drive.state.files.values()].filter(file=>!file.trashed&&file.appProperties?.studyDirectorRepositoryKind==='session-claim').sort((a,b)=>String(b.appProperties.studyDirectorRepositoryId||'').localeCompare(String(a.appProperties.studyDirectorRepositoryId||'')));
  return rows[0]?JSON.parse(await rows[0].content.text()):null;
}
const openUploadGates=new Set();
function gateUploads(){
  let resolve;const gate=new Promise(done=>{resolve=done;});drive.state.uploadPutGate=gate;
  const release=()=>{resolve();if(drive.state.uploadPutGate===gate)drive.state.uploadPutGate=null;openUploadGates.delete(release);};openUploadGates.add(release);return release;
}
async function holdBackground(page,key){
  await page.evaluate(`(async()=>{const hold=__PWA6.BackupProviderRuntime.suspendBackground('qa-session-ownership');window[${JSON.stringify(key)}]=hold;await hold.settled;})()`);
}
async function releaseBackground(page,key){await page.evaluate(`(()=>{window[${JSON.stringify(key)}]?.release();window[${JSON.stringify(key)}]=null;})()`);}
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
  await connect(b,'B');
  try{await waitFor(async()=>!!(await sync(b))?.syncedAt,{label:'B synced',timeout:60000});}
  catch(error){
    const diagnostic=await b.evaluate(`(async()=>{const d=__PWA6;return {provider:d.BackupProviderRuntime.status(),location:d.BackupProviderRuntime.locationStatus('google-drive'),background:d.BackupProviderRuntime.backgroundStatus(),sync:d.BackupProviderRuntime.diagnosticSync(),automaticWaiting:d.BackupProviderRuntime.automaticWaiting(),session:(await d.AppData.activeSession.load()).value};})()`).catch(cause=>({diagnosticError:String(cause&&cause.message||cause)}));
    console.error('[session-plan-sync] B initial sync diagnostic',JSON.stringify(diagnostic));throw error;
  }
  await waitFor(async()=>!markers()&&!await waiting(b),{label:'B settles',timeout:90000});

  await checkAgain(a,'A');
  await waitFor(async()=>(await screen(a)).panel==='Running on Another Device',{label:'the PC shows the phone\'s session',timeout:30000});
  await waitFor(async()=>!markers()&&!await waiting(a),{label:'A settles',timeout:90000});

  await holdBackground(a,'__qaOwnershipHold');
  const before=uploadsBy('A'),beforeClaims=claimsBy('A'),releasePlanClaim=gateUploads(),applying=a.evaluate(pasteAndApply('PC'));
  await sleep(250);
  assert.equal(claimsBy('A'),beforeClaims,'the ownership claim remains uncommitted while its Drive write is held');
  assert.notEqual((await screen(a)).mode,'running','the PC timer stays stopped until the ownership claim is durably verified');
  releasePlanClaim();
  const asked=await applying;
  assert.ok(asked.some(text=>/Continue here|running on/iu.test(text)),`applying asks before taking over (${asked.join(' / ')})`);
  try{await waitFor(async()=>claimsBy('A')>beforeClaims&&(await screen(a)).mode==='running',{label:'the PC ownership claim starts the timer',timeout:10000});}
  catch(error){
    const diagnostic=await a.evaluate(`(async()=>{const d=__PWA6,session=(await d.AppData.activeSession.load()).value;return {timer:d.TimerState.snapshot(),session,lifecycle:d.SessionLifecycle.status(),claim:await d.BackupProviderRuntime.readSessionClaim('google-drive'),planStatus:document.getElementById('plan-status')?.textContent||'',panel:document.getElementById('session-panel-title')?.textContent||'',accepted:window.__accepted||[]};})()`).catch(cause=>({diagnosticError:String(cause&&cause.message||cause)}));
    console.error('[session-plan-sync] takeover failure diagnostic',JSON.stringify(diagnostic));throw error;
  }
  const pcClaim=await latestClaim(),pc=await screen(a),pcProjection=await a.evaluate(`__PWA6.BackupProviderRuntime.readSessionClaim('google-drive')`);
  assert.equal(pcClaim.state,'owned');assert.match(pcClaim.ownerToken,/^[a-f0-9]{64}$/u);assert.match(pcClaim.sessionToken,/^[a-f0-9]{64}$/u);assert.match(pcClaim.observedContentFingerprint,/^[a-f0-9]{64}$/u,'the ownership claim is anchored to the exact semantic session content observed at handoff');assert.equal(Object.hasOwn(pcClaim,'owner'),false);assert.equal(Object.hasOwn(pcClaim,'date'),false);assert.equal(pcProjection.ownedHere,true);assert.equal(pcProjection.applies,true);assert.ok(pc.revision>=pcClaim.revision,'local session revision must cover the accepted ownership revision');
  assert.equal(uploadsBy('A'),before,'a full Drive checkpoint is not on the live ownership critical path');
  await releaseBackground(a,'__qaOwnershipHold');
  await waitFor(async()=>uploadsBy('A')>before&&!await waiting(a),{label:'the PC publishes its full state after ownership',timeout:45000});

  await checkAgain(b,'B');
  await waitFor(async()=>/PC Block/u.test((await screen(b)).stored),{label:'the phone takes in the new plan',timeout:30000});
  const phone=await screen(b);
  assert.equal(phone.panel,'Running on Another Device','the phone shows the session running on the PC');
  assert.notEqual(phone.mode,'running','the phone stops its own timer');
  assert.match(phone.header,/^RUNNING ON /u,`the Execute header names the device running the session (${phone.header})`);
  assert.equal(phone.overlay,'Running on Another Device','the Execute card says so too');
  assert.doesNotMatch(phone.now,/No Schedule Loaded/u,'no "No Schedule Loaded" next to the panel');
  // Continue Here sits in the Execute status card and in the strip above the
  // Plan board; the Execute session panel keeps only the note.
  const controls=await b.evaluate(`(()=>{const card=document.getElementById('execute-session-action'),strip=document.getElementById('plan-board-session-actions'),board=document.getElementById('plan-board'),shown=root=>[...root.querySelectorAll('button[data-action]')].filter(item=>!item.hidden).map(item=>item.textContent.trim());return {card:card.hidden?'':card.textContent.trim(),cardInOverlay:!!card.closest('#execute-state-overlay'),strip:shown(strip),stripState:document.getElementById('plan-session-state').textContent,stripAboveBoard:!!(strip.compareDocumentPosition(board)&Node.DOCUMENT_POSITION_FOLLOWING),panel:shown(document.getElementById('session-panel'))};})()`);
  assert.equal(controls.card,'Continue Here','the Execute status card offers Continue Here');
  assert.equal(controls.cardInOverlay,true);
  assert.deepEqual(controls.strip,['Continue Here'],'the Plan strip offers only Continue Here while the session runs elsewhere');
  assert.match(controls.stripState,/^Running on /u,'the Plan strip names the device running the session');
  // The profile indicator lists it too, with a way to Execute.
  await waitFor(()=>b.evaluate(`/Today’s session is running on /u.test(document.getElementById('profile-badge').getAttribute('aria-label')||'')`),{label:'the phone\'s indicator names the device running the session',timeout:10000});
  assert.equal(controls.stripAboveBoard,true,'the Plan strip sits above the board');
  assert.deepEqual(controls.panel,[],'the Execute session panel shows no disabled controls');

  // Continue Here, once the phone has finished taking in the plan (buttons
  // are locked while a sync applies changes).
  await waitFor(async()=>!markers()&&!await waiting(b)&&await b.evaluate(`(()=>{const button=[...document.querySelectorAll('[data-action="restore-session"]')].find(item=>!item.hidden);return !!button&&!button.disabled;})()`)&&!(await sync(b)).catchingUp,{label:'the phone settles',timeout:90000});
  // BF-1: keep a separate local Plan draft while the applied session belongs
  // to the PC. Continue Here must apply the session without consuming,
  // replacing or opening this draft.
  const preservedDraft=await b.evaluate(`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms)),text=${sched('BF1 Draft')};d.goTab('plan');await wait(80);const input=document.getElementById('plan-input');input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));await wait(450);d.PlanDraftEditor.deactivate();d.goTab('execute');await wait(80);return text;})()`);
  assert.equal(await b.evaluate(`__PWA6.PlanDraftEditor.active()`),false,'the preserved draft starts outside edit mode');
  await holdBackground(b,'__qaOwnershipHold');
  // The PC records more and uploads it before the phone takes it in. That
  // upload, saved before the phone takes over, still names the PC; it must
  // not take the session back once the phone has continued.
  const pcUploads=uploadsBy('A'),phoneView=(await screen(b)).revision;
  await a.evaluate(`(async()=>{const d=__PWA6;await new Promise(r=>setTimeout(r,1100));d.AppData.notes.update('pc-late','PC note','Written on the PC before the phone continued','');await d.AppData.notes.flush({strict:true});await d.flushLiveDraft();await d.BackupProviderRuntime.flushAutomatic('app-hidden');})()`);
  await waitFor(async()=>uploadsBy('A')>pcUploads&&!await waiting(a)&&!markers(),{label:'the PC uploads newer progress',timeout:45000});
  assert.ok((await screen(a)).revision>phoneView,'the PC’s session moved on since the phone last took it in');
  const returnUploads=uploadsBy('B'),returnClaims=claimsBy('B'),releaseReturnClaim=gateUploads();
  await b.evaluate(`(async()=>{${acceptDialogs}__PWA6.goTab('plan');await new Promise(r=>setTimeout(r,150));document.querySelector('#plan-board-session-actions [data-action="restore-session"]').click();})()`);
  // Continue Here answers at once: every copy says it is working, a second
  // tap does nothing, and the Execute card and the Plan strip show the step.
  const handoff=()=>b.evaluate(`(()=>{const buttons=[...document.querySelectorAll('[data-action="restore-session"]')].filter(item=>!item.hidden);return {labels:buttons.map(item=>item.textContent.trim()),disabled:buttons.every(item=>item.disabled),busy:buttons.every(item=>item.getAttribute('aria-busy')==='true'),step:document.getElementById('execute-session-progress').hidden?'':document.getElementById('execute-session-progress').textContent,strip:document.getElementById('plan-session-state').textContent};})()`);
  await waitFor(async()=>/^Confirming with Google Drive/u.test((await handoff()).step),{label:'Continue Here shows it is confirming with Google Drive',timeout:5000});
  const busy=await handoff();
  assert.deepEqual([...new Set(busy.labels)],['Continuing…'],`every Continue Here says it is working (${busy.labels.join(' / ')})`);
  assert.equal(busy.disabled&&busy.busy,true,'and is disabled and busy');
  assert.match(busy.strip,/^Confirming with Google Drive/u,'the Plan strip shows the step');
  await b.evaluate(`document.getElementById('execute-session-action').click()`);
  assert.equal(claimsBy('B'),returnClaims,'Continue Here has not committed while its ownership write is held');
  assert.notEqual((await screen(b)).mode,'running','Continue Here keeps the timer stopped before the small ownership claim is durable');
  releaseReturnClaim();
  await waitFor(async()=>claimsBy('B')>returnClaims&&(await screen(b)).mode==='running',{label:'Continue Here ownership claim',timeout:10000});
  await b.evaluate(`clearInterval(window.__acceptTimer)`);
  const moved=await screen(b),phoneClaim=await latestClaim(),phoneProjection=await b.evaluate(`__PWA6.BackupProviderRuntime.readSessionClaim('google-drive')`),phoneClaimOwner=moved.owner;
  assert.equal(moved.mode,'running','Continue Here runs after the verified ownership claim');
  assert.equal(phoneClaim.state,'owned');assert.match(phoneClaim.ownerToken,/^[a-f0-9]{64}$/u);assert.match(phoneClaim.observedContentFingerprint,/^[a-f0-9]{64}$/u);assert.equal(Object.hasOwn(phoneClaim,'owner'),false);assert.equal(phoneProjection.ownedHere,true);assert.equal(phoneProjection.applies,true);assert.ok(moved.revision>=phoneClaim.revision);
  assert.equal(uploadsBy('B'),returnUploads,'Continue Here does not wait for the full session checkpoint');
  assert.equal(moved.header,'LIVE SESSION','the header follows the session back to this device');
  assert.match(moved.now,/PC Block/u,'with the plan applied on the PC');
  const draftAfterHandoff=await b.evaluate(`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms));d.goTab('plan');await wait(100);const board=document.getElementById('plan-board');return {text:document.getElementById('plan-input').value,editing:d.PlanDraftEditor.active(),mode:board.dataset.mode,board:document.getElementById('sched-list').innerText};})()`);
  assert.equal(draftAfterHandoff.text,preservedDraft,'Continue Here preserves the independent local Plan draft');
  assert.equal(draftAfterHandoff.editing,false,'Continue Here does not enter Plan editing mode');
  assert.equal(draftAfterHandoff.mode,'live','the Plan board stays in applied/live mode after handoff');
  assert.match(draftAfterHandoff.board,/PC Block/u,'the live board shows the handed-over applied plan, not the preserved draft');

  // Hold A's ordinary sync so its stale local owner remains testable. Even an
  // artificially huge local revision must not beat B's newer ownership epoch.
  await holdBackground(a,'__qaClaimSyncHold');
  const stale=await a.evaluate(`(async()=>{const d=__PWA6,loaded=await d.AppData.activeSession.load(),session=structuredClone(loaded.value);session.revision=Math.min(Number.MAX_SAFE_INTEGER-1024,Math.max(1,Number(session.revision)||1)+1000000000);session.updatedAt=new Date().toISOString();const saved=await d.AppData.activeSession.save(session);if(!saved?.ok)throw saved?.error||new Error('stale fixture save failed');try{await d.BackupProviderRuntime.backupRepositoryProvider('google-drive',{interactive:false});return {ok:true};}catch(error){return {ok:false,code:String(error&&error.code||error&&error.name||''),message:String(error&&error.message||error)};}})()`);
  assert.equal(stale.ok,false);assert.ok(['REPOSITORY_SESSION_OWNERSHIP_AHEAD','REPOSITORY_SYNC_BEHIND'].includes(stale.code),`a stale former owner must be blocked before publication even with a larger local revision (${stale.code}: ${stale.message})`);
  await waitFor(async()=>{await a.evaluate(`__PWA6.checkSessionOwnershipClaim()`);return await a.evaluate(`!__PWA6.TimerEngine.status().loopActive`);},{label:'the old runtime clock stops from the lightweight claim before full reconciliation',timeout:10000});
  assert.equal((await screen(a)).mode,'running','the lightweight ownership claim freezes execution without rewriting canonical session semantics before reconciliation');

  assert.equal(claimsBy('B'),returnClaims+1,'a second tap while it was working claimed nothing more');
  assert.equal((await handoff()).step,'','the step line clears once the session runs here');

  await releaseBackground(b,'__qaOwnershipHold');
  await waitFor(async()=>uploadsBy('B')>returnUploads&&!await waiting(b),{label:'the phone publishes its full state after ownership',timeout:45000});
  const kept=await screen(b);
  assert.equal(kept.mode,'running','the PC’s earlier upload did not take the session back');
  assert.equal(kept.owner,phoneClaimOwner,'the phone still runs the session');
  assert.match(await b.evaluate(`String(__PWA6.AppData.notes.get('pc-late')?.text||'')`),/before the phone continued/u,'everything else in that upload came in');

  // Ending the owner session (Save Today, then Reset Today, as a person ends
  // the day) publishes the no-session checkpoint first, then a
  // higher-epoch released claim. A stale frozen device must not interpret that
  // release as permission to resume its old timer.
  const ended=await b.evaluate(`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms));d.TimerEngine.stopExecution();d.goTab('review');await wait(150);d.ReviewView.refresh({force:true});if(!await d.saveDayRecord())throw new Error('Save Today failed');const record=await d.AppData.dailyRecords.get(d.todayISO()),session=(await d.AppData.activeSession.load()).value,sourceRevision=Number(record?.sourceRevision),contentRevision=Number(session?.snapshot?.contentRevision),savedRevision=Number(session?.snapshot?.savedRevision);if(!Number.isSafeInteger(sourceRevision)||!Number.isSafeInteger(contentRevision)||!Number.isSafeInteger(savedRevision)||sourceRevision<contentRevision||savedRevision<contentRevision)throw new Error('Save Today did not persist the session-local save acknowledgement');${acceptDialogs}await d.resetTodaySession();clearInterval(window.__acceptTimer);if((await d.AppData.activeSession.load(0,{strict:true})).value)throw new Error('Reset Today did not end the session');const publication=await d.BackupProviderRuntime.backupRepositoryProvider('google-drive',{interactive:false});return {checkpointId:publication?.checkpointId||'',sourceRevision,contentRevision,savedRevision};})()`);
  assert.ok(ended?.checkpointId,'the owner saves the day and publishes the ended-session checkpoint');
  assert.ok(ended.sourceRevision>=ended.contentRevision,'the Saved Day records the saved content revision');
  assert.ok(ended.savedRevision>=ended.contentRevision,'the Active Session itself records that its content was saved; this acknowledgement travels with the session lineage');
  await waitFor(async()=>{const claim=await latestClaim();return claim?.state==='released';},{label:'released session ownership',timeout:10000});
  await a.evaluate(`__PWA6.checkSessionOwnershipClaim()`);
  assert.equal(await a.evaluate(`__PWA6.TimerEngine.status().loopActive`),false,'a released claim never restarts the stale frozen runtime clock');
  assert.equal((await screen(a)).mode,'running','release leaves stale canonical session semantics untouched until the ended-session checkpoint reconciles');
  await releaseBackground(a,'__qaClaimSyncHold');
  await a.evaluate(`__PWA6.BackupProviderRuntime.scheduleSharedSync('google-drive','qa-release')`);
  await waitFor(async()=>a.evaluate(`(async()=>!(await __PWA6.AppData.activeSession.load()).value)()`),{label:'the old device retires the ended Active Session',timeout:45000});
  assert.equal(await a.evaluate(`(async()=>!!(await __PWA6.AppData.dailyRecords.get(__PWA6.todayISO())))()`),true,'the old device has the Saved Day after reconciliation');
  assert.equal(await a.evaluate(`(async()=>!!(await __PWA6.AppData.activeSession.load()).value)()`),false,'the stale recovery row is gone, so it cannot produce a later unsaved-day reminder');
  for(const page of [a,b])assert.deepEqual(page.warnings.filter(text=>/\[Study Director\]/u.test(text)),[]);
  assert.deepEqual(faults,[]);
  console.log(JSON.stringify({status:'PASS',checks:{asksBeforeTakeover:true,lightweightOwnershipBeforeTimer:true,planTakeoverUsesSameFence:true,staleOwnerFence:true,releasedClaimDoesNotResume:true,uploadsAtOnce:true,phoneShowsNewPlan:true,continueHere:true,draftSurvivesHandoff:true,handoffLeavesPlanLive:true,sessionLocalSaveAcknowledgement:true,oldDeviceRetiresEndedSession:true}}));
}catch(error){console.error(ledger.slice(-30).join('\n'));throw error;}
finally{for(const release of [...openUploadGates])release();drive.state.uploadPutGate=null;await first.close();await second.close();await server.close();}
