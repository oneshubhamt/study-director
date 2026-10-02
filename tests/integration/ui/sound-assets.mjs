import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderBuild} from '../../../build/build.mjs';
import {staticAssets} from '../../../build/module-manifest.mjs';
const manifest=JSON.parse(fs.readFileSync('source/assets/sounds/manifest.json','utf8'));
const build=renderBuild(),sw=String(build.deployment.get('sw.js'));
assert.equal(manifest.cues.length,13);assert.equal(manifest.sampleRate,22050);
let bytes=0;
for(const cue of manifest.cues){
 const file=`assets/sounds/${cue.cue}.wav`,buffer=fs.readFileSync(`source/${file}`);
 bytes+=buffer.length;assert.equal(buffer.toString('ascii',0,4),'RIFF');assert.equal(buffer.toString('ascii',8,12),'WAVE');
 assert.equal(buffer.readUInt16LE(20),1);assert.equal(buffer.readUInt16LE(22),1);assert.equal(buffer.readUInt32LE(24),22050);assert.equal(buffer.readUInt16LE(34),16);assert.equal(buffer.readUInt32LE(40),buffer.length-44);
 let sum=0,peak=0;for(let i=44;i<buffer.length;i+=2){const v=buffer.readInt16LE(i)/32767;sum+=v*v;peak=Math.max(peak,Math.abs(v));}
 const rms=Math.sqrt(sum/((buffer.length-44)/2));assert.ok(peak<.44&&peak>.1);assert.ok(Math.abs(rms-.055)<.001);assert.equal(buffer.readInt16LE(44),0);assert.equal(buffer.readInt16LE(buffer.length-2),0);assert.ok(cue.seconds<=1.6);
 assert.ok(staticAssets.some(asset=>asset.source===file&&asset.precache===true));assert.ok(sw.includes(file));assert.deepEqual(Buffer.from(build.deployment.get(file)),buffer);assert.deepEqual(Buffer.from(build.development.get(file)),buffer);
}
assert.ok(bytes<600000,'the 22.05 kHz offline family remains under 600 KB');
console.log(JSON.stringify({status:'PASS',suite:'sound-assets',cues:manifest.cues.length,bytes,checks:['lossless format','bounded peaks and matched RMS','silent endpoints','both build targets','offline precache inventory']}));
