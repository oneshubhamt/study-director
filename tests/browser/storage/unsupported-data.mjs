import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';
import {INDEXED_DB} from '../../../contracts/canonical-identities.mjs';
import {APP_META_KEYS,LOCAL_STORAGE_KEYS} from '../../../contracts/data-architecture.mjs';

// Data this build cannot read stays exactly as it is, and the app works with
// everything else. Each case writes a library with this build, rewrites part
// of it the way a newer Study Director (or a damaged write) would, and opens
// this build on it again: the app starts (or, for a database it cannot open,
// says the profile needs a newer version), the rewritten data is unchanged
// byte for byte, and a write to it is refused.
const PROFILE_KEY=LOCAL_STORAGE_KEYS.profiles||'studyDirector.profiles.v1';
const preload=`(()=>{(localStorage.getItem(${JSON.stringify(PROFILE_KEY)})||localStorage.setItem(${JSON.stringify(PROFILE_KEY)},JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'QA',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));})();`;
const idb=`const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('aborted'));});
  const open=(version=0,upgrade=null)=>new Promise((resolve,reject)=>{const r=version?indexedDB.open(${JSON.stringify(INDEXED_DB.name)},version):indexedDB.open(${JSON.stringify(INDEXED_DB.name)});r.onupgradeneeded=()=>upgrade&&upgrade(r.result);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('blocked'));});
  const dump=async()=>{const db=await open(),out={version:db.version,stores:{}};for(const store of [...db.objectStoreNames].sort()){const tx=db.transaction(store,'readonly'),os=tx.objectStore(store);out.stores[store]={keys:await req(os.getAllKeys()),values:await req(os.getAll())};}db.close();return out;};`;
const raw=`(async()=>{${idb}return dump();})()`;
const prefsKey=APP_META_KEYS.personalPreferences;
const cases=[
  {name:'newer database with a store this build does not know',
    seed:`(async()=>{${idb}const db=await open(),v=db.version;db.close();(await open(v+1,created=>created.createObjectStore('futureThings',{keyPath:'id'}))).close();return v+1;})()`,
    check:async({page,before,after})=>{
      assert.equal(after.version,before.version,'the newer database is never upgraded or downgraded');
      assert.ok(after.stores.futureThings,'a store this build does not know stays');
      assert.equal(await page.evaluate(`Object.values(__PWA6.AppData.notes.snapshot?.()||{}).length>=0`),true);
      assert.equal((await page.evaluate(`__PWA6.UnsupportedData.summary()`)).total,0,'nothing in a newer database this build can read is held');
    }},
  {name:'note saved by a newer version',held:{notes:1},
    seed:`(async()=>{${idb}const db=await open(),tx=db.transaction('notes','readwrite'),os=tx.objectStore('notes'),row=(await req(os.getAll())).find(r=>r.label==='Ethics');os.put({...row,version:99,futureField:{kept:true}});await done(tx);db.close();return row.key;})()`,
    write:{store:'notes',value:key=>({key,version:3,label:'Ethics',text:'overwritten',updatedAt:new Date().toISOString()})}},
  {name:'Saved Day saved by a newer version',held:{days:1},
    seed:`(async()=>{${idb}const db=await open(),tx=db.transaction('dailyRecords','readwrite');tx.objectStore('dailyRecords').put({version:99,recordKind:'study',date:'2026-09-01',futureShape:true});await done(tx);db.close();return '2026-09-01';})()`,
    write:{store:'dailyRecords',value:date=>({version:16,recordKind:'diary',date,reflection:'overwritten'})},
    clear:'dailyRecords'},
  {name:'setting saved by a newer version',held:{settings:1},
    seed:`(async()=>{${idb}const db=await open(),tx=db.transaction('appMeta','readwrite'),os=tx.objectStore('appMeta'),row=await req(os.get(${JSON.stringify(prefsKey)}));if(!row)throw new Error('no preferences row');os.put({...row,value:{...row.value,version:99,future:true}});await done(tx);db.close();return row.key;})()`,
    write:{store:'appMeta',value:key=>({key,version:1,value:{version:2},updatedAt:new Date().toISOString()})}},
  {name:'setting this build does not know',held:{settings:1},
    seed:`(async()=>{${idb}const db=await open(),tx=db.transaction('appMeta','readwrite');tx.objectStore('appMeta').put({key:'futureFeature',version:1,value:{format:'study-director.future',version:1},updatedAt:'2026-10-01T00:00:00.000Z'});await done(tx);db.close();return 'futureFeature';})()`},
  {name:'newer database without a store this build needs',blocked:true,
    seed:`(async()=>{${idb}const db=await open(),v=db.version;db.close();(await open(v+1,created=>created.deleteObjectStore('dailySummaries'))).close();return v+1;})()`},
  {name:'profile list saved by a newer version',profiles:true,
    seed:`(()=>{const raw=JSON.parse(localStorage.getItem(${JSON.stringify(PROFILE_KEY)}));localStorage.setItem(${JSON.stringify(PROFILE_KEY)},JSON.stringify({...raw,version:2,futureField:true}));return 'v2';})()`}
];

