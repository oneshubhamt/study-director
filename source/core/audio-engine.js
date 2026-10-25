(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
registry.define('audio-engine',1,()=>{
  // Quiet Wood: original cues made here, with no recordings or samples. Each cue
  // is a short D-major/pentatonic phrase of plucked-string notes (eight damped,
  // slightly inharmonic partials over a quiet wooden body) with two early
  // reflections, normalised to one loudness. Mono, 22.05 kHz. These numbers are
  // the recipe the earlier WAV files were rendered from; the output matches them.
  // Each note is [start s, MIDI pitch, length s, velocity].
  const RATE=22050;
  const PHRASES=Object.freeze({
    begin:[[0,62,.70,1],[.16,69,.70,.82],[.31,74,.72,.62]],
    pause:[[0,69,.46,.65],[.10,66,.43,.7]],
    resume:[[0,66,.44,.7],[.12,69,.50,.8]],
    skip:[[0,69,.35,.7],[.09,71,.38,.55]],
    complete:[[0,69,.65,.7],[.14,66,.67,.7],[.29,74,.78,1]],
    day:[[0,62,1,.66],[.12,66,.95,.6],[.25,69,.92,.65],[.42,74,1.02,.85]],
    invitation:[[0,66,.65,.8],[.26,71,.75,.65]],
    return:[[0,69,.62,.65],[.18,74,.75,.86]],
    overtime:[[0,62,.60,.82],[.23,69,.65,.85]],
    target:[[0,69,.55,.65],[.16,66,.6,.8]],
    hint:[[0,69,.35,.60]],
    confirm:[[0,74,.38,.66],[.075,78,.39,.45]],
    attention:[[0,66,.68,.85],[.22,62,.80,.95]]
  });
  const NAMES=Object.freeze(Object.keys(PHRASES));
  const REFLECTIONS=[[0,1],[.023,.055],[.051,.028]];
  // Python's random.Random(seed) (Mersenne Twister), so each note's phases and
  // touch of noise are the ones the recipe was tuned with.
  function seededUniform(seed){
    const mt=new Uint32Array(624);let index=624;
    mt[0]=19650218;
    for(let i=1;i<624;i++)mt[i]=Math.imul(1812433253,mt[i-1]^(mt[i-1]>>>30))+i;
    let i=1;
    for(let k=624;k;k--){mt[i]=(mt[i]^Math.imul(mt[i-1]^(mt[i-1]>>>30),1664525))+seed;i++;if(i>=624){mt[0]=mt[623];i=1;}}
    for(let k=623;k;k--){mt[i]=(mt[i]^Math.imul(mt[i-1]^(mt[i-1]>>>30),1566083941))-i;i++;if(i>=624){mt[0]=mt[623];i=1;}}
    mt[0]=0x80000000;
    function next(){
      if(index>=624){for(let k=0;k<624;k++){const y=(mt[k]&0x80000000)|(mt[(k+1)%624]&0x7fffffff);mt[k]=mt[(k+397)%624]^(y>>>1)^(y&1?0x9908b0df:0);}index=0;}
      let y=mt[index++];y^=y>>>11;y^=(y<<7)&0x9d2c5680;y^=(y<<15)&0xefc60000;y^=y>>>18;return y>>>0;
    }
    return (a,b)=>a+(b-a)*(((next()>>>5)*67108864+(next()>>>6))/9007199254740992);
  }
  function tone(midi,duration,seed){
    const uniform=seededUniform(seed),f=440*2**((midi-69)/12),length=Math.trunc(duration*RATE),out=new Float64Array(length);
    const phases=Array.from({length:8},()=>uniform(-.06,.06));
    // Per-partial constants, grouped exactly as the per-sample expression groups them.
    const amplitude=[],damping=[],speed=[];
    for(let k=1;k<=8;k++){amplitude.push(1/k**1.85);damping.push(5.1+1.9*k);speed.push(2*Math.PI*f*k*Math.sqrt(1+.00016*k*k));}
    for(let i=0;i<length;i++){
      const t=i/RATE,attack=1-Math.exp(-t/.008);
      let value=0;
      for(let k=0;k<8;k++)value+=amplitude[k]*Math.exp(-t*damping[k]/duration)*Math.sin(speed[k]*t+phases[k]);
      value+=.085*Math.exp(-t/.048)*Math.sin(2*Math.PI*183*t)+.023*Math.exp(-t/.014)*uniform(-1,1);
      value*=attack*Math.min(1,Math.max(0,(duration-t)/.065));
      out[i]=value;
    }
    return out;
  }
  // One cue's samples, from silence to silence.
  function render(name){
    const notes=PHRASES[name],cueIndex=NAMES.indexOf(name);
    if(!notes)throw new Error(`Unknown sound cue: ${name}`);
    const length=Math.trunc((Math.max(...notes.map(([at,,duration])=>at+duration))+.1)*RATE),data=new Float64Array(length);
    notes.forEach(([at,midi,duration,velocity],j)=>{
      const sound=tone(midi,duration,41+cueIndex*17+j);
      for(const [delay,level] of REFLECTIONS){
        const offset=Math.trunc((at+delay)*RATE);
        for(let k=0;k<sound.length&&offset+k<length;k++)data[offset+k]+=sound[k]*velocity*level;
      }
    });
    let sum=0,peak=0;for(const x of data){sum+=x*x;peak=Math.max(peak,Math.abs(x));}
    const scale=Math.min(.055/Math.sqrt(sum/length),.43/peak),samples=new Float32Array(length);
    for(let i=0;i<length;i++)samples[i]=data[i]*scale;
    return samples;
  }
  function createEngine({window,document,onStatus=()=>{}}){
    let context=null,disposed=false,generation=0,active=null,installed=false,prepared=false;
    const buffers=new Map();
    function status(){return disposed||!(window.AudioContext||window.webkitAudioContext)?'unavailable':context?.state==='running'?'ready':'needs-interaction';}
    function report(){onStatus(status());}
    async function unlock(){
      if(disposed)return false;
      try{
        const Ctor=window.AudioContext||window.webkitAudioContext;if(!Ctor){report();return false;}
        if(!context){context=new Ctor();context.onstatechange=report;}
        // A gesture can unlock playback, but it never drains deferred cues.
        if(context.state==='suspended')await context.resume();report();
        if(context.state==='running')prepare();
        return context.state==='running';
      }catch{report();return false;}
    }
    function disconnect(record){try{record.source.disconnect();record.gain.disconnect();}catch{}}
    function stop(){
      generation++;
      if(!active)return;
      const record=active;active=null;
      try{const t=context.currentTime;record.gain.gain.cancelScheduledValues(t);record.gain.gain.setValueAtTime(record.gain.gain.value,t);record.gain.gain.linearRampToValueAtTime(0,t+.035);record.source.stop(t+.04);}catch{disconnect(record);record.finish(false);}
    }
    // Once sound is unlocked, make every cue in idle moments, one at a time, so a
    // cue never waits to be made when it plays. A cue that plays first is made then.
    function prepare(){
      if(prepared||disposed)return;prepared=true;
      const idle=typeof window.requestIdleCallback==='function'?step=>window.requestIdleCallback(step,{timeout:2000}):step=>setTimeout(step,50);
      const pending=[...NAMES];
      const step=()=>{if(disposed||!context||!pending.length)return;try{buffer(pending.shift());}catch{}idle(step);};
      idle(step);
    }
    // Each cue is made once, then kept for this window.
    function buffer(name){
      if(!buffers.has(name)){
        const samples=render(name),data=context.createBuffer(1,samples.length,RATE);
        data.getChannelData(0).set(samples);buffers.set(name,data);
      }
      return buffers.get(name);
    }
    async function play(name,{isCurrent=()=>true,explicit=false}={}){
      if(disposed||!NAMES.includes(name))return false;
      const ticket=generation;
      if(explicit)await unlock();
      if(status()!=='ready'||!isCurrent()||ticket!==generation)return false;
      try{
        const data=buffer(name);
        const source=context.createBufferSource(),gain=context.createGain();
        source.buffer=data;source.connect(gain);gain.connect(context.destination);
        const t=context.currentTime;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.8,t+.012);gain.gain.setValueAtTime(.8,t+Math.max(.012,data.duration-.045));gain.gain.linearRampToValueAtTime(0,t+data.duration);
        return await new Promise(resolve=>{
          const record={source,gain,finish:resolve};active=record;
          source.onended=()=>{disconnect(record);if(active===record)active=null;resolve(true);};
          try{source.start();}catch{active=null;disconnect(record);resolve(false);}
        });
      }catch{report();return false;}
    }
    function interaction(){void unlock();}
    function install(){if(installed||disposed)return;installed=true;document.addEventListener('pointerdown',interaction,{capture:true,passive:true});document.addEventListener('keydown',interaction,{capture:true});report();}
    function dispose(){const record=active;stop();if(record){record.source.onended=null;disconnect(record);record.finish(false);}disposed=true;buffers.clear();if(installed){document.removeEventListener('pointerdown',interaction,true);document.removeEventListener('keydown',interaction,true);}if(context){context.onstatechange=null;void context.close().catch(()=>{});}report();}
    return Object.freeze({play,stop,unlock,install,dispose,status});
  }
  return Object.freeze({format:'study-director.audio-engine-module',contractVersion:1,createEngine,cues:NAMES,sampleRate:RATE,render});
});
})();
