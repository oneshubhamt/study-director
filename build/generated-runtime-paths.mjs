import path from 'node:path';

export function generatedRuntimeDirectory(root){
  return path.join(root,'generated','runtime');
}

export function generatedRuntimePath(root,file){
  return path.join(generatedRuntimeDirectory(root),file);
}
