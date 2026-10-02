import fs from 'node:fs';
import path from 'node:path';
import inspector from 'node:inspector';
import {promisify} from 'node:util';

const directory=process.env.SD_COVERAGE_DIR;
if(directory){
  fs.mkdirSync(directory,{recursive:true});
  const session=new inspector.Session();
  session.connect();
  const post=promisify(session.post).bind(session);
  await post('Profiler.enable');
  await post('Profiler.startPreciseCoverage',{callCount:true,detailed:true,allowTriggeredUpdates:false});
  let finished=false;
  process.on('beforeExit',async()=>{
    if(finished)return;
    finished=true;
    try{
      const {result}=await post('Profiler.takePreciseCoverage');
      const file=path.join(directory,`coverage-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
      fs.writeFileSync(file,JSON.stringify({result}));
      await post('Profiler.stopPreciseCoverage');
      await post('Profiler.disable');
    }finally{session.disconnect();}
  });
}
