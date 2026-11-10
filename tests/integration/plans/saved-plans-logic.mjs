import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import {createNotifications} from '../../helpers/notifications.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class FakeClassList{
  constructor(owner){this.owner=owner;}
  contains(name){return this.owner.className.split(/\s+/).includes(name);}
  add(...names){const set=new Set(this.owner.className.split(/\s+/).filter(Boolean));for(const name of names)set.add(name);this.owner.className=[...set].join(' ');}
  remove(...names){const remove=new Set(names);this.owner.className=this.owner.className.split(/\s+/).filter(name=>name&&!remove.has(name)).join(' ');}
}
class FakeElement{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.dataset={};this.attributes=new Map();this.className='';this.textContent='';this.title='';this.value='';this.disabled=false;this.hidden=false;this.listeners=new Map();this.classList=new FakeClassList(this);}
  append(...nodes){for(const node of nodes){if(node==null)continue;this.children.push(node);node.parentElement=this;}}
  appendChild(node){this.append(node);return node;}
  replaceChildren(...nodes){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...nodes);}
  setAttribute(name,value){this.attributes.set(name,String(value));if(name==='class')this.className=String(value);}
  getAttribute(name){return this.attributes.get(name)??null;}
  addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}
  click(){const event={type:'click',target:this,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;},propagationStopped:false};let node=this;while(node){for(const fn of node.listeners.get('click')||[])fn(event);if(event.propagationStopped)break;node=node.parentElement;}if(!event.defaultPrevented&&this.popoverTargetElement)this.popoverTargetElement.hidden=!this.popoverTargetElement.hidden;return event;}
  querySelectorAll(selector){const found=[];const visit=node=>{for(const child of node.children){if(matches(child,selector))found.push(child);visit(child);}};visit(this);return found;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){let node=this;while(node){if(matches(node,selector))return node;node=node.parentElement;}return null;}
}
function matches(node,selector){
  if(selector==='[data-saved-plan]')return !!node.dataset.savedPlan;
  if(selector==='.saved-plan-menu-trigger')return node.classList.contains('saved-plan-menu-trigger');
  if(selector==='.saved-plan-menu-popover')return node.classList.contains('saved-plan-menu-popover');
  if(selector==='.saved-plan-default')return node.classList.contains('saved-plan-default');
  if(selector==='.saved-plan-label')return node.classList.contains('saved-plan-label');
  if(selector.startsWith('[data-saved-plan-id="'))return node.dataset.savedPlanId===selector.slice(21,-2);
  return false;
}
class FakeDocument{
  constructor(){this.nodes=new Map();}
  createElement(tag){return new FakeElement(tag);}
  getElementById(id){return this.nodes.get(id)||null;}
  querySelector(){return null;}
  querySelectorAll(){return [];}
  add(id,node=new FakeElement()){this.nodes.set(id,node);return node;}
}

vm.runInThisContext(readRuntimeSource('source/core/internal.ts'),{filename:'source/core/internal.ts'});
vm.runInThisContext(readRuntimeSource('source/core/plan.ts'),{filename:'source/core/plan.ts'});
const PlanModule=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('plan',1);
assert.ok(PlanModule);

const document=new FakeDocument();
const panel=document.add('saved-plans-panel');
const list=document.add('saved-plans-list');panel.append(list);
const count=document.add('saved-plans-count');panel.append(count);
const name=document.add('saved-plan-name',new FakeElement('input'));panel.append(name);
const status=document.add('saved-plan-status');panel.append(status);
const draft=document.add('plan-input',new FakeElement('textarea'));draft.value='07:00 | 60 | Study | work | Biology | pages | 10';
document.add('pane-plan');
document.add('sched-list');
const liveTasks=[];

