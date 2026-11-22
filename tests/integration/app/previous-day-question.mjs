import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// The question about a previous day this device ran (owner, 2026-11-22). It
// waits until the app has started; with Google Drive connected a sync comes
// first, and it is asked only if the day is still not covered: a day begun on
// the phone and saved on the laptop no longer asks the phone. Today's plan
// never replaces such a day unasked. The production functions run here
// against a fake clock, Drive and store.
const app=fs.readFileSync('source/app.html','utf8');
function production(signature){
  const start=app.indexOf(signature),end=start<0?-1:app.indexOf('\n}',start);
  assert.ok(start>=0&&end>start,'Production function missing: '+signature);
  return app.slice(start,end+2);
}
const ask=production('function askAboutPreviousDay(session){');
const startup=production('async function startupFinished(){');
const syncFirst=production('async function syncBeforePreviousDayQuestion(){');
const holdsApply=production('async function previousDayHoldsApply(){');
const stillUncovered=production('async function askIfStillUncovered(options={}){');
const signedOut=production('function driveSignedOut(){');
const checkFirst=production('async function checkDriveThenAsk(){');
const day='2026-11-21';
const session=(extra={})=>({id:'current',date:day,runningOn:'inst_here',...extra});

function world({connected=true,setUp=true,signInWorks=true,startupDone=true,syncBrings=null,syncAfterMs=1000,failAfterMs=0,stored=session(),covered=false}={}){
  const clock={now:0},events=[],state={stored,covered,startupDone,tasks:[],connected};
  let sync={syncedAt:'old',failed:false,syncing:false,review:false,password:false,newer:false};
  const at=[];
  const context=vm.createContext({
    Date:{now:()=>clock.now},
    navigator:{onLine:true},
    setTimeout:(callback,ms)=>{clock.now+=ms;for(const job of at.splice(0))if(clock.now>=job.ms)job.run();else at.push(job);setImmediate(callback);return 1;},
    StartupLifecycle:{status:()=>({failed:false,completedStages:state.startupDone?['startup-ready']:[]})},
    BackupProviderRuntime:{
      locationStatus:()=>({connected:state.connected,wasConnected:false,sync}),
      scheduleSharedSync:(id,reason)=>{
        if(!state.connected)return false;
        events.push('sync:'+reason);
        if(syncBrings)at.push({ms:clock.now+syncAfterMs,run:()=>{sync={...sync,syncedAt:'new'};syncBrings(state);}});
        if(failAfterMs)at.push({ms:clock.now+failAfterMs,run:()=>{sync={...sync,failed:true};}});
        return true;
      }
    },
    Profiles:{current:()=>({email:setUp?'owner@example.invalid':''})},
    connectDriveForProfile:async()=>{events.push('sign-in');if(!signInWorks)throw new Error('closed');state.connected=true;return true;},
    AppMutationCoordinator:{settled:async()=>{}},
    AppData:{activeSession:{load:async()=>{if(state.loadFails)throw new Error('store closed');return {ok:true,value:state.stored};}}},
    appCanMutate:()=>true,
    get TASKS(){return state.tasks;},
    isPreviousActiveSessionRecord:value=>!!value&&value.date===day,
    sessionFromElsewhere:value=>value.runningOn!=='inst_here',
    sessionHoldsNoWork:value=>value.planOnly===true,
    retireCoveredPreviousActiveSession:async value=>{if(!state.covered)return false;events.push('retired');state.stored=null;return true;},
    attemptAutoRestoreActiveSession:async()=>{events.push('rerouted');return false;},
    setSessionPanelMode:mode=>events.push('panel:'+mode),
    setPlanStatus:message=>events.push('status:'+message),
    prettyDate:value=>value,
    AppDiagnostics:{capture:(where,error)=>events.push('error:'+where+':'+error.message)},
    events,state,clock
  });
  vm.runInContext(`const PREVIOUS_DAY_SYNC_WAIT_MS=20000;let previousDayQuestion=null,previousDayAsked=0;
async function handlePreviousActiveSession(value,options={}){previousDayAsked+=1;events.push(options.applying?'dialog:applying':options.checkDrive?'dialog:check':'dialog');if(state.answer)return state.answer(state,options);return false;}
${ask}\n${startup}\n${syncFirst}\n${holdsApply}\n${stillUncovered}\n${signedOut}\n${checkFirst}
globalThis.askAboutPreviousDay=askAboutPreviousDay;globalThis.handlePreviousActiveSession=handlePreviousActiveSession;globalThis.previousDayHoldsApply=previousDayHoldsApply;
globalThis.checkDriveThenAsk=checkDriveThenAsk;globalThis.question=()=>previousDayQuestion;`,context);
  return context;
}
const settle=async context=>{for(let i=0;i<400&&context.question();i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(context.question(),null,'the question settles');};
const results={};

// No Drive: asked straight after startup, as before.
{
  const c=world({connected:false,setUp:false});
  assert.equal(c.askAboutPreviousDay(session()),false,'startup does not wait on the question');
  await settle(c);
  assert.deepEqual(c.events,['panel:previous','panel:previous','dialog']);
  results.noDrive='asks';
}
// The sync brings the other device's Saved Day: covered, cleared, not asked.
{
  const c=world({syncBrings:state=>{state.covered=true;}});
  c.askAboutPreviousDay(session());await settle(c);
  assert.deepEqual(c.events,['panel:previous','sync:previous-day','retired'],'the day is covered after the sync: no question');
  assert.equal(c.state.stored,null);
  results.coveredBySync='quiet';
}
// The sync brings nothing that covers it: asked once the sync is done.
{
  const c=world({syncBrings:()=>{}});
  c.askAboutPreviousDay(session());await settle(c);
  assert.deepEqual(c.events,['panel:previous','sync:previous-day','panel:previous','dialog']);
  assert.ok(c.clock.now<20000,'asked when the sync finishes, not after the wait');
  results.notCovered='asks after the sync';
}
// The sync never finishes: asked after 20 s.
{
  const c=world();
  c.askAboutPreviousDay(session());await settle(c);
  assert.equal(c.events.at(-1),'dialog');
  assert.ok(c.clock.now>=20000&&c.clock.now<21000,'asked once the wait ends ('+c.clock.now+' ms)');
  results.syncHangs='asks after 20 s';
}
// The sync fails: asked at once.
{
  const c=world({failAfterMs:2000});
  c.askAboutPreviousDay(session());await settle(c);
  assert.equal(c.events.at(-1),'dialog');
  assert.ok(c.clock.now<3000,'a failed sync does not hold the question');
  results.syncFails='asks';
}
// Startup not finished: the question waits for it.
{
  const c=world({connected:false,setUp:false,startupDone:false});
  c.askAboutPreviousDay(session());
  for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.ok(!c.events.includes('dialog'),'not asked during startup');
  c.state.startupDone=true;await settle(c);
  assert.equal(c.events.at(-1),'dialog');
  results.startup='waits';
}
// Asked meanwhile (Review Previous Day or Apply): not asked twice.
{
  const c=world({syncBrings:()=>{}});
  c.askAboutPreviousDay(session());
  await c.handlePreviousActiveSession(session());
  await settle(c);
  assert.equal(c.events.filter(event=>event==='dialog').length,1,'one question');
  results.askedMeanwhile='once';
}
// Two starts of the question while one waits: one sync, one question.
{
  const c=world({syncBrings:()=>{}});
  c.askAboutPreviousDay(session());c.askAboutPreviousDay(session());await settle(c);
  assert.equal(c.events.filter(event=>event.startsWith('sync:')).length,1);
  assert.equal(c.events.filter(event=>event==='dialog').length,1);
  results.twice='once';
}
// The sync replaced the stored session (another device's today, or none):
// routed like any start, never asked about a day no longer here.
{
  const c=world({syncBrings:state=>{state.stored={id:'current',date:'2026-11-22',runningOn:'inst_other'};}});
  c.askAboutPreviousDay(session());await settle(c);
  assert.equal(c.events.at(-1),'rerouted');
  assert.ok(!c.events.includes('dialog'));
  results.replaced='rerouted';
}
// After the sync the copy turns out to be plan-only or another device's.
for(const [label,after] of [['plan only',session({planOnly:true})],['another device',session({runningOn:'inst_other'})]]){
  const c=world({syncBrings:state=>{state.stored=after;}});
  c.askAboutPreviousDay(session());await settle(c);
  assert.ok(!c.events.includes('dialog'),label+': not asked');
  assert.equal(c.events.at(-1),'panel:previous');
}
results.quietAfterSync='plan only, another device';

// Drive set up but signed out (a night ends Google's hour-long sign-in): the
// question offers to check Drive first. That tap signs in and syncs; a copy
// another device's save covers then clears with no second question.
{
  const c=world({connected:false,syncBrings:state=>{state.covered=true;}});
  c.state.answer=(state,options)=>options.checkDrive?c.checkDriveThenAsk():false;
  c.askAboutPreviousDay(session());await settle(c);
  for(let i=0;i<200&&!c.events.includes('retired');i++)await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(c.events,['panel:previous','panel:previous','dialog:check','sign-in','sync:previous-day','retired'],'one tap: signed in, synced, cleared');
  results.signedOutCovered='one tap clears it';
}
{
  const c=world({connected:false,syncBrings:()=>{}});
  c.state.answer=(state,options)=>options.checkDrive?c.checkDriveThenAsk():false;
  c.askAboutPreviousDay(session());await settle(c);
  for(let i=0;i<200&&c.events.at(-1)!=='dialog';i++)await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(c.events.slice(2),['dialog:check','sign-in','sync:previous-day','panel:previous','dialog'],'still not covered: the usual question');
  results.signedOutNotCovered='asks after the check';
}
{
  const c=world({connected:false,signInWorks:false});
  c.state.answer=(state,options)=>options.checkDrive?c.checkDriveThenAsk():false;
  c.askAboutPreviousDay(session());await settle(c);
  for(let i=0;i<200&&c.events.at(-1)!=='dialog';i++)await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(c.events.slice(2),['dialog:check','sign-in','error:session.previous-day-sign-in:closed','panel:previous','dialog'],'sign-in fails: the usual question, without the check');
  results.signInFails='asks';
}
// Apply with a previous day stored here.
{
  for(const [label,stored,expected] of [
    ['nothing stored',null,false],
    ['plan only',session({planOnly:true}),false],
    ['another device',session({runningOn:'inst_other'}),false]
  ]){
    const c=world({stored});
    assert.equal(await c.previousDayHoldsApply(),expected,label);
    assert.ok(!c.events.some(event=>event.startsWith('dialog')),label+': not asked');
  }
  const covered=world({covered:true});
  assert.equal(await covered.previousDayHoldsApply(),false,'a covered day is cleared and the plan applies');
  assert.deepEqual(covered.events,['retired']);

  const kept=world();
  assert.equal(await kept.previousDayHoldsApply(),true,'kept: today’s plan waits');
  assert.equal(kept.events[0],'dialog:applying');
  assert.ok(kept.events.at(-1).startsWith('status:Today’s plan was not applied'),'and says why');
  assert.deepEqual(kept.state.stored,session(),'the day stays stored');

  const discarded=world();discarded.state.answer=state=>{state.stored=null;};
  assert.equal(await discarded.previousDayHoldsApply(),false,'discarded: today’s plan applies');

  const recovered=world();recovered.state.answer=state=>{state.tasks.push({name:'yesterday'});};
  assert.equal(await recovered.previousDayHoldsApply(),true,'recovered into Review: today’s plan waits');

  const live=world();live.state.tasks.push({name:'today'});
  assert.equal(await live.previousDayHoldsApply(),false,'a day loaded is not checked');
  assert.deepEqual(live.events,[]);

  const broken=world();broken.state.loadFails=true;
  assert.equal(await broken.previousDayHoldsApply(),true,'an unreadable store holds the plan');
  assert.ok(broken.events.at(-1).startsWith('status:Today’s plan was not applied'));
  results.apply='held while an unsaved previous day is stored';
}
console.log(JSON.stringify({status:'PASS',suite:'previous-day-question',results}));
