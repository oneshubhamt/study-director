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
  assert.deepEqual(result.headings,[1,2],'Approved H1 and legacy H2 should survive as headings; unsupported H3+ are demoted.');
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
  assert.deepEqual(page.events,[],'QA_FIXTURE paste-sanitization browser test produced runtime errors.');
  console.log(JSON.stringify({status:'PASS',suite:'paste-sanitization',result,clipboard,markdown,copy},null,2));
}finally{if(page)await browser.closePage(page).catch(()=>{});await browser.close()}
