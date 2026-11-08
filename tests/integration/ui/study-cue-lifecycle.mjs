import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createNotifications} from '../../helpers/notifications.mjs';
const freeze=Object.freeze,noop=()=>{};
const {coordinator}=createNotifications();
const sounds=[];coordinator.configureDelivery({audio:{stop:noop,status:()=> 'ready',play:async(cue,options)=>{if(options.isCurrent())sounds.push(cue);return true;}},context:()=>({owner:true,foreground:true})});
const settle=async()=>{for(let i=0;i<4;i++)await Promise.resolve();};
vm.runInThisContext(readScript('source/core/pomodoro.ts'),{filename:'source/core/pomodoro.ts'});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const elements=new Map();
function element(id){
  if(!elements.has(id)){let value='';const classes=new Set();elements.set(id,{get value(){return value;},set value(v){value=String(v);},setAttribute:noop,classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)}});}
  return elements.get(id);
}
const timer={mode:'running',paused:false,currentIndex:0,runtime:{startMs:10}};
let saved=null,writes=0;
const rhythm=registry.require('pomodoro',1).createController(freeze({ports:freeze({
 state:freeze({TASKS:[{kind:'work'}],TIMER_MODES:freeze({RUNNING:'running'}),TimerState:timer}),
 schedule:freeze({isPomodoroEligibleBlock:()=>true}),
 persistence:freeze({canMutate:()=>true,readConfiguration:()=>saved,writeConfiguration:v=>{saved=structuredClone(v);writes++;},writeSession:noop}),
 view:freeze({document:{getElementById:element},notifications:coordinator,updateExecutePanels:noop}),environment:freeze({nowIso:()=> '2026-09-30T10:00:00Z'})
})}));
assert.deepEqual(rhythm.configuration.load(),{enabled:true,nudgeAfter:50,breakMinutes:10});
element('ns-nudge-after').value='0';element('ns-break').value='90';rhythm.configuration.updateFromUi();assert.equal(saved.nudgeAfter,1);assert.equal(saved.breakMinutes,60);assert.equal(writes,1);rhythm.configuration.updateFromUi();assert.equal(writes,1,'Enter followed by blur must not write twice');
element('ns-break').value='';rhythm.configuration.updateFromUi();assert.equal(element('ns-break').value,'60');assert.equal(writes,1,'invalid input restores the current value');
rhythm.timerEvent('tick',{activeSec:60});await settle();assert.equal(sounds.at(-1),'invitation');const count=sounds.length;rhythm.timerEvent('tick',{activeSec:61});assert.equal(sounds.length,count);rhythm.configuration.toggleNudges();assert.equal(elements.get('nudge-overlay').classList.contains('on'),false);assert.equal(coordinator.readEvent('pomodoro','reminder'),null);
element('ns-break').value='10';rhythm.configuration.updateFromUi();assert.equal(saved.breakMinutes,10);assert.equal(saved.enabled,false,'disabled rhythm remains editable');assert.equal(Object.hasOwn(saved,'sound'),false);
// The actual timer transition code emits one coordinated gesture when it advances.
const src=readScript('source/core/timer-engine.ts');
const helperStart=src.search(/^    let soundOperation\b/m);assert.ok(helperStart>=0,'timer sound helper must be present');
const helper=src.slice(helperStart,src.indexOf('    const {appCanMutate}',helperStart));
const start=src.slice(src.indexOf('function startCur('),src.indexOf('function tick(){'));
const finish=src.slice(src.indexOf('function finishTrackableBlock('),src.indexOf('function markDone(){'));
const state={currentIndex:0,mode:'ready',paused:false,runtime:{startMs:null}};
const resolved=new Set();
const context={appCanMutate:()=>true,isTaskResolved:i=>resolved.has(i),TaskSessionState:{getField:()=>0},notifications:coordinator,TASKS:[{dur:50},{dur:40}],TimerState:state,TIMER_MODES:{RUNNING:'running'},isTrackableBlock:()=>true,setCurrentTask:i=>state.currentIndex=i,showDone:()=>{state.mode='done';},showEmpty:noop,invalidateExecuteIdleDisplay:noop,initTimerState:()=>{},setTimerMode:v=>state.mode=v,beginActualTask:noop,document:{getElementById:()=>({style:{}}),querySelector:()=>null},setPausedUI:noop,setTimerIdentity:noop,setExecuteShellVisible:noop,setExecuteControlsEnabled:noop,clearExecuteStateOverlay:noop,refreshPnote:noop,updateCD:noop,requestRender:noop,TimerPresentation:{start:noop},tick:noop,clearInterval:noop,setInterval:()=>1,setTimeout:noop,Pomodoro:{timerEvent:noop},currentTimerActiveSeconds:()=>0,resetBreakState:noop,writeLiveDraftNow:noop,recordCurrentActiveToTask:noop,setTaskSkippedState:i=>resolved.add(i),setTaskDoneState:i=>resolved.add(i),PracticePacer:{onBlockResolved:noop},TaskIdentity:{idAt:i=>String(i)},saveNote:noop,saveLiveDraft:noop,findNextIncompleteTrackableAfter:i=>i+1,totS:0,remS:0,overflowS:0,isOverflow:false,tInt:null};
vm.createContext(context);vm.runInContext(helper+start+finish,context);sounds.length=0;
context.startCur();await settle();assert.deepEqual(sounds,['begin']);context.finishTrackableBlock(false);await settle();assert.deepEqual(sounds,['begin','complete'],'completion and next start are a single cue');context.finishTrackableBlock(false);await settle();assert.deepEqual(sounds,['begin','complete','day']);
coordinator.setSoundMode('minimal');state.currentIndex=0;const previousCount=sounds.length;context.startCur();await settle();assert.equal(sounds.length,previousCount,'manually starting a later block is silent in Minimal');
coordinator.clear();
// A fixed block that starts during study time stops the timer with a settle in
// the foreground, a device notification in the background, and silence when the
// person was away (they find the choice waiting).
{
  const {coordinator:fixed}=createNotifications();
  const heard=[],shown=[],view={foreground:true};
  fixed.configureDelivery({audio:{stop:noop,status:()=> 'ready',play:async(phrase,options)=>{if(options.isCurrent())heard.push(phrase);return true;}},
    system:async(event,isCurrent)=>{if(isCurrent())shown.push(`${event.title}: ${event.message}`);return true;},context:()=>({owner:true,foreground:view.foreground})});
  const stop=src.slice(src.indexOf('function stopTimerForFixedBoundary('),src.indexOf('\n}\n',src.indexOf('function stopTimerForFixedBoundary('))+3);
  const timerState={currentIndex:0,paused:false,runtime:{},emptyRuntime:()=>({})},modes=[];
  const fixedContext={notifications:fixed,TimerState:timerState,TIMER_MODES:{READY:'ready'},discardInactiveGap:noop,recordCurrentActiveToTask:noop,saveNote:noop,tInt:null,clearInterval:noop,TimerPresentation:{stop:noop},
    resetBreakState:noop,Pomodoro:{timerEvent:noop},setTimerMode:mode=>modes.push(mode),shortTaskLabel:task=>task.name,showEmpty:noop,refreshPnote:noop,recoverySetStatus:noop,flushLiveDraft:noop};
  vm.createContext(fixedContext);vm.runInContext(helper+stop,fixedContext);
  const boundary={task:{name:'Lab'}};
  fixedContext.stopTimerForFixedBoundary(boundary);await settle();
  assert.deepEqual([heard,shown],[['settle'],[]],'a fixed block starting in the foreground settles');
  view.foreground=false;fixedContext.stopTimerForFixedBoundary(boundary);await settle();
  assert.deepEqual([heard,shown],[['settle'],['Fixed block started: Lab has started. The timer stopped and counted focus was saved.']],'in the background it is a device notification, not an in-app sound');
  view.foreground=true;fixedContext.stopTimerForFixedBoundary(boundary,{away:true});await settle();
  assert.deepEqual([heard.length,shown.length],[1,1],'nothing sounds when the person was away');
  assert.deepEqual(modes,['ready','ready','ready']);
  fixed.clear();
}
console.log(JSON.stringify({status:'PASS',suite:'study-cue-lifecycle',checks:['inline bounds and commit','disabled rhythm remains editable','one Pomodoro occurrence','turning rhythm off resolves reminder','fixed block start: settle, device notification, silent when away','start/block/day combined transitions']}));
