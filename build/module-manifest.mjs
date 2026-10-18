export const privateModules=Object.freeze([
  Object.freeze({id:'internal',source:'core/internal.js',stem:'sd.internal'}),
  Object.freeze({id:'operation-lifecycle',source:'core/operation-lifecycle.js',stem:'sd.operation-lifecycle'}),
  Object.freeze({id:'interactions',source:'core/interactions.js',stem:'sd.interactions'}),
  Object.freeze({id:'workspace-overlay',source:'core/workspace-overlay.js',stem:'sd.workspace-overlay'}),
  Object.freeze({id:'backup-presentation',source:'core/backup-presentation.js',stem:'sd.backup-presentation'}),
  Object.freeze({id:'audio-engine',source:'core/audio-engine.js',stem:'sd.audio-engine'}),
  Object.freeze({id:'notice-coordinator',source:'core/notice-coordinator.js',stem:'sd.notice-coordinator'}),
  Object.freeze({id:'navigation',source:'core/navigation.js',stem:'sd.navigation'}),
  Object.freeze({id:'domain',source:'core/domain.js',stem:'sd.domain'}),
  Object.freeze({id:'attachments',source:'core/attachments.js',stem:'sd.attachments'}),
  Object.freeze({id:'attachment-ingest',source:'core/attachment-ingest.js',stem:'sd.attachment-ingest'}),
  Object.freeze({id:'asset-storage',source:'core/asset-storage.js',stem:'sd.assets'}),
  Object.freeze({id:'compatibility',source:'core/compatibility.js',stem:'sd.compatibility'}),
  Object.freeze({id:'persistence',source:'core/persistence.js',stem:'sd.persistence'}),
  Object.freeze({id:'app-meta',source:'core/app-meta.js',stem:'sd.app-meta'}),
  Object.freeze({id:'host-metadata',source:'core/host-metadata.js',stem:'sd.host-metadata'}),
  Object.freeze({id:'reconciliation-baseline',source:'core/reconciliation-baseline.js',stem:'sd.reconciliation-baseline'}),
  Object.freeze({id:'ownership',source:'core/ownership.js',stem:'sd.ownership'}),
  Object.freeze({id:'timer-state',source:'core/timer-state.js',stem:'sd.timer-state'}),
  Object.freeze({id:'record-codecs',source:'core/record-codecs.js',stem:'sd.record-codecs'}),
  Object.freeze({id:'compatibility-codecs',source:'core/compatibility-codecs.js',stem:'sd.compatibility-codecs'}),
  Object.freeze({id:'compatibility-host',source:'core/compatibility-host.js',stem:'sd.compatibility-host'}),
  Object.freeze({id:'backup-codec',source:'core/backup-codec.js',stem:'sd.backup-codec'}),
  Object.freeze({id:'canonical',source:'core/canonical.js',stem:'sd.canonical'}),
  Object.freeze({id:'reconciliation',source:'core/reconciliation.js',stem:'sd.reconciliation'}),
  Object.freeze({id:'reconciliation-ui',source:'core/reconciliation-ui.js',stem:'sd.reconciliation-ui'}),
  Object.freeze({id:'session-lifecycle',source:'core/session-lifecycle.js',stem:'sd.session-lifecycle'}),
  Object.freeze({id:'repository-journals',source:'core/repository-journals.js',stem:'sd.repository-journals'}),
  Object.freeze({id:'save-lane',source:'core/save-lane.js',stem:'sd.save-lane'}),
  Object.freeze({id:'repositories-notes',source:'core/repositories-notes.js',stem:'sd.repositories-notes'}),
  Object.freeze({id:'repositories',source:'core/repositories.js',stem:'sd.repositories'}),
  Object.freeze({id:'pomodoro',source:'core/pomodoro.js',stem:'sd.pomodoro'}),
  Object.freeze({id:'practice-pacer',source:'core/practice-pacer.js',stem:'sd.practice-pacer'}),
  Object.freeze({id:'timer-engine',source:'core/timer-engine.js',stem:'sd.timer-engine'}),
  Object.freeze({id:'plan',source:'core/plan.js',stem:'sd.plan'}),
  Object.freeze({id:'review',source:'core/review.js',stem:'sd.review'}),
  Object.freeze({id:'asset-maintenance',source:'core/asset-maintenance.js',stem:'sd.asset-maintenance'}),
  Object.freeze({id:'exports',source:'core/exports.js',stem:'sd.exports'}),
  Object.freeze({id:'integrity-continuation',source:'core/integrity-continuation.js',stem:'sd.integrity-continuation'}),
  Object.freeze({id:'note-export',source:'core/note-export.js',stem:'sd.note-export'}),
  Object.freeze({id:'library-clear',source:'core/library-clear.js',stem:'sd.library-clear'}),
  Object.freeze({id:'note-links',source:'core/note-links.js',stem:'sd.note-links'}),
  Object.freeze({id:'profiles',source:'core/profiles.js',stem:'sd.profiles'}),
  Object.freeze({id:'library',source:'core/library.js',stem:'sd.library'}),
  Object.freeze({id:'managed-repository',source:'core/managed-repository.js',stem:'sd.managed-repository'}),
  Object.freeze({id:'repository-policy',source:'core/repository-policy.js',stem:'sd.repository-policy'}),
  Object.freeze({id:'repository-background',source:'core/repository-background.js',stem:'sd.repository-background'}),
  Object.freeze({id:'mutation-coordinator',source:'core/mutation-coordinator.js',stem:'sd.mutation-coordinator'}),
  Object.freeze({id:'backup-operation-diagnostics',source:'core/backup-operation-diagnostics.js',stem:'sd.backup-operation-diagnostics'}),
  Object.freeze({id:'backup-provider',source:'core/backup-provider.js',stem:'sd.backup-provider'}),
  Object.freeze({id:'backup-capture',source:'core/backup-capture.js',stem:'sd.backup-capture'}),
  Object.freeze({id:'backup',source:'core/backup.js',stem:'sd.backup'}),
  Object.freeze({id:'managed-recovery',source:'core/managed-recovery.js',stem:'sd.managed-recovery'}),
  Object.freeze({id:'device-folder-storage',source:'core/device-folder-storage.js',stem:'sd.device-folder-storage'}),
  Object.freeze({id:'device-backup',source:'core/device-backup.js',stem:'sd.device-backup'}),
  Object.freeze({id:'backup-recovery-host',source:'core/backup-recovery-host.js',stem:'sd.backup-recovery-host'}),
  Object.freeze({id:'pwa-lifecycle',source:'core/pwa-lifecycle.js',stem:'sd.pwa-lifecycle'}),
  Object.freeze({id:'native-capabilities',source:'core/native-capabilities.js',stem:'sd.native-capabilities'}),
  Object.freeze({id:'startup',registryId:'startup-lifecycle',source:'core/startup.js',stem:'sd.startup'})
]);

