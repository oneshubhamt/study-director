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
vm.runInThisContext(fs.readFileSync('source/core/audio-engine.js','utf8'),{filename:'source/core/audio-engine.js'});
const module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('audio-engine',1);
let context,fetches=0,starts=0,disconnections=0;const assets=[],sources=[],listeners=new Map();
class Context {
 constructor(){context=this;this.state='suspended';this.currentTime=0;this.destination={};}
 async resume(){this.state='running';}
 async close(){this.state='closed';}
 async decodeAudioData(){return {duration:.6};}
 createBufferSource(){const node={connect(){},disconnect(){disconnections++;},start(){starts++;},stop(){node.onended?.();}};sources.push(node);return node;}
 createGain(){return {connect(){},disconnect(){disconnections++;},gain:{value:.8,setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}}};}
}
const engine=module.createEngine({window:{AudioContext:Context},document:{addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)},fetch:()=>{fetches++;const gate=deferred();assets.push(gate);return gate.promise;},baseUrl:'https://example.test/'});
engine.install();assert.equal(engine.status(),'needs-interaction');assert.equal(await engine.play('begin'),false);assert.equal(fetches,0,'locked events are discarded, never queued');await engine.unlock();assert.equal(starts,0,'unlock must never drain a backlog');
let eligible=true;const first=engine.play('begin',{isCurrent:()=>eligible});await settle();eligible=false;assets.shift().resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)});assert.equal(await first,false);assert.equal(starts,0,'expiry during loading is checked after decoding');
eligible=true;const playing=engine.play('begin',{isCurrent:()=>eligible});await settle();assert.equal(starts,1);engine.stop();await playing;assert.equal(disconnections,2,'both the source and gain are released');assert.equal(fetches,1,'decoded assets are reused');
const inFlight=engine.play('pause');await settle();engine.stop();assets.shift().resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)});assert.equal(await inFlight,false);assert.equal(starts,1,'mute fences pending loading');
const failed=engine.play('confirm');await settle();assets.shift().resolve({ok:false});assert.equal(await failed,false);const retry=engine.play('confirm');await settle();assets.shift().resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)});await settle();sources.at(-1).onended();assert.equal(await retry,true,'failed downloads may retry for a new event');engine.dispose();assert.equal(context.state,'closed');assert.equal(listeners.size,0);assert.equal(engine.status(),'unavailable');
console.log(JSON.stringify({status:'PASS',suite:'sound-delivery',checks:['Full default and modes','explicit test while Off','mute active and pending','deduplication and dismissal','stale generations and cancellation','expiry without unlock backlog','priority and combined transition','resolution and recurring failures','quiet background success','OS ownership and silence','asset cache retry and resource cleanup']}));
