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
  // The kept version names the device whose copy held it, by its installation ID.
  const ownKept=kept.find(review=>review.subject==='note');
  assert.match(ownKept.keptFrom,/^inst_[a-z]+_[a-z]+_[a-z0-9]+_[a-f0-9]{8}$/u,'the kept version records its device');assert.ok(Number.isFinite(Date.parse(ownKept.keptChangedAt)),'and when that copy changed it');
  // The review names it the way backup folders do: here, this device.
  await b.evaluate(`void __PWA6.BackupController.reviewKeptVersions()`);
  const keptLabel=`document.querySelector('.sd-note-reconcile-pane-incoming .sd-note-reconcile-pane-sub')?.textContent||''`;
  await waitFor(async()=>/^Kept from this device · /u.test(await b.evaluate(keptLabel)),{label:'B’s review names this device',timeout:20000});
  await b.evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='Cancel'&&button.offsetParent!==null)?.click()`);
  await waitFor(async()=>!(await b.evaluate(keptLabel)),{label:'B closes the review',timeout:20000});
  // The profile indicator shows the review as a yellow badge on every screen size.
  await waitFor(()=>b.evaluate(`['profile-tag','profile-badge'].every(id=>document.getElementById(id).dataset.badge==='review')`),{label:'B shows the review badge',timeout:20000});
  assert.match(await b.evaluate(`document.getElementById('profile-badge').getAttribute('aria-label')`),/kept versions? to review/u,'the phone circle names what waits for review');
  // It pops up once when it first appears (phase 4), with Review.
  const keptToast=`[...document.querySelectorAll('#sd-toast-region .interaction-toast')].filter(node=>node.textContent.includes('Kept for review')).map(node=>({text:node.textContent,review:[...node.querySelectorAll('button')].some(button=>button.textContent==='Review')}))`;
  await waitFor(async()=>(await b.evaluate(keptToast)).length===1,{label:'B pops up the kept version',timeout:20000});
  assert.equal((await b.evaluate(keptToast))[0].review,true,'the pop-up offers Review');
  const firstDelivery=await b.evaluate(`__PWA6.NoticeCoordinator.readEvent('sync','kept-new')?.deliveryId`);

  await waitFor(async()=>!await waiting(b),{label:'B settles after its catch-up',timeout:120000});
  assert.equal(await b.evaluate(`__PWA6.NoticeCoordinator.readEvent('sync','kept-new')?.deliveryId`),firstDelivery,'later refreshes do not pop it up again');

  // B resolves what it kept and uploads the resolution.
  const beforeB=uploadsBy('B');
  await b.evaluate(`(async()=>{await __PWA6.AppData.pendingReviews.resolve(${JSON.stringify(kept.map(review=>review.id))});await __PWA6.BackupProviderRuntime.flushAutomatic('app-hidden');})()`);
  await waitFor(async()=>uploadsBy('B')>beforeB&&!await waiting(b),{label:'B uploads the resolution',timeout:120000});
  await waitFor(()=>b.evaluate(`!__PWA6.NoticeCoordinator.readEvent('sync','kept-new')`),{label:'B clears the pop-up once nothing is kept',timeout:20000});

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
