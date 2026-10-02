import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DIST,renderBuild,buildManifest} from './build.mjs';

function invariant(condition,message){if(!condition)throw new Error(message);}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function actualFiles(directory){
  const files=[];
  function walk(current,prefix=''){
    for(const entry of fs.readdirSync(current,{withFileTypes:true})){
      const relative=prefix?`${prefix}/${entry.name}`:entry.name;
      if(entry.isDirectory())walk(path.join(current,entry.name),relative);
      else files.push(relative);
    }
  }
  walk(directory);
  return files.sort();
}
function verifyDirectory(label,expected){
  const directory=path.join(DIST,label);
  invariant(fs.existsSync(directory),`Missing generated ${label} directory.`);
  invariant(JSON.stringify(actualFiles(directory))===JSON.stringify([...expected.keys()].sort()),`${label} generated inventory drifted.`);
  for(const [name,value] of expected){
    const actual=fs.readFileSync(path.join(directory,name));
    invariant(sha256(actual)===sha256(value),`${label}/${name} was edited or is stale.`);
  }
}

const expected=renderBuild();
const expectedManifest=buildManifest(expected);
const manifestPath=path.join(DIST,'build-manifest.json');
invariant(fs.existsSync(manifestPath),'Missing generated build manifest.');
invariant(fs.readFileSync(manifestPath,'utf8')===JSON.stringify(expectedManifest,null,2)+'\n','Generated build manifest is stale or edited.');
verifyDirectory('development',expected.development);
verifyDirectory('deployment',expected.deployment);
console.log(JSON.stringify({status:'PASS',release:expected.identity.release,developmentFiles:expected.development.size,deploymentFiles:expected.deployment.size},null,2));
