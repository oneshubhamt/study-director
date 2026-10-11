import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class FakeElement{
  constructor(tag,document){this.tagName=String(tag).toUpperCase();this.ownerDocument=document;this.children=[];this.parentNode=null;this.className='';this.dataset={};this.attributes=new Map();this.listeners=new Map();this.textContent='';this.value='';this.type='';this.disabled=false;this.open=false;this.spellcheck=false;this.oninput=null;}
  appendChild(node){node.parentNode=this;this.children.push(node);return node;}
  append(...nodes){for(const node of nodes)this.appendChild(node);}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  addEventListener(type,handler){const list=this.listeners.get(type)||[];list.push(handler);this.listeners.set(type,list);}
  dispatch(type){for(const handler of [...(this.listeners.get(type)||[])])handler({type,target:this,preventDefault(){}});}
  showModal(){this.open=true;}
  focus(){this.ownerDocument.activeElement=this;}
  remove(){if(this.parentNode){const index=this.parentNode.children.indexOf(this);if(index>=0)this.parentNode.children.splice(index,1);}this.parentNode=null;this.open=false;}
}
class FakeDocument{
  constructor(){this.body=new FakeElement('body',this);}
  createElement(tag){return new FakeElement(tag,this);}
  contains(element){for(let node=element;node;node=node.parentNode)if(node===this.body)return true;return false;}
}
function descendants(root,predicate,out=[]){for(const child of root.children){if(predicate(child))out.push(child);descendants(child,predicate,out);}return out;}
function byText(root,text){return descendants(root,node=>node.textContent===text)[0]||null;}
function tick(){return new Promise(resolve=>setImmediate(resolve));}

