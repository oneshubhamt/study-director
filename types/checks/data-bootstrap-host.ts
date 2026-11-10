import type {BrowserRegistry} from '../browser-registry.ts';
declare const registry:BrowserRegistry;
const module=registry.require('data-bootstrap-host',1);
const configuration=module.createConfiguration as unknown;
void configuration;
// @ts-expect-error -- registry identity is closed.
registry.require('data-bootstrap',1);
// @ts-expect-error -- module format is closed.
registry.load('data-bootstrap-host',1,'study-director.profiles-host-module',1);
