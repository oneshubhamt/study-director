import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
type PolicyInput={title?:string;labels?:readonly (string|{name?:string})[];changedFiles?:readonly string[]};
export function evaluateBugRegressionPolicy({title='',labels=[],changedFiles=[]}:PolicyInput={}){
  const labelNames=labels.map(label=>typeof label==='string'?label:String(label?.name||''));
  const bugLike=/\b(?:fix|bug|regression|hotfix)\b/iu.test(title)||labelNames.some(label=>/^(?:bug|regression)$/iu.test(label));
  if(!bugLike)return {required:false,passed:true};
  const regressionTests=changedFiles.filter(file=>/^tests\/(?:unit|integration|browser|architecture)\/.+\.(?:mjs|mts)$/u.test(file));
  return {required:true,passed:regressionTests.length>0,regressionTests};
}
const isRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function runBugRegressionPolicy(){
  const eventPath=process.env['GITHUB_EVENT_PATH'];
  if(!eventPath){console.log(JSON.stringify({status:'SKIP',reason:'not running in a GitHub pull-request event'}));return;}
  const event:unknown=JSON.parse(fs.readFileSync(eventPath,'utf8'));
  if(!isRecord(event))throw new Error('Invalid GitHub event payload.');
  const pr=event['pull_request'];
  if(pr===undefined||pr===null){console.log(JSON.stringify({status:'SKIP',reason:'not a pull request'}));return;}
  if(!isRecord(pr)||!isRecord(pr['base'])||typeof pr['base']['sha']!=='string'||!isRecord(pr['head'])||typeof pr['head']['sha']!=='string'||typeof pr['title']!=='string'||!Array.isArray(pr['labels']))throw new Error('Invalid pull-request payload.');
  const base=pr['base']['sha'].trim(),head=pr['head']['sha'].trim();
  if(!/^[0-9a-f]{40}$/u.test(base)||!/^[0-9a-f]{40}$/u.test(head))throw new Error('Bug-regression policy requires exact pull-request commit SHAs.');
  const labels=pr['labels'].map((label:unknown)=>{
    if(typeof label==='string')return label;
    if(!isRecord(label)||typeof label['name']!=='string')throw new Error('Invalid pull-request label.');
    return label['name'];
  });
  const changedFiles=execFileSync('git',['diff','--name-only',base,head],{encoding:'utf8'}).split(/\r?\n/u).filter(Boolean);
  const result=evaluateBugRegressionPolicy({title:pr['title'],labels,changedFiles});
  if(!result.passed)throw new Error('Bug/regression pull requests must add or strengthen a regression test in tests/unit, integration, browser, or architecture.');
  console.log(JSON.stringify({status:'PASS',...result},null,2));
}
