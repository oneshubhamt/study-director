import assert from 'node:assert/strict';
import fs from 'node:fs';

// Current runtime boundary invariants: decision time, pacing, presentation, and bounded background/display work.

{ // decision-clock-boundary
const host=fs.readFileSync('source/app.html','utf8');
const timer=fs.readFileSync('source/core/timer-engine.js','utf8');
const attachments=fs.readFileSync('source/core/attachments.js','utf8');
const mutation=fs.readFileSync('source/core/mutation-coordinator.js','utf8');

function section(source,start,end){
  const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
  assert.ok(from>=0&&to>from,`Missing architecture section: ${start}`);
  return source.slice(from,to);
}

assert.match(host,/const DecisionClock=Object\.freeze\(\{nowMs:\(\)=>Date\.now\(\)\}\);/,'DecisionClock is a nowMs-only capability');
assert.doesNotMatch(host,/DecisionClock\.nowIso\b/,'DecisionClock must not grow informational timestamp helpers');
assert.match(host,/document,window,now:DecisionClock\.nowMs,randomIdPart,/,'App ownership decisions use the shared DecisionClock');

assert.match(timer,/clock:freeze\(\['nowMs'\]\)/,'Timer engine clock contract is nowMs-only');
assert.match(timer,/function nowIso\(\)\{return new Date\(\)\.toISOString\(\);\}/,'Timer informational timestamps remain ambient wall clock');
assert.doesNotMatch(timer,/clockNowIso|ports\.clock\.nowIso/,'Timer engine must not obtain ISO timestamps from DecisionClock');

assert.doesNotMatch(attachments,/\bp\.clock\b|\bclock\.nowIso\b|Attachment reference clock/,'Attachment reference rollback must not depend on DecisionClock');
assert.match(attachments,/const nowIso=\(\)=>new Date\(\)\.toISOString\(\);/,'Attachment rollback stamps remain ordinary wall-clock metadata');

assert.match(host,/MutationCoordinatorModule\.createCoordinator\(Object\.freeze\(\{[\s\S]*now:DecisionClock\.nowMs/u,'the extracted mutation coordinator receives the shared DecisionClock as its lease-decision clock');
assert.match(mutation,/const nowMs=\(\)=>\{const value=Number\(input\.environment\.now\(\)\)/u,'mutation lease decisions use the injected decision clock');
assert.match(mutation,/Number\(value\.expiresAt\)>nowMs\(\)/,'foreign mutation-lease expiry uses the injected decision clock');
assert.equal((mutation.match(/nowMs\(\)\+LEASE_MS/g)||[]).length,3,'local and durable lease acquisition/refresh expiry use the injected decision clock');
assert.match(mutation,/Number\(result\.holder&&result\.holder\.expiresAt\)-nowMs\(\)\+50/,'recovery lease wait uses the injected decision clock');
assert.match(mutation,/const id=`mutation_\$\{nowMs\(\)\.toString\(36\)\}_/,'mutation identifiers use the same injected decision clock');
assert.match(mutation,/startedAt:new Date\(\)\.toISOString\(\)/,'human/audit mutation start time remains informational wall clock');

assert.doesNotMatch(host,/PracticePacer\.pauseFromMain\(PRACTICE_PAUSE_CAUSES\.MAIN\s*,\s*Date\.now\(\)\)/,'host Pacer bridges must not bypass the injected Pacer clock');
assert.equal((host.match(/PracticePacer\.pauseFromMain\(PRACTICE_PAUSE_CAUSES\.MAIN\);/g)||[]).length,2,'both host Pacer pause bridges defer to the Pacer clock');

const runtimePayload=section(host,'function timerRuntimePayload(){','/* DATE AND REVIEW-DAY HELPERS */');
assert.doesNotMatch(runtimePayload,/Date\.now\(\)/,'persisted timer runtime arithmetic uses DecisionClock');
assert.match(runtimePayload,/DecisionClock\.nowMs\(\)/,'timer runtime captures decision time from DecisionClock');

const snapshotCadence=section(host,'function writeLiveDraftNow(options={}){','function applySessionSnapshot(snapshot){');
assert.doesNotMatch(snapshotCadence,/Date\.now\(\)/,'running-timer snapshot cadence uses DecisionClock');
assert.equal((snapshotCadence.match(/DecisionClock\.nowMs\(\)/g)||[]).length,3,'snapshot write, priority-debounce deadline and cadence comparison share DecisionClock');

const restoreTimer=section(host,'function deriveRestoredTimerState(candidate){','function isRestorableActiveSession(session){');
assert.doesNotMatch(restoreTimer,/Date\.now\(\)/,'restored timer/gap/break arithmetic uses DecisionClock');
assert.match(restoreTimer,/now=DecisionClock\.nowMs\(\)/,'restored timer fallbacks capture DecisionClock once');
assert.match(restoreTimer,/deriveRestoredInactiveGap\(runtime,idx,now=DecisionClock\.nowMs\(\)\)/,'restored inactive-gap arithmetic uses DecisionClock');
assert.match(restoreTimer,/deriveRestoredBreakState\(runtime,idx,now=DecisionClock\.nowMs\(\)\)/,'restored break arithmetic uses DecisionClock');

assert.match(host,/nowIso:\(\)=>new Date\(\)\.toISOString\(\)\n\}\)\);/,'Library-clear informational rollback stamps remain wall clock');

console.log(JSON.stringify({status:'PASS',boundary:'decision-clock',decisionClock:['nowMs'],ambientInformationalTimestamps:true},null,2));
}

{ // practice-pacer-boundary
const pacer=fs.readFileSync('source/core/practice-pacer.js','utf8');
const timer=fs.readFileSync('source/core/timer-engine.js','utf8');
const modelAt=pacer.indexOf('function createModel');
const controllerAt=pacer.indexOf('function createController');
assert.ok(modelAt>0&&controllerAt>modelAt,'Practice Pacer exposes distinct model/controller boundaries');
const modelSource=pacer.slice(modelAt,controllerAt);
for(const token of ['document','window','querySelector','getElementById','localStorage','sessionStorage','Pomodoro','TimerState']){
  assert.equal(new RegExp(`\\b${token}\\b`).test(modelSource),false,`Practice Pacer model remains browser/state-orchestration free: ${token}`);
}
assert.match(timer,/const \{controller:PracticePacer,model:PracticePacerModel\}=ports\.practice;/);
assert.doesNotMatch(timer,/practice-pacer-(?:setup|live|message|state)/,'timer engine does not own Practice Pacer DOM rendering');
assert.doesNotMatch(timer,/parsePracticeUnitPlan\s*\(/,'timer engine does not own Practice Pacer parsing algorithms');
assert.doesNotMatch(pacer,/Date\.now\(\)/,'Practice Pacer decision timing must use its injected clock');
assert.doesNotMatch(timer,/Date\.now\(\)/,'Timer state-machine timing must use its injected clock');
console.log(JSON.stringify({status:'PASS',boundary:'practice-pacer',pureModel:true,timerOrchestrationOnly:true},null,2));
}

{ // presentation-surface-boundary
const app=fs.readFileSync('source/app.html','utf8');
assert.match(app,/<html[^>]*data-presentation="glass"[^>]*data-typography="glass"[^>]*data-shape="glass"[^>]*data-material="glass"[^>]*data-depth="glass"/u,'Glass must be the pre-hydration presentation before bootstrap JavaScript runs.');
const core=fs.readFileSync('source/styles/core.css','utf8');
const glass=fs.readFileSync('source/external/glass.js','utf8');
const insights=fs.readFileSync('source/external/insights.js','utf8');
const editorSource=fs.readFileSync('rich-text/editor.ts','utf8');
const editorBundle=fs.readFileSync('source/external/rich-text.js','utf8');

for(const token of ['--sd-material-inset','--sd-material-canvas','--sd-depth-inset','--sd-depth-canvas']){
  assert.match(app,new RegExp(token.replaceAll('-','\\-')),
    `presentation manifest exposes ${token}`);
}
for(const token of ['--sd-shape-inset-radius','--sd-shape-canvas-radius']){
  assert.match(app,new RegExp(token.replaceAll('-','\\-')),
    `presentation manifest exposes ${token}`);
}
assert.match(core,/\.ui-inset\{[^}]*var\(--sd-shape-inset-radius\)[^}]*var\(--sd-material-inset\)/s,
  'shared inset primitive is presentation-token governed');
assert.match(core,/\.ui-canvas\{[^}]*var\(--sd-shape-canvas-radius\)[^}]*var\(--sd-material-canvas\)/s,
  'shared canvas primitive is presentation-token governed');

for(const marker of [
  'reflection-workbench ui-canvas',
  'library-notes-grid ui-canvas',
  'attachment-grid ui-canvas',
  'attachment-progress ui-inset',
  'pomodoro-rhythm ui-panel',
  'focus-rhythm ui-panel',
  'break-meter ui-inset',
  'review-collapse review-blocks-collapse ui-panel'
]) assert.ok(app.includes(marker),`screenshot surface uses shared presentation primitive: ${marker}`);
assert.ok(app.includes('class="focus-setting" id="wake-setting"'),'screen wake shares the aligned settings row');
assert.ok(app.includes('class="focus-setting" id="system-alert-setting"'),'device notifications share the aligned settings row');
assert.doesNotMatch(core,/#pane-execute\[data-session-state="empty"\] \.execute-ops-grid\{display:none/,'settings remain available before a session');
assert.ok(app.includes('library-notes-grid library-diary-grid ui-canvas'),'Diary uses shared content canvas');

assert.doesNotMatch(core,/\.break-meter\{[^}]*(?:background|border):/s,
  'Break elapsed delegates material and geometry to the shared inset primitive');
assert.match(core,/\.review-blocks-collapse\{[^}]*--panel-bg:var\(--sd-material-review-collapse\)[^}]*--panel-padding:[^}]*--panel-shadow:var\(--sd-depth-review-collapse\)/s,
  'Today’s Blocks delegates its panel material, geometry and depth through ui-panel variables');
assert.doesNotMatch(core,/\.review-blocks-collapse\{[^}]*(?:background|border:|clip-path|border-radius):/s,
  'Today’s Blocks cannot bypass the shared panel primitive with local surface geometry');
assert.match(core,/\.review-collapse>summary \.review-section-title\{margin-bottom:0\}/,
  'Review disclosure titles share one alignment reset so Today’s Blocks and Unfinished Note align consistently');
assert.doesNotMatch(core,/\.review-unfinished>summary \.review-section-title\{margin-bottom:0\}/,
  'Review title alignment is not duplicated in the Unfinished Note specialization');
assert.match(core,/\.library-note-nav-item\.support-note\.active\{[^}]*border-left-color:var\(--sd-color-info\)[^}]*background:var\(--sd-state-info-bg\)/s,
  'selected Support Activities note uses the semantic cyan info state');
assert.match(core,/\.library-note-nav-item\.support-note\.active \.library-note-nav-name\{color:var\(--sd-color-info\)\}/,
  'selected Support Activities label is cyan');
assert.doesNotMatch(core,/\.library-note-nav-item\.support-note\.has-note/,
  'Support Activities is not permanently cyan when merely present');

assert.doesNotMatch(core,/\.attachment-grid\{[^}]*--sd-shape-control-radius/s,
  'attachment browser cannot borrow button geometry');
assert.doesNotMatch(core,/\.attachment-progress\{[^}]*--sd-shape-control-radius/s,
  'attachment progress cannot borrow button geometry');
assert.doesNotMatch(core,/\.reflection-workbench\{[^}]*(?:linear-gradient|--sd-color-surface-1)/s,
  'reflection workbench cannot own a hard-coded material');
assert.doesNotMatch(core,/\.library-notes-grid\{[^}]*(?:linear-gradient|--sd-color-surface-1)/s,
  'library notes/diary canvas cannot own a hard-coded material');

assert.match(glass,/--sd-shape-control-radius:11px/,'Glass controls use rounded-rectangle geometry');
assert.match(glass,/--sd-shape-chip-radius:999px/,'Glass chips retain pill geometry');
assert.match(glass,/--sd-shape-canvas-radius:8px/,'Glass content canvases use restrained geometry');
assert.match(glass,/--sd-shape-panel-radius:22px/,'Glass major panels use the major-surface geometry');
assert.match(core,/#cd\.paused\{opacity:var\(--sd-countdown-paused-content-opacity/,
  'paused Timer contrast is presentation-controlled');
assert.match(glass,/--sd-countdown-paused-content-opacity:\.68/,
  'Glass restores paused Timer legibility');
assert.doesNotMatch(glass,/html\[data-material="glass"\] \.library-notes-grid\{/,
  'Glass does not maintain a parallel Library canvas implementation');

// Shared notices use the coordinator's existing compact semantic in every presentation,
// while skin-specific surface geometry remains confined to Glass.
assert.match(app,/region\.dataset\.noticeCompact=active&&active\.compact\?'true':'false'/,
  'notice renderer exposes the coordinator compact semantic to presentation CSS');
assert.match(app,/function noticeCanCompact\(message\)\{[^}]*text\.length<=160/s,
  'short single-line safety/storage notices are classified compact without a second notice system');
assert.doesNotMatch(app,/kind:'(?:safety|storage)'[^}]*compact:false/,
  'safety/storage notices no longer force the wide notice geometry');
assert.match(core,/\.notice-region\[data-notice-compact="true"\]\{width:fit-content;max-width:min\(680px,calc\(100% - 28px\)\)\}/,
  'shared desktop notice geometry shrinks compact notices to their content');
assert.match(core,/@media \(max-width: 500px\)\{[\s\S]*?\.notice-region,\.notice-region\[data-notice-compact="true"\]\{width:calc\(100% - 20px\);max-width:none/s,
  'compact notices retain the existing near-full-width mobile geometry');
assert.match(glass,/html\[data-presentation="glass"\]\[data-shape="glass"\] \.execute-command-rail \.ctrl-block,[\s\S]*?\.progress-rail\{border-radius:var\(--sd-shape-card-radius\)\}/,
  'Glass rounds Timer command/progress cards through the Glass card token only');
assert.match(glass,/html\[data-presentation="glass"\]\[data-shape="glass"\] \.pwa-update-control,[\s\S]*?\.ownership-banner\{border-radius:var\(--sd-shape-floating-radius\)\}/,
  'Glass rounds direct floating notification surfaces through the Glass floating token only');
assert.doesNotMatch(core,/\.execute-command-rail \.ctrl-block\{[^}]*border-radius|\.progress-rail\{[^}]*border-radius|\.ownership-banner\{[^}]*border-radius|\.pwa-update-control\{[^}]*border-radius/s,
  'Director/core geometry remains free of Glass-specific radius overrides');
assert.match(glass,/html\[data-presentation="glass"\] #pane-execute \.execute-note-desk \.pnote-hdr\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) 26px[\s\S]*?html\[data-presentation="glass"\] #pane-execute \.execute-note-desk \.pnote-title\{[\s\S]*?font-size:var\(--sd-type-role-section-size\)[\s\S]*?letter-spacing:\.01em/s,
  'Glass Ongoing Notes header reserves the sync slot and restores Glass typography at every width');
assert.match(glass,/@media\(max-width:560px\)\{[\s\S]*?#pane-execute \.execute-note-desk \.pnote-title\{font-size:clamp\(1rem,5vw,var\(--sd-type-role-metric-size\)\)\}/s,
  'Glass narrows only the Ongoing Notes title size on small screens');
assert.match(glass,/html\[data-presentation="glass"\] \.focus-rhythm-title,[\s\S]*?\.backup-section-title,[\s\S]*?\.execute-overlay-kicker,[\s\S]*?\.interaction-eyebrow\{letter-spacing:var\(--sd-type-label-tracking\)\}/s,
  'Glass section and overlay labels consume the shared Glass tracking token');
assert.doesNotMatch(core,/pnote-title[^}]*clamp\(1rem,5vw|execute-note-desk \.pnote-hdr[^}]*grid-template-columns:minmax\(0,1fr\) 26px/s,
  'Director Ongoing Notes typography/layout is not changed by the Glass correction');

// Plan draft rows use one coherent control geometry rather than browser/intrinsic sizing.
assert.match(core,/\.plan-draft-fields\{[^}]*--plan-draft-control-height:36px[^}]*grid-template-columns:minmax\(180px,2fr\) repeat\(6,minmax\(88px,1fr\)\)[^}]*align-items:stretch/s,
  'wide fine-pointer Plan draft rows keep the established seven-field semantic grid and own their control-height token');
assert.match(core,/\.si-card\{[^}]*flex:1;min-width:0;/s,
  'schedule cards may shrink within the Plan pane instead of exporting child min-content overflow');
assert.match(core,/\.sched-list\{[^}]*padding-left:88px[^}]*\}[\s\S]*?\.sched-list::before\{[^}]*left:60px[^}]*width:2px[\s\S]*?\.si::before\{[\s\S]*?left:-20px[\s\S]*?\.si-time\{[^}]*left:-88px[^}]*width:54px/s,
  'desktop Plan timeline keeps modest separation between time labels, guide line and block markers');
assert.match(core,/\.plan-draft-field\{[^}]*width:100%[^}]*min-width:0[^}]*height:var\(--plan-draft-control-height\)[^}]*min-height:var\(--plan-draft-control-height\)[^}]*line-height:1\.2/s,
  'Plan draft field types share one explicit outer size contract');
assert.match(core,/@media \(any-pointer:coarse\) and \(min-width:721px\)\{[\s\S]*?#pane-plan \.plan-draft-field\{border:1px solid var\(--field-local-border,var\(--sd-line-neutral-control\)\)\}/s,
  'touch-capable tablet Plan fields use one visual field boundary even when the primary pointer is fine');
assert.match(core,/\.plan-draft-action\{[^}]*width:36px[^}]*height:36px[^}]*display:inline-flex[^}]*align-items:center[^}]*justify-content:center/s,
  'Plan row icon actions share the field-scale control geometry on pointer devices');
assert.match(core,/@media \(max-width: 1319px\)\{[\s\S]*?\.plan-draft-fields\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}[\s\S]*?\.plan-draft-field\.name\{grid-column:1 \/ -1\}/s,
  'generic medium-width Plan rows retain the conservative two-column fallback until a pointer-specific composition overrides it');
assert.match(core,/@media \(any-pointer:coarse\) and \(min-width:721px\)\{[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields\{[\s\S]*?--plan-draft-control-height:max\(var\(--_sd-touch-min,44px\),var\(--sd-density-touch-target,0px\)\);[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\);[\s\S]*?grid-template-areas:[\s\S]*?"name name name"[\s\S]*?"start dur kind"[\s\S]*?"area measure target"[\s\S]*?#pane-plan \.si\.draft \.si-right\{display:none\}/s,
  'touch-capable tablets use the available width as a three-column editor and enforce one touch-class control height');
assert.match(core,/@media \(hover:none\) and \(pointer:coarse\)\{[\s\S]*?#pane-plan \.plan-draft-fields\{--plan-draft-control-height:max\(var\(--_sd-touch-min,44px\),var\(--sd-density-touch-target,0px\)\)\}/s,
  'coarse-pointer Plan editors use one uniform touch-class control height at every responsive width');
assert.doesNotMatch(core,/@media \(hover:none\) and \(pointer:coarse\) and \(min-width: 901px\)\{[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/s,
  'coarse-pointer tablets must not reintroduce the brittle four-column Plan override removed in L18I');
assert.match(core,/@supports \(-webkit-touch-callout:none\)\{[\s\S]*?@media \(min-width:721px\)[\s\S]*?#pane-plan input\.plan-draft-field\[type="time"\]\{[\s\S]*?-webkit-appearance:none;appearance:none;[\s\S]*?height:var\(--plan-draft-control-height\);min-height:var\(--plan-draft-control-height\);max-height:var\(--plan-draft-control-height\);[\s\S]*?::-webkit-date-and-time-value\{[\s\S]*?height:100%;min-height:0[\s\S]*?display:flex;align-items:center[\s\S]*?::-webkit-datetime-edit\{[\s\S]*?padding:0;line-height:1\.2/s,
  'iPadOS Plan start-time controls keep type=time but normalize the closed WebKit chrome to the same field height');
assert.match(core,/@media \(max-width: 560px\)\{[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);[\s\S]*?grid-template-areas:[\s\S]*?"name name"[\s\S]*?"start dur"[\s\S]*?"kind kind"[\s\S]*?"area area"[\s\S]*?"measure target"[\s\S]*?gap:9px 8px;[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields>\.start\{grid-area:start\}[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields>\.dur\{grid-area:dur\}[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields>\.measure\{grid-area:measure\}[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields>\.target\{grid-area:target\}/s,
  'Phone Plan rows explicitly pair Start/Duration and Measure/Target while Task, Kind and Area remain full width');

// Motion remains part of the Presentation contract, but native snapshot View Transitions are retired.
for(const token of ['--sd-motion-workspace-open-duration','--sd-motion-workspace-close-duration','--sd-motion-workspace-ease','--sd-motion-feedback-duration','--sd-motion-feedback-ease','--sd-motion-anchored-transition']){
  assert.ok(app.includes(token),`presentation manifest exposes ${token}`);
  assert.ok(core.includes(token),`core presentation profile defines ${token}`);
}
for(const source of [app,core,glass,insights,fs.readFileSync('source/core/navigation.js','utf8'),fs.readFileSync('source/core/library.js','utf8'),fs.readFileSync('source/external/guide.js','utf8')]){
  assert.doesNotMatch(source,/startViewTransition|viewTransitionName|::view-transition|sd-secondary-view|sd-main-view/,
    'native View Transition snapshot machinery is fully absent from the runtime');
}
assert.doesNotMatch(app,/motion:\s*PRESENTATION_KERNEL\.motion|PRESENTATION_KERNEL\.motion/,
  'Presentation no longer exposes a snapshot-transition runtime API');
assert.ok(app.includes('present:presentTabCommit'),'navigation retains one presentation boundary for state/focus arbitration');
const tabPresentation=app.slice(app.indexOf('async function presentTabCommit'),app.indexOf('async function prepareTabDeparture'));
assert.match(tabPresentation,/const result=await update\(\);/,
  'primary tab presentation commits directly on the live DOM');
assert.ok(insights.includes('ready:view.ready'),'lazy Insights exposes an explicit stable-shell navigation readiness hook');
assert.doesNotMatch(insights,/motion\.replace|presentation\?\.motion/,
  'Insights execution switching cannot reintroduce native snapshot transitions');
assert.match(core,/\.interaction-toast\{[^}]*var\(--sd-motion-feedback-duration\)[^}]*var\(--sd-motion-feedback-ease\)/s,
  'toast feedback timing is owned by the semantic Presentation motion contract');
assert.doesNotMatch(core,/\.interaction-toast\{[^}]*(?:\.15s|150ms)[^}]*\}/s,
  'toast feedback does not retain component-local timing literals');
assert.match(core,/:is\([^)]*\.pnote-info-popover[^)]*\.display-tools-menu[^)]*\.copy-report-menu[^)]*\.plan-field-popover[^)]*\.saved-plan-menu-popover[^)]*\.sd-rte-menu[^)]*\)\{transition:var\(--sd-motion-anchored-transition\);animation:none\}/s,
  'geometry-sensitive anchored menus/popovers remain explicitly immediate');
assert.doesNotMatch(fs.readFileSync('source/core/workspace-overlay.js','utf8'),/presentation\.interrupt|interrupt.*snapshot/,
  'workspace overlays have no dead snapshot-interruption dependency');
assert.doesNotMatch(fs.readFileSync('source/core/interactions.js','utf8'),/presentation.*interrupt|interrupt.*snapshot/,
  'interaction prompts have no dead snapshot-interruption dependency');
assert.doesNotMatch(fs.readFileSync('source/external/guide.js','utf8'),/replaceGuidePanel|motion\.replace|appearance\.presentation\.motion/,
  'Guide structural replacements update the live DOM directly');
assert.doesNotMatch(fs.readFileSync('source/core/library.js','utf8'),/transition\(\{oldElement|motion\.replace/,
  'Library saved-day replacement updates the live DOM directly');
assert.doesNotMatch(app,/FloatingTimer|documentPictureInPicture|minimise-timer|sd-floating-timer/,
  'retired manual/fallback floating-timer and Document PiP UI cannot re-enter the application shell');
assert.doesNotMatch(core,/sd-floating-timer|sd-floating-window/,
  'retired floating-timer presentation styles are fully removed');

// Lazy Insights must consume the same presentation primitives as the host app rather than
// recreating a parallel material/shape system inside its injected stylesheet.
for(const marker of [
  'insights-section-nav ui-inset',
  'insights-section-nav-btn ui-btn',
  'insights-execution-tabs ui-inset',
  'insights-execution-tab ui-btn',
  'insights-coach-evidence ui-inset',
  'insights-coach-evidence-item ui-canvas',
  'insights-definition-item ui-canvas',
  'insights-definition-strip ui-inset',
  'insights-fitness-context ui-inset',
  'insights-dynamics-supporting ui-inset',
  'insights-chart-widget ui-canvas'
]) assert.ok(insights.includes(marker),`Insights consumes shared presentation primitive: ${marker}`);
assert.match(insights,/\.insights-day-structure\{grid-template-columns:1fr\}/,
  'Insights collapses day structure before nested maintenance cards become quarter-width');
assert.match(insights,/\.insights-day-structure \.insights-section-title\{display:grid;gap:4px;align-items:start\}/,
  'Insights section title cannot squeeze its descriptive copy into a narrow horizontal column');
assert.doesNotMatch(glass,/\.insights-(?:section-nav|definition-item|practice|fitness|brain|chart)\b/,
  'Glass does not maintain a parallel Insights component implementation');
assert.doesNotMatch(insights,/border-radius:/,
  'Insights does not own generic component radius geometry outside the presentation system');
assert.match(insights,/\.insights-table\{[^}]*min-width:0[^}]*max-width:100%[^}]*overflow-x:auto[^}]*overscroll-behavior-x:contain/s,
  'Insights tables own bounded internal horizontal scrolling at every viewport width');
assert.match(insights,/\.insights-dossier-section\{[^}]*min-width:0[^}]*max-width:100%/s,
  'Analytics Lab sections cannot expand the page to satisfy table min-content width');
assert.match(insights,/\.insights-dynamics-lab\{[^}]*min-width:0[^}]*max-width:100%/s,
  'Analytics Lab shell participates in min-width containment at desktop widths');
assert.match(insights,/\.insights-dossier-grid\{[^}]*min-width:0[^}]*max-width:100%/s,
  'Analytics Lab dossier grid cannot propagate table min-content width to the page');
assert.match(insights,/\.insights-progressive-host\{[^}]*min-width:0[^}]*max-width:100%/s,
  'progressive Analytics Lab tables remain bounded inside their host');
assert.doesNotMatch(insights,/\.insights-dynamics-lab \.insights-table\{[^}]*overflow-x:auto/s,
  'Analytics Lab does not carry a breakpoint-specific duplicate table scrolling implementation');
assert.doesNotMatch(insights,/\.insights-table\{display:grid;max-width:100%;min-width:0\}/,
  'mobile Insights CSS does not duplicate base table containment declarations');
for(const match of insights.matchAll(/el\('button',\s*(['\"])(.*?)\1/g)){
  assert.match(match[2],/(?:^|\s)ui-btn(?:\s|$)/,`Insights button bypasses shared ui-btn primitive: ${match[2]}`);
}

// Every rich-text surface shares one toolbar contract: the formatting rail may scroll,
// the utility/focus group is a fixed sibling, and scrollability is visibly discoverable.
for(const text of [editorSource,editorBundle]){
  assert.ok(text.includes('sd-rte-toolbar-rail-shell'),'rich-text toolbar has a dedicated overflow shell');
  assert.ok(text.includes('sd-rte-toolbar-rail'),'rich-text formatting controls use a dedicated scroll rail');
  assert.ok(text.includes('sd-rte-toolbar-group-utility'),'rich-text focus control has a fixed utility group');
  assert.ok(text.includes('overflowLeft'),'rich-text toolbar tracks left overflow state');
  assert.ok(text.includes('overflowRight'),'rich-text toolbar tracks right overflow state');
  assert.ok(text.includes('sd-rte-toolbar-group-history'),'rich-text history controls use the compact shared group');
}
assert.match(editorSource,/toolbarRail\.append\([^)]*tableTools/,
  'table controls remain inside the intentional scrolling rail');
assert.match(editorSource,/toolbar\.appendChild\(utilityGroup\)/,
  'Focus Mode remains a sibling of the scrolling rail and therefore permanently reachable');
assert.match(editorSource,/toolbarRail\.scrollLeft=/,
  'table-context auto-reveal intentionally scrolls the formatting rail');
assert.ok(editorSource.includes('.workspace-overlay-rich-text .sd-rte-focus-body>.sd-rte .sd-rte-editor-host{grid-row:1;height:auto;min-height:0;align-self:stretch}'),
  'Focus Mode owns editor-host height with enough specificity to override normal per-surface sizing');
assert.ok(editorBundle.includes('.workspace-overlay-rich-text .sd-rte-focus-body>.sd-rte .sd-rte-editor-host{grid-row:1;height:auto;min-height:0;align-self:stretch}'),
  'generated rich-text bundle preserves the shared Focus Mode height override');


// Execute is the workspace/surface vocabulary; Timer remains reserved for genuine timing behavior.
const guideSource=fs.readFileSync('source/external/guide.js','utf8');
assert.match(guideSource,/GUIDE_ORDER=Object\.freeze\(\['plan','execute','review','library','insights'\]\)/,
  'Guide lifecycle uses Execute as the canonical workspace id');
assert.match(guideSource,/\s*execute:guideSection\(\{\s*label:"Execute"/,
  'Guide section registry exposes the Execute workspace under the Execute key');
assert.doesNotMatch(guideSource,/\s*timer:guideSection\(\{\s*label:"Execute"/,
  'Guide must not retain the historical Timer workspace key');
for(const stale of ['timer-state-overlay','timer-overlay-kicker','timer-overlay-title','timer-overlay-sub','timer-overlay-action','timer-open-plan','data-note-source="timer"','timerIdleDisplayKey','refreshTimerIdleDisplay','showTimerWaitingState','setTimerShellVisible','setTimerControlsEnabled','setTimerOverlay','clearTimerOverlay']){
  assert.ok(!app.includes(stale),`Execute surface must not retain historical ${stale} vocabulary`);
}
for(const stale of ['--sd-color-timer-','--sd-rgb-timer-','--timer-lime','--timer-blue','--timer-amber','--timer-red','--timer-text','--timer-danger']){
  assert.ok(!core.includes(stale)&&!glass.includes(stale),`Execute palette must not retain historical ${stale} tokens`);
}
console.log(JSON.stringify({status:'PASS',boundary:'presentation-surfaces',levels:['panel','inset','canvas'],glassGoverned:true,insightsGoverned:true,editorToolbarGoverned:true},null,2));
}

{ // runtime-energy-boundary
const timer=fs.readFileSync('source/core/timer-engine.js','utf8');
const ownership=fs.readFileSync('source/core/ownership.js','utf8');
const app=fs.readFileSync('source/app.html','utf8');
const review=fs.readFileSync('source/core/review.js','utf8');
const provider=fs.readFileSync('source/core/backup-provider.js','utf8');
const background=fs.readFileSync('source/core/repository-background.js','utf8');
const device=fs.readFileSync('source/core/device-backup.js','utf8');
const css=fs.readFileSync('source/styles/core.css','utf8');
const architecture=fs.readFileSync('contracts/data-architecture.mjs','utf8');
const drive=fs.readFileSync('source/external/drive.js','utf8');
assert.doesNotMatch(timer,/requestAnimationFrame\(step\)[\s\S]{0,240}requestAnimationFrame\(step\)/u,'Timer progress must not run a perpetual display-rate RAF loop.');
assert.match(timer,/The one-second timer tick already advances progress/u);
assert.match(ownership,/if\(!\(renewing&&hasControl\)\)setPrimary/u,'Ownership heartbeat renewal must not replay primary UI hooks.');
assert.match(app,/TIMER_SNAPSHOT_INTERVAL_MS=60\*1000/u,'Routine active-session crash checkpoints must use the agreed one-minute cadence.');
assert.match(review,/const REVIEW_SAVE_DEBOUNCE_MS=450/u,'Review reflection and study-quality edits must retain the 450 ms priority persistence window.');
assert.match(review,/function persistReviewBinding[\s\S]{0,520}saveLiveDraft\(\{markChanged:false,delayMs:REVIEW_SAVE_DEBOUNCE_MS/u,'Review autosave must use Active Session persistence rather than a separate Reflection Draft repository.');
assert.match(app,/review:currentReviewSnapshot\(\)/u,'Active Session snapshots must carry the current Review reflection and study quality.');
assert.match(app,/function flushLiveDraft\(options=\{\}\)[\s\S]{0,520}writeLiveDraftNow\(\{\.\.\.pending,emergency:true\}\)/u,'Review/page-exit flushes must use the existing emergency Active Session recovery path.');
assert.match(app,/window\.addEventListener\('pagehide',[\s\S]{0,180}flushPendingReviewSave\(\{strict:false\}\)/u,'Page hide must flush pending Review state before asynchronous work can be suspended.');
assert.match(app,/async function recoverPreviousSessionForReview\(session\)[\s\S]{0,520}applyStoredSessionSnapshot\(session,reviewSnapshot,\{source:'previous-session-review',reviewOnly:true\}\)/u,'Forgotten previous-day sessions must recover their Review state from Active Session.');
assert.match(app,/function applyStoredSessionSnapshot\(session,snapshot,[\s\S]{0,1500}snapshotReview:snapshot\.review/u,'Lifecycle reconciliation must hydrate Review from ActiveSession.snapshot.review.');
assert.match(app,/async function restoreSessionStateThroughLifecycle\(importedSession,scheduleText=''\)/u,'Portable Active Session restore must use the lifecycle host.');
assert.match(app,/const restored=applyStoredSessionSnapshot\(session,snapshot,\{source:'restore-journal-rollback',lifecycleManaged:true\}\);[\s\S]{0,180}setSessionPanelMode\('active'\)/u,'Restoring an active portable session must apply its saved schedule/runtime before exposing the active session UI.');
assert.match(app,/const expectedFingerprint=activeSessionScheduleFingerprint\(session\);[\s\S]{0,180}!TASKS\.length\|\|scheduleFingerprint\(\)!==expectedFingerprint/u,'Post-restore verification must require the Active Session schedule to be the live applied Plan.');
assert.match(app,/TimerState\.mode!==TIMER_MODES\.RUNNING\|\|TimerState\.paused/u,'A backed-up running timer must verify as genuinely RUNNING after restore.');
assert.match(app,/cross-device inactive interval/u,'Running cross-device restore must protect a long handoff interval instead of silently counting it as focus.');
assert.match(app,/TimerState\.mode!==TIMER_MODES\.PAUSED\|\|!TimerState\.paused/u,'A backed-up paused timer must verify as genuinely PAUSED after restore.');
assert.match(review,/async function saveDayRecord\(\)[\s\S]{0,1100}captureTodayState\(\)[\s\S]{0,260}await flushLiveDraft\(\)[\s\S]{0,260}commitDailyRecord/u,'Save Today must flush Active Session Review state before committing the canonical DailyRecord.');
assert.match(review,/async function handleStudyDayRollover\(\)[\s\S]{0,1100}saveReviewState\(\{markChanged:false,strict:true\}\)[\s\S]{0,220}await flushLiveDraft\(\)[\s\S]{0,220}commitDailyRecord/u,'Automatic rollover must use the same Review-to-ActiveSession-to-DailyRecord path.');
assert.match(app,/if\(current\?\.recordKind==='study'\)[\s\S]{0,260}AppData\.dailyRecords\.save\(\{\.\.\.current,reflection:candidate/u,'Study-Day Diary edits must persist directly into the existing DailyRecord reflection.');
assert.match(app,/const DailyReflectionPersistence=[\s\S]*createDiaryRecord\(date,candidate[\s\S]{0,260}AppData\.dailyRecords\.save\(diary/u,'Diary-only reflections must reuse the existing DailyRecord store rather than creating a second persistence family.');
assert.doesNotMatch(review,/reflectionDrafts|AppData\.reflectionDraft|ReflectionDraft/u,'Current Review runtime must not depend on the retired Reflection Draft domain.');
assert.doesNotMatch(app,/ACTIVE_SESSION_ASSET_MAINTENANCE_DELAY_MS/u,'Routine active-session checkpoints must not own an attachment-maintenance timer.');
assert.match(app,/canonicalCommitChangesAttachmentReferences/u,'Attachment maintenance must be gated by reference changes rather than every canonical commit.');
assert.match(app,/else if\(type==='activeSession'\)\{identity=String\(value&&value\.id\|\|ACTIVE_SESSION_ID\);text=String\(value&&value\.snapshot&&value\.snapshot\.review&&value\.snapshot\.review\.reflection\|\|''\);\}/u,'Active Session attachment tracking must inspect only the current Review reflection now that unsaved Reflection state lives there.');
assert.match(app,/if\(referencesChanged&&event\?\.backupCapture!==true\)\{[\s\S]{0,140}scheduleRichTextAssetMaintenance\(\)/u,'Active Session checkpoints may schedule attachment maintenance only when their Review attachment-reference signature actually changes, and never recursively during backup capture.');
assert.match(app,/function scheduleDailyAttachmentMaintenance\(\)\{[\s\S]{0,180}if\(!appCanMutate\(\)\)return false/u,'The daily orphan sweep must be owned by the primary instance so a secondary startup cannot consume the day gate.');
const dailyAttachmentMaintenance=app.slice(app.indexOf('function scheduleDailyAttachmentMaintenance('),app.indexOf('function installApplicationDomBindings('));
assert.match(dailyAttachmentMaintenance,/scheduleRichTextAssetMaintenance\(0\)/u,'The delayed daily opportunity must request the verified sweep.');
assert.doesNotMatch(dailyAttachmentMaintenance,/AppData\.local\.setText/u,'Scheduling or starting an attempt must not certify daily cleanup.');
assert.match(app,/completed:\(\)=>\{if\(!AppData\.local\.setText\(STORAGE_KEYS\.attachmentMaintenanceDay,todayISO\(\)\)\|\|!AppData\.local\.remove\(STORAGE_KEYS\.attachmentMaintenancePending\)\)throw/u,'Only completed cleanup may durably consume the daily success gate; failed storage writes must remain retryable.');
assert.match(architecture,/attachmentMaintenanceDay:'studyDirector\.attachmentMaintenanceDay\.v2'/u,'Daily attachment-maintenance startup gating must use a declared local-storage identity.');
assert.match(app,/pane-plan'\)\?\.classList\.contains\('on'\)\)updateRealTimeAwareness/u,'The global second clock must not repaint hidden Plan realtime UI.');
assert.match(app,/pane-execute'\)\?\.classList\.contains\('on'\)\)refreshExecuteIdleDisplay/u,'The global second clock must not repaint hidden Execute idle UI.');
assert.match(provider,/maintenanceWorkBudgetMs:PROVIDER_MAINTENANCE_BUDGET_MS[\s\S]*budgetMs:PROVIDER_MAINTENANCE_BUDGET_MS/u,'Remote repository maintenance must derive and enforce the shared 30-second hard work budget.');
assert.match(background,/const PRIORITY=freeze\(\{integrity:10,maintenance:20,automatic:30,convergence:40\}\)[\s\S]*scheduled=new Map\(\),active=new Map\(\)/u,'Drive maintenance, integrity scrub and deferred convergence must be explicitly tracked by the shared coordinator so foreground work can pre-empt them.');
assert.match(background,/function beginForeground[\s\S]*suspendTimers\(\)[\s\S]*row\.controller\.abort[\s\S]*waitForSettlement\(waiting,controller\.signal\)/u,'Shared foreground ownership must disarm queued background starts and abort/await active maintenance, integrity and convergence work before continuing.');
assert.match(provider,/async function saveRepositoryProvider\(selected,[\s\S]{0,280}if\(preemptBackground\)await preemptProviderBackground\(selected\)/u,'Repository publication must take priority over active background repository work.');
assert.match(provider,/async function loadRepositoryProvider\(selected,[\s\S]*?await preemptProviderBackground\(selected\);[\s\S]*?repositoryOperationSelected\(selected/u,'Foreground provider recovery must take priority over active background repository work.');
assert.doesNotMatch(provider,/PROVIDER_GC_RETRY_MS/u,'Retired high-frequency remote GC polling must not return.');
assert.match(background,/graceMs:6\*60\*60\*1000[\s\S]*nextEligibleAt[\s\S]*reason[\s\S]*gc-grace/u,'Deferred Drive GC must preserve an explicit eligibility deadline through the shared maintenance state instead of becoming immediately actionable on restart.');
assert.match(provider,/cleanup:deferredMaintenance\?async\(\)=>\{if\(!maintenanceNeeded\)return[\s\S]*scheduler\?\.request\('repository-state',MAINTENANCE_POLICY\.busyMs[\s\S]*finally\{if\(publicationLease\)\{[\s\S]*await endRepositoryPublication/u,'Committed Drive publication must queue maintenance through the shared scheduler while keeping publication-marker release on the awaited foreground boundary.');
assert.match(background,/function arm\(entry\)\{[\s\S]*if\(!entry\|\|foreground\|\|suspensions\.size[\s\S]*function beginForeground[\s\S]*suspendTimers\(\)[\s\S]*release:[\s\S]*foreground=null;resumeTimers\(\)/u,'Foreground ownership must keep queued repository maintenance disarmed until the foreground operation has fully released.');
assert.match(provider,/finally\{[\s\S]{0,220}await release\(selected,'export'\);setBusy\(false\);foreground\.release\(\);[\s\S]{0,120}if\(backgroundAfter\)scheduleProviderIntegrityScrub\(selected,1500\);\}/u,'Drive integrity may be offered after provider busy state and shared foreground ownership are released; presentation detachment may occur before scheduler handoff.');
assert.match(drive,/function release\(\)\{clearPickerMetadata\(\);if\(accessToken&&Date\.now\(\)>=tokenExpiresAt\)clearSession\(\);\}/u,'Drive operation release must retain an unexpired access token so bounded post-operation maintenance can use the existing authorization.');
assert.doesNotMatch(provider,/PROVIDER_BUSY_RETRY_MS/u,'Retired timed provider busy polling must not remain after background work became opportunistic and foreground-pre-emptible.');
assert.match(device,/if\(scheduledUrgent\|\|scheduledRetry\|\|!urgent\)return true/u,'Routine dirty commits must not re-arm an already scheduled Device Folder backup.');
assert.match(css,/--sd-motion-progress-transition:width var\(--sd-motion-duration-progress\) linear/u,'Timer progress must regain smooth CSS interpolation without a display-rate JavaScript loop.');
console.log(JSON.stringify({status:'PASS',suite:'runtime-energy-boundary',silentHeartbeat:true,timerRafBounded:true,sessionCheckpoint60s:true,attachmentMaintenanceReferenceDriven:true,dailyAttachmentSweep:true,activeSessionAssetGcReferenceDriven:true,hiddenPaneTicksBounded:true,providerMaintenanceBounded:true,providerMaintenancePreemptible:true,driveAuthorizationRetained:true,deviceScheduleStable:true,smoothCssProgress:true}));
}

assert.doesNotMatch(fs.readFileSync('source/core/timer-engine.js','utf8'),/startCueDelayMs/,'start cue spacing must not rely on delayed callbacks');
