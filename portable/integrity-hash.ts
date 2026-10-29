import {Sha256} from './sha256.ts';
export type HashSnapshot={version:1;length:number;state:readonly number[];tail:readonly number[]};
export function hashSnapshot(hash:Sha256):HashSnapshot{if(hash.finished)throw new Error('Hash already finished.');return {version:1,length:hash.length,state:Array.from(hash.state),tail:Array.from(hash.block.slice(0,hash.used))};}
export function restoreHash(input:unknown){
  const value=input as Partial<HashSnapshot>|null|undefined;
  if(!value||value.version!==1||typeof value.length!=='number'||!Number.isSafeInteger(value.length)||value.length<0||!Array.isArray(value.state)||value.state.length!==8||value.state.some(v=>!Number.isInteger(v)||v<0||v>0xffffffff)||!Array.isArray(value.tail)||value.tail.length!==value.length%64||value.tail.some(v=>!Number.isInteger(v)||v<0||v>255))throw new Error('Integrity hash checkpoint is invalid.');
  const hash=new Sha256();hash.state.set(value.state);hash.length=value.length;hash.used=value.tail.length;hash.block.set(value.tail);return hash;
}
