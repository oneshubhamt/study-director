import type {BrowserRegistry} from '../browser-registry.ts';
import type {NativeCapabilitiesInput,TaskSchedulerEnvironment} from '../native-capabilities.ts';
declare const registry:BrowserRegistry;
declare const input:Readonly<NativeCapabilitiesInput>;
declare const environment:TaskSchedulerEnvironment;
const native=registry.require('native-capabilities',1);
const controller=native.createController(input);
const mode:'checking'|'unsupported'|'protected'|'standard'=controller.status().storageMode;void mode;
void controller.syncWake({forceCycle:true});
// @ts-expect-error -- wake options have a closed shape.
void controller.syncWake({forceCycle:'yes'});
const scheduler=native.createTaskScheduler(environment);
void scheduler.yieldTask({priority:'background'});
// @ts-expect-error -- scheduler priorities are closed.
void scheduler.yieldTask({priority:'urgent'});
registry.require('capabilities-host',1);
// @ts-expect-error -- module export identity remains bound to its ID.
registry.load('native-capabilities',1,'study-director.capabilities-host-module',1);
