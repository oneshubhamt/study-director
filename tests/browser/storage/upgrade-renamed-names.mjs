import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';
import {INDEXED_DB,OBSOLETE_INDEXED_DB} from '../../../contracts/canonical-identities.mjs';
import {LOCAL_STORAGE_KEYS,OBSOLETE_LOCAL_STORAGE_KEYS,APP_META_KEYS,RENAMED_APP_META_KEYS,RENAMED_VALUE_FORMATS} from '../../../contracts/data-architecture.mjs';

// The previous build kept notes in a store called areaNotes, named their
// deletion records areaNoteDeletion: and kept the emergency copy of unsaved
// notes under studyDirector.areaNoteRescue.v1. This test writes a library with
// the current build, rewrites it exactly as the previous build stored it, then
// opens the current build on it: every note, deletion and rescued edit must
// come through under the current names, with nothing left under the old ones.
const today=`const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');`;
const preload=`(()=>{${today}(localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));})();`;
const oldFormat=Object.fromEntries(Object.entries(RENAMED_VALUE_FORMATS).map(([from,to])=>[to,from]));
const names=JSON.stringify({
  db:INDEXED_DB.name,version:INDEXED_DB.version,notes:INDEXED_DB.stores.notes.name,oldNotes:OBSOLETE_INDEXED_DB.renamedStores.notes,
  deletion:APP_META_KEYS.noteDeletionPrefix,oldDeletion:RENAMED_APP_META_KEYS.noteDeletionPrefix.at(-1),
  rescue:LOCAL_STORAGE_KEYS.noteRescue,oldRescue:OBSOLETE_LOCAL_STORAGE_KEYS.noteRescueLegacy,oldFormat
});
const idb=`const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('aborted'));});
  const open=(version=0,upgrade=null)=>new Promise((resolve,reject)=>{const r=version?indexedDB.open(n.db,version):indexedDB.open(n.db);r.onupgradeneeded=()=>upgrade&&upgrade(r.result);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('blocked'));});`;
// Rewrites the database and browser storage as the previous build kept them.
const downgrade=`(async()=>{const n=${names};${idb}
  const db=await open();if(db.version!==n.version)throw new Error('unexpected version '+db.version);
  const dump={};
  for(const store of db.objectStoreNames){const tx=db.transaction(store,'readonly'),os=tx.objectStore(store);dump[store]={keyPath:os.keyPath,keys:await req(os.getAllKeys()),values:await req(os.getAll())};}
  db.close();
  await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase(n.db);r.onsuccess=resolve;r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('delete blocked'));});
  const notes=dump[n.notes].values,kept=notes.find(row=>row.label==='Ethics'),gone=notes.find(row=>row.label==='Polity');
  if(!kept||!gone)throw new Error('the current build did not store both notes');
  const template=dump.appMeta.values[0],deletedAt=new Date(Date.now()-60000).toISOString(),renamedTo=store=>store===n.notes?n.oldNotes:store;
  const old=await open(7,created=>{for(const [store,info] of Object.entries(dump))created.createObjectStore(renamedTo(store),info.keyPath===null?undefined:{keyPath:info.keyPath});}),tx=old.transaction([...old.objectStoreNames],'readwrite');
  for(const [store,info] of Object.entries(dump)){
    const os=tx.objectStore(renamedTo(store));
    info.values.forEach((row,index)=>{
      if(store===n.notes&&row.key===gone.key)return;
      if(store==='appMeta'&&String(row.key).startsWith(n.deletion))row={...row,key:n.oldDeletion+String(row.key).slice(n.deletion.length),value:{...row.value,format:n.oldFormat[row.value.format]||row.value.format}};
      if(info.keyPath===null)os.put(row,info.keys[index]);else os.put(row);
    });
  }
  // Another device deleted Polity; the previous build recorded it like this.
  const deletion={...template,key:n.oldDeletion+gone.key,value:{format:n.oldFormat['study-director.note-deletion'],version:1,key:gone.key,deletedAt},updatedAt:deletedAt};
  if(Object.keys(deletion).sort().join()!==Object.keys(template).sort().join())throw new Error('unexpected record shape');
  tx.objectStore('appMeta').put(deletion);await done(tx);old.close();
  // An edit to Ethics that was never saved, kept in the emergency copy.
  const later=new Date().toISOString(),edit={...kept,text:'Rescued edit after the last save',updatedAt:later};
  localStorage.removeItem(n.rescue);localStorage.setItem(n.oldRescue,JSON.stringify({format:n.oldFormat['study-director.note-rescue'],version:1,updatedAt:later,entries:{[kept.key]:edit}}));
  return {kept:kept.key,gone:gone.key,keptText:kept.text};
})()`;
const inspect=keys=>`(async()=>{const n=${names},k=${JSON.stringify(keys)};${idb}
  const db=await open(),stores=[...db.objectStoreNames].sort(),tx=db.transaction(['appMeta',n.notes],'readonly'),meta=tx.objectStore('appMeta');
  const rows=await req(meta.getAll()),notes=await req(tx.objectStore(n.notes).getAll());db.close();
  const payload=await __PWA6.AppData.notes.readFreshPayload();
  return {version:db.version,stores,
    notes:Object.values(payload).filter(row=>row&&!String(row.key).startsWith('trash')).map(row=>({key:row.key,label:row.label,text:row.text})),
    storedKept:notes.find(row=>row.key===k.kept)?.text||null,goneStored:notes.some(row=>row.key===k.gone&&row.label==='Polity'),
    deletion:rows.find(row=>row.key===n.deletion+k.gone)?.value||null,
    oldNames:rows.filter(row=>String(row.key).startsWith('areaNote')||String(row.key)==='automaticDeviceBackup'||/area-note|device-backup-settings/.test(String(row.value?.format||''))).map(row=>row.key),
    oldRescue:localStorage.getItem(n.oldRescue),rescue:localStorage.getItem(n.rescue)};
})()`;
// A closed page can linger for a moment with its database connection open.
const closed=async(browser,page)=>{await browser.closePage(page);await waitFor(async()=>!(await (await fetch(`http://127.0.0.1:${browser.port}/json/list`)).json()).some(target=>target.type==='page'&&target.url!=='about:blank'),{label:'page closed'});};
const appWarnings=page=>page.warnings.filter(text=>/\[Study Director\]/.test(text));
const noRuntimeErrors=page=>assert.deepEqual(page.events.filter(event=>!/favicon|ResizeObserver loop/i.test(event.text||'')),[]);

