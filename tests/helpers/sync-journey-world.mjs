import assert from 'node:assert/strict';
import {waitFor,waitForStudyDirector} from './browser-harness.mjs';
import {artifactPath} from './artifacts.mjs';
import {hooks,sync,attachDrive,preload,markers,waiting,sleep} from './drive-browser.mjs';

// Sync journeys: devices sharing one simulated Google Drive through a day of
// study, with what goes wrong in real life (a device mid-upload, offline,
// frozen in the background, closed, behind Drive, or with its clock hours
// off). Used by tests/browser/backup/sync-journeys.mjs and
// session-handoff-journeys.mjs.

export const shot=name=>artifactPath(`sync-journeys/${name}.png`);
export function journeyLog(suite){
  const steps=[];
  return {steps,step:(name,detail={})=>{steps.push({name,...detail});console.log(`[${suite}] ${name}${Object.keys(detail).length?' '+JSON.stringify(detail):''}`);}};
}

// Devices --------------------------------------------------------------------
// clockMs: how far this device's clock is from the true time.
const clockScript=ms=>`(()=>{const off=${Number(ms)||0};if(!off)return;const Real=Date;class Skewed extends Real{constructor(...args){super(...(args.length?args:[Real.now()+off]));}static now(){return Real.now()+off;}}globalThis.Date=Skewed;})();`;
// Each device's last session saves (timer state and the code that saved it),
// for a failing journey's report only.
const sessionWriteLog=`(()=>{const put=IDBObjectStore.prototype.put;window.__sessionWrites=[];IDBObjectStore.prototype.put=function(value,...rest){try{if(value&&value.type==='activeSession'){const rt=value.snapshot&&value.snapshot.timerRuntime;window.__sessionWrites.push({at:new Date().toISOString().slice(11,23),st:value.status,own:String(value.runningOn||'').slice(-4),cur:value.snapshot&&value.snapshot.currentTaskId,rt:rt?rt.mode+' '+rt.taskId:'none',by:new Error().stack.split('\\n').slice(2,10).map(line=>line.trim().replace(/^at /,'').replace(/ \\(.*\\)$/,'')).join(' < ')});if(window.__sessionWrites.length>40)window.__sessionWrites.shift();}}catch(error){}return put.call(this,value,...rest);};})();`;
export async function openDevice(browser,server,who,{clockMs=0}={}){
  const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload:clockScript(clockMs)+preload+sessionWriteLog});
  await attachDrive(page,who);
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:`${who}: ownership`});
  return page;
}
// What fails or waits, per device. hold(who,match): that device's matching
// requests wait until released. offline(who): its requests fail.
export const down=new Set(),holds=[];
hooks.before=async request=>{
  if(down.has(request.who))return 'fail';
  for(const hold of holds)if(hold.who===request.who&&hold.match(request)){hold.reached=true;await hold.released;}
  return '';
};
export function hold(who,match){
  let release;const entry={who,match,reached:false,released:new Promise(resolve=>{release=resolve;})};
  entry.release=()=>{const index=holds.indexOf(entry);if(index>=0)holds.splice(index,1);release();};holds.push(entry);return entry;
}
export const versionUpload=request=>request.method==='POST'&&/\.sdcheckpoint/u.test(request.text);
export const anyUpload=request=>['POST','PUT','PATCH'].includes(request.method)&&/upload\/drive/u.test(request.url);
export async function setOffline(page,who,value){if(value)down.add(who);else down.delete(who);await page.setOffline(value);}
// A phone or tablet frozen by the system: the page's script stops where it
// is (no timers run) and carries on when the person brings the app back.
export async function freeze(page){await page.send('Debugger.enable');await page.send('Debugger.pause');await sleep(1500);}
export async function thaw(page){await page.send('Debugger.resume');}

