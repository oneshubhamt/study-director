import assert from 'node:assert/strict';
import fs from 'node:fs';

// The compatibility layer is reached through a short, fixed list of entry
// points, so retiring it means deleting those modules, one marked block in the
// repositories and the wiring named here. A new call from ordinary code into
// compatibility code fails this test.
const read=file=>fs.readFileSync(file,'utf8');
const app=read('source/app.html'),repositories=read('source/core/repositories.js');
const occurrences=(text,pattern)=>[...text.matchAll(pattern)].length;

// The app reaches the facade only at start-up, when a tab takes over writing,
// and when it opens a backup file that may be in an older format.
const facadeCalls=[...app.matchAll(/CompatibilityFacade\.(\w+)/gu)].map(match=>match[1]).sort();
assert.deepEqual(facadeCalls,['inspectBackup','migrateLive','migrateLive','verifyCanonicalInstallation'],'the compatibility facade has exactly four call sites');
assert.equal(occurrences(app,/CompatibilityModule\.applyIndexedDbUpgrade\(/gu),1,'the IndexedDB upgrade bridge is wired once');
assert.equal(occurrences(app,/CompatibilityModule\.renameIndexedDbStores\(/gu),1,'the IndexedDB store rename is wired once');
assert.equal(occurrences(app,/CompatibilityModule\./gu),3,'the compatibility module is used only for the upgrade bridge (store renames and conversions) and to build the facade');

// AppData.compatibility and the legacy attachment cleanup are wired only into the facade.
const facadeStart=app.indexOf('const CompatibilityFacade=CompatibilityHostModule.createFacade(');
const facadeEnd=app.indexOf('\n}));',facadeStart);
assert.ok(facadeStart>0&&facadeEnd>facadeStart,'the compatibility facade must be built in one place');
const outsideFacade=app.slice(0,facadeStart)+app.slice(facadeEnd);
assert.equal(occurrences(outsideFacade,/AppData\.compatibility\b/gu),0,'only the compatibility facade uses AppData.compatibility');
assert.equal(occurrences(outsideFacade,/\.cleanupLegacy\(/gu),0,'only the compatibility facade removes legacy attachment rows');

// In the repositories, compatibility code sits in one marked block. What it
// defines is used only inside it, it holds every note conversion (the
// notes repository has none), and the Insights revision's older-form
// conversions live in it.
const blockStart=repositories.indexOf('/* COMPATIBILITY ---'),blockEnd=repositories.indexOf('/* END COMPATIBILITY */');
assert.ok(blockStart>0&&blockEnd>blockStart,'the repositories keep their compatibility code in one marked block');
const block=repositories.slice(blockStart,blockEnd),rest=repositories.slice(0,blockStart)+repositories.slice(blockEnd);
const defined=[...block.matchAll(/^(?:async )?function (\w+)\(/gmu)].map(match=>match[1]);
assert.ok(defined.length>=10,'the block holds the repository migrations');
for(const name of defined)assert.equal(new RegExp(`\\b${name}\\b`,'u').test(rest),false,`${name} is compatibility code: only its block may use it`);
assert.match(block,/const compatibility=freeze\(\{/u,'the AppData.compatibility namespace closes the block');
for(const name of ['migrateInsightsRevisionEnvelope','verifyInsightsRevisionEnvelope','verifyDeletionState','legacySyncDeleteEntries','rawLegacyMetaGet'])assert.ok(defined.includes(name),`${name} lives in the compatibility block`);
for(const name of ['migrateNoteRows','migrateNoteRecovery','verifyNoteRecovery'])assert.ok(defined.includes(name),`${name} lives in the compatibility block`);
assert.doesNotMatch(read('source/core/repositories-notes.js'),/CompatibilityCodec|compatibilityWriteToken|legacyKeys|noteRecovery|async function migrate/u,'the notes repository holds no compatibility code');

// Nothing outside the block reads the retired stores, keys or raw metadata rows.
assert.doesNotMatch(rest,/rawLegacyMeta|legacySyncDeleteEntries|idbGetAllIfPresent\(DB_LEGACY_|getText\(STORAGE_KEYS\.legacySyncEmergency/u,'retired stores and keys are read only in the compatibility block');
assert.doesNotMatch(rest,/migrateLegacyEnvelope|verifyCanonicalEnvelope|normalizeLegacyRow/u,'the Insights revision keeps no older-form conversions of its own');

// The backup format module keeps its readers for older backup files in one
// marked block, reached only through inspectLegacy.
const codec=read('source/core/backup-codec.js'),codecStart=codec.indexOf('/* COMPATIBILITY ---'),codecEnd=codec.indexOf('/* END COMPATIBILITY */');
assert.ok(codecStart>0&&codecEnd>codecStart,'the backup format module keeps its older-file readers in one marked block');
const codecBlock=codec.slice(codecStart,codecEnd),codecRest=codec.slice(0,codecStart)+codec.slice(codecEnd);
const codecDefined=[...codecBlock.matchAll(/^(?:async )?function (\w+)\(/gmu)].map(match=>match[1]);
for(const name of ['readLegacyBackupFile','readChunkedBackupFile','backupLooksChunked','readPortableBackupFile','inspectLegacyBackup'])assert.ok(codecDefined.includes(name),`${name} lives in the backup format module's compatibility block`);
for(const name of codecDefined){const uses=codecRest.match(new RegExp(`\\b${name}\\b`,'gu'))||[];assert.equal(uses.length,name==='inspectLegacyBackup'?1:0,`${name} is reached only through inspectLegacy`);}
assert.match(codecRest,/inspectLegacy:\(\.\.\.args\)=>Processing\.scope\(\(\)=>inspectLegacyBackup\(\.\.\.args\)\)/u,'inspectLegacy is the one way in');

// The daily-record migration marker belongs to the compatibility layer: only its block reads it.
assert.equal(/dailyRecordMigration/u.test(rest.replace(/^\s*dailyRecordMigration:value=>.*$/mu,'').replace(/exactObject\(input\.metaKeys,\[[^\]]*\]/u,'')),false,'ordinary repository code never reads the migration marker');

console.log(JSON.stringify({status:'PASS',suite:'compatibility-isolation',facadeCallSites:facadeCalls.length,repositoryMigrations:defined.length},null,2));
