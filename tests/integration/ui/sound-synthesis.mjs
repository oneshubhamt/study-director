import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {renderBuild} from '../../../build/build.mjs';
import {staticAssets} from '../../../build/module-manifest.mjs';

// The cues are made in code. Each must still be the Quiet Wood cue that shipped
// as a WAV file before: same length, same peak, same loudness, and the same
// overall shape (sum of absolute samples), measured from those files.
const REFERENCE={begin:[24916,.2253,767.2],pause:[13891,.2546,403.91],resume:[15876,.2602,463.27],skip:[12568,.2339,355.93],
  complete:[25798,.2805,811.76],day:[33957,.2465,1094.53],invitation:[24475,.2506,717.5],return:[22711,.2817,665.21],
  overtime:[21609,.2382,645.92],target:[18963,.2619,559.13],hint:[9922,.2617,244.22],confirm:[12458,.2456,344.3],attention:[24696,.2497,736.38]};

for(const file of ['source/core/internal.js','source/core/audio-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('audio-engine',1);
assert.equal(module.sampleRate,22050);
assert.deepEqual([...module.cues],Object.keys(REFERENCE));
for(const cue of module.cues){
  const samples=module.render(cue),[length,peakRef,shapeRef]=REFERENCE[cue];
  assert.ok(samples instanceof Float32Array);assert.equal(samples.length,length,`${cue}: length`);
  let sum=0,peak=0,shape=0;for(const x of samples){sum+=x*x;peak=Math.max(peak,Math.abs(x));shape+=Math.abs(Math.round(x*32767))/32767;}
  assert.ok(Math.abs(peak-peakRef)<.0001,`${cue}: peak ${peak}`);
  assert.ok(Math.abs(Math.sqrt(sum/length)-.055)<.0001,`${cue}: loudness`);
  assert.ok(Math.abs(shape-shapeRef)<.05,`${cue}: shape ${shape}`);
  assert.equal(samples[0],0,`${cue}: starts silent`);assert.ok(Math.abs(samples.at(-1))<1/32767,`${cue}: ends silent`);
  assert.ok(length/22050<=1.6,`${cue}: short`);
}
assert.throws(()=>module.render('missing'),/Unknown sound cue/);

// Nothing about sounds ships as a file or is precached any more.
const build=renderBuild(),sw=String(build.deployment.get('sw.js'));
assert.ok(!staticAssets.some(asset=>asset.source.startsWith('assets/sounds/')));
assert.ok(!sw.includes('assets/sounds/'));
for(const target of [build.deployment,build.development])assert.ok(![...target.keys()].some(name=>name.startsWith('assets/sounds/')));
assert.equal(fs.existsSync('source/assets/sounds'),false);

console.log(JSON.stringify({status:'PASS',suite:'sound-synthesis',cues:module.cues.length,checks:['matches the former WAV cues','common loudness','silent endpoints','no sound files shipped or precached']},null,2));
