import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium,pasteInPage} from '../../helpers/browser-harness.mjs';
import {richTextRuntimeSource} from '../../helpers/rich-text-runtime.mjs';

const bundle=richTextRuntimeSource();
const browser=await launchChromium({profilePrefix:'qa-paste-sanitize-'});let page;
try{
  page=await browser.createPage('about:blank',{viewport:{width:900,height:720,mobile:false,scale:1}});
  // Wordgard reads the DOM selection only while the page has focus.
  await page.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await page.evaluate(bundle,{returnByValue:false});
  await page.evaluate(`(async()=>{document.body.innerHTML='<main style="width:760px"><textarea id="note"></textarea></main>';window.assets={get:async()=>null,put:async()=>{},remove:async()=>{}};window.mount=await StudyDirectorRichText.mountRichTextEditor({field:note,label:'Paste sanitizer',initialValue:'',maxWords:10000,maxBytes:917504,assets});const editor=document.querySelector('#note + .sd-rte .sd-rte-editor'),dt=new DataTransfer();dt.setData('text/html','<h1>One</h1><h2>Two</h2><h3>Three</h3><pre>Four</pre><p><s>Five</s> <del>Six</del> <code>Seven</code></p><table><thead><tr><th colspan="2">H1</th><th>H2</th></tr></thead><tbody><tr><td rowspan="2">A</td><td>B</td></tr></tbody></table>');dt.setData('text/plain','One Two Three Four Five Six Seven H1 H2 A B');editor.focus();${pasteInPage}(editor,dt)})()`);
  await page.settle();
  const result=await page.evaluate(`(()=>{const root=document.querySelector('#note + .sd-rte .sd-rte-editor'),json=JSON.parse(note.value.slice(4)),text=StudyDirectorRichText.toPlainText(note.value);return {html:root.innerHTML,text,types:json.doc.content.map(n=>[n.type,n.param??null]),headings:json.doc.content.filter(n=>n.type==='Heading').map(n=>n.param??1),headerCells:root.querySelectorAll('th').length,colspan:root.querySelectorAll('[colspan]').length,rowspan:root.querySelectorAll('[rowspan]').length,status:note.dataset.richEditorStatus||''}})()`);
  assert.deepEqual(result.headings,[1,2,2],'H1 and H2 survive as headings; a note has two levels, so H3 and deeper become level 2 (owner, 2026-11-22).');
  assert.match(result.text,/One\s+Two\s+Three\s+Four\s+Five Six Seven/,'Unsupported block wrappers must preserve text boundaries instead of concatenating content.');
  assert.equal(result.colspan,0,'Unsupported colspan must be stripped during paste.');
  assert.equal(result.rowspan,0,'Unsupported rowspan must be stripped during paste.');
  assert.equal(result.headerCells,2,'A complete pasted first-row header remains semantic header cells after sanitization.');
  assert.equal(result.status,'','Sanitized supported paste must remain structurally valid.');
  // Copy and cut use a selection made just before, and a cut the browser
  // performs itself (beforeinput deleteByCut) removes it as one transaction.
  const clipboard=await page.evaluate(`(async()=>{
    const host=document.createElement('textarea');host.id='clip';host.value='Alpha Beta Gamma Delta';document.querySelector('main').append(host);
    await StudyDirectorRichText.mountRichTextEditor({field:host,label:'Clipboard',initialValue:'Alpha Beta Gamma Delta',maxWords:10000,maxBytes:917504,assets});
    const root=document.querySelector('#clip + .sd-rte .sd-rte-editor');root.focus();
    const select=(word)=>{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())&&!node.data.includes(word));if(!node)throw new Error('missing '+word+' in '+root.innerHTML);const from=node.data.indexOf(word),range=document.createRange();range.setStart(node,from);range.setEnd(node,from+word.length);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);};
    const clip=type=>{const data=new DataTransfer(),event=new ClipboardEvent(type,{clipboardData:data,bubbles:true,cancelable:true});root.dispatchEvent(event);return {text:data.getData('text/plain'),prevented:event.defaultPrevented};};
    const tick=()=>new Promise(resolve=>setTimeout(resolve,50));
    // No pause after selecting: copy and cut must catch the editor up first.
    select('Alpha');const copied=clip('copy');
    select('Beta');const cut=clip('cut');
    await tick();
    select('Gamma');const native=new InputEvent('beforeinput',{inputType:'deleteByCut',bubbles:true,cancelable:true});root.dispatchEvent(native);
    await new Promise(resolve=>setTimeout(resolve,50));
    return {copied,cut,nativePrevented:native.defaultPrevented,text:StudyDirectorRichText.toPlainText(host.value).replace(/\\s+/g,' ').trim()};
  })()`);
  assert.deepEqual(clipboard.copied,{text:'Alpha',prevented:true},'copy writes the selection made just before');
  assert.deepEqual(clipboard.cut,{text:'Beta',prevented:true},'cut writes and removes the selection');
  assert.equal(clipboard.nativePrevented,true,'a native cut is applied as an editor transaction');
  assert.equal(clipboard.text,'Alpha Delta','cut and native cut both removed their selection');
  // A real Ctrl+X, through the browser's own cut command, removes the selection.
  const key=async(key,code,keyCode,modifiers,commands)=>{await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:keyCode,modifiers,commands});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:keyCode,modifiers});};
  await page.evaluate(`document.querySelector('#clip + .sd-rte .sd-rte-editor').focus()`);
  await key('a','KeyA',65,2,['selectAll']);await key('x','KeyX',88,2,['cut']);
  await page.settle(3);
  assert.equal(await page.evaluate(`StudyDirectorRichText.toPlainText(document.getElementById('clip').value).trim()`),'','a real cut empties the selection');
  // Markdown. Plain text that is clearly Markdown is pasted formatted, with
  // a pop-up to keep it as plain text; ordinary text, a paste that also
  // brings a formatted version, and Shift-paste are read as before. Copying
  // formatted text puts Markdown in the plain-text version, and copying then
  // pasting inside the app gives back the same note.
  const md='# Polity\n\n- Articles\n- Schedules\n\nRead **this** first.';
  await page.evaluate(`(()=>{
    window.mdMount=async(id,value='')=>{const host=document.createElement('textarea');host.id=id;host.value=value;document.querySelector('main').append(host);await StudyDirectorRichText.mountRichTextEditor({field:host,label:id,initialValue:value,maxWords:10000,maxBytes:917504,assets});const root=document.querySelector('#'+id+' + .sd-rte .sd-rte-editor');root.focus();return root;};
    window.mdDoc=id=>{const value=document.getElementById(id).value;return value.startsWith('WG1:')?JSON.parse(value.slice(4)).doc.content:[{type:'plain'}];};
    window.mdTypes=id=>mdDoc(id).map(node=>node.type);
    window.mdNotice=id=>{const notice=document.querySelector('#'+id+' + .sd-rte .sd-rte-paste-notice');return notice.hidden?'':notice.textContent;};
    window.mdPaste=(id,data)=>{const root=document.querySelector('#'+id+' + .sd-rte .sd-rte-editor');root.focus();const dt=new DataTransfer();for(const [type,value] of Object.entries(data))dt.setData(type,value);${pasteInPage}(root,dt);};
    window.mdTick=()=>new Promise(resolve=>setTimeout(resolve,80));
  })()`);
  const markdown=await page.evaluate(`(async()=>{
    const md=${JSON.stringify(md)};
    await mdMount('md-a');mdPaste('md-a',{'text/plain':md});await mdTick();
    const formatted={types:mdTypes('md-a'),notice:mdNotice('md-a')};
    document.querySelector('#md-a + .sd-rte .sd-rte-paste-plain').click();await mdTick();
    const plain={types:mdTypes('md-a'),text:StudyDirectorRichText.toPlainText(document.getElementById('md-a').value).trim(),notice:mdNotice('md-a')};
    await mdMount('md-b');mdPaste('md-b',{'text/plain':'Just ordinary text, #tag and :-*'});await mdTick();
    const ordinary={text:StudyDirectorRichText.toPlainText(document.getElementById('md-b').value).trim(),notice:mdNotice('md-b')};
    await mdMount('md-c');mdPaste('md-c',{'text/plain':md,'text/html':'<p>Formatted version wins</p>'});await mdTick();
    const html={text:StudyDirectorRichText.toPlainText(document.getElementById('md-c').value).trim(),notice:mdNotice('md-c')};
    return {formatted,plain,ordinary,html};
  })()`);
  assert.deepEqual(markdown.formatted.types.slice(0,3),['Heading','BulletList','Paragraph'],'Markdown pasted as plain text becomes a heading, a list and a paragraph');
  assert.match(markdown.formatted.notice,/^Formatted from Markdown\s*Keep as plain text$/u,'a pop-up offers it as plain text');
  assert.equal(markdown.plain.notice,'','the pop-up closes');assert.equal(markdown.plain.types.includes('Heading'),false,'Keep as plain text undoes the formatting');
  assert.match(markdown.plain.text,/^# Polity\s+- Articles\s+- Schedules\s+Read \*\*this\*\* first\.$/u,'and keeps the text exactly as pasted');
  assert.equal(markdown.ordinary.text,'Just ordinary text, #tag and :-*');assert.equal(markdown.ordinary.notice,'','ordinary text is pasted as it is, with no pop-up');
  assert.equal(markdown.html.text,'Formatted version wins','a paste that brings a formatted version keeps using it');assert.equal(markdown.html.notice,'');
  // Shift-paste (Ctrl/Cmd+Shift+V) stays plain.
  await page.evaluate(`mdMount('md-d').then(()=>true)`);
  await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,modifiers:8});
  await page.evaluate(`mdPaste('md-d',{'text/plain':${JSON.stringify(md)}})`);
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,modifiers:0});
  const shifted=await page.evaluate(`mdTick().then(()=>({types:mdTypes('md-d'),notice:mdNotice('md-d')}))`);
  assert.equal(shifted.types.includes('Heading'),false,'Shift-paste keeps Markdown as plain text');assert.equal(shifted.notice,'');
  // Copy: Markdown in the plain-text version when the selection has formatting.
  const copy=await page.evaluate(`(async()=>{
    await mdMount('md-e');mdPaste('md-e',{'text/plain':${JSON.stringify(md)}});await mdTick();
    const root=document.querySelector('#md-e + .sd-rte .sd-rte-editor');root.focus();const range=document.createRange();range.selectNodeContents(root);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);await mdTick();
    const data=new DataTransfer(),event=new ClipboardEvent('copy',{clipboardData:data,bubbles:true,cancelable:true});root.dispatchEvent(event);
    const copied={text:data.getData('text/plain'),html:data.getData('text/html')};
    await mdMount('md-f');mdPaste('md-f',{'text/plain':copied.text,'text/html':copied.html});await mdTick();
    await mdMount('md-g','Alpha plain words');const plainRoot=document.querySelector('#md-g + .sd-rte .sd-rte-editor');plainRoot.focus();const plainText=document.createTreeWalker(plainRoot,NodeFilter.SHOW_TEXT).nextNode(),plainRange=document.createRange();plainRange.setStart(plainText,0);plainRange.setEnd(plainText,plainText.data.length);selection.removeAllRanges();selection.addRange(plainRange);await mdTick();
    const plainData=new DataTransfer(),plainEvent=new ClipboardEvent('copy',{clipboardData:plainData,bubbles:true,cancelable:true});plainRoot.dispatchEvent(plainEvent);
    // The pasting editor keeps its own empty last paragraph, as any paste does.
    const content=id=>{const nodes=mdDoc(id);while(nodes.length&&nodes.at(-1).type==='Paragraph'&&!(nodes.at(-1).content||[]).length)nodes.pop();return JSON.stringify(nodes);};
    return {copied,same:content('md-f')===content('md-e'),plainCopy:plainData.getData('text/plain')};
  })()`);
  assert.match(copy.copied.text,/^# Polity\n\n- Articles\n- Schedules\n\nRead \*\*this\*\* first\.$/u,'copying formatted text puts Markdown in the plain-text version');
  assert.match(copy.copied.html,/<h1[^>]*>Polity<\/h1>/u,'the formatted version is unchanged');
  assert.equal(copy.same,true,'copy then paste inside the app gives back the same note');
  assert.equal(copy.plainCopy,'Alpha plain words','plain text copies as plain text, unescaped');
  // Pastes from where people copy them. Markdown that starts with a list,
  // quote or table keeps it whole (its first item used to join the line it
  // was pasted on, a numbered list went on as bullets, a table alone was
  // dropped); • bullets, task lists as checklists, deeper headings as level
  // 2; Word's lists, bold and italic; Apple Notes, Mail and Google Docs; a
  // code editor's copy read from its plain text. A list pasted mid-line splits
  // the line, and part of a list item copied in a note pastes inline.
  const shapes=await page.evaluate(`(async()=>{
    const brief=n=>{const marks=Object.entries(n.marks||{}).map(([k,v])=>k==='SDChecklistChecked'?k+'='+v:k),tag=marks.length?'['+marks.join(',')+']':'';return n.type==='Text'?JSON.stringify(n.param)+tag:n.type+(n.param!==undefined&&typeof n.param!=='object'?'('+n.param+')':'')+tag+(n.content?'{'+n.content.map(brief).join(' ')+'}':'');};
    const shape=id=>mdDoc(id).map(brief).filter(text=>text!=='Paragraph{}').join(' | ');
    const rootOf=id=>document.querySelector('#'+id+' + .sd-rte .sd-rte-editor');
    const caret=async(id,offset)=>{const root=rootOf(id);root.focus();if(offset!==null){const text=document.createTreeWalker(root,NodeFilter.SHOW_TEXT).nextNode(),range=document.createRange();range.setStart(text,offset);range.collapse(true);getSelection().removeAllRanges();getSelection().addRange(range);}await new Promise(r=>setTimeout(r,60));};
    const paste=async(id,data,{value='',offset=null}={})=>{await mdMount(id,value);await caret(id,offset);const dt=new DataTransfer();for(const [type,text] of Object.entries(data))dt.setData(type,text);${pasteInPage}(rootOf(id),dt);await mdTick();return shape(id);};
    const out={},cases=__CASES__;
    for(const [name,data] of Object.entries(cases))out[name]=await paste('shape-'+name,data);
    out.codeEditorNotice=mdNotice('shape-codeEditor');
    out.midLine=await paste('shape-mid',{'text/plain':'- one\\n- two'},{value:'Before after',offset:7});
    // Part of a list item, copied in a note, goes in as words.
    await paste('shape-source',{'text/plain':'- alpha beta gamma\\n- delta'});
    const source=rootOf('shape-source'),words=[...source.querySelectorAll('li p')][0].firstChild,range=document.createRange();source.focus();range.setStart(words,6);range.setEnd(words,11);getSelection().removeAllRanges();getSelection().addRange(range);await mdTick();
    const copied=new DataTransfer();source.dispatchEvent(new ClipboardEvent('copy',{clipboardData:copied,bubbles:true,cancelable:true}));
    out.partialItem=await paste('shape-partial',{'text/plain':copied.getData('text/plain'),'text/html':copied.getData('text/html')},{value:'Start end',offset:6});
    return out;
  })()`.replace('__CASES__',JSON.stringify({"listFirst": {"text/plain": "* one\n* **two**"}, "numbered": {"text/plain": "1. one\n2. two"}, "nested": {"text/plain": "- one\n  - inner\n- two"}, "bullets": {"text/plain": "**Plan**\n\u2022 one\n\u2022 two"}, "tasks": {"text/plain": "- [ ] todo\n- [x] done"}, "headings": {"text/plain": "### Third\n\n#### Fourth"}, "quote": {"text/plain": "> quoted **bold**"}, "table": {"text/plain": "| A | B |\n|---|---|\n| 1 | 2 |"}, "word": {"text/plain": "Plan", "text/html": "<p class=MsoNormal><b style='mso-bidi-font-weight:normal'>Plan<o:p></o:p></b></p><p class=MsoListParagraphCxSpFirst style='text-indent:-.25in;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol;mso-list:Ignore'>\u00b7<span style='font:7.0pt \"Times New Roman\"'>&nbsp;&nbsp; </span></span><![endif]><i style='mso-bidi-font-style:normal'>one</i><o:p></o:p></p><p class=MsoListParagraphCxSpMiddle style='margin-left:1.0in;mso-list:l0 level2 lfo1'><![if !supportLists]><span style='font-family:\"Courier New\";mso-list:Ignore'>o<span>&nbsp;</span></span><![endif]>inner<o:p></o:p></p><p class=MsoListParagraphCxSpLast style='mso-list:l0 level1 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>\u00b7<span>&nbsp;</span></span><![endif]>two<o:p></o:p></p><p class=MsoNormal>After</p>"}, "wordNumbered": {"text/plain": "first", "text/html": "<p class=MsoListParagraphCxSpFirst style='mso-list:l1 level1 lfo2'><![if !supportLists]><span style='mso-list:Ignore'>1.<span>&nbsp;</span></span><![endif]>first</p><p class=MsoListParagraphCxSpLast style='mso-list:l1 level1 lfo2'><![if !supportLists]><span style='mso-list:Ignore'>2.<span>&nbsp;</span></span><![endif]><b>second</b></p>"}, "appleNotes": {"text/plain": "Title", "text/html": "<meta charset=\"UTF-8\"><b><span style=\"font-size: 24px\">Title</span></b><div>Body <i>italic</i></div><ol><li>one</li><li>two</li></ol>"}, "mail": {"text/plain": "Hi", "text/html": "<div dir=\"ltr\">Hi <b>there</b>,<blockquote type=\"cite\"><div>quoted <i>line</i></div></blockquote><div><strike>old</strike> <del>gone</del></div></div>"}, "googleDocs": {"text/plain": "one\ntwo", "text/html": "<meta charset=\"utf-8\"><b style=\"font-weight:normal;\" id=\"docs-internal-guid-1\"><ul><li dir=\"ltr\" aria-level=\"1\"><p dir=\"ltr\" role=\"presentation\"><span style=\"font-weight:700;\">one</span></p></li><li dir=\"ltr\" aria-level=\"1\"><p dir=\"ltr\" role=\"presentation\"><span style=\"font-weight:400;\">two</span></p></li></ul></b>"}, "codeEditor": {"text/plain": "**Plan**\n- one\n- two", "text/html": "<div style=\"white-space:pre;\"><div><span>**Plan**</span></div><div><span>- one</span></div><div><span>- two</span></div></div>"}, "codeEditorPlain": {"text/plain": "line one\n  line two", "text/html": "<div style=\"white-space:pre;\"><div><span>line one</span></div><div><span>  line two</span></div></div>"}})));
  const expected={
    listFirst:'BulletList{ListItem{Paragraph{"one"}} ListItem{Paragraph{"two"[Strong]}}}',
    numbered:'OrderedList{ListItem{Paragraph{"one"}} ListItem{Paragraph{"two"}}}',
    nested:'BulletList{ListItem{Paragraph{"one"} BulletList{ListItem{Paragraph{"inner"}}}} ListItem{Paragraph{"two"}}}',
    bullets:'Paragraph{"Plan"[Strong]} | BulletList{ListItem{Paragraph{"one"}} ListItem{Paragraph{"two"}}}',
    tasks:'BulletList[SDChecklist]{ListItem[SDChecklistRole,SDChecklistChecked=false]{Paragraph{"todo"}} ListItem[SDChecklistRole,SDChecklistChecked=true]{Paragraph{"done"}}}',
    headings:'Heading(2){"Third"} | Heading(2){"Fourth"}',
    quote:'Blockquote{Paragraph{"quoted " "bold"[Strong]}}',
    table:'Table{TableRow{HeaderCell{Paragraph{"A"}} HeaderCell{Paragraph{"B"}}} TableRow{Cell{Paragraph{"1"}} Cell{Paragraph{"2"}}}}',
    word:'Paragraph{"Plan"[Strong]} | BulletList{ListItem{Paragraph{"one"[Emphasis]} BulletList{ListItem{Paragraph{"inner"}}}} ListItem{Paragraph{"two"}}} | Paragraph{"After"}',
    wordNumbered:'OrderedList{ListItem{Paragraph{"first"}} ListItem{Paragraph{"second"[Strong]}}}',
    appleNotes:'Paragraph[SDFontSize]{"Title"[Strong]} | Paragraph{"Body " "italic"[Emphasis]} | OrderedList{ListItem{Paragraph{"one"}} ListItem{Paragraph{"two"}}}',
    mail:'Paragraph{"Hi " "there"[Strong] ","} | Blockquote{Paragraph{"quoted " "line"[Emphasis]}} | Paragraph{"old"[Strikethrough] " " "gone"[Strikethrough]}',
    googleDocs:'BulletList{ListItem{Paragraph{"one"[Strong]}} ListItem{Paragraph{"two"}}}',
    codeEditor:'Paragraph{"Plan"[Strong]} | BulletList{ListItem{Paragraph{"one"}} ListItem{Paragraph{"two"}}}',
    codeEditorPlain:'Paragraph{"line one"} | Paragraph{"  line two"}',
    midLine:'Paragraph{"Before "} | BulletList{ListItem{Paragraph{"one"}} ListItem{Paragraph{"two"}}} | Paragraph{"after"}',
    partialItem:'Paragraph{"Start beta end"}'
  };
  for(const [name,want] of Object.entries(expected))assert.equal(shapes[name],want,`paste: ${name}`);
  assert.match(shapes.codeEditorNotice,/^Formatted from Markdown/u,'a code editor\'s Markdown is formatted, with the pop-up to keep it plain');
  assert.deepEqual(page.events,[],'QA_FIXTURE paste-sanitization browser test produced runtime errors.');
  console.log(JSON.stringify({status:'PASS',suite:'paste-sanitization',result,clipboard,markdown,copy,shapes},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close()}
