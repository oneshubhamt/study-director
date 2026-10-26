import type {Bytes,Progress} from '../types/portable-file.ts';
import type {ProcessingInputs,ProcessingOutputs,ProcessingOperation,DecodeOptions,DecodedLine} from '../types/portable-processing.ts';
import type {markdownDocument} from '../rich-text/markdown';
import {streamEncryptionInfo,transformEncrypted,passwordKey,createPasswordVerifier,verifyPasswordVerifier} from './stream-encryption.ts';
import {openOutput,copyFile} from './file-output.ts';
import {hashBlob} from './sha256.ts';
import {createStoreZip} from './zip.ts';

const COMPARE_CHUNK_BYTES=1048576,RANGES_MAX_BYTES=16*1048576;
const hexOf=(buffer:ArrayBuffer)=>Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,'0')).join('');
function sameBytes(left:ArrayBuffer,right:ArrayBuffer){
  if(left.byteLength!==right.byteLength)return false;
  const words=left.byteLength>>>2,a=new Int32Array(left,0,words),b=new Int32Array(right,0,words);
  for(let i=0;i<words;i++)if(a[i]!==b[i])return false;
  const x=new Uint8Array(left),y=new Uint8Array(right);for(let i=words<<2;i<x.length;i++)if(x[i]!==y[i])return false;
  return true;
}
// Pure processing only: no DOM, application storage, permissions or ownership.
export function createProcessingEngine(renderMarkdown:typeof markdownDocument=()=>{throw new Error('Markdown renderer unavailable.');}){
  type EncodeSession={writer:WritableStreamDefaultWriter<Bytes>;bytes:number;maxBytes:number;result:Promise<Blob>};
  type DecodeSession={iterator:AsyncGenerator<DecodedLine,void,unknown>};
  const sessions=new Map<number,EncodeSession|DecodeSession>();
  function readerSession(id:number){const session=sessions.get(id);if(session&&!('iterator' in session))throw new Error('Backup reader expired.');return session;}
  function writerSession(id:number){const session=sessions.get(id);if(session&&!('writer' in session))throw new Error('Backup writer expired.');return session;}let sequence=0;
  const utf8=(value:string|undefined)=>new TextEncoder().encode(value);
  async function checksum(value:unknown,algorithm='sha256'){
    const bytes=value instanceof Blob?new Uint8Array(await value.arrayBuffer()):utf8(typeof value==='string'?value:JSON.stringify(value));
    if(algorithm==='fnv1a32'){let hash=0x811c9dc5;for(const byte of bytes){hash^=byte;hash=Math.imul(hash,0x01000193)>>>0;}return hash.toString(16).padStart(8,'0');}
    if(algorithm!=='sha256')throw new Error('Unsupported backup checksum algorithm.');
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function* decoded(file:Blob,{gzip,maxBytes,maxLineBytes}:DecodeOptions):AsyncGenerator<DecodedLine,void,unknown>{
    let stream=file.stream();if(gzip)stream=stream.pipeThrough(new DecompressionStream('gzip'));
    const reader=stream.getReader(),decoder=new TextDecoder();let buffer='',bytes=0,lines=0;
    try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>maxBytes)throw new Error(`Backup expands beyond the ${Math.round(maxBytes/1048576)} MB safe uncompressed limit.`);buffer+=decoder.decode(part.value,{stream:true});
      for(;;){const index=buffer.indexOf('\n');if(index<0)break;const line=buffer.slice(0,index).replace(/\r$/,'');buffer=buffer.slice(index+1);if(utf8(line).length>maxLineBytes)throw new Error('Backup contains an oversized chunk line.');lines++;if(line.trim())yield {value:JSON.parse(line),uncompressedBytes:bytes,lines};}
      if(utf8(buffer).length>maxLineBytes)throw new Error('Backup contains an oversized or unterminated chunk line.');
    }buffer+=decoder.decode();if(buffer.trim()){if(utf8(buffer).length>maxLineBytes)throw new Error('Backup contains an oversized final line.');yield {value:JSON.parse(buffer),uncompressedBytes:bytes,lines:++lines};}
    }finally{try{await reader.cancel();}finally{reader.releaseLock();}}
  }
  const handlers:{[K in ProcessingOperation]:(data:ProcessingInputs[K],progress:Progress)=>Promise<ProcessingOutputs[K]>}={
"file.copy":async(data,progress)=>{
      const output=await openOutput(data.output);
      try{
        await copyFile(data.file,output,progress);
        await output.close();return await output.file();
      }catch(error){await output.abort().catch(()=>{});throw error;}
    },
"crypto.stream.encrypt":async(data,progress)=>{
      const output=await openOutput(data.output);
      try{
        await transformEncrypted(data.file,data.key,output,{decrypt:false,progress});
        await output.close();return await output.file();
      }catch(error){await output.abort().catch(()=>{});throw error;}
    },
"crypto.stream.decrypt":async(data,progress)=>{
      const output=await openOutput(data.output);
      try{
        await transformEncrypted(data.file,data.key,output,{decrypt:true,progress});
        await output.close();return await output.file();
      }catch(error){await output.abort().catch(()=>{});throw error;}
    },
"crypto.info":async(data,progress)=>{return streamEncryptionInfo(data.file);},
"crypto.key":async(data,progress)=>{return passwordKey(data.password);},
"crypto.verifier.create":async(data,progress)=>{return createPasswordVerifier(data.key);},
"crypto.verifier.check":async(data,progress)=>{return verifyPasswordVerifier(data.file,data.key);},
"file.hash":async(data,progress)=>{return hashBlob(data.file,progress);},
"checksum":async(data,progress)=>{return data.value instanceof Blob?hashBlob(data.value,progress):checksum(data.value,data.algorithm);},
"checksum.ranges":async(data,progress)=>{
      const ranges=Array.isArray(data.ranges)?data.ranges as {start:number;end:number}[]:[],start=ranges[0]?.start,end=ranges.at(-1)?.end;
      if(!(data.file instanceof Blob)||!ranges.length||start===undefined||end===undefined||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>data.file.size||end-start>RANGES_MAX_BYTES||ranges.some((range,index)=>!(range.start>=start&&range.end>=range.start&&range.end<=end&&(!index||range.start>=ranges[index-1]!.end))))throw new Error('Checksum ranges are invalid.');
      const bytes=await data.file.slice(start,end).arrayBuffer();progress({loaded:end-start,total:end-start,phase:'verifying'});
      return Promise.all(ranges.map(async range=>hexOf(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes,range.start-start,range.end-range.start)))));
    },
