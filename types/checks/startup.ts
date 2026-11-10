import type {BrowserRegistry} from '../browser-registry.ts';
declare const registry:BrowserRegistry;
const lifecycle=registry.require('startup-lifecycle',1);
const host=registry.require('startup-host',1);
void lifecycle.createCoordinator;
void host.createActivation;
void host.createOwnershipController;
void host.createCoordinator;
// @ts-expect-error -- manifest id is not the registry id.
registry.require('startup',1);
// @ts-expect-error -- startup host format is closed.
registry.load('startup-host',1,'study-director.startup-lifecycle',1);