let library={savedPlans:[],defaultId:null},renameAnswer={value:'Renamed plan'},renameMutation=null,timerCallback=null,canMutate=true,draftWriteCalls=[];
const freeze=Object.freeze,fn=()=>false;
let notificationTime=0,notificationTimer=null;
const {coordinator,port:notifications}=createNotifications('plan',{now:()=>notificationTime,setTimeout:callback=>{notificationTimer=callback;return 1;},clearTimeout:()=>{notificationTimer=null;}});
coordinator.subscribe(state=>{const event=state.events.filter(event=>event.surfaceId==='saved-plan-status').sort((a,b)=>b.surfaceRevision-a.surfaceRevision)[0];status.textContent=event?.dismissed&&!event.retainInline?'':event?.message||'';status.dataset.state=event?.severity==='error'?'error':'success';});
const ports=freeze({
  notifications,
  configuration:freeze({limits:freeze({maxStatusMessageChars:2000,maxDurationMinutes:1440,maxTaskNameChars:160,maxAreaNameChars:160,maxUnitChars:40})}),
  persistence:freeze({lastError:()=>null,readDraft:()=>draft.value,readLibrary:()=>structuredClone(library),writeLibrary:async value=>{library=structuredClone(value);return true;},writeDraft:async(value,options={})=>{draftWriteCalls.push({value,options:{...options}});return true;},reportDraftResult:()=>{}}),
  defaults:freeze({active:()=>freeze({studentName:'QA',scheduleText:''}),applyStudentName:()=>{},factory:freeze({studentName:'QA',scheduleText:''})}),
  domain:freeze(Object.fromEntries(['clampText','fmtDur','fmtS','hasOngoingTaskNotes','isFixedBlock','isSupportBlock','isTrackableBlock','isWorkBlock','makeScheduleRow','normalizeScheduleKind','normalizeScheduleTarget','positiveMinutes','scheduleFingerprintForRows','scheduleToken','scheduleWarningsMessage','taskAreaKey','taskAreaValue','taskMeasureValue','taskTargetValue','noteTextForKey'].map(key=>[key,key==='clampText'?(v=>String(v??'')):fn]))),
  parser:freeze({isCanonicalScheduleText:()=>true,parseScheduleDraftText:()=>({ok:true,kind:'valid',parsed:[],errors:[],warnings:[]}),scheduleTextFromRows:()=>''}),
  clock:freeze(Object.fromEntries(['clockHM','clockMinuteToStudyMinute','getMinuteOfDay','isValidHHMM','normalizeHHMM','studyMinuteToHHMM','t2m','timeLabelFromIso'].map(key=>[key,fn]))),
  view:freeze({document,on:()=>{},textEl:()=>{},updateRealTimeAwareness:()=>{},window:{}}),
  scheduleGateway:freeze({act:fn,apply:fn,breakState:fn,captureMigration:fn,clearSafety:fn,flush:fn,hasLiveState:fn,markRender:fn,read:()=>({tasks:liveTasks,currentIndex:0,renderDirty:false}),reconcile:fn,renameAreas:fn,row:()=>({}),timeline:()=>({rows:[],realtime:{scheduledIdx:null,nowEff:0,first:0}})}),
  ownership:freeze({canMutate:()=>canMutate,requirePrimary:()=>canMutate}),
  interactions:freeze({confirm:async()=>true,input:async()=>{renameMutation?.();renameMutation=null;return renameAnswer;}}),
  overlays:freeze({createAnchoredPopover:popup=>{popup.hidden=true;let trigger=null;return {show:target=>{trigger=target;target.popoverTargetElement=popup;popup.hidden=false;},hide:()=>{popup.hidden=true;if(trigger)trigger.popoverTargetElement=null;trigger=null;},destroy:()=>{popup.hidden=true;if(trigger)trigger.popoverTargetElement=null;trigger=null;}};}}),
  environment:freeze({clearTimeout:()=>{timerCallback=null;},setTimeout:callback=>{timerCallback=callback;return 1;}})
});
const runtime=PlanModule.createController(freeze({ports}));

runtime.savedPlans.render();

// Backup settlement must be a true flush: no pending draft means no canonical rewrite.
const writesBeforeCleanFlush=draftWriteCalls.length;
assert.equal(await runtime.draft.flush({backupCapture:true}),true);
assert.equal(draftWriteCalls.length,writesBeforeCleanFlush,'backup settlement must not rewrite an unchanged Plan draft');
// A genuinely pending draft save must be flushed once and tagged as backup capture.
draft.value='07:00 | 60 | Study revised | work | Biology | pages | 10';
runtime.draft.composerInput();
assert.equal(typeof timerCallback,'function','Plan edit must queue its normal debounce save');
assert.equal(await runtime.draft.flush({backupCapture:true}),true);
assert.equal(draftWriteCalls.length,writesBeforeCleanFlush+1,'backup settlement must flush a genuinely pending Plan edit exactly once');
assert.equal(draftWriteCalls.at(-1).options.backupCapture,true,'backup-triggered Plan flush must suppress recursive Device backup notification');
assert.equal(await runtime.draft.flush({backupCapture:true}),true);
assert.equal(draftWriteCalls.length,writesBeforeCleanFlush+1,'repeated backup settlement with no new Plan edit must remain a no-op');

assert.equal(list.children.length,1);
assert.equal(list.children[0].textContent,'No saved plans yet.');

