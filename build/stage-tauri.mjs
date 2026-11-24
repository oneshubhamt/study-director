import fs from 'node:fs';
import path from 'node:path';
import {DIST,SOURCE,writeNativeBuild} from './build.mjs';

// Windows resources are derived from the existing 32px application icon.
// A PNG-compressed ICO has a six-byte directory header and one 16-byte entry.
const png=fs.readFileSync(path.join(SOURCE,'assets','icons','favicon-32.png'));
if(png.length<24||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||png.toString('ascii',12,16)!=='IHDR'||png.readUInt32BE(16)!==32||png.readUInt32BE(20)!==32){
  throw new Error('Expected a valid 32×32 PNG for the native window icon.');
}
const header=Buffer.alloc(22);
header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);
header[6]=32;header[7]=32;
header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);
header.writeUInt32LE(png.length,14);header.writeUInt32LE(header.length,18);
const result=writeNativeBuild();
const resources=path.join(DIST,'tauri-resources');
fs.mkdirSync(resources,{recursive:true});
fs.writeFileSync(path.join(resources,'icon.ico'),Buffer.concat([header,png]));
console.log(JSON.stringify(result,null,2));
