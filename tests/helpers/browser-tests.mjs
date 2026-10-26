// alone: the test must run with no other browser test running. Use it only when
// a diagnosed browser behaviour under CPU contention makes the test unreliable.
const test=(id,script,coverage,timeoutMs=0,{alone=false}={})=>Object.freeze({id,script,coverage:Object.freeze(coverage),timeoutMs,alone});

export const BROWSER_TEST_MANIFEST=Object.freeze({
  smoke:Object.freeze([
    test('core-flow','tests/browser/app/core-flow.mjs',['plan','execute','review','library','indexeddb','backup']),
    test('session-draft-edit','tests/browser/app/session-draft-edit.mjs',['plan','execute','practice-pacer','backup']),
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
    test('backup-encryption','tests/browser/backup/encryption.mjs',['encryption','password','files','cancellation','recovery','worker']),
    test('pwa-device-backup','tests/browser/backup/pwa-device-backup.mjs',['pwa','device-backup']),
    test('sync-and-profiles','tests/browser/backup/sync-and-profiles.mjs',['sync','google-drive','two-devices','reload','activation','profiles'],300000),
    test('session-plan-sync','tests/browser/backup/session-plan-sync.mjs',['sync','google-drive','two-devices','active-session','plan','takeover'],300000),
    test('insights-populated','tests/browser/insights/insights-populated-ui.mjs',['insights','populated-history']),
    test('pwa-update','tests/browser/pwa/pwa-update.mjs',['pwa','service-worker','trusted-types','multi-tab','offline','recovery','update'],0,{alone:true}),
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
    test('site-data-clear','tests/browser/storage/site-data-clear.mjs',['storage','site-data-clear','recovery','indexeddb','notifications','reload']),
    test('upgrade-renamed-names','tests/browser/storage/upgrade-renamed-names.mjs',['storage','upgrade','compatibility','indexeddb','notes','reload']),
    test('unsupported-data','tests/browser/storage/unsupported-data.mjs',['storage','compatibility','indexeddb','profiles','reload'],240000),
    test('interactions','tests/browser/ui/interactions.mjs',['dialogs','history','navigation','keyboard','notifications'])
  ]),
  extended:Object.freeze([
    test('attachment-library','tests/browser/attachments/attachments.mjs',['attachments','pdf','audio','opfs','references','streaming','atomic-import','trusted-types'],180000),
    test('insights-performance','tests/browser/insights/insights-performance.mjs',['insights','performance','worker','progressive-rendering','fallback']),
    test('maximum-insights','tests/browser/insights/insights-maximum-import.mjs',['insights','maximum-import']),
    test('notes-at-limit','tests/browser/library/notes-at-limit.mjs',['library','notes','performance','capacity','search','tags','backup'],240000),
    test('production-capacity','tests/browser/storage/capacity.mjs',['capacity','restore','reload','re-export','rollback'],300000),
    test('rich-editor-hotpath','tests/browser/rich-text/rich-editor-hotpath.mjs',['rich-editor','performance','persistence']),
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
