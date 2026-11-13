import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {ReviewHostInput,ReviewHostModule as ReviewHostContract} from '../../types/review-host.ts';
import type {ActiveSession,DailyRecord,SessionEvidence} from '../../types/record-models.ts';

const sdReviewHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'review-host','study-director.review-host-module'>|undefined;
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
const freeze=Object.freeze;

function objectRecord(value:unknown):value is Record<string,unknown>{
  return !!value&&typeof value==='object'&&!Array.isArray(value);
}
function exactObject(value:unknown,keys:readonly string[],label:string):asserts value is Record<string,unknown>{
  if(!objectRecord(value))throw new TypeError(`${label} must be an object.`);
  const actual=Object.keys(value).sort(),expected=[...keys].sort();
  if(actual.length!==expected.length||actual.some((key,index)=>key!==expected[index]))throw new TypeError(`${label} is incomplete or contains unexpected fields.`);
}
function createSubsystem(input:Readonly<ReviewHostInput>){
  exactObject(input,['module','subsystem'],'Review host input');
  if(input.module.format!=='study-director.review'||input.module.contractVersion!==1)throw new TypeError('Review module is unavailable or incompatible.');
  if(!Object.isFrozen(input.subsystem))throw new TypeError('Review subsystem composition must be frozen.');
  const subsystem=input.module.createReviewSubsystem(input.subsystem);
  if(!Object.isFrozen(subsystem)||subsystem.format!=='study-director.review-subsystem'||subsystem.contractVersion!==1){
    throw new TypeError('Study Director Review subsystem is unavailable or incompatible.');
  }
  return subsystem;
}

