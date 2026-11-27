import Module from 'node:module';
import childProcess from 'node:child_process';

const blockedModules=new Set(['http','https','http2','net','tls','dns','dns/promises','dgram','cluster']);
const load:unknown=Object.getOwnPropertyDescriptor(Module,'_load')?.value;
if(typeof load!=='function')throw new Error('Node worker module loader hook is unavailable.');
Object.defineProperty(Module,'_load',{configurable:true,writable:true,value:function(this:unknown,request:string,parent:unknown,isMain:boolean):unknown{
  const normalized=String(request||'').replace(/^node:/,'');
  if(blockedModules.has(normalized))throw new Error(`Fast-test worker cannot load network-capable builtin module: ${request}`);
  return Reflect.apply(load,this,[request,parent,isMain]) as unknown;
}});
const blocked=(name:string)=>()=>{throw new Error(`Fast-test worker cannot use ${name}.`);};
for(const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])Object.defineProperty(childProcess,name,{configurable:true,writable:true,value:blocked(`child_process.${name}`)});
for(const name of ['fetch','WebSocket','EventSource'])if(name in globalThis)Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:blocked(name)});
