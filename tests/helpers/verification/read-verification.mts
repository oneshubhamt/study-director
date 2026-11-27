import fs from 'node:fs';
import path from 'node:path';

// Stable test entry IDs must not conceal the source from governance checks.
export function verificationSource(file:string):string{
  const source=fs.readFileSync(file,'utf8');
  const match=source.match(/^\/\/ Stable verification entry; the implementation is strictly checked\.\nimport '\.\.\/\.\.\/helpers\/verification\/([a-z0-9-]+\.mts)';\n$/u);
  if(!match)return source;
  const owner=match[1];
  if(!owner||path.basename(file,'.mjs')!==path.basename(owner,'.mts'))throw new Error(`Invalid verification owner: ${file}`);
  return fs.readFileSync(path.join('tests/helpers/verification',owner),'utf8');
}
export function jsonObject(value:unknown):Record<string,unknown>{
  if(typeof value!=='object'||value===null||Array.isArray(value))throw new Error('Expected JSON object');
  return Object.fromEntries(Object.entries(value).map(([k,v]:[string,unknown])=>[k,v]));
}
export function packageScripts():Record<string,unknown>{
  return jsonObject(jsonObject(JSON.parse(fs.readFileSync('package.json','utf8')) as unknown)['scripts']);
}
