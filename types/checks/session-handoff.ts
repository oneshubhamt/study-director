import type {BrowserRegistry} from '../browser-registry.ts';
import type {SessionHandoffInput} from '../session-handoff.ts';
declare const registry:BrowserRegistry;
declare const input:SessionHandoffInput;
const handoff=registry.require('session-handoff',1);
const controller=handoff.createController(input);
controller.runsElsewhere(null);
controller.fromElsewhere(null);
controller.snapshotForWrite();
void controller.prefetchSource();
void controller.checkClaim();
void controller.wakeClaim();
void controller.transferHere(null,{onStep:()=>{}});
void controller.yieldLocal();
// @ts-expect-error -- session handoff has no arbitrary provider implementation surface.
controller.claimSessionOwnership();
// @ts-expect-error -- module identity is closed.
registry.load('session-handoff',1,'study-director.session-host-module',1);