name.value='Revision day';
assert.equal(await runtime.savedPlans.act('save'),true);
assert.equal(library.savedPlans.length,1);
const id=library.savedPlans[0].id;
assert.equal(status.textContent,'Plan saved.');
assert.equal(list.children.length,1);
assert.equal(list.children[0].dataset.savedPlanId,id);
assert.equal(list.children[0].querySelector('.saved-plan-label').textContent,'Revision day');
const menuTrigger=list.children[0].querySelector('.saved-plan-menu-trigger');
const menuPopover=list.children[0].querySelector('.saved-plan-menu-popover');
assert.ok(menuTrigger&&menuPopover);
assert.equal(menuPopover.hidden,true);
menuTrigger.click();
assert.equal(menuPopover.hidden,false,'ellipsis click must not be immediately undone by the native popover button default action');
runtime.savedPlans.syncAccess();
assert.equal(menuPopover.hidden,false,'ownership heartbeat/access sync must not rebuild or auto-close an open saved-plan menu');
canMutate=false;runtime.savedPlans.syncAccess();
assert.equal(menuPopover.hidden,true,'losing write ownership must close and disable the saved-plan menu');
assert.equal(menuTrigger.disabled,true);
canMutate=true;runtime.savedPlans.syncAccess();
assert.equal(menuTrigger.disabled,false);
menuTrigger.click();
assert.equal(menuPopover.hidden,false);
menuTrigger.click();
assert.equal(menuPopover.hidden,true);

assert.equal(await runtime.savedPlans.act('default',id),true);
assert.equal(library.defaultId,id);
assert.equal(list.children[0].querySelector('.saved-plan-default').textContent,'Default');
assert.equal(list.children[0].querySelectorAll('[data-saved-plan]').some(button=>button.dataset.savedPlan==='default'),false);

const savedText=library.savedPlans[0].scheduleText;
draft.value='Temporary working copy';
assert.equal(await runtime.savedPlans.act('load',id),true);
assert.equal(draft.value,savedText,'Load restores the saved schedule into the independent working draft');

draft.value='08:00 | 45 | Updated revision | work | Biology | pages | 12';
assert.equal(await runtime.savedPlans.act('update',id),true);
assert.equal(library.savedPlans[0].scheduleText,draft.value,'Update replaces the selected saved-plan schedule');
const updatedText=library.savedPlans[0].scheduleText;
draft.value='   ';
assert.equal(await runtime.savedPlans.act('update',id),false,'an empty draft cannot erase a saved plan');
assert.equal(library.savedPlans[0].scheduleText,updatedText,'rejected empty update leaves canonical saved-plan content unchanged');
draft.value=updatedText;

name.value='New-plan field must stay untouched';
renameMutation=()=>{library.savedPlans.push({id:'plan-concurrent',label:'Concurrent plan',scheduleText:'Concurrent',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});};
assert.equal(await runtime.savedPlans.act('rename',id),true);
assert.equal(library.savedPlans.find(plan=>plan.id===id).label,'Renamed plan');
assert.ok(library.savedPlans.some(plan=>plan.id==='plan-concurrent'),'rename re-reads the library after its dialog and preserves a completed concurrent library change');
assert.equal(name.value,'New-plan field must stay untouched');

assert.equal(timerCallback,null,'saved-plan feedback must not use a controller-owned timer');
assert.equal(typeof notificationTimer,'function');
notificationTime+=2601;notificationTimer();
assert.equal(status.textContent,'','coordinator expires transient inline feedback');

assert.equal(await runtime.savedPlans.act('delete',id),true);
assert.equal(library.savedPlans.length,1);
assert.equal(library.savedPlans[0].id,'plan-concurrent');
assert.equal(library.defaultId,null);

// BF-1R2: startup preview and Cancel do not implicitly open editing or
// copy the applied schedule over the independently authored working draft.
runtime.draft.deactivate();
runtime.draft.preview({silent:true});
assert.equal(runtime.draft.active(),false,'an empty live session must not implicitly enter Plan editing');
liveTasks.push({start:'08:00',dur:60,name:'Applied Session',kind:'work',area:'Ethics'});
draft.value='09:00 | 45 | Independent Draft | work | History | pages | 8';
const preservedText=draft.value,writesBeforeCancel=draftWriteCalls.length;
runtime.draft.enter();
assert.equal(runtime.draft.active(),true,'Edit Plan deliberately opens the editor');
assert.equal(await runtime.draft.cancel(),true);
assert.equal(runtime.draft.active(),false,'Cancel closes Plan editing');
assert.equal(draft.value,preservedText,'Cancel must not replace the draft with the applied schedule');
assert.equal(draftWriteCalls.length,writesBeforeCancel+1,'Cancel commits the independent text exactly once, not the applied schedule');
assert.equal(draftWriteCalls.at(-1).value,preservedText,'Cancel saves the independent working draft rather than copying live Plan rows');
assert.equal(draftWriteCalls.at(-1).options.strictDurability,true,'Cancel waits for a strict IndexedDB Plan draft write');

console.log(JSON.stringify({status:'PASS',suite:'saved-plans-logic',checks:['empty state','save/load/update row behavior','empty update rejection','ellipsis menu survives native popover default action and ownership heartbeat sync','default badge and redundant action omission','rename preserves concurrent library change','rename dialog contract keeps new-plan field independent','coordinator-owned success expiry','delete cleans default reference without deleting unrelated plans','backup flush is dirty-only and backupCapture-tagged']},null,2));
