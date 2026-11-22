import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {uploadsBy,sync,sleep} from '../../helpers/drive-browser.mjs';
import {openDevice,settled} from '../../helpers/sync-journey-world.mjs';

// Typing goes up once it pauses (owner, 2026-11-22): a note or a reflection
// being written is uploaded 10 s after its last save, never while the person
// types. Before, a note waited up to 20 minutes, and a reflection typed on a
// day with no study session was a key moment at every save, so it uploaded
// every few seconds while it was typed.
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'sd-typing-pause-'});
const result={status:'PASS',suite:'typing-upload-pause',checks:{}};
// Saves every 3 s for 9 s: nothing goes up meanwhile, then one upload 10 s
// after the last save.
async function typed(page,label,edit){
  const before=uploadsBy('A');
  for(let index=0;index<4;index++){await edit(index);if(index<3)await sleep(3000);}
  const last=Date.now();
  assert.equal(uploadsBy('A'),before,`${label}: nothing goes up while typing`);
  let uploadedAt=0;
  await waitFor(()=>{if(uploadsBy('A')>before)uploadedAt=Date.now();return uploadedAt>0;},{label:`${label}: goes up after the pause`,timeout:40000,interval:250});
  const delay=uploadedAt-last;
  assert.ok(delay>=8000,`${label}: not before the pause (went up ${delay} ms after the last edit)`);
  assert.ok(delay<=30000,`${label}: soon after the pause (${delay} ms)`);
  await settled(page,'A');
  assert.equal(uploadsBy('A'),before+1,`${label}: one upload for the whole edit`);
  return delay;
}
// One note edited again and again, as typing saves it.
const editNote=(page,key,text)=>page.evaluate(`(async()=>{const d=__PWA6,current=d.AppData.notes.get(${JSON.stringify(key)});d.AppData.notes.update(${JSON.stringify(key)},${JSON.stringify(key)},${JSON.stringify(text)},String(current?.updatedAt||''));await d.AppData.notes.flush({strict:true});return String(d.AppData.notes.get(${JSON.stringify(key)})?.text||'');})()`).then(saved=>assert.equal(saved,text,'the note edit is saved: '+JSON.stringify(saved)));
let a=null;
try{
  a=await openDevice(browser,server,'A');
  await a.evaluate(`document.querySelector('[data-action="connect-drive-backup"]').click()`);
  await waitFor(()=>a.evaluate(`__PWA6.BackupProviderRuntime.connected('google-drive')`),{label:'connected',timeout:20000});
  await waitFor(async()=>!!(await sync(a))?.syncedAt,{label:'first sync',timeout:60000});await settled(a,'A');
  result.checks.noteDelayMs=await typed(a,'note',index=>editNote(a,'typing pause',`Line ${index}`));
  // Today's reflection with no study session: its saves are Saved Day writes.
  const editable='.pane.on .sd-rte[data-sd-rich-surface="reflection"] [contenteditable="true"]';
  await a.evaluate(`__PWA6.goTab('review')`);
  await waitFor(()=>a.evaluate(`!!document.querySelector(${JSON.stringify(editable)})`),{label:'reflection editor'});
  await a.click(editable);
  result.checks.reflectionDelayMs=await typed(a,'reflection',async index=>{await a.send('Input.insertText',{text:`word${index} `});await sleep(400);});
  assert.match(await a.evaluate(`String(__PWA6.ReviewEditor.contentForDate(__PWA6.todayISO()))`),/word3/u,'the reflection holds what was typed');
  console.log(JSON.stringify(result,null,2));
}finally{await browser.close();await server.close();}
