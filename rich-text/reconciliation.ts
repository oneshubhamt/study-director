/* Pure, DOM-free rich-text reconciliation for Study Director.
 * CR2 deliberately operates on stored WG1 JSON rather than editor state.
 * It finds correspondence conservatively and never treats fuzzy similarity as authority to replace text. */
import {decodeWG1Envelope,encodeWG1Document,normalizePlainText} from './wg1-codec';

type Marks=Record<string,unknown>;
type JsonNode={type?:unknown;param?:unknown;marks?:unknown;content?:unknown};
type NodePath=readonly number[];
type Side='local'|'incoming';
export type MergeUnitKind='sentence'|'list-sentence'|'heading'|'atomic';
export type CorrespondenceKind='exact'|'normalized'|'fuzzy';
export type DifferenceKind='changed'|'format'|'local-only'|'incoming-only';
export type StoredKind='plain'|'rich';

export interface MergeRange{from:number;to:number;kind:DifferenceKind;unitId:string;peerUnitId?:string}
export interface MergeUnit{
  id:string;side:Side;order:number;kind:MergeUnitKind;nodeType:string;text:string;normalized:string;
  path:NodePath;blockPath:NodePath;topIndex:number;listPath:NodePath|null;listItemPath:NodePath|null;
  textStart:number;textEnd:number;from:number;to:number;formatSignature:string;
}
export interface Correspondence{localId:string;incomingId:string;kind:CorrespondenceKind;score:number;formatEqual:boolean}
export interface RichTextComparison{
  format:'study-director.rich-text-comparison';version:1;
  local:{storedKind:StoredKind;units:readonly MergeUnit[]};
  incoming:{storedKind:StoredKind;units:readonly MergeUnit[]};
  correspondences:readonly Correspondence[];
  localOnly:readonly string[];incomingOnly:readonly string[];
  localRanges:readonly MergeRange[];incomingRanges:readonly MergeRange[];
}
export interface RichTextMergeResult{value:string;changed:boolean;addedUnitIds:readonly string[];comparison:RichTextComparison}
export interface ThreeWayMergeResult{
  format:'study-director.rich-text-three-way-merge';version:1;value:string;changed:boolean;safe:boolean;
  conflictCount:number;usedAncestor:true;addedUnitIds:readonly string[];comparison:RichTextComparison;
}

type InternalSpan={textFrom:number;textTo:number;docFrom:number;docTo:number;kind:'text'|'leaf'};
type InternalUnit=MergeUnit&{rawStart:number;rawEnd:number;spans:readonly InternalSpan[];fragment:readonly JsonNode[]};
type ParsedDocument={storedKind:StoredKind;doc:JsonNode};

const FORMAT='study-director.rich-text-comparison' as const;
const VERSION=1 as const;
const LIST_TYPES=new Set(['BulletList','OrderedList']);
const ATOMIC_TYPES=new Set(['SDImage','SDAudio','HorizontalRule','Table']);
const STOP_WORDS=new Set(['the','and','for','that','this','with','from','into','then','than','are','was','were','has','have','had','but','not','you','your','its','our','can','may','will','would','should','of','to','in','on','at','by','as','or','a','an','is','be']);
const ABBREVIATIONS=new Set(['mr','mrs','ms','dr','prof','sr','jr','vs','etc','fig','no','art','e.g','i.e']);
const MAX_FUZZY_CANDIDATES=48;
const MIN_FUZZY_SCORE=0.72;
const MIN_CONTEXTUAL_FUZZY_SCORE=0.66;

const freeze=<T>(value:T):Readonly<T>=>Object.freeze(value);
const contentOf=(node:JsonNode):JsonNode[]=>Array.isArray(node.content)?node.content as JsonNode[]:[];
const typeOf=(node:JsonNode)=>typeof node.type==='string'?node.type:'';
const marksOf=(node:JsonNode):Marks=>node.marks&&typeof node.marks==='object'&&!Array.isArray(node.marks)?node.marks as Marks:{};
const stringParam=(node:JsonNode)=>typeof node.param==='string'?node.param:String(node.param??'');
const pathKey=(path:NodePath)=>path.join('.');
const samePath=(a:NodePath|null,b:NodePath|null)=>!!a&&!!b&&a.length===b.length&&a.every((value,index)=>value===b[index]);
const pathStarts=(path:NodePath,prefix:NodePath)=>prefix.length<=path.length&&prefix.every((value,index)=>path[index]===value);

function cloneValue<T>(value:T):T{
  if(Array.isArray(value))return (value as unknown[]).map(cloneValue) as T;
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([key,item])=>[key,cloneValue(item)])) as T;
  return value;
}
function cloneNode(node:JsonNode){return cloneValue(node)}
function stable(value:unknown):unknown{
  if(Array.isArray(value))return (value as unknown[]).map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value as Record<string,unknown>).sort().map(key=>[key,stable((value as Record<string,unknown>)[key])]));
  return value;
}
function signature(value:unknown){return JSON.stringify(stable(value))}
function nodeLength(node:JsonNode):number{
  const type=typeOf(node);
  if(type==='Text')return stringParam(node).length;
  if(Array.isArray(node.content))return 2+contentOf(node).reduce((sum,child)=>sum+nodeLength(child),0);
  return 1;
}
function plainDocumentJson(value:unknown):JsonNode{
  const lines=normalizePlainText(value).split('\n');
  return {type:'Doc',content:lines.map(line=>({type:'Paragraph',content:line?[{type:'Text',param:line}]:[]}))};
}
function parseStored(value:unknown):ParsedDocument{
  const original=String(value??''),decoded=decodeWG1Envelope(original);
  if(decoded.kind==='invalid-envelope')throw new RangeError('Rich-text reconciliation received an invalid WG1 value.');
  if(decoded.kind==='valid-envelope')return {storedKind:'rich',doc:cloneNode(decoded.envelope.doc)};
  return {storedKind:'plain',doc:plainDocumentJson(decoded.text)};
}
function encodeParsed(doc:JsonNode,preferPlain:boolean){
  if(preferPlain){
    const root=contentOf(doc),plain=root.every(node=>typeOf(node)==='Paragraph'&&contentOf(node).every(child=>typeOf(child)==='Text'&&!Object.keys(marksOf(child)).length));
    if(plain)return root.map(node=>contentOf(node).map(stringParam).join('')).join('\n');
  }
  return encodeWG1Document(doc);
}

