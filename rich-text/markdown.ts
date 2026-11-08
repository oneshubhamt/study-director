/* Shared DOM-free Markdown rendering for editor and portable exports.
   Top-level blocks are separated by a blank line, as Markdown needs: without
   one, two paragraphs read as one and a paragraph after a list joins the list. */
import {PRODUCTION_LIMITS} from '../contracts/production-limits.mjs';
import {normalizePlainText} from './wg1-codec';
// JSON document supplied by the schema decoder. Params stay unknown until their use.
export type MarkdownNode={type?:unknown;param?:unknown;marks?:Record<string,unknown>;content?:readonly MarkdownNode[]};
function objectParam(value:unknown):Record<string,unknown>{return value!==null&&typeof value==='object'?value as Record<string,unknown>:{};}
const MAX_IMAGE_ALT_CHARS=PRODUCTION_LIMITS.richAssetMaxAltChars;
function normalizeImageAlt(value:unknown){return String(value??'').replace(/[\r\n\t]+/g,' ').trim().slice(0,MAX_IMAGE_ALT_CHARS)}
function validSerializedLinkUrl(value:unknown){return typeof value==='string'&&(/^(?:https?:\/\/|mailto:|tel:)/i.test(value)||/^#attachment=(?:att|img)-[a-z0-9-]{20,80}$/.test(value))}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char))}
function escapeMarkdownText(value:string){return value.replace(/([\\`*_[\]<>])/g,'\\$1')}
function markdownInline(node:MarkdownNode):string{if(node.type==='LineBreak')return '  \n';if(node.type==='SDImage'){const alt=escapeMarkdownText(normalizeImageAlt(objectParam(node.param)['alt']||''));return `[Image${alt?`: ${alt}`:''}]`}if(node.type==='SDAudio'){const name=escapeMarkdownText(String(objectParam(node.param)['name']||'Audio').trim()||'Audio');return `[Audio: ${name}]`}let text=node.type==='Text'?escapeMarkdownText(String(node.param||'')):(node.content||[]).map(markdownInline).join('');const marks=node.marks||{};if(Object.prototype.hasOwnProperty.call(marks,'Underline'))text=`<u>${text}</u>`;if(Object.prototype.hasOwnProperty.call(marks,'Strikethrough'))text=`<s>${text}</s>`;if(Object.prototype.hasOwnProperty.call(marks,'Subscript'))text=`<sub>${text}</sub>`;if(Object.prototype.hasOwnProperty.call(marks,'Superscript'))text=`<sup>${text}</sup>`;if(Object.prototype.hasOwnProperty.call(marks,'SDHighlight'))text=`<mark>${text}</mark>`;if(Object.prototype.hasOwnProperty.call(marks,'Emphasis'))text=`*${text}*`;if(Object.prototype.hasOwnProperty.call(marks,'Strong'))text=`**${text}**`;if(typeof marks['Link']==='string'&&validSerializedLinkUrl(marks['Link']))text=`[${text}](${marks['Link']})`;return text}
function htmlInline(node:MarkdownNode):string{if(node.type==='LineBreak')return '<br>';let text=node.type==='Text'?escapeHtml(String(node.param||'')):(node.content||[]).map(htmlInline).join('');const marks=node.marks||{};if(Object.prototype.hasOwnProperty.call(marks,'Underline'))text=`<u>${text}</u>`;if(Object.prototype.hasOwnProperty.call(marks,'Strikethrough'))text=`<s>${text}</s>`;if(Object.prototype.hasOwnProperty.call(marks,'Subscript'))text=`<sub>${text}</sub>`;if(Object.prototype.hasOwnProperty.call(marks,'Superscript'))text=`<sup>${text}</sup>`;if(Object.prototype.hasOwnProperty.call(marks,'SDHighlight'))text=`<mark>${text}</mark>`;if(Object.prototype.hasOwnProperty.call(marks,'Emphasis'))text=`<em>${text}</em>`;if(Object.prototype.hasOwnProperty.call(marks,'Strong'))text=`<strong>${text}</strong>`;if(typeof marks['Link']==='string'&&validSerializedLinkUrl(marks['Link']))text=`<a href="${escapeHtml(marks['Link'])}">${text}</a>`;return text}
function htmlBlock(node:MarkdownNode):string{if(node.type==='Paragraph')return `<p>${(node.content||[]).map(htmlInline).join('')}</p>`;if(node.type==='Heading'){const level=Math.max(1,Math.min(6,Number(node.param||1)));return `<h${level}>${(node.content||[]).map(htmlInline).join('')}</h${level}>`}if(node.type==='Blockquote')return `<blockquote>${(node.content||[]).map(htmlBlock).join('')}</blockquote>`;if(node.type==='HorizontalRule')return '<hr>';if(node.type==='BulletList'||node.type==='OrderedList'){const tag=node.type==='OrderedList'?'ol':'ul',start=node.type==='OrderedList'&&Number(node.param||1)!==1?` start="${Math.max(1,Number(node.param||1))}"`:'';return `<${tag}${start}>${(node.content||[]).map((item:MarkdownNode)=>`<li>${(item.content||[]).map(htmlBlock).join('')}</li>`).join('')}</${tag}>`}return (node.content||[]).map(htmlBlock).join('')}
function markdownTableCell(cell:MarkdownNode){return (cell.content||[]).map((child:MarkdownNode)=>child.type==='Paragraph'?(child.content||[]).map(markdownInline).join(''):markdownBlock(child).trim()).join('<br>').replace(/\r?\n/g,'<br>').replace(/\|/g,'\\|')}
function htmlTableCell(cell:MarkdownNode){return (cell.content||[]).map(htmlBlock).join('')}
function markdownBlock(node:MarkdownNode,options:{assetPath?:(assetId:string)=>string}={},depth=0):string{
  if(node.type==='Paragraph')return `${(node.content||[]).map(markdownInline).join('')}\n`;if(node.type==='Heading')return `${'#'.repeat(Math.max(1,Math.min(6,Number(node.param||1))))} ${(node.content||[]).map(markdownInline).join('')}\n`;if(node.type==='Blockquote')return (node.content||[]).map((child:MarkdownNode)=>markdownBlock(child,options,depth)).join('').trimEnd().split('\n').map((line:string)=>`> ${line}`).join('\n')+'\n';if(node.type==='HorizontalRule')return '---\n';
  if(node.type==='SDImage'){const value=objectParam(node.param),alt=escapeMarkdownText(normalizeImageAlt(value['alt']||'')),path=options.assetPath?.(String(value['assetId']||''))||'';return path?`![${alt}](${path})\n`:`[Image unavailable${alt?`: ${alt}`:''}]\n`}
  if(node.type==='SDAudio'){const name=escapeMarkdownText(String(objectParam(node.param)['name']||'Audio').trim()||'Audio');return `[Audio: ${name}]\n`}
  if(node.type==='BulletList'||node.type==='OrderedList'){const checklist=node.type==='BulletList'&&Object.prototype.hasOwnProperty.call(node.marks||{},'SDChecklist');return (node.content||[]).map((item:MarkdownNode,index:number)=>{const checked=checklist?`[${item.marks?.['SDChecklistChecked']===true?'x':' '}] `:'',prefix=node.type==='OrderedList'?`${Number(node.param||1)+index}. `:'- ',content=(item.content||[]).map((child:MarkdownNode)=>child.type==='Paragraph'?child.content?.map(markdownInline).join('')||'':markdownBlock(child,options,depth+1).trimEnd()).join('\n');return `${'  '.repeat(depth)}${prefix}${checked}${content}\n`}).join('')}
  if(node.type==='Table'){const rows=node.content||[];if(!rows.length)return '';const headerRow=(rows[0]?.content||[]).every((cell:MarkdownNode)=>cell.type==='HeaderCell');if(headerRow){const cells=rows.map((row:MarkdownNode)=>(row.content||[]).map(markdownTableCell)),width=cells[0]!.length,header=`| ${cells[0]!.join(' | ')} |\n| ${Array.from({length:width},()=> '---').join(' | ')} |\n`;return header+cells.slice(1).map((row:string[])=>`| ${row.join(' | ')} |\n`).join('')}return `<table>\n<tbody>\n${rows.map((row:MarkdownNode)=>`<tr>${(row.content||[]).map((cell:MarkdownNode)=>`<td>${htmlTableCell(cell)}</td>`).join('')}</tr>`).join('\n')}\n</tbody>\n</table>\n`}
  return (node.content||[]).map((child:MarkdownNode)=>markdownBlock(child,options,depth)).join('')
}

export function markdownDocument(doc:MarkdownNode|null|undefined,text='',options:{assetPath?:(assetId:string)=>string}={}){if(!doc){const plain=normalizePlainText(text).trimEnd();return plain?escapeMarkdownText(plain)+'\n':''}const markdown=(doc.content||[]).map((node:MarkdownNode)=>markdownBlock(node,options)).join('\n').replace(/\n{3,}/g,'\n\n').trimEnd();return markdown?markdown+'\n':''}

// Plain pasted text that is clearly Markdown, as chat tools and many web
// editors copy it: a `# ` heading, list markers on two or more lines,
// **bold**, a code fence pair, a table, or a [link](https://…). A #tag, a
// single dash line, `__init__`, an emoticon or ordinary text is not.
const MD_PASTE_HEADING=/^ {0,3}#{1,6}[ \t]+\S/,MD_PASTE_ITEM=/^ {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]+\S/,MD_PASTE_FENCE=/^ {0,3}(?:`{3,}|~{3,})/;
const MD_PASTE_TABLE_RULE=/^ {0,3}\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*$/,MD_PASTE_BOLD=/\*\*(?=\S)[^*\n]*\S\*\*/,MD_PASTE_LINK=/\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\)/i;
export function looksLikeMarkdown(text:unknown){
  const source=String(text??''),lines=source.split(/\r\n?|\n/);
  if(lines.some(line=>MD_PASTE_HEADING.test(line)))return true;
  if(lines.filter(line=>MD_PASTE_ITEM.test(line)).length>=2)return true;
  if(lines.filter(line=>MD_PASTE_FENCE.test(line)).length>=2)return true;
  for(let index=1;index<lines.length;index++)if(lines[index-1]!.includes('|')&&MD_PASTE_TABLE_RULE.test(lines[index]!))return true;
  return MD_PASTE_BOLD.test(source)||MD_PASTE_LINK.test(source);
}

// Markdown read for import. Headings, paragraphs (their line breaks kept),
// lists, quotes, rules, tables and inline styles become HTML for the editor's
// paste cleaner. What a note cannot hold stays as the text it was written as:
// images, links that are not web, mail or phone addresses, and the markers of
// task lists. Code keeps its lines and indentation as plain text.
const MD_FENCE=/^ {0,3}(`{3,}|~{3,})/,MD_HEADING=/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/,MD_SETEXT=/^ {0,3}(=+|-+)[ \t]*$/,MD_RULE=/^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/,MD_QUOTE=/^ {0,3}> ?/,MD_ITEM=/^( *)([-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/,MD_TABLE_RULE=/^ *\|? *:?-+:? *(?:\| *:?-+:? *)*\|? *$/;
const MAX_IMPORTED_TABLE=15,WEB_ADDRESS=/^(?:https?:\/\/|mailto:|tel:)/i,WORD_CHAR=/[\p{L}\p{N}]/u;
function leadingSpaces(line:string){return line.length-line.trimStart().length}
function tableCells(line:string){return line.trim().replace(/^\|/,'').replace(/(?<!\\)\|$/,'').split(/(?<!\\)\|/).map(cell=>cell.trim().replace(/\\\|/g,'|'))}
function startsBlock(line:string){return MD_FENCE.test(line)||MD_HEADING.test(line)||MD_RULE.test(line)||MD_QUOTE.test(line)||MD_ITEM.test(line)}
function markdownInlineHtml(text:string):string{
  let out='',index=0;
  const wrap=(tag:string,inner:string)=>`<${tag}>${markdownInlineHtml(inner)}</${tag}>`;
  while(index<text.length){
    const char=text[index]!,rest=text.slice(index),before=index?text[index-1]!:' ';let match:RegExpExecArray|null;
    if(char==='\\'&&(match=/^\\([!-/:-@[-`{-~])/.exec(rest))){out+=escapeHtml(match[1]!);index+=2;continue}
    if(char==='`'&&(match=/^(`+)([\s\S]*?[^`])\1(?!`)/.exec(rest))){out+=escapeHtml(match[2]!);index+=match[0].length;continue}
    if(char==='!'&&(match=/^!\[[^\]]*\]\([^)]*\)/.exec(rest))){out+=escapeHtml(match[0]);index+=match[0].length;continue}
    if(char==='['&&(match=/^\[((?:\\.|[^\]\\])+)\]\(\s*<?([^\s()<>]+)>?(?:\s+"[^"]*")?\s*\)/.exec(rest))){out+=WEB_ADDRESS.test(match[2]!)?`<a href="${escapeHtml(match[2]!)}">${markdownInlineHtml(match[1]!)}</a>`:escapeHtml(match[0]);index+=match[0].length;continue}
    if(char==='<'&&(match=/^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i.exec(rest))){out+=`<a href="${escapeHtml(match[1]!)}">${escapeHtml(match[1]!)}</a>`;index+=match[0].length;continue}
    // The inline tags Study Director's own Markdown export writes.
    if(char==='<'&&(match=/^<(?:\/?(?:u|s|sub|sup|mark|strong|em|b|i)|br\s*\/?)>/i.exec(rest))){out+=match[0].toLowerCase();index+=match[0].length;continue}
    if(char==='h'&&!WORD_CHAR.test(before)&&(match=/^https?:\/\/[^\s<>"]*[^\s<>"'.,!?;:)\]}]/.exec(rest))){out+=`<a href="${escapeHtml(match[0])}">${escapeHtml(match[0])}</a>`;index+=match[0].length;continue}
    if(char==='*'&&(match=/^\*\*(?!\s)([\s\S]*?\S)\*\*(?!\*)/.exec(rest))){out+=wrap('strong',match[1]!);index+=match[0].length;continue}
    if(char==='*'&&(match=/^\*(?![\s*])((?:\*\*[\s\S]*?\*\*|[^*])*?[^\s*])\*(?!\*)/.exec(rest))){out+=wrap('em',match[1]!);index+=match[0].length;continue}
    if(char==='_'&&!WORD_CHAR.test(before)&&(match=/^__(?!\s)([\s\S]*?\S)__(?![\p{L}\p{N}_])/u.exec(rest))){out+=wrap('strong',match[1]!);index+=match[0].length;continue}
    if(char==='_'&&!WORD_CHAR.test(before)&&(match=/^_(?![\s_])([\s\S]*?[^\s_])_(?![\p{L}\p{N}_])/u.exec(rest))){out+=wrap('em',match[1]!);index+=match[0].length;continue}
    if(char==='~'&&(match=/^~~(?!\s)([\s\S]*?\S)~~/.exec(rest))){out+=wrap('s',match[1]!);index+=match[0].length;continue}
    if(char==='='&&(match=/^==(?!\s)([\s\S]*?\S)==/.exec(rest))){out+=wrap('mark',match[1]!);index+=match[0].length;continue}
    out+=escapeHtml(char);index++;
  }
  return out;
}
function markdownListHtml(lines:string[],start:number):[string,number]{
  const first=MD_ITEM.exec(lines[start]!)!,indent=first[1]!.length,ordered=/\d/.test(first[2]!),items:string[][]=[];let index=start,width=0;
  while(index<lines.length){
    const line=lines[index]!,item=MD_ITEM.exec(line);
    if(item&&item[1]!.length===indent&&!MD_RULE.test(line)){if(/\d/.test(item[2]!)!==ordered)break;items.push([item[3]||'']);width=item[2]!.length+1;index++;continue}
    if(!line.trim()){
      let next=index+1;while(next<lines.length&&!lines[next]!.trim())next++;
      const after=next<lines.length?lines[next]!:'',sibling=MD_ITEM.exec(after);
      if(next<lines.length&&(leadingSpaces(after)>indent||(sibling&&sibling[1]!.length===indent&&/\d/.test(sibling[2]!)===ordered))){items.at(-1)!.push('');index++;continue}
      break;
    }
    if(leadingSpaces(line)>indent){items.at(-1)!.push(line.slice(Math.min(leadingSpaces(line),indent+width)));index++;continue}
    if(items.at(-1)!.at(-1)?.trim()&&!startsBlock(line)){items.at(-1)!.push(line.trim());index++;continue}
    break;
  }
  const tag=ordered?'ol':'ul';
  return [`<${tag}>${items.map(item=>`<li>${markdownBlocksHtml(item)}</li>`).join('')}</${tag}>`,index];
}
function markdownBlocksHtml(lines:string[]):string{
  let html='',index=0,paragraph:string[]=[];
  const flush=()=>{if(paragraph.length){html+=`<p>${paragraph.map(line=>markdownInlineHtml(line.trim())).join('<br>')}</p>`;paragraph=[]}};
  while(index<lines.length){
    const line=lines[index]!;let match:RegExpExecArray|null;
    if(!line.trim()){flush();index++;continue}
    if((match=MD_FENCE.exec(line))){
      flush();const fence=match[1]!,close=new RegExp(`^ {0,3}${fence[0]==='`'?'`':'~'}{${fence.length},}[ \\t]*$`),body:string[]=[];index++;
      while(index<lines.length&&!close.test(lines[index]!))body.push(lines[index++]!);index++;
      html+=`<p>${body.map(row=>escapeHtml(row).replace(/^ +/,spaces=>'\u00a0'.repeat(spaces.length))).join('<br>')}</p>`;continue;
    }
    if((match=MD_HEADING.exec(line))){flush();const level=match[1]!.length,text=markdownInlineHtml(match[2]||'');html+=level<=2?`<h${level}>${text}</h${level}>`:`<p><strong>${text}</strong></p>`;index++;continue}
    if(paragraph.length&&(match=MD_SETEXT.exec(line))){const level=match[1]![0]==='='?1:2;html+=`<h${level}>${paragraph.map(row=>markdownInlineHtml(row.trim())).join(' ')}</h${level}>`;paragraph=[];index++;continue}
    if(MD_RULE.test(line)){flush();html+='<hr>';index++;continue}
    if(MD_QUOTE.test(line)){flush();const body:string[]=[];while(index<lines.length&&MD_QUOTE.test(lines[index]!))body.push(lines[index++]!.replace(MD_QUOTE,''));html+=`<blockquote>${markdownBlocksHtml(body)}</blockquote>`;continue}
    if(line.includes('|')&&index+1<lines.length&&MD_TABLE_RULE.test(lines[index+1]!)&&tableCells(lines[index+1]!).length===tableCells(line).length){
      flush();const rows=[tableCells(line)],source=[line,lines[index+1]!];index+=2;
      while(index<lines.length&&lines[index]!.includes('|')&&lines[index]!.trim()){rows.push(tableCells(lines[index]!));source.push(lines[index++]!)}
      const width=rows[0]!.length;
      if(rows.length<=MAX_IMPORTED_TABLE&&width<=MAX_IMPORTED_TABLE)html+=`<table><tbody>${rows.map((row,rowIndex)=>`<tr>${Array.from({length:width},(_,column)=>{const tag=rowIndex?'td':'th';return `<${tag}>${markdownInlineHtml(row[column]??'')}</${tag}>`}).join('')}</tr>`).join('')}</tbody></table>`;
      else html+=`<p>${source.map(row=>escapeHtml(row)).join('<br>')}</p>`;
      continue;
    }
    if(MD_ITEM.test(line)){flush();const [list,next]=markdownListHtml(lines,index);html+=list;index=next;continue}
    paragraph.push(line);index++;
  }
  flush();return html;
}
export function markdownToHtml(markdown:string){return markdownBlocksHtml(normalizePlainText(markdown).replace(/^\uFEFF/,'').replace(/^[ \t]+/gm,spaces=>spaces.replace(/\t/g,'    ')).split('\n'))}
