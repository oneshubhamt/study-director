import assert from 'node:assert/strict';
import {createHarness,type RepositoryControls} from '../repository-harness.mts';
import {method} from '../registered-exports.mts';
import {jsonArray,jsonObject} from './read-verification.mts';
import {noteId} from '../note-ids.mts';
import {PRODUCTION_LIMITS} from '../../../contracts/production-limits.mts';

// Versions kept for review are stored one appMeta row each. A write merges by
// id (a resolved one wins), stamps each changed review's backup unit so
// versions carry it, and never drops an open one: more than may wait stops
// the write and leaves the stored set as it was.
const commits:unknown[]=[],controls:RepositoryControls={onCanonicalCommit:event=>commits.push(event)},h=createHarness(new Map(),null,controls);
// Each repository VM result is inspected at the boundary, not cast to a
// permissive fixture API. Deliberately invalid records still reach the owner.
function ports(app:unknown){
  const owner=jsonObject(app),reviews=owner['pendingReviews'],preparation=owner['preparationUnits'];
  return {
    pendingReviews:{
      list:async()=>jsonArray(await method(reviews,'list')()).map(jsonObject),
      merge:async(values:readonly unknown[])=>jsonArray(await method(reviews,'merge')(values)),
      replace:async(values:readonly unknown[])=>jsonArray(await method(reviews,'replace')(values)),
      resolve:async(ids:readonly string[])=>jsonArray(await method(reviews,'resolve')(ids)),
      readItems:async(ids:readonly string[])=>jsonArray(await method(reviews,'readItems')(ids)).map(value=>value===null?null:jsonObject(value))
    },
    preparationUnits:{list:async()=>jsonArray(await method(preparation,'list')()).map(jsonObject)}
  };
}
const api=ports(h.app);
const id=noteId('ethics'),review=(n:number,keptAt='2026-10-18T09:00:00.000Z')=>({version:2,id:'pr_'+n.toString(16).padStart(32,'0'),subject:'note',ref:id,keptAt,keptFrom:'inst_ipad_safari_mgx2k3a0_1a2b3c4d',keptChangedAt:keptAt,kept:{text:`kept ${n}`},base:null,resolvedAt:''});

assert.deepEqual([...await api.pendingReviews.list()],[]);
const first=review(1),second=review(2);
assert.deepEqual([...await api.pendingReviews.merge([first,second])],[first.id,second.id]);
assert.deepEqual([...(await api.pendingReviews.list()).map(item=>item['id'])],[first.id,second.id]);
assert.ok(commits.some(event=>jsonObject(event)['entityType']==='pendingReview'),'a stored review is a canonical commit');
const units=(await api.preparationUnits.list()).map(row=>row['unit']);
assert.ok(units.includes(`pendingReview:${first.id}`)&&units.includes(`pendingReview:${second.id}`),'each review is its own backup unit');
assert.deepEqual([...await api.pendingReviews.merge([first])],[],'an unchanged review writes nothing');

// Resolving keeps only the id, and an open copy arriving later cannot reopen it.
assert.deepEqual([...await api.pendingReviews.resolve([first.id])],[first.id]);
const stored=(await api.pendingReviews.list()).find(item=>item['id']===first.id);
assert.ok(stored);assert.equal(stored['kept'],null);assert.ok(stored['resolvedAt']);
await api.pendingReviews.merge([first]);
assert.ok((await api.pendingReviews.list()).find(item=>item['id']===first.id)?.['resolvedAt'],'a resolved review stays resolved');
assert.deepEqual([...await api.pendingReviews.readItems([second.id,'pr_'+'f'.repeat(32)])].map(item=>item&&item['id']),[second.id,null]);

// More open reviews than may wait: the write stops and nothing is lost.
const many=Array.from({length:PRODUCTION_LIMITS.maxPendingReviews},(_,index)=>review(1000+index));
await assert.rejects(api.pendingReviews.merge(many),/would wait for review/u);
assert.deepEqual([...(await api.pendingReviews.list()).map(item=>item['id'])],[first.id,second.id],'the stored set is unchanged');

// Invalid records never reach storage.
await assert.rejects(api.pendingReviews.merge([{...second,keptAt:'18 Oct'}]),/invalid/u);await assert.rejects(api.pendingReviews.merge([{...second,kept:'text'}]),/invalid/u);

// Replace makes the stored set exactly the given one (a whole-version restore).
assert.deepEqual([...await api.pendingReviews.replace([second])],[first.id]);
assert.deepEqual([...(await api.pendingReviews.list()).map(item=>item['id'])],[second.id]);

// Restore plans in advance and verifies the subsequent independent storage merge.
const {pendingReviewCodec}=await import('../current-codec-fixture.mts');
const duplicate={...second,id:review(3).id,keptAt:'2026-10-19T09:00:00.000Z'};
const intended=pendingReviewCodec.merge([[second],[duplicate]],PRODUCTION_LIMITS.maxPendingReviews);
assert.deepEqual([...await api.pendingReviews.merge([duplicate])],[duplicate.id]);
assert.deepEqual([...await api.pendingReviews.list()],intended,'committed review bytes match the independently planned merge');
assert.deepEqual([...await api.pendingReviews.merge([duplicate])],[],'duplicate replay requires no durable write');

// A second put fails after the first has entered the same transaction. Check
// the entire durable store (including preparation units and epoch), not just
// the returned failure. A fresh VM must read the unchanged reviews, and a
// subsequent retry must persist both records.
const third=review(4),fourth=review(5),before=structuredClone(h.stores.meta),beforeCommits=commits.length;
controls.failNextMetaRequest={operation:'put',key:'pendingReview:'+fourth.id};
await assert.rejects(api.pendingReviews.merge([third,fourth]),/injected appMeta request failure|Pending review update aborted/u);
assert.equal(controls.failNextMetaRequest,undefined,'the second review write must encounter the injected failure');
assert.deepEqual(h.stores.meta,before,'an aborted review batch leaves all canonical metadata unchanged');
assert.equal(commits.length,beforeCommits,'an aborted review batch must not report a canonical commit');
const restarted=ports(createHarness(h.sharedLocal,h.stores).app);
assert.deepEqual(await restarted.pendingReviews.list(),intended,'restart reads the exact previous review set');
assert.deepEqual(await restarted.pendingReviews.merge([third,fourth]),[third.id,fourth.id]);
const afterRetry=ports(createHarness(h.sharedLocal,h.stores).app);
assert.deepEqual(await afterRetry.pendingReviews.list(),[...intended,third,fourth],'both retried records survive a second restart');

console.log(JSON.stringify({status:'PASS',suite:'pending-reviews',resolvedWins:true,backupUnits:true,openNeverDropped:true}));