export function normalizeMergeText(value:unknown){
  return String(value??'').normalize('NFKC').toLocaleLowerCase('en-US').replace(/\s+/gu,' ').trim();
}
function fuzzyText(value:unknown){return normalizeMergeText(value).replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/gu,' ').trim()}
function wordTokens(value:string){return fuzzyText(value).match(/[\p{L}\p{N}]+/gu)||[]}
function tokenSet(value:string){return new Set(wordTokens(value))}
function significantTokens(value:string){const words=wordTokens(value),strong=words.filter(token=>token.length>=3&&!STOP_WORDS.has(token));return new Set(strong.length?strong:words)}
function setOverlap(a:Set<string>,b:Set<string>){let common=0;for(const item of a)if(b.has(item))common++;return common}
function dice(a:Set<string>,b:Set<string>){if(!a.size&&!b.size)return 1;const common=setOverlap(a,b);return 2*common/(a.size+b.size)}
function jaccard(a:Set<string>,b:Set<string>){if(!a.size&&!b.size)return 1;const common=setOverlap(a,b),total=a.size+b.size-common;return total?common/total:1}
function ngrams(value:string,n=3){const text=fuzzyText(value).replace(/\s+/gu,' ');const out=new Set<string>();if(text.length<n){if(text)out.add(text);return out}for(let i=0;i<=text.length-n;i++)out.add(text.slice(i,i+n));return out}
// Indexed accesses in these bounded loops are within fully populated arrays.
function levenshteinRatio(a:string,b:string){
  if(a===b)return 1;if(!a.length||!b.length)return 0;
  if(a.length>260||b.length>260)return dice(ngrams(a),ngrams(b));
  if(a.length>b.length)[a,b]=[b,a];
  let previous=Array.from({length:a.length+1},(_,index)=>index),current=new Array<number>(a.length+1);
  for(let row=1;row<=b.length;row++){
    current[0]=row;const bc=b.charCodeAt(row-1);
    for(let col=1;col<=a.length;col++)current[col]=Math.min(current[col-1]!+1,previous[col]!+1,previous[col-1]!+(a.charCodeAt(col-1)===bc?0:1));
    [previous,current]=[current,previous];
  }
  return 1-previous[a.length]!/Math.max(a.length,b.length);
}
export function fuzzyMergeSimilarity(a:unknown,b:unknown){
  const left=fuzzyText(a),right=fuzzyText(b);if(!left||!right)return 0;if(left===right)return 1;
  const la=tokenSet(left),lb=tokenSet(right),tokenDice=dice(la,lb),tokenJaccard=jaccard(la,lb),charDice=dice(ngrams(left),ngrams(right)),edit=levenshteinRatio(left,right);
  return Math.max(0,Math.min(1,tokenDice*.42+tokenJaccard*.18+charDice*.18+edit*.22));
}

