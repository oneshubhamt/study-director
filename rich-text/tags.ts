/* Tags: #words in a note's text, read the way Apple Notes, Bear and Obsidian
 * read them. DOM-free; the editor, the import and the Library share these rules. */

// A tag is # and a letter, then letters, digits, _ or -, ending on a letter or
// digit. It starts a line or follows a space, so #1, C# and a Markdown heading
// are not tags. Capital letters do not matter. U+FFFC stands for an inline
// object such as a line break inside an editor block.
const NAME='\\p{L}(?:[\\p{L}\\p{M}\\p{N}_-]*[\\p{L}\\p{M}\\p{N}])?';
const TAG_IN_TEXT=new RegExp(`(^|[\\s\\uFFFC])#(${NAME})`,'gu'),WHOLE_NAME=new RegExp(`^${NAME}$`,'u');

export type TagMatch={from:number;to:number;tag:string};
// Where each tag sits in the text: from the # to the end of its name.
export function tagMatches(text:string):TagMatch[]{
  const value=String(text||'');if(value.indexOf('#')<0)return [];
  const out:TagMatch[]=[];
  for(const match of value.matchAll(TAG_IN_TEXT)){const from=match.index!+match[1]!.length;out.push({from,to:from+1+match[2]!.length,tag:match[2]!.normalize('NFC').toLowerCase()})}
  return out;
}
export function tagsInText(text:string){return [...new Set(tagMatches(text).map(match=>match.tag))]}
// A name typed for a tag, with or without its #; '' when it cannot be one.
export function normalizeTag(value:unknown){const name=String(value??'').trim().replace(/^#/,'').normalize('NFC');return WHOLE_NAME.test(name)?name.toLowerCase():''}
// The text with every #from (any capitals) written as #to.
export function renameTagInText(text:string,from:string,to:string){
  const value=String(text||''),matches=tagMatches(value).filter(match=>match.tag===from);if(!matches.length)return value;
  let out='',at=0;for(const match of matches){out+=value.slice(at,match.from+1)+to;at=match.to}return out+value.slice(at);
}

type JsonInline={type?:unknown;param?:unknown;content?:unknown};
// Renames tags inside one run of inline nodes, where a tag may cross marks
// ("#re" bold "vise"): the new name goes where the old one began.
export function renameTagInInline(nodes:JsonInline[],from:string,to:string){
  let text='';const spans:{node:JsonInline;start:number}[]=[];
  for(const node of nodes){if(node.type==='Text'){spans.push({node,start:text.length});text+=String(node.param??'')}else text+=node.type==='LineBreak'?'\n':'￼'}
  const matches=tagMatches(text).filter(match=>match.tag===from);if(!matches.length)return 0;
  for(const match of matches.reverse()){
    const start=match.from+1,end=match.to;let placed=false;
    for(const span of spans){
      const value=String(span.node.param??''),spanEnd=span.start+value.length;if(spanEnd<=start||span.start>=end)continue;
      const cut=Math.max(start,span.start)-span.start,stop=Math.min(end,spanEnd)-span.start;
      span.node.param=value.slice(0,cut)+(placed?'':to)+value.slice(stop);placed=true;
    }
  }
  return matches.length;
}
