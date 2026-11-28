import type {RecordCodecsModule} from '../../source/core/record-codecs.ts';
import type {PendingReview,PendingReviewInput} from '../../types/record-models.ts';
// A PendingReview codec for fixtures whose notes, Saved Days and sessions are
// loose stand-ins: the real codec (ids, merge, resolution and limits), with the
// fixture's own record checks in place of the app's.
import {RUNTIME_DATA_CONTRACT} from '../../contracts/canonical-identities.mts';
const freeze=Object.freeze;
const sameDataValue=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const noteFields=(value:unknown)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const fields:Record<string,string>={};
  for(const key of ['label','text']){const field:unknown=Reflect.get(value,key);if(typeof field==='string')fields[key]=field;}
  return fields;
};
type LooseDailyCodec={sanitizeCurrentDailyRecord?(value:unknown):unknown};
type LooseActiveCodec={sanitizeCurrent?(value:unknown):unknown;contentValue?(value:unknown):unknown};
type FixtureOptions={dataContract?:PendingReviewInput['dataContract'];personalDataCodec:{normalize(value:unknown):unknown};dailyRecordCodec?:LooseDailyCodec|null;activeSessionCodec?:LooseActiveCodec|null};
function read(value:unknown,key:string):unknown{return value&&typeof value==='object'?Reflect.get(value,key):undefined;}

export function testPendingReviewCodec(RecordCodecs:Pick<RecordCodecsModule,'createPendingReviewCodec'>,{dataContract=RUNTIME_DATA_CONTRACT,personalDataCodec,dailyRecordCodec=null,activeSessionCodec=null}:FixtureOptions){
  return RecordCodecs.createPendingReviewCodec(freeze({
    dataContract,
    dailyRecordCodec:freeze({
      noteKeys:freeze({isId:(value:unknown)=>typeof value==='string'&&value.length>0&&!value.startsWith('~')}),
      sanitizeNoteFields:noteFields,
      sanitizeCurrentDailyRecord:(value:unknown)=>dailyRecordCodec&&typeof dailyRecordCodec.sanitizeCurrentDailyRecord==='function'?dailyRecordCodec.sanitizeCurrentDailyRecord(value):value
    }),
    activeSessionCodec:freeze({sanitizeCurrent:(value:unknown)=>activeSessionCodec&&typeof activeSessionCodec.sanitizeCurrent==='function'?activeSessionCodec.sanitizeCurrent(value):value,contentValue:(value:unknown)=>activeSessionCodec&&typeof activeSessionCodec.contentValue==='function'?activeSessionCodec.contentValue(value):value?{date:read(value,'date'),scheduleText:read(value,'scheduleText'),snapshot:read(value,'snapshot')}:null}),
    personalDataCodec,
    helpers:freeze({sameDataValue,randomBytes:(length:number)=>globalThis.crypto.getRandomValues(new Uint8Array(length))})
  // This fixture intentionally passes loose stand-ins to the real PendingReview
  // codec. The mismatch is limited to these test-provided record validators.
  }) as PendingReviewInput);
}

// Versions kept for review, held in memory the way the repository holds them:
// merged by id, a resolved one wins, and more than may wait stops the write.
type ReviewCodec=Pick<ReturnType<RecordCodecsModule['createPendingReviewCodec']>,'merge'|'resolved'>;
export function memoryPendingReviews(codec:ReviewCodec,{limit=2000}={}){
  const store=new Map<string,PendingReview>();
  async function write(values:readonly unknown[],replace=false){
    const next=codec.merge(replace?[values]:[[...store.values()],values],limit);
    if(next.filter(review=>!review.resolvedAt).length>limit)throw new RangeError(`More than ${limit} versions would wait for review.`);
    const ids=new Set(next.map(review=>review.id)),changed=[];
    for(const id of [...store.keys()])if(!ids.has(id)){store.delete(id);changed.push(id);}
    for(const review of next)if(!sameDataValue(store.get(review.id)||null,review)){store.set(review.id,freeze(review));changed.push(review.id);}
    return freeze(changed.sort());
  }
  const ports=freeze({
    pendingReviewsList:async()=>freeze([...store.values()].sort((a,b)=>a.id.localeCompare(b.id))),
    pendingReviewsReadItems:async (ids:readonly unknown[])=>freeze((ids||[]).map(id=>store.get(String(id))||null)),
    pendingReviewsMerge:(values:readonly unknown[])=>write(values),
    pendingReviewsReplace:(values:readonly unknown[])=>write(values,true),
    pendingReviewsResolve:async (ids:readonly unknown[])=>{const wanted=new Set((ids||[]).map(String)),held=[...store.values()].filter(review=>wanted.has(review.id)&&!review.resolvedAt);return held.length?write(held.map(review=>codec.resolved(review))):freeze([]);}
  });
  return freeze({store,ports,open:()=>[...store.values()].filter(review=>!review.resolvedAt)});
}

// A stand-in for Smart merge (mergeThreeWay): paragraphs are compared with
// what both last shared; it is safe only when no paragraph changed on both.
export function paragraphMerge(base:unknown,local:unknown,incoming:unknown){
  const split=(value:unknown)=>String(value??'').split('\n\n'),b=split(base),l=split(local),i=split(incoming);
  if(l.length!==b.length||i.length!==b.length)return freeze({value:String(local??''),safe:false});
  const out=[];
  for(let index=0;index<b.length;index++){
    if(l[index]===i[index]||i[index]===b[index])out.push(l[index]);
    else if(l[index]===b[index])out.push(i[index]);
    else return freeze({value:String(local??''),safe:false});
  }
  return freeze({value:out.join('\n\n'),safe:true});
}
