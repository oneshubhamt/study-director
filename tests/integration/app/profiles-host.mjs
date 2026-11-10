import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const priorElement=globalThis.Element;
class FakeElement{
  constructor(profile=''){this.dataset={profile};}
  closest(){return this;}
}
globalThis.Element=FakeElement;
try{
  for(const file of ['source/core/internal.ts','source/core/profiles-host.ts'])vm.runInThisContext(readRuntimeSource(file),{filename:file});
  const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
  const Host=registry.require('profiles-host',1);
  const freeze=Object.freeze;
  const profile={id:'prof_profile_mve00000_00000001',scope:'',name:'QA',email:'',folder:'',createdAt:'2026-11-10T00:00:00.000Z',fresh:false,from:null};
  let switchCalls=0,addCalls=0,settleCalls=0,releaseSettle,settleValue=true;
  let settleGate=Promise.resolve();
  const profiles=freeze({
    current:()=>profile,list:()=>[profile],ensure:()=>profile,rename:()=>profile,setAccount:()=>profile,adopt:()=>true,renew:()=>profile,finishFirstStart:()=>profile,
    add:()=>{addCalls++;return true;},switchTo:()=>{switchCalls++;return true;},remove:()=>true,collect:async()=>({removed:false,error:null}),watch:()=>()=>{},removalPending:()=>0,unsupported:()=>false
  });
  const lifecycle=Host.createLifecycle(freeze({
    profiles,firstStart:freeze({open:()=>true,close:()=>{},render:()=>{},connect:async()=>true,finish:async()=>true,skip:()=>true,confirmField:()=>{},key:()=>true,joined:()=>{},isOpen:()=>false}),
    settleCurrentProfile:async()=>{settleCalls++;await settleGate;return settleValue;},
    getStudentName:()=>profile.name,isDefaultStudentName:()=>false,canonicalLocalRecoveryEmpty:async()=>false,renderProfile:()=>true,appCanMutate:()=>true,
    backupProtection:freeze({ask:async()=>true}),setBackupProtectionSurfaceError:()=>{}
  }));
  settleGate=new Promise(resolve=>{releaseSettle=resolve;});
  const switching=lifecycle.switchProfile({target:new FakeElement('prof_other_mve00000_00000002')});
  await Promise.resolve();
  assert.equal(switchCalls,0,'profile switch waits for current-profile settlement before changing the active registry');
  releaseSettle();assert.equal(await switching,true);assert.equal(switchCalls,1);
  settleGate=Promise.resolve();settleValue=false;
  assert.equal(await lifecycle.addProfile(),false,'failed settlement blocks Add profile reload');
  assert.equal(addCalls,0);
  settleValue=true;assert.equal(await lifecycle.addProfile(),true);assert.equal(addCalls,1);
  assert.equal(settleCalls,3);

  let holdReleased=0,holdSettled=false,releaseHold;
  const holdGate=new Promise(resolve=>{releaseHold=()=>{holdSettled=true;resolve();};});
  let backupDeletes=0,removes=0,captures=0,notices=0;
  const deletion=Host.createDeletion(freeze({
    profiles:freeze({...profiles,remove:()=>{removes++;return true;}}),
    provider:freeze({locationStatus:()=>null,suspendBackground:()=>freeze({settled:holdGate,release:()=>{holdReleased++;}})}),
    device:freeze({status:()=>({connected:false}),deleteBackups:async()=>{backupDeletes++;return true;}}),
    interactions:freeze({choose:async()=>null,confirm:async()=>true,notify:()=>{notices++;}}),
    capture:()=>{captures++;},getStudentName:()=>profile.name,renderProfile:()=>true,verifiedSourceRevision:()=>'',currentBackupSourceRevision:()=>''
  }));
  const deleting=deletion.deleteHere();
  await Promise.resolve();
  assert.equal(backupDeletes,0,'profile deletion waits until background publication is quiescent');
  releaseHold();assert.equal(await deleting,true);
  assert.equal(backupDeletes,1);assert.equal(removes,1);assert.equal(holdSettled,true);assert.equal(holdReleased,1,'successful deletion releases its publication hold exactly once');
  assert.equal(captures,0);assert.equal(notices,0);

  console.log(JSON.stringify({status:'PASS',contract:'profiles-host',checks:['switch-settlement-gate','add-settlement-gate','deletion-quiescence','successful-hold-release']},null,2));
}finally{
  if(priorElement===undefined)delete globalThis.Element;else globalThis.Element=priorElement;
}
