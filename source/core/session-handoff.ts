import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {ActiveSession,SessionSnapshot} from '../../types/record-models.ts';
import type {RuntimeEvidence} from '../../types/timer-engine.ts';
import type {SessionClaimProjection,SessionHandoffController,SessionHandoffInput,SessionHandoffModule as SessionHandoffContract,SessionHandoffSource,SessionHandoffTransferOptions,SessionOwnershipClaim} from '../../types/session-handoff.ts';

const sdSessionHandoffFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'session-handoff','study-director.session-handoff-module'>|undefined;
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
const freeze=Object.freeze;
const RETRY_MESSAGE='Couldn’t finish moving the session. Press Continue Here again to finish.';
const objectRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function exactObject(value:unknown,keys:readonly string[],label:string){
  if(!objectRecord(value))throw new TypeError(label+' must be an object.');
  const actual=Object.keys(value).sort(),expected=[...keys].sort();
  if(actual.length!==expected.length||actual.some((key,index)=>key!==expected[index]))throw new TypeError(label+' is incomplete or contains unexpected fields.');
}
function functions(value:unknown,keys:readonly string[],label:string){
  if(!objectRecord(value)||keys.some(key=>typeof value[key]!=='function'))throw new TypeError(label+' is incomplete.');
}
function errorCode(error:unknown){return objectRecord(error)?String(error['code']||''):'';}
function handoffError(code:string,message:string){return Object.assign(new Error(message),{code});}

type ClaimFreeze=Readonly<{
  epoch:number;
  frozenSinceMs:number;
  lastSyncAt:number;
  localVerified:boolean;
  snapshot:SessionSnapshot|null;
  evidence:RuntimeEvidence|null;
}>;

