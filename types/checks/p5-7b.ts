import type {AssetStorageModule} from '../../source/core/asset-storage.ts';
import type {BackupModule} from '../../source/core/backup.ts';
import type {BackupRecoveryHostModule} from '../../source/core/backup-recovery-host.ts';
import type {ReconciliationUiFactory} from '../../source/core/reconciliation-ui.ts';
import type {RepositoriesModule} from '../../source/core/repositories.ts';
import type {RichTextApi} from '../../rich-text/editor.ts';
import type {KeptVersionsInput,RecoveryHostInput} from '../backup-recovery-host.ts';
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
  view:Object.freeze({render:()=>{},renderLocation:()=>{},refreshNotes:()=>{}})
}) satisfies Readonly<KeptVersionsInput>;
recoveryModule.createKeptVersions(keptInput);

const providerPort=Object.freeze({
  bringIn:(source:string,options?:Parameters<RecoveryHostInput['providers']['bringIn']>[1])=>backupRuntime.providers.bringIn(source,options),
  cancelForeground:(reason?:string,source?:string)=>backupRuntime.providers.cancelForeground(reason,source),
  connected:(source:string)=>backupRuntime.providers.connected(source),
  forget:(source:string)=>backupRuntime.providers.forget(source),
  histories:(options?:Parameters<RecoveryHostInput['providers']['histories']>[0])=>backupRuntime.providers.histories(options),
  history:(source:string,options?:Parameters<RecoveryHostInput['providers']['history']>[1])=>backupRuntime.providers.history(source,options),
  locationStatus:(source:string)=>backupRuntime.providers.locationStatus(source),
  provider:(source:string)=>backupRuntime.providers.provider(source),
  removeVersion:(source:string,checkpointId:string)=>backupRuntime.providers.removeVersion(source,checkpointId),
  suspendBackground:(reason:string)=>backupRuntime.providers.suspendBackground(reason)
}) satisfies RecoveryHostInput['providers'];
void providerPort;

// @ts-expect-error -- kept-version review must consume canonical PendingReview rows, not arbitrary records.
recoveryModule.createKeptVersions({...keptInput,reviews:Object.freeze({list:async()=>[{id:'bad'}]})});
// @ts-expect-error -- reconciliation must use the actual rich-text editor contract.
uiModule.createController({ports:{...uiInput.ports,richText:{...uiInput.ports.richText,mountRichTextEditor:async()=>({})}}});
