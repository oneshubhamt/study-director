import type {NoticeCoordinator,NotificationEvent} from '../source/core/notice-coordinator.ts';
import type {NotificationAction,NotificationInput,NotificationProgress} from './notifications.ts';
export interface ProgressView extends NotificationProgress {readonly progress?:NotificationProgress|null}
export interface OperationView {readonly kind?:string;readonly message?:string;readonly progress?:NotificationProgress|null}
export interface ConvergenceLocation {readonly label?:string;readonly status?:string;readonly shared?:boolean}
export interface ConvergenceView extends ConvergenceLocation {readonly source?:ConvergenceLocation;readonly others?:readonly ConvergenceLocation[]}
export interface SyncView {readonly syncing?:boolean;readonly password?:boolean;readonly review?:boolean;readonly newer?:boolean;readonly syncedAt?:string;readonly failed?:boolean;readonly turnWaits?:number;readonly turnDevice?:string}
export interface LocationView {readonly busy?:boolean;readonly stalled?:boolean;readonly foregroundKind?:string;readonly backingUp?:boolean;readonly sync?:SyncView|null;readonly maintenanceBusy?:boolean;readonly mode?:string;readonly connected?:boolean;readonly wasConnected?:boolean;readonly locked?:boolean;readonly lastBackupAt?:string;readonly waiting?:boolean;readonly connecting?:boolean;readonly setUp?:boolean;readonly retryBackoffCapped?:boolean;readonly nextEligibleAt?:string}
export interface BackupStatusInput {readonly drive?:LocationView|null;readonly device?:LocationView|null;readonly online?:boolean;readonly passwordNeeded?:boolean;readonly newerData?:boolean;readonly kept?:number;readonly storage?:readonly {label?:string;source?:string;level?:string;message?:string}[];readonly reminder?:string;readonly sessionElsewhere?:string;readonly sessionReady?:string;readonly updateReady?:boolean;readonly unseen?:number;readonly operation?:OperationView|null}
export interface ConnectProgressInput {readonly phase?:string;readonly drive?:LocationView|null;readonly operation?:OperationView|null;readonly seen?:{sync?:boolean;upload?:boolean};readonly online?:boolean;readonly startedAt?:number;readonly keptNew?:number;readonly error?:string}
export interface PresentationInput {notifications:Pick<NoticeCoordinator,'readEvent'|'resolveEvent'|'eventStatus'|'begin'|'emit'|'subscribe'>;action?:(source:string,kind:string)=>NotificationAction|null;timeLabel?:(at:string)=>string;verified?:(source:string)=>{at?:string}|null;synced?:()=>boolean}
export type PresentationOptions=NotificationInput & {readonly label?:string};
export interface ConnectAction {readonly action:string;readonly label:string;readonly step?:string}
export interface ConnectExtra {readonly waiting?:boolean;readonly failed?:string;readonly action?:ConnectAction|null;readonly done?:boolean;readonly detail?:string;readonly fraction?:number|null}
export type StatusTone='error'|'warning'|'review'|'info';
export interface StatusItem {readonly id:string;readonly tone:StatusTone;readonly short:string;readonly text:string;readonly action:string;readonly actionLabel:string}
export type PresentationEvent=NotificationEvent;
