import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {discoverFastTests} from './test-discovery.mts';

const protocol='study-director.fast-inspector.v1';
const digest=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.length>0;
const integer=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
export type CoverageRange={startOffset:number;endOffset:number;count:number};
export type CoverageFunction={functionName:string;isBlockCoverage:boolean;ranges:CoverageRange[]};
export type CoverageScript={url:string;functions:CoverageFunction[]};
export type RawCoverage={runId:string;test:string;result:CoverageScript[]};
function range(value:unknown):CoverageRange{
  if(!record(value)||!integer(value['startOffset'])||!integer(value['endOffset'])||value['endOffset']<value['startOffset']||!integer(value['count']))throw new Error('Invalid V8 coverage range.');
  return {startOffset:value['startOffset'],endOffset:value['endOffset'],count:value['count']};
}
function fn(value:unknown):CoverageFunction{
  if(!record(value)||typeof value['functionName']!=='string'||typeof value['isBlockCoverage']!=='boolean'||!Array.isArray(value['ranges'])||!value['ranges'].length)throw new Error('Invalid V8 coverage function.');
  return {functionName:value['functionName'],isBlockCoverage:value['isBlockCoverage'],ranges:value['ranges'].map(range)};
}
function script(value:unknown):CoverageScript{
  if(!record(value)||typeof value['url']!=='string'||!Array.isArray(value['functions']))throw new Error('Invalid V8 coverage script.');
  return {url:value['url'],functions:value['functions'].map(fn)};
}
export function parseRawCoverage(raw:string):RawCoverage{
  const value:unknown=JSON.parse(raw);
  if(!record(value)||!text(value['runId'])||!text(value['test'])||!Array.isArray(value['result'])||!value['result'].length)throw new Error('Incomplete V8 coverage artifact.');
  const result=value['result'].map(script);
  if(!result.some(row=>row.functions.some(f=>f.ranges.some(r=>r.count>0))))throw new Error('V8 artifact contains no executed code.');
  return {runId:value['runId'],test:value['test'],result};
}
type Artifact={file:string;test:string;sha256:string};
export type SourceIdentity={sha:string|null;fingerprint:string;root:string;node:string};
export function fullTestIds(root:string):string[]{return ['unit','integration'].flatMap(category=>discoverFastTests(root,category)).sort();}
export function sourceIdentity(root:string):SourceIdentity{
  const hash=createHash('sha256');
  function visit(relative:string){
    const absolute=path.join(root,relative);
    const stat=fs.lstatSync(absolute);
    if(stat.isDirectory()){
      for(const name of fs.readdirSync(absolute).sort())visit(path.join(relative,name));
    }else{
      hash.update(relative.split(path.sep).join('/')).update('\0');
      hash.update(stat.isSymbolicLink()?fs.readlinkSync(absolute):digest(fs.readFileSync(absolute))).update('\0');
    }
  }
  const roots=['source','portable','rich-text','build','tests','types','contracts','generated','vendor','package.json','package-lock.json','release.config.mjs','.oxlintrc.json',...fs.readdirSync(root).filter(name=>/^tsconfig.*\.json$/u.test(name))];
  for(const relative of [...new Set(roots)].sort())if(fs.existsSync(path.join(root,relative)))visit(relative);
  const git=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
  const sha=git.status===0&&/^[0-9a-f]{40}$/u.test(git.stdout.trim())?git.stdout.trim():null;
  return {sha,fingerprint:hash.digest('hex'),root:path.resolve(root),node:process.versions.node};
}
export function artifactInventory(directory:string,runId:string,tests:readonly string[]):Artifact[]{
  const artifacts:Artifact[]=[];
  const remaining=new Set(tests);
  if(remaining.size!==tests.length||!remaining.size)throw new Error('Invalid coverage test selection.');
  for(const file of fs.readdirSync(directory).sort()){
    if(file==='receipt.json')continue;
    if(!/^coverage-\d+-\d+\.json$/u.test(file))throw new Error(`Unexpected raw coverage artifact: ${file}`);
    const raw=fs.readFileSync(path.join(directory,file));
    const parsed=parseRawCoverage(raw.toString('utf8'));
    if(parsed.runId!==runId)throw new Error(`Mixed producer run: ${file}`);
    if(!remaining.delete(parsed.test))throw new Error(`Unexpected or duplicate coverage test: ${parsed.test}`);
    artifacts.push({file,test:parsed.test,sha256:digest(raw)});
  }
  if(remaining.size)throw new Error(`Incomplete coverage: missing artifacts for ${[...remaining].join(', ')}`);
  return artifacts;
}
export type Receipt={protocol:string;runId:string;status:'PASS'|'FAIL';scope:'full'|'targeted';identity:SourceIdentity;tests:string[];artifacts:Artifact[]};
export function createReceipt(input:Omit<Receipt,'protocol'|'artifacts'>,directory:string):Receipt{
  return {...input,protocol,artifacts:artifactInventory(directory,input.runId,input.tests)};
}
export function writeReceipt(directory:string,receipt:Receipt):void{
  fs.writeFileSync(path.join(directory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
}
function equal(left:unknown,right:unknown):boolean{return JSON.stringify(left)===JSON.stringify(right);}
export function validateReceipt(directory:string,identity:SourceIdentity,tests:readonly string[]):Receipt{
  const file=path.join(directory,'receipt.json');
  if(!fs.existsSync(file))throw new Error('Coverage provenance missing: a raw directory alone is not a promotion receipt.');
  const value:unknown=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!record(value)||value['protocol']!==protocol||!text(value['runId']))throw new Error('Invalid coverage receipt.');
  if(value['status']!=='PASS')throw new Error('Coverage producer did not pass.');
  if(value['scope']!=='full')throw new Error('Partial coverage cannot satisfy the full branch gate.');
  if(!equal(value['identity'],identity))throw new Error('Stale or different coverage source/runtime identity.');
  if(!equal(value['tests'],[...tests].sort()))throw new Error('Coverage receipt does not match discovered full test selection.');
  const artifacts=artifactInventory(directory,value['runId'],tests);
  if(!equal(value['artifacts'],artifacts))throw new Error('Coverage artifact inventory/hash mismatch.');
  return {protocol,runId:value['runId'],status:'PASS',scope:'full',identity,tests:[...tests].sort(),artifacts};
}
