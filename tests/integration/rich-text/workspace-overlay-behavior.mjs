import {readRuntimeSource} from '../../helpers/runtime-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class FakeElement {
  constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.className='';this.dataset={};this.attributes=new Map();this.children=[];this.parentNode=null;this.style={};this.open=false;this.isConnected=false;this.listeners=new Map();this.textContent='';this.id='';}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  append(...nodes){for(const node of nodes){if(node.parentNode)node.remove();node.parentNode=this;node.isConnected=this.isConnected;this.children.push(node);node._setConnected?.(this.isConnected);}}
  _setConnected(value){this.isConnected=value;for(const child of this.children)child._setConnected?.(value);}
  addEventListener(type,fn){let list=this.listeners.get(type);if(!list)this.listeners.set(type,list=[]);list.push(fn);}
  removeEventListener(type,fn){const list=this.listeners.get(type)||[];this.listeners.set(type,list.filter(item=>item!==fn));}
  dispatchEvent(event){event.target??=this;for(const fn of [...(this.listeners.get(event.type)||[])])fn(event);return true;}
  remove(){if(this.parentNode){const i=this.parentNode.children.indexOf(this);if(i>=0)this.parentNode.children.splice(i,1);}this.parentNode=null;this._setConnected(false);}
  close(){this.open=false;}
  showModal(){if(this.ownerDocument.failNextDialog){this.ownerDocument.failNextDialog=false;throw new Error('showModal failed');}this.open=true;}
  focus(){this.ownerDocument.activeElement=this;}
}

class FakeDocument {
  constructor({reducedMotion=true}={}){this.failNextDialog=false;this.body=new FakeElement('body',this);this.body.style={overflow:'auto'};this.body._setConnected(true);this.activeElement=null;this.defaultView={matchMedia:()=>({matches:reducedMotion}),requestAnimationFrame:callback=>{callback();return 1;}};}
  createElement(tag){return new FakeElement(tag,this);}
}

globalThis.HTMLElement=FakeElement;
const key=Symbol.for('studyDirector.internalModules.v1');
vm.runInThisContext(readRuntimeSource('source/core/internal.ts'),{filename:'source/core/internal.ts'});
vm.runInThisContext(readRuntimeSource('source/core/workspace-overlay.ts'),{filename:'source/core/workspace-overlay.ts'});
const module=globalThis[key].require('workspace-overlay',1);

const document=new FakeDocument();
const historyEvents=[];
const historyPort=Object.freeze({
  opened:(descriptor,options)=>{historyEvents.push({type:'opened',descriptor,options});return true;},
  requestClose:descriptor=>{historyEvents.push({type:'request-close',descriptor});return false;},
  closed:(descriptor,meta)=>{historyEvents.push({type:'closed',descriptor,meta});return true;}
});
const controller=module.createController(Object.freeze({ports:Object.freeze({environment:Object.freeze({document}),history:historyPort})}));

const focusOrigin=new FakeElement('button',document);document.body.append(focusOrigin);focusOrigin.focus();
const first=controller.open({label:'Focus',content:new FakeElement('div',document)});
assert.ok(first?.dialog.open,'first workspace should open');
assert.equal(document.body.style.overflow,'hidden');

const focusInside=new FakeElement('button',document);first.dialog.append(focusInside);focusInside.focus();
const second=controller.open({label:'PDF',content:new FakeElement('div',document)});
assert.ok(second?.dialog.open,'child workspace should open above Focus Mode');
assert.equal(first.dialog.open,true,'opening PDF must leave Focus Mode open');
assert.equal(controller.close(),true,'close() should close the top workspace');
assert.equal(second.dialog.open,false);
assert.equal(first.dialog.open,true,'closing PDF must reveal the still-open Focus Mode');
assert.equal(document.body.style.overflow,'hidden','scroll lock must remain while Focus Mode stays open');
assert.equal(document.activeElement,focusInside,'focus should return into the underlying workspace');
assert.equal(controller.close(),true);
assert.equal(first.dialog.open,false);
assert.equal(document.body.style.overflow,'auto','original body overflow must return after final workspace closes');
assert.equal(document.activeElement,focusOrigin,'focus should return to the original Focus Mode trigger');

