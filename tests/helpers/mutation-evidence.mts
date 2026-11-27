import {pathToFileURL} from 'node:url';

export type FailureEvidence={origin:string;name:string;code:string|null;message:string;stack:string};
export type ChildOutcome={status:number|null;signal:string|null;error?:Error|undefined;stdout:string;stderr:string;evidence:FailureEvidence|null};
export type MutationOutcome='passed'|'survived'|'killed'|'unrelated-failure'|'setup-failure'|'timeout'|'unsettled-await'|'signal'|'harness-failure';
export function parseEvidence(raw:string):FailureEvidence{
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=='object'||!('origin' in value)||typeof value.origin!=='string'||!('name' in value)||typeof value.name!=='string'||!('code' in value)||(value.code!==null&&typeof value.code!=='string')||!('message' in value)||typeof value.message!=='string'||!('stack' in value)||typeof value.stack!=='string')throw new Error('Invalid uncaught exception evidence.');
  return {origin:value.origin,name:value.name,code:value.code,message:value.message,stack:value.stack};
}
export function classify(result:ChildOutcome,expected:{file:string;lines:readonly number[]},control:boolean):MutationOutcome{
  if(result.error)return 'code' in result.error&&result.error.code==='ETIMEDOUT'?'timeout':'harness-failure';
  if(result.signal)return 'signal';
  if(result.status===13&&!result.evidence)return 'unsettled-await';
  if(result.status===0)return result.evidence?'harness-failure':control?'passed':'survived';
  if(result.status!==1||!result.evidence)return 'setup-failure';
  const {name,code,stack}=result.evidence;
  if(name!=='AssertionError'||code!=='ERR_ASSERTION')return 'setup-failure';
  // Require the first assertion frame, not an arbitrary caller somewhere below it.
  const frame=stack.split('\n').find(line=>/^\s+at /u.test(line));
  const location=frame?.match(/(file:\/\/\S+):(\d+):(\d+)\)?$/u);
  const intended=location?.[1]===pathToFileURL(expected.file).href&&expected.lines.includes(Number(location?.[2]));
  return !control&&intended?'killed':'unrelated-failure';
}
