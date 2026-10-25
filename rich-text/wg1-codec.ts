/* DOM-free WG1 envelope/text helpers shared by the editor bundle and search worker. */
import {PRODUCTION_LIMITS} from '../contracts/production-limits.mjs';
export const WG1_STORAGE_PREFIX='WG1:';
export const WG1_VERSION=1;
export const WG1_DEFAULT_MAX_DEPTH=64;
export const WG1_DEFAULT_MAX_NODES=PRODUCTION_LIMITS.maxRichTextNodes;

type JsonNode={type?:unknown,param?:unknown,content?:unknown};
export type WG1Envelope={version:number;doc:JsonNode};
export type DecodedWG1Envelope=
  |{kind:'plain';text:string}
  |{kind:'invalid-envelope';text:string}
  |{kind:'valid-envelope';text:string;envelope:WG1Envelope};

export function normalizePlainText(value:unknown){return String(value??'').replace(/\r\n?/g,'\n')}

export function jsonTreeWithinBudget(value:unknown,maxDepth=WG1_DEFAULT_MAX_DEPTH,maxNodes=WG1_DEFAULT_MAX_NODES){
  let count=0,valid=true;
  const visit=(node:unknown,depth:number)=>{
    if(!valid)return;
    if(depth>maxDepth||++count>maxNodes){valid=false;return}
    if(!node||typeof node!=='object'||Array.isArray(node)){valid=false;return}
    const row=node as JsonNode;
    if(row.content!==undefined){
      if(!Array.isArray(row.content)){valid=false;return}
      for(const child of row.content)visit(child,depth+1);
    }
  };
  visit(value,0);
  return valid;
}

function parsedObject(value:unknown){return !!value&&typeof value==='object'&&!Array.isArray(value)}
function envelopeIntent(value:Record<string,unknown>){return Object.hasOwn(value,'version')||Object.hasOwn(value,'doc')}

export function decodeWG1Envelope(value:unknown,maxDepth=WG1_DEFAULT_MAX_DEPTH,maxNodes=WG1_DEFAULT_MAX_NODES):DecodedWG1Envelope{
  const text=String(value??'');
  if(!text.startsWith(WG1_STORAGE_PREFIX))return {kind:'plain',text};
  let parsed:unknown;
  try{parsed=JSON.parse(text.slice(WG1_STORAGE_PREFIX.length))}catch{return {kind:'plain',text}}
  if(!parsedObject(parsed))return {kind:'plain',text};
  const object=parsed as Record<string,unknown>;
  if(!envelopeIntent(object))return {kind:'plain',text};
  const keys=Object.keys(object).sort();
  if(keys.length!==2||keys[0]!=='doc'||keys[1]!=='version'||object.version!==WG1_VERSION||!parsedObject(object.doc))return {kind:'invalid-envelope',text};
  if(!jsonTreeWithinBudget(object.doc,maxDepth,maxNodes))return {kind:'invalid-envelope',text};
  return {kind:'valid-envelope',text,envelope:object as WG1Envelope};
}

export function encodeWG1Document(doc:unknown){return WG1_STORAGE_PREFIX+JSON.stringify({version:WG1_VERSION,doc})}

function imagePlainText(param:unknown){
  const alt=param&&typeof param==='object'&&typeof (param as {alt?:unknown}).alt==='string'?(param as {alt:string}).alt:'';
  return alt?`[Image: ${alt}]`:'[Image]';
}

export function plainTextFromDocumentJson(doc:JsonNode){
  let text='',started=false;
  const openBlock=()=>{if(started)text+='\n';else started=true};
  const append=(value:string)=>{text+=value;started=true};
  const visit=(node:unknown)=>{
    if(!node||typeof node!=='object'||Array.isArray(node))return;
    const row=node as JsonNode,type=typeof row.type==='string'?row.type:'';
    if(type==='Text'){append(typeof row.param==='string'?row.param:String(row.param??''));return}
    if(type==='Paragraph'||type==='Heading')openBlock();
    if(type==='SDImage'){openBlock();append(imagePlainText(row.param));return}
    if(type==='HorizontalRule'){openBlock();append('---');return}
    if(type==='LineBreak'){append('\n');return}
    if(Array.isArray(row.content))for(const child of row.content)visit(child);
  };
  visit(doc);
  return text;
}

export function wg1ToPlainText(value:unknown,maxDepth=WG1_DEFAULT_MAX_DEPTH,maxNodes=WG1_DEFAULT_MAX_NODES){
  const decoded=decodeWG1Envelope(value,maxDepth,maxNodes);
  if(decoded.kind==='plain')return normalizePlainText(decoded.text);
  return decoded.kind==='valid-envelope'?plainTextFromDocumentJson(decoded.envelope.doc):'';
}
