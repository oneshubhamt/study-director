import {PRODUCTION_LIMITS as limits} from '../contracts/production-limits.mjs';
export type PreparedImage={blob:Blob;width:number;height:number};
export async function normalizeImage(file:Blob,mimeType:string,offscreen:boolean,signal?:AbortSignal):Promise<PreparedImage>{
  signal?.throwIfAborted();
  if(!['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(mimeType)||!file.size||file.size>limits.richAssetMaxBytes)throw new RangeError('Invalid image or image exceeds 12 MiB.');
  const original=file.type===mimeType?file:new Blob([file],{type:mimeType});
  const source=await createImageBitmap(original);
  let canvas:OffscreenCanvas|HTMLCanvasElement|undefined;
  try{
    signal?.throwIfAborted();
    const width=source.width,height=source.height;
    if(!width||!height)throw new Error('Image has no dimensions.');
    const scale=Math.min(1,limits.richAssetMaxDimensionPx/width,limits.richAssetMaxDimensionPx/height,Math.sqrt(limits.richAssetMaxPixels/(width*height)));
    if(scale>=1)return {blob:original,width,height};
    if(mimeType==='image/gif')throw new RangeError(`GIF dimensions exceed ${limits.richAssetMaxDimensionPx}px. Use a smaller GIF or a static image.`);
    const nextWidth=Math.max(1,Math.round(width*scale)),nextHeight=Math.max(1,Math.round(height*scale));
    canvas=offscreen?new OffscreenCanvas(nextWidth,nextHeight):document.createElement('canvas');
    canvas.width=nextWidth;canvas.height=nextHeight;
    const context=canvas.getContext('2d') as CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D|null;
    if(!context)throw new Error('Image resizing is unavailable.');
    context.imageSmoothingQuality='high';context.drawImage(source,0,0,nextWidth,nextHeight);
    const blob=offscreen?await (canvas as OffscreenCanvas).convertToBlob({type:'image/webp',quality:.92}):await new Promise<Blob|null>((resolve,reject)=>{try{(canvas as HTMLCanvasElement).toBlob(resolve,'image/webp',.92)}catch(error){reject(error)}});
    signal?.throwIfAborted();
    if(!(blob instanceof Blob)||!blob.size||!['image/webp','image/png'].includes(blob.type))throw new Error('Image could not be resized.');
    if(blob.size>limits.richAssetMaxBytes)throw new RangeError('Optimized image is still too large.');
    return {blob,width:nextWidth,height:nextHeight};
  }finally{source.close();if(canvas){canvas.width=1;canvas.height=1}}
}
