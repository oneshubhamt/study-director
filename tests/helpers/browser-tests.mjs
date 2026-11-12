// alone: why the test must run with no other browser test running ('' when it
// may run concurrently). tests/README.md "Browser test reliability" has the rules.
const test=(id,script,coverage,timeoutMs=0,{alone=''}={})=>Object.freeze({id,script,coverage:Object.freeze(coverage),timeoutMs,alone});

export const BROWSER_TEST_MANIFEST=Object.freeze({
  smoke:Object.freeze([
    test('core-flow','tests/browser/app/core-flow.mjs',['plan','execute','review','library','indexeddb','backup']),
    test('next-morning-saved-day','tests/browser/app/next-morning-saved-day.mjs',['execute','review','library','active-session','recovery','indexeddb']),
    test('session-draft-edit','tests/browser/app/session-draft-edit.mjs',['plan','execute','practice-pacer','backup']),
    test('session-merge-timer','tests/browser/app/session-merge-timer.mjs',['execute','sync','active-session']),
    test('storage-census','tests/browser/app/storage-census.mjs',['diagnostics','indexeddb','opfs','cache-storage']),
    test('notes-management','tests/browser/library/notes-management.mjs',['library','notes']),
    test('attachment-editor','tests/browser/attachments/attachment-editor.mjs',['attachments','pdf','audio','rich-editor','overlay']),
    test('restore-session-safety','tests/browser/backup/restore-session-safety.mjs',['backup','restore','execute','library','recovery','multi-tab','ownership','reflection']),
    test('exports','tests/browser/exports/exports.mjs',['export','worker','backup','files','cancellation','images']),
    test('saved-plans-ui','tests/browser/plans/saved-plans-ui.mjs',['plan','saved-plans','ui']),
    test('pwa-offline','tests/browser/pwa/pwa-offline.mjs',['pwa','offline','service-worker']),
    test('rich-editor-interaction-coherence','tests/browser/rich-text/rich-editor-interactions.mjs',['rich-editor','wordgard','keyboard','nested-list','toolbar','table','atomic-nodes','image','selection','mobile','desktop']),
    test('image-persistence','tests/browser/rich-text/image-persistence.mjs',['rich-editor','wordgard','native-file-selection','indexeddb','reload']),
    test('multi-tab-handoff','tests/browser/storage/multi-tab.mjs',['multi-tab','ownership','indexeddb'])
  ]),
  feature:Object.freeze([
    test('library-selection','tests/browser/library/library-selection.mjs',['library','selection']),
    test('app-sounds','tests/browser/ui/app-sounds.mjs',['sound','audio','notifications']),
    test('complete-encrypted-library','tests/browser/backup/complete-library.mjs',['encryption','attachments','opfs','recovery','trusted-types','pwa']),
    test('backup-encryption','tests/browser/backup/encryption.mjs',['encryption','password','files','cancellation','recovery','worker'],0,{alone:'Not yet diagnosed: under concurrent load the password dialog did not open in time.'}),
    test('pwa-device-backup','tests/browser/backup/pwa-device-backup.mjs',['pwa','device-backup']),
    test('sync-and-profiles','tests/browser/backup/sync-and-profiles.mjs',['sync','google-drive','two-devices','reload','activation','profiles'],300000),
    test('sync-kept-reviews','tests/browser/backup/sync-kept-reviews.mjs',['sync','google-drive','two-devices','pending-reviews','restore'],300000),
    test('cold-start-drive-recovery','tests/browser/backup/cold-start-drive-recovery.mjs',['sync','google-drive','site-data-clear','recovery','indexeddb'],300000,{alone:'Like site-data-clear: the app gives up opening IndexedDB after two 2.5 s attempts, and right after a storage clear that reopen can take longer on a busy CPU.'}),
    test('session-plan-sync','tests/browser/backup/session-plan-sync.mjs',['sync','google-drive','two-devices','active-session','plan','takeover'],300000,{alone:'Two-device ownership handoff has deliberate network gates and short post-claim timing assertions; unrelated Chromium CPU load can delay the local continuation path without testing a synchronization invariant.'}),
    test('sync-journeys','tests/browser/backup/sync-journeys.mjs',['sync','google-drive','two-devices','active-session','takeover','offline','freeze','connect-card'],300000,{alone:'Two browsers through a day of handoffs with held, offline and frozen devices; it measures that the old owner stops within one 10 s session check, which CPU load from another browser test would blur.'}),
    test('session-release-journey','tests/browser/backup/session-release-journey.mjs',['sync','google-drive','two-devices','active-session','takeover'],240000,{alone:'Two browsers hand over a session while the new owner\'s upload is held back; timing-sensitive under load.'}),
    test('handoff-data-journey','tests/browser/backup/handoff-data-journey.mjs',['sync','google-drive','two-devices','active-session','takeover','plan','notes','offline'],300000,{alone:'Two browsers hand a session back and forth with held uploads and an offline device, like sync-journeys.'}),
    test('next-morning-other-device','tests/browser/backup/next-morning-other-device.mjs',['sync','google-drive','two-devices','active-session','recovery'],240000,{alone:'Two browsers share one simulated Drive and wait on sync timing, like finish-today-journey.'}),
    test('finish-today-journey','tests/browser/backup/finish-today-journey.mjs',['sync','google-drive','two-devices','active-session','review','practice-pacer'],240000,{alone:'Two browsers share one simulated Drive and wait on sync timing, like session-release-journey.'}),
    test('session-handoff-journeys','tests/browser/backup/session-handoff-journeys.mjs',['sync','google-drive','three-devices','active-session','takeover','clock-skew'],300000,{alone:'Three browsers hand a running session back and forth within seconds and time each Continue Here; CPU load from another browser test would blur those timings.'}),
    test('insights-populated','tests/browser/insights/insights-populated-ui.mjs',['insights','populated-history']),
    test('pwa-update','tests/browser/pwa/pwa-update.mjs',['pwa','service-worker','trusted-types','multi-tab','offline','recovery','update'],0,{alone:'Chromium activates a new service worker only when the old one is idle and the CPU has time; diagnosed and fixed, kept alone as a safeguard.'}),
    test('image-clipboard-bridge','tests/browser/rich-text/image-bridge.mjs',['rich-editor','wordgard','native-file-selection','clipboard-image','selection','asset-storage']),
    test('image-controls','tests/browser/rich-text/image-controls.mjs',['rich-editor','image','controls','mobile']),
    test('image-resize-toolbar-coherence','tests/browser/rich-text/image-resize-toolbar.mjs',['rich-editor','wordgard','image','resize','toolbar','contrast','mobile','desktop']),
    test('contextual-link','tests/browser/rich-text/link-context.mjs',['rich-editor','wordgard','link','popover','selection','keyboard','lifecycle']),
    test('mobile-rich-editor','tests/browser/rich-text/mobile-rich-editor.mjs',['rich-editor','wordgard','mobile','touch','viewport','focus-mode','popup','checklist','accessibility']),
    test('native-overlays','tests/browser/rich-text/native-overlays.mjs',['popover','anchor-positioning','fallback','keyboard','selection','focus-mode','lifecycle']),
    test('paste-sanitization','tests/browser/rich-text/paste-sanitization.mjs',['rich-editor','wordgard','paste','sanitization','heading','table-header','schema']),
    test('rich-editor-completion','tests/browser/rich-text/rich-editor-completion.mjs',['rich-editor','wordgard','heading','checklist','table-header','table-direct-resize','image-alt','limits','accessibility']),
    test('table-resize-context-coherence','tests/browser/rich-text/table-resize-controls.mjs',['rich-editor','wordgard','table','resize','toolbar','selection','mobile','desktop']),
    test('typography-refinement','tests/browser/rich-text/typography-refinement.mjs',['rich-editor','typography','popover','alignment','image','persistence','desktop']),
    test('workspace-overlay','tests/browser/rich-text/workspace-overlay.mjs',['rich-editor','focus-mode','overlay','pdf']),
    test('runtime-boundary','tests/browser/security/runtime-boundary.mjs',['security','trusted-types','paste','worker','execute','backup-protection','legal-center','export-worker']),
    test('storage-failures','tests/browser/storage/storage-failure-recovery.mjs',['storage','failure-injection','recovery']),
    test('site-data-clear','tests/browser/storage/site-data-clear.mjs',['storage','site-data-clear','recovery','indexeddb','notifications','reload'],0,{alone:'The app gives up opening IndexedDB after two 2.5 s attempts (persistence.js); right after a storage clear that reopen can take longer on a busy CPU.'}),
    test('upgrade-renamed-names','tests/browser/storage/upgrade-renamed-names.mjs',['storage','upgrade','compatibility','indexeddb','notes','reload']),
    test('unsupported-data','tests/browser/storage/unsupported-data.mjs',['storage','compatibility','indexeddb','profiles','reload'],240000),
    test('interactions','tests/browser/ui/interactions.mjs',['dialogs','history','navigation','keyboard','notifications']),
    test('notification-stack','tests/browser/ui/notification-stack.mjs',['notifications','stack','recent','mobile','touch','keyboard','reload']),
    test('profile-panel','tests/browser/ui/profile-panel.mjs',['profile','recent','notifications','rename','mobile','keyboard','reload'])
  ]),
  extended:Object.freeze([
    test('attachment-library','tests/browser/attachments/attachments.mjs',['attachments','pdf','audio','opfs','references','streaming','atomic-import','trusted-types'],180000),
    test('insights-performance','tests/browser/insights/insights-performance.mjs',['insights','performance','worker','progressive-rendering','fallback'],0,{alone:'This suite enforces wall-clock and long-task performance budgets, so it must run without another browser workload competing for CPU.'}),
    test('maximum-insights','tests/browser/insights/insights-maximum-import.mjs',['insights','maximum-import']),
    test('notes-at-limit','tests/browser/library/notes-at-limit.mjs',['library','notes','performance','capacity','search','tags','backup'],240000,{alone:'This test enforces startup wall-clock and keystroke latency budgets at two thousand notes; concurrent Chromium workloads would measure shared CPU contention instead of this app.'}),
    test('production-capacity','tests/browser/storage/capacity.mjs',['capacity','restore','reload','re-export','rollback'],300000),
    test('rich-editor-hotpath','tests/browser/rich-text/rich-editor-hotpath.mjs',['rich-editor','performance','persistence'],120000,{alone:'This test enforces tight editor typing wall-clock budgets under dense tables and near-limit prose; shared Chromium load invalidates the latency measurement.'}),
    test('lifecycle-concurrency-memory','tests/browser/rich-text/image-memory.mjs',['rich-editor','wordgard','memory','lifecycle','background','image','multi-editor']),
    test('rich-editor-readonly-maintenance','tests/browser/rich-text/readonly-maintenance.mjs',['rich-editor','wordgard','readonly','image','lifecycle','asset-storage','markdown','table','maintenance','performance']),
    test('table-capacity-15x15','tests/browser/rich-text/table-capacity.mjs',['rich-editor','wordgard','table','capacity','15x15','toolbar','persistence','mobile','accessibility','responsive']),
    test('populated-accessibility','tests/browser/ui/populated-accessibility.mjs',['axe','dark','light','desktop','mobile','zoom','keyboard','plan','execute','review','library','insights'])
  ])
});

const allTests=()=>[...BROWSER_TEST_MANIFEST.smoke,...BROWSER_TEST_MANIFEST.feature,...BROWSER_TEST_MANIFEST.extended];
const domainOf=entry=>entry.script.split('/')[2]||'';

export function selectedBrowserTests(tier='smoke',domain=''){
  const normalized=String(tier||'smoke').toLowerCase();
  let selected;
  if(normalized==='smoke')selected=[...BROWSER_TEST_MANIFEST.smoke];
  else if(normalized==='feature')selected=[...BROWSER_TEST_MANIFEST.feature];
  else if(normalized==='extended')selected=[...BROWSER_TEST_MANIFEST.extended];
  else if(normalized==='release')selected=allTests();
  else throw new Error(`Unknown browser-test tier: ${tier}`);
  const normalizedDomain=String(domain||'').trim().toLowerCase();
  return normalizedDomain?selected.filter(entry=>domainOf(entry)===normalizedDomain):selected;
}

export function browserTestDomains(){return Object.freeze([...new Set(allTests().map(domainOf))].sort());}
