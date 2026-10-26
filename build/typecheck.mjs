import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {typeProjects,uncheckedTypeScript} from './typescript-projects.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lint=process.argv.includes('--lint');
const configs=typeProjects.map(name=>({name,file:`tsconfig.${name}.json`,...JSON.parse(fs.readFileSync(path.join(root,`tsconfig.${name}.json`),'utf8'))}));
const admitted=new Set(configs.flatMap(config=>config.files));
function walk(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${dir}/${entry.name}`):/\.(?:ts|mts)$/u.test(entry.name)?[`${dir}/${entry.name}`]:[]);}
const authored=['source','portable','rich-text','build','tests','types'].flatMap(walk);
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
  if(result.status!==0)process.exit(result.status??1);
}
console.log(JSON.stringify({status:'PASS',gate:lint?'typed-lint':'strict-typecheck',projects:typeProjects,checkedFiles:admitted.size,uncheckedExistingTypeScript:uncheckedTypeScript.length}));
