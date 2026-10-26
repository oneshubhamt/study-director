import {coverageSelection} from './coverage-selection.mjs';
import {compileScript} from '../../build/source-script.mts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {COVERAGE_FLOORS,CRITICAL_PATHS,nonFastCoverageOwner} from './coverage-risk.mjs';
import {externalOutputPath} from './output-paths.mjs';

const selection=coverageSelection(process.argv.slice(2));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const runtimeRoots=['source','rich-text','portable'];
const extensions=new Set(['.js','.mjs','.ts']);
const pct=(covered,total)=>total===0?100:(covered/total)*100;
const round=value=>Math.round(value*100)/100;

function walk(dir){
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    return entry.isDirectory()?walk(full):[full];
  });
}
const allProductionFiles=runtimeRoots.flatMap(dir=>walk(path.join(root,dir)))
  .filter(file=>extensions.has(path.extname(file)))
  .map(file=>path.resolve(file));
const requested=new Set(selection.files.map(file=>path.resolve(root,file)));
for(const file of requested)if(!allProductionFiles.includes(file))throw new Error(`Unknown production coverage source: ${file}`);
const productionFiles=selection.targeted?allProductionFiles.filter(file=>requested.has(file)):allProductionFiles;
const productionSet=new Set(productionFiles);
const byBase=new Map();
for(const file of productionFiles){
  const base=path.basename(file);
  const list=byBase.get(base)||[];list.push(file);byBase.set(base,list);
}
function normalizeUrl(url){
  if(!url||url.startsWith('node:')||url.startsWith('eval'))return null;
  if(url.startsWith('file:')){
    try{const file=path.resolve(fileURLToPath(url));return productionSet.has(file)?file:null;}catch{return null;}
  }
  const clean=String(url).replaceAll('\\','/');
  for(const runtimeRoot of runtimeRoots){
    const marker=`${runtimeRoot}/`;
    const index=clean.lastIndexOf(marker);
    if(index>=0){
      const file=path.resolve(root,clean.slice(index));
      if(productionSet.has(file))return file;
    }
  }
  const matches=byBase.get(path.basename(clean));
  return matches?.length===1?matches[0]:null;
}
function rangeEqual(a,b){return a.startOffset===b.startOffset&&a.endOffset===b.endOffset;}
function rangeContains(a,b){return a.startOffset<=b.startOffset&&a.endOffset>=b.endOffset;}
function mergeRanges(oldFn,newFn){
  const merged=new Set(oldFn.ranges.filter(range=>range.count>0));
  for(const fresh of newFn.ranges){
    let exact=false;
    for(const old of oldFn.ranges){
      if(rangeEqual(fresh,old)){old.count+=fresh.count;merged.add(old);exact=true;break;}
      if(old.count===0&&fresh.count===0){
        if(rangeContains(old,fresh))merged.add(fresh);
        else if(rangeContains(fresh,old))merged.add(old);
      }
    }
    if(fresh.count>0&&!exact)merged.add(fresh);
  }
  oldFn.ranges=[...merged].sort((a,b)=>a.startOffset-b.startOffset||b.endOffset-a.endOffset);
}
function mergeScript(oldScript,newScript){
  for(const fresh of newScript.functions||[]){
    const freshRoot=fresh.ranges?.[0];
    if(!freshRoot)continue;
    const old=oldScript.functions.find(fn=>fn.functionName===fresh.functionName&&fn.ranges?.[0]?.startOffset===freshRoot.startOffset&&fn.ranges?.[0]?.endOffset===freshRoot.endOffset);
    if(!old){oldScript.functions.push(structuredClone(fresh));continue;}
    if(fresh.isBlockCoverage){
      if(old.isBlockCoverage)mergeRanges(old,fresh);
      else{old.isBlockCoverage=true;old.ranges=structuredClone(fresh.ranges);}
    }
  }
}
function makeLines(source){
  const chunks=source.split(/(?<=\n)/u);let offset=0;
  return chunks.map((src,index)=>{const newline=/\r?\n$/u.exec(src)?.[0].length||0;const row={line:index+1,startOffset:offset,endOffset:offset+src.length-newline,count:offset===offset+src.length-newline?1:0};offset+=src.length;return row;});
}
function mapRange(range,lines){
  const {startOffset,endOffset,count}=range;
  for(const line of lines){
    if(endOffset<=line.startOffset)break;
    if(startOffset>line.endOffset)continue;
    if(startOffset<=line.startOffset&&endOffset>=line.endOffset)line.count=count;
  }
}
function summarize(file,script){
  const source=compileScript(fs.readFileSync(file,'utf8'),file);
  const lines=makeLines(source);
  let totalBranches=0,coveredBranches=0,totalFunctions=0,coveredFunctions=0;
  for(let i=0;i<script.functions.length;i++){
    const fn=script.functions[i];
    let max=0;
    for(const range of fn.ranges||[]){
      max=Math.max(max,range.count);
      mapRange(range,lines);
      if(fn.isBlockCoverage){totalBranches++;if(range.count!==0)coveredBranches++;}
    }
    if(i>0&&fn.ranges?.length){totalFunctions++;if(max!==0)coveredFunctions++;}
  }
  const coveredLines=lines.filter(line=>line.count>0).length;
  const uncovered=lines.filter(line=>line.count===0).map(line=>line.line);
  return {
    file:path.relative(root,file).split(path.sep).join('/'),
    lines:{covered:coveredLines,total:lines.length,percent:round(pct(coveredLines,lines.length)),uncovered},
    branches:{covered:coveredBranches,total:totalBranches,percent:round(pct(coveredBranches,totalBranches))},
    functions:{covered:coveredFunctions,total:totalFunctions,percent:round(pct(coveredFunctions,totalFunctions))},
    _lineCounts:lines.map(line=>line.count)
  };
}
function loadCoverage(directory){
  const scripts=new Map();
  for(const file of walk(directory).filter(file=>path.basename(file).startsWith('coverage-')&&file.endsWith('.json'))){
    const json=JSON.parse(fs.readFileSync(file,'utf8'));
    for(const script of json.result||[]){
      const normalized=normalizeUrl(script.url);
      if(!normalized)continue;
      const candidate={url:pathToFileURL(normalized).href,functions:structuredClone(script.functions||[])};
      const old=scripts.get(normalized);
      if(old)mergeScript(old,candidate);else scripts.set(normalized,candidate);
    }
  }
  return scripts;
}
function total(rows,key){
  const covered=rows.reduce((n,row)=>n+row[key].covered,0);
  const count=rows.reduce((n,row)=>n+row[key].total,0);
  return {covered,total:count,percent:round(pct(covered,count))};
}

