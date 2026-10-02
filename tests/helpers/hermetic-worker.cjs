'use strict';
const Module=require('node:module');
const childProcess=require('node:child_process');
const blockedModules=new Set(['http','https','http2','net','tls','dns','dns/promises','dgram','cluster']);
const originalLoad=Module._load;
Module._load=function(request,parent,isMain){
  const normalized=String(request||'').replace(/^node:/,'');
  if(blockedModules.has(normalized))throw new Error(`Fast-test worker cannot load network-capable builtin module: ${request}`);
  return originalLoad.call(this,request,parent,isMain);
};
const blocked=name=>function(){throw new Error(`Fast-test worker cannot use ${name}.`);};
for(const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])childProcess[name]=blocked(`child_process.${name}`);
for(const name of ['fetch','WebSocket','EventSource'])if(name in globalThis)Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:blocked(name)});