function previousWord(text:string,index:number){
  const before=text.slice(0,index).trimEnd(),match=before.match(/([\p{L}.]+)$/u);return match?match[1]!.toLocaleLowerCase('en-US').replace(/\.$/u,''):'';
}
function isSentenceStop(text:string,index:number){
  const char=text[index];
  if(char==='\n')return true;
  if(char!=='.'&&char!=='?'&&char!=='!')return false;
  if(char==='.'&&index>0&&index+1<text.length&&/\d/u.test(text[index-1]!)&&/\d/u.test(text[index+1]!))return false;
  if(char==='.'&&ABBREVIATIONS.has(previousWord(text,index)))return false;
  let next=index+1;while(next<text.length&&/["'’”\])}]/u.test(text[next]!))next++;
  return next>=text.length||/\s/u.test(text[next]!);
}
export function segmentSentenceRanges(value:unknown){
  const text=String(value??'');if(!text)return freeze([] as {from:number;to:number}[]);
  const ranges:{from:number;to:number}[]=[];let start=0,index=0;
  while(index<text.length){
    if(!isSentenceStop(text,index)){index++;continue}
    let end=index+1;while(end<text.length&&text[end]!=='\n'&&/\s/u.test(text[end]!))end++;
    if(end>start&&text.slice(start,end).trim())ranges.push({from:start,to:end});
    start=end;index=end;
  }
  if(start<text.length&&text.slice(start).trim())ranges.push({from:start,to:text.length});
  if(!ranges.length&&text.trim())ranges.push({from:0,to:text.length});
  return freeze(ranges.map(range=>freeze(range)));
}

function inlineText(node:JsonNode,startPos:number){
  const spans:InternalSpan[]=[],parts:string[]=[];let offset=0;
  const visit=(child:JsonNode,pos:number)=>{
    const type=typeOf(child);
    if(type==='Text'){
      const text=stringParam(child),from=offset;parts.push(text);offset+=text.length;spans.push({textFrom:from,textTo:offset,docFrom:pos,docTo:pos+text.length,kind:'text'});return;
    }
    if(type==='LineBreak'){
      const from=offset;parts.push('\n');offset++;spans.push({textFrom:from,textTo:offset,docFrom:pos,docTo:pos+1,kind:'leaf'});return;
    }
    if(contentOf(child).length){let childPos=pos+1;for(const nested of contentOf(child)){visit(nested,childPos);childPos+=nodeLength(nested)}}
  };
  let pos=startPos+1;for(const child of contentOf(node)){visit(child,pos);pos+=nodeLength(child)}
  return {text:parts.join(''),spans};
}
function sliceInline(content:JsonNode[],spans:readonly InternalSpan[],from:number,to:number){
  const out:JsonNode[]=[];let spanIndex=0,textCursor=0;
  const pushText=(node:JsonNode,text:string)=>{if(!text)return;const copy:JsonNode={type:'Text',param:text};const marks=marksOf(node);if(Object.keys(marks).length)copy.marks=cloneValue(marks);const previous=out[out.length-1];if(previous&&typeOf(previous)==='Text'&&signature(marksOf(previous))===signature(marks)){previous.param=stringParam(previous)+text}else out.push(copy)};
  for(const node of content){
    const type=typeOf(node);
    if(type==='Text'){
      const text=stringParam(node),start=textCursor,end=start+text.length;if(end>from&&start<to)pushText(node,text.slice(Math.max(0,from-start),Math.min(text.length,to-start)));textCursor=end;spanIndex++;continue;
    }
    if(type==='LineBreak'){
      if(textCursor+1>from&&textCursor<to)out.push(cloneNode(node));textCursor++;spanIndex++;continue;
    }
    const represented=spans[spanIndex];if(represented){textCursor=represented.textTo;spanIndex++}
  }
  return out;
}
function textRangeToDoc(unit:Pick<InternalUnit,'spans'|'from'|'to'>,from:number,to:number){
  if(!unit.spans.length)return {from:unit.from,to:unit.to};
  const overlaps=unit.spans.filter(span=>span.textTo>from&&span.textFrom<to);if(!overlaps.length)return {from:unit.from,to:unit.to};
  const first=overlaps[0]!,last=overlaps[overlaps.length-1]!;
  const docFrom=first.kind==='text'?first.docFrom+Math.max(0,from-first.textFrom):first.docFrom;
  const docTo=last.kind==='text'?last.docFrom+Math.min(last.textTo-last.textFrom,Math.max(0,to-last.textFrom)):last.docTo;
  return {from:docFrom,to:Math.max(docFrom,docTo)};
}
function atomicText(node:JsonNode){
  const type=typeOf(node),param=node.param&&typeof node.param==='object'&&!Array.isArray(node.param)?node.param as Record<string,unknown>:{};
  if(type==='SDImage')return `image:${String(param['assetId']||'')}`;
  if(type==='SDAudio')return `audio:${String(param['attachmentId']||'')}`;
  if(type==='HorizontalRule')return '---';
  if(type==='Table')return `table:${signature(node)}`;
  return `${type}:${signature(node)}`;
}
function family(unit:InternalUnit){if(unit.kind==='heading')return 'heading';if(unit.kind==='atomic')return `atomic:${unit.nodeType}`;return 'prose'}
function compatible(a:InternalUnit,b:InternalUnit){return family(a)===family(b)}

function collectUnits(parsed:ParsedDocument,side:Side){
  const units:InternalUnit[]=[];let order=0;
  const root=parsed.doc,top=contentOf(root);
  const pushTextUnits=(node:JsonNode,path:number[],pos:number,topIndex:number,listPath:number[]|null,listItemPath:number[]|null,kind:MergeUnitKind,context:readonly unknown[])=>{
    const flat=inlineText(node,pos),ranges=kind==='heading'?freeze(flat.text.trim()?[{from:0,to:flat.text.length}]:[]):segmentSentenceRanges(flat.text);
    for(const range of ranges){
      const text=flat.text.slice(range.from,range.to),trimmed=text.trim();if(!trimmed)continue;
      let lead=0;while(lead<text.length&&/\s/u.test(text[lead]!))lead++;let tail=text.length;while(tail>lead&&/\s/u.test(text[tail-1]!))tail--;
      const rawStart=range.from,rawEnd=range.to,textStart=range.from+lead,textEnd=range.from+tail,docRange=textRangeToDoc({spans:flat.spans,from:pos,to:pos+nodeLength(node)},textStart,textEnd);
      const fragment=sliceInline(contentOf(node),flat.spans,rawStart,rawEnd),formatSignature=signature({block:{type:typeOf(node),param:node.param??null,marks:marksOf(node)},context,fragment});
      units.push({id:`${side}_${order+1}`,side,order:order++,kind,nodeType:typeOf(node),text:trimmed,normalized:normalizeMergeText(trimmed),path:freeze([...path]),blockPath:freeze([...path]),topIndex,listPath:listPath?freeze([...listPath]):null,listItemPath:listItemPath?freeze([...listItemPath]):null,textStart,textEnd,from:docRange.from,to:docRange.to,formatSignature,rawStart,rawEnd,spans:freeze(flat.spans.map(freeze)),fragment:freeze(fragment.map(node=>freeze(node)))});
    }
  };
  const walk=(node:JsonNode,path:number[],pos:number,topIndex:number,listPath:number[]|null,listItemPath:number[]|null,context:readonly unknown[])=>{
    const type=typeOf(node);
    if(type==='Heading'){pushTextUnits(node,path,pos,topIndex,listPath,listItemPath,'heading',context);return}
    if(type==='Paragraph'){pushTextUnits(node,path,pos,topIndex,listPath,listItemPath,listItemPath?'list-sentence':'sentence',context);return}
    if(ATOMIC_TYPES.has(type)||(!contentOf(node).length&&type!=='Text'&&type!=='LineBreak')){
      const text=atomicText(node);units.push({id:`${side}_${order+1}`,side,order:order++,kind:'atomic',nodeType:type,text,normalized:normalizeMergeText(text),path:freeze([...path]),blockPath:freeze([...path]),topIndex,listPath:listPath?freeze([...listPath]):null,listItemPath:listItemPath?freeze([...listItemPath]):null,textStart:0,textEnd:text.length,from:pos,to:pos+nodeLength(node),formatSignature:signature(node),rawStart:0,rawEnd:text.length,spans:freeze([]),fragment:freeze([freeze(cloneNode(node))])});return;
    }
    const content=contentOf(node);let childPos=pos+(type==='Doc'?0:1);
    const nextList=LIST_TYPES.has(type)?path:listPath,nextItem=type==='ListItem'?path:listItemPath,nextContext=(LIST_TYPES.has(type)||type==='ListItem'||type==='Blockquote')?[...context,{type,param:node.param??null,marks:marksOf(node)}]:context;
    for(let index=0;index<content.length;index++){const child=content[index]!,childPath=[...path,index];walk(child,childPath,childPos,topIndex,nextList,nextItem,nextContext);childPos+=nodeLength(child)}
  };
  let pos=0;for(let index=0;index<top.length;index++){walk(top[index]!,[index],pos,index,null,null,[]);pos+=nodeLength(top[index]!)}
  return freeze(units.map(unit=>freeze(unit)));
}
function publicMergeUnit(unit:InternalUnit):MergeUnit{return freeze({id:unit.id,side:unit.side,order:unit.order,kind:unit.kind,nodeType:unit.nodeType,text:unit.text,normalized:unit.normalized,path:unit.path,blockPath:unit.blockPath,topIndex:unit.topIndex,listPath:unit.listPath,listItemPath:unit.listItemPath,textStart:unit.textStart,textEnd:unit.textEnd,from:unit.from,to:unit.to,formatSignature:unit.formatSignature})}
export function extractMergeUnits(value:unknown,side:Side='local'):readonly MergeUnit[]{return freeze((collectUnits(parseStored(value),side) as readonly InternalUnit[]).map(publicMergeUnit))}

function chooseNearest(candidates:InternalUnit[],incoming:InternalUnit,localCount:number,incomingCount:number){
  const target=incomingCount<=1?0:incoming.order/(incomingCount-1);let best:InternalUnit|null=null,bestDistance=Infinity;
  for(const candidate of candidates){const at=localCount<=1?0:candidate.order/(localCount-1),distance=Math.abs(at-target);if(distance<bestDistance){best=candidate;bestDistance=distance}}
  return best;
}
function matchByKey(local:InternalUnit[],incoming:InternalUnit[],unmatchedLocal:Set<string>,unmatchedIncoming:Set<string>,keyFor:(unit:InternalUnit)=>string,kind:CorrespondenceKind,out:Correspondence[]){
  const index=new Map<string,InternalUnit[]>();for(const unit of local)if(unmatchedLocal.has(unit.id)){const key=keyFor(unit);if(!key)continue;const list=index.get(key)||[];list.push(unit);index.set(key,list)}
  for(const unit of incoming){if(!unmatchedIncoming.has(unit.id))continue;const candidates=(index.get(keyFor(unit))||[]).filter(candidate=>unmatchedLocal.has(candidate.id)&&compatible(candidate,unit));if(!candidates.length)continue;const selected=chooseNearest(candidates,unit,local.length,incoming.length);if(!selected)continue;unmatchedLocal.delete(selected.id);unmatchedIncoming.delete(unit.id);out.push(freeze({localId:selected.id,incomingId:unit.id,kind,score:kind==='exact'?1:.99,formatEqual:selected.formatSignature===unit.formatSignature}))}
}
function contextualBoost(localUnit:InternalUnit,incomingUnit:InternalUnit,matches:readonly Correspondence[],localById:Map<string,InternalUnit>,incomingById:Map<string,InternalUnit>){
  let boost=0;
  for(const match of matches){const l=localById.get(match.localId),r=incomingById.get(match.incomingId);if(!l||!r)continue;const di=r.order-incomingUnit.order,dl=l.order-localUnit.order;if(Math.abs(di)===1&&Math.abs(dl)===1&&Math.sign(di)===Math.sign(dl))boost=Math.max(boost,.08);else if(Math.abs(di)<=2&&Math.abs(dl)<=2&&Math.sign(di)===Math.sign(dl))boost=Math.max(boost,.04)}
  return boost;
}
function fuzzyMatches(local:InternalUnit[],incoming:InternalUnit[],unmatchedLocal:Set<string>,unmatchedIncoming:Set<string>,out:Correspondence[]){
  const localById=new Map(local.map(unit=>[unit.id,unit])),incomingById=new Map(incoming.map(unit=>[unit.id,unit]));
  const tokenIndex=new Map<string,Set<string>>();
  for(const unit of local){if(!unmatchedLocal.has(unit.id)||family(unit).startsWith('atomic:'))continue;for(const token of significantTokens(unit.text)){let ids=tokenIndex.get(token);if(!ids){ids=new Set();tokenIndex.set(token,ids)}ids.add(unit.id)}}
  const candidates:{local:InternalUnit;incoming:InternalUnit;score:number;raw:number;distance:number}[]=[];
  for(const remote of incoming){
    if(!unmatchedIncoming.has(remote.id)||family(remote).startsWith('atomic:'))continue;
    const counts=new Map<string,number>();for(const token of significantTokens(remote.text))for(const id of tokenIndex.get(token)||[]){if(unmatchedLocal.has(id))counts.set(id,(counts.get(id)||0)+1)}
    const ids=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,MAX_FUZZY_CANDIDATES).map(([id])=>id);
    for(const id of ids){const candidate=localById.get(id);if(!candidate||!compatible(candidate,remote))continue;const raw=fuzzyMergeSimilarity(candidate.text,remote.text),boost=contextualBoost(candidate,remote,out,localById,incomingById),score=Math.min(1,raw+boost),words=Math.min(wordTokens(candidate.text).length,wordTokens(remote.text).length),threshold=boost?MIN_CONTEXTUAL_FUZZY_SCORE:MIN_FUZZY_SCORE;if(raw<.52||score<(words<=3?Math.max(.78,threshold):threshold))continue;const localPos=local.length<=1?0:candidate.order/(local.length-1),incomingPos=incoming.length<=1?0:remote.order/(incoming.length-1);candidates.push({local:candidate,incoming:remote,score,raw,distance:Math.abs(localPos-incomingPos)})}
  }
  candidates.sort((a,b)=>b.score-a.score||b.raw-a.raw||a.distance-b.distance||a.incoming.order-b.incoming.order||a.local.order-b.local.order);
  for(const candidate of candidates){if(!unmatchedLocal.has(candidate.local.id)||!unmatchedIncoming.has(candidate.incoming.id))continue;unmatchedLocal.delete(candidate.local.id);unmatchedIncoming.delete(candidate.incoming.id);out.push(freeze({localId:candidate.local.id,incomingId:candidate.incoming.id,kind:'fuzzy',score:Math.round(candidate.score*10000)/10000,formatEqual:candidate.local.formatSignature===candidate.incoming.formatSignature}))}
}

type DiffToken={value:string,key:string;from:number;to:number};
function diffTokens(text:string):DiffToken[]{const out:DiffToken[]=[];const re=/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu;let match:RegExpExecArray|null;while((match=re.exec(text))){out.push({value:match[0],key:normalizeMergeText(match[0]),from:match.index,to:match.index+match[0].length})}return out}
// The LCS matrix has rows/columns including the zero boundary; all reads are initialized.
function unmatchedTokenRanges(a:string,b:string){
  const left=diffTokens(a),right=diffTokens(b),rows=left.length+1,cols=right.length+1,dp=Array.from({length:rows},()=>new Uint16Array(cols));
  for(let i=1;i<rows;i++)for(let j=1;j<cols;j++)dp[i]![j]=left[i-1]!.key===right[j-1]!.key?dp[i-1]![j-1]!+1:Math.max(dp[i-1]![j]!,dp[i]![j-1]!);
  const keepLeft=new Set<number>(),keepRight=new Set<number>();let i=left.length,j=right.length;while(i&&j){if(left[i-1]!.key===right[j-1]!.key){keepLeft.add(i-1);keepRight.add(j-1);i--;j--}else if(dp[i-1]![j]!>=dp[i]![j-1]!)i--;else j--}
  const ranges=(tokens:DiffToken[],keep:Set<number>)=>{const raw=tokens.filter((_,index)=>!keep.has(index)).map(token=>({from:token.from,to:token.to}));if(!raw.length)return raw;const merged=[{...raw[0]!}];for(const range of raw.slice(1)){const last=merged[merged.length-1]!;if(range.from<=last.to+1)last.to=range.to;else merged.push({...range})}return merged};
  return {left:ranges(left,keepLeft),right:ranges(right,keepRight)};
}
function buildDifferenceRanges(local:InternalUnit[],incoming:InternalUnit[],correspondences:readonly Correspondence[],localOnly:Set<string>,incomingOnly:Set<string>){
  const localById=new Map(local.map(unit=>[unit.id,unit])),incomingById=new Map(incoming.map(unit=>[unit.id,unit])),localRanges:MergeRange[]=[],incomingRanges:MergeRange[]=[];
  const addFull=(target:MergeRange[],unit:InternalUnit,kind:DifferenceKind,peer?:string)=>{if(unit.to>unit.from)target.push(freeze({from:unit.from,to:unit.to,kind,unitId:unit.id,...(peer?{peerUnitId:peer}:{})}))};
  for(const id of localOnly){const unit=localById.get(id);if(unit)addFull(localRanges,unit,'local-only')}
  for(const id of incomingOnly){const unit=incomingById.get(id);if(unit)addFull(incomingRanges,unit,'incoming-only')}
  for(const match of correspondences){const l=localById.get(match.localId),r=incomingById.get(match.incomingId);if(!l||!r)continue;if(l.text===r.text){if(!match.formatEqual){addFull(localRanges,l,'format',r.id);addFull(incomingRanges,r,'format',l.id)}continue}const diff=unmatchedTokenRanges(l.text,r.text);for(const range of diff.left){const mapped=textRangeToDoc(l,l.textStart+range.from,l.textStart+range.to);if(mapped.to>mapped.from)localRanges.push(freeze({from:mapped.from,to:mapped.to,kind:'changed',unitId:l.id,peerUnitId:r.id}))}for(const range of diff.right){const mapped=textRangeToDoc(r,r.textStart+range.from,r.textStart+range.to);if(mapped.to>mapped.from)incomingRanges.push(freeze({from:mapped.from,to:mapped.to,kind:'changed',unitId:r.id,peerUnitId:l.id}))}if(!diff.left.length&&!diff.right.length&&!match.formatEqual){addFull(localRanges,l,'format',r.id);addFull(incomingRanges,r,'format',l.id)}}
  const sort=(a:MergeRange,b:MergeRange)=>a.from-b.from||a.to-b.to||a.unitId.localeCompare(b.unitId);return {localRanges:freeze(localRanges.sort(sort)),incomingRanges:freeze(incomingRanges.sort(sort))};
}

function compareInternal(localValue:unknown,incomingValue:unknown){
  const localParsed=parseStored(localValue),incomingParsed=parseStored(incomingValue),local=collectUnits(localParsed,'local') as readonly InternalUnit[],incoming=collectUnits(incomingParsed,'incoming') as readonly InternalUnit[];
  const unmatchedLocal=new Set(local.map(unit=>unit.id)),unmatchedIncoming=new Set(incoming.map(unit=>unit.id)),correspondences:Correspondence[]=[];
  matchByKey([...local],[...incoming],unmatchedLocal,unmatchedIncoming,unit=>`${family(unit)}\u0000${unit.text}`,'exact',correspondences);
  matchByKey([...local],[...incoming],unmatchedLocal,unmatchedIncoming,unit=>`${family(unit)}\u0000${unit.normalized}`,'normalized',correspondences);
  fuzzyMatches([...local],[...incoming],unmatchedLocal,unmatchedIncoming,correspondences);
  correspondences.sort((a,b)=>(incoming.find(unit=>unit.id===a.incomingId)?.order||0)-(incoming.find(unit=>unit.id===b.incomingId)?.order||0));
  const ranges=buildDifferenceRanges([...local],[...incoming],correspondences,unmatchedLocal,unmatchedIncoming);
  const comparison:RichTextComparison=freeze({format:FORMAT,version:VERSION,local:freeze({storedKind:localParsed.storedKind,units:freeze(local.map(publicMergeUnit))}),incoming:freeze({storedKind:incomingParsed.storedKind,units:freeze(incoming.map(publicMergeUnit))}),correspondences:freeze([...correspondences]),localOnly:freeze([...unmatchedLocal]),incomingOnly:freeze([...unmatchedIncoming]),localRanges:ranges.localRanges,incomingRanges:ranges.incomingRanges});
  return {comparison,localParsed,incomingParsed,local,incoming,unmatchedLocal,unmatchedIncoming,correspondences};
}
export function compareRichText(localValue:unknown,incomingValue:unknown):RichTextComparison{return compareInternal(localValue,incomingValue).comparison}

function nodeAtPath(root:JsonNode,path:NodePath){let node=root;for(const index of path){const content=contentOf(node);if(index<0||index>=content.length)return null;node=content[index]!}return node}
function setContent(node:JsonNode,content:JsonNode[]){node.content=content;return node}
function textOfInline(content:JsonNode[]){let text='';for(const node of content){const type=typeOf(node);if(type==='Text')text+=stringParam(node);else if(type==='LineBreak')text+='\n';else if(contentOf(node).length)text+=textOfInline(contentOf(node))}return text}
function mergeAdjacentText(content:JsonNode[]){const out:JsonNode[]=[];for(const node of content){const copy=cloneNode(node),last=out[out.length-1];if(typeOf(copy)==='Text'&&last&&typeOf(last)==='Text'&&signature(marksOf(copy))===signature(marksOf(last)))last.param=stringParam(last)+stringParam(copy);else out.push(copy)}return out}
function trimInlineOuterWhitespace(content:JsonNode[]){
  const out=mergeAdjacentText(content);while(out.length&&typeOf(out[0]!)==='Text'){const text=stringParam(out[0]!).replace(/^\s+/u,'');if(text){out[0]={...out[0]!,param:text};break}out.shift()}while(out.length&&typeOf(out[out.length-1]!)==='Text'){const index=out.length-1,text=stringParam(out[index]!).replace(/\s+$/u,'');if(text){out[index]={...out[index]!,param:text};break}out.pop()}return out
}
function addBoundarySpacing(existing:JsonNode[],offset:number,fragment:JsonNode[]){
  const before=textOfInline(existing).slice(0,offset),after=textOfInline(existing).slice(offset),fragText=textOfInline(fragment);if(!fragText)return fragment;
  const out=fragment.map(cloneNode),starts=/^\s/u.test(fragText),ends=/\s$/u.test(fragText);
  if(before&&/\S$/u.test(before)&&!starts)out.unshift({type:'Text',param:' '});
  if(after&&/^\S/u.test(after)&&!ends)out.push({type:'Text',param:' '});
  return out;
}
function insertInlineAtTextOffset(node:JsonNode,offset:number,fragment:readonly JsonNode[]){
  const content=contentOf(node),total=textOfInline(content).length,target=Math.max(0,Math.min(total,offset)),prepared=addBoundarySpacing(content,target,fragment.map(cloneNode));const out:JsonNode[]=[];let cursor=0,done=false;
  for(const child of content){const type=typeOf(child),length=type==='Text'?stringParam(child).length:type==='LineBreak'?1:0;if(!done&&target<=cursor+length){if(type==='Text'){const text=stringParam(child),cut=Math.max(0,Math.min(text.length,target-cursor));if(cut)out.push({...cloneNode(child),param:text.slice(0,cut)});out.push(...prepared);if(cut<text.length)out.push({...cloneNode(child),param:text.slice(cut)});done=true}else if(type==='LineBreak'&&target===cursor){out.push(...prepared,cloneNode(child));done=true}else{out.push(cloneNode(child));if(target===cursor+length){out.push(...prepared);done=true}}}else out.push(cloneNode(child));cursor+=length}
  if(!done)out.push(...prepared);setContent(node,mergeAdjacentText(out));
}
function replaceInlineTextRange(node:JsonNode,from:number,to:number,fragment:readonly JsonNode[]){
  const content=contentOf(node),flat=inlineText(node,0),start=Math.max(0,Math.min(flat.text.length,from)),end=Math.max(start,Math.min(flat.text.length,to));
  const before=sliceInline(content,flat.spans,0,start),after=sliceInline(content,flat.spans,end,flat.text.length);
  setContent(node,mergeAdjacentText([...before,...fragment.map(cloneNode),...after]));
}
function replaceNodeAtPath(root:JsonNode,path:NodePath,replacement:JsonNode){
  if(!path.length)return false;const parent=nodeAtPath(root,path.slice(0,-1));if(!parent)return false;const content=contentOf(parent),index=path[path.length-1]!;if(index<0||index>=content.length)return false;content[index]=cloneNode(replacement);return true;
}
function localUnitById(units:readonly InternalUnit[]){return new Map(units.map(unit=>[unit.id,unit]))}
function incomingUnitById(units:readonly InternalUnit[]){return new Map(units.map(unit=>[unit.id,unit]))}
function blockMappings(correspondences:readonly Correspondence[],localById:Map<string,InternalUnit>,incomingById:Map<string,InternalUnit>){
  const votes=new Map<string,Map<string,{path:NodePath;count:number}>>();for(const match of correspondences){const local=localById.get(match.localId),incoming=incomingById.get(match.incomingId);if(!local||!incoming||local.kind==='atomic'||incoming.kind==='atomic')continue;const key=pathKey(incoming.blockPath),localKey=pathKey(local.blockPath);let group=votes.get(key);if(!group){group=new Map();votes.set(key,group)}const vote=group.get(localKey)||{path:local.blockPath,count:0};vote.count++;group.set(localKey,vote)}
  const result=new Map<string,NodePath>();for(const [key,group] of votes){const winner=[...group.values()].sort((a,b)=>b.count-a.count||pathKey(a.path).localeCompare(pathKey(b.path)))[0];if(winner)result.set(key,winner.path)}return result;
}
function listMappings(correspondences:readonly Correspondence[],localById:Map<string,InternalUnit>,incomingById:Map<string,InternalUnit>){
  const votes=new Map<string,Map<string,{path:NodePath;count:number}>>();for(const match of correspondences){const local=localById.get(match.localId),incoming=incomingById.get(match.incomingId);if(!local||!incoming||!local.listPath||!incoming.listPath)continue;const key=pathKey(incoming.listPath),localKey=pathKey(local.listPath);let group=votes.get(key);if(!group){group=new Map();votes.set(key,group)}const vote=group.get(localKey)||{path:local.listPath,count:0};vote.count++;group.set(localKey,vote)}const out=new Map<string,NodePath>();for(const [key,group] of votes){const winner=[...group.values()].sort((a,b)=>b.count-a.count||pathKey(a.path).localeCompare(pathKey(b.path)))[0];if(winner)out.set(key,winner.path)}return out;
}
function nearestInsertionOffset(unit:InternalUnit,targetPath:NodePath,incoming:readonly InternalUnit[],localByIncoming:Map<string,string>,localById:Map<string,InternalUnit>){
  const sameBlock=incoming.filter(other=>samePath(other.blockPath,unit.blockPath)&&other.id!==unit.id);let previous:InternalUnit|null=null,next:InternalUnit|null=null;
  for(const candidate of sameBlock){const localId=localByIncoming.get(candidate.id),local=localId?localById.get(localId):null;if(!local||!samePath(local.blockPath,targetPath))continue;if(candidate.order<unit.order&&(!previous||candidate.order>previous.order))previous=candidate;if(candidate.order>unit.order&&(!next||candidate.order<next.order))next=candidate}
  if(next){const id=localByIncoming.get(next.id),local=id?localById.get(id):null;if(local)return local.rawStart}
  if(previous){const id=localByIncoming.get(previous.id),local=id?localById.get(id):null;if(local)return local.rawEnd}
  return Infinity;
}
function simpleListItemUnits(units:readonly InternalUnit[],itemPath:NodePath){return units.filter(unit=>unit.listItemPath&&samePath(unit.listItemPath,itemPath))}
function uniqueIncomingItemPaths(incoming:readonly InternalUnit[],incomingOnly:Set<string>){
  const paths=new Map<string,NodePath>();for(const unit of incoming)if(unit.listItemPath)paths.set(pathKey(unit.listItemPath),unit.listItemPath);const out:NodePath[]=[];for(const path of paths.values()){const itemUnits=simpleListItemUnits(incoming,path);if(itemUnits.length&&itemUnits.every(unit=>incomingOnly.has(unit.id)))out.push(path)}return out;
}
function mappedListItemIndex(itemPath:NodePath,incoming:readonly InternalUnit[],correspondences:readonly Correspondence[],localById:Map<string,InternalUnit>,incomingById:Map<string,InternalUnit>,localListPath:NodePath){
  const itemIndex=itemPath[itemPath.length-1]!,incomingListPath=itemPath.slice(0,-1),matches=correspondences.map(match=>({local:localById.get(match.localId),incoming:incomingById.get(match.incomingId)})).filter(pair=>pair.local&&pair.incoming&&pair.incoming!.listItemPath&&pair.local!.listItemPath&&samePath(pair.incoming!.listPath,incomingListPath)&&samePath(pair.local!.listPath,localListPath));
  let next:number|null=null,prev:number|null=null;for(const pair of matches){const sourceIndex=pair.incoming!.listItemPath![pair.incoming!.listItemPath!.length-1]!,targetIndex=pair.local!.listItemPath![pair.local!.listItemPath!.length-1]!;if(sourceIndex>itemIndex&&(next===null||sourceIndex<next))next=targetIndex;if(sourceIndex<itemIndex&&(prev===null||sourceIndex>prev))prev=targetIndex}return next!==null?next:prev!==null?prev+1:Infinity;
}
function topInsertionIndex(topIndex:number,incoming:readonly InternalUnit[],correspondences:readonly Correspondence[],localById:Map<string,InternalUnit>,incomingById:Map<string,InternalUnit>,localTopCount:number){
  let prev:{source:number;target:number}|null=null,next:{source:number;target:number}|null=null;for(const match of correspondences){const local=localById.get(match.localId),remote=incomingById.get(match.incomingId);if(!local||!remote||remote.topIndex===topIndex)continue;if(remote.topIndex<topIndex&&(!prev||remote.topIndex>prev.source))prev={source:remote.topIndex,target:local.topIndex};if(remote.topIndex>topIndex&&(!next||remote.topIndex<next.source))next={source:remote.topIndex,target:local.topIndex}}return next?next.target:prev?prev.target+1:localTopCount;
}
function filteredNode(node:JsonNode,path:NodePath,incoming:readonly InternalUnit[],incomingOnly:Set<string>,processed:Set<string>):JsonNode|null{
  const relevant=incoming.filter(unit=>pathStarts(unit.path,path)&&!processed.has(unit.id));
  const unique=relevant.filter(unit=>incomingOnly.has(unit.id));if(!unique.length)return null;
  if(unique.length===relevant.length){unique.forEach(unit=>processed.add(unit.id));return cloneNode(node)}
  const type=typeOf(node);
  if(type==='Paragraph'||type==='Heading'){
    const fragments=unique.filter(unit=>samePath(unit.blockPath,path)).sort((a,b)=>a.order-b.order).flatMap(unit=>{processed.add(unit.id);return unit.fragment.map(cloneNode)});if(!fragments.length)return null;
    const copy=cloneNode(node);copy.content=trimInlineOuterWhitespace(fragments);return copy;
  }
  if(ATOMIC_TYPES.has(type)){unique.forEach(unit=>processed.add(unit.id));return cloneNode(node)}
  const children=contentOf(node);if(!children.length)return null;
  const kept:JsonNode[]=[];for(let index=0;index<children.length;index++){const child=filteredNode(children[index]!,[...path,index],incoming,incomingOnly,processed);if(child)kept.push(child)}
  if(!kept.length)return null;const copy=cloneNode(node);copy.content=kept;return copy;
}
function filteredTopBlock(parsed:ParsedDocument,topIndex:number,incoming:readonly InternalUnit[],incomingOnly:Set<string>,processed:Set<string>){
  const node=contentOf(parsed.doc)[topIndex];return node?filteredNode(node,[topIndex],incoming,incomingOnly,processed):null;
}

function performMerge(localValue:unknown,incomingValue:unknown,mode:'contextual'|'append',allowedIncomingIds:Set<string>|null=null):RichTextMergeResult{
  const state=compareInternal(localValue,incomingValue),{comparison,localParsed,incomingParsed,local,incoming,unmatchedIncoming,correspondences}=state,candidateIncoming=allowedIncomingIds?new Set([...unmatchedIncoming].filter(id=>allowedIncomingIds.has(id))):unmatchedIncoming;if(!candidateIncoming.size)return freeze({value:String(localValue??''),changed:false,addedUnitIds:freeze([]),comparison});
  const doc=cloneNode(localParsed.doc),localById=localUnitById(local),incomingById=incomingUnitById(incoming),localByIncoming=new Map(correspondences.map(match=>[match.incomingId,match.localId])),blockMap=blockMappings(correspondences,localById,incomingById),listMap=listMappings(correspondences,localById,incomingById),processed=new Set<string>();
  if(mode==='contextual'){
    const sentenceOps:{path:NodePath;offset:number;unit:InternalUnit}[]=[];
    for(const unit of incoming){if(!candidateIncoming.has(unit.id)||unit.kind==='atomic')continue;const target=blockMap.get(pathKey(unit.blockPath));if(!target)continue;const sourceItemUnits=unit.listItemPath?simpleListItemUnits(incoming,unit.listItemPath):null;if(sourceItemUnits&&sourceItemUnits.every(item=>candidateIncoming.has(item.id)))continue;const offset=nearestInsertionOffset(unit,target,incoming,localByIncoming,localById);sentenceOps.push({path:target,offset,unit});processed.add(unit.id)}
    sentenceOps.sort((a,b)=>pathKey(a.path).localeCompare(pathKey(b.path))||b.offset-a.offset||b.unit.order-a.unit.order);
    for(const operation of sentenceOps){const node=nodeAtPath(doc,operation.path);if(node)insertInlineAtTextOffset(node,Number.isFinite(operation.offset)?operation.offset:textOfInline(contentOf(node)).length,operation.unit.fragment)}

    const itemOps:{listPath:NodePath;index:number;item:JsonNode;sourceOrder:number}[]=[];
    for(const itemPath of uniqueIncomingItemPaths(incoming,candidateIncoming)){
      const units=simpleListItemUnits(incoming,itemPath);if(units.every(unit=>processed.has(unit.id)))continue;const sourceListPath=itemPath.slice(0,-1),targetListPath=listMap.get(pathKey(sourceListPath));if(!targetListPath)continue;const sourceItem=nodeAtPath(incomingParsed.doc,itemPath);if(!sourceItem)continue;const index=mappedListItemIndex(itemPath,incoming,correspondences,localById,incomingById,targetListPath),ids=units.filter(unit=>candidateIncoming.has(unit.id)).map(unit=>unit.id);itemOps.push({listPath:targetListPath,index,item:cloneNode(sourceItem),sourceOrder:units[0]?.order||0});ids.forEach(id=>processed.add(id))}
    const groupedItems=new Map<string,typeof itemOps>();for(const op of itemOps){const key=pathKey(op.listPath),group=groupedItems.get(key)||[];group.push(op);groupedItems.set(key,group)}
    for(const group of groupedItems.values()){const list=nodeAtPath(doc,group[0]!.listPath);if(!list)continue;const content=contentOf(list);group.sort((a,b)=>b.index-a.index||b.sourceOrder-a.sourceOrder);for(const op of group){const index=Number.isFinite(op.index)?Math.max(0,Math.min(content.length,op.index)):content.length;content.splice(index,0,cloneNode(op.item))}}
  }

  const root=contentOf(doc),topOps:{index:number;node:JsonNode;sourceOrder:number}[]=[];
  const topIndexes=[...new Set(incoming.filter(unit=>candidateIncoming.has(unit.id)&&!processed.has(unit.id)).map(unit=>unit.topIndex))].sort((a,b)=>a-b);
  for(const topIndex of topIndexes){const before=new Set(processed),filtered=filteredTopBlock(incomingParsed,topIndex,incoming,candidateIncoming,processed);if(!filtered)continue;const ids=[...processed].filter(id=>!before.has(id)),index=mode==='append'?Infinity:topInsertionIndex(topIndex,incoming,correspondences,localById,incomingById,root.length);topOps.push({index,node:filtered,sourceOrder:incoming.find(unit=>unit.topIndex===topIndex)?.order||0})}
  topOps.sort((a,b)=>b.index-a.index||b.sourceOrder-a.sourceOrder);for(const op of topOps){const index=Number.isFinite(op.index)?Math.max(0,Math.min(root.length,op.index)):root.length;root.splice(index,0,cloneNode(op.node))}
  const added=[...processed].filter(id=>candidateIncoming.has(id));if(!added.length)return freeze({value:String(localValue??''),changed:false,addedUnitIds:freeze([]),comparison});
  const value=encodeParsed(doc,localParsed.storedKind==='plain'&&incomingParsed.storedKind==='plain');return freeze({value,changed:value!==String(localValue??''),addedUnitIds:freeze(added),comparison});
}
export function mergeIncomingAdditions(localValue:unknown,incomingValue:unknown){return performMerge(localValue,incomingValue,'contextual')}
export function appendIncomingAdditions(localValue:unknown,incomingValue:unknown){return performMerge(localValue,incomingValue,'append')}

function matchedDescendant(baseState:ReturnType<typeof compareInternal>,baseId:string){
  const match=baseState.correspondences.find(item=>item.localId===baseId),unit=match?baseState.incoming.find(value=>value.id===match.incomingId)||null:null;return {unit,match:match||null};
}
function sameUnit(a:InternalUnit|null,b:InternalUnit|null){return !!a&&!!b&&a.text===b.text&&a.formatSignature===b.formatSignature}
function descendantChanged(baseUnit:InternalUnit,descendant:InternalUnit|null){return !descendant||!sameUnit(baseUnit,descendant)}
function additionOrders(state:ReturnType<typeof compareInternal>){return new Set([...state.unmatchedIncoming].map(id=>state.incoming.find(unit=>unit.id===id)?.order).filter((value):value is number=>Number.isInteger(value)))}

export function mergeThreeWay(baseValue:unknown,localValue:unknown,incomingValue:unknown):ThreeWayMergeResult{
  const base=String(baseValue??''),localText=String(localValue??''),incomingText=String(incomingValue??'');
  if(localText===incomingText){const comparison=compareRichText(localText,incomingText);return freeze({format:'study-director.rich-text-three-way-merge',version:1,value:localText,changed:false,safe:true,conflictCount:0,usedAncestor:true,addedUnitIds:freeze([]),comparison});}
  if(localText===base){const comparison=compareRichText(incomingText,incomingText);return freeze({format:'study-director.rich-text-three-way-merge',version:1,value:incomingText,changed:incomingText!==localText,safe:true,conflictCount:0,usedAncestor:true,addedUnitIds:freeze([]),comparison});}
  if(incomingText===base){const comparison=compareRichText(localText,incomingText);return freeze({format:'study-director.rich-text-three-way-merge',version:1,value:localText,changed:false,safe:true,conflictCount:0,usedAncestor:true,addedUnitIds:freeze([]),comparison});}

  const baseLocal=compareInternal(base,localText),baseIncoming=compareInternal(base,incomingText),direct=compareInternal(localText,incomingText);
  const doc=cloneNode(baseLocal.incomingParsed.doc),replacementOps:{path:NodePath;from:number;to:number;fragment:readonly JsonNode[];atomic:JsonNode|null}[]=[];
  let conflicts=0;
  for(const baseUnit of baseLocal.local){
    const localMatch=matchedDescendant(baseLocal,baseUnit.id),incomingMatch=matchedDescendant(baseIncoming,baseUnit.id),localUnit=localMatch.unit,incomingUnit=incomingMatch.unit,localChanged=descendantChanged(baseUnit,localUnit),incomingChanged=descendantChanged(baseUnit,incomingUnit);
    if(!incomingChanged)continue;
    if(localChanged){if(!sameUnit(localUnit,incomingUnit))conflicts+=1;continue;}
    if(!localUnit||!incomingUnit){conflicts+=1;continue;}
    // Fuzzy correspondence is evidence that units may be related, not authority to silently rewrite canonical text.
    if(incomingMatch.match?.kind==='fuzzy'){conflicts+=1;continue;}
    if(localUnit.kind==='atomic'||incomingUnit.kind==='atomic'){
      const replacement=incomingUnit.fragment[0];if(localUnit.kind!==incomingUnit.kind||!replacement||!replaceNodeAtPath(doc,localUnit.path,replacement))conflicts+=1;
      continue;
    }
    replacementOps.push({path:localUnit.blockPath,from:localUnit.rawStart,to:localUnit.rawEnd,fragment:incomingUnit.fragment,atomic:null});
  }
  replacementOps.sort((a,b)=>pathKey(a.path).localeCompare(pathKey(b.path))||b.from-a.from);
  for(const op of replacementOps){const node=nodeAtPath(doc,op.path);if(node)replaceInlineTextRange(node,op.from,op.to,op.fragment);else conflicts+=1;}

  const localAddedOrders=additionOrders(baseLocal),incomingAddedOrders=additionOrders(baseIncoming);
  for(const match of direct.correspondences){
    const localUnit=direct.local.find(unit=>unit.id===match.localId),incomingUnit=direct.incoming.find(unit=>unit.id===match.incomingId);if(!localUnit||!incomingUnit)continue;
    if(!localAddedOrders.has(localUnit.order)||!incomingAddedOrders.has(incomingUnit.order))continue;
    if(!sameUnit(localUnit,incomingUnit))conflicts+=1;
  }
  let value=encodeParsed(doc,baseLocal.incomingParsed.storedKind==='plain'&&baseIncoming.incomingParsed.storedKind==='plain');
  const remoteAdditionIds=new Set([...baseIncoming.unmatchedIncoming]);
  const additions=performMerge(value,incomingText,'contextual',remoteAdditionIds);value=additions.value;
  const comparison=compareRichText(value,incomingText);
  return freeze({format:'study-director.rich-text-three-way-merge',version:1,value,changed:value!==localText,safe:conflicts===0,conflictCount:conflicts,usedAncestor:true,addedUnitIds:additions.addedUnitIds,comparison});
}

