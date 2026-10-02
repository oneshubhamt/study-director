import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('source/core/library.js','utf8');
const start=source.indexOf('    function scheduleDiarySave('),end=source.indexOf('    async function startDiaryEdit(',start);
assert.ok(start>0&&end>start);
function harness(commit){
  const field={},statuses=[],writes=[];
  const create=new Function('window','commitDiaryEditor','setDiaryStatus',`
    let diarySaveTimer=0,diaryPendingValue=null,diaryPendingSave=Promise.resolve(),diarySaveSequence=0,diaryEntryListed=false;
    const field={},diaryEditorField=()=>field,invalidateLibrarySummaryCache=()=>{};
    ${source.slice(start,end)}
    return {queue:scheduleDiarySave,flush:flushDiarySave};
  `);
  const api=create({setTimeout:()=>1,clearTimeout:()=>{}},async(_field,value)=>{writes.push(value);await commit(value);return {reflection:value};},message=>statuses.push(message));
  return {api,statuses,writes,field};
}
{
  let fail=true;const h=harness(async()=>{if(fail)throw new Error('Storage unavailable');});
  h.api.queue('keep this draft');await assert.rejects(h.api.flush(),/Storage unavailable/);
  fail=false;await h.api.flush();
  assert.deepEqual(h.writes,['keep this draft','keep this draft'],'retry must save the retained value without requiring another edit');assert.equal(h.statuses.at(-1),'');
}
{
  let rejectFirst;const h=harness(value=>value==='old'?new Promise((_,reject)=>{rejectFirst=reject;}):Promise.resolve());
  h.api.queue('old');const first=h.api.flush();const failed=assert.rejects(first,/old failed/);await Promise.resolve();await Promise.resolve();
  h.api.queue('new');const newer=h.api.flush();rejectFirst(new Error('old failed'));await failed;await newer;await h.api.flush();
  assert.deepEqual(h.writes,['old','new'],'a failed older write must never requeue over a newer queued save');
}
console.log(JSON.stringify({status:'PASS',suite:'diary-save-recovery',retryRetainsDraft:true,newerSaveWins:true}));
