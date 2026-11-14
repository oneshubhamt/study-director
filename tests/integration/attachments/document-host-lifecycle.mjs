import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const run=file=>vm.runInThisContext(readRuntimeSource(new URL(file,import.meta.url)),{filename:file});
run('../../../source/core/internal.ts');run('../../../source/core/document-host.ts');
const module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('document-host',1);

function integrationHarness({concurrent=false,failInsertedFlush=false,attachmentLibrary=null}={}){
  const calls=[];let flushCount=0;
  let note={id:'note-1',label:'Topic',text:'WG1:old',updatedAt:'r1'};
  const notes={
    get:()=>note,
    readFreshPayload:async()=>({[note.id]:{...note}}),
    failure:()=>({failed:false}),
    flush:async()=>{calls.push('notes.flush');flushCount++;if(failInsertedFlush&&flushCount===2)throw new Error('storage unavailable');},
    updateValidatedRich:(_key,label,text,expected)=>{
      calls.push(`update:${expected}->${text}`);
      if(expected!==note.updatedAt)return {status:'conflict',revision:note.updatedAt};
      note={...note,label,text,updatedAt:'r'+(Number(note.updatedAt.replace(/\D/g,''))||1)+1};
      return {status:'changed',revision:note.updatedAt};
    },
    remove:async()=>true
  };
  const editor={
    close:async()=>{calls.push('editor.close');return true;},
    flushEditors(){calls.push('editor.flush');},
    quiesce:async work=>{calls.push('editor.quiesce');return await work();}
  };
  const library={
    settleDiary:async()=>{calls.push('diary.settle');return true;},
    noteDestinations:()=>[{key:'topic',label:'Topic'}],
    refreshNotes:()=>{calls.push('library.refresh');return true;},
    batchAttachmentMutation:async(work)=>{calls.push('library.batch');return await work();}
  };
  const review={flushPending:async()=>{calls.push('review.flush');return true;},settled:async()=>{calls.push('review.settled');return true;}};
  const session={settled:async()=>{calls.push('session.settled');}};
  const ownership={
    issue:()=>({revision:1}),
    assert:()=>{calls.push('ownership.assert');if(concurrent)note={...note,text:'WG1:other',updatedAt:'r9'};}
  };
  const exporter={format:'study-director.note-exporter',contractVersion:2,exportKeys:async keys=>{calls.push('export');return {status:'saved',notes:keys.length};},cancel:()=>{calls.push('cancel');}};
  const printer={format:'study-director.note-printer',contractVersion:1,print:async()=>{calls.push('print');return true;}};
  const integration=module.createIntegration(Object.freeze({
    limits:Object.freeze({maxRichAssetPerDocument:20,maxRichAssetBytesPerDocument:1024}),
    notes,ownership,editor,review,session,library:()=>library,attachmentLibrary:()=>attachmentLibrary,
    attachmentTypes:Object.freeze({validType:()=>true}),assets:Object.freeze({get:async()=>null}),
    richText:Object.freeze({
      isRichTextValue:()=>true,assetIds:()=>[],assetPolicy:Object.freeze({maxPerDocument:20,maxBytesPerDocument:1024}),
      insertAttachmentReference:()=>({value:'WG1:new'})
    }),
    content:Object.freeze({withinLimits:()=>true}),printer,exporter
  }));
  return {integration,calls,getNote:()=>note};
}

