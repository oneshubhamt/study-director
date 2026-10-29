import type {Limits,RecordHelpers,PracticeRun,PracticePlan} from './record-models.ts';
import type {TimerStateModule} from '../source/core/timer-state.ts';
import type {TimerTask} from './timer-state.ts';
export type PracticeCue='quiet'|'strict';
export type PracticeSetup='simple'|'variable';
export type PracticePause='manual'|'main'|'block'|'task'|'session'|'gap';
export type PlanInput=Partial<Record<'targetMs'|'sessionTargetMs'|'totalUnits'|'unitPlan',unknown>>;
export type PracticeConfiguration={ok:false;error:string}|{ok:true;error:string;targetMs:number;sessionTargetMs:number;totalUnits:number;unitPlan:PracticePlan|null;plannedUnits:number;plannedSessionMs:number;effectiveSessionTargetMs:number;summary:string};
export type PlanParse={plan:PracticePlan|null;error:string};
export interface PracticeModelInput{ports:{configuration:{APP_LIMITS:Limits};domain:Pick<RecordHelpers,'boundedInt'|'boundedNumber'|'clampText'>&{clampArray(value:unknown,max:number):unknown[];fmtS(seconds:number):string}}}
type TimerController=ReturnType<TimerStateModule['createStateController']>;
export interface CueDelivery{resolve():unknown}
export interface PracticeControllerPorts{
 configuration:{APP_LIMITS:Limits};
 state:{TASKS:readonly TimerTask[];TIMER_MODES:TimerStateModule['TIMER_MODES'];TaskIdentity:TimerController['taskIdentity'];TimerState:Pick<TimerController,'mode'|'paused'|'inactiveGap'|'runtime'|'currentIndex'>};
 schedule:{isTaskResolved(index:number):boolean;isWorkBlock(task:TimerTask|undefined):boolean};
 persistence:{persistPracticeCueMode(mode:PracticeCue):void;persistPracticeTarget(ms:number):void;saveLiveDraft(options?:{markChanged?:boolean}):void;writeLiveDraftNow():void};
 view:{document:Document;isExecutePaneVisible():boolean;setElementAttribute(element:Element|null,name:string,value:string):boolean;setElementClass(element:Element|null,value:string):boolean;setElementDisabled(element:(Element&{disabled:boolean})|null,value:boolean):boolean;setElementHidden(element:HTMLElement|null,value:boolean):boolean;setElementStyle(element:HTMLElement|null,name:string,value:string):boolean;setElementText(element:Element|null,value:string):boolean;setTextSafe(id:string,value:string):void};
 userPreferences:{notifications:{begin(event:{source:'practice';id:'pace';surface:'quiet';foreground:false;cue:'practice-target'|'practice-near';occurrence:string}):CueDelivery};readUserDefaults():{practiceTargetMs?:number|null;practiceCueMode?:string|null}|null};
 ownership:{appCanMutate():boolean};clock:{nowMs():number};
}
export type RunDraft=Omit<Partial<PracticeRun>,'targetMs'>&{targetMs:number|null;unitMs:number[]};
