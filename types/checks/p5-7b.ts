import type {AssetStorageModule} from '../../source/core/asset-storage.ts';
import type {BackupModule} from '../../source/core/backup.ts';
import type {BackupRecoveryHostModule} from '../../source/core/backup-recovery-host.ts';
import type {ExportsModule} from '../../source/core/exports.ts';
import type {PlanHostModule} from '../../source/core/plan-host.ts';
import type {ReconciliationUiFactory} from '../../source/core/reconciliation-ui.ts';
import type {BackupMaintenancePauseController,BackupRuntimeHostInput} from '../backup-runtime-host.ts';
import type {SessionCoordinator} from '../session-lifecycle.ts';
import type {RepositoriesModule} from '../../source/core/repositories.ts';
import type {RichTextApi} from '../../rich-text/editor.ts';
import type {KeptVersionsInput,RecoveryHostInput,RecoveryQuiescenceInput} from '../backup-recovery-host.ts';
import type {ReconciliationUiInput} from '../reconciliation-ui.ts';

declare const uiModule:ReconciliationUiFactory;
declare const recoveryModule:BackupRecoveryHostModule;
declare const richText:RichTextApi;
declare const assetStorage:ReturnType<AssetStorageModule['create']>;
declare const backupRuntime:ReturnType<BackupModule['createRuntime']>;
declare const appData:ReturnType<RepositoriesModule['createAppData']>;

const uiInput=Object.freeze({ports:Object.freeze({
  assets:Object.freeze({get:(assetId:string)=>assetStorage.get(assetId)}),
  configuration:Object.freeze({maxBytes:1_000_000,maxWords:20_000}),
  diagnostics:Object.freeze({capture:(_scope:string,_error:unknown,_level:'warn'|'error')=>{}}),
  richText:Object.freeze({
    mountRichTextEditor:richText.mountRichTextEditor,
    compareRichText:richText.compareRichText,
    mergeIncomingAdditions:richText.mergeIncomingAdditions,
    appendIncomingAdditions:richText.appendIncomingAdditions,
    mergeThreeWay:richText.mergeThreeWay
  }),
  view:Object.freeze({
    document,
    requestAnimationFrame:(callback:FrameRequestCallback)=>window.requestAnimationFrame(callback),
    cancelAnimationFrame:(id:number)=>window.cancelAnimationFrame(id)
  })
})}) satisfies Readonly<ReconciliationUiInput>;
const reconciliation=uiModule.createController(uiInput);
void reconciliation;

const keptInput=Object.freeze({
  controller:backupRuntime.controller,
  reviews:Object.freeze({list:()=>appData.pendingReviews.list()}),
  diagnostics:Object.freeze({capture:(_scope:string,_error:unknown,_level:'warn')=>{}}),
  environment:Object.freeze({canMutate:()=>true,now:()=>Date.now(),connectCardOpen:()=>false,sessionYieldedAt:()=>0}),
  notifications:Object.freeze({notify:(_options:Parameters<KeptVersionsInput['notifications']['notify']>[0])=>{},resolveEvent:(_source:string,_id:string)=>{}}),
  view:Object.freeze({render:()=>{},renderLocation:()=>{},scheduleStatus:()=>{},refreshNotes:()=>{}})
}) satisfies Readonly<KeptVersionsInput>;
recoveryModule.createKeptVersions(keptInput);

const providerPort=Object.freeze({
  bringInRepositoryProvider:(id:string,options:Parameters<RecoveryHostInput['providers']['bringInRepositoryProvider']>[1])=>backupRuntime.providers.bringInRepositoryProvider(id,options),
  restoreRepositoryProviderVersion:(id:string,options:Parameters<RecoveryHostInput['providers']['restoreRepositoryProviderVersion']>[1])=>backupRuntime.providers.restoreRepositoryProviderVersion(id,options),
  removeRepositoryProviderVersion:(id:string,checkpointId:string)=>backupRuntime.providers.removeRepositoryProviderVersion(id,checkpointId),
  cancelForeground:(reason:string,id:string)=>backupRuntime.providers.cancelForeground(reason,id),
  configureManagedRecovery:(port:Parameters<RecoveryHostInput['providers']['configureManagedRecovery']>[0])=>backupRuntime.providers.configureManagedRecovery(port),
  configurePendingBackupRetry:(port:Parameters<RecoveryHostInput['providers']['configurePendingBackupRetry']>[0])=>backupRuntime.providers.configurePendingBackupRetry(port),
  history:(id:string,options:Parameters<RecoveryHostInput['providers']['history']>[1])=>backupRuntime.providers.history(id,options),
  list:()=>backupRuntime.providers.list(),
  noteVersions:(id:string,noteId:string,options:Parameters<RecoveryHostInput['providers']['noteVersions']>[2])=>backupRuntime.providers.noteVersions(id,noteId,options),
  suspendBackground:(reason:string,options?:Parameters<RecoveryHostInput['providers']['suspendBackground']>[1])=>backupRuntime.providers.suspendBackground(reason,options)
}) satisfies RecoveryHostInput['providers'];
void providerPort;