// Direct runtime dependencies after host composition. The manifest order is a
// topological order; private modules may never resolve one another themselves.
export const runtimeDependencies=Object.freeze({
  internal:Object.freeze([]),
  'operation-lifecycle':Object.freeze([]),
  interactions:Object.freeze([]),
  'workspace-overlay':Object.freeze([]),
  'audio-engine':Object.freeze([]),
  'notice-coordinator':Object.freeze([]),
  'backup-presentation':Object.freeze([]),
  navigation:Object.freeze([]),
  domain:Object.freeze([]),
  persistence:Object.freeze([]),
  'app-meta':Object.freeze(['persistence']),
  'host-metadata':Object.freeze(['app-meta']),
  'reconciliation-baseline':Object.freeze(['app-meta']),
  'record-codecs':Object.freeze(['domain','persistence','timer-state']),
  'compatibility-codecs':Object.freeze(['record-codecs']),
  'backup-codec':Object.freeze(['record-codecs','compatibility-codecs']),
  canonical:Object.freeze([]),
  reconciliation:Object.freeze(['canonical']),
  'reconciliation-ui':Object.freeze([]),
  'asset-storage':Object.freeze([]),
  compatibility:Object.freeze([]),
  'compatibility-host':Object.freeze(['compatibility','compatibility-codecs','record-codecs']),
  attachments:Object.freeze([]),
  'attachment-ingest':Object.freeze([]),
  ownership:Object.freeze([]),
  'timer-state':Object.freeze(['domain']),
  'session-lifecycle':Object.freeze([]),
  'repository-journals':Object.freeze(['app-meta','persistence']),
  'save-lane':Object.freeze([]),
  'repositories-notes':Object.freeze(['save-lane']),
  repositories:Object.freeze(['app-meta','domain','persistence','record-codecs','compatibility-codecs','repository-journals','repositories-notes','save-lane','timer-state']),
  'pomodoro':Object.freeze(['domain','notice-coordinator','repositories','timer-state']),
  'practice-pacer':Object.freeze(['domain','notice-coordinator','repositories','timer-state']),
  'timer-engine':Object.freeze(['domain','notice-coordinator','pomodoro','practice-pacer','repositories','timer-state']),
  plan:Object.freeze(['domain','notice-coordinator','repositories','session-lifecycle','timer-engine','timer-state']),
  review:Object.freeze(['domain','persistence','record-codecs','plan','repositories','session-lifecycle','timer-engine','timer-state']),
  'asset-maintenance':Object.freeze(['operation-lifecycle','asset-storage','repositories','review']),
  exports:Object.freeze(['operation-lifecycle']),
  'integrity-continuation':Object.freeze(['exports']),
  'note-export':Object.freeze(['exports']),
  'library-clear':Object.freeze(['repositories','review']),
  'note-links':Object.freeze([]),
  profiles:Object.freeze([]),
  library:Object.freeze(['domain','note-export','repositories','review','timer-state']),
  'managed-repository':Object.freeze([]),
  'repository-policy':Object.freeze([]),
  'repository-background':Object.freeze(['operation-lifecycle']),
  'mutation-coordinator':Object.freeze([]),
  'backup-operation-diagnostics':Object.freeze(['operation-lifecycle']),
  'backup-provider':Object.freeze(['repository-policy']),
  'backup-capture':Object.freeze([]),
  backup:Object.freeze(['backup-capture','exports','library','backup-codec','backup-provider','canonical','managed-repository','repository-background','reconciliation','reconciliation-ui','domain','persistence','record-codecs','plan','repositories','review','session-lifecycle','timer-state']),
  'managed-recovery':Object.freeze([]),
  'device-folder-storage':Object.freeze([]),
  'device-backup':Object.freeze(['backup','persistence','repositories','repository-policy','timer-state']),
  'backup-recovery-host':Object.freeze(['backup','managed-recovery','device-backup']),
  'pwa-lifecycle':Object.freeze([]),
  'native-capabilities':Object.freeze([]),
  startup:Object.freeze(['library','backup','pomodoro','plan','repositories','review','session-lifecycle','timer-engine','timer-state'])
});

