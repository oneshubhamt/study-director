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
assert.equal(occurrences(app,/CompatibilityModule\./gu),2,'the compatibility module is used only for the upgrade bridge and to build the facade');

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
// conversions are called only from it.
const blockStart=repositories.indexOf('/* COMPATIBILITY ---'),blockEnd=repositories.indexOf('/* END COMPATIBILITY */');
assert.ok(blockStart>0&&blockEnd>blockStart,'the repositories keep their compatibility code in one marked block');
const block=repositories.slice(blockStart,blockEnd),rest=repositories.slice(0,blockStart)+repositories.slice(blockEnd);
const defined=[...block.matchAll(/^(?:async )?function (\w+)\(/gmu)].map(match=>match[1]);
assert.ok(defined.length>=10,'the block holds the repository migrations');
for(const name of defined)assert.equal(new RegExp(`\\b${name}\\b`,'u').test(rest),false,`${name} is compatibility code: only its block may use it`);
assert.match(block,/const compatibility=freeze\(\{/u,'the AppData.compatibility namespace closes the block');
for(const call of ['InsightsDatasetRevision.migrateLegacyEnvelope','InsightsDatasetRevision.verifyCanonicalEnvelope']){
  assert.equal(rest.includes(call),false,`${call} is called only from the compatibility block`);
  assert.equal(block.includes(call),true,`${call} is reached through the compatibility namespace`);
}
for(const name of ['migrateAreaNoteRows','migrateAreaNoteRecovery','verifyAreaNoteRecovery'])assert.ok(defined.includes(name),`${name} lives in the compatibility block`);
assert.doesNotMatch(read('source/core/repositories-area-notes.js'),/CompatibilityCodec|compatibilityWriteToken|legacyKeys|areaNoteRecovery|async function migrate/u,'the notes repository holds no compatibility code');

// The daily-record migration marker belongs to the compatibility layer: only its block reads it.
assert.equal(/dailyRecordMigration/u.test(rest.replace(/^\s*dailyRecordMigration:value=>.*$/mu,'').replace(/exactObject\(input\.metaKeys,\[[^\]]*\]/u,'')),false,'ordinary repository code never reads the migration marker');

console.log(JSON.stringify({status:'PASS',suite:'compatibility-isolation',facadeCallSites:facadeCalls.length,repositoryMigrations:defined.length},null,2));
