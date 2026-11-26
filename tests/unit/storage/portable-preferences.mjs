import {readScript} from '../../../build/source-script.mts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
for(const file of ['source/core/internal.ts','source/core/record-codecs.ts']){
  vm.runInThisContext(readScript(path.join(ROOT,file)),{filename:file});
}
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const RecordCodecs=registry.require('record-codecs',1);
const codec=RecordCodecs.createPersonalDataCodec(Object.freeze({
  maxScheduleChars:100000,maxStudentNameChars:100,maxQuoteChars:1000,
  minPracticeTargetMs:1000,maxPracticeTargetMs:86400000
}));
const plans=Object.freeze({draft:null,savedPlans:Object.freeze([]),defaultId:null});
const portable=Object.freeze({
  studentName:'Student',theme:'glass',presentation:'glass',quote:'Stay steady',practiceCueMode:'quiet',
  fontScale:1.08,practiceTargetMs:600000,nudge:Object.freeze({enabled:true,sound:false,nudgeAfter:45,breakMinutes:5})
});
const current=Object.freeze({version:2,plans,preferences:portable});
assert.deepEqual(codec.normalize(current),current,'Current v2 portable personal data must validate unchanged.');
assert.throws(()=>codec.normalize(Object.freeze({version:2,plans,preferences:Object.freeze({...portable,systemAlerts:true})})),/unexpected fields/i,'Current v2 must reject device-local fields.');
assert.throws(()=>codec.normalize(Object.freeze({version:2,plans,preferences:Object.freeze({...portable,keepScreenAwake:true})})),/unexpected fields/i,'Current v2 must reject Wake Lock portability.');
for(const [field,value] of [['systemAlertsEnabled',true],['installationId','install-local'],['storageHealth','ok'],['pwaUpdateState','ready']])assert.throws(()=>codec.normalize(Object.freeze({version:2,plans,preferences:Object.freeze({...portable,[field]:value})})),/unexpected fields/i,`${field} must remain device-local and outside managed historical restore.`);
assert.equal(Object.hasOwn(codec,'normalizeLegacy'),false,'Current PersonalData codec must not expose historical conversion.');
assert.equal(Object.hasOwn(codec,'protectedPreferences'),false,'Current PersonalData codec must not expose v1 protected-preference parsing.');
const stored=codec.portablePreferences(Object.freeze({...portable,updatedAt:'2026-09-20T00:00:00.000Z'}));
assert.equal(stored.version,2);
assert.deepEqual(codec.currentPortablePreferences(Object.freeze(stored)),stored);
for(const soundMode of ['full','minimal','off']){
  const preferences={...portable,nudge:{enabled:false,nudgeAfter:50,breakMinutes:10},soundMode};
  const snapshot=codec.portablePreferences({...preferences,updatedAt:null});
  assert.deepEqual(codec.currentPortablePreferences(JSON.parse(JSON.stringify(snapshot))),snapshot);
  assert.deepEqual(codec.normalize({version:2,plans,preferences}).preferences,preferences);
  assert.equal(snapshot.nudge.sound,undefined,'new rhythm configuration must not carry sound ownership');
}
assert.throws(()=>codec.preferences({...portable,soundMode:'loud'}),/sound mode/);
// Execute the actual host queue function with controlled ownership, pending
// persistence and recovery-request retirement. No simulated copy of the logic.
{
  const main=readScript(path.join(ROOT,'source/host/main.ts'));
  const start=main.indexOf('async function flushProtectedPreferences('),end=main.indexOf('function scheduleProtectedPreferencesWrite(',start);
  assert.ok(start>=0&&end>start,'host preference queue is available');
  for(const changed of ['hold','owner','snapshot']){
    let release;const gate=new Promise(resolve=>{release=resolve;});
    const env=vm.runInNewContext(`
      let protectedPreferencesWriteTimer=null,protectedPreferencesDirty=true,protectedPreferencesWriteFailure=null;
      let protectedPreferencesState={studentName:'Accepted'},protectedPreferencesWriteChain=gate;
      let owner=1,hold=true,writes=0,feedback=0,committed=null;
      const appCanMutate=()=>true;
      const AppOwnership={issueWriteToken:()=>owner,assertWriteToken:t=>{if(t!==owner)throw new Error('owner retired');}};
      const AppData={personalPreferences:{write:async(value,options)=>{options.assertOrigin();writes++;committed=value;return value;}}};
      const acceptProtectedPreferences=()=>{feedback++;},refreshAppearanceMirrors=()=>{feedback++;};
      const AppDiagnostics={capture:()=>{feedback++;}},markStorageHealthError=()=>{feedback++;};
      ${main.slice(start,end)}
      ({
        start:()=>flushProtectedPreferences({assertOrigin:()=>{if(!hold)throw new Error('hold retired');}}),
        retire:kind=>{hold=false;if(kind==='owner')owner++;if(kind==='snapshot'){protectedPreferencesState={studentName:'Newer'};protectedPreferencesDirty=false;}},
        flush:()=>flushProtectedPreferences(),status:()=>({dirty:protectedPreferencesDirty,writes,feedback,committed:committed?.studentName??null})
      })
    `,{gate});
    const pending=env.start();env.retire(changed);release();
    await assert.rejects(pending,/hold retired/);
    assert.equal(env.status().writes,0);assert.equal(env.status().feedback,0);
    assert.equal(env.status().dirty,changed==='hold','only the still-current accepted snapshot stays pending');
    if(changed==='hold'){assert.equal(await env.flush(),true);assert.equal(env.status().committed,'Accepted');assert.equal(env.status().writes,1);}
  }
}
console.log(JSON.stringify({status:'PASS',suite:'portable-preferences',currentPortableOnly:true,historicalConversionIsolated:true,canonicalPreferencesV2:true},null,2));
