import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readRuntimeSource} from '../../helpers/runtime-source.mjs';

// Drive the actual host factory through a deferred asset lease. The Execute
// textarea can be rebound to a different note without replacing the DOM node.
class FakeElement {
  constructor(){this.dataset={};this.style={};this.children=[];this.attributes=new Map();this.isConnected=true;this.hidden=false;}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  removeAttribute(name){this.attributes.delete(name);}
  append(...children){this.children.push(...children);}
  addEventListener(){}
  remove(){this.isConnected=false;}
}
class FakeField extends FakeElement {
  constructor(){super();this.value='Original A';this.dataset.areaKey='a';this.errors=[];}
  matches(selector){return selector.includes('.task-note-field');}
  insertAdjacentElement(_position,node){this.errors.push(node);}
}
const context={HTMLTextAreaElement:FakeField,HTMLElement:FakeElement,console};
context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.ts','source/core/rich-text-host.ts'])vm.runInContext(readRuntimeSource(file),context,{filename:file});
const module=context[Symbol.for('studyDirector.internalModules.v1')].require('rich-text-host',1);
function fixture(){
  const field=new FakeField(),rejectors=[],resolvers=[],diagnostics=[],mountCalls=[];let releases=0;
  let descriptor={documentId:'area:a',label:'A',initialValue:'Original A',maxWords:100};
  const runtime=module.createRuntime({
    configuration:{maxRichTextBytes:1000},
    document:{createElement:()=>new FakeElement()},window:{},
    richText:{storagePrefix:'WG1:',isRichTextValue:value=>String(value).startsWith('WG1:'),mountRichTextEditor:async options=>{mountCalls.push(options);return {focus(){},flush(){},destroy:async()=>{}};}},
    assets:{retain:()=>new Promise((resolve,reject)=>{resolvers.push(()=>resolve(()=>{releases++;}));rejectors.push(reject);})},
    attachments:{port:()=>({})},notes:{normalizeArea:value=>String(value||''),links:()=>({})},review:{},session:{},activation:{},
    view:{documentFor:()=>descriptor,plain:value=>String(value),applyOwnership(){}},
    diagnostics:{capture:(scope,error)=>diagnostics.push({scope,error})}
  });
  return {field,runtime,rejectors,resolvers,diagnostics,mountCalls,get releases(){return releases;},change(id,value){descriptor={...descriptor,documentId:id,initialValue:value};field.dataset.areaKey=id.slice(5);field.value=value;},retire(){descriptor=null;}};
}
{
  const f=fixture(),old=f.runtime.activate(f.field);
  assert.equal(f.runtime.status().pending,true);
  assert.equal(f.runtime.closeField(f.field),true);
  f.change('area:b','New B');
  f.rejectors[0](new Error('Retired lease failed'));
  assert.equal(await old,false);
  assert.equal(f.field.value,'New B','Retired failure cannot replace rebound note text');
  assert.equal(f.field.dataset.richMountFailed,undefined);
  assert.equal(f.field.errors.length,0);
  assert.equal(f.diagnostics.length,1);
  assert.equal(f.mountCalls.length,0);
}
{
  const f=fixture(),old=f.runtime.activate(f.field);
  f.runtime.closeField(f.field);f.change('area:b','New B');
  const newer=f.runtime.activate(f.field);
  f.rejectors[0](new Error('Old request failed'));
  assert.equal(await old,false);
  assert.equal(f.runtime.status().pending,true,'Retired failure cannot retire newer request');
  assert.equal(f.field.errors.length,0);
  f.rejectors[1](new Error('Current request failed'));
  assert.equal(await newer,false);
  assert.equal(f.field.dataset.richMountFailed,'area:b');
  assert.equal(f.field.value,'New B');
  assert.equal(f.field.errors.length,1);
  assert.equal(f.runtime.status().pending,false);
}
{
  const f=fixture(),operation=f.runtime.activate(f.field);
  f.change('area:a','Newer canonical A');
  f.rejectors[0](new Error('Current request failed'));
  assert.equal(await operation,false);
  assert.equal(f.field.dataset.richMountFailed,'area:a');
  assert.equal(f.field.value,'Newer canonical A','Plain fallback must use current canonical text');
  assert.equal(f.field.errors.length,1);
  assert.equal(f.runtime.status().pending,false);
}
{
  const f=fixture(),operation=f.runtime.activate(f.field);
  f.field.isConnected=false;
  f.rejectors[0](new Error('Detached field lease failed'));
  assert.equal(await operation,false);
  assert.equal(f.field.errors.length,0);
  assert.equal(f.runtime.status().pending,false);
}
// A successful delayed lease also needs fresh document authority and canonical content.
{
  const f=fixture(),operation=f.runtime.activate(f.field);
  f.change('area:a','Newer canonical A');
  f.resolvers[0]();
  assert.equal(await operation,true);
  assert.equal(f.mountCalls.length,1);
  assert.equal(f.mountCalls[0].initialValue,'Newer canonical A','lease completion must not mount the old snapshot');
}
{
  const f=fixture(),operation=f.runtime.activate(f.field);
  f.change('area:b','New B');
  f.resolvers[0]();
  assert.equal(await operation,false);
  assert.equal(f.mountCalls.length,0,'a replaced binding cannot mount its old editor');
  assert.equal(f.field.value,'New B');
  assert.equal(f.releases,1);
  assert.equal(f.runtime.status().pending,false);
}
{
  const f=fixture(),operation=f.runtime.activate(f.field);
  f.retire();f.resolvers[0]();
  assert.equal(await operation,false,'lost write authority prevents mounting');
  assert.equal(f.mountCalls.length,0);
  assert.equal(f.releases,1);
  assert.equal(f.runtime.status().pending,false);
}
{
  const f=fixture(),operation=f.runtime.activate(f.field);
  f.field.isConnected=false;f.resolvers[0]();
  assert.equal(await operation,false);
  assert.equal(f.mountCalls.length,0);
  assert.equal(f.releases,1);
  assert.equal(f.runtime.status().pending,false,'detached successful lease cannot leave a pending mount');
}
console.log(JSON.stringify({status:'PASS',suite:'rich-text-editor-mount-lifetime',retiredFailure:true,newerRequest:true,currentCanonicalFallback:true,detachedFailure:true,currentLeaseCanonical:true,reboundLease:true,lostAuthorityLease:true,detachedLease:true}));
