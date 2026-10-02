import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {externalOutputPath} from './output-paths.mjs';

const root=process.cwd(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'study-director-browser-coverage-'));
const pct=(covered,total)=>total?Math.round(covered/total*10000)/100:100;
function lineOffsets(source){let offset=0;return source.split(/(?<=\n)/u).map((chunk,index)=>{const end=offset+chunk.replace(/\r?\n$/u,'').length,row={line:index+1,start:offset,end};offset+=chunk.length;return row;});}
function coveredAt(ranges,start,end){return ranges.some(range=>range.count>0&&range.startOffset<=start&&range.endOffset>=end);}
try{
  const run=spawnSync(process.execPath,['tests/helpers/browser-suite.mjs','release'],{cwd:root,env:{...process.env,SD_BROWSER_COVERAGE_DIR:directory},stdio:'inherit',timeout:90*60*1000});
  if(run.error)throw run.error;if(run.status!==0)process.exit(run.status??1);
  const records=[];
  for(const file of fs.readdirSync(directory).filter(name=>name.endsWith('.json'))){const json=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));records.push(...(json.scripts||[]));}
  if(!records.length)throw new Error('Browser release QA produced no runtime coverage records.');
  const byScript=new Map();
  for(const record of records){
    const key=`${record.url}#${crypto.createHash('sha256').update(record.source||'').digest('hex')}`;
    let row=byScript.get(key);if(!row){row={url:record.url,source:record.source,ranges:new Map(),functions:new Map()};byScript.set(key,row);}
    for(const fn of record.functions||[]){const rootRange=fn.ranges?.[0],fnKey=`${fn.functionName}:${rootRange?.startOffset}:${rootRange?.endOffset}`;if(rootRange)row.functions.set(fnKey,(row.functions.get(fnKey)||false)||rootRange.count>0);for(const range of fn.isBlockCoverage?fn.ranges||[]:[])row.ranges.set(`${range.startOffset}:${range.endOffset}`,(row.ranges.get(`${range.startOffset}:${range.endOffset}`)||false)||range.count>0);}
  }
  const files=[];
  for(const row of byScript.values()){
    const ranges=[...row.ranges].map(([key,covered])=>{const [startOffset,endOffset]=key.split(':').map(Number);return {startOffset,endOffset,count:covered?1:0};});
    const lines=lineOffsets(row.source),coveredLines=lines.filter(line=>line.start===line.end||coveredAt(ranges,line.start,line.end)).length;
    const coveredBlocks=[...row.ranges.values()].filter(Boolean).length,coveredFunctions=[...row.functions.values()].filter(Boolean).length;
    files.push({url:row.url,lines:{covered:coveredLines,total:lines.length,percent:pct(coveredLines,lines.length)},v8Blocks:{covered:coveredBlocks,total:row.ranges.size,percent:pct(coveredBlocks,row.ranges.size)},functions:{covered:coveredFunctions,total:row.functions.size,percent:pct(coveredFunctions,row.functions.size)}});
  }
  const total=metric=>{const covered=files.reduce((n,row)=>n+row[metric].covered,0),count=files.reduce((n,row)=>n+row[metric].total,0);return {covered,total:count,percent:pct(covered,count)};};
  const summary={status:'PASS',scope:'browser-release-built-runtime',scripts:files.length,lines:total('lines'),v8Blocks:total('v8Blocks'),functions:total('functions'),files:files.sort((a,b)=>a.url.localeCompare(b.url))};
  const hasRichText=files.some(row=>/rich-text|instrumented\.html|index\.html/iu.test(row.url));if(!hasRichText)throw new Error('Browser coverage did not observe the application/rich-text runtime.');
  console.log(JSON.stringify(summary,null,2));
  const outIndex=process.argv.indexOf('--json');if(outIndex>=0){const target=process.argv[outIndex+1];if(!target)throw new Error('--json requires an output path.');fs.writeFileSync(externalOutputPath(target,'Browser coverage JSON output'),JSON.stringify(summary,null,2)+'\n');}
}finally{fs.rmSync(directory,{recursive:true,force:true});}
