import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function evaluateBugRegressionPolicy({title='',labels=[],changedFiles=[]}={}){
  const labelNames=labels.map(label=>typeof label==='string'?label:String(label?.name||''));
  const bugLike=/\b(?:fix|bug|regression|hotfix)\b/iu.test(title)||labelNames.some(label=>/^(?:bug|regression)$/iu.test(label));
  if(!bugLike)return {required:false,passed:true};
  const regressionTests=changedFiles.filter(file=>/^tests\/(?:unit|integration|browser|architecture)\/.+\.(?:mjs|mts)$/u.test(file));
  return {required:true,passed:regressionTests.length>0,regressionTests};
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
  const eventPath=process.env.GITHUB_EVENT_PATH;
  if(!eventPath){console.log(JSON.stringify({status:'SKIP',reason:'not running in a GitHub pull-request event'}));process.exit(0);}
  const event=JSON.parse(fs.readFileSync(eventPath,'utf8'));
  const pr=event.pull_request;
  if(!pr){console.log(JSON.stringify({status:'SKIP',reason:'not a pull request'}));process.exit(0);}
  const base=String(pr.base?.sha||'').trim(),head=String(pr.head?.sha||'HEAD').trim();
  if(!base)throw new Error('Bug-regression policy requires the pull-request base SHA.');
  const changedFiles=execFileSync('git',['diff','--name-only',base,head],{encoding:'utf8'}).split(/\r?\n/u).filter(Boolean);
  const result=evaluateBugRegressionPolicy({title:pr.title,labels:pr.labels,changedFiles});
  if(!result.passed)throw new Error('Bug/regression pull requests must add or strengthen a regression test in tests/unit, integration, browser, or architecture.');
  console.log(JSON.stringify({status:'PASS',...result},null,2));
}
