import {messageObject} from './worker-contracts.ts';
import type {OutputTarget,FilePort} from '../types/portable-file.ts';
import type {ProcessingRequest} from '../types/portable-processing.ts';
import type {MarkdownNode} from '../rich-text/markdown';
// These checks validate transport shapes. Domain/schema/cryptographic validation
// remains in the operation that consumes the value.
export function binary(value:unknown):Blob{if(!(value instanceof Blob))throw new TypeError('A file is required.');return value;}
function text(value:unknown):string{if(typeof value!=='string')throw new TypeError('A string is required.');return value;}
function number(value:unknown):number{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError('A finite number is required.');return value;}
function optionalText(value:unknown){return value===undefined?undefined:text(value);}
function optionalBoolean(value:unknown){if(value!==undefined&&typeof value!=='boolean')throw new TypeError('A boolean is required.');return value;}
export function cryptoKey(value:unknown):CryptoKey{
 const key=messageObject(value);
 if(key['type']!=='secret'||messageObject(key['algorithm'])['name']!=='PBKDF2'||key['extractable'])throw Object.assign(new Error('Unlock backup protection first.'),{code:'BACKUP_LOCKED'});
 // CryptoKey identity is enforced by WebCrypto at use, without realm-dependent instanceof.
 return value as CryptoKey;
}
export function outputTarget(value:unknown):OutputTarget{
 const target=messageObject(value);
 if(target['kind']==='opfs')return {kind:'opfs',name:text(target['name']),directory:text(target['directory'])};
 if(typeof target['getFile']!=='function'||(typeof target['createWritable']!=='function'&&typeof target['createSyncAccessHandle']!=='function'))throw new TypeError('Backup file output is unavailable.');
 return value as FilePort;
}
function markdownNode(value:unknown):asserts value is MarkdownNode|null|undefined{
 if(value==null)return;
 if(typeof value!=='object'||Array.isArray(value))throw new TypeError('Invalid Markdown document.');
 const node=messageObject(value);
 if(node['marks']!==undefined&&(node['marks']===null||typeof node['marks']!=='object'||Array.isArray(node['marks'])))throw new TypeError('Invalid Markdown marks.');
 if(node['content']!==undefined){if(!Array.isArray(node['content']))throw new TypeError('Invalid Markdown content.');for(const child of node['content']){if(child==null)throw new TypeError('Invalid Markdown child.');markdownNode(child);}}
}
export function processingRequest(type:unknown,input:unknown):ProcessingRequest{
 const data=messageObject(input),file=()=>binary(data['file']),id=()=>number(data['id']),key=()=>cryptoKey(data['key']);
 switch(type){
  case 'file.copy':return {type,data:{file:file(),output:outputTarget(data['output'])}};
  case 'crypto.stream.encrypt':case 'crypto.stream.decrypt':return {type,data:{file:file(),output:outputTarget(data['output']),key:key()}};
  case 'crypto.info':case 'file.hash':return {type,data:{file:file()}};
  case 'crypto.key':return {type,data:{password:text(data['password'])}};
  case 'crypto.verifier.create':return {type,data:{key:key()}};
  case 'crypto.verifier.check':return {type,data:{file:file(),key:key()}};
  case 'checksum':return {type,data:{value:data['value'],algorithm:optionalText(data['algorithm'])}};
  case 'checksum.ranges':{
   if(!Array.isArray(data['ranges']))throw new Error('Checksum ranges are invalid.');
   const ranges=(data['ranges'] as unknown[]).map(value=>{const row=messageObject(value);return {start:number(row['start']),end:number(row['end'])};});return {type,data:{file:file(),ranges}};
  }
  case 'stringify':return {type,data:{value:data['value']}};
  case 'chunk':{
   if(!Array.isArray(data['items']))throw new TypeError('Chunk items must be an array.');
   return {type,data:{seq:number(data['seq']),entityType:text(data['entityType']),items:data['items'] as unknown[],algorithm:optionalText(data['algorithm']),maxLineBytes:number(data['maxLineBytes'])}};
  }
  case 'parseBlob':return {type,data:{file:file(),maxBytes:number(data['maxBytes'])}};
  case 'decode.open':return {type,data:{file:file(),gzip:optionalBoolean(data['gzip']),maxBytes:number(data['maxBytes']),maxLineBytes:number(data['maxLineBytes'])}};
  case 'decode.next':case 'decode.close':case 'encode.finish':case 'encode.close':return {type,data:{id:id()}};
  case 'encode.open':return {type,data:{gzip:optionalBoolean(data['gzip']),maxBytes:number(data['maxBytes'])}};
  case 'encode.write':return {type,data:{id:id(),line:text(data['line'])}};
  case 'markdown':{
   const doc=data['doc'];markdownNode(doc);const paths:Record<string,string>={};for(const [id,value] of Object.entries(messageObject(data['paths'])))paths[id]=text(value);
   return {type,data:{doc,text:optionalText(data['text']),paths}};
  }
  case 'zip':{
   if(!Array.isArray(data['files']))throw new TypeError('ZIP export requires files.');
   const files=(data['files'] as unknown[]).map(value=>{const row=messageObject(value);return {name:text(row['name']),blob:binary(row['blob'])};});const date=data['date'];
   return {type,data:{files,date:typeof date==='number'?number(date):text(date)}};
  }
  case 'equalFiles':return {type,data:{left:binary(data['left']),right:binary(data['right'])}};
  default:throw new Error('Unknown portable processing operation.');
 }
}
