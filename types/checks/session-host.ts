import type {BrowserRegistry} from '../browser-registry.ts';
import type {SessionHostInput} from '../session-host.ts';
declare const registry:BrowserRegistry;
declare const input:SessionHostInput;
const session=registry.require('session-host',1);
const controller=session.createController(input);
controller.saveLiveDraft({strictDurability:true,delayMs:250});
void controller.writeCanonicalNow('type-check',{markChanged:false});
void controller.restoreLocalRecovery();
void controller.resetLocal();
// @ts-expect-error -- canonical write options do not expose an ad-hoc durability mode.
controller.writeCanonicalNow('type-check',{strictDurability:false});
// @ts-expect-error -- module identity is closed.
registry.load('session-host',1,'study-director.execution-host-module',1);
