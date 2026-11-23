import type {ModuleRegistration} from './module-registration.ts';
import type {TabConfig} from './foundation-host.ts';
import type {NavigationOptions} from './navigation.ts';
import type {WorkspaceDescriptor,WorkspaceOpenMeta,WorkspaceCloseMeta} from './workspace.ts';
import type {NativeCapabilitiesController,NativeCapabilitiesStatus} from './native-capabilities.ts';
import type {PresentationKernel,PresentationManifest,PresentationProfile,ThemeDefinition} from './presentation.ts';
import type {PresentationHostController} from './presentation-host.ts';
import type {ProviderConfig} from './backup-provider.ts';
import type {PlanController} from './plan.ts';
import type {InsightsHostBoundary,InsightsHostModule,InsightsPreviewProvider} from '../source/core/insights-host.ts';
import type {BackupModule} from '../source/core/backup.ts';

export type CapabilityMap=Readonly<Record<string,number>>;
export type PluginFileState='not-requested'|'loading'|'loaded'|'registered'|'missing'|'incompatible'|'failed';
export type PluginRegistrationState='registered'|'incompatible'|'inactive'|'failed';
export interface OptionalPluginDescriptor{readonly tabId:string;readonly label:string;readonly icon:string;readonly src:string;readonly pluginName:string}
export interface PluginFileStatus extends OptionalPluginDescriptor{readonly state:PluginFileState;readonly detail:string;readonly attempts:number;readonly updatedAt:string|null}
export interface PluginRegistrationStatus{readonly name:string;readonly version:string;readonly state:PluginRegistrationState;readonly attempts:number;readonly detail:string;readonly updatedAt:string}
export interface PluginRuntimeStatus{readonly optionalFiles:readonly PluginFileStatus[];readonly registered:readonly PluginRegistrationStatus[]}
export interface WorkspaceHistoryPublic{
 register(kind:string,handler:Readonly<{current():WorkspaceDescriptor|null;reconcile(desired:WorkspaceDescriptor|null,context:unknown):unknown}>):boolean;
 open(descriptor:WorkspaceDescriptor,options?:WorkspaceOpenMeta):unknown;
 replace(descriptor:WorkspaceDescriptor,options?:WorkspaceOpenMeta):unknown;
 close(descriptor:WorkspaceDescriptor):unknown;
 closed(descriptor:WorkspaceDescriptor,meta?:WorkspaceCloseMeta):unknown;
}
export interface PublicUi{
 registerTab(config:TabConfig):boolean;
 goTab(name:string|undefined,options?:NavigationOptions):Promise<boolean>;
 navigationStatus():unknown;
 readonly workspaceHistory:WorkspaceHistoryPublic;
}
export type InsightsDeviceState=ReturnType<InsightsHostModule['createDeviceState']>;
export type PublicInsights=InsightsHostBoundary['appInsights'];
export type PublicLogic=InsightsHostBoundary['logic'];
export type PublicPreview=InsightsHostBoundary['publicPreview'];
export type PublicPlan=Pick<PlanController,'getDraft'|'loadDraft'>;
export interface BackupProfilePublic{
 id():string;name():string;
 bind(info:Readonly<{email:string;folder:string;found:string;mine:boolean;library:Readonly<{savedAt:string;days:number|null;notes:number|null}>|null}>):unknown|PromiseLike<unknown>;
 deleted(info:Readonly<{profile:string}>):unknown|PromiseLike<unknown>;
 controls(control:Readonly<{deleteLibrary:()=>Promise<boolean>}>):unknown;
}
type PublicBackupController=Pick<ReturnType<BackupModule['createRuntime']>['controller'],'createCheckpoint'|'inspect'|'restore'|'downloadSafetyCopy'>;
export interface BackupPublicInput extends PublicBackupController{
 releaseFile(file:Blob):unknown|PromiseLike<unknown>;
 receiveStream(stream:ReadableStream<Uint8Array>,size:number,options?:Readonly<{signal?:AbortSignal|null;onProgress?:(value:Readonly<{loaded?:number;total?:number;phase?:string}>)=>void}>):unknown|PromiseLike<unknown>;
 checksum(blob:Blob,signal?:AbortSignal|null):unknown|PromiseLike<unknown>;
 readonly maxFileBytes:number;readonly repositoryPolicy:Readonly<Record<string,unknown>>;device():string;
 readonly profile:BackupProfilePublic;readonly providers:Readonly<{register(config:ProviderConfig):unknown;list():unknown}>;
}
export interface InstallationPublicInput extends Pick<NativeCapabilitiesController,'status'|'promptInstall'|'inspectInstallation'|'revealInstallHelp'>{}
export interface AppearancePublicInput{
 readonly theme:Readonly<{defaultId:string;supported:readonly ThemeDefinition[];get:PresentationKernel['activeThemeId'];set:PresentationHostController['setTheme']}>;
 readonly presentation:Readonly<{defaultId:string;invariants:Readonly<Record<string,unknown>>;breakpoints:Readonly<Record<string,unknown>>;tokens:Readonly<{contractVersion:number;public:unknown;internal:unknown}>;manifest:PresentationManifest;list:PresentationKernel['listPresentations'];register:PresentationHostController['registerPresentation'];get:PresentationKernel['activePresentationId'];set:PresentationHostController['setPresentation']}>;
}
export interface PublicApiInput{
 readonly version:string;readonly data:Readonly<{contract:unknown;deviceState:InsightsDeviceState}>;
 readonly insights:PublicInsights;readonly logic:PublicLogic;readonly plan:PublicPlan;readonly preview:PublicPreview;
 readonly backup:BackupPublicInput;readonly installation:InstallationPublicInput;readonly appearance:AppearancePublicInput;readonly ui:PublicUi;
}
export interface StudyDirectorPublicApi{
 readonly version:string;readonly capabilities:CapabilityMap;readonly data:Readonly<{contract:unknown;deviceState:InsightsDeviceState}>;
 readonly insights:PublicInsights;readonly logic:PublicLogic;readonly plan:Readonly<PublicPlan>;readonly preview:PublicPreview;
 readonly backup:Readonly<{createCheckpoint:BackupPublicInput['createCheckpoint'];inspect:BackupPublicInput['inspect'];releaseFile:BackupPublicInput['releaseFile'];receiveStream:BackupPublicInput['receiveStream'];checksum:BackupPublicInput['checksum'];restore:BackupPublicInput['restore'];downloadSafetyCopy:BackupPublicInput['downloadSafetyCopy'];limits:Readonly<{maxFileBytes:number}>;repositoryPolicy:Readonly<Record<string,unknown>>;device:BackupPublicInput['device'];profile:Readonly<BackupProfilePublic>;providers:Readonly<BackupPublicInput['providers']>}>;
 readonly installation:Readonly<{status:()=>NativeCapabilitiesStatus;prompt:NativeCapabilitiesController['promptInstall'];inspect:NativeCapabilitiesController['inspectInstallation'];showHelp:NativeCapabilitiesController['revealInstallHelp']}>;
 readonly appearance:Readonly<{theme:Readonly<{defaultId:string;supported:readonly ThemeDefinition[];get:PresentationKernel['activeThemeId'];set:PresentationHostController['setTheme']}>;presentation:Readonly<{defaultId:string;readonly supported:readonly PresentationProfile[];invariants:Readonly<Record<string,unknown>>;breakpoints:Readonly<Record<string,unknown>>;tokens:Readonly<{contractVersion:number;public:unknown;internal:unknown}>;manifest:PresentationManifest;list:PresentationKernel['listPresentations'];register:PresentationHostController['registerPresentation'];get:PresentationKernel['activePresentationId'];set:PresentationHostController['setPresentation']}>}>;
 readonly ui:Readonly<PublicUi>;readonly plugins:Readonly<{status:()=>PluginRuntimeStatus}>;registerPlugin(plugin:StudyDirectorPluginDescriptor):boolean;
}
export interface StudyDirectorPluginDescriptor{
 readonly name:string;readonly version?:string;readonly requires?:Readonly<Record<string,number>>;
 readonly previewProviders?:Readonly<Record<string,InsightsPreviewProvider>>;
 readonly setup:(api:StudyDirectorPublicApi)=>unknown;
}
export interface PublicApiRuntimeInput{
 readonly configuration:Readonly<{capabilities:CapabilityMap;descriptors:readonly OptionalPluginDescriptor[]}>;
 readonly environment:Readonly<{document:Document;trustedAssetURL(value:string):unknown}>;
 readonly tabs:Readonly<{registerTab(config:TabConfig):boolean;renderTab(id:string):unknown}>;
 readonly preview:Readonly<{registerProvider(target:string,provider:InsightsPreviewProvider):boolean}>;
 clampText(value:unknown,max:number):string;
}
export interface PublicApiRuntime{
 readonly format:'study-director.public-api-host';readonly contractVersion:1;
 registerPlaceholders():boolean;requestTab(tabId:unknown,options?:Readonly<{retry?:boolean}>):Promise<boolean>|null;register(plugin:unknown):boolean;
 status():PluginRuntimeStatus;createPublicApi(input:Readonly<PublicApiInput>):StudyDirectorPublicApi;
}
export interface PublicApiHostModule{readonly format:'study-director.public-api-host-module';readonly contractVersion:1;createRuntime(input:Readonly<PublicApiRuntimeInput>):Readonly<PublicApiRuntime>}
export type PublicApiModuleRegistration=ModuleRegistration<'public-api-host','study-director.public-api-host-module'>;
