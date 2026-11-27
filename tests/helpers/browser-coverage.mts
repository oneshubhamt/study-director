import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {externalOutputPath} from './output-paths.mts';

import {parseCoverageScript} from './coverage-provenance.mts';
import type {CoverageRange,CoverageScript} from './coverage-provenance.mts';
type RecordRow=CoverageScript&{source:string};
type SummaryRow={url:string;source:string;ranges:Map<string,boolean>;functions:Map<string,boolean>};
type Metric={covered:number;total:number;percent:number};
type FileSummary={url:string;lines:Metric;v8Blocks:Metric;functions:Metric};
function decodeRecords(input:unknown):RecordRow[]{
  if(!input||typeof input!=='object'||!('scripts' in input)||!Array.isArray(input.scripts))throw new Error('Invalid browser coverage artifact.');
  return input.scripts.map((value:unknown)=>{
    if(!value||typeof value!=='object'||!('source' in value)||typeof value.source!=='string')throw new Error('Invalid browser coverage source.');
    return {...parseCoverageScript(value),source:value.source};
  });
}
const root=process.cwd(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-browser-coverage-'));
const pct=(covered:number,total:number)=>total?Math.round(covered/total*10000)/100:100;
function lineOffsets(source:string){let offset=0;return source.split(/(?<=\n)/u).map((chunk,index)=>{const end=offset+chunk.replace(/\r?\n$/u,'').length,row={line:index+1,start:offset,end};offset+=chunk.length;return row;});}
function coveredAt(ranges:CoverageRange[],start:number,end:number){return ranges.some(range=>range.count>0&&range.startOffset<=start&&range.endOffset>=end);}
try{
  const run=spawnSync(process.execPath,['tests/helpers/browser-suite.mjs','release'],{cwd:root,env:{...process.env,SD_BROWSER_COVERAGE_DIR:directory},stdio:'inherit',timeout:90*60*1000});
  if(run.error)throw run.error;if(run.status!==0)throw new Error(`Browser suite did not pass: ${run.signal??run.status??'unknown failure'}`);
  const records:RecordRow[]=[];
  for(const file of fs.readdirSync(directory).filter(name=>name.endsWith('.json'))){const json:unknown=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));records.push(...decodeRecords(json));}
  if(!records.length)throw new Error('Browser release QA produced no runtime coverage records.');
  const byScript=new Map<string,SummaryRow>();
  for(const record of records){
    const key=`${record.url}#${crypto.createHash('sha256').update(record.source||'').digest('hex')}`;
    let row=byScript.get(key);if(!row){row={url:record.url,source:record.source,ranges:new Map(),functions:new Map()};byScript.set(key,row);}
    for(const fn of record.functions||[]){const rootRange=fn.ranges?.[0],fnKey=`${fn.functionName}:${rootRange?.startOffset}:${rootRange?.endOffset}`;if(rootRange)row.functions.set(fnKey,(row.functions.get(fnKey)||false)||rootRange.count>0);for(const range of fn.isBlockCoverage?fn.ranges||[]:[])row.ranges.set(`${range.startOffset}:${range.endOffset}`,(row.ranges.get(`${range.startOffset}:${range.endOffset}`)||false)||range.count>0);}
  }
  const files:FileSummary[]=[];
  for(const row of byScript.values()){
    const ranges=[...row.ranges].map(([key,covered])=>{const [startOffset,endOffset]=key.split(':').map(Number);if(startOffset===undefined||endOffset===undefined)throw new Error('Invalid range key.');return {startOffset,endOffset,count:covered?1:0};});
    const lines=lineOffsets(row.source),coveredLines=lines.filter(line=>line.start===line.end||coveredAt(ranges,line.start,line.end)).length;
    const coveredBlocks=[...row.ranges.values()].filter(Boolean).length,coveredFunctions=[...row.functions.values()].filter(Boolean).length;
    files.push({url:row.url,lines:{covered:coveredLines,total:lines.length,percent:pct(coveredLines,lines.length)},v8Blocks:{covered:coveredBlocks,total:row.ranges.size,percent:pct(coveredBlocks,row.ranges.size)},functions:{covered:coveredFunctions,total:row.functions.size,percent:pct(coveredFunctions,row.functions.size)}});
  }
  const total=(metric:'lines'|'v8Blocks'|'functions')=>{const covered=files.reduce((n,row)=>n+row[metric].covered,0),count=files.reduce((n,row)=>n+row[metric].total,0);return {covered,total:count,percent:pct(covered,count)};};
  const summary={status:'PASS',scope:'browser-release-built-runtime',scripts:files.length,lines:total('lines'),v8Blocks:total('v8Blocks'),functions:total('functions'),files:files.sort((a,b)=>a.url.localeCompare(b.url))};
  const hasRichText=files.some(row=>/rich-text|instrumented\.html|index\.html/iu.test(row.url));if(!hasRichText)throw new Error('Browser coverage did not observe the application/rich-text runtime.');
  console.log(JSON.stringify(summary,null,2));
  const outIndex=process.argv.indexOf('--json');if(outIndex>=0){const target=process.argv[outIndex+1];if(!target)throw new Error('--json requires an output path.');fs.writeFileSync(externalOutputPath(target,'Browser coverage JSON output'),JSON.stringify(summary,null,2)+'\n');}
}finally{fs.rmSync(directory,{recursive:true,force:true});}
