import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

// Interaction controller contract: fallback decisions, validation/configuration, and deterministic history ownership.

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
for(const file of ['source/core/internal.js','source/core/interactions.js'])vm.runInThisContext(read(file),{filename:file});
const notificationPort=Object.freeze({notify:()=>'',subscribe:()=>()=>{},dismissEvent:()=>false,dismissAll:()=>0,pauseEvent:()=>false,setPaused:()=>false,setHidden:()=>{}});
const interactions=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('interactions',1);

{ // interaction-guidance-module
const freeze=Object.freeze;
const promptValues=['Topic name','bad','2','2','2','1','2'];
const confirmMessages=[];
const promptMessages=[];
const controller=interactions.createController(freeze({ports:freeze({
  notifications:notificationPort,
  environment:freeze({
    clearTimeout:()=>false,
    document:freeze({getElementById:()=>null}),
    nativeConfirm:message=>{confirmMessages.push(String(message));return !String(message).includes('invalid');},
    nativePrompt:(message,defaultValue)=>{promptMessages.push({message:String(message),defaultValue});return promptValues.shift()??null;},
    requestAnimationFrame:callback=>{callback();return 1;},
    setTimeout:callback=>{callback();return 1;},
    window:freeze({})
  }),
  diagnostics:freeze({capture:()=>false}),
  history:freeze({opened:()=>true,requestClose:()=>false,closed:()=>true})
})}));

assert.ok(Object.isFrozen(controller));
assert.equal(controller.format,'study-director.interactions');
assert.equal(await controller.confirm({title:'Delete saved day?',message:'This cannot be undone.'}),true);
assert.match(confirmMessages[0],/Delete saved day\?[\s\S]*This cannot be undone/);

assert.deepEqual(await controller.input({
  title:'New note',defaultOption:'top',defaultValue:'',
  validate:value=>value.trim()?'':'invalid value'
}),{value:'Topic name',option:'top'});

assert.equal(await controller.input({
  title:'Protected action',defaultOption:'',validate:()=> 'invalid safeguard'
}),null);
assert.match(confirmMessages.at(-1),/invalid safeguard/);

assert.equal(await controller.choose({
  title:'Same-date records',choices:[
    {value:'keep',label:'Keep local copies'},
    {value:'replace',label:'Use backup copies'}
  ]
}),'replace');
assert.match(promptMessages.at(-1).message,/1\. Keep local copies[\s\S]*2\. Use backup copies/);
assert.deepEqual(await controller.configure({
  title:'Restore this verified backup?',message:'Choose once, then restore.',groups:[{
    id:'dailyRecords',label:'Same-date saved days',defaultValue:'keep',choices:[
      {value:'keep',label:'Keep local copies'},
      {value:'replace',label:'Use backup copies'}
    ]
  }]
}),{dailyRecords:'replace'});
assert.match(confirmMessages.at(-1),/Restore this verified backup\?[\s\S]*Choose once, then restore/u);
// Invalid machine identities fail before rendering rather than being silently shortened or merged.
const group=id=>({id,label:id,choices:[{value:'keep',label:'Keep'},{value:'delete',label:'Delete'}]});
await assert.rejects(controller.configure({groups:[group('same'),group('same')]}),/unique/);
await assert.rejects(controller.configure({groups:[group('x'.repeat(81))]}),/80 characters/);
await assert.rejects(controller.configure({groups:[group('group')],checkboxes:[{id:'group',label:'Collision'}]}),/unique/);
await assert.rejects(controller.configure({groups:[group('__proto__')]}),/unique/);

const bulkStart=promptMessages.length;
assert.deepEqual(await controller.configure({
  title:'Different Saved Days found',message:'Choose a starting point, then review any day.',groups:[
    {id:'savedDaysBulk',label:'Saved-Day conflicts · 2 days',defaultValue:'review',choices:[
      {value:'local',label:'Use this device for all',applyValues:{dayA:'localA',dayB:'localB'}},
      {value:'incoming',label:'Use backup for all',applyValues:{dayA:'remoteA',dayB:'remoteB'}},
      {value:'review',label:'Review individually',applyValues:{dayA:'localA',dayB:'localB'}}
    ]},
    {id:'dayA',label:'Saved Day · A',defaultValue:'localA',choices:[{value:'localA',label:'This device'},{value:'remoteA',label:'Backup'}]},
    {id:'dayB',label:'Saved Day · B',defaultValue:'localB',choices:[{value:'localB',label:'This device'},{value:'remoteB',label:'Backup'}]}
  ]
}),{savedDaysBulk:'incoming',dayA:'localA',dayB:'remoteB'},'Bulk defaults must remain individually overridable before confirmation.');
const bulkPrompts=promptMessages.slice(bulkStart);
assert.deepEqual(bulkPrompts.map(row=>row.defaultValue),['3','2','2'],'Fallback configuration must carry the bulk choice into each per-item default.');
const checkboxResult=await controller.configure({
  title:'Apply recovery choices',message:'Optional safety download.',groups:[],checkboxes:[{id:'safetyCopy',label:'Download an extra standalone safety copy before applying',description:'Automatic rollback protection remains active.',defaultChecked:false}]
});
assert.deepEqual(checkboxResult,{safetyCopy:true},'Fallback configure must preserve compact checkbox decisions.');
assert.match(confirmMessages.at(-1),/Download an extra standalone safety copy before applying/u);
assert.equal(controller.notify({title:'No DOM'}),'');
assert.equal(controller.dismiss(),false);

assert.throws(()=>interactions.createController({ports:{}}),/Interaction input/);
console.log(JSON.stringify({
  status:'PASS',suite:'interaction-guidance-module',fallbackSafe:true,typedValidation:true,choiceFallback:true,configurationFallback:true,checkboxConfiguration:true,bulkDefaultsWithOverrides:true
},null,2));
}

