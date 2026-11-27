import fs from 'node:fs';

// Only the actual uncaught exception, not arbitrary test output, is eligible.
const target=process.env['SD_MUTATION_EVIDENCE'];
if(!target)throw new Error('Mutation observer requires an external evidence path.');
process.on('uncaughtExceptionMonitor',(error,origin)=>{
  const code='code' in error&&typeof error.code==='string'?error.code:null;
  fs.writeFileSync(target,JSON.stringify({origin,name:error.name,code,message:error.message,stack:error.stack??''}),{flag:'wx'});
});
