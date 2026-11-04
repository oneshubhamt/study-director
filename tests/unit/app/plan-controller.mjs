import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped Plan controller, not a copied projection or static
// source assertion. Each scenario changes the live board and the independent
// working draft through the same narrow ports used by the host.
for(const path of ['source/core/internal.js','source/core/plan.js']){
  vm.runInThisContext(fs.readFileSync(path,'utf8'),{filename:path});
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
  addEventListener(){}
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
let blockedWrite=null,canonicalDraft=null;const saveOptions=[];
const feedback=[];
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
  breakState:()=>false,
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
  interactions:Object.freeze({confirm:async()=>true,input:async()=>({value:'Plan'})}),
  notifications:Object.freeze({begin:()=>({read:()=>({lifecycle:'resolved'}),finish:()=>{}}),
    feedback:details=>{feedback.push(details);return true;}}),
  overlays:Object.freeze({createAnchoredPopover:()=>({destroy(){},hide(){}})}),
  environment:Object.freeze({clearTimeout,setTimeout})
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
plan.draft.cancel();
assert.equal(state().label,'LIVE');
assert.equal(ids['plan-input'].value,'Draft different');

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
plan.draft.cancel();
releaseDone();blockedWrite=null;
assert.equal(await pendingDone,false);
assert.equal(applyCount,beforeCancelApply);
assert.equal(state().label,'LIVE');
assert.match(String(feedback.at(-1)?.message||''),/Edit closed.*working draft preserved/u);

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

console.log(JSON.stringify({status:'PASS',contract:'plan-board-and-durability',
  checks:['live-vs-draft-projection','invalid-draft-silent-restore','edit-cancel',
    'failed-save-barrier','single-write-apply','single-write-reapply','single-write-done',
    'concurrent-edit-rejection','synchronous-canonical-restore','empty-board-draft-label']}));
