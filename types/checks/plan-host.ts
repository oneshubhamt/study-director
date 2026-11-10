import type {BrowserRegistry} from '../browser-registry.ts';
import type {PlanControllerHostInput,PlanDataHostInput} from '../plan-host.ts';
declare const registry:BrowserRegistry;
declare const dataInput:Readonly<PlanDataHostInput>;
declare const controllerInput:Readonly<PlanControllerHostInput>;
const host=registry.require('plan-host',1);
const data=host.createData(dataInput);
void data.activeDefaults();
void data.writeDraft('07:00 | 60 | Study | work | Core | block | 1',{strictDurability:true});
void host.createController(controllerInput);
// @ts-expect-error -- hydration authority is boolean, not text.
void data.writeDraft('draft',{allowHydrating:'yes'});
// @ts-expect-error -- module identity is closed.
registry.load('plan-host',1,'study-director.plan-module',1);
