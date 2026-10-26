import assert from 'node:assert/strict';
import {dailyRecordCodec,dataContract} from '../../helpers/current-codec-fixture.mjs';
const stamp='2026-09-10T10:00:00.000Z',current=dailyRecordCodec.createDiaryRecord('2026-09-09','Canonical reflection',{savedAt:stamp,updatedAt:stamp});
assert.ok(current);assert.deepEqual(dailyRecordCodec.sanitizeCurrentDailyRecord(current),current);
for(const version of [0,1,dataContract.schemas.DailyRecord.version-1,dataContract.schemas.DailyRecord.version+1]){
 const unsupported={...current,version},before=structuredClone(unsupported);
 assert.equal(dailyRecordCodec.sanitizeCurrentDailyRecord(unsupported),null);assert.deepEqual(unsupported,before);
}
assert.equal(dailyRecordCodec.sanitizeCurrentNote({version:2,key:'Old name',label:'Old name',text:'Keep bytes',updatedAt:stamp}),null);
console.log(JSON.stringify({status:'PASS',suite:'canonical-baseline',currentValidated:true,otherSchemasRejected:true,inputUnchanged:true}));

// The startup census must use each store's canonical version field. Summaries
// use summaryVersion; treating them as unsupported also hides their Saved Day.
const {default:fs}=await import('node:fs'),{default:vm}=await import('node:vm');
const stores=Object.fromEntries(Object.keys(dataContract.storage.stores).map(name=>[name,new Map()])),held=new Map();
const hold=(store,key,reason)=>{if(!held.has(store))held.set(store,new Map());held.get(store).set(key,reason);};
const indexedDb={
  topology:async()=>({current:true,usable:true,newer:false}),
  unsupported:{
    async scan(store,verdict){for(const [key,value] of stores[store]){const reason=verdict(value);if(reason)hold(store,key,reason);}},
    hold,keys:store=>[...(held.get(store)?.keys()||[])],summary:()=>({total:[...held.values()].reduce((sum,rows)=>sum+rows.size,0),protected:[...held.values()].reduce((sum,rows)=>sum+rows.size,0),stores:{},reasons:{}})
  }
};
const host=fs.readFileSync('source/app.html','utf8'),begin=host.indexOf('const UnsupportedData=(()=>{'),end=host.indexOf('const RepositoryAppMetaValidators=',begin);
assert.ok(begin>=0&&end>begin);
const census=vm.runInNewContext(host.slice(begin,end)+'\nUnsupportedData;',{
  DATA_CONTRACT:dataContract,DB_STORES:Object.fromEntries(Object.keys(stores).map(name=>[name,name])),
  DB_DAILY_RECORD_STORE:'dailyRecords',DB_DAILY_SUMMARY_STORE:'dailySummaries',DB_NOTES_STORE:'notes',DB_ACTIVE_SESSION_STORE:'activeSessions',DB_APP_META_STORE:'appMeta',DB_ASSET_STORE:'assets',
  IndexedDb:indexedDb,AppMetaGateway:{resolve:()=>({schema:'Setting.v1',protection:'protect'}),readable:row=>row.value?.version===1}
});
stores.dailyRecords.set(current.date,current);stores.dailySummaries.set(current.date,{date:current.date,summaryVersion:dataContract.schemas.DailySummary.version});
stores.notes.set('current',{version:dataContract.schemas.Note.version});stores.activeSessions.set('current',{version:dataContract.schemas.ActiveSession.version});stores.assets.set('current',{version:2});stores.appMeta.set('current',{key:'current',version:1,value:{version:1}});
assert.equal((await census.census()).held,0,'all current canonical store versions, including summaries, remain readable');
stores.dailySummaries.set('older',{date:'older',summaryVersion:dataContract.schemas.DailySummary.version-1});stores.dailyRecords.set('older',{...current,date:'older'});
stores.notes.set('older',{version:dataContract.schemas.Note.version-1});stores.notes.set('newer',{version:dataContract.schemas.Note.version+1});stores.appMeta.set('older',{key:'older',version:1,value:{version:0}});
const before=structuredClone(stores),state=await census.census();
assert.equal(state.items.days,1);assert.equal(state.items.notes,2);assert.equal(state.items.settings,1);assert.deepEqual(stores,before,'unsupported records are held without conversion or deletion');
assert.equal(held.get('dailyRecords').get('older'),'same-day');assert.equal(held.get('dailySummaries').has(current.date),false);
console.log(JSON.stringify({status:'PASS',suite:'canonical-census',summaryVersionRespected:true,unsupportedUntouched:true}));
