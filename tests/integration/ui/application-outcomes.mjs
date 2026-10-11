import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createNotifications} from '../../helpers/notifications.mjs';
const html=fs.readFileSync('source/app.html','utf8'),review=fs.readFileSync('source/core/review.js','utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const noop=()=>{};

// Exercise the real OS adapter and coordinator together, including the await
// between permission inspection and service-worker delivery.
{
  const {coordinator}=createNotifications(),registrations=[],shown=[];let preference=true,permission='granted',permissionRequests=0;
  class Notification {static get permission(){return permission;}static requestPermission(){permissionRequests++;return Promise.resolve(permission);}constructor(title,options){shown.push({title,options});}}
  const context={NoticeCoordinator:coordinator,Notification,window:{Notification},AppData:{local:{getJson:()=>preference,setJson:(_k,value)=>{preference=value;}}},STORAGE_KEYS:{systemAlerts:'alerts'},document:{getElementById:()=>null,addEventListener:noop},AppDiagnostics:{capture:noop},Interactions:{notify:noop},appCanMutate:()=>true,location:{href:'https://example.test/'},URL,navigator:{serviceWorker:{getRegistration:()=>{const gate=deferred();registrations.push(gate);return gate.promise;}}}};
  vm.createContext(context);vm.runInContext(html.slice(html.indexOf('const SystemNotifications='),html.indexOf('/* SHARED SCALAR HELPERS */'))+';globalThis.api=SystemNotifications;',context);
  const registration={showNotification:async(title,options)=>shown.push({title,options})};
  const first=context.api.notify('Cue','Break','pomodoro','one');
  assert.equal(await context.api.notify('Cue','Break','pomodoro','one'),false,'in-flight duplicate must not start another delivery');
  registrations.shift().resolve(registration);assert.equal(await first,true);assert.equal(shown.length,1);
  assert.equal(await context.api.notify('Cue','Break','pomodoro','one'),false,'delivered occurrence is deduplicated');
  const recurring=context.api.notify('Cue','Break','pomodoro','two');registrations.shift().resolve(registration);assert.equal(await recurring,true);assert.equal(shown.length,2,'new occurrence of the same timer cue must deliver');
  const disabled=context.api.notify('Cue','Break','pomodoro','three');preference=false;registrations.shift().resolve(registration);assert.equal(await disabled,false);assert.equal(shown.length,2,'disabling while registration is pending fences delivery');
  preference=true;const denied=context.api.notify('Cue','Break','pomodoro','three');permission='denied';registrations.shift().resolve(registration);assert.equal(await denied,false);permission='granted';
  const stale=context.api.notify('Cue','Old','pomodoro','four'),newer=context.api.notify('Cue','New','pomodoro','five');
  registrations.shift().resolve(registration);assert.equal(await stale,false);registrations.shift().resolve(registration);assert.equal(await newer,true);assert.equal(shown.at(-1).options.body,'New');
  assert.equal(permissionRequests,0,'delivery must never request permission');assert.equal(coordinator.eventStatus().toasts.length,0,'OS transport must not add duplicate in-app cues');
  coordinator.clear();
}

// Commit succeeds before refresh/cleanup. A later error must never say that the
// locally committed record was not saved, or emit a success followed by failure.
{
  const {coordinator,port}=createNotifications('review');let failCommit=false,failFollowup=true;
  const context={notifications:port,saveDayInProgress:false,activeSessionPersistenceBlocked:false,reviewHasStudyDay:()=>true,saveReflectionOnlyRecord:noop,appCanMutate:()=>true,document:{querySelector:()=>({})},setStatus:noop,SessionEvidenceGateway:{snapshot:()=>({date:'2026-09-30'})},todayISO:()=> '2026-09-30',PracticePacer:{finalizeForDayClose:noop},captureTodayState:noop,flushLiveDraft:async()=>{},ReviewView:{refresh:()=>({evidence:{}}),sync:noop},commitDailyRecord:async()=>{if(failCommit)throw new Error('disk full');return {doc:{sourceRevision:'r1'},rec:{date:'2026-09-30'}};},markStorageHealthTimestamp:noop,clearSaveReminder:noop,writeLiveDraftNow:async()=>{},refreshLibraryAfterSave:async()=>{if(failFollowup)throw new Error('refresh unavailable');},prettyDate:v=>v,durationLabel:()=>'',displayPercent:()=>'',syncReviewSurfaceMode:noop};
  vm.createContext(context);vm.runInContext(review.slice(review.indexOf('async function saveDayRecord(){'),review.indexOf('/* ROLLOVER SAVE ORCHESTRATION */')),context);
  assert.equal(await context.saveDayRecord(),false);
  let event=coordinator.readEvent('review','save-study-day');assert.equal(event.outcome,'local-save-completed');assert.match(event.message,/saved locally.*follow-up/i);assert.equal(coordinator.eventStatus().toasts.length,1);
  failFollowup=false;assert.equal(await context.saveDayRecord(),true);event=coordinator.readEvent('review','save-study-day');assert.equal(event.lifecycle,'succeeded');assert.equal(event.persistent,false);
  failCommit=true;assert.equal(await context.saveDayRecord(),false);event=coordinator.readEvent('review','save-study-day');assert.equal(event.outcome,'local-save-failed');assert.equal(event.persistent,true);assert.match(event.message,/Keep this tab open/);
  coordinator.dismissEvent(event.key,event.deliveryId);assert.equal(await context.saveDayRecord(),false);assert.equal(coordinator.eventStatus().toasts.length,1,'a new failed attempt re-arms the dismissed warning');coordinator.clear();
}

// Generic feature handles project to the existing surfaces without owning the
// cancellation action, and never accept callbacks from a prior generation.
{
  const {coordinator:n,port}=createNotifications('library');let cancelled=0;
  const first=port.begin({id:'export',surfaceId:'ongoing-notes-status',title:'Export',action:{label:'Cancel',run:()=>cancelled++}});
  const row=first.read();n.dismissEvent(row.key,row.deliveryId);first.update({message:'Packaging'});assert.equal(n.eventStatus().toasts.length,0);assert.equal(cancelled,0);
  let projected;const unsubscribe=n.subscribe(state=>{projected=state.events.find(event=>event.id==='export');});assert.equal(projected.message,'Packaging');unsubscribe();
  const second=port.begin({id:'export',surfaceId:'ongoing-notes-status',title:'Export'});assert.equal(first.finish('failed','Old error'),false);assert.equal(first.resolve(),false);
  second.finish('cancelled','Cancelled.');assert.equal(n.eventStatus().toasts.length,0);assert.equal(second.update({message:'Late callback'}),false);
  const third=port.begin({id:'export',title:'Export'});third.finish('succeeded','Download started.');assert.equal(n.eventStatus().toasts.length,1);
  n.publish('reminder',{kind:'safety',title:'Reminder',message:'Save today'});n.publish('disk',{kind:'critical',title:'Local save failed',message:'Keep this tab open'});n.publish('update',{kind:'update',title:'Update',message:'Available'});assert.equal(n.status().active.id,'disk');n.dismiss('disk');assert.equal(n.status().active.id,'reminder');n.clear();
}
// Actual Library export completion policy, including selection retention on
// cancellation/failure and honest download-versus-verification wording.
{
  const source=fs.readFileSync('source/core/library.js','utf8'),{coordinator,port}=createNotifications('library');
  let result={status:'cancelled'},failure=null;
  const context={notifications:port,ongoingNoteExportBusy:false,ongoingNoteSelection:new Set(['one']),ongoingNoteSelectionMode:true,ongoingNoteEntries:()=>[],updateOngoingNoteSelectionControls:noop,renderOngoingNotes:noop,console:{error:noop},exportKeys:async()=>{if(failure)throw failure;return result;}};
  vm.createContext(context);vm.runInContext(source.slice(source.indexOf('    async function exportSelectedOngoingNotes('),source.indexOf('    function setOngoingNotesStatus(')),context);
  assert.equal(await context.exportSelectedOngoingNotes(),false);assert.equal(context.ongoingNoteSelection.size,1);assert.equal(coordinator.readEvent('library','ongoing-note-export').lifecycle,'cancelled');assert.equal(coordinator.eventStatus().toasts.length,0);
  failure=new Error('file access denied');assert.equal(await context.exportSelectedOngoingNotes(),false);assert.equal(coordinator.readEvent('library','ongoing-note-export').lifecycle,'failed');assert.equal(context.ongoingNoteSelection.size,1);
  failure=null;result={status:'downloaded',kind:'markdown'};assert.equal(await context.exportSelectedOngoingNotes(),true);assert.equal(context.ongoingNoteSelection.size,0);assert.match(coordinator.readEvent('library','ongoing-note-export').message,/download started/);assert.equal(coordinator.eventStatus().toasts.length,1);
  context.ongoingNoteSelection.add('two');result={status:'saved',kind:'zip',notes:2,assets:1,missing:1};assert.equal(await context.exportSelectedOngoingNotes(),true);assert.match(coordinator.readEvent('library','ongoing-note-export').message,/saved and verified.*unavailable image/);assert.equal(coordinator.eventStatus().toasts.length,1);coordinator.clear();
}
console.log(JSON.stringify({status:'PASS',suite:'application-outcomes',checks:['OS duplicate and recurrence','permission reversal and superseded delivery','committed save versus follow-up failure','failure resolution and recurrence','scoped cancellation and stale callbacks','local-save priority','export cancellation/failure/verification outcomes']}));
