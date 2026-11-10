import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped Plan controller, not a copied projection or static
// source assertion. Each scenario changes the live board and the independent
// working draft through the same narrow ports used by the host.
for(const path of ['source/core/internal.ts','source/core/plan.js']){
  vm.runInThisContext(readRuntimeSource(path),{filename:path});
}
const PlanModule=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('plan',1);

class Node {
  constructor(tag='div'){
    this.tagName=tag.toUpperCase();this.value='';this.textContent='';
    this.dataset={};this.childNodes=[];this.hidden=false;this.disabled=false;this.open=false;
    this.classList={add(){},remove(){},contains(){return false;}};
  }
  append(...nodes){this.childNodes.push(...nodes);}
  appendChild(node){this.childNodes.push(node);return node;}
  replaceChildren(...nodes){this.childNodes=[...nodes];}
  setAttribute(name,value){(this.attributes??={})[name]=String(value);}
  querySelectorAll(){return [];}
  addEventListener(type,handler){(this.handlers??={})[type]=handler;}
  contains(node){return this===node||this.childNodes.some(child=>typeof child.contains==='function'?child.contains(node):child===node);}
}
const ids=Object.fromEntries([
  'plan-input','sched-list','plan-board','plan-board-state','plan-board-caption',
  'plan-edit-btn','plan-done-edit-btn','plan-cancel-edit-btn'
].map(id=>[id,new Node()]));
ids['plan-input'].value='Draft different';
const composer=new Node(),applyButton=new Node();
const document={
  getElementById:id=>ids[id]??null,
  querySelector:selector=>selector==='.plan-composer'?composer:
    selector==='button[data-action="apply-schedule"]'?applyButton:null,
  querySelectorAll:()=>[],
  createElement:tag=>new Node(tag),
  createTextNode:text=>({textContent:String(text)})
};
const row=name=>({name,start:'08:00',dur:30,kind:'work',area:'Polity',measure:'pages',target:5});
const parse=text=>{
  if(text==='BAD')return {ok:false,kind:'errors',errors:['Bad schedule text'],message:'Bad schedule',warnings:[]};
  if(text==='')return {ok:false,kind:'empty',errors:[],message:'Empty schedule',warnings:[]};
  const parsed=text.startsWith('ROW:')?JSON.parse(text.slice(4)):[row(text)];
  return {ok:true,kind:'valid',parsed,warnings:[],errors:[]};
};
const scheduleTextFromRows=rows=>'ROW:'+JSON.stringify(rows);
const fingerprint=rows=>JSON.stringify(rows);
const tasks=[row('Live applied')];
let currentFingerprint=fingerprint(tasks),liveActivity=false,applyCount=0,draftWrites=0,writeFailure=false;
let breakActive=false,breakEnds=0;
let blockedWrite=null,canonicalDraft=null;const saveOptions=[];
const feedback=[];
const timers=new Map();let nextTimer=0;
const scheduleTimer=(callback,ms)=>{const id=++nextTimer;timers.set(id,{callback,ms});return id;};
const clearScheduledTimer=id=>timers.delete(id);
const fireTimers=ms=>{
  const due=[...timers].filter(([,entry])=>entry.ms===ms);
  for(const [id,entry] of due)if(timers.delete(id))entry.callback();
};
const pendingTimers=ms=>[...timers.values()].filter(entry=>entry.ms===ms).length;
const nodeText=node=>String(node?.textContent||'')+(node?.childNodes||[]).map(nodeText).join('');
let confirmGate=null,confirmRequested=false;
const viewFunctions={
  on:()=>{},textEl:(tag,cls,value)=>{const node=new Node(tag);node.className=cls;node.textContent=value;return node;},
  updateRealTimeAwareness:()=>{}
};
const domainFunctions={
  clampText:value=>String(value),fmtDur:value=>String(value)+'m',fmtS:value=>String(value),
  hasOngoingTaskNotes:()=>false,isFixedBlock:()=>false,isSupportBlock:()=>false,isTrackableBlock:()=>true,isWorkBlock:()=>true,
  makeScheduleRow:()=>null,normalizeScheduleKind:value=>value,normalizeScheduleTarget:value=>value,
  positiveMinutes:value=>Math.max(0,Number(value)||0),scheduleFingerprintForRows:fingerprint,
  scheduleToken:value=>String(value||'').toLowerCase(),scheduleWarningsMessage:()=>'',taskAreaKey:task=>task.area||'',
  taskAreaValue:task=>task.area||'',taskMeasureValue:task=>task.measure||'',taskTargetValue:task=>task.target??null,
  noteTextForKey:()=>''
};
const t2m=text=>Number(text.slice(0,2))*60+Number(text.slice(3,5));
const hm=minutes=>String(Math.floor((minutes%1440)/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
const clockFunctions={
  clockHM:()=> '08:00',clockMinuteToStudyMinute:value=>value,getMinuteOfDay:()=>480,
  isValidHHMM:value=>/^\d{2}:\d{2}$/.test(value),
  normalizeHHMM:value=>value,studyMinuteToHHMM:hm,t2m,
  timeLabelFromIso:value=>value
};
const gateway={
  act:()=>true,
  apply:(rows)=>{applyCount++;tasks.splice(0,tasks.length,...rows);currentFingerprint=fingerprint(rows);return {migrationSummary:null};},
  breakState:action=>{if(action==='end'){breakActive=false;breakEnds++;return true;}return breakActive;},
  captureMigration:()=>({preview:{matched:0,total:0,practiceTotal:0,practiceMatched:0}}),
  clearSafety:()=>{},flush:()=>{},hasLiveState:()=>liveActivity,
  markRender:()=>{},read:()=>({tasks,fingerprint:currentFingerprint,anchor:480}),
  reconcile:()=>{},renameAreas:()=>0,row:()=>({done:false,skipped:false}),
  timeline:()=>({rows:[],realtime:{scheduledIdx:null,first:0,nowEff:490}})
};
const mk=(names,implementations={})=>Object.freeze(Object.fromEntries(
  names.map(name=>[name,implementations[name]??(()=>null)])));
const ports=Object.freeze({
  configuration:Object.freeze({limits:Object.freeze({
    maxStatusMessageChars:600,maxDurationMinutes:1440,maxScheduleChars:100000,
    maxTaskNameChars:200,maxAreaNameChars:200,maxUnitChars:100
  })}),
  persistence:mk(['lastError','readDraft','readLibrary','writeLibrary','writeDraft','reportDraftResult'],{
    lastError:()=>new Error('Injected draft persistence failure'),
    readDraft:()=>canonicalDraft,
    readLibrary:()=>({savedPlans:[],defaultId:null}),
    writeLibrary:async()=>true,
    writeDraft:async(value,options={})=>{
      draftWrites++;saveOptions.push({...options});
      if(blockedWrite)await blockedWrite;
      if(writeFailure)return false;
      canonicalDraft=value;return true;
    },
    reportDraftResult:()=>{}
  }),
  defaults:Object.freeze({
    active:()=>({scheduleText:'Default',studentName:'QA'}),
    applyStudentName:()=>{},
    factory:Object.freeze({scheduleText:'Factory',studentName:'QA'})
  }),
  domain:mk(Object.keys(domainFunctions),domainFunctions),
  parser:mk(['isCanonicalScheduleText','parseScheduleDraftText','scheduleTextFromRows'],{
    isCanonicalScheduleText:text=>parse(text).ok,
    parseScheduleDraftText:parse,scheduleTextFromRows
  }),
  clock:mk(Object.keys(clockFunctions),clockFunctions),
  view:Object.freeze({document,on:viewFunctions.on,textEl:viewFunctions.textEl,
    updateRealTimeAwareness:viewFunctions.updateRealTimeAwareness,
    window:{matchMedia:()=>({matches:false})}}),
  scheduleGateway:mk(Object.keys(gateway),gateway),
  ownership:Object.freeze({canMutate:()=>true,requirePrimary:()=>true}),
  interactions:Object.freeze({
    confirm:()=>{confirmRequested=true;return confirmGate||Promise.resolve(true);},
    input:async()=>({value:'Plan'})
  }),
  notifications:Object.freeze({begin:()=>({read:()=>({lifecycle:'resolved'}),finish:()=>{}}),
    feedback:details=>{feedback.push(details);return true;}}),
  overlays:Object.freeze({createAnchoredPopover:()=>({destroy(){},hide(){}})}),
  environment:Object.freeze({clearTimeout:clearScheduledTimer,setTimeout:scheduleTimer})
});
const plan=PlanModule.createController(Object.freeze({ports}));
const state=()=>({label:ids['plan-board-state'].textContent,mode:ids['plan-board'].dataset.mode,
  caption:ids['plan-board-caption'].textContent});

// A valid separate draft must not transform the visible applied board into
// a draft; an invalid or incomplete separate draft must not do so either.
assert.equal(plan.draft.preview({silent:true,enterDraft:false}),true);
assert.deepEqual(state(),{label:'LIVE',mode:'live',caption:'Applied plan. Timing and completion update here.'});
assert.equal(ids['plan-edit-btn'].textContent,'Edit Draft');
ids['plan-input'].value='BAD';
const beforeSilent=feedback.length;
assert.equal(plan.draft.preview({silent:true,enterDraft:false}),false);
assert.equal(state().label,'LIVE');
assert.equal(state().mode,'live');
assert.equal(ids['plan-edit-btn'].textContent,'Edit Draft','invalid independent text still opens a draft, not the applied Plan');
assert.equal(feedback.length,beforeSilent,'a silent restoration projection cannot announce an unrelated draft error');

// Explicit editing shows draft validity, and Cancel preserves draft text
// while returning to the applied schedule.
ids['plan-input'].value='Draft different';
plan.draft.preview({silent:true,enterDraft:false});
plan.draft.enter();
assert.equal(state().label,'EDITING DRAFT');
assert.equal(await plan.draft.cancel(),true);
assert.equal(state().label,'LIVE');
assert.equal(ids['plan-input'].value,'Draft different');
assert.match(String(feedback.at(-1)?.message||''),/working draft saved in this browser/u);

// Failed draft persistence is a hard barrier before an applied Plan is
// replaced; the draft and old schedule remain available for another attempt.
writeFailure=true;
const beforeApply=applyCount,beforeFailWrites=draftWrites;
assert.equal(await plan.apply(),false);
assert.equal(draftWrites,beforeFailWrites+1);
assert.equal(saveOptions.at(-1).strictDurability,true,'Apply requests a strict IndexedDB draft write');
assert.equal(applyCount,beforeApply);
assert.equal(tasks[0].name,'Live applied');
assert.ok(feedback.some(item=>String(item.message||'').includes('Draft not saved')));

// A successful Apply writes once, including when identical to the live
// schedule; the unchanged-schedule optimization does not write again.
writeFailure=false;
const beforeSuccessWrites=draftWrites;
assert.equal(await plan.apply(),true);
assert.equal(draftWrites,beforeSuccessWrites+1);
assert.equal(applyCount,beforeApply+1);
assert.equal(state().label,'LIVE');
assert.equal(ids['plan-edit-btn'].textContent,'Edit Plan','a draft identical to the applied Plan uses the correct label');
liveActivity=true;
ids['plan-input'].value='Draft different';
const beforeReapplyWrites=draftWrites;
assert.equal(await plan.apply(),true);
assert.equal(draftWrites,beforeReapplyWrites+1,'reapplying does not duplicate the draft save');

// Done commits the edited draft exactly once, then applies the saved text.
ids['plan-input'].value='Changed via board';
plan.draft.preview({silent:true,enterDraft:true});
assert.equal(state().label,'EDITING DRAFT');
const beforeDoneWrites=draftWrites,beforeDoneApply=applyCount;
assert.equal(await plan.draft.confirm(),true);
assert.equal(draftWrites,beforeDoneWrites+1);
assert.equal(saveOptions.at(-1).strictDurability,true,'Done requests one strict draft write');
assert.equal(applyCount,beforeDoneApply+1);
assert.equal(state().label,'LIVE');

// A draft edited during an outstanding save is not silently applied using
// the previous draft's projection.
ids['plan-input'].value='First pending draft';
let releaseWrite;
blockedWrite=new Promise(resolve=>{releaseWrite=resolve;});
const beforeRaceApply=applyCount;
const pending=plan.apply();
ids['plan-input'].value='New unsaved draft';
releaseWrite();blockedWrite=null;
assert.equal(await pending,false);
assert.equal(applyCount,beforeRaceApply);
assert.equal(ids['plan-input'].value,'New unsaved draft');

// Cancel wins over an in-flight Done save: its pending completion must
// neither apply the old rows nor replace the Cancel feedback with an error.
ids['plan-input'].value='Cancelled pending Done';
plan.draft.preview({silent:true,enterDraft:true});
let releaseDone;
blockedWrite=new Promise(resolve=>{releaseDone=resolve;});
const beforeCancelApply=applyCount;
const pendingDone=plan.draft.confirm();
const cancelling=plan.draft.cancel();
assert.match(String(feedback.at(-1)?.message||''),/Saving the working draft/u,
  'Cancel does not claim storage success before the strict commit');
releaseDone();blockedWrite=null;
assert.equal(await pendingDone,false);
assert.equal(await cancelling,true);
assert.equal(applyCount,beforeCancelApply);
assert.equal(state().label,'LIVE');
assert.match(String(feedback.at(-1)?.message||''),/working draft saved in this browser/u);

// Composer input is authoritative even when Done outruns the debounced
// preview. Done must neither rewrite textarea bytes from stale row memory nor
// apply the old Plan. The post-Done timer must also be cancelled.
liveActivity=false;
ids['plan-input'].value='ROW:'+JSON.stringify([row('Old Composer text')]);
plan.draft.preview({silent:true,enterDraft:true});
const latestComposer='ROW:'+JSON.stringify([row('Latest Composer text')]);
ids['plan-input'].value=latestComposer;
plan.draft.composerInput();
assert.equal(pendingTimers(220),1,'Composer preview is pending');
const beforeFastDone=applyCount;
assert.equal(await plan.draft.confirm(),true);
assert.equal(applyCount,beforeFastDone+1);
assert.equal(tasks[0].name,'Latest Composer text');
assert.equal(canonicalDraft,latestComposer);
assert.equal(ids['plan-input'].value,latestComposer);
assert.equal(pendingTimers(220),0,'Done cancels stale previews');

// A queued preview always parses the *latest* text, even if it changes
// without another Composer event. The board must show the newer rows.
ids['plan-input'].value='ROW:'+JSON.stringify([row('Earlier queued preview')]);
plan.draft.preview({silent:true,enterDraft:true});
ids['plan-input'].value='ROW:'+JSON.stringify([row('Pending preview source')]);
plan.draft.composerInput();
ids['plan-input'].value='ROW:'+JSON.stringify([row('Newer independent text')]);
fireTimers(220);
assert.match(nodeText(ids['sched-list']),/Newer independent text/u);
assert.doesNotMatch(nodeText(ids['sched-list']),/Earlier queued preview|Pending preview source/u);

// Structured row edits supersede a delayed Composer preview. It must not
// rerender the row and unexpectedly move focus after the row was edited.
plan.draft.install();
ids['plan-input'].value='ROW:'+JSON.stringify([row('Row before edit')]);
plan.draft.preview({silent:true,enterDraft:true});
ids['plan-input'].value='ROW:'+JSON.stringify([row('Composer pending')]);
plan.draft.composerInput();
assert.equal(pendingTimers(220),1);
const editorRow=ids['sched-list'].childNodes[0];
const editedField={
  tagName:'INPUT',value:'Row wins',dataset:{draftField:'name'},
  closest:selector=>selector==='[data-draft-field]'?editedField:
    selector==='.si.draft[data-draft-idx]'?editorRow:null
};
ids['sched-list'].handlers.input({target:editedField});
assert.equal(pendingTimers(220),0,'row edits cancel the stale Composer projection');
assert.match(ids['plan-input'].value,/Row wins/u);

// Cancel closes immediately but strictly commits the latest unsaved Composer
// bytes rather than acknowledging an earlier row view or a queued timer.
ids['plan-input'].value='Unsaved changed during debounce';
plan.draft.composerInput();
assert.equal(pendingTimers(300),1);
const beforeCancelWrites=draftWrites,latestCancelText=ids['plan-input'].value;
const pendingCancel=plan.draft.cancel();
assert.equal(state().label,'LIVE');
assert.match(String(feedback.at(-1)?.message||''),/Saving the working draft/u);
assert.equal(await pendingCancel,true);
assert.equal(draftWrites,beforeCancelWrites+1,'Cancel coalesces one debounced save into one strict commit');
assert.equal(canonicalDraft,latestCancelText);
assert.equal(saveOptions.at(-1).strictDurability,true);
assert.equal(pendingTimers(300),0);
assert.equal(pendingTimers(220),0);
assert.match(String(feedback.at(-1)?.message||''),/working draft saved in this browser/u);

// A cancelled edit remains closed when browser storage rejects that commit.
// No success announcement, accidental Plan replacement or text deletion.
ids['plan-input'].value='Draft to rescue after failed Cancel';
plan.draft.preview({silent:true,enterDraft:true});
writeFailure=true;
const beforeFailedCancel=applyCount;
assert.equal(await plan.draft.cancel(),false);
assert.equal(applyCount,beforeFailedCancel);
assert.equal(ids['plan-input'].value,'Draft to rescue after failed Cancel');
assert.match(String(feedback.at(-1)?.message||''),/working draft was not saved/u);
writeFailure=false;

// Cancel while the Plan replacement dialog is open prevents applying it,
// even if its text and the restored editor mode happen to match afterwards.
liveActivity=true;
ids['plan-input'].value='ROW:'+JSON.stringify([row('Before modal')]);
plan.draft.preview({silent:true,enterDraft:true});
let releaseConfirm;
confirmGate=new Promise(resolve=>{releaseConfirm=resolve;});
confirmRequested=false;
const beforeModalApply=applyCount,pendingModalDone=plan.draft.confirm();
for(let i=0;i<30&&!confirmRequested;i++)await Promise.resolve();
assert.equal(confirmRequested,true,'the live-replacement confirmation is pending');
const cancelWhileModal=plan.draft.cancel();
releaseConfirm(true);confirmGate=null;
assert.equal(await pendingModalDone,false,'a prior Done cannot apply after Cancel');
assert.equal(await cancelWhileModal,true);
assert.equal(applyCount,beforeModalApply);
assert.equal(state().label,'LIVE');
liveActivity=false;

// A pending break-ending confirmation must not end the running break after
// Cancel; it is a side effect separate from changing the Plan itself.
ids['plan-input'].value='ROW:'+JSON.stringify([row('During break prompt')]);
plan.draft.preview({silent:true,enterDraft:true});
breakActive=true;
let releaseBreak;
confirmGate=new Promise(resolve=>{releaseBreak=resolve;});
confirmRequested=false;
const beforeBreakApply=applyCount,beforeBreakEnds=breakEnds;
const pendingBreakDone=plan.draft.confirm();
for(let i=0;i<30&&!confirmRequested;i++)await Promise.resolve();
assert.equal(confirmRequested,true,'break-ending confirmation was requested');
const cancelDuringBreak=plan.draft.cancel();
releaseBreak(true);confirmGate=null;
assert.equal(await pendingBreakDone,false);
assert.equal(await cancelDuringBreak,true);
assert.equal(applyCount,beforeBreakApply);
assert.equal(breakEnds,beforeBreakEnds,'Cancel cannot end a break from a stale confirmation');
assert.equal(breakActive,true);
breakActive=false;

// An untouched default is only a visible fallback, not an authored draft.
// Cancel must not convert canonical null to the default text, causing an
// artificial Personal Data change on the next Drive reconciliation.
canonicalDraft=null;
ids['plan-input'].value='Default';
plan.draft.enter();
const beforeFallbackWrites=draftWrites;
assert.equal(await plan.draft.cancel(),true);
assert.equal(draftWrites,beforeFallbackWrites,'untouched fallback Cancel must not manufacture a saved draft');
assert.equal(canonicalDraft,null);
assert.match(String(feedback.at(-1)?.message||''),/unchanged default template remains unsaved/u);

// Deliberately editing and then returning to the same default counts as an
// authored draft, and must not be mistaken for that untouched fallback.
plan.draft.enter();
ids['plan-input'].value='Modified default';
plan.draft.composerInput();
ids['plan-input'].value='Default';
plan.draft.composerInput();
const beforeAuthoredDefault=draftWrites;
assert.equal(await plan.draft.cancel(),true);
assert.equal(draftWrites,beforeAuthoredDefault+1);
assert.equal(canonicalDraft,'Default');
assert.equal(saveOptions.at(-1).strictDurability,true);

 // Canonical Active Session restoration must stay synchronous and must not
// commit the working draft, even when that draft is invalid.
liveActivity=false; // restoring first resets the previous session's runtime
ids['plan-input'].value='BAD';
const beforeRestoreWrites=draftWrites;
const restored=plan.apply({scheduleText:'Restored canonical',source:'active-session-restore',
  persistDraft:false,forceReload:true});
assert.equal(restored,true);
assert.equal(draftWrites,beforeRestoreWrites);
assert.equal(ids['plan-input'].value,'BAD');
assert.equal(state().label,'LIVE');
const beforeRestorePreview=feedback.length;
plan.draft.preview({silent:true,enterDraft:false});
assert.equal(state().label,'LIVE');
assert.equal(feedback.length,beforeRestorePreview,'silent post-restore projection preserves restoration status');

// Without an applied schedule, the same invalid text correctly labels the
// visible draft board, rather than pretending it contains a live schedule.
tasks.splice(0,tasks.length);
plan.draft.preview({silent:true,enterDraft:false});
assert.equal(state().label,'DRAFT INVALID');
assert.equal(state().mode,'invalid');

// Apply Draft on an initial board is a deliberate action, even without an
// editor session. Failed storage commits and intervening edits still block it.
canonicalDraft=null;
ids['plan-input'].value='First authored plan';
plan.draft.preview({silent:true,enterDraft:false});
assert.equal(ids['plan-done-edit-btn'].textContent,'Apply Draft');
assert.equal(ids['plan-done-edit-btn'].hidden,false);
assert.equal(ids['plan-done-edit-btn'].disabled,false);
const firstWrites=draftWrites,firstApplies=applyCount;
writeFailure=true;
assert.equal(await plan.draft.confirm(),false,'failed first draft save blocks application');
assert.equal(draftWrites,firstWrites+1);
assert.equal(applyCount,firstApplies);
assert.equal(tasks.length,0);
writeFailure=false;

// An edit begun during the asynchronous write invalidates the old Apply.
let releaseFirstApply;
blockedWrite=new Promise(resolve=>{releaseFirstApply=resolve;});
const pendingFirstApply=plan.draft.confirm();
plan.draft.enter();
releaseFirstApply();blockedWrite=null;
assert.equal(await pendingFirstApply,false);
assert.equal(tasks.length,0);
assert.equal(await plan.draft.cancel(),true);

// The displayed default is not persisted by merely viewing it. Explicitly
// pressing Apply Draft is authorship, requiring one canonical strict write.
canonicalDraft=null;
ids['plan-input'].value='Default';
plan.draft.preview({silent:true,enterDraft:false});
assert.equal(ids['plan-done-edit-btn'].hidden,false);
const beforeInitialWrites=draftWrites,beforeInitialApply=applyCount;
assert.equal(await plan.draft.confirm(),true,'enabled Apply Draft must apply the first Plan');
assert.equal(draftWrites,beforeInitialWrites+1);
assert.equal(saveOptions.at(-1).strictDurability,true);
assert.equal(canonicalDraft,'Default');
assert.equal(applyCount,beforeInitialApply+1);
assert.equal(tasks[0].name,'Default');
assert.equal(state().label,'LIVE');
const beforeHiddenDone=draftWrites;
assert.equal(await plan.draft.confirm(),false,'closed live Plan cannot be replaced by hidden Done');
assert.equal(draftWrites,beforeHiddenDone);

// The sync and app-update safety checks save only the Plan draft the person
// wrote. The default shown over no stored draft is not one: saving it made a
// new device's first sync invent a draft that later clashed with another
// device's real plan.
canonicalDraft=null;ids['plan-input'].value='Default';
assert.equal(plan.draft.authoredText(),null,'the displayed default over no stored draft is not authored');
ids['plan-input'].value='Typed plan';
assert.equal(plan.draft.authoredText(),'Typed plan');
ids['plan-input'].value='Default';plan.draft.composerInput();
assert.equal(plan.draft.authoredText(),'Default','typing back to the default before the save is still authored');
fireTimers(300);await Promise.resolve();
assert.equal(canonicalDraft,'Default');
assert.equal(plan.draft.authoredText(),'Default','a stored draft is always authored');

console.log(JSON.stringify({status:'PASS',contract:'plan-board-and-durability',
  checks:['live-vs-draft-projection','invalid-draft-silent-restore','edit-cancel',
    'failed-save-barrier','single-write-apply','single-write-reapply','single-write-done',
    'concurrent-edit-rejection','synchronous-canonical-restore','empty-board-draft-label','latest-composer-done','fresh-deferred-preview',
    'row-edit-cancels-preview','cancel-strict-commit','cancel-write-failure',
    'cancel-during-modal','cancel-during-break-confirmation',
    'untouched-null-draft-fallback','authored-default-cancel','authored-text-excludes-displayed-default']}));
