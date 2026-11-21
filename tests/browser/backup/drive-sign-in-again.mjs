import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {drive,uploadsBy,reopen,sync,sleep} from '../../helpers/drive-browser.mjs';
import {openDevice,settled,writeNote} from '../../helpers/sync-journey-world.mjs';

// Signing in to Google Drive again (owner, 2026-11-21). A profile syncs with
// one Google account: after its first connect, signing in again goes straight
// to that account (no account chooser, also after a reload), the card shows
// the sign-in alone and closes, changes made while signed out go up at once,
// another account is refused before Drive is used, and Disconnect signs only
// this device out.
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'sd-sign-in-again-'});
const result={status:'PASS',suite:'drive-sign-in-again',checks:{}};
const tap=page=>page.evaluate(`document.querySelector('[data-action="connect-drive-backup"]').click()`);
const connected=page=>page.evaluate(`__PWA6.BackupProviderRuntime.connected('google-drive')`);
const lastRequest=page=>page.evaluate(`(()=>{const last=window.__gisRequests.at(-1);return last?{prompt:last.prompt,login_hint:last.login_hint||''}:null;})()`);
const card=page=>page.evaluate(`(()=>{const root=document.getElementById('drive-connect-card');return !root||root.hidden?null:{title:document.getElementById('drive-connect-title').textContent,status:document.getElementById('drive-connect-status').textContent,steps:root.querySelectorAll('#drive-connect-steps li').length};})()`);
const profileEmail=page=>page.evaluate(`__PWA6.Profiles.current()?.email||''`);
// The sign-in running out: the same clearSession() the expiry timer runs,
// reached here through the stored sign-in going away.
const signOut=async page=>{
  await page.evaluate(`(()=>{const key=Object.keys(localStorage).find(name=>name.includes('driveSession'));const old=localStorage.getItem(key);localStorage.removeItem(key);window.dispatchEvent(new StorageEvent('storage',{key,oldValue:old,newValue:null}));})()`);
  await waitFor(async()=>!await connected(page),{label:'signed out'});
};
let a=null;
try{
  a=await openDevice(browser,server,'A');
  // First connect: Google's account chooser, then the full card.
  await tap(a);await waitFor(()=>connected(a),{label:'first connect',timeout:20000});
  assert.deepEqual(await lastRequest(a),{prompt:'select_account',login_hint:''},'a first connect lets the person choose the account');
  await waitFor(async()=>!!(await sync(a))?.syncedAt,{label:'first sync',timeout:60000});await settled(a,'A');
  const email=await profileEmail(a);assert.equal(email,drive.state.email,'the profile keeps the account it synced with');
  await waitFor(async()=>!await card(a),{label:'the first-connect card closes',timeout:20000});
  result.checks.firstConnectChoosesAccount=true;

  // Signing in again soon after: straight to the profile's account, the card
  // shows the sign-in alone and closes; no sync is started for it.
  const syncedAt=(await sync(a)).syncedAt,uploads=uploadsBy('A');
  await signOut(a);await tap(a);
  await waitFor(()=>connected(a),{label:'signed in again',timeout:20000});
  assert.deepEqual(await lastRequest(a),{prompt:'',login_hint:email},'signing in again goes straight to the profile account');
  await waitFor(async()=>(await card(a))?.title==='Signed in to Google Drive',{label:'the card says signed in',timeout:10000});
  assert.equal((await card(a)).steps,1,'the card shows the sign-in alone');
  await waitFor(async()=>!await card(a),{label:'the card closes by itself',timeout:15000});
  assert.equal((await sync(a)).syncedAt,syncedAt,'nothing was due, so no sync ran');assert.equal(uploadsBy('A'),uploads);
  result.checks.signInAgainIsOneTap=true;result.checks.cardClosesAfterSignIn=true;

  // Changes made while signed out go up as soon as the sign-in is back.
  await signOut(a);await writeNote(a,'while-signed-out','written while signed out');
  await tap(a);await waitFor(()=>connected(a),{label:'signed in with changes waiting',timeout:20000});
  await waitFor(()=>uploadsBy('A')>uploads,{label:'the waiting changes upload at once',timeout:30000});await settled(a,'A');
  result.checks.waitingChangesUploadAtOnce=true;

  // After a reload the sign-in still goes straight to the profile's account.
  await signOut(a);await a.evaluate('location.reload()');await reopen(a,'A reopened');
  await tap(a);await waitFor(()=>connected(a),{label:'signed in after a reload',timeout:20000});
  assert.deepEqual(await lastRequest(a),{prompt:'',login_hint:email},'after a reload too');
  await settled(a,'A');
  result.checks.oneTapAfterReload=true;

  // Another Google account is refused before Drive is used: nothing is made
  // in it, and the profile keeps its account.
  await signOut(a);const folders=drive.state.folders.length,files=drive.state.files.size;drive.state.email='someone.else@example.com';
  await tap(a);
  await waitFor(async()=>/This profile syncs with/u.test((await card(a))?.status||''),{label:'the other account is refused',timeout:20000});
  await waitFor(async()=>!await connected(a),{label:'the other account is signed out'});
  assert.equal(drive.state.folders.length,folders,'no library is made in the other account');assert.equal(drive.state.files.size,files,'nothing is written');
  assert.equal(await profileEmail(a),email,'the profile keeps its account');
  drive.state.email=email;
  await tap(a);await waitFor(()=>connected(a),{label:'signed in with the right account',timeout:20000});await settled(a,'A');
  result.checks.otherAccountRefused=true;

  // Disconnect signs this device out only: Google's permission is kept, and
  // connecting again goes straight back to the profile's account.
  // Disconnect waits while Drive work runs (it returns false then), as a tap would.
  await waitFor(()=>a.evaluate(`__PWA6.BackupProviderRuntime.disconnect('google-drive').then(done=>done===true)`),{label:'Disconnect',timeout:30000});
  assert.equal(await connected(a),false);assert.equal(await a.evaluate('window.__gisRevokes'),0,'Disconnect keeps Google\'s permission for the other devices');
  await sleep(200);await tap(a);await waitFor(()=>connected(a),{label:'connected again after Disconnect',timeout:20000});
  assert.deepEqual(await lastRequest(a),{prompt:'',login_hint:email},'connecting again after Disconnect goes to the profile account');
  await settled(a,'A');
  result.checks.disconnectIsThisDeviceOnly=true;
  console.log(JSON.stringify(result,null,2));
}finally{await browser.close();await server.close();}
