import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {faults,ledger,noteText,sync,open,connect,markers,uploadsBy,waiting,sleep} from '../../helpers/drive-browser.mjs';

// Versions kept for review travel between devices and their resolution wins
// (Entry 022). Two browsers share one simulated Google Drive. Both edit the
// same note, so B's sync shows A's text and keeps B's for review. B resolves
// what it kept and uploads; A then takes in the resolved reviews, including
// one A still holds open. Before the fix that catch-up failed at
// restore-pending-reviews, rolled back and retried every few seconds.

const server=await startReleaseServer();
const first=await launchChromium({profilePrefix:'sd-kept-a-'}),second=await launchChromium({profilePrefix:'sd-kept-b-'});
const reviews=page=>page.evaluate(`__PWA6.AppData.pendingReviews.list()`);
const edit=(page,text)=>page.evaluate(`(async()=>{const notes=__PWA6.AppData.notes;notes.update('ethics','Ethics',${JSON.stringify(text)},notes.get('ethics')?.updatedAt||'');await notes.flush({strict:true});})()`);
// A device looks at Drive again when it comes back to the front a minute or
// more after its last check.
async function refocus(page){
  for(let wait=1;wait>0;){wait=(Date.parse((await sync(page)).checkedAt)||0)+61000-Date.now();if(wait>0)await sleep(wait);}
  const before=(await sync(page)).checkedAt;
  await page.evaluate(`window.dispatchEvent(new Event('focus'))`);
  await waitFor(async()=>{const state=await sync(page);return state.checkedAt!==before&&!state.catchingUp;},{label:'sync check after focus',timeout:60000});
}
try{
  const a=await open(first,server,'A');
  await edit(a,'Shared line');
  await connect(a,'A');
  await waitFor(async()=>!!(await sync(a))?.syncedAt,{label:'A synced',timeout:60000});
  const b=await open(second,server,'B');
  await connect(b,'B');
  await waitFor(async()=>/Shared line/u.test(await noteText(b,'ethics')||''),{label:'B receives the note',timeout:60000});
  await waitFor(async()=>!markers()&&!await waiting(b)&&!await waiting(a),{label:'both settle',timeout:120000});

  // Both edit the note; A's edit reaches Drive first.
  await edit(b,'Edited on B');
  const beforeA=uploadsBy('A');
  await edit(a,'Edited on A');await a.evaluate(`__PWA6.BackupProviderRuntime.flushAutomatic('app-hidden')`);
  await waitFor(async()=>uploadsBy('A')>beforeA&&!await waiting(a),{label:'A uploads its edit',timeout:120000});
  await refocus(b);
  assert.equal(await noteText(b,'ethics'),'Edited on A','B shows the newer edit');
  const kept=(await reviews(b)).filter(review=>!review.resolvedAt);
  assert.ok(kept.some(review=>review.subject==='note'&&review.kept?.text==='Edited on B'),'B keeps its own text for review');

  // B resolves what it kept and uploads the resolution.
  const beforeB=uploadsBy('B');
  await b.evaluate(`(async()=>{await __PWA6.AppData.pendingReviews.resolve(${JSON.stringify(kept.map(review=>review.id))});await __PWA6.BackupProviderRuntime.flushAutomatic('app-hidden');})()`);
  await waitFor(async()=>uploadsBy('B')>beforeB&&!await waiting(b),{label:'B uploads the resolution',timeout:120000});

  // A takes in the resolved reviews: one it already holds open is resolved
  // too, and the catch-up completes rather than rolling back.
  const openOnA=(await reviews(a)).filter(review=>!review.resolvedAt).map(review=>review.id);
  const syncedBefore=(await sync(a)).syncedAt;
  await refocus(a);
  const state=await sync(a);
  assert.equal(state.behind,false,'A is in step with Drive');
  assert.notEqual(state.syncedAt,syncedBefore,'A completes a sync after B resolves its kept versions');
  const onA=new Map((await reviews(a)).map(review=>[review.id,review]));
  for(const review of kept)assert.ok(onA.get(review.id)?.resolvedAt,`A holds review ${review.id} as resolved`);
  for(const id of openOnA)if(kept.some(review=>review.id===id))assert.ok(onA.get(id).resolvedAt,'a review A held open is resolved by B\'s resolution');
  assert.equal(state.needsReview,false,'nothing waits for the person on A');

  assert.deepEqual(faults,[],'every Drive request was well formed');
  const errors=[...a.events,...b.events].filter(event=>/startup\.initialize|Uncaught/u.test(String(event.text||'')));
  assert.deepEqual(errors.map(event=>String(event.text).slice(0,200)),[],'no start-up or uncaught errors');
  console.log(JSON.stringify({status:'PASS',kept:kept.length,heldOpenOnA:openOnA.length}));
}catch(error){
  console.error(JSON.stringify({faults:faults.slice(0,10),drive:ledger.slice(-40)},null,1));
  throw error;
}finally{
  await first.close();await second.close();await server.close();
}
