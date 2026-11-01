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
const actions=new Set(['retry','sign-in','unlock-sync','enter-password','check-update','review-sync','review-kept','device-permission','open-data','open-execute','apply-update']);
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
check('Failing after retries',{drive:drive({retryBackoffCapped:true},{failed:true})},{ring:'error',badge:'error',label:/^Sync stopped · last synced 12:04$/u,action:'retry',items:['retry']});
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

// Priorities: a failure outranks a review in the badge and the label; the
// most urgent need comes first, sync health second.
check('Failure and review together',{drive:drive({retryBackoffCapped:true},{failed:true}),kept:1},{ring:'error',badge:'error',label:/^1 kept version to review · Sync stopped/u,items:['retry','review-kept']});
check('Offline outranks signed out',{online:false,drive:drive({connected:false})},{ring:'offline',items:['sign-in']});
check('Password outranks an update',{drive:drive({},{password:true,newer:true})},{ring:'blocked',badge:'lock',items:['unlock-sync','check-update']});

console.log(JSON.stringify({status:'PASS',suite:'sync-status',oldTextCases:12,newCases:20,priorityCases:3}));
