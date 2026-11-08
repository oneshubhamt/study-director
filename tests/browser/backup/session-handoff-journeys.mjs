import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitFor} from '../../helpers/browser-harness.mjs';
import {faults,ledger,hooks,sync,connect,sleep} from '../../helpers/drive-browser.mjs';
import {journeyLog,openDevice,hold,anyUpload,runSession,view,noteOf,writeNote,upload,syncNow,settled,continueHere,stopsWithin,markDone,owner,running,elsewhere,bothSettled,openFindings,keeps,explain,holds} from '../../helpers/sync-journey-world.mjs';

// Sync journeys, part 2: the day's session moved between a laptop (A) and a
// phone (B) when a device was closed, back and forth within a minute, while
// a large change uploads slowly, and to a tablet (C) whose clock is two hours
// behind. Part 1 is sync-journeys.mjs; the helpers say what each checks.

const {steps,step}=journeyLog('session-handoff-journeys'),findings=openFindings('session-handoff-journeys');
const server=await startReleaseServer();
const laptop=await launchChromium({profilePrefix:'sd-handoff-a-'}),phone=await launchChromium({profilePrefix:'sd-handoff-b-'});let tablet=null;
let a=null,b=null,c=null;
try{
  a=await openDevice(laptop,server,'A');b=await openDevice(phone,server,'B');
  await connect(a,'A');await waitFor(async()=>!!(await sync(a))?.syncedAt,{label:'A synced',timeout:60000});await settled(a,'A');
  await connect(b,'B');await waitFor(async()=>!!(await sync(b))?.syncedAt,{label:'B synced',timeout:60000});await upload(b);await settled(b,'B');
  // The laptop runs the day; the phone shows it running there.
  assert.equal(await a.evaluate(runSession('Day')),'running','the laptop starts the day');
  await upload(a);await settled(a,'A');await elsewhere(b,'B');
  let ms=0;

  // Journey 6. The phone was closed while the laptop finished a block. On
  // reopening, Continue Here pressed at once brings the laptop's latest.
  await b.evaluate(`(async()=>{await __PWA6.flushLiveDraft();})()`);await phone.closePage(b);b=null;
  const laptopFinished=(await view(a)).current;await markDone(a);await upload(a);await settled(a,'A');
  const laptopLatest=await view(a);assert.ok(laptopLatest.done.includes(laptopFinished));
  b=await openDevice(phone,server,'B');
  ms=await continueHere(b,'B');
  const behind=await view(b);assert.ok(behind.done.includes(laptopFinished)&&behind.current===laptopLatest.current,`the phone continues from the laptop's latest: ${laptopFinished} done, on ${laptopLatest.current} (${JSON.stringify(behind)})`);
  await stopsWithin(a,'A');await bothSettled([['A',a],['B',b]],'reopened');await syncNow(a);await bothSettled([['A',a],['B',b]],'reopened');
  step('continue on a device behind Drive',{continueHereMs:ms});

  // Journey 7. Back and forth within a minute: laptop, phone, laptop.
  await elsewhere(a,'A');ms=await continueHere(a,'A');
  await elsewhere(b,'B');const second=await continueHere(b,'B');
  await elsewhere(a,'A');const third=await continueHere(a,'A');
  await stopsWithin(b,'B');await bothSettled([['A',a],['B',b]],'ping-pong');await syncNow(b);await bothSettled([['A',a],['B',b]],'ping-pong');
  assert.equal(await running(a),true,'the last device pressed runs it');assert.equal((await view(b)).loop,false,'the other is stopped');
  await findings.noReviews([['A',a],['B',b]],'ping-pong');
  step('back and forth',{continueHereMs:[ms,second,third]});

  // Journey 8. The laptop finishes a block but is closed before it can
  // upload. The phone continues from Drive's latest; when the laptop opens
  // again it stops, and the block it finished is not lost.
  const laptopNet=hold('A',anyUpload);const laptopUnsent=(await view(a)).current;await markDone(a);await sleep(500);
  await laptop.closePage(a);a=null;laptopNet.release();
  await elsewhere(b,'B');ms=await continueHere(b,'B');
  a=await openDevice(laptop,server,'A');
  await waitFor(async()=>!(await view(a)).loop,{label:'the reopened laptop does not run the session',timeout:40000});
  await bothSettled([['A',a],['B',b]],'closed');await syncNow(b);await bothSettled([['A',a],['B',b]],'closed');await syncNow(a);await bothSettled([['A',a],['B',b]],'closed');
  const closed=await keeps(b,'the phone',laptopUnsent,'laptop closed before uploading');
  step('old owner closed before uploading',{continueHereMs:ms,lastBlock:closed});

  // Journey 9. The phone uploads a large change slowly; the laptop's
  // Continue Here does not wait for it.
  await elsewhere(a,'A');
  // Near the 70,000-character limit for one note.
  await writeNote(b,'large',`${'Long study notes. '.repeat(3800)}end`);
  const slow=hold('B',anyUpload);void upload(b);
  await waitFor(()=>slow.reached,{label:'the phone is uploading',timeout:30000});
  ms=await continueHere(a,'A');
  assert.ok(ms<15000,`Continue Here did not wait for the other device's upload (${ms} ms)`);
  slow.release();await stopsWithin(b,'B');await bothSettled([['A',a],['B',b]],'slow upload');await syncNow(a);await bothSettled([['A',a],['B',b]],'slow upload');
  await waitFor(async()=>(await noteOf(a,'large')||'').endsWith('end'),{label:'the large change arrives',timeout:90000});
  step('continue during a slow upload',{continueHereMs:ms});

  // Journey 10. A tablet whose clock is two hours behind joins and continues
  // the session: its timer shows the same time left, and what it does
  // becomes Drive's newest, so it reaches the laptop.
  tablet=await launchChromium({profilePrefix:'sd-journey-c-'});
  c=await openDevice(tablet,server,'C',{clockMs:-2*60*60*1000});
  await c.evaluate(`document.querySelector('[data-action="connect-drive-backup"]').click()`);
  await waitFor(()=>c.evaluate(`__PWA6.BackupProviderRuntime.connected('google-drive')`),{label:'C connects',timeout:20000});
  await waitFor(async()=>!!(await sync(c))?.syncedAt,{label:'C synced',timeout:90000});await upload(c);await settled(c,'C');
  await upload(a);await settled(a,'A');await elsewhere(c,'C');
  const before=await view(a);ms=await continueHere(c,'C');const onTablet=await view(c);
  const seconds=text=>text.split(':').map(Number).reduce((total,part)=>total*60+part,0);
  assert.ok(Math.abs(seconds(onTablet.countdown)-seconds(before.countdown))<=30,`the tablet shows the time left as the laptop did (${onTablet.countdown} vs ${before.countdown})`);
  await stopsWithin(a,'A');
  const tabletFinished=onTablet.current;await markDone(c);await upload(c);await settled(c,'C');
  await syncNow(a);await settled(a,'A');
  await waitFor(async()=>(await view(a)).done.includes(tabletFinished),{label:'the block finished on the tablet reaches the laptop',timeout:60000});
  step('tablet with its clock two hours behind',{continueHereMs:ms,countdown:[before.countdown,onTablet.countdown]});

  for(const page of [a,b,c])assert.deepEqual(page.warnings.filter(text=>/\[Study Director\]/u.test(text)),[]);
  // A page closed on purpose (journeys 6 and 8) cannot be answered.
  assert.deepEqual(faults.filter(text=>!/Invalid InterceptionId/u.test(text)),[],'every request reached the simulated Drive or failed on purpose');
  console.log(JSON.stringify({status:'PASS',suite:'session-handoff-journeys',journeys:steps.length,steps,openFindings:findings.found}));
}catch(error){console.error(ledger.slice(-40).join('\n'));await explain([['A',a],['B',b],['C',c]]);throw error;}
finally{for(const entry of [...holds])entry.release();hooks.before=null;await laptop.close();await phone.close();if(tablet)await tablet.close();await server.close();}
