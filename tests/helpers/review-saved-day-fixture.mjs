import {readRuntimeSource} from './runtime-source.mjs';
import vm from 'node:vm';

export const REVIEW_SAVED_DAY_DATE='2026-08-27';

function loadReviewHost(){
  class FakeInput{constructor(value=''){this.value=value;}}
  const context=vm.createContext({console,Object,Array,Set,Map,WeakMap,Promise,Date,Number,String,Boolean,Math,JSON,Error,TypeError,RangeError,Symbol,HTMLInputElement:FakeInput});
  vm.runInContext(readRuntimeSource('source/core/internal.ts'),context,{filename:'source/core/internal.ts'});
  vm.runInContext(readRuntimeSource('source/core/review-host.ts'),context,{filename:'source/core/review-host.ts'});
  return {module:context[Symbol.for('studyDirector.internalModules.v1')].require('review-host',1),FakeInput};
}
const loaded=loadReviewHost();

export function createSavedDayFixture(options={}){
  const date=String(options.date||REVIEW_SAVED_DAY_DATE),input=new loaded.FakeInput(date),title={textContent:''};
  const document={getElementById:id=>id==='day-date'?input:id==='review-date'?title:null};
  const timerState={
    studyDate:options.studyDate===undefined?date:options.studyDate,
    contentRevision:options.contentRevision??7,
    savedRevision:options.savedRevision??0
  };
  const tasks=options.tasks??[{kind:'work'}],day=loaded.module.createDayState(Object.freeze({
    document,timerState,tasks:()=>tasks,isTrackableBlock:task=>task?.kind==='work',
    isValidIsoDate:value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')),todayISO:()=>date,
    fullWeekdayNames:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  }));
  let active=options.active===undefined?{date,status:'active',snapshot:{contentRevision:7,savedRevision:timerState.savedRevision}}:options.active;
  let dayRecord=options.dayRecord??null,activeReads=0,clears=0,writes=0,panelMode=options.panel||'none',safety=options.safetyMessage||'';
  const events=[];
  if(options.reminder){day.reminder.date=date;day.reminder.evidence=options.reminderEvidence??null;day.reminder.generation=options.reminderGeneration??1;}
  const coordinator=loaded.module.createSavedDayCoordinator(Object.freeze({
    document,day,
    runtime:Object.freeze({
      tasks:()=>tasks,timerState,isTrackableBlock:task=>task?.kind==='work',
      captureSessionSnapshot:()=>typeof options.liveSnapshot==='function'?options.liveSnapshot():options.liveSnapshot??null,
      appliedScheduleText:()=>options.scheduleText??'valid plan',appCanMutate:()=>options.canMutate!==false,
      panelMode:()=>panelMode,safetyMessage:()=>safety,setSafetyMessage:value=>{safety=value;},
      isSuspended:session=>session?.status==='suspended',activeSessionSnapshot:session=>session?.snapshot||null,
      applyStoredSessionSnapshot:(session,snapshot,applyOptions)=>{events.push(['hydrate',session,snapshot,applyOptions]);return options.hydrate!==false;},
      setPanelMode:(mode,session)=>{panelMode=mode;events.push(['panel',mode,session]);},
      setTimerDone:()=>events.push(['done']),updateSessionControls:()=>events.push(['controls'])
    }),
    repositories:Object.freeze({
      loadActiveSession:async()=>{
        activeReads++;
        if(options.activeReadFailure)return {ok:false,value:null,error:new Error('active read failed'),storage:{idb:false,local:false}};
        const value=typeof options.activeValue==='function'?options.activeValue(activeReads,active):active;
        return {ok:true,value,error:null,storage:{idb:options.activeInIdb!==false,local:true}};
      },
      dailyDocuments:async()=>{
        if(options.dayReadFailure)throw new Error('Canonical IndexedDB read failed');
        const value=typeof options.dayValue==='function'?options.dayValue():dayRecord;
        return value?[value]:[];
      },
      verifyDaily:async record=>{events.push(['verify',record]);if(options.verifyFailure)throw new Error('canonical verification failed');return true;},
      pendingReviews:async()=>typeof options.pendingReviews==='function'?options.pendingReviews():options.pendingReviews||[]
    }),
    codecs:Object.freeze({
      sanitizeSession:value=>value,
      savedDayCoversSessionEvidence:(record,subject,coverageOptions)=>{
        if(coverageOptions.allowAdvances!==true)throw new Error('coverage must allow advances');
        return options.coverage?options.coverage(record,subject):!!record;
      }
    }),
    session:Object.freeze({
      writeCanonicalNow:async(label,writeOptions)=>{
        writes++;if(label!=='acknowledging the Saved Day'||writeOptions.markChanged!==false)throw new Error('unexpected acknowledgement write');
        if(options.writeFailure)throw new Error('IndexedDB unavailable');
        const savedRevision=options.mismatchedWrite?Math.max(0,timerState.savedRevision-1):timerState.savedRevision;
        active={...active,date,snapshot:{...(active?.snapshot||{}),savedRevision}};return {ok:true,value:active,storage:{idb:true}};
      },
      clearCanonicalAfterSavedDay:async()=>{clears++;if(options.clearFailure)throw new Error('IndexedDB unavailable');active=null;return true;},
      clearSafetyMessage:prefix=>{if(safety.startsWith(prefix))safety='';}
    }),
    review:Object.freeze({
      saveService:Object.freeze({
        saveToday:async saveOptions=>{events.push(['save',saveOptions]);return options.saveResult!==false;},
        handleRollover:async()=>{events.push(['service-rollover']);return options.rolloverResult!==false;},
        hasSaveableDay:()=>true,isRolledOver:()=>true,status:()=>({rolloverSaveInProgress:false,saveDayInProgress:false,activeSessionPersistenceBlocked:false})
      }),
      editor:Object.freeze({selectDate:()=>{events.push(['date']);return true;}}),closeReflectionEditor:()=>events.push(['close-editor'])
    }),
    view:Object.freeze({
      prettyDate:value=>value,refreshStorageWarning:()=>{},notifyUser:(...args)=>events.push(['notify',...args]),
      setStatus:(...args)=>events.push(['status',...args]),openDetails:()=>{},
      diagnostics:(...args)=>events.push(['diagnostic',...args]),staleSaveStatus:()=>options.staleSaveStatus!==false
    }),
    activation:Object.freeze({publishRollover:()=>events.push(['rollover'])})
  }));
  return {
    date,coordinator,day,timerState,events,
    setActive:value=>{active=value;},setDayRecord:value=>{dayRecord=value;},
    state:()=>({active,dayRecord,panelMode,safety,clears,writes,activeReads})
  };
}
