import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

function isInsideRepository(target){
  const resolved=path.resolve(target);
  const relative=path.relative(repositoryRoot,resolved);
  return relative===''||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative));
}

export function externalOutputPath(target,label='Generated QA output'){
  const resolved=path.resolve(target);
  if(isInsideRepository(resolved))throw new Error(`${label} must live outside the source tree: ${resolved}`);
  return resolved;
}
