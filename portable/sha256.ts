import type {Progress} from '../types/portable-file.ts';
// Incremental SHA-256: fixed block state; callers never buffer the complete file.
const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
// Int32 words and inlined rotations keep the rounds in V8's integer fast
// path (about five times faster than the array-destructuring form). The
// result is the standard SHA-256 digest.
const K32=new Int32Array(K);
export class Sha256 {
  state:Uint32Array;block:Uint8Array<ArrayBuffer>;words:Int32Array;length:number;used:number;finished:boolean;
  constructor(){this.state=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);this.block=new Uint8Array(64);this.words=new Int32Array(64);this.length=0;this.used=0;this.finished=false;}
  // All indexed reads below follow fixed block/round bounds, including initialized state.
  compress(bytes:Uint8Array,offset=0){
    const w=this.words,s=this.state;
    for(let i=0;i<16;i++){const j=offset+(i<<2);w[i]=(bytes[j]!<<24)|(bytes[j+1]!<<16)|(bytes[j+2]!<<8)|bytes[j+3]!;}
    for(let i=16;i<64;i++){const x=w[i-15]!,y=w[i-2]!;w[i]=((((y>>>17)|(y<<15))^((y>>>19)|(y<<13))^(y>>>10))+w[i-7]!+(((x>>>7)|(x<<25))^((x>>>18)|(x<<14))^(x>>>3))+w[i-16]!)|0;}
    let a=s[0]!|0,b=s[1]!|0,c=s[2]!|0,d=s[3]!|0,e=s[4]!|0,f=s[5]!|0,g=s[6]!|0,h=s[7]!|0;
    for(let i=0;i<64;i++){
      const t1=(h+(((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)))+((e&f)^(~e&g))+K32[i]!+w[i]!)|0;
      const t2=((((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)))+((a&b)^(a&c)^(b&c)))|0;
      h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
    }
    s[0]=s[0]!+a;s[1]=s[1]!+b;s[2]=s[2]!+c;s[3]=s[3]!+d;s[4]=s[4]!+e;s[5]=s[5]!+f;s[6]=s[6]!+g;s[7]=s[7]!+h;
  }
  update(bytes:Uint8Array){if(this.finished)throw new Error('Hash already finished.');this.length+=bytes.length;let offset=0;if(this.used){const n=Math.min(64-this.used,bytes.length);this.block.set(bytes.subarray(0,n),this.used);this.used+=n;offset=n;if(this.used===64){this.compress(this.block);this.used=0;}}for(;offset+64<=bytes.length;offset+=64)this.compress(bytes,offset);if(offset<bytes.length){this.block.set(bytes.subarray(offset),0);this.used=bytes.length-offset;}return this;}
  hex(){if(this.finished)throw new Error('Hash already finished.');this.finished=true;const b=this.block;b[this.used++]=128;if(this.used>56){b.fill(0,this.used);this.compress(b);this.used=0;}b.fill(0,this.used,56);const view=new DataView(b.buffer);view.setUint32(56,Math.floor(this.length/0x20000000));view.setUint32(60,(this.length*8)>>>0);this.compress(b);return Array.from(this.state,v=>v.toString(16).padStart(8,'0')).join('');}
}
// Files up to NATIVE_DIGEST_MAX_BYTES are hashed by the browser's native
// SHA-256 in one call; larger ones stream through the incremental hash so the
// whole file is never held in memory. Both give the same digest.
const NATIVE_DIGEST_MAX_BYTES=32*1048576,hex=(buffer:ArrayBuffer)=>Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,'0')).join('');
export async function hashBlob(blob:Blob,progress:Progress=()=>{}){
  if(blob.size<=NATIVE_DIGEST_MAX_BYTES&&globalThis.crypto?.subtle){const digest=hex(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()));progress({loaded:blob.size,total:blob.size,phase:'verifying'});return digest;}
  const hash=new Sha256();for(let offset=0;offset<blob.size;offset+=1048576){hash.update(new Uint8Array(await blob.slice(offset,offset+1048576).arrayBuffer()));progress({loaded:Math.min(offset+1048576,blob.size),total:blob.size,phase:'verifying'});}return hash.hex();
}
