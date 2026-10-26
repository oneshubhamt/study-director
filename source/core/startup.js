(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('startup-lifecycle',1,()=>{
  const freeze=Object.freeze;
  function createCoordinator(input){
    if(!input||!Object.isFrozen(input))throw new TypeError('Startup/lifecycle input must be frozen.');
    exactObject(input,['environment','diagnostics','ownership','timer','flushers','startup','activation'],'Startup/lifecycle input');
    exactObject(input.environment,['document','window'],'Startup/lifecycle environment');
    functions(input.diagnostics,['guard'],'Startup/lifecycle diagnostics');
    functions(input.ownership,[
      'install','evaluate','canMutate','hasControl','writeLease','flushAndRelease','transitionReleasing','release','setPrimary'
    ],'Startup/lifecycle ownership');
    functions(input.timer,['stopPresentation','syncAfterWake'],'Startup/lifecycle Timer adapter');
    functions(input.flushers,[
      'planDraft','preferences','activeSession','notes','deletionRecovery'
    ],'Startup/lifecycle flushers');
    functions(input.startup,[
      'prepareCanonicalData','restoreAppearance','bindDom','recoverInterruptedLibraryClear','recoverInterruptedRestore','loadNotes','hydrateDrafts','previewPlan',
      'startClock','startHeaderClock','refreshCoreUi','renderRecovery','checkBackup',
      'showEmptyIfNeeded','openInitialTab','restoreActiveSession','showNameSetup','inspectStorage','reconcileLifecycle','applyLaunchRoute','verifyReady','markReady','reportFailure','clearFailure'
    ],'Startup stages');
    functions(input.activation,['publish'],'Startup activation adapter');

    const doc=input.environment.document;
    const win=input.environment.window;
    const diagnostics=input.diagnostics;
    const ownership=input.ownership;
    const timer=input.timer;
    const flushers=input.flushers;
    const startup=input.startup;
    const activation=input.activation;
    let startRequested=false;
    let waitingForDom=false;
    let domReadyListenerInstalled=false;
    let initializing=false;
    let fullyInitialized=false;
    let lifecycleState='idle';
    let currentStage='';
    let failedStage='';
    let lastFailure=null;
    let domBindingsInstalled=false;
    let lifecycleInstalled=false;
    let exitHandled=false;
    let wakeRevision=0;
    let wakeSequence=Promise.resolve();
    let startSequence=Promise.resolve();
    const completedStages=[];

    function status(){
      return freeze({
        format:'study-director.startup-lifecycle-status',
        contractVersion:1,
        startRequested,waitingForDom,initializing,fullyInitialized,state:lifecycleState,failed:lifecycleState==='failed',
        failedStage,lastFailure,domBindingsInstalled,lifecycleInstalled,exitHandled,
        completedStages:freeze(completedStages.slice())
      });
    }
    async function runStage(name,operation){
      currentStage=name;
      const result=await operation();
      completedStages.push(name);
      currentStage='';
      return result;
    }
    function waitForDomReady(){
      if(domReadyListenerInstalled)return false;
      domReadyListenerInstalled=true;
      waitingForDom=true;
      doc.addEventListener('DOMContentLoaded',()=>{
        domReadyListenerInstalled=false;
        waitingForDom=false;
        if(startRequested)start();
        else installDomBindings();
      },{once:true});
      return true;
    }
    function installDomBindings(){
      if(domBindingsInstalled)return false;
      if(doc.readyState==='loading'){waitForDomReady();return false;}
      startup.bindDom();
      domBindingsInstalled=true;
      return true;
    }
    function flush(){
      if(!ownership.canMutate())return false;
      diagnostics.guard('lifecycle.flush-schedule',flushers.planDraft);
      diagnostics.guard('lifecycle.flush-preferences',flushers.preferences);
      diagnostics.guard('lifecycle.flush-session',flushers.activeSession);
      diagnostics.guard('lifecycle.flush-notes',flushers.notes);
      diagnostics.guard('lifecycle.flush-deletion-recovery',flushers.deletionRecovery);
      return true;
    }
    function queueWakeReconciliation(source){
      if(lifecycleState==='failed')return Promise.resolve(false);
      const revision=++wakeRevision;
      wakeSequence=wakeSequence.catch(()=>false).then(async()=>{
        const acquired=await ownership.evaluate();
        if(revision!==wakeRevision||doc.hidden||!acquired||!ownership.canMutate())return false;
        timer.syncAfterWake();
        return true;
      }).catch(error=>{
        diagnostics.guard(`lifecycle.${source}-ownership`,()=>{throw error;});
        return false;
      });
      return wakeSequence;
    }
    function handleVisibilityChange(){
      if(doc.hidden){
        activation.publish('background','visibilitychange',{destructive:false});
        wakeRevision++;
        timer.stopPresentation();
        flush();
        if(ownership.hasControl())ownership.writeLease();
        return;
      }
      activation.publish('visibility-return','visibilitychange',{destructive:false});
      void queueWakeReconciliation('visibility');
    }
    function handleFocus(){
      if(!doc.hidden){activation.publish('ordinary-focus','focus',{destructive:false});void queueWakeReconciliation('focus');}
    }
    function handlePageShow(){
      exitHandled=false;
      if(!doc.hidden){activation.publish('visibility-return','pageshow',{destructive:false});void queueWakeReconciliation('pageshow');}
    }
    function handlePageExit(){
      if(exitHandled)return false;
      exitHandled=true;
      activation.publish('exit','page-exit',{destructive:true});
      wakeRevision++;
      if(ownership.canMutate()){
        void Promise.resolve(ownership.flushAndRelease()).catch(error=>{
          diagnostics.guard('lifecycle.exit-release',()=>{throw error;});
        });
      }else{
        flush();
        if(ownership.hasControl())ownership.transitionReleasing();
        ownership.release();
        ownership.setPrimary(false);
      }
      return true;
    }
    function installLifecycle(){
      if(lifecycleInstalled)return false;
      lifecycleInstalled=true;
      doc.addEventListener('visibilitychange',handleVisibilityChange);
      win.addEventListener('focus',handleFocus);
      win.addEventListener('pageshow',handlePageShow);
      win.addEventListener('pagehide',handlePageExit);
      win.addEventListener('beforeunload',handlePageExit);
      return true;
    }
    function start(){
      startRequested=true;
      if(fullyInitialized||initializing)return status();
      if(doc.readyState==='loading'){waitForDomReady();return status();}
      const retrying=lifecycleState==='failed';
      if(retrying)completedStages.length=0;
      failedStage='';lastFailure=null;currentStage='';
      diagnostics.guard('startup.failure-clear',startup.clearFailure);
      initializing=true;lifecycleState='initializing';
      startSequence=startSequence.catch(()=>false).then(async()=>{
        try{
          await runStage('ownership-install',ownership.install);
          await runStage('ownership-evaluate',ownership.evaluate);
          await runStage('canonical-data-validation',startup.prepareCanonicalData);
          await runStage('lifecycle-install',installLifecycle);
          await runStage('appearance-restore',startup.restoreAppearance);
          await runStage('dom-bindings-install',installDomBindings);
          await runStage('interrupted-library-clear-recovery',startup.recoverInterruptedLibraryClear);
          await runStage('interrupted-restore-recovery',startup.recoverInterruptedRestore);
          await runStage('notes-load',startup.loadNotes);
          await runStage('drafts-hydrate',startup.hydrateDrafts);
          await runStage('plan-preview',startup.previewPlan);
          await runStage('clock-start',startup.startClock);
          await runStage('header-clock-start',startup.startHeaderClock);
          await runStage('core-render',startup.refreshCoreUi);
          await runStage('recovery-render',startup.renderRecovery);
          await runStage('backup-check',startup.checkBackup);
          await runStage('empty-state',startup.showEmptyIfNeeded);
          await runStage('initial-navigation',startup.openInitialTab);
          await runStage('active-session-restore',startup.restoreActiveSession);
          await runStage('lifecycle-reconcile',startup.reconcileLifecycle);
          await runStage('launch-route',startup.applyLaunchRoute);
          await runStage('name-setup',startup.showNameSetup);
          await runStage('storage-inspection',startup.inspectStorage);
          const proof=await runStage('canonical-verification',startup.verifyReady);
          fullyInitialized=true;lifecycleState='ready';
          await runStage('startup-ready',()=>startup.markReady(proof));
        }catch(error){
          fullyInitialized=false;lifecycleState='failed';failedStage=currentStage||'startup';currentStage='';
          lastFailure=freeze({code:'STARTUP_INITIALIZATION_FAILED',message:'Study Director could not safely finish loading stored data.',at:new Date().toISOString()});
          diagnostics.guard('startup.failure-release',()=>ownership.release());
          diagnostics.guard('startup.failure-secondary',()=>ownership.setPrimary(false));
          diagnostics.guard('startup.failure-notice',()=>startup.reportFailure(freeze({...lastFailure,stage:failedStage})));
          diagnostics.guard('startup.initialize',()=>{throw error;});
        }finally{
          initializing=false;
        }
        return status();
      });
      return status();
    }
    return freeze({start,installDomBindings,installLifecycle,flush,status});
  }
  return freeze({
    format:'study-director.startup-lifecycle',
    contractVersion:1,
    createCoordinator
  });
});
})();
