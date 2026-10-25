import {createProcessingEngine} from './processing.js';
import {integritySegment} from './integrity-segments.js';
import {markdownDocument} from '../rich-text/markdown';
const engine=createProcessingEngine(markdownDocument);
// The host sends at most one request at a time per job, bounding queued work.
self.onmessage=async(event:MessageEvent)=>{
  const {id,type,data}=event.data||{};
  let lastProgress=0;
  const report=(progress:any)=>{const now=performance.now();if(now-lastProgress>=100||progress.loaded===progress.total){lastProgress=now;self.postMessage({id,progress});}};
  // Integrity checks run one bounded segment per request and report no progress.
  try{self.postMessage({id,value:String(type).startsWith('integrity.')?await integritySegment(type,data):await engine.run(type,data,report)});}
  catch(error){self.postMessage({id,error:{code:(error as any)?.code,name:error instanceof Error?error.name:'Error',message:error instanceof Error?error.message:'Export processing failed.'}});}
};