{
  const h=integrationHarness();
  await h.integration.exporter.exportKeys(['topic']);
  assert.deepEqual(h.calls,['editor.flush','export'],'export must flush grouped editor state before exporter reads notes');
  h.calls.length=0;await h.integration.printNote('topic','Topic');
  assert.deepEqual(h.calls,['editor.flush','print'],'print must consume the same current editor projection');
}
{
  const h=integrationHarness({concurrent:true});
  await assert.rejects(()=>h.integration.insertAttachment('topic',{id:'att-'+ 'a'.repeat(20),name:'Doc.pdf',type:'application/pdf'}),/note changed/i);
  assert.equal(h.getNote().text,'WG1:other','concurrent canonical update must win over stale insertion');
}
{
  const h=integrationHarness({failInsertedFlush:true});
  await assert.rejects(()=>h.integration.insertAttachment('topic',{id:'att-'+ 'b'.repeat(20),name:'Doc.pdf',type:'application/pdf'}),/storage unavailable/i);
  assert.equal(h.getNote().text,'WG1:old','failed post-write verification must restore prior note content');
  assert.ok(h.calls.filter(value=>value==='notes.flush').length>=3,'rollback must itself be durably flushed');
}
{
  const h=integrationHarness();
  const result=await h.integration.quiesceAttachmentMutation(async()=>{h.calls.push('mutation');return 7;});
  assert.equal(result,7);assert.deepEqual(h.calls,['editor.quiesce','library.batch','mutation'],'attachment mutation must hold editor and Library reconciliation together');
}
{
  const h=integrationHarness();
  await assert.rejects(()=>h.integration.richAttachmentPort.upload({name:'x.pdf',type:'application/pdf'}),/not initialized/i);
}
{
  const progress=[];
  const target={add:async(_file,options)=>{options.onProgress?.({phase:'copying',loaded:4,total:10});return {id:'att-'+ 'c'.repeat(20),name:'x.pdf',type:'application/pdf'};}};
  const h=integrationHarness({attachmentLibrary:target});
  const uploaded=await h.integration.richAttachmentPort.upload({name:'x.pdf',type:'application/pdf'},{onProgress:value=>progress.push(value)});
  assert.equal(uploaded.type,'application/pdf');assert.deepEqual(progress,[{phase:'copying',loaded:4,total:10}]);
}

function printerHarness({throwPrint=false}={}){
  const classes=new Set(),sheets=[],listeners=new Map();
  function node(tag){
    const children=[];
    return {tag,children,textContent:'',className:'',dataset:{},append(...values){children.push(...values);},querySelectorAll(){return [];},
      remove(){const index=sheets.indexOf(this);if(index>=0)sheets.splice(index,1);}};
  }
  const document={
    documentElement:{classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)}},
    querySelectorAll:selector=>selector==='.note-print'?[...sheets]:[],
    createElement:node,
    body:{appendChild(value){sheets.push(value);}}
  };
  const window={
    setTimeout(callback){callback();return 1;},
    addEventListener(type,callback,options){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push({callback,once:!!options?.once});},
    removeEventListener(type,callback){listeners.set(type,(listeners.get(type)||[]).filter(entry=>entry.callback!==callback));},
    print(){if(throwPrint)throw new Error('printer unavailable');}
  };
  const emit=type=>{for(const entry of [...listeners.get(type)||[]]){entry.callback();if(entry.once)window.removeEventListener(type,entry.callback);}};
  const printer=module.createPrinter(Object.freeze({
    document,window,richText:Object.freeze({renderRichText:()=>true}),assets:Object.freeze({}),plain:String,
    diagnostics:Object.freeze({capture(){}}),now:()=>0
  }));
  return {printer,emit,sheets,classes};
}
{
  const h=printerHarness();assert.equal(await h.printer.print('Topic','body'),true);
  assert.equal(h.sheets.length,1);assert.equal(h.classes.has('printing-note'),true);
  h.emit('afterprint');assert.equal(h.sheets.length,0);assert.equal(h.classes.has('printing-note'),false);
}
{
  const h=printerHarness({throwPrint:true});
  await assert.rejects(()=>h.printer.print('Topic','body'),/printer unavailable/);
  assert.equal(h.sheets.length,0,'failed print must not retain hidden print DOM/readers');
  assert.equal(h.classes.has('printing-note'),false);
}

console.log(JSON.stringify({status:'PASS',suite:'document-host-lifecycle',exportFlush:true,concurrentFence:true,rollback:true,quiescence:true,attachmentAdapter:true,printCleanup:true}));
