import {builtinModules} from 'node:module';

const builtins=new Set(builtinModules.flatMap(name=>[name,`node:${name}`]));
const networkBuiltins=new Set([
  'http','https','http2','net','tls','dns','dns/promises','dgram','cluster',
  'node:http','node:https','node:http2','node:net','node:tls','node:dns','node:dns/promises','node:dgram','node:cluster'
]);

export async function resolve(specifier,context,nextResolve){
  if(/^https?:/iu.test(specifier))throw new Error(`Fast tests cannot import network resources: ${specifier}`);
  if(networkBuiltins.has(specifier))throw new Error(`Fast tests cannot import network-capable builtin module: ${specifier}`);
  if(builtins.has(specifier)||specifier.startsWith('.')||specifier.startsWith('/')||specifier.startsWith('file:')){
    return nextResolve(specifier,context);
  }
  throw new Error(`Fast tests cannot depend on installed packages: ${specifier}`);
}
