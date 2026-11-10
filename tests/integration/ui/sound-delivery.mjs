import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createNotifications} from '../../helpers/notifications.mjs';
const settle=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const {coordinator:n}=createNotifications();
let now=0,foreground=true,owner=true;const attempts=[],os=[],sounds=[];
const {coordinator:c}=createNotifications('test',{now:()=>now});
const audio={stop(){},status:()=> 'ready',play(cue,options){const gate=deferred();attempts.push({cue,options,gate});return gate.promise;}};
c.configureDelivery({audio,system:async(event,current,silent)=>{os.push({event,current,silent});return true;},context:()=>({owner,foreground})});
function flushAudio(){for(const a of attempts)if(!a.finished){a.finished=true;if(a.options.isCurrent())sounds.push(a.cue);a.gate.resolve(a.options.isCurrent());}}
async function drain(){flushAudio();await settle();}
let serial=0;
function cue(type,extra={}){return c.begin({source:'timer',id:'execution',surface:'quiet',cue:type,occurrence:String(++serial),...extra});}
assert.equal(c.soundStatus().mode,'full');
let run=cue('study-start');run.update({message:'progress'});c.subscribe(()=>{})();assert.equal(attempts.length,1);await drain();assert.deepEqual(sounds,['begin']);
c.setSoundMode('minimal');cue('pause');assert.equal(attempts.length,1);cue('block-complete');await drain();assert.equal(sounds.at(-1),'complete');
c.setSoundMode('off');cue('day-complete');assert.equal(sounds.length,2);const test=c.testSound();await drain();await test;assert.equal(sounds.at(-1),'begin');assert.equal(c.soundStatus().mode,'off');
c.setSoundMode('full');run=cue('resume');const pending=attempts.at(-1);c.setSoundMode('off');assert.equal(pending.options.isCurrent(),false);await drain();assert.notEqual(sounds.at(-1),'resume');
c.setSoundMode('full');const old=cue('study-start');const stale=attempts.at(-1);run=cue('resume');assert.equal(old.update({cue:'overtime'}),false);assert.equal(stale.options.isCurrent(),false);await drain();assert.equal(sounds.at(-1),'resume');
run=cue('pause');const cancelled=attempts.at(-1);run.update({lifecycle:'cancelled'});assert.equal(cancelled.options.isCurrent(),false);await drain();
run=cue('study-start');const expired=attempts.at(-1);now+=1201;assert.equal(expired.options.isCurrent(),false);await drain();
// Dismissal and re-projection cannot repeat a sound or cancel the operation.
run=cue('pomodoro');const row=c.readEvent('timer','execution');c.dismissEvent(row.key,row.deliveryId);const count=attempts.length;c.eventStatus();run.update({message:'same reminder'});assert.equal(attempts.length,count);assert.notEqual(run.update({progress:{current:1,total:2}}),false);await drain();
// One combined block transition is one cue; a higher priority saving fault wins.
cue('block-complete');c.emit({source:'local-saving',id:'disk',surface:'quiet',severity:'error',lifecycle:'failed',message:'Keep this tab open'});const failure=attempts.at(-1);cue('practice-near');assert.equal(attempts.at(-1),failure);await drain();assert.equal(sounds.at(-1),'attention');
const before=attempts.length;c.emit({source:'local-saving',id:'disk',surface:'quiet',severity:'error',lifecycle:'failed',message:'Retry failed'});assert.equal(attempts.length,before);
c.resolveEvent('local-saving','disk');c.emit({source:'local-saving',id:'disk',surface:'quiet',severity:'error',lifecycle:'failed',message:'Failed again'});assert.equal(attempts.length,before+1);await drain();
// Failed operation retries remain silent until success/resolution, then rearm.
const port=c.presentation('library');let operation=port.begin({id:'export'});operation.finish('failed','Error');await drain();const failedCount=attempts.length;operation=port.begin({id:'export'});operation.finish('failed','Again');assert.equal(attempts.length,failedCount);operation=port.begin({id:'export'});operation.finish('succeeded','Saved');await drain();assert.equal(sounds.at(-1),'confirm');operation=port.begin({id:'export'});operation.finish('failed','New problem');await drain();assert.equal(sounds.at(-1),'attention');
// A pending attention cue cannot play after its condition is already resolved by success.
c.emit({source:'local-saving',id:'lifecycle',surface:'quiet',severity:'error',lifecycle:'failed',message:'Failed'});
const pendingFailure=attempts.at(-1);c.emit({source:'local-saving',id:'lifecycle',surface:'quiet',severity:'success',lifecycle:'succeeded',cue:'none',message:'Recovered'});
assert.equal(pendingFailure.options.isCurrent(),false);await drain();
const rearmed=attempts.length;c.emit({source:'local-saving',id:'lifecycle',surface:'quiet',severity:'error',lifecycle:'failed',message:'Failed again'});assert.equal(attempts.length,rearmed+1,'silent success re-arms recurrence');await drain();
// Progress, background backup and autosave success are silent.
const quiet=attempts.length;operation=c.presentation('device-folder').begin({id:'automatic',foreground:false});operation.update({progress:{current:1,total:2}});operation.finish('succeeded','Verified');c.emit({source:'editor',id:'autosave',foreground:false,surface:'quiet',lifecycle:'succeeded'});assert.equal(attempts.length,quiet);
foreground=false;cue('pomodoro',{system:true,title:'Break'});assert.equal(os.length,1);assert.equal(attempts.length,quiet);assert.equal(os[0].current(),true);c.setSoundMode('off');assert.equal(os[0].silent(),true);foreground=true;assert.equal(os[0].current(),false);
owner=false;c.setSoundMode('full');cue('overtime',{system:true});assert.equal(attempts.length,quiet);owner=true;cue('pause');const hiddenCue=attempts.at(-1);c.setHidden(true);assert.equal(hiddenCue.options.isCurrent(),false);c.setHidden(false);assert.equal(attempts.at(-1),hiddenCue);await drain();c.clear();n.clear();

