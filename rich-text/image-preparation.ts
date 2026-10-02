import {normalizeImage,PreparedImage} from './image-processing';
// One active preparation across editor surfaces. No persistent worker or retained image queue.
let active=false;
export async function prepareImage(file:Blob,mimeType:string,signal:AbortSignal,createWorker?:()=>Worker):Promise<PreparedImage>{
  signal.throwIfAborted();
  if(active)throw new RangeError('Another image is being prepared. Try again when it finishes.');
  active=true;
  try{
    let worker:Worker|undefined;
    if(createWorker){try{worker=createWorker()}catch{/* Capability/CSP fallback before any image processing. */}}
    if(!worker)return await normalizeImage(file,mimeType,false,signal);
    const result=await new Promise<PreparedImage|null>((resolve,reject)=>{
      let settled=false;
      const finish=(value:PreparedImage|null,error?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);worker!.onmessage=null;worker!.onerror=null;worker!.onmessageerror=null;worker!.terminate();error?reject(error):resolve(value)};
      const abort=()=>finish(null,signal.reason||new DOMException('Image preparation cancelled.','AbortError'));
      const timer=setTimeout(()=>finish(null,new Error('Image preparation timed out.')),30000);
      signal.addEventListener('abort',abort,{once:true});
      worker!.onmessage=({data})=>{if(data?.unsupported)return finish(null);if(data?.error){const error=data.error.name==='RangeError'?new RangeError(data.error.message):new Error(data.error.message);return finish(null,error)}const r=data?.result;if(!(r?.blob instanceof Blob)||!Number.isFinite(r.width)||!Number.isFinite(r.height))return finish(null,new Error('Invalid image worker response.'));finish(r)};
      worker!.onerror=event=>{event.preventDefault();finish(null,new Error('Image worker failed. Please retry.'))};
      worker!.onmessageerror=()=>finish(null,new Error('Image worker response could not be read.'));
      try{worker!.postMessage({file,mimeType})}catch(error){finish(null,error)}
      if(signal.aborted)abort();
    });
    signal.throwIfAborted();
    return result||await normalizeImage(file,mimeType,false,signal);
  }finally{active=false}
}
