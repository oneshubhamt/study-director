// Idempotent strict-policy projection, also used by historical deployment tooling.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deploymentDirectoryName} from '../release.config.mts';

type Header={key:string;value:string};
type HeaderRule={headers?:Header[];[key:string]:unknown};
type HostingConfig={hosting?:{headers?:HeaderRule[];[key:string]:unknown};[key:string]:unknown};
function isRecord(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function isHeader(value:unknown):value is Header{return isRecord(value)&&typeof value['key']==='string'&&typeof value['value']==='string';}
function isRule(value:unknown):value is HeaderRule{return isRecord(value)&&(value['headers']===undefined||(Array.isArray(value['headers'])&&value['headers'].every(isHeader)));}
export function decodeHostingConfig(value:unknown):HostingConfig{
  if(!isRecord(value))throw new Error('Invalid hosting configuration.');
  const hosting=value['hosting'];
  if(hosting===undefined)return value;
  if(!isRecord(hosting)||hosting['headers']!==undefined&&(!Array.isArray(hosting['headers'])||!hosting['headers'].every(isRule)))throw new Error('Invalid hosting header rules.');
  return {...value,hosting:{...hosting,...(hosting['headers']===undefined?{}:{headers:hosting['headers']})}};
}
export function trustedTypesEnforcementCandidate(config:HostingConfig){
  const candidate=decodeHostingConfig(JSON.parse(JSON.stringify(config)) as unknown);
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
  const config=decodeHostingConfig(JSON.parse(fs.readFileSync(path.join(directory,'firebase.json'),'utf8')) as unknown);
  const candidate=trustedTypesEnforcementCandidate(config);
  fs.writeFileSync(path.join(directory,'firebase.enforcement-candidate.json'),JSON.stringify(candidate,null,2)+'\n');
  return path.join(directory,'firebase.enforcement-candidate.json');
}

export function securityCandidateCli(){
  writeSecurityCandidate(path.resolve(process.argv[2]||path.join('dist',deploymentDirectoryName)));
  console.log('Prepared firebase.enforcement-candidate.json; default firebase.json enforces Trusted Types.');
}