function riskAssessment(rows){
  const byFile=new Map(rows.map(row=>[row.file,row]));
  const failures=[];
  const floors=COVERAGE_FLOORS.filter(rule=>!selection.targeted||requested.has(path.resolve(root,rule.file))).map(rule=>{
    const row=byFile.get(rule.file);
    const result={...rule,observed:!!row,actual:row?{lines:row.lines.percent,branches:row.branches.percent,functions:row.functions.percent}:null};
    if(!row)failures.push(`${rule.file} was not executed by the fast suite.`);
    else for(const metric of ['lines','branches','functions'])if(row[metric].percent<rule[metric])failures.push(`${rule.file} ${metric} coverage ${row[metric].percent}% is below risk floor ${rule[metric]}%.`);
    return result;
  });
  const criticalPaths=CRITICAL_PATHS.filter(rule=>!selection.targeted||requested.has(path.resolve(root,rule.file))).map(rule=>{
    const row=byFile.get(rule.file),file=path.join(root,rule.file);
    const source=fs.readFileSync(file,'utf8'),index=source.indexOf(rule.snippet);
    if(index<0){failures.push(`Critical coverage anchor ${rule.id} is missing from ${rule.file}.`);return {...rule,covered:false,line:null};}
    const line=source.slice(0,index).split(/\r?\n/u).length;
    const count=row?row._lineCounts[line-1]||0:0,covered=count>0;
    if(!covered)failures.push(`Critical path ${rule.id} (${rule.file}:${line}) was not executed: ${rule.reason}.`);
    return {...rule,line,count,covered};
  });
  return {passed:failures.length===0,failures,floors,criticalPaths};
}
function publicRow(row){const {_lineCounts,...rest}=row;return rest;}

