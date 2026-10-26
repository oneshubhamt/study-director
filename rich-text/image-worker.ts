import {normalizeImage,type ImageCanvasPort} from './image-processing';
import {messageObject,errorDescription,type ImageReply} from '../portable/worker-contracts';
const workerCanvas:ImageCanvasPort={
  create:(width,height)=>new OffscreenCanvas(width,height),
  encode:canvas=>(canvas as OffscreenCanvas).convertToBlob({type:'image/webp',quality:.92}),
};
let busy=false;
async function prepare(raw:unknown){
  if(busy)return;busy=true;
  if(typeof createImageBitmap!=='function'||typeof OffscreenCanvas!=='function'||typeof OffscreenCanvas.prototype.convertToBlob!=='function'){self.postMessage({unsupported:true} satisfies ImageReply<Blob>);return}
  try{const data=messageObject(raw),file=data['file'],mimeType=data['mimeType'];if(!(file instanceof Blob)||typeof mimeType!=='string')throw new TypeError('Invalid image worker request.');const result=await normalizeImage(file,mimeType,workerCanvas);self.postMessage({result} satisfies ImageReply<Blob>)}
  catch(error){self.postMessage({error:errorDescription(error,'Image preparation failed.')} satisfies ImageReply<Blob>)}
}
self.onmessage=({data}:MessageEvent<unknown>)=>{void prepare(data)};
