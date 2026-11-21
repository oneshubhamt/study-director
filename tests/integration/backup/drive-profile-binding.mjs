import assert from 'node:assert/strict';
import {assertOperationalFormat} from '../../helpers/operational-format.mjs';
import {createDriveHarness,QA_PROFILE_ID} from '../../helpers/drive-harness.mjs';

// A Drive library belongs to one profile (5.3). Once per sign-in the app is
// told the account and what the folder holds and settles it: its own folder
// continues, a library from another device can be
// taken over, and anything else is refused without touching it.
const MARKER='studyDirectorProfile',OTHER='prof_ana_mvd00000_0000abcd';
const cases=[];
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
async function connected(options={}){const harness=createDriveHarness(options);await harness.provider.prepare();await harness.provider.authorize();return harness;}
const patches=state=>state.requests.filter(request=>request.method==='PATCH').length;

{
  // A new account: the folder is made already marked for this profile.
  const {state,provider}=await connected();
  await provider.repository.list({kind:'object'});
  assert.equal(state.folders.length,1);assert.equal(state.folderProperties.get(state.folders[0])[MARKER],QA_PROFILE_ID,'a new folder carries the profile id');
  assert.equal(state.binds.length,1);assert.equal(state.binds[0].mine,true);assert.equal(state.binds[0].email,'qa@example.com','the app learns the account email');assert.equal(state.binds[0].library,null,'its own folder is not read for a library');
  assertOperationalFormat('driveLibrary',state.folderWrites[0]);
  assert.equal(patches(state),0);
  await provider.repository.list({kind:'checkpoint'});await provider.repository.list({kind:'commit'});
  assert.equal(state.binds.length,1,'the folder is settled once per sign-in');
  cases.push('a new folder is made for the profile');
}
{
  for(const properties of [{},{[MARKER]:'invalid'},{[MARKER]:QA_PROFILE_ID,unrecognized:'true'}]){
    const {state,provider}=await connected({bind:async()=>'claim'});
    state.folders.push('folder-9');state.folderProperties.set('folder-9',properties);
    await assert.rejects(provider.repository.list({kind:'object'}),error=>error.studyDirectorProfileRefused===true);
    assert.equal(state.binds.length,0);
    assert.equal(state.requests.some(r=>r.method!=='GET'||decodeURIComponent(r.url).includes(' in parents')),false);
    assert.deepEqual(state.folderProperties.get('folder-9'),properties);
    assert.equal(state.folders.length,1);
  }
  cases.push('missing or invalid profile identity refuses all library access');
}
{
  // The same person's library from another device: this profile takes its id.
  let current=QA_PROFILE_ID;
  const harness=createDriveHarness({profileId:()=>current,bind:async info=>{if(info.found===OTHER){current=OTHER;return 'adopt';}return 'refuse';}});const {state,provider}=harness;
  state.folders.push('folder-5');state.folderProperties.set('folder-5',{[MARKER]:OTHER});
  await provider.prepare();await provider.authorize();await provider.repository.list({kind:'object'});
  assert.equal(state.binds.length,1);assert.equal(state.binds[0].found,OTHER);assert.equal(state.binds[0].mine,false);
  assert.equal(patches(state),0,'the library mark is kept as it is');
  await provider.repository.list({kind:'object'});assert.equal(state.binds.length,1,'after taking the id the folder is this profile');
  cases.push('a library from another device can be continued');
}
{
  // Another profile on this device owns the library: refused, nothing changed, and the sign-in is forgotten.
  const {state,provider}=createDriveHarness({bind:async()=>'refuse'});
  state.folders.push('folder-7');state.folderProperties.set('folder-7',{[MARKER]:OTHER});
  await provider.prepare();await provider.authorize();
  await assert.rejects(provider.repository.list({kind:'object'}),error=>error.studyDirectorProfileRefused===true&&/another profile/u.test(error.message));
  assert.equal(patches(state),0);assert.equal(state.folderProperties.get('folder-7')[MARKER],OTHER,'the other library is never touched');
  assert.equal(state.requests.filter(request=>request.method==='POST'||request.method==='DELETE').length,0,'nothing is written');
  await settle();assert.equal(provider.connected(),false,'Connect offers the choice of account again');
  cases.push('another profile library is refused untouched');
}
{
  const {state,provider}=await connected();
  await provider.repository.list({kind:'object'});
  state.folderProperties.set(state.folders[0],{});
  await assert.rejects(provider.repository.list({kind:'object'}),/no valid profile identity/u);
  assert.equal(state.binds.length,1);assert.equal(patches(state),0);
  cases.push('a changed marker invalidates the cached binding');
}
{
  // A profile still starting cannot use Drive yet.
  const {state,provider}=await connected({profileId:()=>''});
  await assert.rejects(provider.repository.list({kind:'object'}),/still starting/u);
  assert.equal(state.folders.length,0,'no folder is made for it');assert.equal(state.binds.length,0);
  cases.push('a profile still starting waits');
}
{
  // Switching profile in the same page (an id taken over elsewhere) settles the folder again.
  let current=QA_PROFILE_ID;
  const {state,provider}=await connected({profileId:()=>current});
  await provider.repository.list({kind:'object'});assert.equal(state.binds.length,1);
  const operation=provider.repository.beginOperation();await operation.list({kind:'object'});
  current='prof_qa_mve00000_abcdef02';
  await assert.rejects(operation.list({kind:'object'}),/another profile/u,'an operation receipt cannot outlive its profile');
  assert.equal(state.binds.length,2);
  cases.push('a changed profile id settles the folder again');
}
{
  // The library folder is named after its profile, and follows a rename once per sign-in.
  let name='Study Director – Ana';
  const {state,provider}=await connected({profileName:()=>name});
  await provider.repository.list({kind:'object'});
  assert.equal(state.folderNames.get(state.folders[0]),'Study Director – Ana','a new folder carries the profile name');assert.equal(patches(state),0);
  name='Study Director – Ana M';
  await provider.repository.list({kind:'object'});assert.equal(patches(state),0,'a rename waits for the next sign-in');
  await provider.disconnect();await provider.authorize();await provider.repository.list({kind:'object'});
  assert.equal(state.folderNames.get(state.folders[0]),'Study Director – Ana M');assert.equal(patches(state),1);
  assert.equal(state.folders.length,1,'the same folder is used: the name never says whose it is');
  cases.push('the folder is named after its profile');
}
{
  // A failed rename of the current library can retry on the next sign-in.
  const harness=createDriveHarness({profileName:()=>'Study Director – Ben'});const {state,provider}=harness;
  state.folders.push('folder-3');state.folderProperties.set('folder-3',{[MARKER]:QA_PROFILE_ID});state.folderRenameFails=true;
  await provider.prepare();await provider.authorize();await provider.repository.list({kind:'object'});
  assert.equal(state.folderProperties.get('folder-3')[MARKER],QA_PROFILE_ID);assert.equal(state.folderNames.has('folder-3'),false,'the old name stays when Drive refuses the rename');
  state.folderRenameFails=false;await provider.disconnect();await provider.authorize();await provider.repository.list({kind:'object'});
  assert.equal(state.folderNames.get('folder-3'),'Study Director – Ben','the next sign-in names it');
  cases.push('a profile folder is renamed, and a failed rename is harmless');
}
{
  // Delete everywhere: a marker first, then the library goes to the Drive Trash.
  const {state,provider}=await connected({profileName:()=>'Study Director – Ana'});
  await provider.repository.list({kind:'object'});const library=state.folders[0];
  assert.equal(typeof state.libraryControl?.deleteLibrary,'function','the app is handed what it can do with the library');
  assert.equal(await state.libraryControl.deleteLibrary(),true);
  assertOperationalFormat('driveDeletion',state.folderWrites.at(-1));
  assert.deepEqual(state.deletionMarkers.map(row=>[row.name,row.profile]),[['Study Director – Ana (deleted)',QA_PROFILE_ID]]);
  assert.equal(state.trashedFolders.has(library),true,'the library is in the Trash, where it can be brought back');
  await assert.rejects(provider.repository.list({kind:'object'}),error=>error.studyDirectorProfileDeleted===true,'this page never uses the library again');
  assert.equal(state.folders.filter(id=>!state.trashedFolders.has(id)).length,0,'no new library is made');
  cases.push('delete everywhere leaves a marker and trashes the library');
}
{
  // Another device of the same profile: at its next sign-in it learns of the deletion and never makes the library again.
  const harness=createDriveHarness();const {state,provider}=harness;
  state.deletionMarkers.push({id:'marker-9',name:'Study Director – QA (deleted)',profile:QA_PROFILE_ID});
  await provider.prepare();await provider.authorize();
  await assert.rejects(provider.repository.list({kind:'object'}),error=>error.studyDirectorProfileDeleted===true&&/deleted on another device/u.test(error.message));
  await settle();
  assert.deepEqual(state.deletedSignals.map(row=>row.profile),[QA_PROFILE_ID],'the app is told, to remove the profile here');
  assert.equal(state.folders.length,0,'no library is made');assert.equal(provider.connected(),false,'the sign-in is forgotten');
  assert.equal(state.binds.length,0);
  cases.push('another device learns of the deletion at its next sign-in');
}
{
  // A marker for another profile changes nothing.
  const harness=createDriveHarness();const {state,provider}=harness;
  state.deletionMarkers.push({id:'marker-8',name:'Study Director – Ben (deleted)',profile:OTHER});
  await provider.prepare();await provider.authorize();await provider.repository.list({kind:'object'});
  assert.equal(state.folders.length,1);assert.equal(state.deletedSignals.length,0);
  cases.push('another profile’s marker is ignored');
}
{
  const incomplete=await connected();incomplete.state.folderListIncomplete=true;
  await assert.rejects(incomplete.provider.repository.list({kind:'object'}),/complete folder listing/u);
  assert.equal(incomplete.state.folderWrites.length,0);
  const pending=await connected();await pending.provider.repository.list({kind:'object'});pending.state.deletionMarkerMetadata={shared:true};
  await assert.rejects(pending.state.libraryControl.deleteLibrary(),/unverified profile deletion/u);assert.equal(pending.state.trashedFolders.size,0);
  for(const metadata of [{shared:true},{ownedByMe:false},{trashed:true},{mimeType:'text/plain'},{appProperties:{studyDirectorDeletedProfile:QA_PROFILE_ID,studyDirectorFolder:'true'}}]){
    const {provider,state}=await connected();
    state.deletionMarkers.push({id:'unknown',profile:QA_PROFILE_ID,metadata});
    await assert.rejects(provider.repository.list({kind:'object'}),/unverified profile deletion/u);
    assert.equal(state.deletedSignals.length,0);assert.equal(state.folders.length,0);
    assert.ok(state.requests.every(r=>r.method==='GET'));
  }
  const {state}=await connected();
  state.folders.push('old');state.folderProperties.set('old',{});
  await assert.rejects(state.libraryControl.deleteLibrary(),/does not identify/u);
  assert.equal(state.deletionMarkers.length,0);assert.equal(state.trashedFolders.size,0);
  cases.push('unverified markers and unidentified libraries cannot authorize profile deletion');
}
console.log(JSON.stringify({status:'PASS',suite:'drive-profile-binding',cases},null,2));