export const trustedExternalModuleIds=Object.freeze(['glass','guide','insights','drive','rich-text','search-worker','image-worker','attachment-worker','export-worker']);
export const externalModules=Object.freeze([
  Object.freeze({id:'glass',source:'external/glass.js',stem:'sd.glass',execution:'startup'}),
  Object.freeze({id:'guide',source:'external/guide.js',stem:'sd.guide',execution:'on-demand'}),
  Object.freeze({id:'insights',sources:Object.freeze(['external/insights-model.js','external/insights.js']),stem:'sd.insights',execution:'on-demand'}),
  Object.freeze({id:'drive',source:'external/drive.js',stem:'sd.drive',execution:'startup'}),
  Object.freeze({id:'rich-text',source:'external/rich-text.js',stem:'sd.richtext',execution:'startup'}),
  Object.freeze({id:'search-worker',source:'external/search-worker.js',stem:'sd.note-search',execution:'worker'}),
  Object.freeze({id:'image-worker',source:'external/image-worker.js',stem:'sd.image-worker',execution:'worker'}),
  Object.freeze({id:'attachment-worker',source:'external/attachment-worker.js',stem:'sd.attachment-worker',execution:'worker'}),
  Object.freeze({id:'export-worker',source:'external/export-worker.js',stem:'sd.export-worker',execution:'worker'})
]);

export const styleModules=Object.freeze([
  Object.freeze({id:'core',source:'styles/core.css',stem:'sd.core'})
]);


export const htmlSource='app.html';
export const privateModuleMarker='<!-- @SD_PRIVATE_MODULES@ -->';

export const platformFiles=Object.freeze({
  manifest:Object.freeze({source:'platform/manifest.webmanifest',output:'manifest.webmanifest'}),
  serviceWorker:Object.freeze({source:'platform/sw.js',output:'sw.js'}),
  hostingHeaders:Object.freeze({source:'platform/firebase-hosting-headers.merge.json',output:'firebase-hosting-headers.merge.json'})
});