function createController(input:Readonly<SessionHandoffInput>):Readonly<SessionHandoffController>{
  exactObject(input,['configuration','authority','provider','session','plan','runtime','presentation','installation','clock','identity'],'Session handoff input');
  const {configuration,authority,provider,session,plan,runtime,presentation,installation,clock,identity}=input;
  exactObject(configuration,['providerId','claimWatchMs','claimSyncRetryMs','claimSaveWarning'],'Session handoff configuration');
  functions(authority,['canMutate','startupReady','visible','online','hasTasks','panelElsewhere'],'Session authority port');
  functions(provider,['connected','readHandoffSource','claimOwnership','releaseClaim','readClaim','scheduleSync','suspendBackground','wakeBackground'],'Session provider port');
  functions(session,['sanitize','same','nextRevision','contentFingerprint','assetIds'],'Session handoff data port');
  if(!session.host)throw new TypeError('Session host port is unavailable.');
  functions(session.host,['captureSnapshot','writeSnapshot','requireCanonicalWrite','saveCanonicalSession','load','payload','cancelPendingLiveDraftSave','resetRuntime','suspendLocal'],'Session host port');
  functions(plan,['flushDraft','settled','readDraft','readCanonicalDraft','displayedDraft','defaultScheduleText'],'Session Plan port');
  functions(runtime,['markContentChanged','captureEvidence','stopExecution','resumeExecution'],'Session runtime port');
  functions(presentation,['capture','setStatus','warnStorage','clearStorageWarning','notifyNewerClaim','noteBackupChange'],'Session presentation port');
  functions(installation,['id'],'Session installation port');
  functions(clock,['nowMs','nowIso'],'Session clock port');
  functions(identity,['uuid'],'Session identity port');

  let claimFreeze:ClaimFreeze|null=null,claimCheckActive=false,lastAttemptAt=0;

  function runsElsewhere(value:unknown){
    const current=session.sanitize(value);
    return !!current&&current.status!=='suspended'&&current.runningOn!==installation.id();
  }
  function fromElsewhere(value:unknown){
    const current=session.sanitize(value);
    return !!current&&current.runningOn!==installation.id();
  }
  function status(){
    const current=claimFreeze;
    return freeze({
      checking:claimCheckActive,lastAttemptAt,frozen:!!current,epoch:current?.epoch||0,
      localVerified:current?.localVerified===true,frozenSinceMs:current?.frozenSinceMs||0,lastSyncAt:current?.lastSyncAt||0
    });
  }
  function snapshotForWrite():SessionSnapshot|null{
    const current=claimFreeze;
    if(!current?.snapshot)return session.host.captureSnapshot();
    const recent=session.host.captureSnapshot(current.evidence);
    if(!recent)return current.snapshot;
    const practice=current.snapshot.practice;
    return freeze({...recent,timerRuntime:current.snapshot.timerRuntime,...(practice===undefined?{}:{practice})});
  }
  async function prefetchSource():Promise<SessionHandoffSource|null>{
    if(!provider.connected(configuration.providerId)||!authority.online())return null;
    try{return await provider.readHandoffSource(configuration.providerId);}
    catch(error){presentation.capture('session.handoff-prefetch',error,'warn');return null;}
  }
  async function verifyFrozenClaim(){
    const current=claimFreeze;
    try{
      if(!current?.snapshot)throw new Error('The frozen Active Session snapshot is unavailable.');
      const saved=await session.host.writeSnapshot(snapshotForWrite(),{emergency:true,strictDurability:true});
      await session.host.requireCanonicalWrite(saved,saved?.value,'yielding a transferred session');
      if(claimFreeze!==current)return false;
      claimFreeze=freeze({...current,localVerified:true});
      presentation.clearStorageWarning(configuration.claimSaveWarning);
      return true;
    }catch(error){
      presentation.capture('session.claim-flush',error,'warn');
      presentation.warnStorage(configuration.claimSaveWarning);
      presentation.setStatus('CRITICAL: Session handoff is waiting for a verified local save. Keep this tab open.',false);
      return false;
    }
  }
  function resumeClaimedBack(sessionValue:ActiveSession){
    if(!claimFreeze?.localVerified||sessionValue.runningOn!==installation.id()||!authority.hasTasks())return false;
    const frozenSinceMs=claimFreeze.frozenSinceMs;
    try{
      if(!runtime.resumeExecution({frozenSinceMs}))return false;
      claimFreeze=null;
      presentation.setStatus('✓ Session ownership remains on this device.');
      return true;
    }catch(error){presentation.capture('session.claim-resume',error,'warn');return false;}
  }
  async function checkClaim():Promise<boolean>{
    if(claimCheckActive||!authority.visible()||!authority.startupReady())return false;
    if(!authority.hasTasks()&&!claimFreeze&&!authority.panelElsewhere())return false;
    if(!provider.connected(configuration.providerId)||!authority.online())return false;
    lastAttemptAt=clock.nowMs();claimCheckActive=true;
    try{
      const [claim,loaded]=await Promise.all([provider.readClaim(configuration.providerId),session.host.load({strict:true})]);
      if(!loaded||loaded.ok!==true||loaded.error||loaded.storage.idb!==true)throw loaded?.error||new Error('Active Session ownership could not be checked safely.');
      const current=loaded.value?session.sanitize(loaded.value):null,me=installation.id();
      const remote=!!(claim&&current&&claim.applies&&claim.state==='owned'&&!claim.ownedHere),mine=!!(current&&current.runningOn===me);
      if(remote&&mine&&authority.hasTasks()){
        const now=clock.nowMs(),same=!!(claimFreeze&&claimFreeze.epoch===claim.epoch);
        if(!same){
          const frozenSinceMs=clock.nowMs();
          runtime.stopExecution();
          let snapshot:SessionSnapshot|null=null,evidence:RuntimeEvidence|null=null;
          try{
            runtime.markContentChanged();
            evidence=runtime.captureEvidence();
            snapshot=session.host.captureSnapshot(evidence);
          }catch(error){presentation.capture('session.claim-snapshot',error,'warn');}
          session.host.cancelPendingLiveDraftSave();
          claimFreeze=freeze({epoch:claim.epoch,frozenSinceMs,lastSyncAt:0,localVerified:false,snapshot,evidence});
        }
        const activeFreeze=claimFreeze;
        if(!activeFreeze)return true;
        if(!activeFreeze.localVerified){
          if(!await verifyFrozenClaim())return true;
          if(claim.newer)presentation.notifyNewerClaim();
          else presentation.setStatus('Today’s session moved to another device. Syncing its latest state…');
        }
        if(claim.newer)return true;
        const frozen=claimFreeze;
        if(!frozen)return true;
        if(frozen&&(!frozen.lastSyncAt||now-frozen.lastSyncAt>=configuration.claimSyncRetryMs)){
          claimFreeze=freeze({...frozen,lastSyncAt:now});
          provider.scheduleSync(configuration.providerId,'session-claim');
        }
        return true;
      }
      if(claimFreeze){
        if(!mine||!authority.hasTasks()){claimFreeze=null;return false;}
        if(!claimFreeze.localVerified&&!await verifyFrozenClaim())return true;
        if(claim?.state==='owned'&&claim.ownedHere&&claim.applies)return resumeClaimedBack(current as ActiveSession);
        const now=clock.nowMs(),frozen=claimFreeze;
        if(!frozen.lastSyncAt||now-frozen.lastSyncAt>=configuration.claimSyncRetryMs){
          claimFreeze=freeze({...frozen,lastSyncAt:now});
          provider.scheduleSync(configuration.providerId,'session-claim-release');
        }
        return true;
      }
      return false;
    }catch(error){presentation.capture('session.claim-watch',error,'warn');return false;}
    finally{claimCheckActive=false;}
  }
  function wakeClaim(slackMs=0):Promise<boolean>|false{
    const now=clock.nowMs();
    if(lastAttemptAt&&now>=lastAttemptAt&&now-lastAttemptAt<configuration.claimWatchMs-Math.max(0,Number(slackMs)||0))return false;
    return checkClaim();
  }

  async function transferHere(value:unknown,options:SessionHandoffTransferOptions={}){
    const step=(text:string)=>{try{options.onStep?.(text);}catch{}};
    if(!authority.canMutate())throw new Error('Study Director does not currently have write control.');
    if(!provider.connected(configuration.providerId))throw handoffError('SESSION_CONTINUE_NOT_CONNECTED','Google Drive must be connected to transfer a session that belongs to another device.');
    const requested=session.sanitize(value);
    if(!requested)throw new Error('the transferred session state is invalid');
    let previous:ActiveSession|null=null,next:ActiveSession|null=null,ownershipClaim:SessionOwnershipClaim|null=null;
    let backgroundHold:Readonly<{settled:PromiseLike<unknown>;release():unknown}>|null=null,claimAttempted=false,localVerified=false,localBefore=requested;
    try{
      const displayedDraft=plan.displayedDraft(),draftFlushed=await Promise.resolve(plan.flushDraft());
      if(draftFlushed===false)throw handoffError('SESSION_CONTINUE_DRAFT_UNSAVED','The Plan draft could not be saved before continuing the session.');
      await plan.settled();
      const savedDraft=plan.readDraft(),canonicalDraft=await plan.readCanonicalDraft(),expectedDisplay=savedDraft===null?plan.defaultScheduleText():savedDraft;
      if(canonicalDraft!==savedDraft||displayedDraft!==expectedDisplay)throw handoffError('SESSION_CONTINUE_DRAFT_UNSAVED','The independent Plan draft changed or did not reach canonical storage before Continue Here.');
      if(options.preread)await options.preread;
      step('Moving the session here…');
      backgroundHold=provider.suspendBackground('session-continue');await backgroundHold.settled;
      let planned:ActiveSession|null=null;
      const decide=async(source:SessionHandoffSource)=>{
        const expectedCheckpointId=String(source?.checkpointId||'');
        if(!/^cp_[a-f0-9]{32}$/u.test(expectedCheckpointId))throw handoffError('REPOSITORY_SESSION_CLAIM_UNCERTAIN','Google Drive did not provide a verified current checkpoint for the handoff.');
        previous=source.session?session.sanitize(source.session):null;
        if(!previous||previous.date!==requested.date)throw handoffError('REPOSITORY_SESSION_CLAIM_STALE','Today’s shared session ended or changed while Continue Here was starting.');
        if(previous.runningOn!==requested.runningOn)throw handoffError('REPOSITORY_SESSION_CLAIM_STALE','Today’s session changed ownership while Continue Here was starting.');
        if(Number(previous.revision)<Number(requested.revision))throw handoffError('REPOSITORY_SESSION_CLAIM_UNCERTAIN','This device has a newer session copy than the verified Google Drive head. Sync must settle that difference before ownership can move.');
        const [requestedContentFingerprint,observedContentFingerprint]=await Promise.all([session.contentFingerprint(requested),session.contentFingerprint(previous)]);
        if(requestedContentFingerprint!==observedContentFingerprint){
          const priorClaim:SessionClaimProjection|null=source.priorClaim||null;
          const causalContinuation=!!(priorClaim&&priorClaim.state==='owned'&&priorClaim.applies&&priorClaim.observedContentFingerprint===requestedContentFingerprint&&Number(priorClaim.revision)<=Number(previous.revision));
          const sharedContinuation=!!source.sharedContentFingerprint&&source.sharedContentFingerprint===requestedContentFingerprint;
          const referencedAssets=session.assetIds(previous);
          if((!causalContinuation&&!sharedContinuation)||referencedAssets.length){
            provider.scheduleSync(configuration.providerId,'session-handoff-source-advanced');
            throw handoffError('SESSION_CONTINUE_SYNC_REQUIRED','Today’s shared session has newer study content that must be reconciled before ownership can move. This device is syncing it first; retry Continue Here after sync.');
          }
          try{await session.host.saveCanonicalSession(previous,'advancing the handoff source',{expectedCanonical:requested});}
          catch(error){if(errorCode(error)==='ACTIVE_SESSION_CHANGED')throw handoffError('SESSION_CONTINUE_CHANGED','Today’s session changed on this device while Continue Here was starting.');throw error;}
          localBefore=previous;
        }
        planned=session.sanitize({...previous,runningOn:installation.id(),revision:session.nextRevision(previous.revision),updatedAt:clock.nowIso()});
        if(!planned)throw new Error('the transferred session state is invalid');
        next=planned;
        presentation.setStatus('Transferring today’s session to this device…');step('Confirming with Google Drive…');
        return freeze({observedOwner:previous.runningOn,observedRevision:previous.revision,observedContentFingerprint,revision:planned.revision});
      };
      const claimed=await provider.claimOwnership(configuration.providerId,freeze({date:requested.date,handoffToken:identity.uuid(),decide,onWrite:()=>{claimAttempted=true;}}));
      if(claimed?.status==='busy')throw handoffError('SESSION_CONTINUE_BUSY','Google Drive is busy with another backup or restore.');
      if(claimed?.status==='unavailable')throw handoffError('SESSION_CONTINUE_NOT_CONNECTED','Google Drive is not connected.');
      if(!claimed||claimed.status!=='completed'||!claimed.claim)throw new Error('Google Drive did not confirm the Active Session ownership claim.');
      ownershipClaim=claimed.claim;
      const plannedSession=session.sanitize(planned),previousSession=session.sanitize(previous);
      if(!plannedSession||!previousSession)throw new Error('Google Drive confirmed ownership without a verified Active Session source.');
      previous=previousSession;
      next=session.sanitize({...plannedSession,revision:Math.max(plannedSession.revision,Number(ownershipClaim.revision)||0),updatedAt:clock.nowIso()});
      if(!next)throw new Error('the accepted Active Session ownership revision is invalid');
      const saved=await session.host.saveCanonicalSession(next,'claiming Active Session ownership',{expectedCanonical:localBefore});
      localVerified=true;
      backgroundHold.release();backgroundHold=null;
      presentation.noteBackupChange('session-continue');
      provider.scheduleSync(configuration.providerId,'session-continue');
      return freeze({previous,session:saved.value||next,claim:ownershipClaim});
    }catch(error){
      let compensated=false;
      if(ownershipClaim&&!localVerified&&previous&&next){
        try{
          const loaded=await session.host.load({strict:true});
          const current=loaded?.ok&&loaded.storage.idb===true?session.sanitize(loaded.value):null;
          let localReverted=!!current&&session.same(current,previous);
          if(!localReverted&&current&&session.same(current,next)){
            await session.host.saveCanonicalSession(previous,'compensating a failed ownership transfer',{expectedCanonical:current});
            localReverted=true;
          }
          if(localReverted)compensated=await provider.releaseClaim(configuration.providerId,ownershipClaim);
        }catch(rollbackError){presentation.capture('session.takeover-compensation',rollbackError,'warn');}
      }
      try{provider.wakeBackground('session-watch');}catch{}
      if(claimAttempted&&!compensated)throw Object.assign(handoffError('SESSION_CONTINUE_INCOMPLETE',RETRY_MESSAGE),{cause:error});
      throw error;
    }finally{backgroundHold?.release();}
  }

  async function yieldLocal():Promise<ActiveSession|false>{
    if(!authority.hasTasks())return false;
    return session.host.suspendLocal({source:'session-yield'});
  }

  return freeze({
    format:'study-director.session-handoff',contractVersion:1,runsElsewhere,fromElsewhere,frozen,status,snapshotForWrite,prefetchSource,
    checkClaim,wakeClaim,transferHere,yieldLocal
  });
  function frozen(){return !!claimFreeze;}
}
const createModule=():SessionHandoffContract=>freeze({format:'study-director.session-handoff-module',contractVersion:1,retryMessage:RETRY_MESSAGE,createController});
registry.define('session-handoff',1,createModule);
return createModule;
})();
export type SessionHandoffModule=ReturnType<typeof sdSessionHandoffFactory>;
