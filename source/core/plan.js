(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,declaredFunctions:requireFunctions}=registry.contracts;
registry.define('plan',1,()=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    configuration:freeze(['limits']),
    persistence:freeze(['lastError','readDraft','readLibrary','writeLibrary','writeDraft','reportDraftResult']),
    defaults:freeze(['active','applyStudentName','factory']),
    domain:freeze(['clampText','fmtDur','fmtS','hasOngoingTaskNotes','isFixedBlock','isSupportBlock','isTrackableBlock','isWorkBlock','makeScheduleRow','normalizeScheduleKind','normalizeScheduleTarget','positiveMinutes','scheduleFingerprintForRows','scheduleToken','scheduleWarningsMessage','taskAreaKey','taskAreaValue','taskMeasureValue','taskTargetValue','areaNoteTextForKey']),
    parser:freeze(['isCanonicalScheduleText','parseScheduleDraftText','scheduleTextFromRows']),
    clock:freeze(['clockHM','clockMinuteToStudyMinute','getMinuteOfDay','isValidHHMM','normalizeHHMM','studyMinuteToHHMM','t2m','timeLabelFromIso']),
    view:freeze(['document','on','textEl','updateRealTimeAwareness','window']),
    scheduleGateway:freeze(['act','apply','breakState','captureMigration','clearSafety','flush','hasLiveState','markRender','read','reconcile','row','setAnchor','timeline']),
    ownership:freeze(['canMutate','requirePrimary']),
    interactions:freeze(['confirm','input']),
    notifications:freeze(['begin','feedback']),
    overlays:freeze(['createAnchoredPopover']),
    environment:freeze(['clearTimeout','setTimeout'])
  });
  function createController(input){
    exactObject(input,['ports'],'Plan input');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Plan ports');
    for(const [name,fields] of Object.entries(PORT_FIELDS))exactObject(ports[name],fields,'Plan '+name+' port');
    requireFunctions(ports.persistence,PORT_FIELDS.persistence,'Plan persistence port');
    requireFunctions(ports.defaults,['active','applyStudentName'],'Plan defaults port');
    requireFunctions(ports.domain,PORT_FIELDS.domain,'Plan domain port');
    requireFunctions(ports.parser,PORT_FIELDS.parser,'Plan parser port');
    requireFunctions(ports.clock,PORT_FIELDS.clock,'Plan clock port');
    requireFunctions(ports.view,['on','textEl','updateRealTimeAwareness'],'Plan view port');
    requireFunctions(ports.scheduleGateway,PORT_FIELDS.scheduleGateway,'Plan schedule gateway');
    requireFunctions(ports.ownership,PORT_FIELDS.ownership,'Plan ownership port');
    requireFunctions(ports.interactions,PORT_FIELDS.interactions,'Plan interactions port');
    requireFunctions(ports.overlays,PORT_FIELDS.overlays,'Plan overlays port');
    requireFunctions(ports.environment,PORT_FIELDS.environment,'Plan environment port');
    if(!Object.isFrozen(ports.configuration.limits)||!Object.isFrozen(ports.defaults.factory))throw new TypeError('Plan configuration and factory defaults must be frozen.');

    const APP_LIMITS=ports.configuration.limits;
    const persistence=ports.persistence,notifications=ports.notifications;
    const DefaultStore=ports.defaults;
    const {clampText,fmtDur,fmtS,hasOngoingTaskNotes,isFixedBlock,isSupportBlock,isTrackableBlock,isWorkBlock,makeScheduleRow,normalizeScheduleKind,normalizeScheduleTarget,positiveMinutes,scheduleFingerprintForRows,scheduleToken,scheduleWarningsMessage,taskAreaKey,taskAreaValue,taskMeasureValue,taskTargetValue,areaNoteTextForKey}=ports.domain;
    const {isCanonicalScheduleText,parseScheduleDraftText,scheduleTextFromRows}=ports.parser;
    const {clockHM,clockMinuteToStudyMinute,getMinuteOfDay,isValidHHMM,normalizeHHMM,studyMinuteToHHMM,t2m,timeLabelFromIso}=ports.clock;
    const {document,on,textEl,updateRealTimeAwareness,window}=ports.view;
    const scheduleGateway=ports.scheduleGateway;
    const ownership=ports.ownership;
    const {confirm,input:requestInput}=ports.interactions;
    const {clearTimeout,setTimeout}=ports.environment;
    const TASKS=scheduleGateway.read().tasks;
    let lastParsed=[];
    let lastAppliedScheduleText='';
    let lastScheduleNowMinuteKey=null;

    function hydratePlanDraft(options={}){
      const input=document.getElementById('plan-input');
      const fallback=!!(options&&options.fallback);
      const active=fallback?DefaultStore.factory:DefaultStore.active();
      const saved=fallback?null:persistence.readDraft();
      DefaultStore.applyStudentName(active.studentName);
      if(input)input.value=typeof saved==='string'?saved:active.scheduleText;
      return true;
    }
function loadDefaultPlan(){return loadScheduleIntoDraft(DefaultStore.active().scheduleText,{label:'Default',allowIncomplete:true});}
function getPlanDraftText(){
  return String(document.getElementById('plan-input')?.value||'');
}
async function loadScheduleIntoDraft(scheduleText,options={}){
  if(!ownership.requirePrimary(null,'load a plan template'))return {ok:false,error:'ownership_unavailable'};
  const text=String(scheduleText??'');
  const opts=options&&typeof options==='object'?options:{};
  if(!opts.allowIncomplete&&!isCanonicalScheduleText(text)){
    setPlanStatus('Template could not load. Fix its row format or timeline order.',false);
    return {ok:false,error:'invalid_schedule'};
  }
  const ta=document.getElementById('plan-input');
  if(!ta)return {ok:false,error:'missing_plan_input'};
  const previous=ta.value;
  if(previous&&previous!==text){
    const yes=await confirm({title:'Replace current draft?',message:'The current draft will be replaced with a working copy. Saved plans and the live timer are unchanged.',confirmLabel:'Load into draft',cancelLabel:'Keep current draft'});
    if(!yes)return {ok:false,error:'cancelled'};
    if(ta.value!==previous)return {ok:false,error:'draft_changed'};
  }
  if(!ownership.requirePrimary(null,'load a plan'))return {ok:false,error:'ownership_unavailable'};
  ta.value=text;
  const saved=await PlanDraftEditor.save();
  if(!saved)return {ok:false,error:'storage_failed'};
  PlanDraftEditor.preview({source:'guide-template',enterDraft:true});
  setPlanStatus(opts.label?`${opts.label} loaded into Draft. Review, reorder, then Apply.`:'Template loaded into Draft. Review, reorder, then Apply.');
  return {ok:true};
}
const SavedPlans=(()=>{
  let installed=false,busy=false,selectedId='',operationNotice=null,menuControllers=[];
  const node=id=>document.getElementById(id);
  const clearMenus=()=>{for(const item of menuControllers)item.controller.destroy();menuControllers=[];};
  const syncAccess=()=>{
    const panel=node('saved-plans-panel');if(!panel)return false;
    const locked=busy||!ownership.canMutate();
    for(const button of panel.querySelectorAll('[data-saved-plan]'))button.disabled=locked;
    for(const trigger of panel.querySelectorAll('.saved-plan-menu-trigger'))trigger.disabled=locked;
    if(locked)for(const item of menuControllers)item.controller.hide();
    return !locked;
  };
  const status=(message,ok=true)=>{
    if(operationNotice)return operationNotice.finish(ok?'succeeded':'failed',message,{cue:ok&&operationNotice.read()?.kind==='load'?'none':'',retainInline:false,duration:2600});
    return notifications.feedback({id:'saved-plan-status',surfaceId:'saved-plan-status',surface:'inline',message,severity:ok?'info':'error',lifecycle:ok?'succeeded':'failed',retainInline:false,duration:2600});
  };
  const actionButton=(label,action,id,className='saved-plan-menu-action ui-btn ghost')=>{
    const button=document.createElement('button');button.type='button';button.className=className;button.textContent=label;button.dataset.savedPlan=action;if(id)button.dataset.savedPlanId=id;if(className.includes('saved-plan-menu-action'))button.setAttribute('role','menuitem');return button;
  };
  function render(selected=''){
    const panel=node('saved-plans-panel'),list=node('saved-plans-list');if(!panel||!list)return;
    const data=persistence.readLibrary();
    if(selected&&data.savedPlans.some(plan=>plan.id===selected))selectedId=selected;
    if(!data.savedPlans.some(plan=>plan.id===selectedId))selectedId=data.savedPlans[0]?.id||'';
    clearMenus();list.replaceChildren();
    if(!data.savedPlans.length){const empty=document.createElement('div');empty.className='saved-plans-empty ui-body';empty.textContent='No saved plans yet.';list.append(empty);}
    for(const plan of data.savedPlans){
      const item=document.createElement('div');item.className='saved-plan-item';item.setAttribute('role','listitem');item.dataset.savedPlanId=plan.id;
      const identity=document.createElement('div');identity.className='saved-plan-identity';
      const label=document.createElement('span');label.className='saved-plan-label';label.textContent=plan.label;label.title=plan.label;identity.append(label);
      if(plan.id===data.defaultId){const badge=document.createElement('span');badge.className='saved-plan-default ui-mono';badge.textContent='Default';identity.append(badge);}
      const actions=document.createElement('div');actions.className='saved-plan-item-actions';
      actions.append(actionButton('Load','load',plan.id,'saved-plan-load ui-btn secondary'));
      const trigger=document.createElement('button');trigger.type='button';trigger.className='saved-plan-menu-trigger ui-btn ghost';trigger.textContent='⋯';trigger.setAttribute('aria-label',`More actions for ${plan.label}`);trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
      const popup=document.createElement('div');popup.className='saved-plan-menu-popover';popup.setAttribute('role','menu');popup.setAttribute('aria-label',`Manage ${plan.label}`);
      popup.append(actionButton('Rename','rename',plan.id),actionButton('Update from Draft','update',plan.id));
      if(plan.id!==data.defaultId)popup.append(actionButton('Set as Default','default',plan.id));
      const separator=document.createElement('div');separator.className='saved-plan-menu-separator';separator.setAttribute('role','separator');
      popup.append(separator,actionButton('Delete','delete',plan.id,'saved-plan-menu-action ui-btn ghost danger'));
      const controller=ports.overlays.createAnchoredPopover(popup,{align:'end'});menuControllers.push({popup,controller});
      trigger.addEventListener('click',event=>{event.preventDefault();if(popup.hidden)controller.show(trigger);else controller.hide();});
      actions.append(trigger,popup);item.append(identity,actions);list.append(item);
    }
    node('saved-plans-count').textContent=String(data.savedPlans.length);
    syncAccess();
    if(!installed){installed=true;panel.addEventListener('click',event=>{const button=event.target.closest('[data-saved-plan]');if(!button)return;const popup=button.closest('.saved-plan-menu-popover');if(popup){const entry=menuControllers.find(item=>item.popup===popup);entry?.controller.hide();}void act(button.dataset.savedPlan,button.dataset.savedPlanId||'');});panel.addEventListener('toggle',()=>{if(!panel.open)for(const item of menuControllers)item.controller.hide();});}
  }
  async function act(action,planId=''){
    if(busy||!ownership.requirePrimary(null,'manage saved plans'))return false;
    busy=true;render(planId);
    operationNotice=notifications.begin({id:'saved-plan-operation',kind:action,surfaceId:'saved-plan-status',title:'Saved plans',message:'',announce:false});
    try{
      const library=persistence.readLibrary(),id=library.savedPlans.some(plan=>plan.id===planId)?planId:(library.savedPlans.some(plan=>plan.id===selectedId)?selectedId:library.savedPlans[0]?.id||''),selected=library.savedPlans.find(plan=>plan.id===id),draft=getPlanDraftText(),now=new Date().toISOString();
      selectedId=id;
      if(action==='load'){if(selected){const result=await loadScheduleIntoDraft(selected.scheduleText,{label:selected.label,allowIncomplete:true});status(result.ok?'Working copy loaded into Draft.':result.error==='cancelled'?'Current draft kept.':'Could not load the plan.',result.ok);}return true;}
      if(action==='save'){
        const name=node('saved-plan-name').value.trim();
        if(!name)throw new Error('Enter a name for the plan.');
        if(!draft.trim())throw new Error('Add something to the draft first.');
        if(library.savedPlans.length>=100)throw new Error('You have 100 saved plans. Delete one before saving another.');
        const next={id:'plan-'+crypto.randomUUID(),label:name,scheduleText:draft,createdAt:now,updatedAt:now};library.savedPlans.push(next);await persistence.writeLibrary(library);selectedId=next.id;status('Plan saved.');return true;
      }
      if(!selected)throw new Error('Choose a saved plan first.');
      if(action==='rename'){
        const answer=await requestInput({title:'Rename saved plan',inputLabel:'Plan name',defaultValue:selected.label,maxLength:80,required:true,confirmLabel:'Rename',cancelLabel:'Cancel'});
        if(!answer)return false;if(!ownership.requirePrimary(null,'rename a saved plan'))return false;
        const name=String(answer.value||'').trim();if(!name)throw new Error('Enter a name for the plan.');selected.label=name;selected.updatedAt=now;
      }else if(action==='delete'||action==='update'){
        const yes=await confirm({title:action==='delete'?'Delete saved plan?':'Update saved plan?',message:action==='delete'?`Delete “${selected.label}”? Your current draft and live plan will stay available.`:`Replace “${selected.label}” with the current draft?`,confirmLabel:action==='delete'?'Delete plan':'Update plan',cancelLabel:'Cancel'});
        if(!yes)return false;if(!ownership.requirePrimary(null,'change saved plans'))return false;
        if(action==='update'&&getPlanDraftText()!==draft)throw new Error('The draft changed while confirming. Review it and try again.');
        if(action==='update'){selected.scheduleText=draft;selected.updatedAt=now;}
        else{library.savedPlans=library.savedPlans.filter(plan=>plan.id!==id);if(library.defaultId===id)library.defaultId=null;selectedId='';}
      }else if(action==='default')library.defaultId=selected.id;
      else return false;
      await persistence.writeLibrary(library);status(action==='default'?'Default plan selected.':'Saved plans updated.');return true;
    }catch(error){status(error?.message||'Saved plans could not be updated.',false);return false;}
    finally{if(operationNotice?.read()?.lifecycle==='running')operationNotice.finish('cancelled','',{announce:false});operationNotice=null;busy=false;render(selectedId);}
  }
  return freeze({render,syncAccess,act});
})();
/* PLAN BOARD LIVE RENDERING */
function appendNowMarker(container,label){
  const m=document.createElement('div');
  m.className='now-marker ui-label';
  m.textContent=label||('NOW · '+clockHM());
  container.appendChild(m);
  return true;
}
function scheduleKindClass(t){
  const area=scheduleToken(taskAreaValue(t));
  if(isFixedBlock(t)&&area==='meal')return ' meal';
  if(isSupportBlock(t))return ' hobby';
  if(isFixedBlock(t))return ' rest';
  return '';
}
function scheduleRowClass(row,rt){
  const t=row.t,i=row.idx;
  let cls='si'+scheduleKindClass(t);
  if(i===scheduleGateway.read().currentIndex)cls+=' active';
  if(i===rt.scheduledIdx)cls+=' wall-now';
  if(scheduleGateway.row(i).done)cls+=' done';
  else if(scheduleGateway.row(i).skipped)cls+=' skipped';
  return cls;
}
function createScheduleRow(row,rt){
  const t=row.t,i=row.idx;
  const wrap=document.createElement('div');
  wrap.className=scheduleRowClass(row,rt);
  const tm=document.createElement('div');tm.className='si-time ui-mono';
  tm.append(document.createTextNode(studyMinuteToHHMM(row.startMin)),document.createElement('br'),document.createTextNode(studyMinuteToHHMM(row.endMin)));
  const trackable=isTrackableBlock(t);
  const card=document.createElement('div');card.className='si-card ui-card'+(!trackable?' no-hover':'');
  if(trackable){
    const rowState=scheduleGateway.row(i),done=rowState.done,skipped=rowState.skipped;
    const completionState=done?'complete':skipped?'skipped':'incomplete';
    const actionLabel=done?`Mark ${t.name} incomplete`:skipped?`Reopen skipped task ${t.name}`:`Mark ${t.name} complete`;
    const chk=document.createElement('button');chk.type='button';chk.className='si-chk ui-btn';chk.dataset.ownerMutation='plan-completion';chk.dataset.taskIndex=String(i);chk.dataset.completionState=completionState;chk.textContent=done?'✓':skipped?'×':'';
    chk.setAttribute('aria-label',actionLabel);chk.setAttribute('aria-pressed',done?'true':'false');chk.setAttribute('aria-description',`Current state: ${completionState}.`);chk.title=actionLabel;
    on(chk,'click',e=>{
      e.stopPropagation();if(!ownership.requirePrimary(e,'change plan completion'))return;
      const restoreFocus=document.activeElement===chk;
      scheduleGateway.act('toggle',i);
      if(restoreFocus)window.requestAnimationFrame(()=>{
        const control=[...document.querySelectorAll('.si-chk[data-task-index]')].find(candidate=>candidate.dataset.taskIndex===String(i));
        if(control)control.focus();
      });
    });card.appendChild(chk);
  }
  const info=document.createElement('div');info.className='si-info';
  const nm2=document.createElement('div');nm2.className='si-name ui-label';nm2.textContent=t.name;
  info.appendChild(nm2);
  const areaLabel=taskAreaValue(t);
  if(areaLabel){const rtg=document.createElement('div');rtg.className='si-area-tag ui-label ui-chip';rtg.textContent=areaLabel;info.appendChild(rtg);}
  if(scheduleGateway.row(i).adjusted){
    const layer=document.createElement('div');
    layer.className='schedule-layer-note ui-label';
    layer.append(
      textEl('span','adj',`ADJUSTED ${studyMinuteToHHMM(scheduleGateway.row(i).adjustedStartMin)}-${studyMinuteToHHMM(scheduleGateway.row(i).adjustedEndMin)}`),
      document.createTextNode(' · '),
      textEl('span','orig',`ORIGINAL ${studyMinuteToHHMM(scheduleGateway.row(i).originalStartMin)}-${studyMinuteToHHMM(scheduleGateway.row(i).originalEndMin)}`)
    );
    info.appendChild(layer);
  }
  if(i===rt.scheduledIdx){const wn=document.createElement('div');wn.className='wall-row-note ui-label';wn.textContent='WALL-CLOCK POSITION NOW';info.appendChild(wn);}
  if(hasOngoingTaskNotes(t)){
    const noteText=areaNoteTextForKey(taskAreaKey(t)).trim();
    if(noteText){
      const note=document.createElement('div');
      note.className='plan-note-snapshot ui-helper';
      note.textContent='Note: '+clampText(noteText,180);
      info.appendChild(note);
    }
  }
  const actualSeconds=scheduleGateway.row(i).actualTime;
  if(actualSeconds!==undefined){
    const at=document.createElement('div');
    at.className='actual-time-note ui-mono';
    const planned=t.dur*60;const diff=actualSeconds-planned;
    const sign=diff>0?'+':'-';
    const clk=scheduleGateway.row(i).actualClock||{};
    const wall=(clk.startedAt||clk.endedAt)?` · ${timeLabelFromIso(clk.startedAt)||'—'}-${timeLabelFromIso(clk.endedAt)||'—'}`:'';
    at.textContent=`ACTUAL: ${fmtS(actualSeconds)} (${sign}${fmtS(Math.abs(diff))})${wall}`;
    info.appendChild(at);
  }
  card.appendChild(info);
  const right=document.createElement('div');right.className='si-right';
  const dur=document.createElement('div');dur.className='si-dur ui-mono';dur.textContent=fmtDur(t.dur);
  right.appendChild(dur);
  card.appendChild(right);
  if(trackable){
    card.dataset.ownerMutation='plan-navigation';
    on(card,'click',event=>{if(!ownership.requirePrimary(event,'change the active timer block'))return;scheduleGateway.act('jump',i);});
  }
  wrap.appendChild(tm);wrap.appendChild(card);
  return wrap;
}
/* PLAN DRAFT STATE AND BOARD CONTROLS */
function draftTextFromRows(rows){
  return (Array.isArray(rows)?rows:[]).map(row=>[
    String(row&&row.start||''),
    row&&row.dur!==undefined?String(row.dur):'',
    String(row&&row.name||''),
    String(row&&row.kind||''),
    String(taskAreaValue(row)||''),
    String(taskMeasureValue(row,'')||''),
    row&&row.target!==null&&row.target!==undefined?String(row.target):''
  ].join(' | ')).join('\n');
}
function immutableDraftResult(result){
  const source=result&&typeof result==='object'?result:{};
  const parsed=freeze((Array.isArray(source.parsed)?source.parsed:[]).map(row=>freeze({...row})));
  const errors=freeze((Array.isArray(source.errors)?source.errors:[]).map(String));
  const warnings=freeze((Array.isArray(source.warnings)?source.warnings:[]).map(String));
  return freeze({
    ok:source.ok===true,kind:String(source.kind||'errors'),message:String(source.message||''),
    parsed,errors,warnings
  });
}
function isIncompleteDraftResult(draft,hasRows){
  if(!hasRows||draft.ok||draft.kind!=='errors'||!draft.errors.length)return false;
  return draft.errors.every(message=>/missing task name|missing area|bad duration ""|bad kind ""/i.test(message));
}
function firstActionableDraftError(draft){
  if(draft.ok)return '';
  if(!draft.errors.length)return draft.message;
  return `${draft.kind==='timeline'?'⚠ Timeline error:':'⚠ Error:'} ${draft.errors[0]}`;
}
function createPlanDraftProjection(result=null){
  const draft=immutableDraftResult(result||parseScheduleDraftText(getPlanDraftText()));
  const hasApplied=TASKS.length>0,editMode=PlanDraftEditor.active(),hasRows=draft.ok?draft.parsed.length>0:lastParsed.length>0;
  const status=draft.ok?'valid':draft.kind==='empty'||draft.kind==='no-tasks'?'empty':isIncompleteDraftResult(draft,hasRows)?'incomplete':'invalid';
  const changed=draft.ok&&draft.parsed.length>0&&(!hasApplied||scheduleFingerprintForRows(draft.parsed)!==scheduleGateway.read().fingerprint);
  let boardMode='empty',boardLabel='EMPTY',boardCaption='Paste or load a schedule to build the board.';
  if(status==='invalid'){
    boardMode='invalid';boardLabel='DRAFT INVALID';boardCaption='Fix the schedule text before Apply.';
  }else if(status==='incomplete'){
    boardMode='invalid';boardLabel='INCOMPLETE ROW';boardCaption='Complete Task, Minutes, Kind and Area before applying.';
  }else if(editMode&&hasApplied&&changed){
    boardMode='draft';boardLabel='EDITING DRAFT';boardCaption='Review your changes, then apply them with Done.';
  }else if(editMode&&hasApplied){
    boardMode='draft';boardLabel='EDITING PLAN';boardCaption='Review or edit today’s blocks, then apply the plan.';
  }else if(changed){
    boardMode='draft';boardLabel='DRAFT READY';boardCaption='Review or edit today’s blocks, then apply the plan.';
  }else if(hasApplied){
    boardMode='live';boardLabel='LIVE';boardCaption='Applied plan. Timing and completion update here.';
  }
  const canMutate=ownership.canMutate(),draftSurfaceOpen=editMode||!hasApplied;
  const controls=freeze({
    showEdit:hasApplied&&!editMode,editEnabled:canMutate,
    showDone:hasRows&&draftSurfaceOpen,doneEnabled:canMutate&&status==='valid',
    showCancel:hasApplied&&editMode,cancelEnabled:canMutate,
    applyEnabled:canMutate&&status==='valid',editLabel:changed?'Edit Draft':'Edit Plan',doneLabel:hasApplied?'Done':'Apply Draft'
  });
  return freeze({
    format:'study-director.plan-draft-projection',contractVersion:1,status,changed,editMode,
    board:freeze({mode:boardMode,label:boardLabel,caption:boardCaption}),
    firstActionableError:firstActionableDraftError(draft),warnings:draft.warnings,
    warningText:scheduleWarningsMessage(draft.warnings),ownershipAvailable:canMutate,controls,draft
  });
}
function setParsedScheduleDraft(rows){
  lastParsed=Array.isArray(rows)?rows.map(row=>({...row})):[];
  scheduleGateway.setAnchor(lastParsed.length?clockMinuteToStudyMinute(t2m(lastParsed[0].start)):0);
}
function keepAppliedScheduleOnReapply(parsed,rawOriginal,options={}){
  setParsedScheduleDraft(parsed);
  PlanDraftEditor.deactivate();
  lastAppliedScheduleText=String(rawOriginal||scheduleTextFromRows(lastParsed)||'');
  PlanDraftEditor.save();
  setPlanComposerOpen(false);
  scheduleGateway.reconcile(options.source||'schedule-reapply');
  renderSched();
  if(scheduleGateway.hasLiveState())scheduleGateway.flush();
  const source=options&&options.source;
  const message=source==='plan-board-edit'
    ? 'Plan unchanged. Live progress kept.'
    : 'Schedule already applied. Live progress kept.';
  setPlanStatus(message);
  scheduleGateway.clearSafety('New study day');
  return true;
}
function setPlanComposerOpen(open){
  const composer=document.querySelector('.plan-composer');
  if(composer)composer.open=!!open;
}
function setPlanStatus(message,tone=true){
  return notifications.feedback({id:'plan-status',surfaceId:'plan-status',surface:'inline',foreground:false,cue:'none',severity:tone==='warn'?'warning':tone?'info':'error',lifecycle:message?(tone==='cancelled'?'cancelled':tone?'succeeded':'failed'):'resolved',message:clampText(message,APP_LIMITS.maxStatusMessageChars)});
}

function updatePlanBoardControls(projection=createPlanDraftProjection()){
  const edit=document.getElementById('plan-edit-btn');
  const done=document.getElementById('plan-done-edit-btn');
  const cancel=document.getElementById('plan-cancel-edit-btn');
  const controls=projection.controls;
  if(edit){
    edit.hidden=!controls.showEdit;
    edit.disabled=!controls.editEnabled;
    edit.textContent=controls.editLabel;
  }
  if(done){
    done.hidden=!controls.showDone;
    done.disabled=!controls.doneEnabled;
    done.textContent=controls.doneLabel;
  }
  if(cancel){
    cancel.hidden=!controls.showCancel;
    cancel.disabled=!controls.cancelEnabled;
    cancel.textContent='Cancel';
  }
  const apply=document.querySelector('button[data-action="apply-schedule"]');
  if(apply)apply.disabled=!controls.applyEnabled;
}
function updatePlanBoardState(projection=createPlanDraftProjection()){
  const board=document.getElementById('plan-board');
  const state=document.getElementById('plan-board-state');
  const cap=document.getElementById('plan-board-caption');
  if(board)board.dataset.mode=projection.board.mode;
  if(state)state.textContent=projection.board.label;
  if(cap)cap.textContent=projection.board.caption;
  updatePlanBoardControls(projection);
  return projection;
}
/* PLAN BOARD RENDER ORCHESTRATION */
function renderSched(projection=null){
  const el=document.getElementById('sched-list');el.replaceChildren();
  if(PlanDraftEditor.active()||!TASKS.length){
    PlanDraftEditor.renderRows(el);
    scheduleGateway.markRender('clean');
    updatePlanBoardState(projection||createPlanDraftProjection());
    updateRealTimeAwareness(null,{force:true});
    return;
  }
  const board=scheduleGateway.timeline();
  const rows=board.rows;
  const rt=board.realtime;
  let markerPlaced=false;
  if(rt.scheduledIdx===null && rt.nowEff<(rt.first??0))markerPlaced=appendNowMarker(el,'NOW · BEFORE FIRST BLOCK');
  rows.forEach(row=>{
    if(rt.scheduledIdx===row.idx)markerPlaced=appendNowMarker(el,'NOW · '+clockHM());
    el.appendChild(createScheduleRow(row,rt));
  });
  if(!markerPlaced && rt.scheduledIdx===null)appendNowMarker(el,'NOW · AFTER FINAL BLOCK');
  lastScheduleNowMinuteKey=`${rt.scheduledIdx}:${rt.nowEff}`;
  scheduleGateway.markRender('clean');
  updatePlanBoardState(projection||createPlanDraftProjection());
  updateRealTimeAwareness(rt,{force:true});
}
/* PLAN APPLY AND PREVIEW PIPELINE */
function renderInvalidScheduleApply(projection){
  lastParsed=[];
  renderSched(projection);
  setPlanComposerOpen(true);
  setPlanStatus(projection.firstActionableError||'Fix the schedule before applying.',false);
}
function closeActiveBreakForScheduleChange(){
  if(!scheduleGateway.breakState())return true;
  return confirm({
    title:'End the current break?',
    message:'The revised Plan can be applied after the active timer break ends.',
    details:['Choose Keep break to return to Execute without changing the live Plan.'],
    confirmLabel:'End break and continue',cancelLabel:'Keep break'
  }).then(ok=>{if(ok)scheduleGateway.breakState('end');return ok;});
}
function confirmScheduleChangeWillMigrateProgress(newRows){
  if(!scheduleGateway.hasLiveState())return null;
  const snapshot=scheduleGateway.captureMigration(newRows||[]);
  const matched=snapshot.preview?snapshot.preview.matched:0;
  const total=snapshot.preview?snapshot.preview.total:0;
  const practiceTotal=snapshot.preview?snapshot.preview.practiceTotal:0;
  const practiceMatched=snapshot.preview?snapshot.preview.practiceMatched:0;
  const details=[`${matched}/${total} current progress entries match the revised Plan.`];
  if(practiceTotal)details.push(`${practiceMatched}/${practiceTotal} Practice Pacer links match.`);
  details.push('Removed or renamed unmatched blocks will no longer appear in today’s Review.','Ongoing Area notes remain separate and are preserved.');
  return confirm({
    title:'Replace today’s live Plan?',
    message:'Study Director will carry forward progress only where the block identity still matches.',
    details,confirmLabel:'Replace Plan',cancelLabel:'Keep current Plan'
  }).then(ok=>{
    if(!ok)setPlanStatus('Schedule change cancelled. Current tracking progress was kept.','cancelled');
    return ok?snapshot:false;
  });
}
function prepareScheduleApply(parsed,rawOriginal,opts){
  const hasApplied=TASKS.length>0;
  const scheduleChanged=hasApplied&&scheduleFingerprintForRows(parsed)!==scheduleGateway.read().fingerprint;
  if(hasApplied&&!scheduleChanged&&scheduleGateway.hasLiveState()&&!opts.forceReload&&!opts.reviewOnly){
    return {handled:true,result:keepAppliedScheduleOnReapply(parsed,rawOriginal,opts),scheduleChanged:false,progressMigration:null};
  }
  if(!scheduleChanged)return {handled:false,cancelled:false,scheduleChanged:false,progressMigration:null};
  const finish=()=>{
    const progressMigration=confirmScheduleChangeWillMigrateProgress(parsed);
    if(progressMigration&&typeof progressMigration.then==='function')return progressMigration.then(value=>value===false?{cancelled:true}:{handled:false,cancelled:false,scheduleChanged:true,progressMigration:value});
    return progressMigration===false?{cancelled:true}:{handled:false,cancelled:false,scheduleChanged:true,progressMigration};
  };
  const breakDecision=closeActiveBreakForScheduleChange();
  if(breakDecision&&typeof breakDecision.then==='function')return breakDecision.then(ok=>ok?finish():{cancelled:true});
  return breakDecision?finish():{cancelled:true};
}
function appliedScheduleStatus(parsed,draft,opts,migrationSummary){
  const migrationParts=[];
  if(migrationSummary&&migrationSummary.total)migrationParts.push(`${migrationSummary.matched}/${migrationSummary.total} progress entries`);
  if(migrationSummary&&migrationSummary.practiceTotal)migrationParts.push(`${migrationSummary.practiceMatched}/${migrationSummary.practiceTotal} Pacer links`);
  const migrationText=migrationParts.length?` · preserved ${migrationParts.join(' · ')}`:'';
  const warningText=scheduleWarningsMessage(draft.warnings);
  const baseStatus=opts.source==='active-session-restore'
    ? '✓ Restored today’s active session — ' + parsed.filter(isWorkBlock).length + ' work blocks'
    : opts.source==='previous-session-review'
    ? '✓ Recovered previous study day for Review — ' + parsed.filter(isWorkBlock).length + ' work blocks'
    : opts.source==='ownership-takeover'
    ? '✓ Reloaded the latest session after ownership transfer'
    : opts.source==='plan-board-edit'
    ? '✓ Plan edit applied — ' + parsed.filter(isWorkBlock).length + ' work blocks' + migrationText
    : '✓ Schedule loaded — ' + parsed.filter(isWorkBlock).length + ' work blocks' + migrationText + ' · switch to Execute tab';
  return {text:warningText?baseStatus+' · '+warningText:baseStatus,state:warningText?'warn':true};
}
function completeScheduleApply(preparation,parsed,rawOriginal,opts,draft){
  if(preparation.handled)return preparation.result;
  if(preparation.cancelled)return false;
  setParsedScheduleDraft(parsed);
  PlanDraftEditor.deactivate();
  const applyResult=scheduleGateway.apply(lastParsed,{
    appliedScheduleText:rawOriginal,studyDate:opts.studyDate,source:opts.source,
    progressMigration:preparation.progressMigration,reviewOnly:!!opts.reviewOnly,
    sessionSnapshot:opts.sessionSnapshot||null,lifecycleManaged:!!opts.lifecycleManaged
  });
  renderSched();
  setPlanComposerOpen(false);
  const status=appliedScheduleStatus(parsed,draft,opts,applyResult&&applyResult.migrationSummary);
  setPlanStatus(status.text,status.state);
  scheduleGateway.clearSafety('New study day');
  return true;
}
function applySchedule(options={}){
  const opts=options&&typeof options==='object'?options:{};
  const rawOriginal=String(document.getElementById('plan-input')?.value||'');
  const projection=opts.projection&&opts.projection.format==='study-director.plan-draft-projection'
    ?opts.projection:createPlanDraftProjection(parseScheduleDraftText(rawOriginal));
  PlanDraftEditor.save();
  if(projection.status!=='valid'){renderInvalidScheduleApply(projection);return false;}
  const draft=projection.draft,parsed=draft.parsed;
  const preparation=prepareScheduleApply(parsed,rawOriginal,opts);
  if(preparation&&typeof preparation.then==='function')return preparation.then(result=>completeScheduleApply(result,parsed,rawOriginal,opts,draft));
  return completeScheduleApply(preparation,parsed,rawOriginal,opts,draft);
}

const PlanDraftEditor=(()=>{
  const SAVE_DELAY_MS=300;
  const PREVIEW_DELAY_MS=220;
  let draftMode=false;
  let draftDragIndex=null;
  let draftSaveTimer=null;
  let draftPreviewTimer=null;
  let pendingPreviewProjection=null;
  let draftSaveWarningActive=false;

  function active(){return draftMode;}
  function deactivate(){draftMode=false;clearDragState();return false;}
  function boundDraftInput(){
    const input=document.getElementById('plan-input');
    if(!input)return null;
    const bounded=clampText(input.value,APP_LIMITS.maxScheduleChars);
    if(input.value!==bounded)input.value=bounded;
    return input;
  }
  function clearTimer(name){
    const timer=name==='preview'?draftPreviewTimer:draftSaveTimer;
    if(timer)clearTimeout(timer);
    if(name==='preview')draftPreviewTimer=null;else draftSaveTimer=null;
  }
  async function persistNow(options={}){
    if(!ownership.canMutate())return false;
    let ok=false,error=null;
    try{
      const input=boundDraftInput();
      if(!input)return false;
      ok=await persistence.writeDraft(input.value,options);
      if(!ok)error=persistence.lastError()||new Error('Browser storage is unavailable.');
    }catch(e){error=e;ok=false;}
    persistence.reportDraftResult(ok,error);
    if(!ok){
      draftSaveWarningActive=true;
      setPlanStatus(`Draft not saved — browser storage is unavailable${error&&error.message?`: ${error.message}`:''}. Keep this tab open and copy the draft before closing.`,false);
    }else if(draftSaveWarningActive){
      draftSaveWarningActive=false;
      const projection=createPlanDraftProjection();
      setPlanStatus(projection.status==='valid'?'Draft saved in this browser. Review it, then Apply.':'Draft storage recovered. Fix the schedule before applying.',projection.status==='valid');
    }
    return ok;
  }
  function save(options={}){
    if(!ownership.canMutate())return false;
    clearTimer('save');
    return persistNow(options);
  }
  function queueSave(delay=SAVE_DELAY_MS){
    if(!ownership.canMutate())return false;
    clearTimer('save');
    draftSaveTimer=setTimeout(()=>{draftSaveTimer=null;persistNow();},Math.max(0,Number(delay)||SAVE_DELAY_MS));
    return true;
  }
  function flush(options={}){return draftSaveTimer?save(options):true;}
  function cloneAppliedRow(t){
    return makeScheduleRow({
      start:t&&t.start||'00:00',
      dur:positiveMinutes(t&&t.dur)||1,
      name:t&&t.name||'Task',
      kind:t&&t.kind||'work',
      area:taskAreaValue(t),
      measure:taskMeasureValue(t,''),
      target:taskTargetValue(t)
    });
  }
  function syncFromApplied(){
    if(!TASKS.length)return false;
    setParsedScheduleDraft(TASKS.map(cloneAppliedRow));
    const input=document.getElementById('plan-input');
    if(input)input.value=lastAppliedScheduleText||scheduleTextFromRows(lastParsed);
    save();
    return true;
  }
  function enter(){
    if(!lastParsed.length&&TASKS.length)syncFromApplied();
    draftMode=true;
    renderSched();
  }
  function confirm(){
    if(!lastParsed.length)return false;
    const input=document.getElementById('plan-input');
    if(input)input.value=draftTextFromRows(lastParsed);
    const projection=createPlanDraftProjection();
    if(projection.status!=='valid'){
      updatePlanBoardState(projection);
      setPlanStatus(projection.firstActionableError||'Complete every required field before applying.',false);
      return false;
    }
    save();
    return applySchedule({skipNotify:true,source:'plan-board-edit',projection});
  }
  function cancel(){
    if(TASKS.length)syncFromApplied();
    deactivate();
    setPlanComposerOpen(false);
    renderSched();
    setPlanStatus('Edit cancelled. Live plan kept.','cancelled');
  }
  function preview(options={}){
    const opts=options&&typeof options==='object'?options:{};
    clearTimer('preview');
    const supplied=opts.projection&&opts.projection.format==='study-director.plan-draft-projection'?opts.projection:null;
    if(opts.enterDraft||!TASKS.length)draftMode=true;
    const projection=supplied||createPlanDraftProjection();
    pendingPreviewProjection=null;
    if(projection.status!=='valid'){
      lastParsed=[];
      renderSched(projection);
      setPlanStatus(projection.firstActionableError||'Fix the schedule before applying.',false);
      return false;
    }
    setParsedScheduleDraft(projection.draft.parsed);
    renderSched(projection);
    if(!opts.silent){
      setPlanStatus(`Draft ready — ${lastParsed.filter(isWorkBlock).length} work blocks. Reorder if needed, then Apply.${projection.warningText?' · '+projection.warningText:''}`,projection.warningText?'warn':true);
    }
    return true;
  }
  function composerInput(){
    if(!ownership.canMutate())return false;
    if(!boundDraftInput())return false;
    queueSave();
    draftMode=true;
    pendingPreviewProjection=createPlanDraftProjection();
    updatePlanBoardControls(pendingPreviewProjection);
    clearTimer('preview');
    draftPreviewTimer=setTimeout(()=>{
      draftPreviewTimer=null;
      const projection=pendingPreviewProjection;
      preview({silent:true,projection});
    },PREVIEW_DELAY_MS);
    return true;
  }
  function syncTextFromRows(){
    const input=document.getElementById('plan-input');
    if(input)input.value=draftTextFromRows(lastParsed);
    queueSave();
  }
  function reflowTimesFrom(startIdx=0){
    if(!lastParsed.length)return;
    const idx=Math.max(0,Math.min(Number(startIdx)||0,lastParsed.length-1));
    if(!isValidHHMM(lastParsed[idx].start))return;
    let m=clockMinuteToStudyMinute(t2m(lastParsed[idx].start));
    for(let i=idx;i<lastParsed.length;i++){
      lastParsed[i].start=studyMinuteToHHMM(m);
      const duration=positiveMinutes(lastParsed[i].dur);
      if(!duration)break;
      m+=duration;
    }
    if(idx===0)scheduleGateway.setAnchor(clockMinuteToStudyMinute(t2m(lastParsed[0].start)));
  }
  function rowClass(t){return 'si draft'+scheduleKindClass(t);}
  function refreshRowVisual(idx){
    const row=lastParsed[idx];
    const wrap=[...document.querySelectorAll('.si.draft[data-draft-idx]')].find(candidate=>candidate.dataset.draftIdx===String(idx))||null;
    if(!row||!wrap)return;
    const start=clockMinuteToStudyMinute(t2m(row.start));
    const timeEl=wrap.querySelector('.si-time');
    const duration=positiveMinutes(row.dur);
    if(timeEl)timeEl.replaceChildren(document.createTextNode(studyMinuteToHHMM(start)),document.createElement('br'),document.createTextNode(duration?studyMinuteToHHMM(start+duration):'—'));
    const nameEl=wrap.querySelector('.si-name');
    if(nameEl)nameEl.textContent=row.name||'Untitled block';
    const areaEl=wrap.querySelector('.si-area-tag');
    if(areaEl)areaEl.textContent=taskAreaValue(row)||'Area required';
    const kindEl=wrap.querySelector('.plan-kind-tag');
    if(kindEl)kindEl.textContent=row.kind?row.kind.toUpperCase():'CHOOSE KIND';
    const durEl=wrap.querySelector('.si-dur');
    if(durEl)durEl.textContent=positiveMinutes(row.dur)?fmtDur(positiveMinutes(row.dur)):'—';
    const wasDragging=wrap.classList.contains('dragging');
    const wasOver=wrap.classList.contains('drag-over');
    wrap.className=rowClass(row);
    if(wasDragging)wrap.classList.add('dragging');
    if(wasOver)wrap.classList.add('drag-over');
  }
  function refreshVisualsFrom(startIdx=0){
    for(let i=Math.max(0,Number(startIdx)||0);i<lastParsed.length;i++)refreshRowVisual(i);
  }
  function normalizeFieldValue(key,value,current){
    const raw=String(value??'').trim();
    if(key==='start')return isValidHHMM(raw)?normalizeHHMM(raw):raw;
    if(key==='dur'){
      const n=Number(raw);
      return raw!==''&&Number.isFinite(n)&&Number.isInteger(n)&&n>0&&n<=APP_LIMITS.maxDurationMinutes?n:raw;
    }
    if(key==='target')return normalizeScheduleTarget(raw);
    if(key==='kind')return ['work','support','fixed'].includes(raw)?raw:'';
    if(key==='name')return clampText(raw,APP_LIMITS.maxTaskNameChars);
    if(key==='area')return clampText(raw,APP_LIMITS.maxAreaNameChars);
    if(key==='measure')return clampText(raw,APP_LIMITS.maxUnitChars);
    return raw;
  }
  function setField(idx,key,value){
    const row=lastParsed[idx];
    if(!row)return;
    row[key]=normalizeFieldValue(key,value,row);
    if((key==='start'&&isValidHHMM(row.start))||(key==='dur'&&positiveMinutes(row.dur)))reflowTimesFrom(idx);
    syncTextFromRows();
    refreshVisualsFrom(idx);
    updatePlanBoardState();
  }
  function fieldAccessibleLabel(key,idx){
    const blockNumber=Number.isInteger(idx)?idx+1:1;
    const labels={name:'task name',start:'start time',dur:'duration in minutes',kind:'kind',area:'area',measure:'measure',target:'target'};
    return `Block ${blockNumber} ${labels[key]||key}`;
  }
  function input(key,value,label,type='text',idx=null){
    const control=document.createElement('input');
    control.className='plan-draft-field ui-field ui-mono '+key;
    control.dataset.draftField=key;
    control.type=type==='name'?'text':type;
    control.value=value??'';
    control.placeholder=label;
    control.setAttribute('aria-label',fieldAccessibleLabel(key,idx));
    if(type==='number'){control.min=key==='dur'?'1':'0';control.step='1';control.inputMode='numeric';}
    return control;
  }
  function select(key,value,idx=null){
    const control=document.createElement('select');
    control.className='plan-draft-field ui-field ui-mono '+key;
    control.dataset.draftField=key;
    control.setAttribute('aria-label',fieldAccessibleLabel(key,idx));
    const placeholder=document.createElement('option');
    placeholder.value='';placeholder.textContent='CHOOSE KIND';placeholder.disabled=true;
    if(!value)placeholder.selected=true;
    control.appendChild(placeholder);
    ['work','support','fixed'].forEach(kind=>{
      const option=document.createElement('option');
      option.value=kind;
      option.textContent=kind.toUpperCase();
      if(kind===value)option.selected=true;
      control.appendChild(option);
    });
    return control;
  }
  function coarseTarget(control,className){
    const coarse=window.matchMedia&&window.matchMedia('(hover:none) and (pointer:coarse)').matches;
    if(!coarse)return control;
    const target=document.createElement('label');
    target.className=className;
    target.appendChild(control);
    return target;
  }
  function rowFromTarget(target,container){
    const row=target&&target.closest&&target.closest('.si.draft[data-draft-idx]');
    return row&&container.contains(row)?row:null;
  }
  function rowIndex(row){
    const idx=Number(row&&row.dataset.draftIdx);
    return Number.isInteger(idx)?idx:null;
  }
  function clearDragState(row=null){
    if(row)row.classList.remove('dragging','drag-over');
    document.querySelectorAll('.si.draft.dragging,.si.draft.drag-over').forEach(el=>el.classList.remove('dragging','drag-over'));
    draftDragIndex=null;
  }
  function dragStart(ev,row,idx){
    draftDragIndex=idx;
    row.classList.add('dragging');
    if(ev.dataTransfer){
      ev.dataTransfer.effectAllowed='move';
      ev.dataTransfer.setData('text/plain',String(idx));
    }
  }
  function dragOver(ev,row){
    ev.preventDefault();
    row.classList.add('drag-over');
    if(ev.dataTransfer)ev.dataTransfer.dropEffect='move';
  }
  function dragLeave(ev,row){
    if(ev.relatedTarget&&row.contains(ev.relatedTarget))return;
    row.classList.remove('drag-over');
  }
  function drop(ev,row,targetIdx){
    ev.preventDefault();
    row.classList.remove('drag-over');
    const transferred=Number(ev.dataTransfer&&ev.dataTransfer.getData('text/plain'));
    const from=draftDragIndex!==null?draftDragIndex:transferred;
    if(Number.isInteger(from)&&from!==targetIdx)moveRow(from,targetIdx);
  }
  function recalcTimes(){
    let m=lastParsed.length&&isValidHHMM(lastParsed[0].start)?clockMinuteToStudyMinute(t2m(lastParsed[0].start)):scheduleGateway.read().anchor;
    lastParsed.forEach(row=>{row.start=studyMinuteToHHMM(m);const duration=positiveMinutes(row.dur);if(duration)m+=duration;});
    if(lastParsed.length)scheduleGateway.setAnchor(clockMinuteToStudyMinute(t2m(lastParsed[0].start)));
  }
  function commitRows(message,ok=true){
    syncTextFromRows();
    renderSched();
    if(message)setPlanStatus(message,ok);
  }
  function moveRow(from,to){
    if(from<0||to<0||from>=lastParsed.length||to>=lastParsed.length||from===to)return false;
    const [row]=lastParsed.splice(from,1);
    lastParsed.splice(to,0,row);
    recalcTimes();
    commitRows('Draft reordered in scheduler. Press Done to apply.');
    return true;
  }
  function defaultRowAfter(row){
    const baseStart=row&&isValidHHMM(row.start)?clockMinuteToStudyMinute(t2m(row.start)):clockMinuteToStudyMinute(getMinuteOfDay());
    const start=studyMinuteToHHMM(baseStart+(row?positiveMinutes(row.dur):0));
    return {start,dur:'',name:'',kind:'',area:'',measure:'',target:null};
  }
  function insertRowAfter(idx){
    const safeIdx=Number.isInteger(idx)?idx:lastParsed.length-1;
    const base=lastParsed[safeIdx]||lastParsed[lastParsed.length-1]||null;
    const insertAt=lastParsed.length?Math.max(0,Math.min(safeIdx+1,lastParsed.length)):0;
    const row=defaultRowAfter(base);
    lastParsed.splice(insertAt,0,row);
    if(insertAt===0)scheduleGateway.setAnchor(clockMinuteToStudyMinute(t2m(row.start)));
    commitRows('Blank row added. Complete Task, Minutes, Kind and Area before applying.','warn');
    return true;
  }
  function removeRow(idx){
    if(idx<0||idx>=lastParsed.length)return false;
    const removed=lastParsed[idx];
    const removedStart=clockMinuteToStudyMinute(t2m(removed&&removed.start));
    lastParsed.splice(idx,1);
    if(lastParsed.length){
      if(idx===0)lastParsed[0].start=studyMinuteToHHMM(removedStart);
      recalcTimes();
    }
    commitRows(lastParsed.length?'Draft row removed. Press Done to apply changes.':'All draft rows removed. Add a row or paste a schedule in Composer.');
    return true;
  }
  function createRow(t,idx){
    const start=clockMinuteToStudyMinute(t2m(t.start));
    const duration=positiveMinutes(t.dur);
    const wrap=document.createElement('div');
    wrap.className=rowClass(t);
    const touchPrimary=window.matchMedia&&window.matchMedia('(hover:none) and (pointer:coarse)').matches;
    wrap.draggable=!touchPrimary;
    wrap.dataset.draftIdx=String(idx);
    const time=document.createElement('div');
    time.className='si-time ui-mono';
    time.append(document.createTextNode(studyMinuteToHHMM(start)),document.createElement('br'),document.createTextNode(duration?studyMinuteToHHMM(start+duration):'—'));
    const card=document.createElement('div');
    card.className='si-card ui-card no-hover';
    const drag=document.createElement('div');
    drag.className='plan-drag-handle ui-label';
    drag.title=touchPrimary?'Use the arrow buttons below to reorder':'Drag to reorder';
    drag.textContent='↕';
    card.appendChild(drag);
    const info=document.createElement('div');
    info.className='si-info';
    info.appendChild(textEl('div','si-name ui-label',t.name||'Untitled block'));
    const areaLabel=taskAreaValue(t);
    if(areaLabel)info.appendChild(textEl('div','si-area-tag ui-label ui-chip',areaLabel));
    info.appendChild(textEl('div','plan-kind-tag ui-label ui-chip',t.kind?t.kind.toUpperCase():'CHOOSE KIND'));
    const fields=document.createElement('div');
    fields.className='plan-draft-fields';
    fields.append(
      input('name',t.name,'Task','text',idx),
      input('start',t.start,'Start','time',idx),
      input('dur',String(t.dur),'Min','number',idx),
      coarseTarget(select('kind',t.kind||'',idx),'plan-kind-touch-target'),
      input('area',taskAreaValue(t),'Area','text',idx),
      input('measure',taskMeasureValue(t,''),'Measure','text',idx),
      input('target',taskTargetValue(t)??'','Target','number',idx)
    );
    info.appendChild(fields);
    const actions=document.createElement('div');
    actions.className='plan-draft-row-actions';
    const action=(name,label,title,className='plan-draft-action ui-btn')=>{
      const button=document.createElement('button');
      button.type='button';button.className=className;button.title=title;button.dataset.draftAction=name;button.textContent=label;
      return button;
    };
    const up=action('up','↑','Move this block up','plan-draft-action reorder ui-btn');
    up.disabled=idx===0;
    const down=action('down','↓','Move this block down','plan-draft-action reorder ui-btn');
    down.disabled=idx===lastParsed.length-1;
    actions.append(up,down,action('add','+','Add row after this block'),action('remove','-','Remove this draft row','plan-draft-action danger ui-btn'));
    info.appendChild(actions);
    card.appendChild(info);
    const right=document.createElement('div');
    right.className='si-right';
    right.appendChild(textEl('div','si-dur ui-mono',duration?fmtDur(duration):'—'));
    card.appendChild(right);
    wrap.append(time,card);
    return wrap;
  }
  function renderRows(container){
    if(!lastParsed.length){
      const message=TASKS.length?'Open Composer or use Edit Plan to revise the schedule.':'No draft rows yet. Use Composer to load or paste a schedule.';
      container.appendChild(textEl('div','plan-empty-message ui-mono',message));
      const actions=document.createElement('div');
      actions.className='plan-draft-empty-actions';
      const add=document.createElement('button');
      add.type='button';add.className='plan-board-btn ui-btn';add.dataset.draftAction='add';add.textContent='Add Row';
      actions.appendChild(add);container.appendChild(actions);return;
    }
    lastParsed.forEach((row,idx)=>container.appendChild(createRow(row,idx)));
  }
  function install(){
    const container=document.getElementById('sched-list');
    if(!container||container.dataset.draftDelegation==='1')return false;
    container.dataset.draftDelegation='1';
    container.addEventListener('input',ev=>{
      const field=ev.target.closest&&ev.target.closest('[data-draft-field]');
      if(!field||field.tagName==='SELECT')return;
      const row=rowFromTarget(field,container),idx=rowIndex(row);
      if(idx===null)return;
      if(!ownership.requirePrimary(ev,'edit the plan draft')){renderSched();return;}
      setField(idx,field.dataset.draftField,field.value);
    });
    container.addEventListener('change',ev=>{
      const field=ev.target.closest&&ev.target.closest('select[data-draft-field]');
      if(!field)return;
      const row=rowFromTarget(field,container),idx=rowIndex(row);
      if(idx===null)return;
      if(!ownership.requirePrimary(ev,'edit the plan draft')){renderSched();return;}
      setField(idx,field.dataset.draftField,field.value);
      renderSched();
    });
    container.addEventListener('focusout',ev=>{
      if(!ev.target.matches||!ev.target.matches('[data-draft-field]'))return;
      requestAnimationFrame(()=>{if(container.isConnected)renderSched();});
    });
    container.addEventListener('click',ev=>{
      const field=ev.target.closest&&ev.target.closest('[data-draft-field]');
      if(field){ev.stopPropagation();return;}
      const target=ev.target.closest&&ev.target.closest('[data-draft-action]');
      if(!target||!container.contains(target))return;
      ev.preventDefault();ev.stopPropagation();
      if(!ownership.requirePrimary(ev,'edit the plan draft'))return;
      const row=rowFromTarget(target,container);
      const idx=row?rowIndex(row):-1;
      if(target.dataset.draftAction==='add')insertRowAfter(idx===null?-1:idx);
      else if(target.dataset.draftAction==='remove'&&idx!==null)removeRow(idx);
      else if(target.dataset.draftAction==='up'&&Number.isInteger(idx)&&idx>0)moveRow(idx,idx-1);
      else if(target.dataset.draftAction==='down'&&Number.isInteger(idx)&&idx>=0&&idx<lastParsed.length-1)moveRow(idx,idx+1);
    });
    container.addEventListener('dragstart',ev=>{
      if(ev.target.closest&&ev.target.closest('[data-draft-field]')){ev.preventDefault();return;}
      const row=rowFromTarget(ev.target,container),idx=rowIndex(row);
      if(!row||idx===null)return;
      if(!ownership.requirePrimary(ev,'reorder the plan draft'))return;
      dragStart(ev,row,idx);
    });
    container.addEventListener('dragover',ev=>{const row=rowFromTarget(ev.target,container);if(row)dragOver(ev,row);});
    container.addEventListener('dragleave',ev=>{const row=rowFromTarget(ev.target,container);if(row)dragLeave(ev,row);});
    container.addEventListener('drop',ev=>{const row=rowFromTarget(ev.target,container),idx=rowIndex(row);if(row&&idx!==null)drop(ev,row,idx);});
    container.addEventListener('dragend',ev=>clearDragState(rowFromTarget(ev.target,container)));
    return true;
  }
  async function clear(){
    if(!ownership.requirePrimary(null,'clear the plan draft'))return false;
    clearTimer('save');clearTimer('preview');pendingPreviewProjection=null;clearDragState();
    const input=document.getElementById('plan-input');if(input)input.value='';lastParsed=[];draftMode=true;renderSched();
    const ok=await save();if(ok&&input?.value==='')setPlanStatus('Draft cleared. Use Load Default or paste a new schedule.');return ok;
  }
  function reset(){
    clearTimer('preview');clearDragState();
    pendingPreviewProjection=null;
    draftMode=false;
    setParsedScheduleDraft([]);
  }
  return Object.freeze({active,deactivate,enter,confirm,cancel,preview,composerInput,renderRows,save,flush,clear,reset,install});
})();

    function isPlanPaneVisible(){return !!document.getElementById('pane-plan')?.classList.contains('on');}
    function markScheduleRenderDirty(){scheduleGateway.markRender('dirty');}
    function renderScheduleIfVisible(){if(!isPlanPaneVisible()){markScheduleRenderDirty();return false;}renderSched();return true;}
    function renderScheduleOnPlanOpen(){
      const state=scheduleGateway.read();
      if(PlanDraftEditor.active()||!TASKS.length||state.renderDirty){renderSched();return true;}
      const s=scheduleGateway.timeline().realtime;
      if(`${s.scheduledIdx}:${s.nowEff}`!==lastScheduleNowMinuteKey){renderSched();return true;}
      return false;
    }
    function needsRealtimeRefresh(state){
      if(!isPlanPaneVisible()||!TASKS.length||PlanDraftEditor.active())return false;
      const nowKey=`${state.scheduledIdx}:${state.nowEff}`;
      if(nowKey===lastScheduleNowMinuteKey)return false;
      markScheduleRenderDirty();
      return true;
    }
    function resetSession(){PlanDraftEditor.reset();lastAppliedScheduleText='';lastScheduleNowMinuteKey=null;return true;}
    function appliedScheduleText(){return String(lastAppliedScheduleText||scheduleTextFromRows(lastParsed.length?lastParsed:TASKS)||'');}
    const api=freeze({
      format:'study-director.plan-controller',contractVersion:1,
      savedPlans:SavedPlans,draft:PlanDraftEditor,
      hydrate:hydratePlanDraft,
      loadDefault:loadDefaultPlan,
      getDraft:getPlanDraftText,
      loadDraft:loadScheduleIntoDraft,
      render:renderSched,
      apply:applySchedule,
      setStatus:setPlanStatus,
      markRenderDirty:markScheduleRenderDirty,
      renderIfVisible:renderScheduleIfVisible,
      renderOnOpen:renderScheduleOnPlanOpen,
      needsRealtimeRefresh,
      resetSession,
      appliedScheduleText
    });
    return api;
  }
  return freeze({format:'study-director.plan-module',contractVersion:1,createController});
});
})();
