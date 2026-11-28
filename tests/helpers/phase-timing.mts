import {performance} from 'node:perf_hooks';

// Optional sequential wall-time diagnostics; no clock changes or assertions.
export function createPhaseTiming(suite:string){
  const enabled=process.env['SD_P62_PROFILE']==='1';
  let previous=performance.now();
  return (phase:string):void=>{
    if(!enabled)return;
    const now=performance.now();
    console.log(JSON.stringify({suite,phase,wallMs:Math.round(now-previous)}));
    previous=now;
  };
}
