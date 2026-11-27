import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

export const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

function isInsideRepository(target:string){
  const resolved=path.resolve(target);
  const relative=path.relative(repositoryRoot,resolved);
  return relative===''||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative));
}

export function externalOutputPath(target:string,label='Generated QA output'){
  const resolved=path.resolve(target);
  let ancestor=resolved;
  while(!fs.existsSync(ancestor)&&path.dirname(ancestor)!==ancestor)ancestor=path.dirname(ancestor);
  const physical=path.resolve(fs.realpathSync(ancestor),path.relative(ancestor,resolved));
  if(isInsideRepository(resolved)||isInsideRepository(physical))throw new Error(`${label} must live outside the source tree: ${resolved}`);
  return resolved;
}
