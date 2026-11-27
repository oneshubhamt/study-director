import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {externalOutputPath,repositoryRoot} from './output-paths.mts';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-promotion-'));
const raw=externalOutputPath(path.join(directory,'raw'),'Promotion evidence');
try{
  const commands=[
    ['tests/helpers/run-category.mjs','fast'],
    ['tests/helpers/coverage.mjs','--keep-raw',raw],
    ['tests/helpers/mutation.mjs'],
    ['tests/helpers/branch-coverage.mjs','--from',raw],
  ];
  for(const args of commands){
    const run=spawnSync(process.execPath,args,{cwd:repositoryRoot,stdio:'inherit'});
    if(run.error)throw run.error;
    if(run.status!==0)throw new Error(`Promotion evidence failed: ${args.join(' ')} (exit ${run.status??run.signal})`);
  }
}finally{fs.rmSync(directory,{recursive:true,force:true});}
