export type PlanTone=true|false|'warn'|'cancelled';
export type PlanDraftStatus='valid'|'empty'|'incomplete'|'invalid';
export type PlanBoardMode='empty'|'live'|'draft'|'invalid';
export type PlanTimerHandle=number;
export interface PlanHydrateOptions{fallback?:boolean}
export interface PlanLoadDraftOptions{allowIncomplete?:boolean;label?:string}
export interface PlanDraftSaveOptions{strictDurability?:boolean;backupCapture?:boolean}
export interface PlanDraftPreviewOptions{enterDraft?:boolean;silent?:boolean;source?:string}
export interface PlanApplyOptions{
  scheduleText?:string;projection?:PlanDraftProjection;currentEditor?:()=>boolean;forceReload?:boolean;reviewOnly?:boolean;
  persistDraft?:boolean;source?:string;studyDate?:unknown;sessionSnapshot?:unknown;lifecycleManaged?:boolean;skipNotify?:boolean;
}
export interface PlanApplyPreparation{handled?:boolean;result?:boolean;cancelled?:boolean;scheduleChanged?:boolean;progressMigration?:PlanMigration|null}
export interface PlanMigrationSummary{total?:number;matched?:number;practiceTotal?:number;practiceMatched?:number}

export interface PlanRow{
  [key:string]:string|number|null|undefined;
  start:string;dur:number|string;name:string;kind:string;area:string;measure:string;target:number|string|null;
  id?:string;
}
export interface PlanParseResult{
  ok:boolean;kind:string;message?:string;parsed:readonly PlanRow[];errors:readonly string[];warnings:readonly string[];
  rawOriginal?:string;raw?:string;
}
export interface ImmutablePlanDraft{
  readonly ok:boolean;readonly kind:string;readonly message:string;readonly parsed:readonly Readonly<PlanRow>[];
  readonly errors:readonly string[];readonly warnings:readonly string[];
}
export interface PlanDraftProjection{
  readonly format:'study-director.plan-draft-projection';readonly contractVersion:1;readonly status:PlanDraftStatus;
  readonly changed:boolean;readonly editMode:boolean;
  readonly board:Readonly<{mode:PlanBoardMode;label:string;caption:string}>;
  readonly firstActionableError:string;readonly warnings:readonly string[];readonly warningText:string;readonly ownershipAvailable:boolean;
  readonly controls:Readonly<{
    showEdit:boolean;editEnabled:boolean;showDone:boolean;doneEnabled:boolean;showCancel:boolean;cancelEnabled:boolean;
    applyEnabled:boolean;editLabel:string;doneLabel:string;
  }>;
  readonly draft:ImmutablePlanDraft;
}
export interface SavedPlan{id:string;label:string;scheduleText:string;createdAt:string;updatedAt:string}
export interface PlanLibrary{savedPlans:SavedPlan[];defaultId:string|null}
export interface PlanDefaults{scheduleText:string;studentName:string}
export interface PlanLimits{
  readonly maxStatusMessageChars:number;readonly maxDurationMinutes:number;readonly maxScheduleChars:number;
  readonly maxTaskNameChars:number;readonly maxAreaNameChars:number;readonly maxUnitChars:number;
}
export interface PlanDataset{
  savedPlan?:string;savedPlanId?:string;ownerMutation?:string;taskIndex?:string;completionState?:string;draftIdx?:string;
  draftField?:string;draftAction?:string;draftDelegation?:string;mode?:string;
}
export interface PlanElement{
  value:string;textContent:string|null;className:string;title:string;type:string;placeholder:string;min:string;step:string;inputMode:string;
  hidden:boolean;disabled:boolean;open:boolean;draggable:boolean;isConnected:boolean;
  readonly dataset:PlanDataset;readonly classList:DOMTokenList;readonly tagName:string;readonly childNodes:readonly unknown[];readonly style:CSSStyleDeclaration;selected:boolean;
  append(...nodes:unknown[]):void;appendChild<T>(node:T):T;replaceChildren(...nodes:unknown[]):void;setAttribute(name:string,value:string):void;
  querySelector(selector:string):PlanElement|null;querySelectorAll(selector:string):Iterable<PlanElement>;
  addEventListener(type:string,listener:(event:PlanEvent)=>unknown,options?:unknown):void;
  contains(node:unknown):boolean;closest(selector:string):PlanElement|null;matches(selector:string):boolean;focus():void;
}
export interface PlanDocument{
  readonly activeElement:PlanElement|null;getElementById(id:string):PlanElement|null;querySelector(selector:string):PlanElement|null;querySelectorAll(selector:string):PlanElement[];
  createElement(tag:string):PlanElement;createTextNode(text:string):unknown;
}
export interface PlanDataTransfer{effectAllowed:string;dropEffect:string;setData(type:string,value:string):void;getData(type:string):string}
export interface PlanEvent{
  readonly target:PlanElement;readonly relatedTarget:PlanElement|null;readonly dataTransfer:PlanDataTransfer|null;readonly animationName?:string;
  preventDefault():void;stopPropagation():void;
}
export interface PlanTimelineRow{idx:number;t:PlanRow;startMin:number;endMin:number}
export interface PlanRuntimeRowState{
  done?:boolean;skipped?:boolean;adjusted?:boolean;adjustedStartMin?:number;adjustedEndMin?:number;
  originalStartMin?:number;originalEndMin?:number;actualTime?:number;actualClock?:Readonly<{startedAt?:unknown;endedAt?:unknown}>;
}
export interface PlanRealtimeState{
  scheduledIdx:number|null;currentIdx?:number|null;nowEff:number;first:number;driftKind?:string;match?:boolean;
}
export interface PlanGatewayRead{
  tasks:PlanRow[];fingerprint:string;anchor:number;currentIndex?:number;renderDirty?:boolean;
}
export interface PlanMigrationPreview{matched?:number;total?:number;practiceTotal?:number;practiceMatched?:number}
export interface PlanMigration{preview?:PlanMigrationPreview}
export interface PlanGatewayApplyResult{migrationSummary?:PlanMigrationSummary}
export interface PlanScheduleGateway{
  act(action:string,index:number):unknown;
  apply(rows:readonly PlanRow[],options:Readonly<Record<string,unknown>>):PlanGatewayApplyResult|boolean|null;
  breakState(action?:string):unknown;
  captureMigration(rows:readonly PlanRow[]):PlanMigration;
  clearSafety(reason:string):unknown;flush():unknown;hasLiveState():boolean;markRender(state:string):unknown;
  read():PlanGatewayRead;reconcile(source:string):unknown;
  renameAreas(mapper:(row:PlanRow)=>string|undefined):number;
  row(index:number):PlanRuntimeRowState;
  timeline():Readonly<{rows:readonly PlanTimelineRow[];realtime:PlanRealtimeState}>;
}
export interface PlanNotice{
  read():Readonly<{lifecycle?:string;kind?:string}>|null;
  finish(lifecycle:string,message:string,options?:Readonly<Record<string,unknown>>):unknown;
}
export interface AnchoredPopover{destroy():void;hide():void;show(anchor:PlanElement):void}
export interface PlanModuleInput{
  readonly ports:Readonly<{
    configuration:Readonly<{limits:Readonly<PlanLimits>}>;
    persistence:Readonly<{
      lastError():unknown;readDraft():string|null;readLibrary():PlanLibrary;writeLibrary(value:PlanLibrary):unknown|PromiseLike<unknown>;
      writeDraft(value:string|null,options?:Readonly<Record<string,unknown>>):boolean|PromiseLike<boolean>;
      reportDraftResult(ok:boolean,error?:unknown):unknown;
    }>;
    defaults:Readonly<{active():PlanDefaults;applyStudentName(value:string):unknown;factory:Readonly<PlanDefaults>}>;
    domain:Readonly<{
      clampText(value:unknown,max?:number):string;fmtDur(value:unknown):string;fmtS(value:unknown):string;
      hasOngoingTaskNotes(value:unknown):boolean;isFixedBlock(value:unknown):boolean;isSupportBlock(value:unknown):boolean;
      isTrackableBlock(value:unknown):boolean;isWorkBlock(value:unknown):boolean;makeScheduleRow(...args:unknown[]):unknown;
      normalizeScheduleKind(value:unknown):string;normalizeScheduleTarget(value:unknown):number|string|null;positiveMinutes(value:unknown):number;
      scheduleFingerprintForRows(rows:readonly PlanRow[]):string;scheduleToken(value:unknown):string;scheduleWarningsMessage(value:readonly string[]):string;
      taskAreaKey(value:unknown):string;taskAreaValue(value:unknown):string;taskMeasureValue(value:unknown,fallback?:string):string;
      taskTargetValue(value:unknown):number|string|null;noteTextForKey(...args:unknown[]):string;
    }>;
    parser:Readonly<{isCanonicalScheduleText(value:unknown):boolean;parseScheduleDraftText(value:unknown):PlanParseResult;scheduleTextFromRows(rows:readonly PlanRow[]):string}>;
    clock:Readonly<{
      clockHM():string;clockMinuteToStudyMinute(value:number):number;getMinuteOfDay():number;isValidHHMM(value:unknown):boolean;
      normalizeHHMM(value:unknown):string;studyMinuteToHHMM(value:number):string;t2m(value:string):number;timeLabelFromIso(value:unknown):string;
    }>;
    view:Readonly<{document:PlanDocument;on(target:PlanElement,type:string,handler:(event:PlanEvent)=>unknown):unknown;textEl(tag:string,className:string,text:string):PlanElement;updateRealTimeAwareness(...args:unknown[]):unknown;window:Readonly<{matchMedia?(query:string):Readonly<{matches:boolean}>;requestAnimationFrame(callback:()=>void):number}>}>;
    scheduleGateway:Readonly<PlanScheduleGateway>;
    ownership:Readonly<{canMutate():boolean;requirePrimary(event:PlanEvent|null,reason:string):boolean}>;
    interactions:Readonly<{
      confirm(options:Readonly<Record<string,unknown>>):PromiseLike<boolean>;
      input(options:Readonly<Record<string,unknown>>):PromiseLike<Readonly<{value?:unknown}>|null>|Readonly<{value?:unknown}>|null;
    }>;
    notifications:Readonly<{
      begin(options:Readonly<Record<string,unknown>>):PlanNotice;
      feedback(options:Readonly<Record<string,unknown>>):unknown;
    }>;
    overlays:Readonly<{createAnchoredPopover(element:PlanElement,options:Readonly<Record<string,unknown>>):AnchoredPopover}>;
    environment:Readonly<{clearTimeout(handle:PlanTimerHandle):void;setTimeout(callback:()=>void,delay:number):PlanTimerHandle}>;
  }>;
}
export interface PlanDraftController{
  active():boolean;deactivate():boolean;enter():boolean;confirm():Promise<boolean>;cancel():Promise<boolean>;
  preview(options?:Readonly<PlanDraftPreviewOptions>):boolean;composerInput():boolean;renderRows(container:PlanElement):void;
  save(options?:Readonly<PlanDraftSaveOptions>):boolean|Promise<boolean>;flush(options?:Readonly<PlanDraftSaveOptions>):boolean|Promise<boolean>;
  authoredText():string|null;clear():Promise<boolean>;reset():void;install():boolean;
}
export interface SavedPlansController{render(selected?:string):void;syncAccess():boolean;act(action:string,planId?:string):Promise<boolean>}
export interface PlanController{
  readonly format:'study-director.plan-controller';readonly contractVersion:1;readonly savedPlans:Readonly<SavedPlansController>;readonly draft:Readonly<PlanDraftController>;
  hydrate(options?:Readonly<PlanHydrateOptions>):boolean;loadDefault():Promise<Readonly<Record<string,unknown>>>;getDraft():string;
  loadDraft(scheduleText:unknown,options?:Readonly<PlanLoadDraftOptions>):Promise<Readonly<Record<string,unknown>>>;
  render(projection?:PlanDraftProjection|null):void;apply(options?:Readonly<PlanApplyOptions>):boolean|Promise<boolean>;
  setStatus(message:unknown,tone?:PlanTone):unknown;markRenderDirty():void;renderIfVisible():boolean;renderOnOpen():boolean;
  needsRealtimeRefresh(state:PlanRealtimeState):boolean;resetSession():boolean;appliedScheduleText():string;
  areaUse(fromTitle:unknown):Readonly<{today:boolean;savedPlans:number}>;
  renameArea(fromTitle:unknown,toLabel:unknown):Promise<Readonly<{blocks:number;savedPlans:number}>>;
}
export interface PlanModule{readonly format:'study-director.plan-module';readonly contractVersion:1;createController(input:Readonly<PlanModuleInput>):Readonly<PlanController>}
