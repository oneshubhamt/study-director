import type {MaintenanceOptions,ImportOptions} from '../../types/repositories.ts';
import {createHarness} from './repository-harness.mts';
import {method} from './registered-exports.mts';
import {notesPort,required} from './repository-note-ports.mts';
import {jsonArray,jsonObject,jsonString} from './verification/read-verification.mts';

export function field(value:unknown,key:string):unknown{
  if(value===null||value===undefined)return undefined;
  return jsonObject(value)[key];
}
export function bool(value:unknown):boolean{if(typeof value!=='boolean')throw new TypeError('Expected boolean repository result');return value;}
export function records(value:unknown){return Array.from(jsonArray(value),jsonObject);}
export function optionalRecord(value:unknown){return value===null?null:jsonObject(value);}
export function errorCode(value:unknown){return field(value,'code');}
export function errorMessage(value:unknown):string{
  if(value instanceof Error)return value.message;
  return jsonString(field(value,'message'));
}
type DailyOptions={strict?:boolean;backupCapture?:boolean;expectedCanonical?:unknown;assertOrigin?:()=>void};
type SessionOptions={emergency?:boolean;strictDurability?:boolean;backupCapture?:boolean;expectedCanonical?:unknown;recoveryFallback?:boolean;assertOrigin?:()=>void};
function sessionResult(value:unknown){
  const row=jsonObject(value),storage=jsonObject(row['storage']);
  return {ok:bool(row['ok']),value:row['value'],error:row['error'],storage:{idb:bool(storage['idb']),local:bool(storage['local'])}};
}
export function checkedRepository(...args:Parameters<typeof createHarness>){
  const h=createHarness(...args),app=jsonObject(h.app);
  const call=(owner:string,name:string,...values:unknown[])=>method(app[owner],name)(...values);
  const get=async(date:string,options?:{strict?:boolean})=>optionalRecord(await call('dailyRecords','get',date,options));
  const meta=h.repositoryMeta;
  return {...h,app:{
    compatibility:app['compatibility'],
    notes:notesPort(h.app),
    activeSession:{
      save:async(value:unknown,options?:SessionOptions)=>sessionResult(await call('activeSession','save',value,options)),
      load:async(retry?:number,options?:{strict?:boolean})=>sessionResult(await call('activeSession','load',retry,options)),
      clear:async(options?:SessionOptions)=>sessionResult(await call('activeSession','clear',options)),
      settled:async()=>call('activeSession','settled')
    },
    dailyRecords:{
      save:async(value:unknown,options?:DailyOptions)=>jsonObject(await call('dailyRecords','save',value,options)),
      get,getRequired:async(date:string,options?:{strict?:boolean})=>required(await get(date,options)),
      remove:async(date:string,options?:DailyOptions)=>call('dailyRecords','remove',date,options),
      saveBatch:async(values:readonly unknown[],options?:DailyOptions)=>bool(await call('dailyRecords','saveBatch',values,options)),
      importBatches:async(values:readonly unknown[],options?:ImportOptions)=>jsonObject(await call('dailyRecords','importBatches',values,options)),
      verifyCanonical:async(...values:unknown[])=>call('dailyRecords','verifyCanonical',...values),
      verifyCanonicalAbsent:async(...values:unknown[])=>call('dailyRecords','verifyCanonicalAbsent',...values),
      timestamp:(...values:unknown[])=>call('dailyRecords','timestamp',...values),
      datasetRevision:async()=>call('dailyRecords','datasetRevision')
    },
    deletionRecovery:{
      savedDays:async()=>records(await call('deletionRecovery','savedDays')),
      notes:async()=>records(await call('deletionRecovery','notes')),
      attachments:async()=>records(await call('deletionRecovery','attachments')),
      pending:()=>records(call('deletionRecovery','pending')),
      replaceNotes:async(values:readonly unknown[])=>call('deletionRecovery','replaceNotes',values),
      recordAttachment:async(id:string,stamp:string)=>call('deletionRecovery','recordAttachment',id,stamp),
      clearAttachment:async(id:string)=>call('deletionRecovery','clearAttachment',id),
      flush:async(options?:MaintenanceOptions)=>call('deletionRecovery','flush',options)
    },
    maintenance:{run:async(options?:MaintenanceOptions)=>{const row=jsonObject(await call('maintenance','run',options));const report:Record<string,unknown>&{status:string}={...row,status:jsonString(row['status'])};return report;}},
    mutationEpoch:{reseed:async()=>jsonObject(await call('mutationEpoch','reseed')())},
    planData:{
      read:async()=>jsonObject(await call('planData','read')),
      writeDraft:async(value:string,options?:{strictDurability?:boolean;backupCapture?:boolean;assertOrigin?:()=>void})=>call('planData','writeDraft',value,options),
      writeLibrary:async(value:unknown)=>call('planData','writeLibrary',value),
      replace:async(value:unknown,options?:{assertOrigin?:()=>void})=>call('planData','replace',value,options),
      replacePortable:async(value:unknown,options?:{assertOrigin?:()=>void})=>call('planData','replacePortable',value,options)
    },
    personalPreferences:{
      read:async()=>optionalRecord(await call('personalPreferences','read')),
      write:async(value:unknown,options?:{assertOrigin?:()=>void})=>call('personalPreferences','write',value,options)
    },
    mutationLease:{
      acquire:async(value:unknown)=>call('mutationLease','acquire',value),
      release:async(id:string,owner:string)=>call('mutationLease','release',id,owner)
    },
    restoreJournal:{prepare:async(value:unknown)=>call('restoreJournal','prepare',value),mark:async(id:string,phase:string)=>call('restoreJournal','mark',id,phase),clear:async(id:string)=>call('restoreJournal','clear',id)},
    libraryClearJournal:{prepare:async(value:unknown)=>call('libraryClearJournal','prepare',value),mark:async(id:string,phase:string)=>call('libraryClearJournal','mark',id,phase),clear:async(id:string)=>call('libraryClearJournal','clear',id)}
  },repositoryMeta:{write:async(name:string,value:unknown,options?:unknown)=>method(meta,'write')(name,value,options)}};
}
