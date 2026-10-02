import {streamEncryptionInfo,transformEncrypted,passwordKey,createPasswordVerifier,verifyPasswordVerifier} from './stream-encryption.js';
import {openOutput,copyFile} from './file-output.js';
import {Sha256,hashBlob} from './sha256.js';
import {createStoreZip} from './zip.js';

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
      const writer=await openOutput(data.output),proof=data.proof===true?new Sha256():null;
      const output=proof?{
        async write(bytes){proof.update(bytes);await writer.write(bytes);},
        close:()=>writer.close(),abort:()=>writer.abort(),file:()=>writer.file(),get size(){return writer.size;}
      }:writer;
      try{
        if(type==='file.copy')await copyFile(data.file,output,progress);else await transformEncrypted(data.file,data.key,output,{decrypt:type.endsWith('.decrypt'),progress});
        await output.close();const file=await output.file();return proof?{file,hash:proof.hex()}:file;
      }catch(error){await output.abort().catch(()=>{});throw error;}
    }
    if(type==='crypto.info')return streamEncryptionInfo(data.file);
    if(type==='crypto.key')return passwordKey(data.password);
    if(type==='crypto.verifier.create')return createPasswordVerifier(data.key);
    if(type==='crypto.verifier.check')return verifyPasswordVerifier(data.file,data.key);
    if(type==='file.hash')return hashBlob(data.file,progress);
    if(type==='checksum')return data.value instanceof Blob?hashBlob(data.value,progress):checksum(data.value,data.algorithm);
    if(type==='stringify')return JSON.stringify(data.value);
    if(type==='chunk'){
      const body={seq:data.seq,entityType:data.entityType,items:data.items},hash=await checksum(body,data.algorithm);
      const line=JSON.stringify({type:'chunk',...body,count:body.items.length,checksum:hash});
      if(utf8(line).length>data.maxLineBytes)throw new Error('A backup chunk exceeds the safe line-size limit.');
      return {line,checksum:hash};
    }
    if(type==='parseBlob'){
      if(data.file.size>data.maxBytes)throw new Error('Legacy JSON backup is too large.');
      const text=await data.file.text();if(utf8(text).length>data.maxBytes)throw new Error('Legacy JSON backup exceeds the safe in-memory limit after reading.');return JSON.parse(text);
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
    if(type==='equalFiles'){
      if(data.left.size!==data.right.size)return false;
      for(let offset=0;offset<data.left.size;offset+=1024*1024){const [left,right]=await Promise.all([data.left.slice(offset,offset+1024*1024).arrayBuffer(),data.right.slice(offset,offset+1024*1024).arrayBuffer()]);const a=new Uint8Array(left),b=new Uint8Array(right);if(a.length!==b.length||a.some((value,index)=>value!==b[index]))return false;progress({loaded:Math.min(offset+1048576,data.left.size),total:data.left.size,phase:'verifying'});}return true;
    }
    throw new Error('Unknown portable processing operation.');
  }
  return Object.freeze({run});
}
