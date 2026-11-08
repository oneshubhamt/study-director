import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {ManagedRecoveryInput,RecoverySpec,RecoveryKind,SafetyProof,VerifiedSafety} from '../../types/managed-recovery.ts';
import type {AuthorityOptions} from '../../types/mutation-coordinator.ts';
const sdManagedRecoveryFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'managed-recovery','study-director.managed-recovery-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
const createModule=()=>{
  const freeze=Object.freeze;
  function createCoordinator<S>(input:ManagedRecoveryInput<S>){
    exactObject(input,['automaticBackup','diagnostics','lifecycle','mutation'],'Managed recovery input');
    functions(input.automaticBackup,['resume','suspend'],'Managed recovery automatic-backup port');
    functions(input.lifecycle,['quiesce','rebuild','revision','settle'],'Managed recovery lifecycle port');
    functions(input.mutation,['run'],'Managed recovery mutation port');
    functions(input.diagnostics,['capture','mark'],'Managed recovery diagnostics port');
    let active=false;
    function normalizeSpec<R extends object,P extends object>(spec:RecoverySpec<R,P>){
      exactObject(spec,['apply','createSafety','kind','label','publishPresent',...(Object.hasOwn(spec,'keepsActiveSession')?['keepsActiveSession']:[]),...(Object.hasOwn(spec,'verifyEmpty')?['verifyEmpty']:[])],'Managed recovery operation');
      const kind=String(spec.kind||'') as RecoveryKind;
      if(!['bring-in','restore-version','sync'].includes(kind))throw new TypeError('Managed recovery kind is invalid.');
      // A sync only merges without loss, so it needs no external safety
      // version; the local restore journal still protects the apply step.
      if(typeof spec.apply!=='function'||(kind==='sync'?spec.createSafety!==null:typeof spec.createSafety!=='function')||typeof spec.publishPresent!=='function'||spec.verifyEmpty!==undefined&&(kind==='sync'||typeof spec.verifyEmpty!=='function'))throw new TypeError('Managed recovery callbacks are invalid.');
      const label=String(spec.label||'').trim();if(!label)throw new TypeError('Managed recovery source label is required.');
      return freeze({...spec,kind,label,keepsActiveSession:spec.keepsActiveSession===true});
    }
    function verifiedSafety(input:unknown):input is VerifiedSafety{
      const value=input as Partial<VerifiedSafety>|null|undefined;
      return !!value&&typeof value==='object'&&value.verified===true&&/^cp_[a-f0-9]{32}$/u.test(String(value.checkpointId||''))&&Number.isFinite(Date.parse(String(value.sourceRevision||'')));
    }
    async function execute<R extends object,P extends object>(rawSpec:RecoverySpec<R,P>){
      const spec=normalizeSpec(rawSpec);if(active)throw new Error('Another managed recovery operation is already running.');
      let suspension:S|null=null,started=false;
      try{
        input.diagnostics.mark('managed-recovery-enter',{kind:spec.kind,source:spec.label});
        return await input.mutation.run('managed-recovery',async authority=>{
          const assertAuthority=(options?:AuthorityOptions)=>{if(authority&&typeof authority.assert==='function')authority.assert(options);};
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
          let safety:SafetyProof|null=null;
          if(spec.createSafety){input.diagnostics.mark('external-safety-start',{kind:spec.kind,source:spec.label});assertAuthority();const proof=await spec.createSafety();safety=verifiedSafety(proof)?proof:proof&&typeof proof==='object'&&'verified' in proof&&proof.verified===false&&'skipped' in proof&&proof.skipped==='local-empty'?{verified:false,skipped:'local-empty'}:null;assertAuthority();input.diagnostics.mark('external-safety-complete',{kind:spec.kind,source:spec.label});}
          const skippedEmpty=safety?.verified===false&&safety?.skipped==='local-empty'&&typeof spec.verifyEmpty==='function';
          if(spec.createSafety&&!verifiedSafety(safety)&&!skippedEmpty)throw new Error(`Study Director could not verify the Before restore safety version in ${spec.label}. Recovery was stopped before changing local data.`);
          let result!:R;
          input.diagnostics.mark('recovery-commit-quiesce-enter',{kind:spec.kind});
          await input.lifecycle.quiesce(async()=>{
            input.diagnostics.mark('recovery-final-settle-start',{kind:spec.kind});await input.lifecycle.settle(spec.kind,freeze({phase:'final',keepsActiveSession:spec.keepsActiveSession}));input.diagnostics.mark('recovery-final-settle-complete',{kind:spec.kind});
            const currentRevision=String(input.lifecycle.revision()||'');
            if(skippedEmpty){
              // Recheck after the final settlement, including when a brand-new
              // device has no revision timestamp yet.
              if(currentRevision!==settledRevision||await spec.verifyEmpty()!==true){
                throw Object.assign(new Error('Local data changed while preparing recovery. Nothing was restored; retry when ready.'),{code:'STUDY_DIRECTOR_RECOVERY_STALE_SAFETY'});
              }
            }else if(verifiedSafety(safety)&&settledRevision&&safety.sourceRevision&&currentRevision!==String(safety.sourceRevision)){
              throw Object.assign(new Error('Local data changed while the Before restore safety version was being created. Recovery stopped before changing current data; retry when ready.'),{code:'STUDY_DIRECTOR_RECOVERY_STALE_SAFETY'});
            }
            input.diagnostics.mark('recovery-apply-start',{kind:spec.kind});assertAuthority();result=await spec.apply();assertAuthority();input.diagnostics.mark('recovery-apply-complete',{kind:spec.kind,cancelled:result&&'cancelled' in result&&result.cancelled===true});
            if(result&&'cancelled' in result&&result.cancelled)return;
            input.diagnostics.mark('recovery-rebuild-start',{kind:spec.kind});assertAuthority();await input.lifecycle.rebuild(spec.kind,result);assertAuthority();input.diagnostics.mark('recovery-rebuild-complete',{kind:spec.kind});
          });
          input.diagnostics.mark('recovery-commit-quiesce-complete',{kind:spec.kind});
          if(result&&'cancelled' in result&&result.cancelled)return freeze({...result,managedRecovery:freeze({safety,present:freeze({status:'skipped',reason:'cancelled'})})});
          let present:P|{status:'pending';reason:string}|null;
          try{input.diagnostics.mark('recovery-convergence-start',{kind:spec.kind});present=await spec.publishPresent(result);input.diagnostics.mark('recovery-convergence-complete',{kind:spec.kind});}
          catch(error){input.diagnostics.capture('managed-recovery.publish-present',error,'warn');present=freeze({status:'pending',reason:String((error as {message?:unknown}|null|undefined)?.message||error||'backup failed')});}
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
};
registry.define('managed-recovery',1,createModule);
return createModule;
})();
export type ManagedRecoveryModule=ReturnType<typeof sdManagedRecoveryFactory>;
