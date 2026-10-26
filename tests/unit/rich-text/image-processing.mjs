import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {PRODUCTION_LIMITS as limits} from '../../../contracts/production-limits.mjs';
// Execute authored resizing logic with a typed canvas port's two platform operations.
// No DOM is provided: a browser dependency here would fail this test.
const source=stripTypeScriptTypes(fs.readFileSync('rich-text/image-processing.ts','utf8'),{mode:'strip'}).replace(/^import .*;$/gmu,'').replace(/export /gu,'');
function harness(width=8192,height=4096,{context=true,encoded=new Blob(['resized'],{type:'image/webp'}),encodeError=null}={}){
 const calls={closed:0,created:0,drawn:0,encoded:0};let canvas;
 const contextValue={imageSmoothingQuality:'low',drawImage(_source,x,y,w,h){calls.drawn++;assert.equal(x,0);assert.equal(y,0);assert.equal(w,4096);assert.equal(h,2048);}};
 const port={create(w,h){calls.created++;canvas={width:w,height:h,getContext:()=>context?contextValue:null};return canvas;},async encode(value){assert.equal(value,canvas);calls.encoded++;if(encodeError)throw encodeError;return encoded;}};
 const normalize=vm.runInNewContext(source+'\nnormalizeImage;',{limits,Blob,createImageBitmap:async()=>({width,height,close(){calls.closed++;}})});
 return {normalize,port,calls,get canvas(){return canvas;}};
}
const original=new Blob(['original'],{type:'image/png'});
{
 const h=harness(640,480);const result=await h.normalize(original,'image/png',h.port);
 assert.equal(result.blob,original,'within-budget image preserves the exact Blob');assert.equal(result.width,640);assert.equal(h.calls.created,0);assert.equal(h.calls.closed,1);
}
{
 const h=harness();const result=await h.normalize(original,'image/png',h.port);
 assert.equal(result.width,4096);assert.equal(result.height,2048);assert.equal(result.blob.type,'image/webp');assert.deepEqual(h.calls,{closed:1,created:1,drawn:1,encoded:1});assert.equal(h.canvas.width,1);assert.equal(h.canvas.height,1);
}
for(const options of [{context:false},{encoded:null},{encoded:new Blob(['bad'],{type:'text/plain'})},{encodeError:new Error('encode failed')}]){
 const h=harness(8192,4096,options);await assert.rejects(h.normalize(original,'image/png',h.port));assert.equal(h.calls.closed,1);assert.equal(h.canvas.width,1);assert.equal(h.canvas.height,1);
}
{
 const h=harness();await assert.rejects(h.normalize(original,'image/gif',h.port),/GIF dimensions/);assert.equal(h.calls.closed,1);assert.equal(h.calls.created,0);
}
{
 const h=harness();const abort=new AbortController();abort.abort();await assert.rejects(h.normalize(original,'image/png',h.port,abort.signal),{name:'AbortError'});assert.equal(h.calls.closed,0);assert.equal(h.calls.created,0);
}
{
 const h=harness();const abort=new AbortController();const port={...h.port,async encode(canvas){const blob=await h.port.encode(canvas);abort.abort();return blob;}};
 await assert.rejects(h.normalize(original,'image/png',port,abort.signal),{name:'AbortError'});assert.equal(h.calls.closed,1);assert.equal(h.canvas.width,1);
}
console.log(JSON.stringify({status:'PASS',suite:'image-processing',originalBytes:true,boundedResize:true,cancellation:true,cleanup:true}));
