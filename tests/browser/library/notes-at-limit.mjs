import assert from 'node:assert/strict';
import {PERFORMANCE_BUDGETS} from '../../../contracts/performance-budgets.mjs';
import {PRODUCTION_LIMITS} from '../../../contracts/production-limits.mjs';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor,sleep} from '../../helpers/browser-harness.mjs';

// Notes at their limit: 2,000 notes holding a heavy library's text (2.3
// million words), with tags, links, a nested tree and a few notes at the word
// limit. Times opening the app and the notes, opening, typing in and saving a
// note, searching, tags and the picker, and what runs by itself meanwhile.
// SD_NOTES_COUNT sets how many notes, SD_NOTES_FIXTURE=extreme gives every
// note 5,000 words, and SD_NOTES_CPU=1 adds where the time goes in each step.
const NOTES=Number(process.env.SD_NOTES_COUNT)||PRODUCTION_LIMITS.maxOngoingNotes,PROFILE=process.env.SD_NOTES_FIXTURE==='extreme'?'extreme':'heavy',CPU=process.env.SD_NOTES_CPU==='1';

const preload=`(()=>{
  const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  localStorage.setItem('studyDirector.userDefaults.v1',JSON.stringify({version:1,studentName:'Limit QA',updatedAt:new Date().toISOString()}));
  localStorage.setItem('studyDirector.nameSetupSkippedDate.v1',today);
  window.__longTasks=[];
  try{new PerformanceObserver(list=>{for(const entry of list.getEntries())window.__longTasks.push({start:entry.startTime,duration:entry.duration});}).observe({type:'longtask',buffered:true});}catch{}
  window.__readyAt=0;const poll=setInterval(()=>{try{if(window.__PWA6&&__PWA6.StartupLifecycle.status().fullyInitialized){window.__readyAt=performance.now();clearInterval(poll);}}catch{}},5);
})()`;

// Built in the page, so the notes' text never crosses the debugging channel.
const fixture=`window.__fixture=(profile,total)=>{
  let seed=0x5eed;const rnd=()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
  const syllables=['ka','ri','to','me','su','la','ne','vo','pi','da','ru','ze','mo','ti','ha','lu','be','go','fa','ni','sho','tra','ple','gin'];
  const vocab=Array.from({length:5000},()=>{let word='';for(let i=2+Math.floor(rnd()*3);i>0;i--)word+=syllables[Math.floor(rnd()*syllables.length)];return word;});
  const word=()=>vocab[Math.floor(rnd()*rnd()*vocab.length)];
  const tags=Array.from({length:80},(_,i)=>vocab[i*13+7]+(i%6===0?'-review':''));
  const labels=[];
  for(let a=1;a<=40;a++){labels.push('Subject '+a);for(let b=1;b<=12;b++){labels.push('Subject '+a+' > Topic '+b);for(let c=1;c<=3;c++)labels.push('Subject '+a+' > Topic '+b+' > Part '+c);}}
  for(let i=1;labels.length<total;i++)labels.push('Loose note '+i);
  const ids=labels.map((_,i)=>'n_'+(0xa000000000000+i).toString(16).padStart(16,'0'));
  const text=value=>({type:'Text',param:value});
  const sentence=count=>{const words=[];for(let i=0;i<count;i++)words.push(word());return words.join(' ');};
  const notes={},facts={limitNotes:[],typical:'',tagCounts:{},words:0,bytes:0};
  for(let i=0;i<total;i++){
    const limit=i%200===7,r=rnd();
    const words=limit?19800:profile==='extreme'?5000:r<0.7?100+Math.floor(rnd()*700):r<0.95?800+Math.floor(rnd()*2200):3000+Math.floor(rnd()*5000);
    const own=[];if(rnd()<0.6)for(let n=1+Math.floor(rnd()*3);n>0;n--)own.push(tags[Math.floor(rnd()*rnd()*tags.length)]);
    const lead=[text(own.map(tag=>'#'+tag).join(' ')+(own.length?' ':'')+sentence(12))];
    if(rnd()<0.15){const other=Math.floor(rnd()*total);lead.push(text(' see '),{type:'Text',param:labels[other].split(' > ').at(-1),marks:{Link:'#note='+ids[other]}},text(' for more'));}
    const content=[{type:'Paragraph',content:lead}];let left=words-12;
    while(left>0){
      const size=Math.min(left,40+Math.floor(rnd()*80));left-=size;const pick=rnd();
      if(pick<0.08)content.push({type:'Heading',param:pick<0.03?1:2,content:[text(sentence(Math.min(size,6)))]});
      else if(pick<0.2)content.push({type:'BulletList',content:Array.from({length:3},()=>({type:'ListItem',content:[{type:'Paragraph',content:[text(sentence(Math.max(1,Math.floor(size/3))))]}]}))});
      else content.push({type:'Paragraph',content:[text(sentence(size))]});
    }
    content.push({type:'Paragraph',content:[text('marker qz'+i.toString(36)+'end')]});
    const value='WG1:'+JSON.stringify({version:1,doc:{type:'Doc',content}});
    const links=rnd()<0.2?[...new Set(Array.from({length:1+Math.floor(rnd()*4)},()=>ids[Math.floor(rnd()*total)]))].filter(id=>id!==ids[i]):[];
    notes[ids[i]]={version:3,key:ids[i],label:labels[i],text:value,updatedAt:new Date(Date.UTC(2026,0,1)+i*3600000+Math.floor(rnd()*3000000)).toISOString(),...(links.length?{links}:{})};
    if(limit)facts.limitNotes.push(ids[i]);else if(!facts.typical&&(profile==='extreme'||words>400&&words<600))facts.typical=ids[i];
    for(const tag of new Set(own))facts.tagCounts[tag]=(facts.tagCounts[tag]||0)+1;
    facts.words+=words;facts.bytes+=value.length;
  }
  facts.commonWord=vocab[3];
  return {notes,facts};
};
// Runs a step, waits until it shows, and reports its time and the longest
// task that held the page meanwhile.
window.__measure=async(run,until)=>{
  const started=performance.now();const value=await run();
  if(until){while(!until()){if(performance.now()>started+60000)throw new Error('The step did not finish within a minute.');await new Promise(resolve=>setTimeout(resolve,4));}}
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const ended=performance.now();await new Promise(resolve=>setTimeout(resolve,60));
  const tasks=window.__longTasks.filter(task=>task.start+task.duration>started&&task.start<ended);
  return {ms:Math.round(ended-started),maxTaskMs:Math.round(Math.max(0,...tasks.map(task=>task.duration))),value};
};
window.__tasksSince=(from,to=Infinity)=>{const tasks=__longTasks.filter(task=>task.start+task.duration>from&&task.start<to);return {maxTaskMs:Math.round(Math.max(0,...tasks.map(task=>task.duration))),longTaskMs:Math.round(tasks.reduce((sum,task)=>sum+task.duration,0))};};
window.__caretAtEnd=()=>{const editor=document.querySelector('#library-notes-editor [contenteditable=true]'),selection=getSelection(),range=document.createRange();editor.focus();range.selectNodeContents(editor);range.collapse(false);selection.removeAllRanges();selection.addRange(range);};`;

