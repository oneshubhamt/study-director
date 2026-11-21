import {readScript} from '../../../build/source-script.mts';
const foundation=readScript('source/core/foundation-host.ts');
import {readHostHtml} from '../../../build/host-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=readHostHtml();
const planJs=fs.readFileSync('source/core/plan.ts','utf8');
const coreCss=fs.readFileSync('source/styles/core.css','utf8');
const presentationHost=readScript('source/core/presentation-host.ts');
const glassCss=readScript('source/external/glass.ts');
const auroraCss=readScript('source/external/aurora.ts');
const guideJs=readScript('source/external/guide.ts');

assert.match(coreCss,/html\[data-theme="light"\]\{[\s\S]*?--sd-color-canvas:#f2f0ea;[\s\S]*?--sd-color-surface-1:#fcfbf8;/u,'Director Light must use the low-glare off-white foundation rather than a pure-white primary surface.');
assert.match(html,/<style data-sd-critical>html\{[\s\S]*?--sd-meta-theme-color:#04050a;[\s\S]*?--sd-meta-apple-status-bar-style:black-translucent;[\s\S]*?background:#04050a;color:#f0f2ff\}html\[data-theme="light"\]\{[\s\S]*?--sd-meta-theme-color:#f2f0ea;[\s\S]*?--sd-meta-apple-status-bar-style:default;[\s\S]*?background:#f2f0ea;color:#0f1013\}/u,'critical appearance bootstrap must expose matching browser-chrome metadata for Dark and Light before the full stylesheet loads.');
const criticalStyleIndex=html.indexOf('<style data-sd-critical>');
const metadataBootstrapIndex=html.indexOf("const key=Symbol.for('studyDirector.presentationKernel.v1');",criticalStyleIndex);
const metadataSyncIndex=html.indexOf('value.synchronizeMetadata();',metadataBootstrapIndex);
const coreStyleIndex=html.indexOf('<link rel="stylesheet" href="@@SD_CORE_STYLE_FILENAME@@">');
assert.ok(criticalStyleIndex>=0&&metadataBootstrapIndex>criticalStyleIndex&&metadataSyncIndex>metadataBootstrapIndex&&coreStyleIndex>metadataSyncIndex,'saved-theme browser chrome must synchronize from the checked metadata bootstrap and critical CSS before the full stylesheet is requested.');
assert.equal((html.match(/value\.synchronizeMetadata\(\);/g)||[]).length,1,'first-paint metadata synchronization must have one canonical call site.');
assert.match(html,/function persistProtectedPreferences\(overrides=\{\}\)\{[\s\S]*?if\('theme' in overrides\|\|'presentation' in overrides\|\|'fontScale' in overrides\)void flushProtectedPreferences\(\)\.catch\(\(\)=>\{\}\);[\s\S]*?else scheduleProtectedPreferencesWrite\(\);/u,'appearance changes must bypass the debounce so canonical persistence settles before its startup mirror is refreshed.');
const preferenceFlushStart=html.indexOf('async function flushProtectedPreferences(');
const preferenceFlushEnd=html.indexOf('function scheduleProtectedPreferencesWrite()',preferenceFlushStart);
const preferenceFlush=html.slice(preferenceFlushStart,preferenceFlushEnd);
assert.ok(preferenceFlushStart>=0&&preferenceFlushEnd>preferenceFlushStart,'protected-preference flush must remain present for presentation persistence.');
assert.ok(preferenceFlush.indexOf('const saved=await run;')<preferenceFlush.indexOf('refreshAppearanceMirrors(saved)'),'first-paint mirrors advance only after canonical preference persistence succeeds.');
assert.match(preferenceFlush,/if\(protectedPreferencesState===snapshot\)\{acceptProtectedPreferences\(saved\);refreshAppearanceMirrors\(saved\);\}/u,'a delayed appearance write must commit mirrors only when the exact in-memory preference snapshot is still current.');
assert.doesNotMatch(preferenceFlush,/protectedPreferencesState\.updatedAt===snapshot\.updatedAt/u,'stale-write fencing must not depend on millisecond timestamp uniqueness.');
assert.match(preferenceFlush,/catch\(error\)\{[\s\S]*?protectedPreferencesDirty=true;protectedPreferencesWriteFailure=error;[\s\S]*?throw error;/u,'a failed appearance write remains dirty/retryable and does not masquerade as durable success.');

assert.match(coreCss,/@media \(any-pointer:coarse\) and \(min-width:721px\)\{[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields\{[\s\S]*?--plan-draft-control-height:max\(var\(--_sd-touch-min,44px\),var\(--sd-density-touch-target,0px\)\);[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\);[\s\S]*?"start dur kind"[\s\S]*?"area measure target"/u,'touch-capable tablets must use the three-column Plan composition even when iPadOS reports a fine primary pointer.');
assert.doesNotMatch(coreCss,/@media \(hover:none\) and \(pointer:coarse\) and \(min-width: 901px\)\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/u,'large touch devices must not reacquire the brittle dense Plan grid.');
assert.match(coreCss,/@supports \(-webkit-touch-callout:none\)\{[\s\S]*?@media \(min-width:721px\)\{[\s\S]*?#pane-plan input\.plan-draft-field\[type="time"\]\{[\s\S]*?-webkit-appearance:none;appearance:none;[\s\S]*?height:var\(--plan-draft-control-height\);[\s\S]*?max-height:var\(--plan-draft-control-height\);[\s\S]*?::-webkit-date-and-time-value\{[\s\S]*?height:100%;[\s\S]*?display:flex;align-items:center/u,'iPadOS Plan time inputs must retain type=time while normalizing the closed WebKit control to the same fixed field height.');
assert.match(coreCss,/@media \(max-width: 650px\)\{[\s\S]*?\.backup-file-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/u,'Data & Backup compact actions must engage at the shared compact breakpoint rather than only on very narrow phones.');
assert.match(coreCss,/@media \(hover:none\) and \(pointer:coarse\)\{[\s\S]*?input\.ui-field,textarea\.ui-field,select\.ui-field,\.copy-report-control \.copy-report-menu-btn,[\s\S]*?\.backup-model-disclosure>summary,\.backup-advanced-disclosure>summary,[\s\S]*?min-height:max\(var\(--_sd-touch-min\),var\(--sd-density-control-min-height,0px\)\)!important/u,'direct mobile fields, Copy Report menu and Backup disclosures must retain the 44px coarse-pointer touch invariant.');
assert.match(coreCss,/\.copy-report-control \.copy-report-menu-btn\{display:inline-grid;place-items:center;[\s\S]*?line-height:1\}\.copy-report-control \.copy-report-menu-btn::before\{content:"";display:block;width:7px;height:7px;border-right:1\.5px solid currentColor;border-bottom:1\.5px solid currentColor;transform:rotate\(45deg\);transform-origin:center\}/u,'Copy Report must use a font-independent CSS chevron centered by the split-button grid.');
assert.match(coreCss,/\.theme-btn,\.presentation-btn,\.type-btn\{[^}]*color:var\(--sd-color-text-accessible-muted\)/u,'inactive appearance controls must use the accessible muted text role.');
for(const [action,label] of [['font-smaller','A-, decrease text size'],['font-reset','A, reset text size'],['font-larger','A+, increase text size']]){
  assert.ok(html.includes(`data-action="${action}"`)&&html.includes(`aria-label="${label}"`),`${action} accessible name must contain its visible label.`);
}
assert.match(coreCss,/\.pnote-title-row\{display:flex;align-items:baseline;/u,'Notes title and Area context must share a typographic baseline.');
assert.match(coreCss,/\.pnote-share-inline\{[^}]*color:var\(--sd-color-accent-primary\);opacity:1\}/u,'Area-share context must retain full semantic accent contrast across presentation themes.');
assert.doesNotMatch(glassCss,/\.pnote-title-row\{[^}]*align-items:(?:flex-start|center|flex-end)/u,'Glass must inherit the shared typographic baseline instead of centering the Area context.');
assert.doesNotMatch(html,/id="backup-freshness-(?:status|separator)"/u,'backup rows must not repeat the last-verified summary in a third line');
assert.doesNotMatch(html,/renderVerifiedRecoveryFreshness|currentRecoveryCopyState/u,'removed global backup freshness projection must not leave dead save or drawer callbacks');
assert.doesNotMatch(coreCss,/#pane-execute \.execute-note-desk \.pnote-title-row\{align-items:(?:flex-start|center|flex-end)\}/u,'Execute must not override notes baseline alignment with box-edge alignment.');
assert.match(coreCss,/\.managed-version-history\{[\s\S]*?max-height:min\(calc\(100dvh - 28px\),760px\);[\s\S]*?overflow:hidden\}\s*\.managed-version-history\[open\]\{display:flex;flex-direction:column\}/u,'Version History must be viewport-bounded and use a column layout while open.');
assert.match(coreCss,/\.managed-version-history-list\{display:grid;flex:1 1 auto;min-height:0;[\s\S]*?overflow:auto/u,'Version History must shrink and scroll the checkpoint list instead of clipping modal controls.');
assert.doesNotMatch(coreCss,/\.managed-version-history-list\{[^}]*max-height:/u,'Version History list must not have an independent viewport-height cap that can overrun the dialog chrome.');
assert.match(guideJs,/@media\(hover:none\) and \(pointer:coarse\)\{\.guide-life-node,\.guide-map-tab,\.legal-center-nav-button\{min-height:var\(--_sd-touch-min,44px\)\}/u,'Guide legal navigation must meet the coarse-pointer 44px touch target.');

assert.match(glassCss,/--sd-glass-field-alpha:\.52;/u,'Glass fields must retain stronger material density for text legibility.');
assert.match(glassCss,/\.pnote-info-popover\{[\s\S]*?--sd-glass-readable-alpha/u,'Glass information popovers must use the readability material.');
assert.match(glassCss,/\.library-notes-nav-head\{[\s\S]*?--sd-glass-sticky-alpha/u,'sticky notes controls must remain legible over scrolling content.');
assert.match(glassCss,/backup-location-row,\.backup-inline-settings,\.backup-compact-row,\.backup-security-group/u,'Data & Backup operational surfaces must consume the Glass material language without changing their semantic hierarchy.');
assert.match(glassCss,/backup-model-disclosure,\.backup-advanced-disclosure/u,'The consolidated Backup model disclosure must use the same Glass disclosure material as Advanced.');

assert.match(glassCss,/html\[data-presentation="glass"\]\[data-theme="dark"\]\{[\s\S]*?--sd-color-accent-primary:[\s\S]*?--sd-glass-aurora:/u,'Glass Dark must own its palette and aurora rather than reuse the Director palette.');
assert.match(glassCss,/html\[data-presentation="glass"\]\[data-theme="light"\]\{[\s\S]*?--sd-color-accent-primary:[\s\S]*?--sd-glass-aurora:/u,'Glass Light must own its palette and aurora rather than reuse the Director palette.');
assert.match(glassCss,/html\[data-material="glass"\] body::before\{[\s\S]*?position:fixed;[\s\S]*?pointer-events:none;[\s\S]*?var\(--sd-glass-aurora/u,'the Glass aurora must be one fixed, non-interactive layer that never scrolls or repaints with content.');
assert.match(coreCss,/\.pane\.on\[data-sd-enter\]>\*\{animation:var\(--sd-motion-pane-enter-name\) var\(--sd-motion-pane-enter-duration\) var\(--sd-motion-pane-enter-ease\) backwards\}/u,'pane entrances must use backwards fill so no transform or opacity persists after the entrance.');
assert.match(coreCss,/@media \(prefers-reduced-motion: reduce\)\{[\s\S]*?\.pane\.on\[data-sd-enter\]>\*\{animation:none!important\}/u,'reduced motion must remove pane entrances entirely, including staggered delays.');
assert.match(glassCss,/--sd-motion-pane-enter-name:sd-pane-enter-float;/u,'Glass must present its own pane entrance.');
assert.match(foundation,/pane\.classList\.add\('on'\);[^\n]*\n\s*if\(previousTab!==tabName\)markPaneEntrance\(pane\);/u,'only a real tab change may mark a pane entrance.');
assert.match(presentationHost,/function runAppearanceChange\([^)]*\)[^{]*\{[\s\S]*?prefers-reduced-motion: reduce[\s\S]*?\{change\(\);return;\}[\s\S]*?typeof document\.startViewTransition!=='function'\)\{beginAppearanceShift\(\);change\(\);return;\}/u,'checked presentation host owns immediate reduced-motion changes and the fallback colour crossfade.');
assert.match(presentationHost,/catch\{\s*settle\(\);change\(\);\s*\}/u,'a synchronous View Transition failure must clear reveal attributes and custom properties before falling back.');
assert.match(presentationHost,/function clearAppearanceReveal\(revision:number\):void\{[\s\S]*?if\(revision!==appearanceRevealRevision\)return;[\s\S]*?function runAppearanceChange[\s\S]*?const revision=\+\+appearanceRevealRevision;[\s\S]*?const settle=\(\)=>clearAppearanceReveal\(revision\);/u,'appearance reveal cleanup must be revision-fenced so an older View Transition cannot clear a newer transition’s shared reveal state.');
assert.doesNotMatch(html,/function runAppearanceChange\(/u,'unchecked main host must not retain appearance-transition behavior.');
assert.match(coreCss,/html\[data-sd-appearance-reveal\]::view-transition-old\(root\)\{animation:none;[\s\S]*?html\[data-sd-appearance-reveal\] \*,html\[data-sd-appearance-reveal\] \*::before,html\[data-sd-appearance-reveal\] \*::after\{transition:none!important\}/u,'the reveal holds the old view still and settles the live new view without replaying control transitions.');
assert.match(glassCss,/html\[data-presentation="glass"\]\[data-sd-appearance-reveal\]::view-transition-new\(root\)\{[\s\S]*?mask-image:radial-gradient/u,'Glass reveals appearance changes as a feathered bloom.');
assert.match(coreCss,/\.pfield input\{\s*--field-local-border:var\(--sd-color-border-2\);\s*border:2px solid var\(--field-local-border\);/u,'progress fields must draw their local border colour instead of currentColor.');

assert.doesNotMatch(coreCss,/text-transform:uppercase/u,'capitalisation is a typography role: rules must use --sd-type-transform-title/label/control so every skin can restyle them in one place.');
assert.match(coreCss,/--sd-type-caps-tracking-scale:1;/u,'Director keeps its capitals tracking through the shared scale.');
assert.match(glassCss,/--sd-type-caps-tracking-scale:0;/u,'Glass drops capitals tracking through the shared scale rather than per-selector patches.');

assert.match(coreCss,/html\[data-theme="light"\]\[data-presentation="director-current"\] :is\(#pane-execute \.cd-card,#pane-review \.review-hero,#pane-plan \.si\.active \.si-card\)\{\s*color-scheme:dark;[\s\S]*?--sd-color-accent-primary:#e8ff00;/u,'Director Light heroes are dark instrument islands that re-declare the semantic roles their children read.');
assert.match(glassCss,/html\[data-presentation="glass"\]\[data-theme="light"\] :is\(#pane-execute \.cd-card,#pane-review \.review-hero\)\{\s*color-scheme:dark;/u,'Glass Light heroes are colour islands rather than recoloured light surfaces.');
assert.match(coreCss,/html\[data-theme="light"\]\[data-presentation="director-current"\] #pane-plan \.si\.active \.si-card:hover:not\(\.no-hover\)\{background:var\(--card-bg\)\}/u,'the dark active Plan row keeps its island background on hover so its light text stays readable.');
assert.match(glassCss,/@property --sd-aurora-a\{syntax:"<color>"/u,'Glass aurora colours are registered so area moods interpolate.');
assert.match(glassCss,/\[data-theme="dark"\]\[data-sd-area="execute"\] body::before\{--sd-aurora-a:/u,'each area sets its own Glass atmosphere.');
// The glide restyles the background layer only; inherited aurora colours on
// the document made every tab change restyle the whole page each frame.
assert.doesNotMatch(glassCss,/@property --sd-aurora-[abcd]\{[^}]*inherits:true/u,'aurora colours must not inherit.');
assert.match(glassCss,/html\[data-material="glass"\] body::before\{\s*transition:--sd-aurora-a/u,'the aurora glide runs on the background layer.');
assert.match(foundation,/function markPaneEntrance\(pane\s*\)\{[\s\S]*?if\(pane\.id==='pane-insights'&&\(!pane\.firstElementChild\|\|pane\.querySelector\('\.plugin-loading-panel'\)\)\)return;/u,'Insights arrives still only while it renders behind its loading panel; a kept view animates like any pane.');
assert.match(foundation,/markPaneEntrance\(pane\);\n\s*document\.documentElement\.dataset\['sdArea'\]=tabName;/u,'navigation publishes the active area for presentation atmospheres.');
assert.doesNotMatch(coreCss,/--row-name-color:rgba\(/u,'plan row names must not be dimmed with alpha below readable contrast.');

assert.match(auroraCss,/const PROFILE\s*=\s*Object\.freeze\(\{\s*contractVersion:2,\s*id:'aurora',\s*label:'Aurora',\s*typography:'aurora',\s*shape:'aurora',\s*material:'aurora',\s*depth:'aurora',/u,'Aurora is its own presentation profile.');
assert.doesNotMatch(auroraCss,/data-(?:presentation|typography|shape|material|depth)="glass"|presentation==='glass'/u,'Aurora is an independent snapshot: no rule may depend on Glass, so reimagining Glass never changes it.');
assert.match(html,/<script src="@@SD_EXTERNAL_GLASS_FILENAME@@"><\/script>\n<script src="@@SD_EXTERNAL_AURORA_FILENAME@@"><\/script>/u,'Aurora loads synchronously beside Glass so a saved Aurora choice paints without a flash.');
for(const [label,pack,marker] of [['Glass',glassCss,'glass'],['Aurora',auroraCss,'aurora']]){
  assert.match(pack,/function ensureStyle\(\)[\s\S]*?document\.getElementById\(STYLE_ID\)[\s\S]*?document\.head\.appendChild\(style\)/u,`${label} pack stylesheet installation is idempotent.`);
  assert.match(pack,/function registerPack\(\)[\s\S]*?ensureStyle\(\);const registered=kernel\.registerPresentation\(PROFILE\);if\(registered\)kernel\.synchronizeMetadata\(\);return registered;/u,`${label} registration is owned by the checked startup pack and immediately resynchronizes browser chrome after pack CSS activates.`);
  assert.match(pack,/if\(!install\(\)\)window\.addEventListener\('studydirector:ready',[\s\S]*?once:true/u,`${label} retries DOM coordination at the ready boundary.`);
  assert.match(pack,/DISPLAY_TOOLS_CLOSE_EVENT='studydirector:displaytoolsclose'[\s\S]*?winner\?\.blocksTools&&!displayMenu\.hidden[\s\S]*?window\.dispatchEvent\(new Event\(DISPLAY_TOOLS_CLOSE_EVENT\)\)/u,`${label} must ask the checked Display Tools owner to close its popover before using the defensive direct-hide fallback.`);
  const markerGuard=pack.indexOf(`dataset['${marker}OverlayCoordinator']==='installed'`),observerCreation=pack.indexOf('new MutationObserver(schedule)');
  assert.ok(markerGuard>=0&&observerCreation>markerGuard,`${label} coordinator marker must short-circuit before observer creation.`);
}
assert.match(presentationHost,/function refreshMirrors\([^)]*\)[^{]*\{[\s\S]*?preferences\.mirror-write/u,'checked presentation host owns first-paint mirror refresh failure handling.');
assert.match(presentationHost,/function closeDisplayTools\(\):boolean\{[\s\S]*?displayToolsPopover\.hide\(\);return true;[\s\S]*?window\.addEventListener\('studydirector:displaytoolsclose',closeDisplayTools\)/u,'checked presentation host must own forced Display Tools closure so popover state and listeners settle through their controller.');
assert.match(presentationHost,/function toggleDisplayTools\([^)]*\)[^{]*\{[\s\S]*?display-tools-menu[\s\S]*?popovers\.create/u,'checked presentation host owns display-tools interaction.');
assert.match(html,/function registerPresentationPack\(definition\)\{return requirePresentationRuntime\(\)\.registerPresentation\(definition\);\}/u,'main keeps presentation-pack registration as thin composition.');

assert.doesNotMatch(html,/presentationId:'director-current'/u,'themes own light/dark roles only and must not name a skin.');
assert.match(coreCss,/html\[data-theme="light"\]\[data-presentation="director-current"\] #cd\{/u,'Director-specific light styling is scoped to the Director skin, not to the theme.');
for(const token of ['--sd-motion-surface-duration','--sd-motion-surface-ease','--sd-motion-surface-start','--sd-motion-disclosure-duration','--sd-motion-moment-duration']){
  assert.ok(coreCss.includes(`${token}:`),`core motion profile defines ${token}`);
  assert.ok(glassCss.includes(`${token}:`)&&auroraCss.includes(`${token}:`),`Glass and Aurora retune ${token}`);
}
assert.match(coreCss,/\.si\.sd-just-done \.si-card\{animation:sd-moment-settle var\(--sd-motion-moment-duration\) ease-out var\(--sd-moment-offset,0ms\) both\}/u,'the completion moment resumes through its offset when the board rebuilds.');
assert.match(planJs,/completionMomentElapsed\(`\$\{i\}\|\$\{t\.name\}`,!!scheduleGateway\.row\(i\)\.done\)[\s\S]*?animationend[\s\S]*?classList\.remove\('sd-just-done'\)/u,'only a row seen incomplete then complete gets the moment, and it is cleared after playing so re-showing the pane cannot replay it.');
assert.match(coreCss,/@media \(prefers-reduced-motion: reduce\)\{[\s\S]*?\.si\.sd-just-done \.si-card,\.si\.sd-just-done \.si-chk\{animation:none!important\}[\s\S]*?html\{--sd-motion-press-transform:none!important\}[\s\S]*?::details-content\{transition:none!important\}/u,'reduced motion removes the completion moment, press motion and disclosure unfolding.');

console.log(JSON.stringify({status:'PASS',contract:'presentation-source-contracts',paths:['checked-presentation-host','pack-ready-retry','overlay-observer-dedup','prepaint-appearance','prepaint-browser-chrome','touch-minimums','execute-note-alignment','copy-report-centering','version-history-scroll','guide-touch','low-glare-light','tablet-plan-grid','compact-backup-layout','glass-legibility','glass-palettes','glass-aurora','pane-entrance','appearance-shift','appearance-reveal','typography-roles','hero-islands','area-atmosphere','readable-plan-rows','aurora-snapshot','theme-skin-separation','motion-system','progress-field-border']},null,2));
