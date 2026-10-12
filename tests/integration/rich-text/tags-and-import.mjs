import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {importRichTextNoteTextSource} from '../../helpers/typescript-source.mjs';

// Tags are read from note text by one set of rules, and renaming one changes
// only the text: links, attachments and other tags stay as they are.
const text=await importRichTextNoteTextSource();
const richSandbox={console,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,queueMicrotask};richSandbox.globalThis=richSandbox;vm.createContext(richSandbox);vm.runInContext(fs.readFileSync('source/external/rich-text.js','utf8'),richSandbox);
const rich=richSandbox.StudyDirectorRichText;
const plain=value=>[...value];

// Rules: a letter after a space or at the start of a line; capitals do not matter.
assert.deepEqual(plain(text.tagsInText('#Revise this, then #revise again\n# Heading\nC# #1 (#no) #tag- #a_b-c\n#मराठी-नोट')),['revise','tag','a_b-c','मराठी-नोट']);
assert.equal(text.normalizeTag('#High-Yield'),'high-yield');
for(const bad of ['','#','1abc','two words','tag-','#-x'])assert.equal(text.normalizeTag(bad),'',`${bad} is not a tag name`);
assert.equal(text.renameTagInText('#Revise and #revise, not #revised or C#revise','revise','review'),'#review and #review, not #revised or C#revise');

// A tag crossing formatting keeps its marks around the new name.
const run=[{type:'Text',param:'see #re'},{type:'Text',param:'vise',marks:{Strong:null}},{type:'Text',param:' now'}];
assert.equal(text.renameTagInInline(run,'revise','review'),1);
assert.deepEqual(JSON.parse(JSON.stringify(run)),[{type:'Text',param:'see #review'},{type:'Text',param:'',marks:{Strong:null}},{type:'Text',param:' now'}]);

// Rich notes: tags come from the text only; rename leaves links and other text alone.
const doc={type:'Doc',content:[
  {type:'Heading',param:1,content:[{type:'Text',param:'Cardiology #Revise'}]},
  {type:'Paragraph',content:[{type:'Text',param:'Linked',marks:{Link:'#note=n_0123456789abcdef'}},{type:'Text',param:' then '},{type:'LineBreak'},{type:'Text',param:'#revise and #mcq'}]}
]};
const value='WG1:'+JSON.stringify({version:1,doc});
assert.deepEqual(plain(rich.tagsIn(value)),['revise','mcq']);
assert.deepEqual(plain(rich.tagsIn('Plain #note text #Mcq')),['note','mcq']);
const renamed=rich.renameTag(value,'revise','Review');
assert.equal(rich.isRichTextValue(renamed),true);
assert.deepEqual(plain(rich.tagsIn(renamed)),['review','mcq']);
assert.ok(renamed.includes('#note=n_0123456789abcdef'),'the link to a note is kept');
assert.equal(rich.renameTag(value,'absent','other'),value,'a note without the tag is returned unchanged');
assert.equal(rich.renameTag('Plain #Revise.','revise','review'),'Plain #review.');
assert.throws(()=>rich.renameTag(value,'revise','not a tag'),/start with a letter/);

// Markdown for import: structure and styles become HTML for the paste cleaner;
// what a note cannot hold stays as written.
const html=text.markdownToHtml([
  '# Title','','Some *em*, **bold**, ~~gone~~, ==marked== and snake_case_word `code *x*`','next [web](https://a.com) [rel](other.md) ![img](a.png) <https://b.com>','',
  '## Sub','### Deep','','- one','- two','  - nested','- [ ] task','','1. first','2. second','','> quote','> more','','---','',
  '| a | b |','|---|:-:|','| 1 | 2 \\| x |','','```','  if(x){','    y<z','  }','```','Setext','===','#tag line','\\*literal\\*'
].join('\n'));
assert.equal(html,[
  '<h1>Title</h1>',
  '<p>Some <em>em</em>, <strong>bold</strong>, <s>gone</s>, <mark>marked</mark> and snake_case_word code *x*<br>next <a href="https://a.com">web</a> [rel](other.md) ![img](a.png) <a href="https://b.com">https://b.com</a></p>',
  '<h2>Sub</h2><p><strong>Deep</strong></p>',
  '<ul><li><p>one</p></li><li><p>two</p><ul><li><p>nested</p></li></ul></li><li><p>[ ] task</p></li></ul>',
  '<ol><li><p>first</p></li><li><p>second</p></li></ol>',
  '<blockquote><p>quote<br>more</p></blockquote><hr>',
  '<table><tbody><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2 | x</td></tr></tbody></table>',
  '<p>  if(x){<br>    y&lt;z<br>  }</p>',
  '<h1>Setext</h1><p>#tag line<br>*literal*</p>'
].join(''));
// Raw HTML is shown as text, apart from the inline tags Study Director's own export writes.
assert.equal(text.markdownToHtml('<script>x</script> <u>under</u>'),'<p>&lt;script&gt;x&lt;/script&gt; <u>under</u></p>');
// A table wider than a note allows stays as its text.
const wide=['|'+Array.from({length:16},(_,i)=>` c${i} `).join('|')+'|','|'+Array.from({length:16},()=>'---').join('|')+'|'].join('\n');
assert.ok(!text.markdownToHtml(wide).includes('<table>'));

console.log('tags and Markdown import rules passed');
