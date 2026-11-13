import type {BrowserRegistry} from '../browser-registry.ts';
import type {TaskSessionStore} from '../execution-host.ts';
import type {TaskInput} from '../domain.ts';
declare const registry:BrowserRegistry;
const timer=registry.require('timer-state',1);
const execution=registry.require('execution-host',1);
const controller=timer.createStateController(Object.freeze({
  helpers:Object.freeze({makeTaskId:(_task:TaskInput,index:number)=>`task-${index}`}),
  diagnostics:Object.freeze({capture:()=>{}}),
  effects:Object.freeze({modeChanged:()=>{}})
}));
const state:Readonly<TaskSessionStore>=execution.createTaskSessionState(controller.taskIdentity);
void state.setResolved(0,'done');
void state.indexSnapshot('actualTime');
// @ts-expect-error -- resolved state is closed.
state.setResolved(0,'finished');
// @ts-expect-error -- field names are closed.
state.getField(0,'unknown-field');
// @ts-expect-error -- module identity is closed.
registry.load('execution-host',1,'study-director.timer-engine-module',1);

declare const gatewayInput:import('../execution-host.ts').ScheduleGatewayInput;
const planGateway:import('../plan.ts').PlanScheduleGateway=execution.createScheduleGateway(gatewayInput);
void planGateway;
