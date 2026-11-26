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
  const freeze=Object.freeze,stableOrigin=()=>()=>{};
  const profile={id:'prof_profile_mve00000_00000001',scope:'',name:'QA',email:'',folder:'',createdAt:'2026-11-10T00:00:00.000Z',fresh:false,from:null};
  let switchCalls=0,addCalls=0,ensureCalls=0,renameCalls=0,settleCalls=0,reportedErrors=0,throwSwitch=false,throwAdd=false,releaseSettle,settleValue=true,lifecycleAuthority=true;
  let settleGate=Promise.resolve(),lifecycleEpoch=1;
  const profiles=freeze({
    current:()=>profile,list:()=>[profile],ensure:()=>{ensureCalls++;return profile;},rename:()=>{renameCalls++;return profile;},setAccount:()=>profile,adopt:()=>true,bindAccount:()=>true,renew:()=>profile,finishFirstStart:()=>profile,
    add:()=>{if(throwAdd)throw new Error('add failed');addCalls++;return true;},switchTo:()=>{if(throwSwitch)throw new Error('switch failed');switchCalls++;return true;},remove:()=>true,collect:async()=>({removed:false,error:null}),watch:()=>()=>{},removalPending:()=>0,unsupported:()=>false
  });
  // Profile rename can finish on blur/dialog close after the initiating click.
  // The checked owner must refuse an unsaved UI rename if ownership changed.
  {
    const priorInput=globalThis.HTMLInputElement;
    class RenameInput{constructor(value=''){this.value=value;this.hidden=false;}focus(){}select(){}blur(){}}
    globalThis.HTMLInputElement=RenameInput;
    try{
      const field=new RenameInput('Changed'),button={hidden:false,focus(){}};
      let authority=false,applied=0,persisted=0,rendered=0;
      const panel=Host.createPanelActions(freeze({
        document:{getElementById:id=>id==='profile-name-input'?field:id==='profile-name-button'?button:null,querySelector:()=>null},
        getStudentName:()=>profile.name,normalizeStudentName:value=>String(value||'').trim(),applyStudentName:value=>{applied++;return value;},
        persistUserDefaultName:()=>{persisted++;return true;},renderPanel:()=>{rendered++;},reportError:()=>{},appCanMutate:()=>authority,
        recent:freeze({opened:()=>{},closed:()=>{}})
      }));
      assert.equal(panel.saveName(),false,'rename completion after ownership loss must be refused inside the checked owner');
      assert.equal(field.value,profile.name);assert.equal(applied,0);assert.equal(persisted,0);assert.equal(rendered,1);
      assert.equal(panel.startRename(),false,'a secondary tab cannot open a local rename edit through the checked owner');
      authority=true;field.value='Changed';assert.equal(panel.saveName(),true);assert.equal(applied,1);assert.equal(persisted,1);
    }finally{
      if(priorInput===undefined)delete globalThis.HTMLInputElement;else globalThis.HTMLInputElement=priorInput;
    }
  }

  const lifecycle=Host.createLifecycle(freeze({
    captureOrigin:()=>{const origin=lifecycleEpoch;return ()=>{if(origin!==lifecycleEpoch)throw Error('retired owner');};},
    profiles,firstStart:freeze({open:()=>true,close:()=>{},render:()=>{},connect:async()=>true,finish:async()=>true,skip:()=>true,confirmField:()=>{},key:()=>true,joined:()=>{},isOpen:()=>false}),
    settleCurrentProfile:async()=>{settleCalls++;await settleGate;return settleValue;},
    getStudentName:()=>profile.name,isDefaultStudentName:()=>false,canonicalLocalRecoveryEmpty:async()=>false,renderProfile:()=>true,appCanMutate:()=>lifecycleAuthority,reportError:()=>{reportedErrors++;},
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
  throwSwitch=true;assert.equal(await lifecycle.switchProfile({target:new FakeElement('prof_other_mve00000_00000002')}),false);throwSwitch=false;
  throwAdd=true;assert.equal(await lifecycle.addProfile(),false);throwAdd=false;
  assert.equal(reportedErrors,2,'delegated profile actions contain registry failures instead of leaking rejected promises');
  assert.equal(settleCalls,5);

  lifecycleAuthority=false;
  const settledBefore=settleCalls,switchBefore=switchCalls,addBefore=addCalls,renameBefore=renameCalls;
  assert.equal(await lifecycle.switchProfile({target:new FakeElement('prof_other_mve00000_00000002')}),false);
  assert.equal(await lifecycle.addProfile(),false);
  await lifecycle.startProfile();
  assert.equal(settleCalls,settledBefore,'secondary profile actions stop before current-profile settlement work');
  assert.equal(switchCalls,switchBefore);assert.equal(addCalls,addBefore);assert.equal(renameCalls,renameBefore,'secondary startup cannot rename the device profile registry');
  assert.equal(ensureCalls,0);
  lifecycleAuthority=true;
  settleGate=new Promise(resolve=>{releaseSettle=resolve;});
  const staleSwitch=lifecycle.switchProfile({target:new FakeElement('prof_other_mve00000_00000002')});
  await Promise.resolve();lifecycleEpoch++;releaseSettle();assert.equal(await staleSwitch,false);assert.equal(switchCalls,switchBefore);
  settleGate=new Promise(resolve=>{releaseSettle=resolve;});
  const staleAdd=lifecycle.addProfile();await Promise.resolve();lifecycleEpoch++;releaseSettle();assert.equal(await staleAdd,false);assert.equal(addCalls,addBefore);
  settleGate=Promise.resolve();

  {
    let emptyAuthority=true,releaseEmpty,emptyEnsureCalls=0;
    const emptyGate=new Promise(resolve=>{releaseEmpty=resolve;});
    const emptyLifecycle=Host.createLifecycle(freeze({
      captureOrigin:stableOrigin,
      profiles:freeze({...profiles,current:()=>null,list:()=>[],ensure:()=>{emptyEnsureCalls++;return profile;}}),
      firstStart:freeze({open:()=>true,close:()=>{},render:()=>{},connect:async()=>true,finish:async()=>true,skip:()=>true,confirmField:()=>{},key:()=>true,joined:()=>{},isOpen:()=>false}),
      settleCurrentProfile:async()=>true,getStudentName:()=>'',isDefaultStudentName:()=>true,
      canonicalLocalRecoveryEmpty:async()=>{await emptyGate;return true;},renderProfile:()=>true,appCanMutate:()=>emptyAuthority,reportError:()=>{},
      backupProtection:freeze({ask:async()=>true}),setBackupProtectionSurfaceError:()=>{}
    }));
    const starting=emptyLifecycle.startProfile();await Promise.resolve();emptyAuthority=false;releaseEmpty();
    await starting;assert.equal(emptyEnsureCalls,0,'startup cannot create a profile after ownership is lost while checking whether local recovery is empty');
  }

  // First Start must re-check authority after asynchronous password setup.
  {
    const priorInput=globalThis.HTMLInputElement,priorDialog=globalThis.HTMLDialogElement;
    class FakeInput{constructor(value=''){this.value=value;this.hidden=false;}focus(){}}
    class FakeDialog{constructor(){this.open=true;}close(){this.open=false;}}
    globalThis.HTMLInputElement=FakeInput;globalThis.HTMLDialogElement=FakeDialog;
    try{
      const nodes=new Map([
        ['first-start-name',new FakeInput('Asha')],
        ['first-start-password',new FakeInput('long-enough-password')],
        ['first-start-confirm',new FakeInput('long-enough-password')],
        ['first-start-error',{textContent:'',hidden:true}],
        ['first-start-dialog',new FakeDialog()]
      ]);
      let authority=true,releasePassword,finishCalls=0,applyCalls=0,firstStartEpoch=1;
      let passwordGate=new Promise(resolve=>{releasePassword=resolve;});
      const firstStart=Host.createFirstStart(freeze({
        captureOrigin:()=>{const origin=firstStartEpoch;return ()=>{if(origin!==firstStartEpoch)throw Error('retired owner');};},
        document:{getElementById:id=>nodes.get(id)||null},profiles:freeze({...profiles,finishFirstStart:()=>{finishCalls++;return profile;}}),
        backupProtection:freeze({enable:async()=>{await passwordGate;return true;}}),provider:freeze({locationStatus:()=>null}),connectDriveForProfile:async()=>true,
        getStudentName:()=>profile.name,isDefaultStudentName:()=>false,applyStudentName:value=>{applyCalls++;return value;},persistUserDefaultName:()=>true,renderProfile:()=>true,reportError:()=>{reportedErrors++;},
        appCanMutate:()=>authority
      }));
      const finishing=firstStart.finish();await Promise.resolve();authority=false;releasePassword();
      assert.equal(await finishing,false,'First Start cannot resume profile mutation after ownership is lost across an async password step');
      assert.equal(finishCalls,0);assert.equal(applyCalls,0);
      assert.match(nodes.get('first-start-error').textContent,/Another tab has control/);
      assert.equal(firstStart.skip(),false,'First Start skip is also authority-fenced inside its checked owner');
      authority=true;passwordGate=new Promise(resolve=>{releasePassword=resolve;});
      const stale=firstStart.finish();await Promise.resolve();firstStartEpoch++;releasePassword();assert.equal(await stale,false);assert.equal(finishCalls,0);assert.equal(applyCalls,0);
      passwordGate=new Promise(resolve=>{releasePassword=resolve;});
      const closed=firstStart.finish();await Promise.resolve();firstStart.close();releasePassword();assert.equal(await closed,false);assert.equal(finishCalls,0);
    }finally{
      if(priorInput===undefined)delete globalThis.HTMLInputElement;else globalThis.HTMLInputElement=priorInput;
      if(priorDialog===undefined)delete globalThis.HTMLDialogElement;else globalThis.HTMLDialogElement=priorDialog;
    }
  }

  // Drive binding may outlive the initiating click/account lookup. Local
  // registry mutation must stop if this profile loses write authority meanwhile.
  {
    let authority=false,setAccounts=0,adopts=0,confirmResolve;
    const confirmGate=new Promise(resolve=>{confirmResolve=resolve;});
    const binding=Host.createDriveBinding(freeze({
      captureOrigin:stableOrigin,
      profiles:freeze({...profiles,bindAccount:()=>{setAccounts++;adopts++;return true;}}),
      appCanMutate:()=>authority,
      interactions:freeze({confirm:async()=>await confirmGate,notify:()=>true}),
      clearBaseline:async()=>true,renderProfile:()=>true,endConnectCard:()=>true,firstStartJoined:()=>true,capture:()=>{},
      storageHealthTime:()=>'',now:()=>Date.now()
    }));
    assert.equal(await binding.bind({email:'qa@example.com',folder:'folder-1',mine:true,found:profile.id},()=>{}),'refuse');
    assert.equal(setAccounts,0,'secondary Drive binding cannot update the device profile registry');
    authority=true;binding.markRequested();
    const pending=binding.bind({email:'qa@example.com',folder:'folder-2',found:'prof_remote_mve00000_abcdef12',mine:false,library:{notes:1,savedAt:'2026-11-23T00:00:00.000Z'}},()=>{});
    await Promise.resolve();authority=false;confirmResolve(true);
    assert.equal(await pending,'refuse','a Drive-library decision cannot resume registry mutation after ownership changes');
    assert.equal(adopts,0);assert.equal(setAccounts,0);
  }


  // Provider authorization, profile ownership and one library's consent
  // must still be current when the registry is actually updated.
  for(const stage of ['provider-choice','owner-choice','baseline-provider','baseline-failure','success','replacement']){
    let mine={...profile,email:'old@example.com',folder:'old-folder'},epoch=1,providerEpoch=1,writes=0,joined=0,ended=0,clears=0;
    const questions=[],baselines=[];
    const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
    const binding=Host.createDriveBinding(freeze({
      captureOrigin:()=>{const original=epoch;return ()=>{if(original!==epoch)throw Error('retired owner');};},
      profiles:freeze({...profiles,current:()=>mine,list:()=>[mine],bindAccount:(id,account)=>{writes++;mine={...mine,id,...account};return true;}}),
      appCanMutate:()=>true,interactions:freeze({confirm:()=>{const g=defer();questions.push(g);return g.promise;},notify:()=>{}}),
      clearBaseline:async assert=>{clears++;assert();const g=defer();baselines.push(g);const result=await g.promise;assert();return result;},
      renderProfile:()=>{},endConnectCard:()=>{ended++;},firstStartJoined:()=>{joined++;},capture:()=>{},storageHealthTime:()=>'',now:()=>Date.now()
    }));
    const begin=(email,folder,found)=>{const original=providerEpoch;binding.markRequested();return binding.bind({email,folder,found,mine:false,library:{notes:1}},()=>{if(original!==providerEpoch)throw Error('retired authorization');});};
    const pending=begin('new@example.com','folder-2','prof_remote_mve00000_abcdef12');
    assert.equal(questions.length,1);
    if(stage==='replacement'){
      providerEpoch++;const next=begin('other@example.com','folder-3','prof_remote_mve00000_abcdef13');assert.equal(questions.length,2);
      questions[0].resolve(true);assert.equal(await pending,'refuse');assert.equal(writes,0);assert.equal(ended,0);
      questions[1].resolve(true);await Promise.resolve();assert.equal(baselines.length,1);baselines[0].resolve(true);
      assert.equal(await next,'adopt');assert.equal(mine.email,'other@example.com');assert.equal(writes,1);assert.equal(joined,1);continue;
    }
    if(stage==='provider-choice')providerEpoch++;
    if(stage==='owner-choice')epoch++;
    questions[0].resolve(true);await Promise.resolve();
    if(stage.endsWith('choice')){assert.equal(await pending,'refuse');assert.deepEqual([writes,clears,joined,ended],[0,0,0,0]);continue;}
    assert.equal(baselines.length,1);assert.equal(writes,0,'adoption must wait until baseline clearance succeeds');
    if(stage==='baseline-provider')providerEpoch++;
    baselines[0].resolve(stage!=='baseline-failure');
    assert.equal(await pending,stage==='success'?'adopt':'refuse');
    assert.equal(writes,stage==='success'?1:0);assert.equal(joined,stage==='success'?1:0);
    assert.equal(mine.email,stage==='success'?'new@example.com':'old@example.com');
  }

  let holdReleased=0,holdSettled=false,releaseHold,deletionAuthority=true,deletionSettlements=0,mutationRuns=0,authorityAssertions=0;
  const holdGate=new Promise(resolve=>{releaseHold=()=>{holdSettled=true;resolve();};});
  let backupDeletes=0,removes=0,captures=0,notices=0;
  const deletion=Host.createDeletion(freeze({
    captureOrigin:stableOrigin,
    profiles:freeze({...profiles,remove:()=>{removes++;return true;}}),
    appCanMutate:()=>deletionAuthority,settleCurrentProfile:async()=>{deletionSettlements++;return deletionAuthority;},
    mutation:freeze({run:async(_kind,operation)=>{mutationRuns++;return operation(freeze({assert:()=>{authorityAssertions++;if(!deletionAuthority)throw new Error('authority lost');return true;}}));}}),
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
  assert.equal(deletionSettlements,1,'destructive profile deletion settles the current profile before external/local deletion');
  assert.equal(mutationRuns,1);assert.ok(authorityAssertions>=3,'destructive deletion reasserts mutation authority after asynchronous side effects');

  deletionAuthority=false;
  const removesBefore=removes,backupDeletesBefore=backupDeletes;
  assert.equal(await deletion.deleteHere(),false,'profile deletion cannot begin without current write authority');
  assert.equal(removes,removesBefore);assert.equal(backupDeletes,backupDeletesBefore);
  deletionAuthority=true;

  // A reload only follows a complete writer barrier; any failed stage is contained.
  for(const failure of ['', 'draft', 'preferences', 'deletions', 'authority']){
    const order=[];
    const settlement=Host.createSettlement({captureOrigin:stableOrigin,AppOwnership:{canMutate:()=>true},AppMutationCoordinator:{settled:async()=>order.push('mutation')},appCanMutate:()=>failure!=='authority',
      PlanDraftEditor:{flush:async options=>{assert.equal(options.strictDurability,true);order.push('draft');return failure!=='draft';}},PlanData:{settled:async()=>order.push('plan')},
      flushPreferences:async()=>{order.push('preferences');return failure!=='preferences';},
      settleAttachmentWriters:async()=>order.push('editors'),deletionRecovery:{flush:async()=>{order.push('deletions');return failure!=='deletions';}},AppDiagnostics:{capture:()=>order.push('error')},setPlanStatus:()=>order.push('status')});
    assert.equal(await settlement.settleCurrentProfileBeforeReload(),!failure);
    if(!failure)assert.deepEqual(order,['mutation','draft','plan','preferences','editors','deletions','mutation']);
    else{
      assert.deepEqual(order.slice(-2),['error','status']);
      if(failure==='draft')assert.ok(!order.includes('preferences'));
      if(failure==='preferences')assert.ok(!order.includes('editors'),'failed personal-preference durability stops profile reload before later writer settlement');
    }
  }


  // Profile consent is a capability of the original claim and profile, not
  // merely of whatever owner/account happens to be active after the modal.
  for(const stage of ['choice','confirmation','settlement','identity','remote-keep','remote-delete']){
    let epoch=1,mine={...profile,email:'',folder:''},removed=0,external=0,renewed=0,runs=0,release,enteredResolve;
    const gate=new Promise(r=>release=r),entered=new Promise(r=>enteredResolve=r);
    const wait=async(value)=>{enteredResolve();await gate;return value;};
    const deletion=Host.createDeletion(freeze({
      captureOrigin:()=>{const captured=epoch;return ()=>{if(captured!==epoch)throw Error('retired claim');};},
      profiles:freeze({...profiles,current:()=>mine,list:()=>[mine],remove:()=>{removed++;return true;},renew:()=>{renewed++;return mine;}}),
      appCanMutate:()=>true,settleCurrentProfile:()=>stage==='settlement'?wait(true):Promise.resolve(true),
      mutation:freeze({run:async(_kind,operation)=>{runs++;return operation(freeze({assert:()=>true}));}}),
      provider:freeze({locationStatus:()=>null,suspendBackground:()=>null}),
      device:freeze({status:()=>({connected:false}),deleteBackups:async()=>{external++;return true;}}),
      interactions:freeze({choose:()=>stage==='choice'?wait('everywhere'):Promise.resolve('everywhere'),
        confirm:()=>['confirmation','identity','remote-keep','remote-delete'].includes(stage)?wait(stage!=='remote-keep'):Promise.resolve(true),notify:()=>{}}),
      capture:()=>{},getStudentName:()=>mine.name,renderProfile:()=>true,verifiedSourceRevision:()=>'',currentBackupSourceRevision:()=>''}));
    const pending=stage.startsWith('remote')?deletion.driveProfileDeleted({profile:mine.id}):deletion.deleteThisProfile();
    await entered;
    if(stage==='identity')mine={...mine,email:'new@example.com',folder:'new-folder'};else epoch++;
    release();assert.equal(await pending,false,stage);assert.deepEqual([removed,external,renewed,runs],[0,0,0,0],stage);
  }
  // Do not start the next writer in a reload barrier under a successor claim.
  {
    let epoch=1,release,enteredResolve;const gate=new Promise(r=>release=r),entered=new Promise(r=>enteredResolve=r),order=[];
    const settlement=Host.createSettlement({
      captureOrigin:()=>{const captured=epoch;return ()=>{if(captured!==epoch)throw Error('retired claim');};},
      AppOwnership:{canMutate:()=>true},AppMutationCoordinator:{settled:async()=>order.push('mutation')},appCanMutate:()=>true,
      PlanDraftEditor:{flush:async()=>{order.push('draft');enteredResolve();await gate;return true;}},PlanData:{settled:async()=>order.push('plan')},
      flushPreferences:async()=>{order.push('preferences');return true;},settleAttachmentWriters:async()=>order.push('editors'),deletionRecovery:{flush:async()=>true},
      AppDiagnostics:{capture:()=>{}},setPlanStatus:()=>{}});
    const pending=settlement.settleCurrentProfileBeforeReload();await entered;epoch++;release();
    assert.equal(await pending,false);assert.deepEqual(order,['mutation','draft']);
  }

  console.log(JSON.stringify({status:'PASS',contract:'profiles-host',checks:['switch-settlement-gate','add-settlement-gate','delegated-action-error-containment','deletion-quiescence','successful-hold-release']},null,2));
}finally{
  if(priorElement===undefined)delete globalThis.Element;else globalThis.Element=priorElement;
}