const server=await startReleaseServer();
server.setOverride('deployment','seed.html','<!doctype html><meta charset="utf-8"><title>seed</title>');
const result={status:'PASS',release:server.manifest.release,checks:{}};
const browser=await launchChromium({profilePrefix:'study-director-qa-upgrade-names-'});
try{
  let page=await browser.createPage(server.url('deployment','instrumented.html'),{preload,viewport:{width:1280,height:860,mobile:false,scale:1}});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'primary ownership'});
  await page.evaluate(`(async()=>{const d=__PWA6;d.AppData.notes.update('ethics','Ethics','Kept through the upgrade','');d.AppData.notes.update('polity','Polity','Deleted on another device','');await d.AppData.notes.flush({strict:true});})()`);
  await closed(browser,page);

  const seed=await browser.createPage(server.url('deployment','seed.html'));
  const keys=await seed.evaluate(downgrade);
  assert.equal(keys.keptText,'Kept through the upgrade');
  await closed(browser,seed);
  result.checks.previousBuildLayoutWritten=true;

  page=await browser.createPage(server.url('deployment','instrumented.html'),{preload,viewport:{width:1280,height:860,mobile:false,scale:1}});
  await waitForStudyDirector(page,{instrumented:true});
  await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership after upgrade'});
  const after=await waitFor(async()=>{const state=await page.evaluate(inspect(keys));return state.version===INDEXED_DB.version&&!state.oldRescue?state:null;},{label:'upgrade finished'});
  assert.deepEqual(after.stores,Object.values(INDEXED_DB.stores).map(store=>store.name).sort(),'the notes store has its current name and the bridge stores are gone');
  assert.deepEqual(after.notes.map(row=>row.label),['Ethics'],'the kept note comes through and the deleted one stays deleted');
  assert.equal(after.notes[0].text,'Rescued edit after the last save','the emergency copy moved and its unsaved edit applies');
  assert.equal(after.goneStored,false);
  assert.deepEqual(after.deletion&&{format:after.deletion.format,key:after.deletion.key},{format:'study-director.note-deletion',key:keys.gone},'the deletion record moved under its new name and format');
  assert.deepEqual(after.oldNames,[],'nothing is left under an old name');
  assert.equal(after.oldRescue,null);
  result.checks.storeRenamed=true;result.checks.deletionRenamed=true;result.checks.rescueMoved=true;

  // The rescued edit saves under the current names and survives a reload.
  await page.evaluate(`__PWA6.AppData.notes.flush({strict:true})`);
  await page.reload();await waitForStudyDirector(page,{instrumented:true});
  const reloaded=await page.evaluate(inspect(keys));
  assert.equal(reloaded.storedKept,'Rescued edit after the last save');assert.equal(reloaded.rescue,null,'the emergency copy clears once the edit is saved');
  assert.deepEqual(reloaded.oldNames,[]);
  assert.deepEqual(appWarnings(page),[],'the upgrade logs no app warnings');noRuntimeErrors(page);
  result.checks.reloadStable=true;
}finally{
  await browser.close();await server.close();
}
console.log(JSON.stringify(result,null,2));
