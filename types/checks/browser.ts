import type {PilotRegistry, SaveLaneModule} from '../pilot.ts';
declare const registry: PilotRegistry;
declare const saves: SaveLaneModule;
registry.load('canonical',1,'study-director.canonical',1).same({},{});
// @ts-expect-error -- a module ID determines its export identity.
registry.load('canonical',1,'study-director.save-lane-module',1);
// @ts-expect-error -- the checked seam is closed; no caller-selected return types.
registry.require('invented-module',1);
// @ts-expect-error -- factory must implement the matching module contract.
registry.define('canonical',1,()=>({format:'wrong'}));
const lane=saves.createLane({label:'Note',write:(value: string)=>Promise.resolve(value.length),onState:()=>{},environment:{setTimeout:(callback,delay)=>window.setTimeout(callback,delay),clearTimeout:handle=>window.clearTimeout(handle)}});
lane.schedule('edit');
// @ts-expect-error -- lane values follow the write port's type.
lane.schedule(42);
// @ts-expect-error -- exact optionals do not accept explicit undefined.
void lane.flush({strict:undefined});
// @ts-expect-error -- unchecked indexing must remain checked.
const definite: number = saves.RETRY_DELAYS_MS[99];
void definite;
// @ts-expect-error -- Node globals must not enter the browser project.
void process;
// @ts-expect-error -- a dedicated-worker global must not enter the DOM project.
void importScripts;

const signal=saves.createLane({label:'Notes',write:(_value: void,options)=>options.backupCapture===true,onState:()=>{},environment:{setTimeout:(callback,delay)=>window.setTimeout(callback,delay),clearTimeout:handle=>window.clearTimeout(handle)}});
signal.schedule();
void signal.flush({backupCapture:true});
