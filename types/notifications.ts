import type {SoundStatus} from '../source/core/audio-engine.ts';
export type Severity='error'|'warning'|'info'|'success';
export type Lifecycle='running'|'succeeded'|'failed'|'cancelled'|'resolved';
export type Tier='result'|'news'|'blocking'|'critical';
export type Surface='toast'|'inline'|'quiet';
export type BannerKind='critical'|'safety'|'storage'|'update'|'installation';
export type RecentOutcome='open'|'expired'|'dismissed'|'acted'|'resolved'|'replaced'|'ended';
export type Cue='study-start'|'day-complete'|'block-complete'|'next-block'|'pause'|'resume'|'skip'|'pomodoro'|'break-complete'|'overtime'|'practice-target'|'practice-near'|'confirmation'|'attention'|'fixed-start'|'session-moved'|'needs-you'|'news';
export interface NotificationAction {readonly label:string;run():unknown;readonly opens?:boolean}
export interface NotificationProgress {readonly stage?:string;readonly current?:number;readonly total?:number;readonly completedBytes?:number;readonly totalBytes?:number;readonly loadedBytes?:number;readonly activeBytes?:number}
export interface NotificationFields {
 source:string;id:string;operationId:string;surfaceId:string;retainInline:boolean;occurrence:string;cue:Cue|'none'|'';system:boolean;kind:string;outcome:string;completedAt:string;announce:boolean;severity:Severity;lifecycle:Lifecycle;foreground:boolean;tier:Tier|'';title:string;message:string;progress:NotificationProgress|null;action:NotificationAction|null;secondaryAction:NotificationAction|null;surface:Surface;persistent:boolean;dismissible:boolean;duration:number;
}
export type NotificationInput={readonly [K in keyof NotificationFields]?:NotificationFields[K]|undefined};
export type NotificationRequest=Omit<NotificationInput,'kind'> & {readonly kind?:Severity;readonly key?:string;readonly operationKind?:string};
export interface BannerInput {readonly kind:BannerKind;readonly title:string;readonly message:string;readonly actionLabel?:string;readonly compact?:boolean;readonly visible?:boolean}
export interface BannerRow {readonly id:string;readonly kind:BannerKind;readonly title:string;readonly message:string;readonly priority:number;readonly signature:string;readonly actionLabel:string;readonly compact:boolean;readonly deferred:boolean;readonly eligibleAt:number}
export interface BannerState {readonly format:'study-director.notice-state';readonly version:1;readonly revision:number;readonly active:BannerRow|null;readonly queued:readonly (BannerRow|null)[];readonly announcement:string}
export interface CoordinatorInput {render?:(state:BannerState)=>void;now?:()=>number;setTimeout?:(callback:()=>void,delay:number)=>number;clearTimeout?:(id:number)=>void;installationCooldownMs?:number;capture?:(scope:string,error:unknown)=>void}
export interface RecentFields {key:string;source:string;deliveryId:string;tier:Tier;severity:Severity;title:string;message:string}
export interface RecentEntry extends RecentFields {id:string;at:number;outcome:RecentOutcome;seen:boolean}
export interface AudioDelivery {play(name:string,options?:{isCurrent?:()=>boolean;explicit?:boolean}):Promise<boolean>;stop():void;status():SoundStatus}
export interface Delivery<Event> {context?:()=>{owner:boolean;foreground:boolean};audio:AudioDelivery;system?:(event:Event,isCurrent:()=>boolean,silent:()=>boolean)=>unknown}
