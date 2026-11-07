import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// The profile indicator (ring and badge on the phone circle, the sidebar name
// and the profile panel) replaces the sidebar's sync text and the phone dot.
// Every case those covered, and each new one, is checked here row by row.
for(const file of ['source/core/internal.js','source/core/notice-coordinator.js','source/core/backup-presentation.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const notifications=registry.require('notice-coordinator',1).createCoordinator(Object.freeze({setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},clearTimeout}));
const presentation=registry.require('backup-presentation',1).createPresentation(Object.freeze({notifications,timeLabel:at=>String(at).slice(11,16)}));

const SYNCED='2026-11-01T12:04:00.000Z';
const drive=(patch={},sync={})=>({connected:true,setUp:true,busy:false,backingUp:false,waiting:false,locked:false,retryBackoffCapped:false,stalled:false,foregroundKind:'',nextEligibleAt:'',...patch,sync:{syncedAt:SYNCED,review:false,password:false,newer:false,failed:false,syncing:false,turnWaits:0,...sync}});
const status=input=>presentation.status({online:true,kept:0,storage:[],...input});
const actions=new Set(['retry','sign-in','unlock-sync','enter-password','check-update','review-sync','review-kept','device-permission','open-data','open-execute','continue-session','apply-update']);
function check(name,input,expected){
  const result=status(input);
  for(const key of ['ring','badge','count','slow'])if(key in expected)assert.equal(result[key],expected[key],`${name}: ${key}`);
  if(expected.label)assert.match(result.label,expected.label,`${name}: label "${result.label}"`);
  if(expected.headline)assert.match(result.headline,expected.headline,`${name}: headline "${result.headline}"`);
  if('detail' in expected)assert.match(result.detail,expected.detail,`${name}: detail "${result.detail}"`);
  if('action' in expected)assert.equal(result.action?.action||'',expected.action,`${name}: primary action`);
  if(expected.items)assert.deepEqual(result.items.map(item=>item.action),expected.items,`${name}: item actions`);
  for(const item of result.items){assert.ok(actions.has(item.action),`${name}: the host handles ${item.action}`);assert.ok(item.text&&item.short&&item.actionLabel,`${name}: ${item.id} has text and a button`);}
  assert.ok(result.label&&result.headline,`${name}: always says something`);
  return result;
}

// Every case the sidebar text line covered.
check('Syncing… (catch-up)',{drive:drive({},{syncing:true})},{ring:'syncing',badge:'',label:/^Syncing/u,action:''});
check('Syncing… (upload)',{drive:drive({backingUp:true})},{ring:'syncing',label:/^Syncing · uploading/u,action:''});
check('Synced 12:04',{drive:drive()},{ring:'synced',badge:'',label:/^Synced 12:04$/u,headline:/up to date/u,detail:/return to the app/u,action:'sync-now',items:[]});
check('Changes since 12:04',{drive:drive({waiting:true,nextEligibleAt:'2026-11-01T12:24:00.000Z'})},{ring:'pending',badge:'',label:/^Changes since 12:04$/u,detail:/^Uploads by 12:24, or when you leave the app\.$/u,action:'sync-now'});
check('Last synced 12:04',{drive:drive({nextEligibleAt:'2026-11-01T12:10:00.000Z'},{failed:true})},{ring:'pending',badge:'',label:/^Last synced 12:04 · retrying$/u,detail:/Next try at 12:10/u,action:'sync-now'});
check('Needs password (changed on another device)',{drive:drive({},{password:true})},{ring:'blocked',badge:'lock',label:/^Needs password$/u,action:'',items:['unlock-sync']});
check('Needs review (sync)',{drive:drive({},{review:true})},{ring:'pending',badge:'review',count:1,label:/^Needs review · Last synced 12:04$/u,items:['review-sync']});
check('Needs review (kept versions)',{drive:drive(),kept:2},{ring:'synced',badge:'review',count:2,label:/^2 kept versions to review · Synced 12:04$/u,items:['review-kept']});
check('Needs app update (Drive newer)',{drive:drive({},{newer:true})},{ring:'blocked',badge:'update',label:/^Needs app update$/u,action:'',items:['check-update']});
check('Needs app update (data held here)',{drive:drive(),newerData:true},{ring:'blocked',badge:'update',label:/^Needs app update$/u,items:['check-update']});
// The phone dot's extra case: the backup password not entered on this device.
check('Password not entered here (Drive)',{drive:drive({locked:true}),passwordNeeded:true},{ring:'blocked',badge:'lock',label:/^Needs password$/u,items:['enter-password']});
check('Password not entered here (no Drive)',{drive:null,passwordNeeded:true},{ring:'off',badge:'lock',label:/^Needs password · Only on this device$/u,items:['enter-password']});

// Cases the text line left blank.
check('Drive not set up',{drive:null},{ring:'off',badge:'',label:/^Only on this device$/u,headline:/Connect Google Drive/u,action:'',items:[]});
check('Drive not set up, Device Folder on',{drive:drive({connected:false,setUp:false}),device:{connected:true,mode:'connected',lastBackupAt:'2026-11-01T11:30:00.000Z'}},{ring:'off',label:/^Only on this device · Device Folder backup 11:30$/u});
check('Signed out',{drive:drive({connected:false})},{ring:'signed-out',badge:'',label:/^Google Drive signed out · last synced 12:04$/u,action:'',items:['sign-in']});
check('Offline',{online:false,drive:drive()},{ring:'offline',label:/^Offline · last synced 12:04$/u,action:''});
check('First sync not finished',{drive:drive({},{syncedAt:''})},{ring:'pending',label:/^Connected · first sync not finished$/u});
{
  // A verified remote checkpoint with a missing local ancestry receipt is
  // NOT "Synced", even if an older timestamp was once a success.
  const pendingAncestry=check('Local ancestry still pending',{
    drive:drive({waiting:true,nextEligibleAt:'2026-11-01T12:14:00.000Z'},
      {syncedAt:'',failed:true})
  },{ring:'pending',badge:'',action:'sync-now'});
  assert.doesNotMatch(pendingAncestry.label,/^Synced /u);
  assert.doesNotMatch(pendingAncestry.headline,/up to date/u);
}

check('Failing after retries',{drive:drive({retryBackoffCapped:true},{failed:true})},{ring:'error',badge:'error',label:/^Sync stopped · last synced 12:04$/u,action:'retry',items:['retry']});
check('Uploads failing after retries',{drive:drive({retryBackoffCapped:true,waiting:true})},{ring:'error',badge:'error',label:/^Sync stopped · last synced 12:04$/u,action:'retry',items:['retry']});
check('Retry running after retries ran out',{drive:drive({retryBackoffCapped:true},{failed:true,syncing:true})},{ring:'syncing'});
check('Another device saving',{drive:drive({},{turnWaits:1})},{ring:'syncing',slow:true,label:/^Waiting for another device/u});
check('Connecting',{drive:{connecting:true}},{ring:'syncing',slow:false,label:/^Connecting Google Drive…$/u});
check('Restoring a version',{drive:drive({busy:true,foregroundKind:'restore-version'})},{ring:'syncing',label:/^Restoring a version…$/u});
check('Slow foreground work',{drive:drive({busy:true,stalled:true,foregroundKind:'backup'})},{ring:'syncing',label:/^Still working/u});
check('Device Folder backing up, no Drive',{drive:null,device:{connected:true,backingUp:true,mode:'connected'}},{ring:'syncing',label:/^Backing up to the Device Folder…$/u});
check('Device Folder permission',{drive:drive(),device:{connected:false,mode:'permission'}},{ring:'synced',badge:'warning',label:/^Device Folder needs permission · Synced 12:04$/u,items:['device-permission']});
check('Device Folder failing',{drive:drive(),device:{connected:true,mode:'connected',retryBackoffCapped:true}},{ring:'synced',badge:'error',items:['open-data']});
check('Storage warning',{drive:drive(),storage:[{source:'repositoryIntegrity',label:'Backup check',message:'Some backup objects failed integrity verification.',level:'warn'}]},{badge:'warning',label:/^Backup check · Synced/u,items:['open-data']});
check('Storage error',{drive:null,storage:[{source:'localStorage.write',label:'Browser storage',message:'Changes may not survive a reload.',level:'error'}]},{ring:'off',badge:'error',items:['open-data']});
check('Backup reminder',{drive:null,reminder:'Backup reminder: the last backup is over a week old.'},{badge:'warning',label:/^No backup in over a week/u,items:['open-data']});
check('Session elsewhere',{drive:drive(),sessionElsewhere:'on Laptop'},{ring:'synced',badge:'',label:/^Synced 12:04 · Today’s session is running on Laptop$/u,items:['open-execute']});
check('Update ready',{drive:drive(),updateReady:true},{ring:'synced',badge:'info',items:['apply-update']});
// News that faded unseen (docs/areas/notifications.md, Recent): the blue info
// badge with its count, last in the label; anything more urgent wins.
const unseenOne=check('One unseen notification',{drive:drive(),unseen:1},{ring:'synced',badge:'info',label:/^Synced 12:04 · 1 new notification$/u,items:[]});
assert.equal(unseenOne.unseen,1);
check('Three unseen notifications',{drive:drive(),unseen:3,updateReady:true},{badge:'info',label:/^Synced 12:04 · Update ready · 3 new notifications$/u,items:['apply-update']});
check('Unseen yields to a review',{drive:drive(),unseen:2,kept:1},{badge:'review',label:/· 2 new notifications$/u});
check('No unseen, no badge',{drive:drive(),unseen:0},{badge:'',label:/^Synced 12:04$/u});

// Phase 4: a session suspended on another device waits here (an offer, no
// badge), and a running catch-up or upload shows its stage and counts.
check('Session ready to continue here',{drive:drive(),sessionReady:'on Laptop'},{ring:'synced',badge:'',label:/^Synced 12:04 · Today’s session is ready$/u,items:['continue-session']});
check('Running elsewhere wins over ready',{drive:drive(),sessionElsewhere:'on Laptop',sessionReady:'on Laptop'},{items:['open-execute']});
check('Catch-up counts',{drive:drive({},{syncing:true}),operation:{kind:'sync',message:'Downloading backup data from Google Drive…',progress:{stage:'download',current:2,total:5,completedBytes:153600,totalBytes:307200}}},{ring:'syncing',label:/^Syncing · bringing in changes…$/u,detail:/^Downloading backup data from Google Drive… · 2 of 5 complete · 150 KB of 300 KB$/u});
check('Upload counts, opening line left out',{drive:drive({backingUp:true}),operation:{kind:'upload',message:'Backing up to Google Drive…',progress:{stage:'upload',current:3,total:4}}},{ring:'syncing',detail:/^3 of 4 complete$/u});
check('No counts while synced',{drive:drive(),operation:{kind:'sync',message:'Downloading…',progress:{current:1,total:2}}},{ring:'synced',detail:/return to the app/u});

// Priorities: a failure outranks a review in the badge and the label; the
// most urgent need comes first, sync health second.
check('Failure and review together',{drive:drive({retryBackoffCapped:true},{failed:true}),kept:1},{ring:'error',badge:'error',label:/^1 kept version to review · Sync stopped/u,items:['retry','review-kept']});
check('Offline outranks signed out',{online:false,drive:drive({connected:false})},{ring:'offline',items:['sign-in']});
check('Password outranks an update',{drive:drive({},{password:true,newer:true})},{ring:'blocked',badge:'lock',items:['unlock-sync','check-update']});

// The Connect Google Drive card (phase 3): steps, live sentence, counts and
// how it ends.
const STARTED=Date.parse('2026-11-01T12:00:00.000Z'),LATER='2026-11-01T12:04:00.000Z';
const card=(input)=>presentation.connectProgress({startedAt:STARTED,online:true,seen:{},...input});
const states=result=>result.steps.map(step=>step.state).join(',');
function checkCard(name,input,expected){
  const result=card(input);
  for(const key of ['tone','title','done'])if(key in expected)assert.equal(result[key],expected[key],`${name}: ${key}`);
  if(expected.status)assert.match(result.status,expected.status,`${name}: status "${result.status}"`);
  if(expected.steps)assert.equal(states(result),expected.steps,`${name}: steps`);
  if(expected.labels)assert.deepEqual(result.steps.map(step=>step.label),expected.labels,`${name}: labels`);
  if('detail' in expected)assert.match(result.detail,expected.detail,`${name}: detail "${result.detail}"`);
  if('fraction' in expected)assert.equal(result.fraction,expected.fraction,`${name}: fraction`);
  if('action' in expected)assert.equal(result.action?.action||'',expected.action,`${name}: action`);
  if(result.action)assert.ok(actions.has(result.action.action)||['sync-now'].includes(result.action.action),`${name}: the host handles ${result.action.action}`);
  assert.equal(result.steps.length,3,`${name}: three steps`);assert.ok(result.title&&result.status,`${name}: always says something`);
  return result;
}
const linked=(patch={},sync={})=>drive({waiting:false,...patch},{syncedAt:'',...sync});
checkCard('Signing in',{phase:'signing-in',drive:null},{tone:'working',title:'Connecting Google Drive',status:/^Signing in/u,steps:'active,pending,pending',action:''});
checkCard('Sign-in failed',{phase:'failed',error:'The sign-in window was closed.',drive:null},{tone:'error',status:/window was closed/u,steps:'failed,pending,pending',action:'sign-in'});
checkCard('Checking Drive',{phase:'signed-in',drive:linked({waiting:true})},{tone:'working',status:/^Checking Google Drive/u,steps:'done,active,pending',labels:['Signed in to Google','Bring in what’s on Google Drive','Upload this device’s data']});
checkCard('Reading existing backups (upload getting ready)',{phase:'signed-in',drive:linked({backingUp:true,waiting:true}),operation:{kind:'upload',message:'Reading existing backups in Google Drive…',progress:{stage:'scan',current:0,total:0}}},{status:/^Checking Google Drive/u,steps:'done,active,pending',detail:/^Reading existing backups in Google Drive…$/u,fraction:null});
checkCard('Bringing in, with counts',{phase:'signed-in',drive:linked({busy:true,foregroundKind:'sync',waiting:true},{syncing:true}),operation:{kind:'sync',message:'Downloading backup data from Google Drive…',progress:{stage:'download',current:2,total:5,completedBytes:153600,totalBytes:307200}}},{status:/^Bringing in changes/u,steps:'done,active,pending',detail:/Downloading backup data from Google Drive… · 2 of 5 complete · 150 KB of 300 KB/u,fraction:0.4});
checkCard('An opening line is not repeated',{phase:'signed-in',drive:linked({busy:true,foregroundKind:'sync',waiting:true},{syncing:true}),operation:{kind:'sync',message:'Syncing with Google Drive…',progress:null}},{status:/^Bringing in changes/u,detail:/^$/u});
checkCard('Between catch-up and upload',{phase:'signed-in',seen:{sync:true},drive:linked({waiting:true},{syncedAt:LATER})},{status:/^Uploading this device’s data/u,steps:'done,done,active',labels:['Signed in to Google','Brought in changes from Google Drive','Upload this device’s data']});
checkCard('Uploading, with counts',{phase:'signed-in',seen:{sync:true},drive:linked({backingUp:true,waiting:true},{syncedAt:LATER}),operation:{kind:'upload',message:'Uploading backup data to Google Drive…',progress:{stage:'upload',current:3,total:4}}},{status:/^Uploading/u,steps:'done,done,active',fraction:0.75,detail:/3 of 4 complete/u});
checkCard('Synced, new library',{phase:'signed-in',seen:{upload:true},drive:linked({},{syncedAt:LATER})},{tone:'done',done:true,status:/^Synced at 12:04\. This device is up to date\.$/u,steps:'done,done,done',labels:['Signed in to Google','Nothing new on Google Drive','Uploaded this device’s data'],action:''});
checkCard('Synced, joined library',{phase:'signed-in',seen:{sync:true,upload:true},drive:linked({},{syncedAt:LATER})},{tone:'done',labels:['Signed in to Google','Brought in changes from Google Drive','Uploaded this device’s data']});
checkCard('Synced with versions kept for review',{phase:'signed-in',seen:{sync:true},keptNew:2,drive:linked({},{syncedAt:LATER})},{tone:'done',done:true,status:/2 versions kept for you to review/u,action:'review-kept'});
checkCard('A sync before this connect is not this one',{phase:'signed-in',drive:linked({},{syncedAt:'2026-11-01T11:00:00.000Z'})},{tone:'working',done:false,status:/^Checking Google Drive/u});
// A catch-up that needs a decision leaves the sync time as it was and waits.
checkCard('Needs review (first connect)',{phase:'signed-in',seen:{sync:true},drive:linked({waiting:true},{review:true})},{tone:'attention',status:/need your review/u,steps:'done,waiting,pending',action:'review-sync'});
checkCard('Needs review (reconnect, older sync)',{phase:'signed-in',seen:{sync:true},drive:linked({waiting:true},{syncedAt:'2026-11-01T11:00:00.000Z',review:true})},{tone:'attention',steps:'done,waiting,pending',action:'review-sync'});
checkCard('Needs password (another device)',{phase:'signed-in',drive:linked({waiting:true},{password:true})},{tone:'attention',title:'Enter your backup password',action:'unlock-sync'});
checkCard('Needs password (this device)',{phase:'signed-in',drive:linked({locked:true,waiting:true})},{tone:'attention',action:'enter-password'});
checkCard('Needs app update',{phase:'signed-in',drive:linked({},{newer:true})},{tone:'attention',action:'check-update'});
checkCard('Offline',{phase:'signed-in',online:false,drive:linked({waiting:true})},{tone:'attention',status:/^Offline/u,action:''});
// Red only once retries ran out (phase 4); retrying and signed out wait in amber.
checkCard('Retrying',{phase:'signed-in',drive:linked({waiting:true,nextEligibleAt:'2026-11-01T12:10:00.000Z'},{failed:true})},{tone:'attention',status:/Trying again at 12:10/u,steps:'done,waiting,pending',action:'retry'});
checkCard('Stopped after retries',{phase:'signed-in',drive:linked({retryBackoffCapped:true,waiting:true},{failed:true})},{tone:'error',title:'Sync stopped',steps:'done,failed,pending',action:'retry'});
checkCard('Signed out during the first sync',{phase:'signed-in',drive:linked({connected:false})},{tone:'attention',steps:'done,waiting,pending',action:'sign-in'});

// While Drive syncs, a restore or combine dialog says the result reaches the other devices; otherwise it says nothing.
{
  let synced=true;const withReach=registry.require('backup-presentation',1).createPresentation(Object.freeze({notifications,synced:()=>synced}));
  assert.equal(withReach.reach(),'Google Drive is connected, so your other devices get the result at their next sync.');
  synced=false;assert.equal(withReach.reach(),'','no reach line without Drive sync');
  assert.equal(presentation.reach(),'','no reach line when the host gives no sync state');
}

console.log(JSON.stringify({status:'PASS',suite:'sync-status',oldTextCases:12,newCases:21,priorityCases:3,phase4Cases:5,unseenCases:4,connectCardCases:21}));
