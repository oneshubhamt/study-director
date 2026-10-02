import {normalizeImage} from './image-processing';
let busy=false;
self.onmessage=async({data})=>{
  if(busy)return;busy=true;
  if(typeof createImageBitmap!=='function'||typeof OffscreenCanvas!=='function'||typeof OffscreenCanvas.prototype.convertToBlob!=='function'){self.postMessage({unsupported:true});return}
  try{const result=await normalizeImage(data.file,data.mimeType,true);self.postMessage({result})}
  catch(error){self.postMessage({error:{name:error.name,message:error.message}})}
};