{ // interaction-history
class FakeClassList{
  constructor(){this.values=new Set();}
  add(...values){values.forEach(value=>this.values.add(value));}
  toggle(value,force){if(force===undefined)force=!this.values.has(value);if(force)this.values.add(value);else this.values.delete(value);return force;}
}
class FakeElement{
  constructor(tag,document){this.tagName=String(tag).toUpperCase();this.ownerDocument=document;this.children=[];this.parentNode=null;this.attributes=new Map();this.classList=new FakeClassList();this.className='';this.dataset={};this.hidden=false;this.value='';this.type='';this.textContent='';this.open=false;this.listeners=new Map();}
  appendChild(node){node.parentNode=this;this.children.push(node);return node;}
  append(...nodes){nodes.forEach(node=>this.appendChild(node));}
  replaceChildren(...nodes){this.children.forEach(node=>{node.parentNode=null;});this.children=[];this.append(...nodes);}
  setAttribute(name,value){this.attributes.set(name,String(value));if(name==='id')this.id=String(value);}
  getAttribute(name){return this.attributes.get(name)??null;}
  removeAttribute(name){this.attributes.delete(name);}
  addEventListener(type,handler){const list=this.listeners.get(type)||[];list.push(handler);this.listeners.set(type,list);}
  cloneNode(){const node=new FakeElement(this.tagName,this.ownerDocument);node.type=this.type;node.value=this.value;return node;}
  focus(){this.ownerDocument.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  querySelectorAll(selector){
    const out=[];
    const visit=node=>{for(const child of node.children){if(selector==='input[type="password"]'&&child.tagName==='INPUT'&&child.type==='password')out.push(child);visit(child);}};
    visit(this);return out;
  }
}

function findDescendant(root,predicate){
  for(const child of root.children){if(predicate(child))return child;const nested=findDescendant(child,predicate);if(nested)return nested;}
  return null;
}

class FakeDocument{
  constructor(){this.activeElement=null;this.dialog=new FakeElement('dialog',this);this.dialog.id='sd-interaction-dialog';}
  createElement(tag){return new FakeElement(tag,this);}
  getElementById(id){return id==='sd-interaction-dialog'?this.dialog:null;}
  contains(target){if(target===this.dialog)return true;let found=false;const visit=node=>{for(const child of node.children){if(child===target){found=true;return;}visit(child);}};visit(this.dialog);return found;}
}

const freeze=Object.freeze,document=new FakeDocument(),events=[];
let closeOwned=true;
const controller=interactions.createController(freeze({ports:freeze({
  notifications:notificationPort,
  environment:freeze({
    clearTimeout:()=>false,document,nativeConfirm:()=>false,nativePrompt:()=>null,
    requestAnimationFrame:callback=>{callback();return 1;},setTimeout:callback=>{callback();return 1;},window:freeze({})
  }),
  diagnostics:freeze({capture:()=>false}),
  history:freeze({
    opened:(descriptor,options)=>{events.push({type:'opened',descriptor,options});return true;},
    requestClose:descriptor=>{events.push({type:'request-close',descriptor});return closeOwned;},
    closed:(descriptor,meta)=>{events.push({type:'closed',descriptor,meta});return true;}
  })
})}));

const firstPromise=controller.confirm({title:'Confirm?',message:'History-owned prompt'});
const firstDescriptor=controller.historyDescriptor();
assert.equal(firstDescriptor.kind,'prompt');
assert.match(firstDescriptor.token,/^prompt:/);
assert.equal(events.filter(event=>event.type==='opened').length,1);
assert.equal(controller.reconcileHistory(null),null,'Back traversal dismisses the active prompt');
assert.equal(await firstPromise,false);
assert.equal(events.filter(event=>event.type==='request-close').length,0,'history traversal dismissal must not navigate again');
const firstClosed=events.find(event=>event.type==='closed'&&event.descriptor.token===firstDescriptor.token);
assert.equal(firstClosed.meta.fromHistory,true);
const openedCount=events.filter(event=>event.type==='opened').length;
assert.equal(controller.reconcileHistory(firstDescriptor),null,'expired Forward prompt token never recreates a prompt');
assert.equal(events.filter(event=>event.type==='opened').length,openedCount);
assert.equal(document.dialog.open,false);

const explicitPromise=controller.confirm({title:'Close me'});
const explicitDescriptor=controller.historyDescriptor();
assert.equal(controller.dismiss(),true);
await Promise.resolve();
assert.deepEqual(controller.historyDescriptor(),explicitDescriptor,'explicit close remains lifecycle-owned while Back traversal is pending');
controller.reconcileHistory(null);
assert.equal(await explicitPromise,false);
assert.ok(events.some(event=>event.type==='request-close'&&event.descriptor.token===explicitDescriptor.token));
const explicitClosed=events.find(event=>event.type==='closed'&&event.descriptor.token===explicitDescriptor.token);
assert.equal(explicitClosed.meta.historyPending,true,'explicit close consumes its owned history entry when possible');

const sequentialFirst=controller.choose({title:'Backup encryption',choices:[{label:'Turn off encryption',value:'disable'}]});
const sequentialDescriptor=controller.historyDescriptor();
let sequentialSettled=false;
sequentialFirst.then(()=>{sequentialSettled=true;});
const disableChoice=findDescendant(document.dialog,node=>node.classList.values.has('interaction-choice'));
assert.ok(disableChoice,'sequential choice action should render');
disableChoice.listeners.get('click')[0]();
await Promise.resolve();
assert.equal(sequentialSettled,false,'history-owned choice must not resolve before its Back traversal reconciles');
assert.deepEqual(controller.historyDescriptor(),sequentialDescriptor,'closing prompt remains lifecycle-owned until traversal settlement');
controller.reconcileHistory(null);
assert.equal(await sequentialFirst,'disable');
const sequentialSecond=controller.confirm({title:'Turn off backup encryption?'});
const sequentialSecondDescriptor=controller.historyDescriptor();
assert.ok(sequentialSecondDescriptor&&sequentialSecondDescriptor.token!==sequentialDescriptor.token,'follow-up confirmation opens only after prior traversal settles');
assert.equal(document.dialog.open,true,'follow-up confirmation remains actionable');
closeOwned=false;
assert.equal(controller.dismiss(),true);
assert.equal(await sequentialSecond,false);

closeOwned=false;
const passwordPromise=controller.input({title:'Protected action',inputType:'password',defaultValue:'secret'});
const passwordDescriptor=controller.historyDescriptor();
const passwordField=document.dialog.querySelectorAll('input[type="password"]')[0];
assert.ok(passwordField);assert.equal(passwordField.value,'secret');
controller.reconcileHistory(null);
assert.equal((await passwordPromise),null);
assert.equal(passwordField.value,'','Back cancellation clears password material immediately');
assert.equal(controller.reconcileHistory(passwordDescriptor),null,'expired password prompt cannot replay');

console.log(JSON.stringify({status:'PASS',suite:'interaction-history',checks:['Back cancels once','Forward expires','explicit close consumes marker','sequential prompt traversal settlement','password cleared']},null,2));
}
