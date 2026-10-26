import {processingRequest} from './request-decoder.ts';
import {messageObject,errorDescription,type WorkerProgress,type WorkerReply} from './worker-contracts.ts';
import {createProcessingEngine} from './processing.ts';
import {integritySegment,integrityRequest} from './integrity-segments.ts';
import {markdownDocument} from '../rich-text/markdown';
const engine=createProcessingEngine(markdownDocument);
// The host sends at most one request at a time per job, bounding queued work.
async function processMessage(event:MessageEvent<unknown>){
  const {id,type,data}=messageObject(event.data);
  let lastProgress=0;
  const report=(progress:WorkerProgress)=>{const now=performance.now();if(now-lastProgress>=100||progress.loaded===progress.total){lastProgress=now;self.postMessage({id,progress} satisfies WorkerReply<unknown>);}};
  // Integrity checks run one bounded segment per request and report no progress.
  try{if(typeof type!=='string')throw new TypeError('Invalid processing operation.');let value:unknown;if(type.startsWith('integrity.')){const request=integrityRequest(type,data);value=await integritySegment(request.type,request.data);}else{const request=processingRequest(type,data);value=await engine.run(request.type,request.data,report);}self.postMessage({id,value} satisfies WorkerReply<unknown>);}
  catch(error){self.postMessage({id,error:errorDescription(error,'Export processing failed.')} satisfies WorkerReply<unknown>);}
}
self.onmessage=(event:MessageEvent<unknown>)=>{void processMessage(event)};
