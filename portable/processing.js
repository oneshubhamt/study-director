import {streamEncryptionInfo,transformEncrypted,passwordKey,createPasswordVerifier,verifyPasswordVerifier} from './stream-encryption.js';
import {openOutput,copyFile} from './file-output.js';
import {hashBlob} from './sha256.js';
import {createStoreZip} from './zip.js';

const COMPARE_CHUNK_BYTES=1048576,RANGES_MAX_BYTES=16*1048576;
const hexOf=buffer=>Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,'0')).join('');
function sameBytes(left,right){
  if(left.byteLength!==right.byteLength)return false;
  const words=left.byteLength>>>2,a=new Int32Array(left,0,words),b=new Int32Array(right,0,words);
  for(let i=0;i<words;i++)if(a[i]!==b[i])return false;
  const x=new Uint8Array(left),y=new Uint8Array(right);for(let i=words<<2;i<x.length;i++)if(x[i]!==y[i])return false;
  return true;
}
// Pure processing only: no DOM, application storage, permissions or ownership.
export function createProcessingEngine(renderMarkdown=()=>{throw new Error('Markdown renderer unavailable.');}){
  const sessions=new Map();let sequence=0;
  const utf8=value=>new TextEncoder().encode(value);
  async function checksum(value,algorithm='sha256'){
    const bytes=value instanceof Blob?new Uint8Array(await value.arrayBuffer()):utf8(typeof value==='string'?value:JSON.stringify(value));
    if(algorithm==='fnv1a32'){let hash=0x811c9dc5;for(const byte of bytes){hash^=byte;hash=Math.imul(hash,0x01000193)>>>0;}return hash.toString(16).padStart(8,'0');}
    if(algorithm!=='sha256')throw new Error('Unsupported backup checksum algorithm.');
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function* decoded(file,{gzip,maxBytes,maxLineBytes}){
    let stream=file.stream();if(gzip)stream=stream.pipeThrough(new DecompressionStream('gzip'));
    const reader=stream.getReader(),decoder=new TextDecoder();let buffer='',bytes=0,lines=0;
    try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>maxBytes)throw new Error(`Backup expands beyond the ${Math.round(maxBytes/1048576)} MB safe uncompressed limit.`);buffer+=decoder.decode(part.value,{stream:true});
      for(;;){const index=buffer.indexOf('\n');if(index<0)break;const line=buffer.slice(0,index).replace(/\r$/,'');buffer=buffer.slice(index+1);if(utf8(line).length>maxLineBytes)throw new Error('Backup contains an oversized chunk line.');lines++;if(line.trim())yield {value:JSON.parse(line),uncompressedBytes:bytes,lines};}
      if(utf8(buffer).length>maxLineBytes)throw new Error('Backup contains an oversized or unterminated chunk line.');
    }buffer+=decoder.decode();if(buffer.trim()){if(utf8(buffer).length>maxLineBytes)throw new Error('Backup contains an oversized final line.');yield {value:JSON.parse(buffer),uncompressedBytes:bytes,lines:++lines};}
    }finally{try{await reader.cancel();}finally{reader.releaseLock();}}
  }
  async function run(type,data={},progress=()=>{}){
    if(typeof progress!=='function')progress=()=>{};
    if(type==='file.copy'||type==='crypto.stream.encrypt'||type==='crypto.stream.decrypt'){
      const output=await openOutput(data.output);
      try{
        if(type==='file.copy')await copyFile(data.file,output,progress);else await transformEncrypted(data.file,data.key,output,{decrypt:type.endsWith('.decrypt'),progress});
        await output.close();return await output.file();
      }catch(error){await output.abort().catch(()=>{});throw error;}
    }
    if(type==='crypto.info')return streamEncryptionInfo(data.file);
    if(type==='crypto.key')return passwordKey(data.password);
    if(type==='crypto.verifier.create')return createPasswordVerifier(data.key);
    if(type==='crypto.verifier.check')return verifyPasswordVerifier(data.file,data.key);
    if(type==='file.hash')return hashBlob(data.file,progress);
    if(type==='checksum')return data.value instanceof Blob?hashBlob(data.value,progress):checksum(data.value,data.algorithm);
    // Small parts stored back to back in one file: one read, then the
    // browser's SHA-256 on each part. Returns one hex digest per range.
    if(type==='checksum.ranges'){
      const ranges=Array.isArray(data.ranges)?data.ranges:[],start=ranges[0]?.start,end=ranges.at(-1)?.end;
      if(!(data.file instanceof Blob)||!ranges.length||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>data.file.size||end-start>RANGES_MAX_BYTES||ranges.some((range,index)=>!(range.start>=start&&range.end>=range.start&&range.end<=end&&(!index||range.start>=ranges[index-1].end))))throw new Error('Checksum ranges are invalid.');
      const bytes=await data.file.slice(start,end).arrayBuffer();progress({loaded:end-start,total:end-start,phase:'verifying'});
      return Promise.all(ranges.map(async range=>hexOf(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes,range.start-start,range.end-range.start)))));
    }
    if(type==='stringify')return JSON.stringify(data.value);
    if(type==='chunk'){
      const body={seq:data.seq,entityType:data.entityType,items:data.items},hash=await checksum(body,data.algorithm);
      const line=JSON.stringify({type:'chunk',...body,count:body.items.length,checksum:hash});
      if(utf8(line).length>data.maxLineBytes)throw new Error('A backup chunk exceeds the safe line-size limit.');
      return {line,checksum:hash};
    }
    if(type==='parseBlob'){
      if(data.file.size>data.maxBytes)throw new Error('JSON payload exceeds the safe size limit.');
      const text=await data.file.text();if(utf8(text).length>data.maxBytes)throw new Error('JSON payload exceeds the safe in-memory limit.');return JSON.parse(text);
    }
    if(type==='decode.open'){const id=++sequence;sessions.set(id,{iterator:decoded(data.file,data)[Symbol.asyncIterator]()});return id;}
    if(type==='decode.next'){const session=sessions.get(data.id);if(!session)throw new Error('Backup reader expired.');const next=await session.iterator.next();if(next.done)sessions.delete(data.id);return next;}
    if(type==='decode.close'){const session=sessions.get(data.id);sessions.delete(data.id);await session?.iterator.return();return true;}
    if(type==='encode.open'){
      const stream=data.gzip?new CompressionStream('gzip'):new TransformStream();
      const id=++sequence,session={writer:stream.writable.getWriter(),bytes:0,maxBytes:data.maxBytes};
      session.result=(async()=>{const reader=stream.readable.getReader(),parts=[];let bytes=0;try{for(;;){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>session.maxBytes)throw new Error('Backup exceeds the safe compressed-size limit.');parts.push(next.value);}return new Blob(parts);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}})();
      session.result.catch(()=>{});sessions.set(id,session);return id;
    }
    if(type==='encode.write'){const session=sessions.get(data.id);if(!session)throw new Error('Backup writer expired.');await session.writer.write(utf8(data.line));return true;}
    if(type==='encode.finish'){const session=sessions.get(data.id);if(!session)throw new Error('Backup writer expired.');try{await session.writer.close();return await session.result;}finally{sessions.delete(data.id);}}
    if(type==='encode.close'){const session=sessions.get(data.id);sessions.delete(data.id);await session?.writer.abort().catch(()=>{});return true;}
    if(type==='markdown')return renderMarkdown(data.doc,data.text,{assetPath:id=>data.paths[id]||''});
    if(type==='zip')return createStoreZip(data.files,{textEncoder:()=>new TextEncoder(),now:()=>new Date(data.date),makeBlob:(parts,type)=>new Blob(parts,{type})});
    // Byte-for-byte comparison in 1 MB pieces (bounded memory), a word at a time: bound by
    // reading speed rather than hashing.
    if(type==='equalFiles'){
      const size=data.left.size;if(size!==data.right.size)return false;
      for(let offset=0;offset<size;offset+=COMPARE_CHUNK_BYTES){const [left,right]=await Promise.all([data.left.slice(offset,offset+COMPARE_CHUNK_BYTES).arrayBuffer(),data.right.slice(offset,offset+COMPARE_CHUNK_BYTES).arrayBuffer()]);if(!sameBytes(left,right))return false;progress({loaded:Math.min(offset+COMPARE_CHUNK_BYTES,size),total:size,phase:'verifying'});}return true;
    }
    throw new Error('Unknown portable processing operation.');
  }
  return Object.freeze({run});
}