const bothTargets=Object.freeze(['development','deployment']);
export const staticAssets=Object.freeze([
  Object.freeze({source:'assets/sounds/PROVENANCE.md',output:'assets/sounds/PROVENANCE.md',targets:bothTargets,precache:false}),
  Object.freeze({source:'assets/sounds/attention.wav',output:'assets/sounds/attention.wav',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/sounds/begin.wav',output:'assets/sounds/begin.wav',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/sounds/complete.wav',output:'assets/sounds/complete.wav',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/sounds/confirm.wav',output:'assets/sounds/confirm.wav',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/sounds/day.wav',output:'assets/sounds/day.wav',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/sounds/hint.wav',output:'assets/sounds/hint.wav',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/sounds/invitation.wav',output:'assets/sounds/invitation.wav',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/sounds/manifest.json',output:'assets/sounds/manifest.json',targets:bothTargets,precache:false}),
  Object.freeze({source:'assets/sounds/overtime.wav',output:'assets/sounds/overtime.wav',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/sounds/pause.wav',output:'assets/sounds/pause.wav',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/sounds/resume.wav',output:'assets/sounds/resume.wav',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/sounds/return.wav',output:'assets/sounds/return.wav',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/sounds/skip.wav',output:'assets/sounds/skip.wav',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/sounds/target.wav',output:'assets/sounds/target.wav',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/fonts/barlow-condensed-latin-400-normal.woff2',output:'assets/fonts/barlow-condensed-latin-400-normal.woff2',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/fonts/barlow-condensed-latin-700-normal.woff2',output:'assets/fonts/barlow-condensed-latin-700-normal.woff2',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/fonts/barlow-latin-400-normal.woff2',output:'assets/fonts/barlow-latin-400-normal.woff2',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/fonts/barlow-latin-600-normal.woff2',output:'assets/fonts/barlow-latin-600-normal.woff2',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/fonts/oxanium-latin-700-normal.woff2',output:'assets/fonts/oxanium-latin-700-normal.woff2',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/fonts/share-tech-mono-latin-400-normal.woff2',output:'assets/fonts/share-tech-mono-latin-400-normal.woff2',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/icons/icon-192.png',output:'assets/icons/icon-192.png',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/icons/icon-512.png',output:'assets/icons/icon-512.png',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/icons/icon-maskable-192.png',output:'assets/icons/icon-maskable-192.png',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/icons/icon-maskable-512.png',output:'assets/icons/icon-maskable-512.png',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/icons/apple-touch-icon.png',output:'assets/icons/apple-touch-icon.png',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/icons/favicon-32.png',output:'assets/icons/favicon-32.png',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/icons/favicon-16.png',output:'assets/icons/favicon-16.png',targets:bothTargets,precache:true}),
  Object.freeze({source:'assets/licenses/Barlow-OFL-1.1.txt',output:'assets/licenses/Barlow-OFL-1.1.txt',targets:bothTargets,precache:false}),
  Object.freeze({source:'assets/licenses/Barlow-Condensed-OFL-1.1.txt',output:'assets/licenses/Barlow-Condensed-OFL-1.1.txt',targets:bothTargets,precache:false}),
  Object.freeze({source:'assets/licenses/Oxanium-OFL-1.1.txt',output:'assets/licenses/Oxanium-OFL-1.1.txt',targets:bothTargets,precache:false}),
  Object.freeze({source:'assets/licenses/Share-Tech-Mono-OFL-1.1.txt',output:'assets/licenses/Share-Tech-Mono-OFL-1.1.txt',targets:bothTargets,precache:false}),
  Object.freeze({source:'assets/licenses/Wordgard-MIT.txt',output:'assets/licenses/Wordgard-MIT.txt',targets:bothTargets,precache:false}),
  Object.freeze({source:'assets/licenses/style-mod-MIT.txt',output:'assets/licenses/style-mod-MIT.txt',targets:bothTargets,precache:false}),
  Object.freeze({source:'assets/licenses/find-cluster-break-MIT.txt',output:'assets/licenses/find-cluster-break-MIT.txt',targets:bothTargets,precache:false})
  ,Object.freeze({source:'legal/privacy.html',output:'privacy.html',targets:bothTargets,precache:true,template:true})
  ,Object.freeze({source:'legal/terms.html',output:'terms.html',targets:bothTargets,precache:true,template:true})
  ,Object.freeze({source:'legal/security.html',output:'security.html',targets:bothTargets,precache:true,template:true})
  ,Object.freeze({source:'legal/LICENSE.txt',output:'LICENSE.txt',targets:bothTargets,precache:true})
  ,Object.freeze({source:'legal/NOTICE.txt',output:'NOTICE.txt',targets:bothTargets,precache:true})
  ,Object.freeze({source:'legal/legal.css',output:'legal.css',targets:bothTargets,precache:true})
]);

export const legalReaderAssets=Object.freeze([
  Object.freeze({source:'legal/LICENSE.txt',output:'license.html',title:'Study Director License',kicker:'License',active:'license'}),
  Object.freeze({source:'legal/NOTICE.txt',output:'notices.html',title:'Third-Party Notices',kicker:'Notices',active:'notices'})
]);