// Playback uses actual engine behavior with a controllable browser audio boundary.
vm.runInThisContext(readRuntimeSource('source/core/audio-engine.ts'),{filename:'source/core/audio-engine.ts'});
const module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('audio-engine',1);
let context,starts=0,disconnections=0,made=0,failMake=false;const sources=[],listeners=new Map(),idle=[];
class Context {
 constructor(){context=this;this.state='suspended';this.currentTime=0;this.destination={};}
 async resume(){this.state='running';}
 async close(){this.state='closed';}
 createBuffer(channels,length,rate){assert.equal(channels,1);assert.equal(rate,22050);if(failMake){failMake=false;throw new Error('no memory');}made++;const data=new Float32Array(length);return {duration:length/rate,getChannelData:()=>data};}
 createBufferSource(){const node={connect(){},disconnect(){disconnections++;},start(){starts++;},stop(){node.onended?.();}};sources.push(node);return node;}
 createGain(){return {connect(){},disconnect(){disconnections++;},gain:{value:.8,setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}}};}
}
const runIdle=()=>{while(idle.length)idle.shift()();};
const engine=module.createEngine({window:{AudioContext:Context,requestIdleCallback:step=>idle.push(step)},document:{addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)}});
engine.install();assert.equal(engine.status(),'needs-interaction');assert.equal(await engine.play('begin'),false);assert.equal(made,0,'locked events are discarded, never queued');
await engine.unlock();assert.equal(starts,0,'unlock must never drain a backlog');assert.equal(made,0,'cues are made later, in idle moments');assert.equal(idle.length,1,'one cue at a time');
let eligible=false;assert.equal(await engine.play('begin',{isCurrent:()=>eligible}),false);assert.equal(starts,0,'an expired cue never plays');
eligible=true;const playing=engine.play('begin',{isCurrent:()=>eligible});await settle();assert.equal(starts,1);assert.equal(made,1);engine.stop();await playing;assert.equal(disconnections,2,'both the source and gain are released');
const explicit=engine.play('pause',{explicit:true});engine.stop();assert.equal(await explicit,false);assert.equal(starts,1,'mute fences pending playback');
runIdle();assert.equal(made,module.cues.length,'every cue is made once; the one already made is kept');
const again=engine.play('begin');await settle();sources.at(-1).onended();assert.equal(await again,true);assert.equal(made,module.cues.length,'made cues are reused');
const engine2=module.createEngine({window:{AudioContext:Context,requestIdleCallback:step=>idle.push(step)},document:{addEventListener(){},removeEventListener(){}}});
await engine2.unlock();idle.length=0;failMake=true;assert.equal(await engine2.play('confirm'),false,'a cue that cannot be made stays silent');
const retry=engine2.play('confirm');await settle();sources.at(-1).onended();assert.equal(await retry,true,'it is made again for a new event');engine2.dispose();
engine.dispose();assert.equal(context.state,'closed');assert.equal(listeners.size,0);assert.equal(engine.status(),'unavailable');
console.log(JSON.stringify({status:'PASS',suite:'sound-delivery',checks:['Full default and modes','explicit test while Off','mute active and pending','deduplication and dismissal','stale generations and cancellation','expiry without unlock backlog','priority and combined transition','resolution and recurring failures','quiet background success','OS ownership and silence','cues made in idle moments, kept, retried, and resources released']}));
