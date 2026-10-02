import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {externalOutputPath} from './output-paths.mjs';

const root=externalOutputPath(process.env.SD_TEST_ARTIFACT_DIR
  ? path.resolve(process.env.SD_TEST_ARTIFACT_DIR)
  : path.join(os.tmpdir(),'study-director-test-artifacts'),'Test artifact root');

export function artifactPath(name){
  const relative=String(name||'').replaceAll('\\','/').replace(/^\/+/, '');
  if(!relative||relative.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error(`Invalid test artifact path: ${name}`);
  const target=path.resolve(root,relative);
  if(target!==root&&!target.startsWith(root+path.sep))throw new Error(`Test artifact escapes artifact root: ${name}`);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  return target;
}

export function writeArtifact(name,data){
  const target=artifactPath(name);
  fs.writeFileSync(target,data);
  return target;
}

