import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('source/app.html','utf8');
const coreCss=fs.readFileSync('source/styles/core.css','utf8');
const glassCss=fs.readFileSync('source/external/glass.js','utf8');
const guideJs=fs.readFileSync('source/external/guide.js','utf8');

assert.match(coreCss,/html\[data-theme="director-light"\]\{[\s\S]*?--sd-color-canvas:#eef1ec;[\s\S]*?--sd-color-surface-1:#f8f9f5;/u,'Director Light must use the low-glare off-white foundation rather than a pure-white primary surface.');
assert.match(html,/<style data-sd-critical>html\{[\s\S]*?--sd-meta-theme-color:#04050a;[\s\S]*?--sd-meta-apple-status-bar-style:black-translucent;[\s\S]*?background:#04050a;color:#f0f2ff\}html\[data-theme="director-light"\]\{[\s\S]*?--sd-meta-theme-color:#eef1ec;[\s\S]*?--sd-meta-apple-status-bar-style:default;[\s\S]*?background:#eef1ec;color:#161a26\}/u,'critical appearance bootstrap must expose matching browser-chrome metadata for Dark and Light before the full stylesheet loads.');
const criticalStyleIndex=html.indexOf('<style data-sd-critical>');
const metadataSyncIndex=html.indexOf("window[Symbol.for('studyDirector.presentationKernel.v1')].synchronizeMetadata();",criticalStyleIndex);
const coreStyleIndex=html.indexOf('<link rel="stylesheet" href="@@SD_CORE_STYLE_FILENAME@@">');
assert.ok(criticalStyleIndex>=0&&metadataSyncIndex>criticalStyleIndex&&coreStyleIndex>metadataSyncIndex,'saved-theme browser chrome must synchronize from critical CSS before the full stylesheet is requested.');
assert.equal((html.match(/\.synchronizeMetadata\(\);/g)||[]).length,1,'first-paint metadata synchronization must have one canonical call site.');
assert.match(html,/function persistProtectedPreferences\(overrides=\{\}\)\{[\s\S]*?if\('theme' in overrides\|\|'presentation' in overrides\|\|'fontScale' in overrides\)void flushProtectedPreferences\(\)\.catch\(\(\)=>\{\}\);[\s\S]*?else scheduleProtectedPreferencesWrite\(\);/u,'appearance changes must bypass the debounce so canonical persistence settles before its startup mirror is refreshed.');

assert.match(coreCss,/@media \(any-pointer:coarse\) and \(min-width:721px\)\{[\s\S]*?#pane-plan \.si\.draft \.plan-draft-fields\{[\s\S]*?--plan-draft-control-height:max\(var\(--_sd-touch-min,44px\),var\(--sd-density-touch-target,0px\)\);[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\);[\s\S]*?"start dur kind"[\s\S]*?"area measure target"/u,'touch-capable tablets must use the three-column Plan composition even when iPadOS reports a fine primary pointer.');
assert.doesNotMatch(coreCss,/@media \(hover:none\) and \(pointer:coarse\) and \(min-width: 901px\)\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/u,'large touch devices must not reacquire the brittle dense Plan grid.');
assert.match(coreCss,/@supports \(-webkit-touch-callout:none\)\{[\s\S]*?@media \(min-width:721px\)\{[\s\S]*?#pane-plan input\.plan-draft-field\[type="time"\]\{[\s\S]*?-webkit-appearance:none;appearance:none;[\s\S]*?height:var\(--plan-draft-control-height\);[\s\S]*?max-height:var\(--plan-draft-control-height\);[\s\S]*?::-webkit-date-and-time-value\{[\s\S]*?height:100%;[\s\S]*?display:flex;align-items:center/u,'iPadOS Plan time inputs must retain type=time while normalizing the closed WebKit control to the same fixed field height.');
assert.match(coreCss,/@media \(max-width: 650px\)\{[\s\S]*?\.backup-file-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/u,'Data & Backup compact actions must engage at the shared compact breakpoint rather than only on very narrow phones.');
assert.match(coreCss,/@media \(hover:none\) and \(pointer:coarse\)\{[\s\S]*?input\.ui-field,textarea\.ui-field,select\.ui-field,\.copy-report-control \.copy-report-menu-btn,[\s\S]*?\.backup-model-disclosure>summary,\.backup-advanced-disclosure>summary,[\s\S]*?min-height:max\(var\(--_sd-touch-min\),var\(--sd-density-control-min-height,0px\)\)!important/u,'direct mobile fields, Copy Report menu and Backup disclosures must retain the 44px coarse-pointer touch invariant.');
assert.match(coreCss,/\.copy-report-control \.copy-report-menu-btn\{display:inline-grid;place-items:center;[\s\S]*?line-height:1\}\.copy-report-control \.copy-report-menu-btn::before\{content:"";display:block;width:7px;height:7px;border-right:1\.5px solid currentColor;border-bottom:1\.5px solid currentColor;transform:rotate\(45deg\);transform-origin:center\}/u,'Copy Report must use a font-independent CSS chevron centered by the split-button grid.');
assert.match(coreCss,/\.pnote-title-row\{display:flex;align-items:baseline;/u,'Ongoing Notes title and Area context must share a typographic baseline.');
assert.doesNotMatch(glassCss,/\.pnote-title-row\{[^}]*align-items:(?:flex-start|center|flex-end)/u,'Glass must inherit the shared typographic baseline instead of centering the Area context.');
assert.doesNotMatch(html,/id="backup-freshness-(?:status|separator)"/u,'backup rows must not repeat the last-verified summary in a third line');
assert.doesNotMatch(html,/renderVerifiedRecoveryFreshness|currentRecoveryCopyState/u,'removed global backup freshness projection must not leave dead save or drawer callbacks');
assert.doesNotMatch(coreCss,/#pane-execute \.execute-note-desk \.pnote-title-row\{align-items:(?:flex-start|center|flex-end)\}/u,'Execute must not override Ongoing Notes baseline alignment with box-edge alignment.');
assert.match(coreCss,/\.managed-version-history\{[\s\S]*?max-height:min\(calc\(100dvh - 28px\),760px\);[\s\S]*?overflow:hidden\}\s*\.managed-version-history\[open\]\{display:flex;flex-direction:column\}/u,'Version History must be viewport-bounded and use a column layout while open.');
assert.match(coreCss,/\.managed-version-history-list\{display:grid;flex:1 1 auto;min-height:0;[\s\S]*?overflow:auto/u,'Version History must shrink and scroll the checkpoint list instead of clipping modal controls.');
assert.doesNotMatch(coreCss,/\.managed-version-history-list\{[^}]*max-height:/u,'Version History list must not have an independent viewport-height cap that can overrun the dialog chrome.');
assert.match(guideJs,/@media\(hover:none\) and \(pointer:coarse\)\{\.guide-life-node,\.guide-map-tab,\.legal-center-nav-button\{min-height:var\(--_sd-touch-min,44px\)\}/u,'Guide legal navigation must meet the coarse-pointer 44px touch target.');

assert.match(glassCss,/--sd-glass-field-alpha:\.52;/u,'Glass fields must retain stronger material density for text legibility.');
assert.match(glassCss,/\.pnote-info-popover\{[\s\S]*?--sd-glass-readable-alpha/u,'Glass information popovers must use the readability material.');
assert.match(glassCss,/\.library-notes-nav-head\{[\s\S]*?--sd-glass-sticky-alpha/u,'sticky Ongoing Notes controls must remain legible over scrolling content.');
assert.match(glassCss,/backup-location-row,\.backup-inline-settings,\.backup-compact-row,\.backup-security-group/u,'Data & Backup operational surfaces must consume the Glass material language without changing their semantic hierarchy.');
assert.match(glassCss,/backup-model-disclosure,\.backup-advanced-disclosure/u,'The consolidated Backup model disclosure must use the same Glass disclosure material as Advanced.');

console.log(JSON.stringify({status:'PASS',contract:'presentation-source-contracts',paths:['prepaint-appearance','prepaint-browser-chrome','touch-minimums','execute-note-alignment','copy-report-centering','version-history-scroll','guide-touch','low-glare-light','tablet-plan-grid','compact-backup-layout','glass-legibility']},null,2));
