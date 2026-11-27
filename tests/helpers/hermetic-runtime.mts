import childProcess from 'node:child_process';
import workerThreads from 'node:worker_threads';
import type {WorkerOptions} from 'node:worker_threads';
import {syncBuiltinESMExports} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const blocked=(name:string)=>(..._args:unknown[]):never=>{throw new Error(`Fast tests cannot use ${name}.`);};
for(const name of ['fetch','WebSocket','EventSource']){
  if(name in globalThis)Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:blocked(name)});
}
for(const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'] as const)Object.defineProperty(childProcess,name,{value:blocked(`child_process.${name}`),configurable:true,writable:true});

const NativeWorker=workerThreads.Worker;
const workerPreload=path.join(path.dirname(fileURLToPath(import.meta.url)),'hermetic-worker.cjs');
class HermeticWorker extends NativeWorker{
  constructor(filename:string|URL,options:WorkerOptions={}){
    const execArgv=[...(options.execArgv||process.execArgv||[])];
    execArgv.push('--require',workerPreload);
    super(filename,{...options,execArgv});
  }
}
workerThreads.Worker=HermeticWorker;
syncBuiltinESMExports();