// The app ----------------------------------------------------------------------
const sched=name=>`(()=>{const now=new Date(),m=now.getHours()*60+now.getMinutes(),fmt=v=>String(Math.floor((v+1440)%1440/60)).padStart(2,'0')+':'+String((v+1440)%1440%60).padStart(2,'0');return [fmt(m-5)+' | 60 | ${name} One | work | Medicine | pages | 12',fmt(m+55)+' | 30 | ${name} Two | work | Ethics | pages | 5',fmt(m+85)+' | 30 | ${name} Three | work | Surgery | pages | 5'].join('\\n');})()`;
export const runSession=name=>`(async()=>{const d=__PWA6,wait=ms=>new Promise(r=>setTimeout(r,ms));document.getElementById('plan-input').value=${sched(name)};const result=d.applySchedule({skipNotify:true});if(result&&result.then)await result;d.goTab('execute');await wait(50);d.setCurrentTask(0);d.TimerEngine.startCur();await wait(300);await d.flushLiveDraft();return d.TimerState.snapshot().mode;})()`;
const acceptDialogs=`window.__accepted=window.__accepted||[];clearInterval(window.__acceptTimer);window.__acceptTimer=setInterval(()=>{const dialog=document.getElementById('sd-interaction-dialog');if(dialog&&dialog.open){window.__accepted.push(dialog.textContent.replace(/\\s+/g,' '));dialog.querySelector('.interaction-actions .primary,.interaction-actions .danger')?.click();}},50);`;
// What a device shows and holds about today's session.
export const view=page=>page.evaluate(`(async()=>{const d=__PWA6;await d.goTab('execute');await new Promise(r=>setTimeout(r,60));const t=d.TimerState.snapshot(),session=(await d.AppData.activeSession.load()).value,reviews=(await d.AppData.pendingReviews.list()).filter(row=>!row.resolvedAt);
  const state=session?.snapshot?.taskState||{};
  return {mode:t.mode,loop:d.TimerEngine.status().loopActive,done:Object.keys(state).filter(id=>state[id]?.resolvedState==='done').sort(),current:String(session?.snapshot?.currentTaskId||''),
    owner:String(session?.runningOn||''),status:String(session?.status||''),timer:session?.snapshot?.timerRuntime?session.snapshot.timerRuntime.mode+' '+session.snapshot.timerRuntime.taskId:'none',
    panel:document.getElementById('session-panel')?.checkVisibility()?document.getElementById('session-panel-title').textContent:'',countdown:document.getElementById('cd')?.textContent||'',
    reviews:reviews.map(row=>row.subject+':'+row.ref)};})()`);
export const noteOf=(page,key)=>page.evaluate(`(()=>{const note=__PWA6.AppData.notes.get(${JSON.stringify(key)});return note?String(note.text||''):null;})()`);
export const writeNote=async(page,key,text)=>{await page.evaluate(`(async()=>{const d=__PWA6;d.AppData.notes.update(${JSON.stringify(key)},${JSON.stringify(key)},${JSON.stringify(text)},'');await d.AppData.notes.flush({strict:true});})()`);assert.equal(await page.evaluate(`String(__PWA6.AppData.notes.get(${JSON.stringify(key)})?.text||'')`),text,`the note ${key} is saved`);};
// What going to the background does: waiting changes go out at once. A
// change made while a sync was running waits for the next flush, so this
// flushes until nothing waits.
export const upload=async page=>{for(let attempt=0;attempt<4;attempt++){await page.evaluate(`__PWA6.BackupProviderRuntime.flushAutomatic('app-hidden').then(()=>true,()=>false)`);if(!await waiting(page))return true;await sleep(500);}return false;};
export const syncNow=page=>page.evaluate(`__PWA6.BackupProviderRuntime.scheduleSharedSync('google-drive','qa-journey')`);
export const settled=async(page,label,timeout=90000)=>waitFor(async()=>!markers()&&!await waiting(page)&&!(await sync(page))?.catchingUp,{label:`${label} settles`,timeout});
// Continue Here as a person presses it: the Execute card's button.
export async function continueHere(page,who,{mode='running'}={}){
  await waitFor(()=>page.evaluate(`(()=>{const button=[...document.querySelectorAll('[data-action="restore-session"]')].find(item=>!item.hidden);return !!button&&!button.disabled;})()`),{label:`${who}: Continue Here offered`,timeout:60000});
  const started=Date.now();
  await page.evaluate(`(async()=>{${acceptDialogs}__PWA6.goTab('execute');await new Promise(r=>setTimeout(r,100));document.getElementById('execute-session-action').click();})()`);
  await waitFor(async()=>(await view(page)).mode===mode,{label:`${who}: Continue Here continues the timer (${mode})`,timeout:30000});
  return Date.now()-started;
}
// The old owner stops within one session check (10 s) of the claim.
export const stopsWithin=async(page,who,timeout=20000)=>{const started=Date.now();await waitFor(async()=>!(await view(page)).loop,{label:`${who} stops its timer`,timeout});return Date.now()-started;};
export const markDone=page=>page.evaluate(`(async()=>{const d=__PWA6;d.goTab('execute');await new Promise(r=>setTimeout(r,80));d.markDone();await new Promise(r=>setTimeout(r,400));await d.flushLiveDraft();return d.TimerState.snapshot().currentIndex;})()`);