for(const file of ['source/core/internal.js','source/core/reconciliation-ui.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('reconciliation-ui',1);
const freeze=Object.freeze;
function createController({mount,assetGet,failMount=()=>false,failDestroy=()=>false}={}){
  const document=new FakeDocument(),mounts=[],destroyed=[],rangeCalls=[];
  const mountRichTextEditor=mount||((options)=>{
    mounts.push(options);
    if(failMount(mounts.length))throw new Error('Injected editor mount failure');
    let alive=true;
    return Promise.resolve(freeze({
      getValue:()=>options.field.value,
      setValue:value=>{if(!alive)return false;options.field.value=String(value);return true;},
      setTransientRanges:ranges=>{rangeCalls.push({field:options.field,ranges});},
      focus:()=>false,
      destroy:async()=>{alive=false;destroyed.push(options.field);if(failDestroy(destroyed.length))throw new Error('Injected destroy failure');}
    }));
  });
  const controller=module.createController(freeze({ports:freeze({
    assets:freeze({get:assetGet|| (async()=>null)}),
    configuration:freeze({maxBytes:1_000_000,maxWords:20_000}),
    diagnostics:freeze({capture:()=>false}),
    richText:freeze({
      mountRichTextEditor,
      compareRichText:(local,incoming)=>freeze({localRanges:freeze(local===incoming?[]:[freeze({from:1,to:2,kind:'changed'})]),incomingRanges:freeze(local===incoming?[]:[freeze({from:1,to:2,kind:'changed'})]),incomingOnly:freeze(local===incoming?[]:[1]),localOnly:freeze([]),correspondences:freeze([])}),
      mergeIncomingAdditions:(local,incoming)=>freeze({value:`${local}|MERGED|${incoming}`}),
      appendIncomingAdditions:(local,incoming)=>freeze({value:`${local}|APPENDED|${incoming}`}),
      mergeThreeWay:(base,local,incoming)=>freeze({value:`${local}|THREEWAY|${incoming}`,safe:base==='SAFE-BASE',conflictCount:base==='SAFE-BASE'?0:1})
    }),
    view:freeze({document,requestAnimationFrame:callback=>{queueMicrotask(callback);return 1;},cancelAnimationFrame:()=>false})
  })}));
  return{controller,document,mounts,destroyed,rangeCalls};
}
const conflict=(key,localValue,incomingValue,{ancestorAvailable=false,ancestorValue='',requireContent=false}={})=>freeze({key,label:key,localCandidateId:`local:${key}`,incomingCandidateId:`remote:${key}`,localValue,incomingValue,ancestorAvailable,ancestorValue,requireContent,incomingLabel:'Drive checkpoint'});

// Normal two-conflict flow: the left editor is the editable resolved copy and the right editor is a read-only reference.
{
  const harness=createController();
  const promise=harness.controller.resolve({conflicts:[conflict('Polity','LOCAL-P','REMOTE-P'),conflict('Economy','LOCAL-E','REMOTE-E')],incomingAssets:[]});
  await tick();await tick();
  const dialog=harness.document.body.children[0];
  assert.ok(dialog?.open,'reconciliation dialog opens');
  assert.equal(harness.mounts.length,2,'two scratch editors mount for the active conflict');
  for(const options of harness.mounts){assert.equal(options.surface,'reconciliation');assert.equal(options.allowAssetInsert,false);assert.equal(options.focusOnMount,false);}
  assert.equal(harness.mounts[0].readOnly,false,'resolved editor must be editable');
  assert.equal(harness.mounts[1].readOnly,true,'imported editor must be read-only');
  assert.equal(descendants(dialog,node=>node.tagName==='TEXTAREA').length,2,'two scratch surfaces are present');
  byText(dialog,'Use imported').dispatch('click');
  byText(dialog,'Apply resolved note').dispatch('click');
  await tick();await tick();
  assert.equal(harness.mounts.length,4,'applying the first conflict mounts the next pair');
  byText(dialog,'Smart merge').dispatch('click');
  byText(dialog,'Apply resolved note').dispatch('click');
  const result=await promise;
  assert.equal(result.notes.Polity.text,'REMOTE-P','Use imported changes only the scratch resolution');
  assert.equal(result.notes.Economy.text,'LOCAL-E|MERGED|REMOTE-E','Smart merge falls back to the two-way engine when no ancestor is available');
  assert.equal(harness.document.body.children.length,0,'dialog is removed after all conflicts are applied');
  assert.equal(harness.destroyed.length,4,'all scratch editors are destroyed');
  assert.ok(harness.rangeCalls.length>=4,'transient comparison ranges are applied to both sides');
}


// Manual edits to the left working copy are the custom reconciliation path; the
// imported/right reference remains fixed and selectable rather than editable.
{
  const harness=createController();
  const promise=harness.controller.resolve({conflicts:[conflict('Custom','LOCAL-C','REMOTE-C')],incomingAssets:[]});
  await tick();await tick();
  const dialog=harness.document.body.children[0];
  harness.mounts[0].field.value='CUSTOM RESOLVED';
  harness.mounts[0].field.oninput?.();
  // Even if a harness mutates the underlying textarea directly, Use imported must
  // use the immutable imported state rather than treating the right pane as output.
  harness.mounts[1].field.value='TAMPERED-REFERENCE';
  byText(dialog,'Use imported').dispatch('click');
  assert.equal(harness.mounts[0].field.value,'REMOTE-C','Use imported must load the immutable incoming value');
  harness.mounts[0].field.value='CUSTOM RESOLVED';
  harness.mounts[0].field.oninput?.();
  byText(dialog,'Apply resolved note').dispatch('click');
  const result=await promise;
  assert.equal(result.notes.Custom.text,'CUSTOM RESOLVED','manual left editing is the custom reconciliation result');
}

// Diary/manual mode never runs automatic merge logic. It exposes only local/imported/custom
// choices over the same editable-left/read-only-right surfaces.
{
  const harness=createController();
  const promise=harness.controller.resolve({conflicts:[conflict('2026-09-20','LOCAL-D','REMOTE-D',{ancestorAvailable:true,ancestorValue:'SAFE-BASE'})],incomingAssets:[],manualOnly:true});
  await tick();await tick();
  const dialog=harness.document.body.children[0];
  assert.ok(dialog?.open,'manual Diary reconciliation must always open when reflections differ');
  assert.equal(harness.mounts[0].readOnly,false);assert.equal(harness.mounts[1].readOnly,true);
  assert.equal(byText(dialog,'Smart merge').hidden,true,'Diary reconciliation must hide automatic merge');
  assert.equal(byText(dialog,'Append additions').hidden,true,'Diary reconciliation must hide append merge');
  assert.notEqual(byText(dialog,'Custom').hidden,true,'Diary reconciliation must expose explicit custom editing');
  byText(dialog,'Custom').dispatch('click');
  harness.mounts[0].field.value='CUSTOM-D';harness.mounts[0].field.oninput?.();
  byText(dialog,'Apply reflection').dispatch('click');
  const result=await promise;
  assert.equal(result.notes['2026-09-20'].text,'CUSTOM-D');
}

// Diary-only reconciliation cannot manufacture an empty canonical Diary record.
{
  const harness=createController();
  const promise=harness.controller.resolve({conflicts:[conflict('2026-09-21','LOCAL-D2','REMOTE-D2',{requireContent:true})],incomingAssets:[],manualOnly:true});
  await tick();await tick();
  const dialog=harness.document.body.children[0];
  harness.mounts[0].field.value='';harness.mounts[0].field.oninput?.();
  byText(dialog,'Apply reflection').dispatch('click');
  assert.ok(dialog.open,'empty custom Diary resolution must remain open');
  byText(dialog,'Keep local').dispatch('click');
  byText(dialog,'Apply reflection').dispatch('click');
  const result=await promise;
  assert.equal(result.notes['2026-09-21'].text,'LOCAL-D2');
}

// Every difference opens the review, even when only one side changed since the
// shared copy; nothing is applied until the person applies it.
{
  const harness=createController();
  const promise=harness.controller.resolve({conflicts:[conflict('Forward','SAFE-BASE','REMOTE-NEW',{ancestorAvailable:true,ancestorValue:'SAFE-BASE'})],incomingAssets:[]});
  await tick();await tick();
  const dialog=harness.document.body.children[0];
  assert.ok(dialog,'a one-sided change must still open the review');
  assert.equal(harness.mounts[0].field.value,'SAFE-BASE','the working copy starts from this device');
  byText(dialog,'Use imported').dispatch('click');byText(dialog,'Apply resolved note').dispatch('click');
  assert.equal((await promise).notes.Forward.text,'REMOTE-NEW');
}

// Replace starts the working copy from the backup's version.
{
  const harness=createController();
  const promise=harness.controller.resolve({conflicts:[conflict('Replaced','LOCAL-R','BACKUP-R')],incomingAssets:[],startWith:'incoming'});
  await tick();await tick();
  const dialog=harness.document.body.children[0];
  assert.equal(harness.mounts[0].field.value,'BACKUP-R');
  byText(dialog,'Keep local').dispatch('click');byText(dialog,'Apply resolved note').dispatch('click');
  assert.equal((await promise).notes.Replaced.text,'LOCAL-R');
}

// When both sides changed, Smart merge offers the clean three-way merge.
{
  const harness=createController();
  const promise=harness.controller.resolve({conflicts:[conflict('Both','LOCAL-AUTO','REMOTE-AUTO',{ancestorAvailable:true,ancestorValue:'SAFE-BASE'})],incomingAssets:[]});
  await tick();await tick();
  const dialog=harness.document.body.children[0];
  assert.ok(dialog,'both sides changed: the review must open');
  byText(dialog,'Smart merge').dispatch('click');
  assert.equal(harness.mounts[0].field.value,'LOCAL-AUTO|THREEWAY|REMOTE-AUTO');
  byText(dialog,'Apply resolved note').dispatch('click');
  assert.equal((await promise).notes.Both.text,'LOCAL-AUTO|THREEWAY|REMOTE-AUTO');
}

// An unsafe three-way proposal is shown in the left working copy only when the
// user asks for Smart merge; the imported side remains a reference.
{
  const harness=createController();
  const promise=harness.controller.resolve({conflicts:[conflict('Unsafe','LOCAL-U','REMOTE-U',{ancestorAvailable:true,ancestorValue:'UNSAFE-BASE'})],incomingAssets:[]});
  await tick();await tick();
  const dialog=harness.document.body.children[0];
  byText(dialog,'Smart merge').dispatch('click');
  assert.equal(harness.mounts[0].field.value,'LOCAL-U|THREEWAY|REMOTE-U','Smart merge must use the ancestor-aware proposal when available');
  byText(dialog,'Keep local').dispatch('click');
  assert.equal(harness.mounts[0].field.value,'LOCAL-U','Keep local must always restore the original local copy');
  byText(dialog,'Apply resolved note').dispatch('click');
  const result=await promise;
  assert.equal(result.notes.Unsafe.text,'LOCAL-U');
}


// Preview assets are read-only and source-aware: the local pane prefers canonical
// bytes while the imported pane prefers the verified checkpoint bytes. Merely
// opening/cancelling reconciliation never publishes either copy.
{
  const localBlob=new Blob(['local'],{type:'image/png'}),incomingBlob=new Blob(['incoming'],{type:'image/png'}),assetId='img-previewabcdefghijklmnop';
  let localReads=0;
  const harness=createController({assetGet:async id=>{localReads++;return id===assetId?localBlob:null;}});
  const promise=harness.controller.resolve({conflicts:[conflict('Assets','LOCAL-A','REMOTE-A')],incomingAssets:[freeze({assetId,blob:incomingBlob})]});
  await tick();await tick();
  assert.equal(harness.mounts.length,2);
  assert.equal(await harness.mounts[0].assets.get(assetId),localBlob,'resolved/local scratch store must prefer canonical bytes');
  assert.equal(await harness.mounts[1].assets.get(assetId),incomingBlob,'imported scratch store must prefer checkpoint bytes');
  await assert.rejects(()=>harness.mounts[0].assets.put(assetId,incomingBlob),/cannot be added/i);
  await assert.rejects(()=>harness.mounts[1].assets.remove(assetId),/cannot be removed/i);
  assert.equal(localReads,1,'incoming checkpoint preview must not need a canonical read when checkpoint bytes are present');
  await harness.controller.cancel();assert.equal(await promise,null);
}

// Explicit cancel returns no decisions and tears down the scratch editors.
{
  const harness=createController();
  const promise=harness.controller.resolve({conflicts:[conflict('History','LOCAL-H','REMOTE-H')],incomingAssets:[]});
  await tick();await tick();
  assert.equal(await harness.controller.cancel(),undefined);
  assert.equal(await promise,null);
  assert.equal(harness.document.body.children.length,0);
  assert.equal(harness.destroyed.length,2);
}

// A close during asynchronous editor mounting must destroy late handles instead of leaking a stale editor.
{
  const pending=[];const destroyed=[];const mounts=[];
  const deferredMount=options=>{mounts.push(options);return new Promise(resolve=>pending.push(()=>resolve(freeze({
    getValue:()=>options.field.value,
    setValue:value=>{options.field.value=String(value);return true;},
    setTransientRanges:()=>false,focus:()=>false,destroy:async()=>{destroyed.push(options.field);}
  }))));};
  const harness=createController({mount:deferredMount});
  const promise=harness.controller.resolve({conflicts:[conflict('Geography','LOCAL-G','REMOTE-G')],incomingAssets:[]});
  await tick();
  assert.equal(mounts.length,2,'both editor mounts have started');
  const cancelPromise=harness.controller.cancel();
  for(const release of pending)release();
  await cancelPromise;assert.equal(await promise,null);
  await tick();
  assert.equal(destroyed.length,2,'late-mounted handles are destroyed after cancellation');
  assert.equal(harness.document.body.children.length,0,'cancelled dialog cannot be resurrected by late mounts');
}

// Initial and later transition failures retain the successful sibling and offer a real retry.
for(const failureAt of [1,2,4]){
  const harness=createController({failMount:number=>number===failureAt});
  const promise=harness.controller.resolve({conflicts:[conflict('One','LOCAL-1','REMOTE-1'),conflict('Two','LOCAL-2','REMOTE-2')]});
  await tick();await tick();const dialog=harness.document.body.children[0];
  if(failureAt===4){
    harness.mounts[0].field.value='UNSAVED SCRATCH';harness.mounts[0].field.oninput?.();
    byText(dialog,'Next →').dispatch('click');await tick();await tick();
  }
  assert.equal(byText(dialog,'Retry editors').hidden,false,'failed mount remains actionable');
  assert.equal(byText(dialog,'Apply resolved note').disabled,true,'a missing comparison pane cannot be applied');
  assert.equal(harness.destroyed.length,failureAt===4?3:1,'all successfully acquired handles are released after the failure');
  byText(dialog,'Retry editors').dispatch('click');await tick();await tick();
  assert.equal(byText(dialog,'Retry editors').hidden,true);
  assert.equal(byText(dialog,'Apply resolved note').disabled,false);
  if(failureAt===4){
    byText(dialog,'← Previous').dispatch('click');await tick();await tick();
    assert.equal(harness.mounts.at(-2).field.value,'UNSAVED SCRATCH','failed navigation preserves earlier working text');
  }
  await harness.controller.cancel();assert.equal(await promise,null);
  assert.equal(harness.destroyed.length,harness.mounts.length-1,'each successful mount is destroyed exactly once');
}
// A destroy failure must not skip the other editor, and close restores the original trigger.
{
  const harness=createController({failDestroy:number=>number===1});
  const trigger=harness.document.createElement('button');harness.document.body.append(trigger);trigger.focus();
  const promise=harness.controller.resolve({conflicts:[conflict('Destroy','LOCAL','REMOTE')]});await tick();await tick();
  const dialog=harness.document.body.children[1];byText(dialog,'Cancel').focus();
  await harness.controller.cancel();assert.equal(await promise,null);
  assert.equal(harness.destroyed.length,2);assert.equal(harness.document.activeElement,trigger);
}
// Cancel must settle while a sibling mount is still pending, and release both early and late handles.
{
  const pending=[],destroyed=[];
  const harness=createController({mount:options=>new Promise(resolve=>pending.push(()=>resolve(freeze({getValue:()=>options.field.value,setValue:()=>true,setTransientRanges:()=>{},destroy:async()=>{destroyed.push(options.field);}}))))});
  const promise=harness.controller.resolve({conflicts:[conflict('Pending','LOCAL','REMOTE')]});await tick();
  pending[0]();await tick();await harness.controller.cancel();
  assert.equal(await Promise.race([promise,tick().then(()=> 'still-pending')]),null,'cancel cannot wait for an unfinished editor mount');
  assert.equal(destroyed.length,1,'already mounted sibling is released without waiting');
  pending[1]();await tick();assert.equal(destroyed.length,2,'late sibling is released once');
}

console.log(JSON.stringify({status:'PASS',suite:'reconciliation-ui-runtime',checks:70,coverage:['editable resolved editor','read-only imported editor','Smart merge fallback','safe three-way silent resolution','unsafe three-way proposal','manual custom editing','Diary manual-only reconciliation','Keep local reset','Use imported','Apply navigation','transient ranges','checkpoint-backed read-only AssetStore','cancel cleanup','late-mount cancellation','zero persistence port']},null,2));
