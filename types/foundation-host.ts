import type {NoticeCoordinator,NotificationEvent} from '../source/core/notice-coordinator.ts';
import type {InteractionsModule} from '../source/core/interactions.ts';
import type {WorkspaceOverlayModule} from '../source/core/workspace-overlay.ts';
import type {NavigationModule} from '../source/core/navigation.ts';
import type {WorkspaceDescriptor,WorkspaceOpenMeta,WorkspaceCloseMeta} from './workspace.ts';
import type {NavigationContext,DepartureContext,NavigationOptions} from './navigation.ts';
import type {NotificationRequest} from './notifications.ts';
export type NavigationController=ReturnType<NavigationModule['createController']>;
export type Interactions=ReturnType<InteractionsModule['createController']>;
export type Overlay=ReturnType<WorkspaceOverlayModule['createController']>;
export interface DiagnosticPort {capture(scope:string,error:unknown,level:'warn'):void}
export interface PrimitivesInput {document:Document;APP_LIMITS:{maxNoteChars:number};CompletionModel:{fromUnits(done:number,total:number):number}}
export interface WorkspaceHandler {current():WorkspaceDescriptor|null;reconcile(desired:WorkspaceDescriptor|null,context:NavigationContext):unknown}
export interface WorkspaceRouterInput {navigation():NavigationController|null;interactions():Pick<Interactions,'historyDescriptor'|'reconcileHistory'>;overlay():Pick<Overlay,'historyDescriptor'|'reconcile'>}
export interface RecentInput {document:Document;sessionStorage:Pick<Storage,'getItem'|'setItem'|'removeItem'>;SESSION_STORAGE_KEYS:{notifications:string};ProfileScope:{scope:string};NoticeCoordinator:NoticeCoordinator;AppDiagnostics:DiagnosticPort;scheduleSyncStatus():void;closeProfilePanel():void}
export interface SystemInput {window:Window & Pick<typeof globalThis,'Notification'>;document:Document;navigator:Navigator;location:Location;NoticeCoordinator:NoticeCoordinator;Interactions:Pick<Interactions,'notify'>;AppDiagnostics:DiagnosticPort;appCanMutate():boolean;readPreference():unknown;writePreference(value:boolean):unknown}
export interface SoundInput {document:Document;NoticeCoordinator:NoticeCoordinator;appCanMutate():boolean;persistProtectedPreferences(value:{soundMode:'full'|'minimal'|'off'}):unknown}
export interface BackupActionsInput {document:Document;AppDiagnostics:DiagnosticPort;device():{status():{connected?:boolean;supported?:boolean}};providers():{connect(source:string):unknown;reviewSync(source:string):unknown;unlockSync(source:string):unknown;connected(source:string):boolean};history():{open():unknown}|null|undefined;checkForUpdate():Promise<unknown>;connectDeviceBackupWithRecovery():unknown;connectDriveForProfile():unknown;goTab(name:string,options?:NavigationOptions):Promise<boolean>;showData():void;preferredScrollBehavior():ScrollBehavior}
export interface TabHookContext extends Partial<NavigationContext>{id:string;pane:HTMLElement|null}
export interface TabConfig {id?:string;label?:string;icon?:string;pane?:HTMLElement;render?:(context:TabHookContext)=>unknown;ready?:(context:NavigationContext)=>unknown}
export interface ActivationOptions {restoreScroll?:boolean|undefined;immediateScroll:boolean}
export interface NavigationUIInput {
 document:Document;window:Window;clampText(value:unknown,max:number):string;controller():NavigationController|null;
 library():{settleDiary():Promise<boolean>;deactivate(options:{diarySettled:true}):unknown;activate(options:ActivationOptions):unknown};
 review():{deactivate():unknown;activate(options:ActivationOptions):unknown};
 attachments():{close():unknown;refresh():unknown};
 reviewEditor():{settled():Promise<unknown>};flushPendingReviewSave(options:{strict:true}):boolean|void;
 setStatus(id:string,message:string,ok:boolean):unknown;clearPreview(tab:string):void;
 refreshPnote(options:{force:true}):unknown;updateCD():unknown;isLiveTrackableTimer():boolean;refreshExecuteIdleDisplay(date:Date,options:{force:true}):unknown;paused():boolean;updateBreakMeter():unknown;renderPacer():unknown;startTimerPresentation():unknown;stopTimerPresentation():unknown;
 renderScheduleOnPlanOpen():unknown;updateRealTimeAwareness(value:null,options:{force:true}):unknown;requestPluginTab(tab:string):unknown;applyOwnership():unknown;richTextSyncAll():unknown;
}
export type ActionTable<E extends Event>=Readonly<Record<string,((event:E)=>unknown)|undefined>>;
export interface DelegatedInput {
 document:Document;goTab(name:string|undefined,options?:NavigationOptions):Promise<boolean>;setStudyQuality(value:number|null):void;requirePrimaryTab(event:Event,reason:string):boolean;
 CLICK_ACTIONS:ActionTable<MouseEvent>;CHANGE_ACTIONS:ActionTable<Event>;INPUT_ACTIONS:ActionTable<Event>;BLUR_ACTIONS:ActionTable<FocusEvent>;KEYDOWN_ACTIONS:ActionTable<KeyboardEvent>;
 OWNER_REQUIRED_CLICK_ACTIONS:ReadonlySet<string>;OWNER_REQUIRED_CHANGE_ACTIONS:ReadonlySet<string>;OWNER_REQUIRED_INPUT_ACTIONS:ReadonlySet<string>;OWNER_REQUIRED_BLUR_ACTIONS:ReadonlySet<string>;OWNER_REQUIRED_KEYDOWN_ACTIONS:ReadonlySet<string>;
 editedTextarea():void;UiTabRegistry:{handleKeydown(event:KeyboardEvent):boolean};Pomodoro:{stop(options:{dismiss:true;audio:false}):unknown};
}
export type {WorkspaceDescriptor,WorkspaceOpenMeta,WorkspaceCloseMeta,NavigationContext,DepartureContext,NavigationOptions,NotificationEvent,NotificationRequest};
