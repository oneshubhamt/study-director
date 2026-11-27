import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {wordgardDeclarations} from './wordgard-declarations.mts';
import {typeProjects,uncheckedTypeScript} from './typescript-projects.mts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lint=process.argv.includes('--lint');
if(!lint)wordgardDeclarations();
function projectFiles(file:string):string[]{
  const config:unknown=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  if(!config||typeof config!=='object'||!('files' in config)||!Array.isArray(config.files)||!config.files.every((value:unknown):value is string=>typeof value==='string'))throw new Error(`Invalid explicit TypeScript project file inventory: ${file}`);
  return config.files;
}
const configs=typeProjects.map(name=>{const file=`tsconfig.${name}.json`;return {name,file,files:projectFiles(file)};});
const admitted=new Set(configs.flatMap(config=>config.files));
function walk(dir:string):string[]{return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${dir}/${entry.name}`):/\.(?:ts|mts)$/u.test(entry.name)?[`${dir}/${entry.name}`]:[]);}
const authored=['release.config.mts',...['source','portable','rich-text','build','tests','types','contracts'].flatMap(walk)].filter(file=>!file.startsWith('types/wordgard/'));
for(const file of authored)if(!admitted.has(file)&&!uncheckedTypeScript.includes(file))throw new Error(`TypeScript source lacks a checked project or explicit phase-2 inventory: ${file}`);
for(const file of [...admitted,...uncheckedTypeScript])if(!authored.includes(file))throw new Error(`Stale TypeScript inventory: ${file}`);
for(const file of uncheckedTypeScript)if(admitted.has(file))throw new Error(`Checked source still marked unchecked: ${file}`);
for(const file of admitted){
  if(file.startsWith('types/checks/'))continue;
  if(/@ts-(?:nocheck|ignore|expect-error)\b/u.test(fs.readFileSync(path.join(root,file),'utf8')))throw new Error(`Production type suppression is forbidden: ${file}`);
}
for(const config of configs){
  const executable=path.join(root,'node_modules/.bin',lint?'oxlint':'tsc');
  // Compile-time negative fixtures are compiler assertions, not application code.
  const files=config.files.filter(file=>!file.startsWith('types/checks/'));
  if(lint&&!files.length)continue;
  const args=lint?['--type-aware','--tsconfig',config.file,'--deny-warnings',...files]:['--project',config.file];
  const result=spawnSync(executable,args,{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`${lint?'Typed lint':'Strict typecheck'} failed for ${config.name}: ${result.status??result.signal??'unknown failure'}`);
}
console.log(JSON.stringify({status:'PASS',gate:lint?'typed-lint':'strict-typecheck',projects:typeProjects,checkedFiles:admitted.size,uncheckedExistingTypeScript:uncheckedTypeScript.length}));