const stable=controller.open({label:'Focus 2',content:new FakeElement('div',document)});
document.failNextDialog=true;
const beforeChildren=document.body.children.length;
assert.throws(()=>controller.open({label:'Broken PDF',content:new FakeElement('div',document)}),/showModal failed/);
assert.equal(document.body.children.length,beforeChildren,'failed child dialog must not leak DOM');
assert.equal(stable.dialog.open,true,'failed child dialog must not disturb the underlying workspace');
assert.equal(document.body.style.overflow,'hidden');
assert.equal(controller.close(),true);
assert.equal(document.body.style.overflow,'auto');
assert.equal(controller.close(),false,'stack must be empty after final close');


// History replay is token-bound and nested workspaces restore through their live parent.
let focusReplayHandle=null,pdfReplayHandle=null,pdfCleanup=0;
const openReplayFocus=descriptor=>{
  focusReplayHandle=controller.open({
    label:'Replay Focus',content:new FakeElement('div',document),
    history:{kind:'focus',token:descriptor?.token,valid:()=>true,reopen:next=>{openReplayFocus(next);return true;}}
  });
  return true;
};
const openReplayPdf=descriptor=>{
  pdfReplayHandle=controller.open({
    label:'Replay PDF',content:new FakeElement('div',document),onAfterClose:()=>{pdfCleanup+=1;},
    history:{kind:'pdf',key:'attachment-1',token:descriptor?.token,valid:()=>true,reopen:next=>{openReplayPdf(next);return true;}}
  });
  return true;
};
openReplayFocus();
const focusDescriptor=controller.historyDescriptor();
assert.equal(focusDescriptor.kind,'focus');
assert.ok(historyEvents.some(event=>event.type==='opened'&&event.descriptor.token===focusDescriptor.token));
openReplayPdf();
const pdfDescriptor=controller.historyDescriptor();
assert.equal(pdfDescriptor.kind,'pdf');assert.equal(pdfDescriptor.key,'attachment-1');
assert.equal(controller.close(),true);assert.equal(pdfCleanup,1,'reader cleanup runs exactly once when the PDF instance closes');
assert.equal(controller.historyDescriptor().token,focusDescriptor.token,'closing child workspace reveals the same live parent');
assert.deepEqual(await controller.reconcile(pdfDescriptor),pdfDescriptor,'Forward replay reopens the child while the parent remains live');
assert.equal(controller.historyDescriptor().token,pdfDescriptor.token);
assert.deepEqual(await controller.reconcile(focusDescriptor),focusDescriptor,'Back reconciliation returns to the existing parent instance');
assert.equal(pdfCleanup,2,'replayed PDF reader is released exactly once when traversal closes it');
assert.equal(controller.historyDescriptor().token,focusDescriptor.token);
assert.equal(controller.close(),true);assert.equal(controller.historyDescriptor(),null);
assert.deepEqual(await controller.reconcile(focusDescriptor),focusDescriptor,'Forward can reopen a still-valid Focus workspace token');
assert.equal(controller.historyDescriptor().token,focusDescriptor.token);
assert.equal(controller.close(),true);


