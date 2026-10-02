(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
registry.define('audio-engine',1,()=>{
  const NAMES=Object.freeze(['begin','pause','resume','skip','complete','day','invitation','return','overtime','target','hint','confirm','attention']);
  function createEngine({window,document,fetch,baseUrl,onStatus=()=>{}}){
    let context=null,disposed=false,generation=0,active=null,installed=false;
    const buffers=new Map();
    function status(){return disposed||!(window.AudioContext||window.webkitAudioContext)?'unavailable':context?.state==='running'?'ready':'needs-interaction';}
    function report(){onStatus(status());}
    async function unlock(){
      if(disposed)return false;
      try{
        const Ctor=window.AudioContext||window.webkitAudioContext;if(!Ctor){report();return false;}
        if(!context){context=new Ctor();context.onstatechange=report;}
        // A gesture can unlock playback, but it never drains deferred cues.
        if(context.state==='suspended')await context.resume();report();return context.state==='running';
      }catch{report();return false;}
    }
    function disconnect(record){try{record.source.disconnect();record.gain.disconnect();}catch{}}
    function stop(){
      generation++;
      if(!active)return;
      const record=active;active=null;
      try{const t=context.currentTime;record.gain.gain.cancelScheduledValues(t);record.gain.gain.setValueAtTime(record.gain.gain.value,t);record.gain.gain.linearRampToValueAtTime(0,t+.035);record.source.stop(t+.04);}catch{disconnect(record);record.finish(false);}
    }
    async function buffer(name){
      if(!buffers.has(name)){
        const promise=(async()=>{const response=await fetch(new URL(`assets/sounds/${name}.wav`,baseUrl));if(!response.ok)throw new Error('Sound asset unavailable');return context.decodeAudioData(await response.arrayBuffer());})();
        buffers.set(name,promise);promise.catch(()=>{if(buffers.get(name)===promise)buffers.delete(name);});
      }
      return buffers.get(name);
    }
    async function play(name,{isCurrent=()=>true,explicit=false}={}){
      if(disposed||!NAMES.includes(name))return false;
      const ticket=generation;
      if(explicit)await unlock();
      if(status()!=='ready'||!isCurrent()||ticket!==generation)return false;
      try{
        const data=await buffer(name);
        if(disposed||status()!=='ready'||!isCurrent()||ticket!==generation)return false;
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
  return Object.freeze({format:'study-director.audio-engine-module',contractVersion:1,createEngine});
});
})();
