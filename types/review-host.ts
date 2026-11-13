import type {Task} from './domain.ts';
import type {ActiveSession,DailyRecord,PendingReview,SessionEvidence,SessionSnapshot} from './record-models.ts';
import type {ReviewEditor,ReviewModule,ReviewSaveService,ReviewSubsystem,ReviewSubsystemInput} from './review.ts';
import type {SessionResult} from './repositories.ts';

export interface ReviewHostInput{readonly module:ReviewModule;readonly subsystem:Readonly<ReviewSubsystemInput>;}
export interface ReviewReminderState{date:string;evidence:SessionEvidence|null;generation:number}
export interface ReviewDayStateInput{
  readonly document:Document;
  readonly timerState:{studyDate:string|null;contentRevision:number;savedRevision:number};
  readonly tasks:()=>readonly Task[];
  readonly isTrackableBlock:(task:Task|undefined)=>boolean;
  readonly isValidIsoDate:(value:unknown)=>boolean;
  readonly todayISO:()=>string;
  readonly fullWeekdayNames:readonly string[];
}
export interface ReviewDayState{
  readonly reminder:ReviewReminderState;
  getReviewDate():string;cleanRevision(value:unknown):number;isDirty(date?:string):boolean;
  markChanged():number;markSaved(date:string,revision:unknown):boolean;dateTitle(date:string):string;setDateTitle(date:string):void;
}
export interface ReviewSavedDayCoordinatorInput{
  readonly document:Document;readonly day:ReviewDayState;
  readonly runtime:Readonly<{
    tasks:()=>readonly Task[];timerState:ReviewDayStateInput['timerState'];isTrackableBlock:(task:Task|undefined)=>boolean;
    captureSessionSnapshot:()=>SessionSnapshot|null;appliedScheduleText:()=>string;appCanMutate:()=>boolean;
    panelMode:()=>string;safetyMessage:()=>string;setSafetyMessage:(value:string)=>void;
    isSuspended:(session:ActiveSession|null)=>boolean;activeSessionSnapshot:(session:ActiveSession|null)=>SessionSnapshot|null;
    applyStoredSessionSnapshot:(session:ActiveSession,snapshot:SessionSnapshot,options:Readonly<{source:string;reviewOnly:true}>)=>boolean;
    setPanelMode:(mode:string,session?:ActiveSession|null)=>unknown;setTimerDone:()=>unknown;updateSessionControls:()=>unknown;
  }>;
  readonly repositories:Readonly<{
    loadActiveSession:(retry?:number,options?:Readonly<{strict?:boolean}>)=>PromiseLike<SessionResult>;
    dailyDocuments:(dates:readonly string[],options?:Readonly<{requireCanonical?:boolean}>)=>PromiseLike<readonly DailyRecord[]>;
    verifyDaily:(record:DailyRecord)=>PromiseLike<unknown>;pendingReviews:()=>PromiseLike<readonly PendingReview[]>;
  }>;
  readonly codecs:Readonly<{
    sanitizeSession:(value:unknown)=>ActiveSession|null;
    savedDayCoversSessionEvidence:(record:DailyRecord|undefined,subject:SessionEvidence,options:Readonly<{allowAdvances:true}>)=>boolean;
  }>;
  readonly session:Readonly<{
    writeCanonicalNow:(label:string,options:Readonly<{markChanged:false}>)=>PromiseLike<Readonly<{value?:ActiveSession|null;error?:unknown}>>;
    clearCanonicalAfterSavedDay:()=>PromiseLike<unknown>;
    clearSafetyMessage:(prefix:string)=>unknown;
  }>;
  readonly review:Readonly<{saveService:ReviewSaveService;editor:Pick<ReviewEditor,'selectDate'>;closeReflectionEditor:()=>unknown}>;
  readonly view:Readonly<{
    prettyDate:(date:string)=>string;refreshStorageWarning:()=>unknown;notifyUser:(title:string,message:string,key:string)=>unknown;
    setStatus:(id:string,message:string,ok?:boolean)=>unknown;openDetails:(open:boolean)=>unknown;
    diagnostics:(scope:string,error:unknown,level:'warn'|'error')=>unknown;
    staleSaveStatus:()=>boolean;
  }>;
  readonly activation:Readonly<{publishRollover:()=>unknown}>;
}
export interface ReviewSavedDayCoordinator{
  promptSaveToday():Promise<boolean|void>;clearSaveReminder(date?:string,revision?:unknown):boolean;
  revalidateSaveReminder():Promise<boolean>;acknowledgeSavedStudyDay(date:string,revision:unknown):Promise<boolean>;
  clearCanonicalSessionAfterSavedDay():PromiseLike<unknown>;saveDayRecord():Promise<boolean>;handleStudyDayRollover():Promise<boolean>;
  selectReviewDate():unknown;savedRecordExistsForDate(date:string):Promise<boolean>;
}
export interface ReviewHostModule{
  readonly format:'study-director.review-host-module';readonly contractVersion:1;
  createSubsystem(input:Readonly<ReviewHostInput>):Readonly<ReviewSubsystem>;
  createDayState(input:Readonly<ReviewDayStateInput>):Readonly<ReviewDayState>;
  createSavedDayCoordinator(input:Readonly<ReviewSavedDayCoordinatorInput>):Readonly<ReviewSavedDayCoordinator>;
}