// Non-reduced-motion close/replay keeps the closing instance lifecycle-owned.
// Rapid Forward must wait for physical exit finalization rather than opening a
// duplicate dialog or recapturing the already-locked body overflow value.
const animatedDocument=new FakeDocument({reducedMotion:false});
const animatedEvents=[];
const animatedHistory=Object.freeze({
  opened:(descriptor,options)=>{animatedEvents.push({type:'opened',descriptor,options});return true;},
  requestClose:descriptor=>{animatedEvents.push({type:'request-close',descriptor});return false;},
  closed:(descriptor,meta)=>{animatedEvents.push({type:'closed',descriptor,meta});return true;}
});
const animatedController=module.createController(Object.freeze({ports:Object.freeze({environment:Object.freeze({document:animatedDocument}),history:animatedHistory})}));
let animatedHandle=null;
const openAnimated=descriptor=>{
  animatedHandle=animatedController.open({
    label:'Animated Focus',content:new FakeElement('div',animatedDocument),
    history:{kind:'focus',token:descriptor?.token,valid:()=>true,reopen:next=>openAnimated(next)}
  });
  return !!animatedHandle;
};
openAnimated();
const animatedDescriptor=animatedController.historyDescriptor();
const closingHandle=animatedHandle;
assert.equal(animatedDocument.body.style.overflow,'hidden');
assert.equal(animatedController.close(),true);
assert.equal(animatedController.historyDescriptor(),null,'logical workspace should close immediately for history');
const replayPromise=animatedController.reconcile(animatedDescriptor);
await Promise.resolve();
assert.equal(animatedDocument.body.children.filter(node=>node.tagName==='DIALOG').length,1,'rapid Forward must not create a second dialog before exit finalizes');
assert.equal(animatedDocument.body.style.overflow,'hidden','body remains locked while the closing dialog is physically alive');
closingHandle.dialog.dispatchEvent({type:'transitionend'});
await closingHandle.whenClosed;
assert.deepEqual(await replayPromise,animatedDescriptor,'Forward reopens only after the previous physical dialog finalizes');
assert.equal(animatedDocument.body.children.filter(node=>node.tagName==='DIALOG').length,1,'replay should own exactly one live dialog');
assert.equal(animatedDocument.body.style.overflow,'hidden','reopened workspace keeps body scroll locked');
const replayedHandle=animatedHandle;
assert.equal(animatedController.close(),true);
replayedHandle.dialog.dispatchEvent({type:'transitionend'});
await replayedHandle.whenClosed;
assert.equal(animatedDocument.body.children.filter(node=>node.tagName==='DIALOG').length,0);
assert.equal(animatedDocument.body.style.overflow,'auto','original body overflow must restore after animated close/reopen cycle');

// The real overlay loop must stop closing the stack after its originating
// route or a newer user workspace supersedes a yielded close.
{
  const parent=animatedController.open({label:'Parent',content:new FakeElement('div',animatedDocument),history:{kind:'focus'}});
  const child=animatedController.open({label:'Child',content:new FakeElement('div',animatedDocument),history:{kind:'pdf'}});
  const closing=animatedController.reconcile(null);
  const newer=animatedController.open({label:'Newer',content:new FakeElement('div',animatedDocument),history:{kind:'audio'}});
  child.dialog.dispatchEvent({type:'transitionend'});await closing;
  assert.equal(newer.dialog.open,true);assert.equal(parent.dialog.open,true);
  assert.equal(animatedController.historyDescriptor().token,newer.historyToken);
  for(const handle of [newer,parent]){handle.close();handle.dialog.dispatchEvent({type:'transitionend'});await handle.whenClosed;}
  assert.equal(animatedDocument.body.style.overflow,'auto');
}
// An in-flight token replay gets a current predicate and cannot open after a
// successor, including a newer reconcile of the same token.
for(const successor of ['clear','same-token','forget','new-workspace']){
  let resolve,enteredResolve,first=true,reopens=0;
  const entered=new Promise(r=>enteredResolve=r),gate=new Promise(r=>resolve=r);
  const openReplay=token=>controller.open({label:'Deferred reader',content:new FakeElement('div',document),history:{kind:'pdf',token,
    reopen:async(descriptor,current)=>{if(first){first=false;enteredResolve();await gate;}if(!current())return false;reopens++;return !!openReplay(descriptor.token);}}});
  const initial=openReplay(),descriptor=controller.historyDescriptor();initial.close();
  const stale=controller.reconcile(descriptor);await entered;
  let expected=null;
  if(successor==='clear')await controller.reconcile(null);
  if(successor==='same-token'){await controller.reconcile(descriptor);expected=descriptor.token;}
  if(successor==='forget')initial.forget();
  if(successor==='new-workspace')expected=controller.open({label:'Newer',content:new FakeElement('div',document),history:{kind:'focus'}}).historyToken;
  resolve();await stale;
  assert.equal(controller.historyDescriptor()?.token??null,expected);
  assert.equal(reopens,successor==='same-token'?1:0);
  await controller.reconcile(null);assert.equal(document.body.style.overflow,'auto');
}

console.log(JSON.stringify({status:'PASS',suite:'workspace-overlay-behavior',checks:['nested workspace stack','top-only close','scroll-lock lifetime','focus restoration','showModal rollback','token replay','nested Forward restore','single cleanup','animated close/Forward serialization','animated scroll-lock restoration']},null,2));
