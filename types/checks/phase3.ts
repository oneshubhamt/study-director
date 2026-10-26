import {createProcessingEngine} from '../../portable/processing.ts';
import {integritySegment} from '../../portable/integrity-segments.ts';
import type {PilotRegistry} from '../pilot.ts';
import type {ProcessingRequest} from '../portable-processing.ts';
declare const registry:PilotRegistry;
declare const file:Blob;
const engine=createProcessingEngine();
const hash:Promise<string>=engine.run('file.hash',{file});
const parsed:Promise<unknown>=engine.run('parseBlob',{file,maxBytes:1024});
void hash;void parsed;
// @ts-expect-error -- an operation determines its inputs.
void engine.run('file.hash',{password:'wrong'});
// @ts-expect-error -- an operation determines its result.
const bad:Promise<Blob>=engine.run('file.hash',{file});
void bad;
// @ts-expect-error -- parsed JSON must be validated before field access.
void engine.run('parseBlob',{file,maxBytes:1024}).then(value=>value.name);
// @ts-expect-error -- request unions preserve the operation/payload relationship.
const request:ProcessingRequest={type:'encode.write',data:{file}};
void request;
// @ts-expect-error -- digest requires a validated checkpoint.
void integritySegment('integrity.digest',{hash:null});
// @ts-expect-error -- domain dependencies are required at construction.
registry.require('domain',1);
const lifecycle=registry.require('operation-lifecycle',1);
void lifecycle.waitForSettlement([Promise.resolve(3)],{signal:new AbortController().signal});
// @ts-expect-error -- jobs must report a real outcome.
lifecycle.createJob({environment:{now:()=>0,setTimeout:()=>1,clearTimeout:()=>{}},isAvailable:()=>true,execute:()=>42,capture:()=>{}});