// The day's session. Each Continue Here is checked the same way: the timer
// runs on the device that pressed it within seconds, without Sync now; the
// other device stops within one claim check; nothing studied on either
// device is lost; and a handoff keeps nothing for review: time alone is
// never a choice, and a block either device finished is taken in.
export const owner=async page=>(await view(page)).owner;
export const running=async page=>{const row=await view(page);return row.mode==='running'&&row.loop;};
export const elsewhere=async(page,who)=>{await syncNow(page);await waitFor(async()=>(await view(page)).panel==='Running on Another Device',{label:`${who} shows the session running elsewhere`,timeout:60000});};
export const bothSettled=async(devices,label)=>{for(const [who,page] of devices)await settled(page,`${label}: ${who}`);};
export const noReviews=async(devices,label)=>{for(const [who,page] of devices)assert.deepEqual((await view(page)).reviews,[],`${label}: nothing is kept for review on ${who}`);};
// A block done on one device reaches the other, with nothing kept for review.
export const keeps=async(page,who,block,label)=>{
  await waitFor(async()=>{const row=await view(page);if(row.done.includes(block))return true;await syncNow(page);return false;},{label:`${label}: ${block} done reaches ${who}`,timeout:60000,interval:3000});
  assert.deepEqual((await view(page)).reviews,[],`${label}: nothing is kept for review on ${who}`);return 'merged';
};
// What a failing journey prints: each device's session, its kept session
// versions against its current one, and its view of the claim.
export async function explain(devices){
  for(const [who,page] of devices)if(page){
    console.error(who,JSON.stringify(await view(page).catch(cause=>String(cause?.message||cause))));
    console.error(who,'control',JSON.stringify(await page.evaluate(`({canMutate:__PWA6.AppOwnership.canMutate(),visibility:document.visibilityState,locks:Object.keys(localStorage).filter(key=>/lock|lease|mutation/iu.test(key)).map(key=>[key,localStorage.getItem(key)]),now:Date.now()})`).catch(cause=>String(cause?.message||cause))));
    console.error(who,'after wake',JSON.stringify(await page.evaluate(`(async()=>{const job=()=>__PWA6.BackupProviderRuntime.backgroundStatus().find(row=>row.job==='google-drive convergence');const before=job();__PWA6.BackupProviderRuntime.wakeBackground('qa-diagnostic');await new Promise(r=>setTimeout(r,3000));return {before:before&&before.reason,after:job()&&[job().state,job().reason]};})()`).catch(cause=>String(cause?.message||cause))));
    console.error(who,'sync',JSON.stringify(await page.evaluate(`({background:__PWA6.BackupProviderRuntime.backgroundStatus(),location:__PWA6.BackupProviderRuntime.locationStatus('google-drive'),startup:__PWA6.StartupLifecycle.status(),ownership:__PWA6.AppOwnership.status(),sync:__PWA6.BackupProviderRuntime.diagnosticSync(),waiting:__PWA6.BackupProviderRuntime.automaticWaiting(),now:new Date().toISOString(),card:document.getElementById('drive-connect-status')?.textContent||''})`).catch(cause=>String(cause?.message||cause))));
    console.error(who,'review diff',JSON.stringify(await page.evaluate(`(async()=>{const d=__PWA6,rows=(await d.AppData.pendingReviews.list()).filter(row=>!row.resolvedAt&&row.subject==='session'),current=(await d.AppData.activeSession.load()).value;
      const diff=(x,y,prefix='')=>{const out=[];if(JSON.stringify(x)===JSON.stringify(y))return out;if(!x||!y||typeof x!=='object'||typeof y!=='object')return [prefix+': '+JSON.stringify(x)?.slice(0,160)+' | '+JSON.stringify(y)?.slice(0,160)];for(const key of new Set([...Object.keys(x),...Object.keys(y)]))out.push(...diff(x[key],y[key],prefix+'.'+key));return out;};
      return rows.map(row=>({keptFrom:row.keptFrom,diffKeptVsCurrent:diff(row.kept?.snapshot,current?.snapshot).slice(0,30)}));})()`).catch(cause=>String(cause?.message||cause))));
    console.error(who,'personal review',JSON.stringify(await page.evaluate(`(async()=>{const d=__PWA6,rows=(await d.AppData.pendingReviews.list()).filter(row=>!row.resolvedAt&&row.subject==='personal'),current=await d.PlanData.exportData({flush:false});
      const diff=(x,y,prefix='')=>{const out=[];if(JSON.stringify(x)===JSON.stringify(y))return out;if(!x||!y||typeof x!=='object'||typeof y!=='object')return [prefix+': '+JSON.stringify(x)?.slice(0,200)+' | '+JSON.stringify(y)?.slice(0,200)];for(const key of new Set([...Object.keys(x),...Object.keys(y)]))out.push(...diff(x[key],y[key],prefix+'.'+key));return out;};
      return rows.map(row=>({origin:row.origin,diffKeptVsCurrent:diff(row.kept,current).slice(0,20)}));})()`).catch(cause=>String(cause?.message||cause))));
    console.error(who,'warnings',JSON.stringify((page.warnings||[]).slice(-12)));
    console.error(who,'session saves',JSON.stringify(await page.evaluate('window.__sessionWrites||[]').catch(cause=>String(cause?.message||cause)),null,1));
    console.error(who,'claim',JSON.stringify(await page.evaluate(`(async()=>({visibility:document.visibilityState,online:navigator.onLine,claim:await __PWA6.BackupProviderRuntime.readSessionClaim('google-drive').catch(error=>({error:String(error?.code||error?.message)}))}))()`).catch(cause=>String(cause?.message||cause))));
  }
}
