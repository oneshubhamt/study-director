import type {BrowserRegistry} from '../browser-registry.ts';
import type {AppData} from '../data-bootstrap-host.ts';
import type {ReviewPersistence} from '../review-persistence.ts';
import type {ReviewSubsystemInput} from '../review.ts';
import type {SessionHostController} from '../session-host.ts';
import type {DailyCodec} from '../repositories.ts';
import type {RecordCodecsModule} from '../../source/core/record-codecs.ts';
import type {TimerStateModule} from '../../source/core/timer-state.ts';
import type {Task} from '../domain.ts';
import type {ActiveSession,SessionSnapshot} from '../record-models.ts';

declare const registry:BrowserRegistry;
declare const baseSubsystemInput:Readonly<ReviewSubsystemInput>;
declare const appData:AppData;
declare const persistence:Readonly<ReviewPersistence>;
declare const sessionController:Readonly<SessionHostController>;
const host=registry.require('review-host',1);
const review=registry.require('review',1);

const subsystemInput=Object.freeze({
  ...baseSubsystemInput,
  services:Object.freeze({...baseSubsystemInput.services,appData,dailyReflection:persistence.DailyReflectionPersistence}),
  ports:Object.freeze({
    ...baseSubsystemInput.ports,
    session:Object.freeze({
      ...baseSubsystemInput.ports.session,
      writeCanonicalNow:(operation:string,options?:Readonly<{markChanged?:boolean;backupCapture?:boolean}>)=>sessionController.writeCanonicalNow(operation,options)
    })
  })
}) satisfies Readonly<ReviewSubsystemInput>;
const subsystem=host.createSubsystem(Object.freeze({module:review,subsystem:subsystemInput}));
void subsystem.ReviewModel.evidenceFormat;
void subsystem.ReviewEditor.bindSession();
void subsystem.ReviewView.status();
void subsystem.SharedReviewPresentation.durationLabel(60);

declare const document:Document;
declare const timerState:ReturnType<TimerStateModule['createStateController']>;
declare const tasks:readonly Task[];
declare const isTrackableBlock:(task:Task|undefined)=>boolean;
declare const isValidIsoDate:(value:unknown)=>boolean;
declare const todayISO:()=>string;
const day=host.createDayState(Object.freeze({
  document,timerState,tasks:()=>tasks,isTrackableBlock,isValidIsoDate,todayISO,
  fullWeekdayNames:Object.freeze(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'])
}));

declare const dailyCodec:DailyCodec;
declare const activeCodec:ReturnType<RecordCodecsModule['createActiveSessionCodec']>;
declare const captureSessionSnapshot:()=>SessionSnapshot|null;
declare const appliedScheduleText:()=>string;
declare const appCanMutate:()=>boolean;
declare const panelMode:()=>string;
declare const safetyMessage:()=>string;
declare const setSafetyMessage:(value:string)=>void;
declare const isSuspended:(session:ActiveSession|null)=>boolean;
declare const activeSessionSnapshot:(session:ActiveSession|null)=>SessionSnapshot|null;
declare const applyStoredSessionSnapshot:(session:ActiveSession,snapshot:SessionSnapshot,options:Readonly<{source:string;reviewOnly:true}>)=>boolean;
declare const setPanelMode:(mode:string,session?:ActiveSession|null)=>unknown;
declare const setTimerDone:()=>unknown;
declare const updateSessionControls:()=>unknown;
declare const clearSafetyMessage:(prefix:string)=>unknown;
declare const closeReflectionEditor:()=>unknown;
declare const prettyDate:(date:string)=>string;
declare const refreshStorageWarning:()=>unknown;
declare const notifyUser:(title:string,message:string,key:string)=>unknown;
declare const setStatus:(id:string,message:string,ok?:boolean)=>unknown;
declare const openDetails:(open:boolean)=>unknown;
declare const diagnostics:(scope:string,error:unknown,level:'warn'|'error')=>unknown;
declare const staleSaveStatus:()=>boolean;
declare const publishRollover:()=>unknown;

const coordinator=host.createSavedDayCoordinator(Object.freeze({
  document,day,
  runtime:Object.freeze({tasks:()=>tasks,timerState,isTrackableBlock,captureSessionSnapshot,appliedScheduleText,appCanMutate,panelMode,safetyMessage,setSafetyMessage,isSuspended,activeSessionSnapshot,applyStoredSessionSnapshot,setPanelMode,setTimerDone,updateSessionControls}),
  repositories:Object.freeze({
    loadActiveSession:appData.activeSession.load,
    dailyDocuments:appData.dailyRecords.documents,
    verifyDaily:appData.dailyRecords.verifyCanonical,
    pendingReviews:appData.pendingReviews.list
  }),
  codecs:Object.freeze({sanitizeSession:activeCodec.sanitizeCurrent,savedDayCoversSessionEvidence:dailyCodec.savedDayCoversSessionEvidence}),
  session:Object.freeze({
    writeCanonicalNow:(label:string,options:Readonly<{markChanged:false}>)=>sessionController.writeCanonicalNow(label,options),
    clearCanonicalAfterSavedDay:()=>sessionController.clearCanonical('clearing the saved study session'),
    clearSafetyMessage
  }),
  review:Object.freeze({saveService:subsystem.ReviewSaveService,editor:subsystem.ReviewEditor,closeReflectionEditor}),
  view:Object.freeze({prettyDate,refreshStorageWarning,notifyUser,setStatus,openDetails,diagnostics,staleSaveStatus}),
  activation:Object.freeze({publishRollover})
}));
void coordinator.savedRecordExistsForDate(todayISO());

// @ts-expect-error -- the Review host accepts only the Review feature module.
host.createSubsystem(Object.freeze({module:host,subsystem:subsystemInput}));
