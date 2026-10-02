// Idempotent strict-policy projection, also used by historical deployment tooling.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deploymentDirectoryName} from '../release.config.mjs';

export function trustedTypesEnforcementCandidate(config){
  const candidate=JSON.parse(JSON.stringify(config));
  let changed=false;
  for(const rule of candidate.hosting?.headers||[]){
    const enforced=rule.headers?.find(item=>item.key==='Content-Security-Policy');
    const report=rule.headers?.find(item=>item.key==='Content-Security-Policy-Report-Only');
    if(enforced?.value.includes("require-trusted-types-for 'script'")&&!report){changed=true;continue;}
    if(!enforced||!report)continue;
    if(!report.value.startsWith("require-trusted-types-for 'script'; trusted-types "))throw Error('Unexpected diagnostics policy.');
    enforced.value+='; '+report.value;
    rule.headers=rule.headers.filter(item=>item!==report);
    changed=true;
  }
  if(!changed)throw Error('No report-only Trusted Types policy found.');
  return candidate;
}

function writeSecurityCandidate(directory=path.resolve('dist',deploymentDirectoryName)){
  const config=JSON.parse(fs.readFileSync(path.join(directory,'firebase.json'),'utf8'));
  const candidate=trustedTypesEnforcementCandidate(config);
  fs.writeFileSync(path.join(directory,'firebase.enforcement-candidate.json'),JSON.stringify(candidate,null,2)+'\n');
  return path.join(directory,'firebase.enforcement-candidate.json');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  writeSecurityCandidate(path.resolve(process.argv[2]||path.join('dist',deploymentDirectoryName)));
  console.log('Prepared firebase.enforcement-candidate.json; default firebase.json enforces Trusted Types.');
}