"stringify":async(data,progress)=>{return JSON.stringify(data.value);},
"chunk":async(data,progress)=>{
      const body={seq:data.seq,entityType:data.entityType,items:data.items},hash=await checksum(body,data.algorithm);
      const line=JSON.stringify({type:'chunk',...body,count:body.items.length,checksum:hash});
      if(utf8(line).length>data.maxLineBytes)throw new Error('A backup chunk exceeds the safe line-size limit.');
      return {line,checksum:hash};
    },
"parseBlob":async(data,progress)=>{
      if(data.file.size>data.maxBytes)throw new Error('JSON payload exceeds the safe size limit.');
      const text=await data.file.text();if(utf8(text).length>data.maxBytes)throw new Error('JSON payload exceeds the safe in-memory limit.');return JSON.parse(text) as unknown;
    },
"decode.open":async(data,progress)=>{const id=++sequence;sessions.set(id,{iterator:decoded(data.file,data)[Symbol.asyncIterator]()});return id;},
"decode.next":async(data,progress)=>{const session=readerSession(data.id);if(!session)throw new Error('Backup reader expired.');const next=await session.iterator.next();if(next.done)sessions.delete(data.id);return next;},
"decode.close":async(data,progress)=>{const session=readerSession(data.id);sessions.delete(data.id);await session?.iterator.return();return true;},
"encode.open":async(data,progress)=>{
      const stream=data.gzip?new CompressionStream('gzip'):new TransformStream<Bytes,Bytes>();
      const id=++sequence,maxBytes=data.maxBytes,writer=stream.writable.getWriter();
      const result=(async()=>{const reader=stream.readable.getReader(),parts=[];let bytes=0;try{for(;;){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>maxBytes)throw new Error('Backup exceeds the safe compressed-size limit.');parts.push(next.value);}return new Blob(parts);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}})();
      const session:EncodeSession={writer,bytes:0,maxBytes,result};
      void session.result.catch(()=>{});sessions.set(id,session);return id;
    },
"encode.write":async(data,progress)=>{const session=writerSession(data.id);if(!session)throw new Error('Backup writer expired.');await session.writer.write(utf8(data.line));return true;},
"encode.finish":async(data,progress)=>{const session=writerSession(data.id);if(!session)throw new Error('Backup writer expired.');try{await session.writer.close();return await session.result;}finally{sessions.delete(data.id);}},
"encode.close":async(data,progress)=>{const session=writerSession(data.id);sessions.delete(data.id);await session?.writer.abort().catch(()=>{});return true;},
"markdown":async(data,progress)=>{return renderMarkdown(data.doc,data.text,{assetPath:id=>data.paths[id]||''});},
"zip":async(data,progress)=>{return createStoreZip(data.files,{textEncoder:()=>new TextEncoder(),now:()=>new Date(data.date),makeBlob:(parts,type)=>new Blob(parts,{type})});},
"equalFiles":async(data,progress)=>{
      const size=data.left.size;if(size!==data.right.size)return false;
      for(let offset=0;offset<size;offset+=COMPARE_CHUNK_BYTES){const [left,right]=await Promise.all([data.left.slice(offset,offset+COMPARE_CHUNK_BYTES).arrayBuffer(),data.right.slice(offset,offset+COMPARE_CHUNK_BYTES).arrayBuffer()]);if(!sameBytes(left,right))return false;progress({loaded:Math.min(offset+COMPARE_CHUNK_BYTES,size),total:size,phase:'verifying'});}return true;
    }
};
  function run<K extends ProcessingOperation>(type:K,data:ProcessingInputs[NoInfer<K>],progress:Progress=()=>{}):Promise<ProcessingOutputs[K]>{
    if(typeof progress!=='function')progress=()=>{};
    if(!Object.hasOwn(handlers,type))return Promise.reject(new Error('Unknown portable processing operation.'));
    return handlers[type](data,progress);
  }
  return Object.freeze({run});
}