const server=await startReleaseServer();
const browser=await launchChromium({profilePrefix:'study-director-qa-notes-limit-'});
const report={status:'PASS',suite:'notes-at-limit',fixture:PROFILE,notes:NOTES,steps:{}};
let page=null;
// Where the time goes: the functions that took longest themselves and,
// with what they called, in all.
async function cpu(name,run){
  if(!CPU)return run();
  await page.send('Profiler.enable');await page.send('Profiler.setSamplingInterval',{interval:200});await page.send('Profiler.start');
  try{return await run();}
  finally{
    const {profile}=await page.send('Profiler.stop'),byId=new Map(profile.nodes.map(node=>[node.id,node])),parent=new Map(),self=new Map(),total=new Map();
    for(const node of profile.nodes)for(const child of node.children||[])parent.set(child,node.id);
    const label=id=>{const frame=byId.get(id).callFrame;return `${frame.functionName||'(anonymous)'} ${String(frame.url).split('/').at(-1).split('?')[0]}:${frame.lineNumber+1}`;};
    profile.samples.forEach((id,index)=>{
      const ms=(profile.timeDeltas[index]||0)/1000,seen=new Set();self.set(label(id),(self.get(label(id))||0)+ms);
      for(let at=id;at!==undefined;at=parent.get(at)){const name=label(at);if(!seen.has(name)){seen.add(name);total.set(name,(total.get(name)||0)+ms);}}
    });
    const top=map=>[...map].filter(([name])=>!/^\((root|program|idle)\)/.test(name)).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([name,ms])=>`${ms.toFixed(1)} ms ${name}`);
    report.steps[name].cpu={self:top(self),total:top(total)};
  }
}
async function step(name,expression){
  report.steps[name]={};Object.assign(report.steps[name],await cpu(name,()=>page.evaluate(expression)));
  console.error(`[notes-at-limit] ${name}: ${JSON.stringify({...report.steps[name],cpu:undefined})}`);return report.steps[name];
}
async function timed(name,run,read){
  report.steps[name]={};await cpu(name,run);Object.assign(report.steps[name],await page.evaluate(read));
  console.error(`[notes-at-limit] ${name}: ${JSON.stringify({...report.steps[name],cpu:undefined})}`);return report.steps[name];
}
const primary=()=>waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().state==='primary'&&__PWA6.SessionLifecycle.status().ready`),{label:'primary ownership'});
try{
  page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});
  await waitForStudyDirector(page,{instrumented:true,timeout:120000});await primary();
  await page.evaluate(fixture);

  // Storing every note at once is what a restore does.
  const stored=await step('storeAll',`(async()=>{
    const made=__fixture(${JSON.stringify(PROFILE)},${NOTES});window.__facts=made.facts;
    return __measure(async()=>{await __PWA6.AppData.notes.replace(made.notes);await __PWA6.AppData.notes.flush({strict:true});return __PWA6.AppData.notes.size();});
  })()`);
  assert.equal(stored.value,NOTES);
  const facts=await page.evaluate(`({words:__facts.words,mib:+(__facts.bytes/1048576).toFixed(1),limitNote:__facts.limitNotes[0],typical:__facts.typical,commonWord:__facts.commonWord,tags:Object.entries(__facts.tagCounts).sort((a,b)=>b[1]-a[1])})`);
  report.totalWords=facts.words;report.textMiB=facts.mib;report.tagsInUse=facts.tags.length;

  // Opening the app, then what runs by itself once it is open.
  await timed('startup',async()=>{await page.reload();await waitForStudyDirector(page,{instrumented:true,timeout:120000});await primary();await sleep(1500);},
    `({readyMs:Math.round(__readyAt),...__tasksSince(0,__readyAt+1500),notes:__PWA6.AppData.notes.size()})`);
  assert.equal(report.steps.startup.notes,NOTES);
  await page.evaluate(fixture);
  await timed('idle',async()=>{await page.evaluate('window.__idleStart=performance.now()');await sleep(6000);},`__tasksSince(__idleStart)`);

  const rows=`document.querySelectorAll('#library-notes-list [data-ongoing-note-key]').length`,count=`(document.getElementById('library-notes-nav-count')?.textContent||'')`;
  await step('openNotes',`__measure(()=>{__PWA6.goTab('library');__PWA6.LibraryView.showSection('notes');},()=>${rows}>0&&!!document.querySelector('#library-notes-editor [contenteditable=true]'))`);
  Object.assign(report.steps.openNotes,await page.evaluate(`({rows:${rows},tagChips:document.querySelectorAll('#library-notes-tags .library-tag-chip').length})`));
  for(const order of ['recent','name'])await step(`sort-${order}`,`__measure(()=>{const sort=document.getElementById('library-notes-sort');sort.value='${order}';sort.dispatchEvent(new Event('change'));})`);
  const open=id=>`__measure(()=>__PWA6.LibraryView.revealNoteReference(${JSON.stringify(id)}),()=>document.querySelector('#library-notes-editor .library-notes-editor-title')?.textContent===__PWA6.AppData.notes.get(${JSON.stringify(id)}).label.split(' > ').at(-1)&&!!document.querySelector('#library-notes-editor [contenteditable=true]'))`;
  // Typing at the end of a note, one character at a time, then saving it.
  const type=(name,text)=>timed(name,async()=>{await page.evaluate('__caretAtEnd();window.__typeStart=performance.now()');for(const character of text)await page.send('Input.insertText',{text:character});},
    `(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const ended=performance.now();await new Promise(resolve=>setTimeout(resolve,60));return {msPerCharacter:+((ended-__typeStart)/${text.length}).toFixed(1),...__tasksSince(__typeStart,ended)};})()`);
  for(const [kind,id] of [['LimitNote',facts.limitNote],['TypicalNote',facts.typical]]){
    await step(`open${kind}`,open(id));
    await type(`typeIn${kind}`,' words added while measuring');
    await step(`save${kind}`,`__measure(()=>__PWA6.AppData.notes.flush({strict:true}))`);
    assert.match(await page.evaluate(`__PWA6.AppData.notes.get(${JSON.stringify(id)}).text`),/words added while measuring/,'the typed words are saved');
  }

  // Search: the first query builds the index in the search worker.
  const search=(query,matches)=>`__measure(()=>{const field=document.getElementById('library-notes-search');field.value=${JSON.stringify(query)};field.dispatchEvent(new Event('input',{bubbles:true}));},()=>!${count}.startsWith('Searching')&&${count}.includes('/')${matches?`&&${count}.startsWith('${matches} /')`:''})`;
  await step('searchFirst',search(`qz${(NOTES-1).toString(36)}end`,1));
  await step('searchAgain',search(`qz${Math.floor(NOTES/3).toString(36)}end`,1));
  await step('searchCommonWord',search(facts.commonWord));
  await step('clearSearch',`__measure(()=>{const field=document.getElementById('library-notes-search');field.value='';field.dispatchEvent(new Event('input',{bubbles:true}));},()=>!${count}.includes('/'))`);

  // Tags: filtering by the most used one, then the pickers typing opens.
  const [busyTag,busyCount]=facts.tags[0];
  await step('filterTag',`__measure(()=>__PWA6.LibraryView.filterTag(${JSON.stringify(busyTag)}),()=>${count}.startsWith('${busyCount} /'))`);
  await step('clearTagFilter',`__measure(()=>[...document.querySelectorAll('#library-notes-tags .library-tag-tool')].find(button=>/Clear/.test(button.textContent)).click(),()=>!${count}.includes('/'))`);
  await page.evaluate(`__PWA6.LibraryView.revealNoteReference(${JSON.stringify(facts.typical)})`);await sleep(300);
  await page.evaluate('__caretAtEnd()');await page.send('Input.insertText',{text:' '});
  const picker=`({ms:Math.round(performance.now()-__pickStart),rows:document.querySelectorAll('dialog.note-picker .note-picker-option').length})`,pickerOpen=`!!document.querySelector('dialog.note-picker')?.open&&document.querySelectorAll('dialog.note-picker .note-picker-option').length>0`;
  const close=async()=>{await page.evaluate(`document.querySelector('dialog.note-picker').dispatchEvent(new Event('cancel'))`);await sleep(100);};
  await timed('tagPicker',async()=>{await page.evaluate('window.__pickStart=performance.now()');for(const character of ['#',busyTag[0]])await page.send('Input.insertText',{text:character});await waitFor(()=>page.evaluate(pickerOpen),{label:'tag picker'});},picker);
  await close();await page.send('Input.insertText',{text:' '});
  await timed('notePicker',async()=>{await page.evaluate('window.__pickStart=performance.now()');for(const character of '[[')await page.send('Input.insertText',{text:character});await waitFor(()=>page.evaluate(pickerOpen),{label:'note picker'});},picker);
  await step('notePickerFilter',`__measure(()=>{const field=document.querySelector('dialog.note-picker .note-picker-field');field.value='topic 7 part';field.dispatchEvent(new Event('input'));})`);
  await close();

  // Renaming the most used tag in every note that has it, then a backup.
  await page.evaluate(`__PWA6.LibraryView.filterTag(${JSON.stringify(busyTag)})`);await sleep(300);
  await step('renameTag',`__measure(async()=>{
    [...document.querySelectorAll('#library-notes-tags .library-tag-tool')].find(button=>button.textContent==='Rename').click();
    let dialog;while(!(dialog=document.getElementById('sd-interaction-dialog'))?.open)await new Promise(resolve=>setTimeout(resolve,4));
    const field=dialog.querySelector('.interaction-input');field.value=${JSON.stringify(`${busyTag}x`)};field.dispatchEvent(new Event('input',{bubbles:true}));
    dialog.querySelector('.interaction-actions .primary').click();
  },()=>/Renamed #/.test(document.getElementById('ongoing-notes-status')?.textContent||''))`);
  assert.match(await page.evaluate(`document.getElementById('ongoing-notes-status').textContent`),new RegExp(`in ${busyCount} notes\\.$`));
  await step('backup',`__measure(async()=>(await __PWA6.BackupController.createCheckpoint()).blob.size)`);

  // Catastrophic-regression guards, kept for the full library: checking
  // every note's text on each read froze start-up for three seconds.
  if(PROFILE==='heavy'&&NOTES===PRODUCTION_LIMITS.maxOngoingNotes){
    assert.ok(report.steps.startup.readyMs<PERFORMANCE_BUDGETS.notesAtLimitStartupMs,`Opening the app with ${NOTES} notes took ${report.steps.startup.readyMs} ms.`);
    for(const [name,result] of Object.entries(report.steps))if(Number.isFinite(result.maxTaskMs))assert.ok(result.maxTaskMs<PERFORMANCE_BUDGETS.notesAtLimitMaxTaskMs,`${name} held the page for ${result.maxTaskMs} ms.`);
    for(const name of ['typeInLimitNote','typeInTypicalNote'])assert.ok(report.steps[name].msPerCharacter<PERFORMANCE_BUDGETS.notesAtLimitKeystrokeMs,`${name} took ${report.steps[name].msPerCharacter} ms a character.`);
    assert.ok(report.steps.searchAgain.ms<PERFORMANCE_BUDGETS.notesAtLimitSearchMs,`A search took ${report.steps.searchAgain.ms} ms.`);
  }
  assert.deepEqual(page.events.filter(event=>!/favicon|ResizeObserver loop/.test(event.text||'')),[]);
  console.log(JSON.stringify(report,null,2));
}finally{
  if(page)await browser.closePage(page).catch(()=>{});
  await browser.close();await server.close();
}
