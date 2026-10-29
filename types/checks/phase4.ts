import type {BrowserRegistry} from '../browser-registry.ts';
import type {IndexedDb} from '../persistence.ts';
declare const registry:BrowserRegistry;
declare const db:IndexedDb;
const value:Promise<number>=db.transaction<number>('notes','readwrite',(_tx,finish)=>finish(true,42));
void value;
// @ts-expect-error -- success values must match the transaction result.
void db.transaction<number>('notes','readwrite',(_tx,finish)=>finish(true,'wrong'));
void db.transaction<number>('notes','readwrite',(_tx,finish)=>finish(false,new Error('failure')));
// @ts-expect-error -- an unvalidated database record is unknown.
void db.get('notes','key').then(row=>row.text);
// @ts-expect-error -- parsed local JSON must be validated before property access.
registry.require('persistence',1).createLocalStorage().getJson('stored').version;
const session=registry.require('session-lifecycle',1).createCoordinator({hooks:{canMutate:()=>true,flushPending:()=>{},prepare:()=>{},reconcile:()=>{},complete:()=>{},capture:()=>{}}});
const synchronous:number=session.runSync('test',{},()=>42);void synchronous;
// @ts-expect-error -- synchronous transitions cannot accept asynchronous operations.
session.runSync('test',{},async()=>42);
const stamps=registry.require('persistence',1);
const epoch:number=stamps.normalizeImportedEpochMillis('123',0);void epoch;
// @ts-expect-error -- absent fallback may return null.
const timestamp:string=stamps.normalizeTimestamp('invalid');void timestamp;
import type {DailyRecord,PendingReview,DataContract} from '../record-models.ts';
declare const record:DailyRecord;
if(record.recordKind==='study'){record.schedule.forEach(row=>{const minutes:number=row.duration;void minutes;});}
// @ts-expect-error -- diary records do not contain study-only fields.
if(record.recordKind==='diary')void record.schedule;
// @ts-expect-error -- retired schema versions cannot enter a typed canonical contract.
const schema:DataContract['schemas']['DailyRecord']={version:15};void schema;
declare const review:PendingReview;void review;

import type {BackupInput} from '../backup-models.ts';
import type {TimerStateInput} from '../timer-state.ts';
import type {MutationInput} from '../mutation-coordinator.ts';
import type {IngestInput} from '../attachment-ingest.ts';
declare const backupInput:BackupInput;
const backup=registry.require('backup-codec',1).createBackupCodec(backupInput);
// @ts-expect-error -- binary containers require Blobs.
backup.createV10Container('bytes');
// @ts-expect-error -- completion counts are numeric.
void backup.encodeCompletion(1,{note:'one'},[],'sha256');
declare const timerInput:TimerStateInput;
const timer=registry.require('timer-state',1).createStateController(timerInput);
timer.mode='paused';timer.currentIndex=1;timer.runtime={taskIdx:0,recordedSec:'7.6'};
const elapsed:number=timer.runtime.recordedSec;void elapsed;
// @ts-expect-error -- runtime accessor setters preserve their specific state type.
timer.mode='invented';
// @ts-expect-error -- live task views cannot be modified.
timer.tasks.push({id:'x'});
// @ts-expect-error -- methods remain immutable even though accessor setters work.
timer.clearSession=()=>true;
declare const mutationInput:MutationInput;
const mutation=registry.require('mutation-coordinator',1).createCoordinator(mutationInput);
const mutationResult:Promise<number>=mutation.runExclusive('test',authority=>{authority.assert();return 42;});void mutationResult;
// @ts-expect-error -- callback results cannot be replaced by caller-selected types.
const badMutationResult:Promise<string>=mutation.runExclusive('test',()=>42);void badMutationResult;
declare const ingestInput:IngestInput;
const ingest=registry.require('attachment-ingest',1).create(ingestInput);
const verified:Promise<boolean>=ingest.verify('file','hash',12);void verified;
// @ts-expect-error -- ingest verifies a Blob, not a path string.
void ingest.ingest('file');

import type {RepositoriesInput,SessionResult} from '../repositories.ts';
declare const repositoriesInput:RepositoriesInput;
const repositories=registry.require('repositories',1).createAppData(repositoriesInput);
const sessionWrite:Promise<SessionResult>=repositories.activeSession.clear();void sessionWrite;
const preparationReset:Promise<readonly {unit:string;token:string}[]>=repositories.preparationUnits.replace(['*']);void preparationReset;
const deletedDays:Promise<{date:string;deletedAt:string}[]>=repositories.deletionRecovery.savedDays();void deletedDays;
// @ts-expect-error -- a canonical date batch takes dates, not arbitrary keys.
void repositories.dailyRecords.documents([12]);
// @ts-expect-error -- write authority cannot be replaced by a token-shaped string.
void repositories.planData.writeDraft('plan',{ownershipToken:'primary'});
