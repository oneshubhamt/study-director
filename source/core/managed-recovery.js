(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
registry.define('managed-recovery',1,()=>{
  const freeze=Object.freeze;
  function createCoordinator(input){
    exactObject(input,['automaticBackup','diagnostics','lifecycle','mutation'],'Managed recovery input');
    functions(input.automaticBackup,['resume','suspend'],'Managed recovery automatic-backup port');
    functions(input.lifecycle,['quiesce','rebuild','revision','settle'],'Managed recovery lifecycle port');
    functions(input.mutation,['run'],'Managed recovery mutation port');
    functions(input.diagnostics,['capture','mark'],'Managed recovery diagnostics port');
    let active=false;
    function normalizeSpec(spec){
      exactObject(spec,Object.hasOwn(spec,'keepsActiveSession')?['apply','createSafety','keepsActiveSession','kind','label','publishPresent']:['apply','createSafety','kind','label','publishPresent'],'Managed recovery operation');
      const kind=String(spec.kind||'');
      if(!['bring-in','restore-version','sync'].includes(kind))throw new TypeError('Managed recovery kind is invalid.');
      // A sync only merges without loss, so it needs no external safety
      // version; the local restore journal still protects the apply step.
      if(typeof spec.apply!=='function'||(kind==='sync'?spec.createSafety!==null:typeof spec.createSafety!=='function')||typeof spec.publishPresent!=='function')throw new TypeError('Managed recovery callbacks are invalid.');
      const label=String(spec.label||'').trim();if(!label)throw new TypeError('Managed recovery source label is required.');
      return freeze({...spec,kind,label,keepsActiveSession:spec.keepsActiveSession===true});
    }
    function verifiedSafety(value){
      return !!value&&typeof value==='object'&&value.verified===true&&/^cp_[a-f0-9]{32}$/u.test(String(value.checkpointId||''))&&Number.isFinite(Date.parse(String(value.sourceRevision||'')));
    }
    async function execute(rawSpec){
      const spec=normalizeSpec(rawSpec);if(active)throw new Error('Another managed recovery operation is already running.');
      let suspension=null,started=false;
      try{
        input.diagnostics.mark('managed-recovery-enter',{kind:spec.kind,source:spec.label});
        return await input.mutation.run('managed-recovery',async authority=>{
          const assertAuthority=options=>{if(authority&&typeof authority.assert==='function')authority.assert(options);};
          assertAuthority();
          active=true;started=true;
          input.diagnostics.mark('automatic-backup-suspend-start',{kind:spec.kind});suspension=await input.automaticBackup.suspend(spec.kind);assertAuthority();input.diagnostics.mark('automatic-backup-suspend-complete',{kind:spec.kind});
          let settledRevision='';
          input.diagnostics.mark('recovery-preflight-quiesce-enter',{kind:spec.kind});
          await input.lifecycle.quiesce(async()=>{
            input.diagnostics.mark('recovery-settle-start',{kind:spec.kind});assertAuthority();await input.lifecycle.settle(spec.kind);assertAuthority();input.diagnostics.mark('recovery-settle-complete',{kind:spec.kind});
            settledRevision=String(input.lifecycle.revision()||'');
          });
          input.diagnostics.mark('recovery-preflight-quiesce-complete',{kind:spec.kind});
          let safety=null;
          if(spec.createSafety){input.diagnostics.mark('external-safety-start',{kind:spec.kind,source:spec.label});assertAuthority();safety=await spec.createSafety();assertAuthority();input.diagnostics.mark('external-safety-complete',{kind:spec.kind,source:spec.label});}
          if(spec.createSafety&&!verifiedSafety(safety))throw new Error(`Study Director could not verify the Before restore safety version in ${spec.label}. Recovery was stopped before changing local data.`);
          let result;
          input.diagnostics.mark('recovery-commit-quiesce-enter',{kind:spec.kind});
          await input.lifecycle.quiesce(async()=>{
            input.diagnostics.mark('recovery-final-settle-start',{kind:spec.kind});await input.lifecycle.settle(spec.kind,freeze({phase:'final',keepsActiveSession:spec.keepsActiveSession}));input.diagnostics.mark('recovery-final-settle-complete',{kind:spec.kind});
            const currentRevision=String(input.lifecycle.revision()||'');
            if(safety&&settledRevision&&safety.sourceRevision&&currentRevision!==String(safety.sourceRevision)){
              const error=new Error('Local data changed while the Before restore safety version was being created. Recovery stopped before changing current data; retry when ready.');error.code='STUDY_DIRECTOR_RECOVERY_STALE_SAFETY';throw error;
            }
            input.diagnostics.mark('recovery-apply-start',{kind:spec.kind});assertAuthority();result=await spec.apply();assertAuthority();input.diagnostics.mark('recovery-apply-complete',{kind:spec.kind,cancelled:result&&result.cancelled===true});
            if(result&&result.cancelled)return;
            input.diagnostics.mark('recovery-rebuild-start',{kind:spec.kind});assertAuthority();await input.lifecycle.rebuild(spec.kind,result);assertAuthority();input.diagnostics.mark('recovery-rebuild-complete',{kind:spec.kind});
          });
          input.diagnostics.mark('recovery-commit-quiesce-complete',{kind:spec.kind});
          if(result&&result.cancelled)return freeze({...result,managedRecovery:freeze({safety,present:freeze({status:'skipped',reason:'cancelled'})})});
          let present;
          try{input.diagnostics.mark('recovery-convergence-start',{kind:spec.kind});present=await spec.publishPresent(result);input.diagnostics.mark('recovery-convergence-complete',{kind:spec.kind});}
          catch(error){input.diagnostics.capture('managed-recovery.publish-present',error,'warn');present=freeze({status:'pending',reason:String(error&&error.message||error||'backup failed')});}
          if(!present||typeof present!=='object')present=freeze({status:'pending',reason:'backup status unavailable'});
          return freeze({...result,managedRecovery:freeze({safety,present:freeze({...present})})});
        });
      }finally{
        if(suspension!==null){
          try{input.diagnostics.mark('automatic-backup-resume-start',{});await input.automaticBackup.resume(suspension);input.diagnostics.mark('automatic-backup-resume-complete',{});}catch(error){input.diagnostics.capture('managed-recovery.resume-automatic-backup',error,'warn');}
        }
        if(started)active=false;
      }
    }
    return freeze({format:'study-director.managed-recovery-coordinator',contractVersion:1,execute,status:()=>freeze({active})});
  }
  return freeze({format:'study-director.managed-recovery-module',contractVersion:1,createCoordinator});
});
})();
