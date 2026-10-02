import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {renderBuild,validateBuild,releaseIdentity} from './build.mjs';
import {platformFiles} from './module-manifest.mjs';
import {trustedTypesEnforcementCandidate} from './security-candidate.mjs';
import {deploymentDirectoryName} from '../release.config.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stage=path.join(root,'dist','firebase-project');
const publicDir=path.join(stage,'public');
const supportName=platformFiles.hostingHeaders.output;
const firebaseProjectId='study-director';

function write(target,value){
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,value);
}

const build=renderBuild();validateBuild(build);
if(fs.existsSync(stage))fs.rmSync(stage,{recursive:true,force:true});
fs.mkdirSync(publicDir,{recursive:true});
for(const [name,value] of build.deployment){
  write(path.join(name===supportName?stage:publicDir,name),value);
}
const supportDocs=['README.md'];
for(const name of supportDocs)write(path.join(stage,name),fs.readFileSync(path.join(root,name)));
for(const name of ['serve-local.py','Start-Study-Director.command','Start-Study-Director.bat'])write(path.join(stage,name),fs.readFileSync(path.join(root,'build',name)));
fs.chmodSync(path.join(stage,'Start-Study-Director.command'),0o755);
const handoff=JSON.parse(fs.readFileSync(path.join(stage,supportName),'utf8'));
const firebaseConfig={hosting:{
  public:'public',
  ignore:['firebase.json','**/.*','**/node_modules/**'],
  headers:handoff.hosting.headers,
  rewrites:[{source:'**',destination:'/index.html'}]
}};
write(path.join(stage,'firebase.json'),JSON.stringify(firebaseConfig,null,2)+'\n');
write(path.join(stage,'firebase.enforcement-candidate.json'),JSON.stringify(trustedTypesEnforcementCandidate(firebaseConfig),null,2)+'\n');
write(path.join(stage,'.firebaserc'),JSON.stringify({projects:{default:firebaseProjectId}},null,2)+'\n');
if(fs.existsSync(path.join(publicDir,'firebase.json'))||fs.existsSync(path.join(publicDir,'.firebaserc'))){
  throw new Error('Firebase project configuration must remain outside the public directory.');
}
const publicFiles=[];
function walk(directory,prefix=''){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const relative=path.posix.join(prefix,entry.name),absolute=path.join(directory,entry.name);
    if(entry.isDirectory())walk(absolute,relative);else publicFiles.push(relative);
  }
}
walk(publicDir);
const expectedPublicFiles=[...build.deployment.keys()].filter(name=>name!==supportName).sort();
publicFiles.sort();
if(JSON.stringify(publicFiles)!==JSON.stringify(expectedPublicFiles)){
  throw new Error('Firebase public staging inventory does not exactly match the current deployment build.');
}
let minifiedStage=null;
if(process.argv.includes('--minified')){
  minifiedStage=path.join(root,'dist',deploymentDirectoryName);
  const minified=spawnSync('python3',[path.join(root,'build','minify-release.py'),stage,minifiedStage],{cwd:root,encoding:'utf8'});
  if(minified.status!==0)throw new Error(minified.stderr||minified.stdout||'Minified Firebase staging failed.');
}
console.log(JSON.stringify({status:'PASS',release:releaseIdentity().release,stage,minifiedStage,publicFiles:publicFiles.length,project:firebaseProjectId,supportFiles:['firebase.json','firebase.enforcement-candidate.json','.firebaserc',supportName,...supportDocs]},null,2));
