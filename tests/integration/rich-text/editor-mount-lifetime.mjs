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
  matches(){return true;}
  insertAdjacentElement(_position,node){this.errors.push(node);}
}
const context={HTMLTextAreaElement:FakeField,HTMLElement:FakeElement,console};
context.globalThis=context;vm.createContext(context);
for(const file of ['source/core/internal.ts','source/core/rich-text-host.ts'])vm.runInContext(readRuntimeSource(file),context,{filename:file});
const module=context[Symbol.for('studyDirector.internalModules.v1')].require('rich-text-host',1);
function fixture(){
  const field=new FakeField(),rejectors=[],diagnostics=[],mountCalls=[];
  let descriptor={documentId:'area:a',label:'A',initialValue:'Original A',maxWords:100};
  const runtime=module.createRuntime({
    configuration:{maxRichTextBytes:1000},
    document:{createElement:()=>new FakeElement()},window:{},
    richText:{mountRichTextEditor:options=>{mountCalls.push(options);throw new Error('Unexpected mount after failed lease');}},
    assets:{retain:()=>new Promise((_resolve,reject)=>rejectors.push(reject))},
    attachments:{},notes:{},review:{},session:{},activation:{},
    view:{documentFor:()=>descriptor,plain:value=>String(value)},
    diagnostics:{capture:(scope,error)=>diagnostics.push({scope,error})}
  });
  return {field,runtime,rejectors,diagnostics,mountCalls,change(id,value){descriptor={...descriptor,documentId:id,initialValue:value};field.dataset.areaKey=id.slice(5);field.value=value;}};
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
console.log(JSON.stringify({status:'PASS',suite:'rich-text-editor-mount-lifetime',retiredFailure:true,newerRequest:true,currentCanonicalFallback:true,detachedFailure:true}));
