import assert from 'node:assert/strict';
import {startReleaseServer,launchChromium,waitForStudyDirector,waitFor} from '../../helpers/browser-harness.mjs';
import {INDEXED_DB} from '../../../contracts/canonical-identities.mjs';
const preload=`(()=>{(localStorage.getItem('studyDirector.profiles.v1')||localStorage.setItem('studyDirector.profiles.v1',JSON.stringify({version:1,active:'prof_qa_mve00000_abcdef01',profiles:[{id:'prof_qa_mve00000_abcdef01',scope:'',name:'',email:'',folder:'',createdAt:'2026-08-01T00:00:00.000Z',fresh:false,from:null}],removing:[]})));})();`;
const server=await startReleaseServer(),browser=await launchChromium({profilePrefix:'study-director-canonical-'});
try{
 const page=await browser.createPage(server.url('deployment','instrumented.html'),{preload});await waitForStudyDirector(page,{instrumented:true});
 await waitFor(()=>page.evaluate(`__PWA6.AppOwnership.status().hasControl`),{label:'canonical writer'});
 const saved=await page.evaluate(`(async()=>{const d=__PWA6;d.AppData.notes.update('canonical qa','Canonical QA','Preserved canonical note','');await d.AppData.notes.flush({strict:true});return Object.values(await d.AppData.notes.readFreshPayload()).find(row=>row.label==='Canonical QA');})()`);
 assert.equal(saved.version,3);assert.match(saved.key,/^n_[a-f0-9]{16}$/u);
 const loads=page.loadCount;await page.send('Page.reload');await waitFor(()=>page.loadCount>loads,{label:'reload'});await waitForStudyDirector(page,{instrumented:true});
 const state=await page.evaluate(`(async()=>{const payload=await __PWA6.AppData.notes.readFreshPayload(),request=indexedDB.open(${JSON.stringify(INDEXED_DB.name)});const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});const result={version:db.version,stores:[...db.objectStoreNames].sort(),note:Object.values(payload).find(row=>row.label==='Canonical QA')};db.close();return result;})()`);
 assert.equal(state.version,INDEXED_DB.version);assert.deepEqual(state.stores,Object.values(INDEXED_DB.stores).map(row=>row.name).sort());assert.deepEqual(state.note,saved);
 assert.deepEqual(page.events.filter(event=>event.kind==='exception'||event.kind==='console-error'),[]);
 console.log(JSON.stringify({status:'PASS',suite:'canonical-storage',currentTopology:true,noteSurvivesReload:true}));
}finally{await browser.close();await server.close();}
