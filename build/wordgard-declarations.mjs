// Emit declarations from immutable upstream sources, never from a guessed API stub.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'types/wordgard');
const hash=value=>createHash('sha256').update(value).digest('hex');
function files(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):[path.join(directory,entry.name)]).sort();}
export function wordgardDeclarations(write=false){
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'sd-wordgard-types-'));
 try{
  const result=spawnSync(path.join(root,'node_modules/.bin/tsc'),['-p','tsconfig.wordgard-declarations.json','--outDir',temporary],{cwd:root,encoding:'utf8'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Wordgard declaration emission failed: ${result.stdout}${result.stderr}`);
  const expected=new Map();
  for(const file of files(temporary)){
   const relative=path.relative(temporary,file).split(path.sep).join('/');
   // Keep upstream cross-package imports in the upstream graph. Application facades
   // intentionally expose only a subset of the vendor API.
   const source=fs.readFileSync(file,'utf8').replace(/"wordgard\/([^"/]+)"/gu,'"wordgard-vendor/$1/index"');
   expected.set(relative,`// Generated from vendor/wordgard/src/${relative.replace(/\.d\.ts$/u,'.ts')}; MIT license: vendor/wordgard/LICENSE.\n// Regenerate with npm run types:wordgard; do not edit.\n${source}`);
  }
  const inputs=Object.fromEntries(files(path.join(root,'vendor/wordgard')).map(file=>[path.relative(root,file).split(path.sep).join('/'),hash(fs.readFileSync(file))]));
  const manifest={compiler:JSON.parse(fs.readFileSync(path.join(root,'node_modules/typescript/package.json'))).version,configuration:hash(fs.readFileSync(path.join(root,'tsconfig.wordgard-declarations.json'))),generator:hash(fs.readFileSync(fileURLToPath(import.meta.url))),inputs,declarations:Object.fromEntries([...expected].map(([file,value])=>[file,hash(value)]))};
  expected.set('manifest.json',JSON.stringify(manifest,null,2)+'\n');
  if(write){fs.mkdirSync(output,{recursive:true});for(const file of files(output))if(!expected.has(path.relative(output,file).split(path.sep).join('/')))fs.rmSync(file);for(const [file,source] of expected){fs.mkdirSync(path.dirname(path.join(output,file)),{recursive:true});fs.writeFileSync(path.join(output,file),source);}}
  else{
   const actual=files(output).map(file=>path.relative(output,file).split(path.sep).join('/')).sort();
   if(JSON.stringify(actual)!==JSON.stringify([...expected.keys()].sort()))throw new Error('Wordgard declaration inventory drift; run npm run types:wordgard.');
   for(const [file,source] of expected)if(fs.readFileSync(path.join(output,file),'utf8')!==source)throw new Error(`Wordgard declaration drift: ${file}; run npm run types:wordgard.`);
  }
  return {declarations:expected.size-1,vendorFiles:Object.keys(inputs).length};
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify({status:'PASS',...wordgardDeclarations(process.argv.includes('--write'))}));
