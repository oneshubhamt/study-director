import path from 'node:path';

export function generatedRuntimeDirectory(root:string){
  return path.join(root,'generated','runtime');
}

export function generatedRuntimePath(root:string,file:string){
  return path.join(generatedRuntimeDirectory(root),file);
}