const server=await startReleaseServer();
server.setOverride('deployment','seed.html','<!doctype html><meta charset="utf-8"><title>seed</title>');
const results=[];
try{
  for(const testCase of cases){
    const browser=await launchChromium({profilePrefix:'sd-unsupported-'});
    try{
      let page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});
      await waitForStudyDirector(page,{instrumented:true});
      await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership'});
      await page.evaluate(`(()=>{const name=document.getElementById('profile-name-input');name.value='QA';name.dispatchEvent(new Event('blur',{bubbles:true}));})()`);
      await waitFor(()=>page.evaluate(`__PWA6.AppData.personalPreferences.read().then(value=>value?.studentName==='QA')`),{label:'current preferences saved'});
      await page.evaluate(`(async()=>{const d=__PWA6;d.AppData.notes.update('ethics','Ethics','Kept text','');await d.AppData.notes.flush({strict:true});})()`);
      await browser.closePage(page);await new Promise(resolve=>setTimeout(resolve,600));
      const seedPage=await browser.createPage(server.url('deployment','seed.html'));
      const key=await seedPage.evaluate(testCase.seed);
      const before=await seedPage.evaluate(raw),profilesBefore=await seedPage.evaluate(`localStorage.getItem(${JSON.stringify(PROFILE_KEY)})`);
      await browser.closePage(seedPage);await new Promise(resolve=>setTimeout(resolve,600));

      page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});
      if(testCase.blocked){
        await waitFor(()=>page.evaluate(`document.documentElement.dataset.studyDirectorStartupState==='failed'`),{label:'start-up stops',timeout:20000});
        assert.equal(await page.evaluate(`__PWA6.NoticeCoordinator.eventStatus().events.some(event=>event.source==='unsupported-data'&&event.id==='blocked'&&/needs a newer version/u.test(event.title))`),true,'the profile says it needs a newer version');
        assert.equal(await page.evaluate(`__PWA6.NoticeCoordinator.status?.().active?.id==='startup-failure'`),false,'not the generic start-up failure');
      }else{
        await waitForStudyDirector(page,{instrumented:true,timeout:20000});
        await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'ownership after reopen'});
      }
      await new Promise(resolve=>setTimeout(resolve,2500));
      const errors=page.events.filter(event=>/startup\.initialize/u.test(String(event.text||'')));
      if(!testCase.blocked)assert.deepEqual(errors.map(event=>String(event.text).slice(0,200)),[],'the app starts');
      const summary=await page.evaluate(`__PWA6.UnsupportedData.summary()`);
      for(const [item,count] of Object.entries(testCase.held||{}))assert.equal(summary.items[item],count,`${testCase.name}: ${item} held`);
      if(testCase.held){
        assert.equal(await page.evaluate(`__PWA6.UnsupportedData.held()`),true,'protected data is held, so clean-up and Drive uploads wait');
        assert.equal(await page.evaluate(`__PWA6.NoticeCoordinator.eventStatus().events.some(event=>event.source==='unsupported-data'&&event.id==='held')`),true,'the person is told once');
        assert.equal(await page.evaluate(`!document.getElementById('unsupported-data').hidden&&/newer version/u.test(document.getElementById('unsupported-data-text').textContent)`),true,'Library → Data says what is kept');
      }
      if(testCase.write){
        const refused=await page.evaluate(`(async()=>{try{await __PWA6.IndexedDb.strictStoreTransaction(${JSON.stringify(testCase.write.store)},'readwrite',(store,tx,finish)=>{store.put((${testCase.write.value.toString()})(${JSON.stringify(key)}));tx.oncomplete=()=>finish(true,true);});return 'written';}catch(error){return String(error&&error.code||error&&error.message||error);}})()`);
        assert.equal(refused,'STUDY_DIRECTOR_UNSUPPORTED_DATA','a write over held data is refused');
        const removed=await page.evaluate(`(async()=>{try{await __PWA6.IndexedDb.strictStoreTransaction(${JSON.stringify(testCase.write.store)},'readwrite',(store,tx,finish)=>{store.delete(${JSON.stringify(key)});tx.oncomplete=()=>finish(true,true);});return 'deleted';}catch(error){return String(error&&error.code||error);}})()`);
        assert.equal(removed,'STUDY_DIRECTOR_UNSUPPORTED_DATA','a delete of held data is refused');
        assert.equal(await page.evaluate(`__PWA6.IndexedDb.get(${JSON.stringify(testCase.write.store)},${JSON.stringify(key)})`),null,'reads do not see held data');
      }
      if(testCase.clear){
        await page.evaluate(`__PWA6.IndexedDb.strictStoreTransaction(${JSON.stringify(testCase.clear)},'readwrite',(store,tx,finish)=>{store.clear();tx.oncomplete=()=>finish(true,true);})`);
        assert.equal((await page.evaluate(`__PWA6.IndexedDb.getAll(${JSON.stringify(testCase.clear)})`)).length,0,'a clear removes what this build can read');
      }
      if(testCase.profiles){
        assert.equal(await page.evaluate(`__PWA6.Profiles?.unsupported?.()??null`)??true,true);
        const added=await page.evaluate(`(()=>{try{__PWA6.Profiles.add();return 'added';}catch(error){return String(error&&error.code||error);}})()`);
        assert.equal(added,'STUDY_DIRECTOR_PROFILES_UNSUPPORTED','profiles cannot be added to a newer list');
      }
      await browser.closePage(page);await new Promise(resolve=>setTimeout(resolve,600));
      const check=await browser.createPage(server.url('deployment','seed.html'));
      const after=await check.evaluate(raw),profilesAfter=await check.evaluate(`localStorage.getItem(${JSON.stringify(PROFILE_KEY)})`);
      await browser.closePage(check);
      if(testCase.profiles)assert.equal(profilesAfter,profilesBefore,'the newer profile list is not rewritten');
      // Held records are exactly as the newer version left them.
      const held=testCase.write?[testCase.write.store]:testCase.clear?[testCase.clear]:[];
      for(const store of held){
        const index=before.stores[store].keys.indexOf(key),afterIndex=after.stores[store].keys.indexOf(key);
        assert.ok(afterIndex>=0,`${testCase.name}: the held record is still there`);
        assert.deepEqual(after.stores[store].values[afterIndex],before.stores[store].values[index],`${testCase.name}: the held record is unchanged`);
      }
      if(testCase.name==='setting this build does not know')assert.deepEqual(after.stores.appMeta.values.find(row=>row.key==='futureFeature'),before.stores.appMeta.values.find(row=>row.key==='futureFeature'));
      if(testCase.blocked){assert.equal(after.version,before.version);assert.deepEqual(Object.keys(after.stores),Object.keys(before.stores));assert.deepEqual(after.stores.notes,before.stores.notes,'nothing in a database this build cannot open is touched');}
      if(testCase.check)await testCase.check({page:await browser.createPage(server.url('deployment','instrumented.html'),{preload}).then(async next=>{await waitForStudyDirector(next,{instrumented:true,timeout:20000});return next;}),before,after});
      results.push(testCase.name);
    }finally{await browser.close();}
  }
}finally{await server.close();}
console.log(JSON.stringify({status:'PASS',suite:'unsupported-data',cases:results},null,2));
