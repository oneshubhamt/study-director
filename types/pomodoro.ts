import type {TimerStateModule} from '../source/core/timer-state.ts';
import type {TimerTask} from './timer-state.ts';
import type {CueDelivery} from './practice-pacer.ts';
type TimerController=ReturnType<TimerStateModule['createStateController']>;
export type PomodoroConfiguration={enabled:boolean;nudgeAfter:number;breakMinutes:number};
export type PomodoroCue={taskIdx:number;issuedAt:string};
export type CycleOptions={activeSec?:number;hide?:boolean|undefined};
export type StopOptions=CycleOptions&{dismiss?:boolean;clear?:boolean;audio?:boolean};
export type PomodoroPayloads={'tick':{activeSec?:number};'reset-cycle':CycleOptions&{anchorSec?:number|null};'restore-cycle':CycleOptions&{cycle?:{startSec:number}|null};'cycle-snapshot':Record<string,never>;'clear-cue':CycleOptions;'dismiss-cue':CycleOptions};
export type PomodoroResults={ 'tick':boolean;'reset-cycle':boolean;'restore-cycle':boolean;'cycle-snapshot':Readonly<{startSec:number}>;'clear-cue':boolean;'dismiss-cue':boolean };
export type PomodoroArguments={[K in keyof PomodoroPayloads]:[type:K,payload?:PomodoroPayloads[K]|undefined]}[keyof PomodoroPayloads];
export interface PomodoroInput{ports:{
 state:{TASKS:readonly TimerTask[];TIMER_MODES:TimerStateModule['TIMER_MODES'];TimerState:Pick<TimerController,'runtime'|'mode'|'paused'|'currentIndex'|'inactiveGap'>};
 schedule:{isPomodoroEligibleBlock(task:TimerTask|undefined):boolean};
 persistence:{canMutate():boolean;readConfiguration():unknown;writeConfiguration(value:PomodoroConfiguration):unknown;writeSession():unknown};
 view:{document:Document;notifications:{begin(event:{source:'pomodoro';id:'reminder';surface:'quiet';foreground:false;cue:'pomodoro';occurrence:string;title:string;message:string;system:true}):CueDelivery};updateExecutePanels():void};
 environment:{nowIso():string};
}}
