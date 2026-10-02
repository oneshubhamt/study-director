import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['source/core/internal.js','source/core/operation-lifecycle.js','source/core/backup-operation-diagnostics.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const DiagnosticsModule=registry.require('backup-operation-diagnostics',1,Object.freeze({lifecycle:registry.require('operation-lifecycle',1)}));
const freeze=Object.freeze;
let now=Date.parse('2026-09-25T12:00:00.000Z'),stored='';
const storage=freeze({read:()=>stored,write:value=>(stored=String(value),true)});
const make=()=>DiagnosticsModule.createRecorder(freeze({configuration:freeze({release:'diagnostic-test-release',limit:3}),environment:freeze({now:()=>now}),storage}));

const first=make();
const id=first.start('device-restore','Device Folder',{interactive:true});
now+=12;assert.equal(first.mark('history-scan-start',{versions:3},id),true);
now+=28;assert.equal(first.mark('history-scan-complete',{versions:3},id),true);
now+=10;assert.equal(first.finish({ok:true},id),true);
let rows=first.snapshot();assert.equal(rows.length,1);assert.equal(rows[0].status,'completed');assert.equal(rows[0].endedAt-rows[0].startedAt,50);
const text=first.text();assert.match(text,/device-restore · Device Folder · completed · 50 ms/u);assert.match(text,/history-scan-complete/u);assert.match(text,/No study content, note text, attachment names, or backup payloads are included/u);

now+=50;const failedId=first.start('device-backup','Device Folder',{reason:'qa'});const preparationError=Object.assign(new Error('safe diagnostic detail'),{code:'BACKUP_PLAN_SETTLE_FAILED',backupStage:'checkpoint-plan-settle'});now+=7;assert.equal(first.fail(preparationError,{},failedId),true);const failed=first.snapshot().find(row=>row.id===failedId);assert.equal(failed.status,'failed');assert.equal(failed.phases.at(-1).details.errorCode,'BACKUP_PLAN_SETTLE_FAILED');assert.equal(failed.phases.at(-1).details.errorStage,'checkpoint-plan-settle');assert.match(first.text(),/BACKUP_PLAN_SETTLE_FAILED/u);assert.match(first.text(),/checkpoint-plan-settle/u);
now+=10;const repositoryFailureId=first.start('device-backup','Device Folder',{reason:'qa'});const repositoryError=Object.assign(new Error('private internal detail must not be copied'),{code:'BACKUP_REPOSITORY_PREPARATION_FAILED',backupStage:'checkpoint-repository-preparation',diagnosticReason:'reusable-structured-object-unavailable'});now+=3;first.fail(repositoryError,{},repositoryFailureId);const repositoryFailure=first.snapshot().find(row=>row.id===repositoryFailureId);assert.equal(repositoryFailure.phases.at(-1).details.errorReason,'reusable-structured-object-unavailable');assert.doesNotMatch(first.text(),/private internal detail/u,'diagnostics must expose only the stable safe reason, not raw error messages');

now+=100;const interruptedId=first.start('provider-restore','Google Drive',{provider:'google-drive'});now+=25;first.mark('provider-authorization-start',{},interruptedId);
const afterReload=make();rows=afterReload.snapshot();const interrupted=rows.find(row=>row.id===interruptedId);assert.equal(interrupted.status,'interrupted');assert.equal(interrupted.phases.at(-1).name,'page-reloaded-or-operation-interrupted');


now+=100;const longId=afterReload.start('provider-restore','Google Drive',{provider:'google-drive'});for(let index=0;index<220;index+=1){now+=1;afterReload.mark('provider-object-phase',{index},longId);}now+=1;afterReload.finish({ok:true},longId);const longRecord=afterReload.snapshot().find(row=>row.id===longId);assert.equal(longRecord.phases[0].name,'start','expanded diagnostics must retain the operation start for detailed Drive restores');assert.equal(longRecord.phases.filter(phase=>phase.name==='provider-object-phase').length,220,'detailed Drive restore diagnostics must retain all ordinary per-object phases instead of truncating at the old 96-phase ceiling');assert.equal(longRecord.phases.at(-1).name,'finish');

for(let index=0;index<5;index+=1){now+=10;const next=afterReload.start('device-backup','Device Folder',{reason:'qa'});now+=1;afterReload.finish({ok:true},next);}assert.equal(afterReload.snapshot().length,3,'Diagnostics must remain a small bounded recent-history ring.');

stored='';const concurrent=make(),foregroundId=concurrent.start('device-backup','Device Folder',{target:'device-folder'}),backgroundId=concurrent.start('asset-maintenance','Attachment storage',{background:true});
assert.equal(concurrent.mark('ambiguous',{}),false,'an implicit phase must never choose between live operations');
assert.equal(concurrent.mark('device-write',{target:'device-folder'}),true,'a unique target can route legacy implicit phases');
for(let index=0;index<8;index++){const id=concurrent.start('other-background','Canonical storage',{background:true});concurrent.finish({status:'pending',reason:'gc-grace'},id);}
assert.equal(concurrent.snapshot().find(row=>row.id===foregroundId).status,'running','history pressure cannot evict or supersede a running operation');
assert.equal(concurrent.snapshot().find(row=>row.id===backgroundId).status,'running');assert.equal(concurrent.status().activeIds.length,2);
assert.equal(concurrent.finish({status:'yielded',reason:'budget'},backgroundId),true);assert.equal(concurrent.finish({cancelled:true},foregroundId),true);assert.equal(concurrent.mark('late',{},foregroundId),false);
assert.equal(concurrent.snapshot().length,3);assert.match(concurrent.text(),/yielded/u);assert.match(concurrent.text(),/cancelled/u);

for(const [details,expected] of [[{status:'completed',complete:false},'yielded'],[{status:'skipped',reason:'permission'},'unavailable'],[{status:'pending',reason:'delete-failure'},'failed'],[{status:'pending',reason:'gc-grace'},'deferred']]){
  const id=concurrent.start('pass');concurrent.finish(details,id);assert.equal(concurrent.snapshot().find(row=>row.id===id).status,expected);
}
const aborted=concurrent.start('cancelled-pass');concurrent.fail(Object.assign(new Error('private text'),{name:'AbortError',code:'DEVICE_MAINTENANCE_PREEMPTED'}),{},aborted);assert.equal(concurrent.snapshot().find(row=>row.id===aborted).status,'yielded');
const long=concurrent.start('bounded-phases');for(let index=0;index<600;index++)concurrent.mark('step',{index},long);concurrent.finish({},long);
const bounded=concurrent.snapshot().find(row=>row.id===long);assert.equal(bounded.phases.length,512);assert.equal(bounded.phases[0].name,'start');assert.equal(bounded.phases.at(-1).name,'finish');

stored='';const saturated=make(),active=Array.from({length:20},()=>saturated.start('live'));
assert.ok(active.every(Boolean));assert.equal(saturated.start('overflow'),'');assert.equal(saturated.status().dropped,1);assert.equal(saturated.finish({},''),false);
active.forEach(id=>assert.equal(saturated.finish({},id),true));assert.equal(saturated.snapshot().length,3);
const persisted=saturated.start('persisted'),reloaded=make(),fresh=reloaded.start('same-clock');assert.notEqual(fresh,persisted,'reloading at the same clock instant must not reuse an existing trace ID');
assert.equal(reloaded.snapshot().find(row=>row.id===persisted).status,'interrupted');reloaded.finish({},fresh);
const unavailable=DiagnosticsModule.createRecorder(freeze({configuration:freeze({release:'test',limit:3}),environment:freeze({now:()=>0}),storage:freeze({read:()=>'',write:()=>false})}));
const memoryId=unavailable.start('memory-only');assert.equal(unavailable.finish({},memoryId),true);assert.equal(unavailable.status().persistence,'unavailable');assert.match(unavailable.text(),/1970-01-01T00:00:00.000Z/u);
assert.doesNotMatch(unavailable.text([{job:'cleanup',state:'scheduled',pending:true,reason:'private note',folderName:'private folder',nextEligibleAt:'tomorrow'}]),/private note|private folder/u,'live diagnostics use a narrow field projection');
console.log(JSON.stringify({status:'PASS',suite:'backup-operation-diagnostics',phaseTiming:true,reloadInterruption:true,boundedHistory:true,copyText:true},null,2));

// Sanitize before persistence as well as before copying, including legacy records.
stored='';const privateRecorder=make(),privateId=privateRecorder.start('PRIVATE DATA','PRIVATE DATA',{reason:'PRIVATE DATA',path:'PRIVATE DATA',repositoryScope:'PRIVATE DATA',pending:true});
privateRecorder.mark('PRIVATE DATA',{errorCode:'PRIVATE DATA',errorName:'PRIVATE DATA',errorReason:'PRIVATE DATA',stage:'PRIVATE DATA',count:4,provider:'google-drive',noteText:'PRIVATE DATA'},privateId);privateRecorder.fail(Object.assign(new Error('PRIVATE DATA'),{code:'PRIVATE DATA',diagnosticReason:'PRIVATE DATA',diagnosticStage:'PRIVATE DATA'}),{},privateId);
assert.doesNotMatch(stored,/PRIVATE DATA/u);assert.doesNotMatch(privateRecorder.text(),/PRIVATE DATA/u);assert.match(privateRecorder.text(),/count=4/u);assert.equal(privateRecorder.snapshot()[0].status,'failed');
const legacy=JSON.parse(stored);legacy.records[0].release='PRIVATE DATA';legacy.records[0].kind='PRIVATE DATA';legacy.records[0].source='PRIVATE DATA';legacy.records[0].details.noteText='PRIVATE DATA';legacy.records[0].phases[0].name='PRIVATE DATA';legacy.records[0].phases[0].details.reason='PRIVATE DATA';stored=JSON.stringify(legacy);const sanitized=make();assert.doesNotMatch(JSON.stringify(sanitized.snapshot()),/PRIVATE DATA/u);const sanitizeId=sanitized.start('device-backup','Device Folder',{});sanitized.finish({},sanitizeId);assert.doesNotMatch(stored,/PRIVATE DATA/u);
const live=sanitized.text([{job:'PRIVATE DATA',state:'PRIVATE DATA',reason:'PRIVATE DATA',lastOutcome:'PRIVATE DATA',phase:'PRIVATE DATA',history:'PRIVATE DATA',completedAt:'2026-01-01 (PRIVATE DATA)',permission:'PRIVATE DATA',severity:'PRIVATE DATA'}]);assert.doesNotMatch(live,/PRIVATE DATA/u);assert.match(live,/completedAt=2026-01-01T00:00:00.000Z/u);
const broad=sanitized.text(Array.from({length:55},()=>({job:'Canonical maintenance',state:'pending',pending:true})));assert.equal((broad.match(/Current Canonical maintenance:/gu)||[]).length,48);assert.match(broad,/Snapshot entries omitted: 7/u);
const brokenRead=DiagnosticsModule.createRecorder(freeze({configuration:freeze({release:'test',limit:3}),environment:freeze({now:()=>now}),storage:freeze({read:()=>{throw new Error('unavailable');},write:()=>false})}));assert.equal(brokenRead.status().persistence,'unavailable');const running=brokenRead.start('device-backup','Device Folder');assert.equal(brokenRead.finish({},running),true,'failed diagnostic storage must not block an operation');
console.log(JSON.stringify({status:'PASS',suite:'data-diagnostics-privacy',tracePersistenceSanitized:true,legacySanitized:true,liveProjectionSanitized:true,boundedSnapshot:true,unavailableStorageContained:true},null,2));

// Restore troubleshooting must retain its controlled labels as well as privacy.
stored='';const restoreTrace=make(),restoreTraceId=restoreTrace.start('standalone-import','Local data');
for(const label of ['ownership','notes','deletions','personal','session-save','session-settle','session-read']){restoreTrace.mark('restore-preflight-'+label+'-failed',{stage:label,errorCode:'RESTORE_PREFLIGHT_NOTES_FAILED'},restoreTraceId);}
restoreTrace.fail(Object.assign(new Error('private failure'),{code:'RESTORE_PREFLIGHT_NOTES_FAILED',backupStage:'notes',diagnosticReason:'notes'}),{},restoreTraceId);
assert.equal(restoreTrace.snapshot()[0].phases.filter(phase=>phase.name.startsWith('restore-preflight-')).length,7);assert.match(restoreTrace.text(),/errorStage=notes/u);assert.match(restoreTrace.text(),/errorReason=notes/u);
for(const phase of ['prepared','committing','applying-assets','version-restore-active-session','startup-rolling-back','verified'])assert.match(restoreTrace.text([{job:'Restore journal',state:'pending',phase}]),new RegExp('phase='+phase,'u'));
console.log(JSON.stringify({status:'PASS',suite:'restore-diagnostic-labels',preflightStages:7,journalPhasesPreserved:true},null,2));
