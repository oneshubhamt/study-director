import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// The notes the Library lists (core/note-catalogue.js): stored notes, today's
// Areas and the parents their paths name, in tree order with Support
// Activities first; rebuilt only when the notes or today's Areas change; and
// "Support Activities" reserved for the shared note.
vm.runInThisContext(fs.readFileSync('source/core/internal.js','utf8'),{filename:'source/core/internal.js'});
vm.runInThisContext(fs.readFileSync('source/core/note-catalogue.js','utf8'),{filename:'source/core/note-catalogue.js'});
const NoteCatalogueModule=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('note-catalogue',1);
const SUPPORT=Object.freeze({key:'__study_director_support_activities__',label:'Support Activities'});
const normalize=value=>String(value||'').split('>').map(part=>part.trim().replace(/\s+/g,' ')).filter(Boolean).join(' > ').toLowerCase();
const display=value=>String(value||'').split('>').map(part=>part.trim().replace(/\s+/g,' ')).filter(Boolean).join(' > ');
const parentKeys=key=>{const parts=String(key||'').split(' > ');return parts.slice(0,-1).map((_,index)=>parts.slice(0,index+1).join(' > '));};
function fixture(){
  const state={revision:1,records:[],areas:[],reads:0};
  const catalogue=NoteCatalogueModule.createCatalogue(Object.freeze({ports:Object.freeze({
    names:Object.freeze({normalize,display,clamp:value=>String(value).slice(0,160),parentKeys}),
    sources:Object.freeze({notes:()=>{state.reads++;return {revision:state.revision,records:state.records};},planAreas:()=>state.areas}),
    support:SUPPORT
  })}));
  return {state,catalogue};
}
const cases=[];
{
  const {state,catalogue}=fixture();
  state.records=[
    {id:'n_1',key:'gs2 > polity',label:'GS2 > Polity',hasNote:true,updatedAt:'2026-11-10T10:00:00.000Z'},
    {id:'n_2',key:'biology',label:'Biology',hasNote:false,updatedAt:'2026-11-11T10:00:00.000Z'},
    {id:'n_3',key:SUPPORT.key,label:SUPPORT.key,hasNote:true,updatedAt:''}
  ];
  state.areas=[{key:'chemistry',label:'Chemistry'},{key:'biology',label:'Biology'}];
  const entries=catalogue.entries();
  assert.deepEqual(entries.map(entry=>entry.key),[SUPPORT.key,'biology','chemistry','gs2','gs2 > polity'],'Support Activities first, then by name, children under parents');
  assert.equal(entries[0].label,'Support Activities','the shared note shows its name, not its key');
  const byKey=Object.fromEntries(entries.map(entry=>[entry.key,entry]));
  assert.deepEqual({id:byKey.gs2.id,hasNote:byKey.gs2.hasNote,depth:byKey.gs2.depth},{id:'',hasNote:false,depth:0},'a parent named only by a path has no note of its own');
  assert.equal(byKey['gs2 > polity'].depth,1);assert.equal(byKey.biology.current,true);assert.equal(byKey.biology.id,'n_2');
  assert.equal(byKey.chemistry.id,'','a plan Area with no note has no id');
  cases.push('stored notes, plan Areas and parents in tree order');
  assert.equal(catalogue.entries(),entries,'unchanged notes and Areas give the same list');
  state.revision=2;assert.notEqual(catalogue.entries(),entries,'a notes change rebuilds it');
  const before=catalogue.entries();state.areas=[...state.areas,{key:'physics',label:'Physics'}];assert.notEqual(catalogue.entries(),before,'an Areas change rebuilds it');
  cases.push('rebuilt only when the notes or today’s Areas change');
}
{
  const {catalogue}=fixture();
  assert.deepEqual({...catalogue.normalizeName('  GS2 >  Polity ')},{key:'gs2 > polity',label:'GS2 > Polity',reserved:false});
  assert.equal(catalogue.normalizeName('   '),null);
  for(const name of ['Support Activities','support activities > res'])assert.equal(catalogue.normalizeName(name).reserved,true,`${name} is reserved`);
  assert.equal(catalogue.normalizeName('GS2 > Support Activities').reserved,false,'only the start of a path is reserved');
  assert.equal(catalogue.reserved(SUPPORT.key),false,'the shared note itself is not refused');
  cases.push('names: normalised, and Support Activities reserved');
  const ordered=catalogue.order([{key:'b',label:'B',text:'x'},{key:'a > c',label:'A > C',ephemeral:true},{key:'a',label:'A'}]);
  assert.deepEqual(ordered.map(entry=>[entry.key,entry.hasNote,entry.ephemeral,entry.depth]),[['a',false,false,0],['a > c',false,true,1],['b',true,false,0]]);
  cases.push('order merges rows and nests them');
}
console.log(JSON.stringify({status:'PASS',suite:'note-catalogue',cases},null,2));
