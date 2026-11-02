import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parse} from 'acorn';
import {externalOutputPath} from './output-paths.mjs';

// --from <dir> reads raw V8 data kept by coverage.mjs --keep-raw instead of
// running the suite again; without it the unit and integration tests run here.
const fromIndex=process.argv.indexOf('--from'),fromDir=fromIndex>=0?process.argv[fromIndex+1]:null;
if(fromIndex>=0&&(!fromDir||!fs.existsSync(fromDir)))throw new Error('--from requires the raw coverage directory written by coverage.mjs --keep-raw.');
const root=process.cwd(),coverageDir=fromDir?path.resolve(fromDir):fs.mkdtempSync(path.join(os.tmpdir(),'study-director-branch-coverage-'));
const runtimeRoots=['source/core','source/external','portable'];
function walk(directory){if(!fs.existsSync(directory))return [];return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const target=path.join(directory,entry.name);return entry.isDirectory()?walk(target):entry.isFile()?[target]:[];});}
const production=new Set(runtimeRoots.flatMap(dir=>walk(path.join(root,dir))).filter(file=>file.endsWith('.js')).map(file=>path.resolve(file)));
const byBase=new Map();for(const file of production){const base=path.basename(file),list=byBase.get(base)||[];list.push(file);byBase.set(base,list);}
const rawObjectTokens=new Set(['PRODUCTION_LIMITS','LOCAL_STORAGE_KEYS','SESSION_STORAGE_KEYS','OBSOLETE_LOCAL_STORAGE_KEYS','APP_META_KEYS','APP_META_REGISTRY','OBSOLETE_APP_META_KEYS','RENAMED_APP_META_KEYS','RUNTIME_DATA_CONTRACT','INDEXED_DB_STORE_NAMES','OBSOLETE_INDEXED_DB','CACHE_STORAGE_IDENTITIES','EXTERNAL_REPOSITORY_IDENTITIES']);
function renderCoverageTemplate(source){return source.replace(/@@SD_([A-Z_]+)@@/gu,(token,name)=>{const value=rawObjectTokens.has(name)?'{}':name==='LEGACY_BACKUP_SCHEMA_VERSION'?'1':name==='PWA_ASSET_MANIFEST'?'[]':'qa';return value.padEnd(token.length,' ');});}
function normalize(url){
  if(!url)return null;
  if(url.startsWith('file:')){try{const file=path.resolve(fileURLToPath(url));return production.has(file)?file:null;}catch{return null;}}
  const clean=String(url).replaceAll('\\','/');
  for(const runtimeRoot of runtimeRoots){const marker=`${runtimeRoot}/`,index=clean.lastIndexOf(marker);if(index>=0){const file=path.resolve(root,clean.slice(index));if(production.has(file))return file;}}
  const matches=byBase.get(path.basename(clean));return matches?.length===1?matches[0]:null;
}
function visit(node,fn){if(!node||typeof node!=='object')return;if(typeof node.type==='string')fn(node);for(const [key,value] of Object.entries(node)){if(['start','end','loc'].includes(key))continue;if(Array.isArray(value))for(const child of value)visit(child,fn);else if(value&&typeof value==='object')visit(value,fn);}}
try{
  if(!fromDir)for(const category of ['unit','integration']){const run=spawnSync(process.execPath,['tests/helpers/run-category.mjs',category],{cwd:root,env:{...process.env,SD_COVERAGE_DIR:coverageDir},stdio:'inherit',timeout:900000});if(run.error)throw run.error;if(run.status!==0)process.exit(run.status??1);}
  const scripts=new Map();
  for(const file of fs.readdirSync(coverageDir).filter(name=>name.startsWith('coverage-')&&name.endsWith('.json'))){const json=JSON.parse(fs.readFileSync(path.join(coverageDir,file),'utf8'));for(const script of json.result||[]){const normalized=normalize(script.url);if(!normalized)continue;const list=scripts.get(normalized)||[];list.push(script);scripts.set(normalized,list);}}
  const rows=[];
  for(const [file,observations] of scripts){
    const source=renderCoverageTemplate(fs.readFileSync(file,'utf8')),ast=parse(source,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true});
    const countAt=offset=>observations.reduce((sum,script)=>{let best=null;for(const fn of script.functions||[])for(const range of fn.ranges||[])if(range.startOffset<=offset&&range.endOffset>offset&&(!best||range.endOffset-range.startOffset<best.endOffset-best.startOffset))best=range;return sum+(best?.count||0);},0);
    let total=0,covered=0;
    const edge=count=>{total++;if(count>0)covered++;};
    visit(ast,node=>{
      if(node.type==='IfStatement'||node.type==='ConditionalExpression'){
        const test=countAt(node.test.start),yes=countAt(node.consequent.start);edge(yes);edge(node.alternate?countAt(node.alternate.start):Math.max(0,test-yes));
      }else if(node.type==='LogicalExpression'&&['&&','||','??'].includes(node.operator)){
        const left=countAt(node.left.start),right=countAt(node.right.start);edge(right);edge(Math.max(0,left-right));
      }else if(node.type==='SwitchStatement'){
        for(const item of node.cases){if(!item.consequent?.length)continue;edge(countAt(item.consequent[0].start));}
      }
    });
    if(total)rows.push({file:path.relative(root,file).split(path.sep).join('/'),branches:{covered,total,percent:Math.round(covered/total*10000)/100}});
  }
  const covered=rows.reduce((n,row)=>n+row.branches.covered,0),total=rows.reduce((n,row)=>n+row.branches.total,0);
  if(!total)throw new Error('AST branch coverage observed no branch edges.');
  for(const critical of ['portable/stream-encryption.js','source/core/library-clear.js','source/core/attachments.js','source/core/backup.js'])if(!rows.some(row=>row.file===critical))throw new Error(`Critical branch-coverage module was not observed: ${critical}`);
  const summary={status:'PASS',scope:'fast-runtime-ast-branch-edges',branches:{covered,total,percent:Math.round(covered/total*10000)/100},files:rows.sort((a,b)=>a.file.localeCompare(b.file))};
  console.log(JSON.stringify(summary,null,2));
  const outIndex=process.argv.indexOf('--json');if(outIndex>=0){const target=process.argv[outIndex+1];if(!target)throw new Error('--json requires an output path.');fs.writeFileSync(externalOutputPath(target,'AST branch coverage JSON output'),JSON.stringify(summary,null,2)+'\n');}
}finally{if(!fromDir)fs.rmSync(coverageDir,{recursive:true,force:true});}
