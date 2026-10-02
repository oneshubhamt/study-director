import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

// Execute the production upload callback, with editor/IO ports controlled at the boundary.
const source=fs.readFileSync('rich-text/editor.ts','utf8');
const start=source.indexOf('const insertLinkedAttachment=');
const end=source.indexOf('const startLinkedAttachment=',start);
assert.ok(start>=0&&end>start);
const callback=stripTypeScriptTypes(source.slice(start,end),{mode:'strip'});
for(const kind of ['audio','pdf'])for(const mode of ['success','cancel','failure','disposed']){
  const events=[];let resolveUpload;class TextSelection{}
  const context={
    AbortController,Error,console:{error(){}},pendingAttachmentKind:kind,attachmentBusy:false,destroyed:false,lifecycle:1,
    attachmentAbortController:null,pendingLinkedAttachmentSelection:{},AUDIO_MIME_TYPES:new Set(['audio/mpeg']),
    options:{onAssetBusy:busy=>events.push(busy),attachments:{upload:()=>new Promise(resolve=>{resolveUpload=resolve;})}},
    GardSelection:{Text:TextSelection},restoreSelection(){},insertLinkedText(){},
    editor:{state:{selection:new TextSelection(),field:()=>({from:0,to:0})},dispatch(){},focus(){}},pdfMenuItem:{},audioMenuItem:{},
    updateEditorStatus(){},selectionInsideTable:()=>false,anchorAttachmentProgress:()=>({update(){}}),
    attachAlive:token=>!context.destroyed&&token===context.lifecycle,validAssetId:()=>true,
    insertStructuralBlockAt(){},StudyAudio:{of:value=>value},normalizeAttachmentName:value=>value,
    structuralInsertionRange:()=>({from:0,to:0}),setAttachmentUploadDecoration:{of:()=>null},finishLinkedAttachmentPicker(){}
  };
  if(mode==='cancel')context.options.attachments.upload=async()=>{const error=new Error('cancelled');error.name='AbortError';throw error;};
  if(mode==='failure')context.options.attachments.upload=async()=>{throw new Error('disk unavailable');};
  vm.createContext(context);vm.runInContext(callback+';globalThis.run=insertLinkedAttachment;',context);
  const pending=context.run({name:'voice.mp3'});
  assert.deepEqual(events,[true],`${mode}: acquisition must notify host`);
  if(mode==='disposed'){context.destroyed=true;context.lifecycle++;}
  resolveUpload?.({id:'audio_fixture',name:'selected-file',type:kind==='pdf'?'application/pdf':'audio/mpeg'});
  await pending;
  assert.deepEqual(events,[true,false],`${mode}: host busy count must balance after settlement`);
  assert.equal(context.attachmentBusy,false);assert.equal(context.attachmentAbortController,null);
}
console.log(JSON.stringify({status:'PASS',suite:'attachment-busy-lifecycle',kinds:['audio','pdf'],cases:['success','cancel','failure','disposed']}));