function printTable(rows){
  const sorted=[...rows].sort((a,b)=>a.lines.percent-b.lines.percent||a.file.localeCompare(b.file));
  const title='file'.padEnd(54)+' lines    branches functions';
  console.log(`\n${title}\n${'-'.repeat(title.length)}`);
  for(const row of sorted){
    const metric=x=>`${String(x.percent.toFixed(1)).padStart(5)}%`;
    console.log(row.file.padEnd(54)+` ${metric(row.lines)}   ${metric(row.branches)}   ${metric(row.functions)}`);
  }
}

const coverageDir=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-coverage-'));
try{
  const runs=selection.targeted?[['targeted',...selection.tests]]:[['unit'],['integration']];
  for(const args of runs){
    const result=spawnSync(process.execPath,['tests/helpers/run-category.mjs',...args],{
      cwd:root,env:{...process.env,SD_COVERAGE_DIR:coverageDir},stdio:'inherit',timeout:900000
    });
    if(result.error)throw result.error;
    if(result.status!==0)process.exit(result.status??1);
  }
  const scripts=loadCoverage(coverageDir);
  const rows=[...scripts].map(([file,script])=>summarize(file,script));
  const observed=new Set(scripts.keys());
  const unobserved=productionFiles.filter(file=>!observed.has(file)).map(file=>path.relative(root,file).split(path.sep).join('/')).sort();
  const risk=riskAssessment(rows);
  const expectedUnobserved=selection.targeted?[]:unobserved.map(file=>({file,rule:nonFastCoverageOwner(file)})).filter(item=>item.rule).map(item=>({file:item.file,owner:item.rule.owner,reason:item.rule.reason}));
  const unexpectedUnobserved=unobserved.filter(file=>selection.targeted||!nonFastCoverageOwner(file));
  if(unexpectedUnobserved.length){
    risk.passed=false;
    for(const file of unexpectedUnobserved)risk.failures.push(`Production file has no fast coverage and no explicit non-fast owner: ${file}`);
  }
  const summary={
    status:risk.passed?'PASS':'FAIL',scope:selection.targeted?'targeted-fast-production':'hermetic-fast-production',selectedTests:selection.targeted?selection.tests:null,observedFiles:rows.length,productionFiles:productionFiles.length,
    lines:total(rows,'lines'),branches:total(rows,'branches'),functions:total(rows,'functions'),unobservedFiles:unobserved,
    expectedUnobserved,unexpectedUnobserved,risk
  };
  printTable(rows);
  console.log('\nCoverage totals (observed production files only):');
  console.log(JSON.stringify(summary,null,2));
  console.log('\nRisk coverage:');
  for(const item of risk.criticalPaths)console.log(`  ${item.covered?'PASS':'FAIL'} ${item.id}${item.line?` (${item.file}:${item.line})`:''}`);
  for(const failure of risk.failures)console.error(`  ${failure}`);
  if(expectedUnobserved.length){
    console.log('\nProduction files intentionally owned outside the fast runtime:');
    for(const item of expectedUnobserved)console.log(`  ${item.file} -> ${item.owner}`);
  }
  if(unexpectedUnobserved.length){
    console.error('\nUNOWNED production coverage gaps:');
    for(const file of unexpectedUnobserved)console.error(`  ${file}`);
  }
  if(!risk.passed)process.exitCode=1;
  if(selection.json){
    const target=selection.json;
    fs.writeFileSync(externalOutputPath(target,'Coverage JSON output'),JSON.stringify({...summary,files:rows.map(publicRow)},null,2)+'\n');
  }
}finally{
  fs.rmSync(coverageDir,{recursive:true,force:true});
}