function createDayState(input:import('../../types/review-host.ts').ReviewDayStateInput){
  exactObject(input,['document','timerState','tasks','isTrackableBlock','isValidIsoDate','todayISO','fullWeekdayNames'],'Review day-state input');
  const {document,timerState,tasks,isTrackableBlock,isValidIsoDate,todayISO,fullWeekdayNames}=input;
  const reminder={date:'',evidence:null as SessionEvidence|null,generation:0};
  function cleanRevision(value:unknown){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(n))):0;}
  function getReviewDate(){
    const selected=document.getElementById('day-date');
    const value=selected instanceof HTMLInputElement?selected.value:'';
    return isValidIsoDate(value)?value:(timerState.studyDate||todayISO());
  }
  function isDirty(date=getReviewDate()){return date===getReviewDate()&&cleanRevision(timerState.contentRevision)>cleanRevision(timerState.savedRevision);}
  function markChanged(){
    if(!timerState.studyDate&&!tasks().length)return 0;
    timerState.contentRevision=Math.max(cleanRevision(timerState.contentRevision),cleanRevision(timerState.savedRevision))+1;return timerState.contentRevision;
  }
  function markSaved(date:string,revision:unknown){
    if(date===getReviewDate())timerState.savedRevision=Math.max(cleanRevision(timerState.savedRevision),cleanRevision(revision));return !isDirty(date);
  }
  function dateTitle(iso:string){
    const d=new Date(iso+'T00:00:00');if(Number.isNaN(d.getTime()))return '—';
    const day=fullWeekdayNames[d.getDay()]||'',months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${day} · ${months[d.getMonth()]||''} ${d.getDate()}`;
  }
  function setDateTitle(iso:string){const target=document.getElementById('review-date');if(target)target.textContent=dateTitle(iso);}
  return freeze({reminder,getReviewDate,cleanRevision,isDirty,markChanged,markSaved,dateTitle,setDateTitle});
}

function createSavedDayCoordinator(input:import('../../types/review-host.ts').ReviewSavedDayCoordinatorInput){
  exactObject(input,['document','day','runtime','repositories','codecs','session','review','view','activation'],'Review saved-day coordinator input');
  const {document,day,runtime,repositories,codecs,session,review,view,activation}=input;
  function liveEvidence(date:string){
    if(date!==day.getReviewDate()||runtime.timerState.studyDate!==date||!runtime.tasks().some(runtime.isTrackableBlock))return null;
    try{
      const snapshot=runtime.captureSessionSnapshot(),scheduleText=runtime.appliedScheduleText();
      return snapshot?.date===date&&scheduleText.trim()?freeze({date,scheduleText,snapshot}):null;
    }catch(error){view.diagnostics('session.reminder-runtime-evidence',error,'warn');return null;}
  }
  function covers(record:DailyRecord|undefined,subjects:readonly SessionEvidence[]){return !!record&&subjects.length>0&&subjects.every(subject=>codecs.savedDayCoversSessionEvidence(record,subject,{allowAdvances:true}));}
  async function hasUncoveredKept(record:DailyRecord,date:string){
    const pending=await repositories.pendingReviews();
    return pending.some(row=>{
      if(row.subject!=='session'||row.resolvedAt||!row.kept)return false;
      return row.kept.date===date&&!codecs.savedDayCoversSessionEvidence(record,row.kept,{allowAdvances:true});
    });
  }
  async function savedDayCoversWork(date:string,captured:SessionEvidence|null=null){
    const live=liveEvidence(date);if(day.isDirty(date)&&!live)return false;
    const loaded=await repositories.loadActiveSession(0,{strict:true}),active=loaded?.value||null;
    if(!loaded?.ok||loaded.error||active?.date===date&&loaded.storage?.idb!==true)return false;
    const subjects=[...(captured?[captured]:[]),...(active?.date===date?[active]:[]),...(live?[live]:[])];
    if(!subjects.length)return false;
    const record=(await repositories.dailyDocuments([date],{requireCanonical:true})).find(row=>row.date===date);
    if(!record||!covers(record,subjects)||await hasUncoveredKept(record,date))return false;
    await repositories.verifyDaily(record);
    const latest=liveEvidence(date);
    if((live||latest)&&(!latest||!covers(record,[latest]))||day.isDirty(date)&&!latest)return false;
    const checked=await repositories.loadActiveSession(0,{strict:true});
    if(!checked?.ok||checked.error||checked.value?.date===date&&(checked.storage?.idb!==true||!covers(record,[checked.value])))return false;
    return !await hasUncoveredKept(record,date);
  }
  async function savedRecordExistsForDate(date:string){try{return await savedDayCoversWork(date);}catch(error){view.diagnostics('session.saved-day-reminder',error,'warn');return false;}}
  async function promptSaveToday(){
    const date=day.getReviewDate(),reminder=day.reminder;
    if(!runtime.tasks().some(runtime.isTrackableBlock)||reminder.date===date)return;
    if(await savedRecordExistsForDate(date)||reminder.date===date)return;
    let evidence:SessionEvidence|null=null;
    try{
      const loaded=await repositories.loadActiveSession(0,{strict:true});
      if(loaded?.ok&&!loaded.error&&loaded.storage?.idb===true&&loaded.value?.date===date&&runtime.timerState.studyDate===date&&
          day.cleanRevision(loaded.value.snapshot?.contentRevision)===day.cleanRevision(runtime.timerState.contentRevision))evidence=codecs.sanitizeSession(loaded.value);
    }catch(error){view.diagnostics('session.save-reminder-evidence',error,'warn');}
    if(!evidence)evidence=liveEvidence(date);
    if(reminder.date===date)return;
    reminder.date=date;reminder.evidence=evidence;reminder.generation+=1;
    runtime.setSafetyMessage(`Review reminder: ${view.prettyDate(date)} has unsaved study data. Open Review and Save Today to Library.`);
    view.refreshStorageWarning();view.notifyUser('Save today’s study record','Open Review and save today to Library.',`sdm-save-${date}`);
    view.setStatus('save-status','Review is ready. Save today to Library when you are done.');view.openDetails(true);
  }
  function clearSaveReminder(date=day.getReviewDate(),revision:unknown=runtime.timerState.contentRevision){
    const reminder=day.reminder;if(reminder.date===date){reminder.date='';reminder.evidence=null;reminder.generation+=1;}
    day.markSaved(date,revision);if(runtime.safetyMessage().includes('Review reminder'))runtime.setSafetyMessage('');view.refreshStorageWarning();return true;
  }
  async function revalidateSaveReminder(){
    const reminder=day.reminder,date=reminder.date,evidence=reminder.evidence,generation=reminder.generation;
    if(!date||!runtime.safetyMessage().startsWith('Review reminder:'))return false;
    try{
      if(!await savedDayCoversWork(date,evidence))return false;
      if(reminder.date!==date||reminder.generation!==generation||!runtime.safetyMessage().startsWith('Review reminder:'))return false;
      reminder.date='';reminder.evidence=null;reminder.generation+=1;session.clearSafetyMessage('Review reminder:');
      if(view.staleSaveStatus())view.setStatus('save-status','');return true;
    }catch(error){view.diagnostics('session.reminder-convergence',error,'warn');return false;}
  }
  async function acknowledgeSavedStudyDay(date:string,revision:unknown){
    const covered=day.cleanRevision(revision),previous=runtime.timerState.savedRevision;
    if(!runtime.tasks().length||day.getReviewDate()!==date||runtime.timerState.studyDate!==date||
        !Number.isSafeInteger(Number(revision))||Number(revision)<0||covered>day.cleanRevision(runtime.timerState.contentRevision)||covered<day.cleanRevision(previous)){
      throw new Error('The Saved Day and Active Session revision no longer identify the same study evidence.');
    }
    runtime.timerState.savedRevision=covered;
    try{
      const saved=await session.writeCanonicalNow('acknowledging the Saved Day',{markChanged:false});
      if(!saved?.value||saved.value.date!==date||day.cleanRevision(saved.value.snapshot?.savedRevision)<covered)throw saved?.error||new Error('The Saved Day acknowledgement was not saved in the Active Session.');
      clearSaveReminder(date,covered);return true;
    }catch(error){runtime.timerState.savedRevision=previous;throw error;}
  }
  function clearCanonicalSessionAfterSavedDay(){return session.clearCanonicalAfterSavedDay();}
  async function saveDayRecord(){
    let suspended:ActiveSession|null=null;
    if(!runtime.tasks().length||runtime.panelMode()==='suspended'){
      const loaded=await repositories.loadActiveSession(0,{strict:true}),candidate=loaded?.value||null;
      if(candidate&&runtime.isSuspended(candidate)){
        if(!runtime.appCanMutate()){view.setStatus('save-status','Take control in this tab before saving the suspended session.',false);return false;}
        if(!runtime.tasks().length){
          const snapshot=runtime.activeSessionSnapshot(candidate);
          if(!snapshot){view.setStatus('save-status','The suspended session could not be read safely. Restore it before saving.',false);return false;}
          if(runtime.applyStoredSessionSnapshot(candidate,{...snapshot,timerRuntime:null},{source:'suspended-session-review',reviewOnly:true})===false){
            view.setStatus('save-status','The suspended session could not be loaded into Review safely.',false);return false;
          }
        }
        suspended=candidate;
      }
    }
    const saved=await review.saveService.saveToday({closeSession:!!suspended});
    if(!suspended)return saved;
    if(!saved){
      try{
        const loaded=await repositories.loadActiveSession(0,{strict:true}),current=loaded?.value||null;
        if(runtime.isSuspended(current))runtime.setPanelMode('suspended',current);else if(loaded?.ok&&!current)runtime.setPanelMode('none');
      }catch(error){view.diagnostics('review.suspended-session-status',error,'warn');}
      return false;
    }
    runtime.setTimerDone();runtime.setPanelMode('none');runtime.updateSessionControls();return true;
  }
  async function handleStudyDayRollover(){
    if(runtime.panelMode()==='previous')return false;
    const changed=await review.saveService.handleRollover();if(changed)activation.publishRollover();return changed;
  }
  function selectReviewDate(){review.closeReflectionEditor();return review.editor.selectDate();}
  return freeze({promptSaveToday,clearSaveReminder,revalidateSaveReminder,acknowledgeSavedStudyDay,clearCanonicalSessionAfterSavedDay,saveDayRecord,handleStudyDayRollover,selectReviewDate,savedRecordExistsForDate});
}

const createModule=():ReviewHostContract=>freeze({format:'study-director.review-host-module',contractVersion:1,createSubsystem,createDayState,createSavedDayCoordinator});
registry.define('review-host',1,createModule);
return createModule;
})();
export type ReviewHostModule=ReturnType<typeof sdReviewHostFactory>;
