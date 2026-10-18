// A PendingReview codec for fixtures whose notes, Saved Days and sessions are
// loose stand-ins: the real codec (ids, merge, resolution and limits), with the
// fixture's own record checks in place of the app's.
import {RUNTIME_DATA_CONTRACT} from '../../contracts/canonical-identities.mjs';
const freeze=Object.freeze;
const sameDataValue=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const noteFields=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(['label','text'].filter(key=>typeof value[key]==='string').map(key=>[key,value[key]])):null;

export function testPendingReviewCodec(RecordCodecs,{dataContract=RUNTIME_DATA_CONTRACT,personalDataCodec,dailyRecordCodec=null,activeSessionCodec=null}){
  return RecordCodecs.createPendingReviewCodec(freeze({
    dataContract,
    dailyRecordCodec:freeze({
      noteKeys:freeze({isId:value=>typeof value==='string'&&value.length>0&&!value.startsWith('~')}),
      sanitizeNoteFields:noteFields,
      sanitizeCurrentDailyRecord:value=>dailyRecordCodec&&typeof dailyRecordCodec.sanitizeCurrentDailyRecord==='function'?dailyRecordCodec.sanitizeCurrentDailyRecord(value):value
    }),
    activeSessionCodec:freeze({sanitizeCurrent:value=>activeSessionCodec&&typeof activeSessionCodec.sanitizeCurrent==='function'?activeSessionCodec.sanitizeCurrent(value):value}),
    personalDataCodec,
    helpers:freeze({sameDataValue,randomBytes:length=>globalThis.crypto.getRandomValues(new Uint8Array(length))})
  }));
}

// Versions kept for review, held in memory the way the repository holds them:
// merged by id, a resolved one wins, and more than may wait stops the write.
export function memoryPendingReviews(codec,{limit=2000}={}){
  const store=new Map();
  async function write(values,replace=false){
    const next=codec.merge(replace?[values]:[[...store.values()],values],limit);
    if(next.filter(review=>!review.resolvedAt).length>limit)throw new RangeError(`More than ${limit} versions would wait for review.`);
    const ids=new Set(next.map(review=>review.id)),changed=[];
    for(const id of [...store.keys()])if(!ids.has(id)){store.delete(id);changed.push(id);}
    for(const review of next)if(!sameDataValue(store.get(review.id)||null,review)){store.set(review.id,freeze(review));changed.push(review.id);}
    return freeze(changed.sort());
  }
  const ports=freeze({
    pendingReviewsList:async()=>freeze([...store.values()].sort((a,b)=>a.id.localeCompare(b.id))),
    pendingReviewsReadItems:async ids=>freeze((ids||[]).map(id=>store.get(String(id))||null)),
    pendingReviewsMerge:values=>write(values),
    pendingReviewsReplace:values=>write(values,true),
    pendingReviewsResolve:async ids=>{const wanted=new Set((ids||[]).map(String)),held=[...store.values()].filter(review=>wanted.has(review.id)&&!review.resolvedAt);return held.length?write(held.map(review=>codec.resolved(review))):freeze([]);}
  });
  return freeze({store,ports,open:()=>[...store.values()].filter(review=>!review.resolvedAt)});
}

// A stand-in for Smart merge (mergeThreeWay): paragraphs are compared with
// what both last shared; it is safe only when no paragraph changed on both.
export function paragraphMerge(base,local,incoming){
  const split=value=>String(value??'').split('\n\n'),[b,l,i]=[base,local,incoming].map(split);
  if(l.length!==b.length||i.length!==b.length)return freeze({value:String(local??''),safe:false});
  const out=[];
  for(let index=0;index<b.length;index++){
    if(l[index]===i[index]||i[index]===b[index])out.push(l[index]);
    else if(l[index]===b[index])out.push(i[index]);
    else return freeze({value:String(local??''),safe:false});
  }
  return freeze({value:out.join('\n\n'),safe:true});
}
