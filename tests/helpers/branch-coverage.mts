import {eraseTypes} from '../../build/source-script.mts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parse} from 'acorn';
import {externalOutputPath} from './output-paths.mts';
import type {CoverageRange,CoverageScript} from './coverage-provenance.mts';
import {fullTestIds,parseRawCoverage,sourceIdentity,validateReceipt} from './coverage-provenance.mts';

// --from <dir> reads raw V8 data kept by coverage.mjs --keep-raw instead of
// running the suite again; without it the unit and integration tests run here.
const fromIndex=process.argv.indexOf('--from'),fromDir=fromIndex>=0?process.argv[fromIndex+1]:null;
if(fromIndex>=0&&(!fromDir||!fs.existsSync(fromDir)))throw new Error('--from requires the raw coverage directory written by coverage.mjs --keep-raw.');
const root=process.cwd(),coverageDir=fromDir?path.resolve(fromDir):fs.mkdtempSync(path.join(os.tmpdir(),'study-director-branch-coverage-'));
const runtimeRoots=['source/core','source/external','portable'];
function walk(directory:string):string[]{if(!fs.existsSync(directory))return [];return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const target=path.join(directory,entry.name);return entry.isDirectory()?walk(target):entry.isFile()?[target]:[];});}
const production=new Set(runtimeRoots.flatMap(dir=>walk(path.join(root,dir))).filter(file=>/\.(?:js|ts)$/u.test(file)&&!file.endsWith('.d.ts')).map(file=>path.resolve(file)));
const byBase=new Map<string,string[]>();for(const file of production){const base=path.basename(file),list=byBase.get(base)||[];list.push(file);byBase.set(base,list);}
const rawObjectTokens=new Set(['PRODUCTION_LIMITS','LOCAL_STORAGE_KEYS','SESSION_STORAGE_KEYS','APP_META_KEYS','APP_META_REGISTRY','RUNTIME_DATA_CONTRACT','INDEXED_DB_STORE_NAMES','CACHE_STORAGE_IDENTITIES','EXTERNAL_REPOSITORY_IDENTITIES']);
function renderCoverageTemplate(source:string){return source.replace(/@@SD_([A-Z_]+)@@/gu,(token:string,name:string)=>{const value=rawObjectTokens.has(name)?'{}':name==='PWA_ASSET_MANIFEST'?'[]':'qa';return value.padEnd(token.length,' ');});}
function normalize(url:string):string|null{
  if(!url)return null;
  if(url.startsWith('file:')){try{const file=path.resolve(fileURLToPath(url));return production.has(file)?file:null;}catch{return null;}}
  const clean=String(url).replaceAll('\\','/');
  for(const runtimeRoot of runtimeRoots){const marker=`${runtimeRoot}/`,index=clean.lastIndexOf(marker);if(index>=0){const file=path.resolve(root,clean.slice(index));if(production.has(file))return file;}}
  const matches=byBase.get(path.basename(clean));return matches?.length===1?matches[0]!:null;
}
type AstRecord=Record<string,unknown>;
const isRecord=(value:unknown):value is AstRecord=>!!value&&typeof value==='object'&&!Array.isArray(value);
function offset(node:unknown):number{
  if(!isRecord(node)||typeof node['start']!=='number')throw new Error('Invalid AST edge location.');
  return node['start'];
}
function visit(node:unknown,fn:(node:AstRecord)=>void):void{
  if(!isRecord(node))return;
  if(typeof node['type']==='string')fn(node);
  for(const [key,value] of Object.entries(node)){
    if(['start','end','loc'].includes(key))continue;
    if(Array.isArray(value))for(const child of value)visit(child,fn);
    else if(isRecord(value))visit(value,fn);
  }
}
try{
  if(!fromDir){const run=spawnSync(process.execPath,['tests/helpers/coverage.mjs','--keep-raw',coverageDir],{cwd:root,stdio:'inherit',timeout:1800000});if(run.error)throw run.error;if(run.status!==0)throw new Error(`Coverage producer failed (exit ${run.status}).`);}
  const receipt=validateReceipt(coverageDir,sourceIdentity(root),fullTestIds(root));
  const scripts=new Map<string,CoverageScript[]>();
  for(const file of fs.readdirSync(coverageDir).filter(name=>name.startsWith('coverage-')&&name.endsWith('.json'))){const json=parseRawCoverage(fs.readFileSync(path.join(coverageDir,file),'utf8'));for(const script of json.result||[]){const normalized=normalize(script.url);if(!normalized)continue;const list=scripts.get(normalized)||[];list.push(script);scripts.set(normalized,list);}}
  const rows:{file:string;branches:{covered:number;total:number;percent:number}}[]=[];
  for(const [file,observations] of scripts){
    const source=eraseTypes(renderCoverageTemplate(fs.readFileSync(file,'utf8')),file),ast=parse(source,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true});
    const countAt=(offset:number)=>observations.reduce((sum,script)=>{let best:CoverageRange|null=null;for(const fn of script.functions||[])for(const range of fn.ranges||[])if(range.startOffset<=offset&&range.endOffset>offset&&(!best||range.endOffset-range.startOffset<best.endOffset-best.startOffset))best=range;return sum+(best?.count||0);},0);
    let total=0,covered=0;
    const edge=(count:number)=>{total++;if(count>0)covered++;};
    visit(ast,node=>{
      if(node['type']==='IfStatement'||node['type']==='ConditionalExpression'){
        const test=countAt(offset(node['test'])),yes=countAt(offset(node['consequent']));edge(yes);edge(node['alternate']?countAt(offset(node['alternate'])):Math.max(0,test-yes));
      }else if(node['type']==='LogicalExpression'&&typeof node['operator']==='string'&&['&&','||','??'].includes(node['operator'])){
        const left=countAt(offset(node['left'])),right=countAt(offset(node['right']));edge(right);edge(Math.max(0,left-right));
      }else if(node['type']==='SwitchStatement'){
        if(!Array.isArray(node['cases']))throw new Error('Invalid AST switch cases.');
        for(const item of node['cases']){if(!isRecord(item)||!Array.isArray(item['consequent'])||!item['consequent'].length)continue;edge(countAt(offset(item['consequent'][0])));}
      }
    });
    if(total)rows.push({file:path.relative(root,file).split(path.sep).join('/'),branches:{covered,total,percent:Math.round(covered/total*10000)/100}});
  }
  const covered=rows.reduce((n,row)=>n+row.branches.covered,0),total=rows.reduce((n,row)=>n+row.branches.total,0);
  if(!total)throw new Error('AST branch coverage observed no branch edges.');
  for(const critical of ['source/core/canonical.ts','source/core/save-lane.ts','portable/stream-encryption.ts','source/core/library-clear.ts','source/core/attachments.ts','source/core/backup.ts'])if(!rows.some(row=>row.file===critical&&row.branches.covered>0))throw new Error(`Critical branch-coverage module was not observed: ${critical}`);
  const summary={status:'PASS',provenance:{runId:receipt.runId,identity:receipt.identity,tests:receipt.tests.length,artifacts:receipt.artifacts.length},scope:'fast-runtime-ast-branch-edges',branches:{covered,total,percent:Math.round(covered/total*10000)/100},files:rows.sort((a,b)=>a.file.localeCompare(b.file))};
  console.log(JSON.stringify(summary,null,2));
  const outIndex=process.argv.indexOf('--json');if(outIndex>=0){const target=process.argv[outIndex+1];if(!target)throw new Error('--json requires an output path.');fs.writeFileSync(externalOutputPath(target,'AST branch coverage JSON output'),JSON.stringify(summary,null,2)+'\n');}
}finally{if(!fromDir)fs.rmSync(coverageDir,{recursive:true,force:true});}
