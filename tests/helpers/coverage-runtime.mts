import fs from 'node:fs';
import path from 'node:path';
import {Session} from 'node:inspector/promises';
import {isMainThread} from 'node:worker_threads';

const directory=process.env['SD_COVERAGE_DIR'];
if(directory&&isMainThread){
  const runId=process.env['SD_COVERAGE_RUN_ID'],test=process.env['SD_COVERAGE_TEST_ID'];
  if(!runId||!test)throw new Error('Coverage requires a producer run ID and test identity.');
  fs.mkdirSync(directory,{recursive:true});
  const session=new Session();
  session.connect();
  await session.post('Profiler.enable');
  await session.post('Profiler.startPreciseCoverage',{callCount:true,detailed:true,allowTriggeredUpdates:false});
  let finished=false;
  async function finish(){
    if(finished)return;
    finished=true;
    try{
      const {result}=await session.post('Profiler.takePreciseCoverage');
      const file=path.join(directory,`coverage-${process.pid}-${Date.now()}.json`);
      fs.writeFileSync(file,JSON.stringify({runId,test,result}),{flag:'wx'});
      await session.post('Profiler.stopPreciseCoverage');
      await session.post('Profiler.disable');
    }finally{session.disconnect();}
  }
  process.on('beforeExit',()=>{void finish().catch((error:unknown)=>{console.error(error);process.exitCode=1;});});
}