// @ts-expect-error -- kept-version review must consume canonical PendingReview rows, not arbitrary records.
recoveryModule.createKeptVersions({...keptInput,reviews:Object.freeze({list:async()=>[{id:'bad'}]})});
// @ts-expect-error -- reconciliation must use the actual rich-text editor contract.
uiModule.createController({ports:{...uiInput.ports,richText:{...uiInput.ports.richText,mountRichTextEditor:async()=>({})}}});

declare const exportsModule:ExportsModule;
declare const planHost:PlanHostModule;
declare const reconciliationUiModule:ReconciliationUiFactory;
declare const runtimeModule:BackupModule;
declare const planData:ReturnType<PlanHostModule['createData']>;
declare const planController:ReturnType<PlanHostModule['createController']>;
declare const processing:ReturnType<ExportsModule['createCoordinator']>;
declare const protection:ReturnType<ExportsModule['createProtection']>;
declare const reconciliationUi:ReturnType<ReconciliationUiFactory['createController']>;

const runtimeHostCoreProviders=Object.freeze({
  module:runtimeModule,appData,personal:Object.freeze({draft:planController.draft,data:planData})
});
const runtimeHostModule=runtimeModule satisfies BackupRuntimeHostInput<unknown>['module'];
const runtimeHostAppData=appData satisfies BackupRuntimeHostInput<unknown>['appData'];
const runtimeHostPlanData=planData satisfies BackupRuntimeHostInput<unknown>['personal']['data'];
const runtimeHostPlanDraft=planController.draft satisfies BackupRuntimeHostInput<unknown>['personal']['draft'];
const runtimeHostProcessing=processing satisfies BackupRuntimeHostInput<unknown>['processing'];
const runtimeHostProtection=protection satisfies BackupRuntimeHostInput<unknown>['protection'];
const runtimeHostReconciliation=reconciliationUi satisfies BackupRuntimeHostInput<unknown>['noteReconciliation']['controller'];
void runtimeHostCoreProviders;void runtimeHostModule;void runtimeHostAppData;void runtimeHostPlanData;void runtimeHostPlanDraft;void runtimeHostProcessing;void runtimeHostProtection;void runtimeHostReconciliation;

declare const sessionLifecycle:SessionCoordinator;
declare const maintenancePause:BackupMaintenancePauseController;
const runtimeHostRecoveryNotes=Object.freeze({lifecycle:sessionLifecycle,date:()=> '2026-11-15'}) satisfies BackupRuntimeHostInput<unknown>['recoveryNotes'];
const runtimeHostMaintenancePause=maintenancePause satisfies BackupRuntimeHostInput<unknown>['noteReconciliation']['maintenancePause'];
void runtimeHostRecoveryNotes;void runtimeHostMaintenancePause;

const recoveryQuiescenceInput=Object.freeze({
  cancelPendingLiveDraftSave:()=>{},
  clock:Object.freeze({nowMs:()=>Date.now()}),
  timer:Object.freeze({stopExecution:()=>{},resumeAfterPrimaryRestore:(_options:{frozenSinceMs:number|null})=>{}}),
  richText:Object.freeze({quiesce:<T>(operation:()=>Promise<T>)=>operation()}),
  mutation:Object.freeze({settled:async()=>{},active:()=>false}),
  handoff:Object.freeze({frozen:()=>false}),
  diagnostics:Object.freeze({capture:(_scope:string,_error:unknown,_level:'warn')=>{}})
}) satisfies Readonly<RecoveryQuiescenceInput>;
recoveryModule.createQuiescence(recoveryQuiescenceInput);
