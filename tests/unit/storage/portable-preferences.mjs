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
console.log(JSON.stringify({status:'PASS',suite:'portable-preferences',currentPortableOnly:true,historicalConversionIsolated:true,canonicalPreferencesV2:true},null,2));
