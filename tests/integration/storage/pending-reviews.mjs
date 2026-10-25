import assert from 'node:assert/strict';
import {createHarness} from '../../helpers/repository-harness.mjs';
import {noteId} from '../../helpers/note-ids.mjs';
import {PRODUCTION_LIMITS} from '../../../contracts/production-limits.mjs';

// Versions kept for review are stored one appMeta row each. A write merges by
// id (a resolved one wins), stamps each changed review's backup unit so
// versions carry it, and never drops an open one: more than may wait stops
// the write and leaves the stored set as it was.
const commits=[],h=createHarness(new Map(),null,{onCanonicalCommit:event=>commits.push(event)});
const id=noteId('ethics'),review=(n,keptAt='2026-10-18T09:00:00.000Z')=>({version:1,id:'pr_'+n.toString(16).padStart(32,'0'),subject:'note',ref:id,keptAt,kept:{text:`kept ${n}`},base:null,resolvedAt:''});

assert.deepEqual([...await h.app.pendingReviews.list()],[]);
const first=review(1),second=review(2);
assert.deepEqual([...await h.app.pendingReviews.merge([first,second])],[first.id,second.id]);
assert.deepEqual([...(await h.app.pendingReviews.list()).map(item=>item.id)],[first.id,second.id]);
assert.ok(commits.some(event=>event.entityType==='pendingReview'),'a stored review is a canonical commit');
const units=(await h.app.preparationUnits.list()).map(row=>row.unit);
assert.ok(units.includes(`pendingReview:${first.id}`)&&units.includes(`pendingReview:${second.id}`),'each review is its own backup unit');
assert.deepEqual([...await h.app.pendingReviews.merge([first])],[],'an unchanged review writes nothing');

// Resolving keeps only the id, and an open copy arriving later cannot reopen it.
assert.deepEqual([...await h.app.pendingReviews.resolve([first.id])],[first.id]);
const stored=(await h.app.pendingReviews.list()).find(item=>item.id===first.id);
assert.equal(stored.kept,null);assert.ok(stored.resolvedAt);
await h.app.pendingReviews.merge([first]);
assert.ok((await h.app.pendingReviews.list()).find(item=>item.id===first.id).resolvedAt,'a resolved review stays resolved');
assert.deepEqual([...await h.app.pendingReviews.readItems([second.id,'pr_'+'f'.repeat(32)])].map(item=>item&&item.id),[second.id,null]);

// More open reviews than may wait: the write stops and nothing is lost.
const many=Array.from({length:PRODUCTION_LIMITS.maxPendingReviews},(_,index)=>review(1000+index));
await assert.rejects(h.app.pendingReviews.merge(many),/would wait for review/u);
assert.deepEqual([...(await h.app.pendingReviews.list()).map(item=>item.id)],[first.id,second.id],'the stored set is unchanged');

// Invalid records never reach storage.
await assert.rejects(h.app.pendingReviews.merge([{...second,keptAt:'18 Oct'}]),/invalid/u);await assert.rejects(h.app.pendingReviews.merge([{...second,kept:'text'}]),/invalid/u);

// Replace makes the stored set exactly the given one (a whole-version restore).
assert.deepEqual([...await h.app.pendingReviews.replace([second])],[first.id]);
assert.deepEqual([...(await h.app.pendingReviews.list()).map(item=>item.id)],[second.id]);

console.log(JSON.stringify({status:'PASS',suite:'pending-reviews',resolvedWins:true,backupUnits:true,openNeverDropped:true}));
