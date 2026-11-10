import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {SavedPlans} from '../../types/record-models.ts';
import type {PlanDataController,PlanDataHostInput,PlanDataWriteOptions,PlanHostModule as PlanHostContract,PlanLibraryWriteOptions,PlanControllerHostInput} from '../../types/plan-host.ts';
import type {PlanLibrary} from '../../types/plan.ts';
import type {WriteToken} from '../../types/ownership.ts';

const sdPlanHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'plan-host','study-director.plan-host-module'>|undefined;
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
const freeze=Object.freeze;
const objectRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function exactObject(value:unknown,keys:readonly string[],label:string){
  if(!objectRecord(value))throw new TypeError(`${label} must be an object.`);
  const actual=Object.keys(value).sort(),expected=[...keys].sort();
  if(actual.length!==expected.length||actual.some((key,index)=>key!==expected[index]))throw new TypeError(`${label} is incomplete or contains unexpected fields.`);
}
function functions(value:unknown,keys:readonly string[],label:string){
  if(!objectRecord(value)||keys.some(key=>typeof value[key]!=='function'))throw new TypeError(`${label} is incomplete.`);
}
function clonePlans(value:SavedPlans):SavedPlans{
  return {draft:value.draft,savedPlans:value.savedPlans.map(plan=>({...plan})),defaultId:value.defaultId};
}
function cloneLibrary(value:SavedPlans):PlanLibrary{
  return {savedPlans:value.savedPlans.map(plan=>({...plan})),defaultId:value.defaultId};
}

function createData(input:Readonly<PlanDataHostInput>):Readonly<PlanDataController>{
  exactObject(input,['codec','repositories','ownership','storage','preferences','runtime','defaults'],'Plan data host input');
  functions(input.codec,['plans','preferences','normalize'],'Plan data codec');
  exactObject(input.repositories,['plans','preferences'],'Plan data repositories');
  functions(input.repositories.plans,['read','replace','replacePortable','writeDraft','writeLibrary'],'Plan documents repository');
  functions(input.repositories.preferences,['read'],'Plan preferences repository');
  functions(input.ownership,['issueWriteToken','assertWriteToken'],'Plan ownership port');
  functions(input.storage,['markError'],'Plan storage health port');
  functions(input.preferences,['fallback','flush','accept','refreshAppearance','applyRuntime','studentName'],'Plan preference hooks');
  functions(input.runtime,['canMutate','flushDraft','replaceDraftText','previewDraft','renderSavedPlans'],'Plan runtime hooks');
  if(!objectRecord(input.defaults)||!objectRecord(input.defaults.factory)||typeof input.defaults.factory.studentName!=='string'||typeof input.defaults.factory.scheduleText!=='string')throw new TypeError('Plan factory defaults are invalid.');

  const {codec,repositories,ownership,storage,preferences,runtime}=input;
  const factory=freeze({studentName:input.defaults.factory.studentName,scheduleText:input.defaults.factory.scheduleText});
  let state:SavedPlans={draft:null,savedPlans:[],defaultId:null},persistedDraft:string|null|undefined=null,ready=false,chain:Promise<unknown>=Promise.resolve(),failure:unknown=null;

  function enqueue<T>(work:(token:WriteToken)=>Promise<T>,options:Readonly<PlanDataWriteOptions|PlanLibraryWriteOptions>={},preparedToken:WriteToken|null=null):Promise<T>{
    const token=preparedToken||options.ownershipToken||ownership.issueWriteToken('save Plan data',{allowHydrating:options.allowHydrating===true});
    const next=chain.catch(()=>undefined).then(()=>{
      ownership.assertWriteToken(token,'save Plan data');
      return work(token);
    });
    chain=next;
    void next.catch(error=>{
      failure=error;
      storage.markError('planDraft.write','Plan data was not saved. Keep this tab open and copy the draft before closing.');
    });
    return next;
  }
  function defaultSchedule(){
    return state.savedPlans.find(plan=>plan.id===state.defaultId)?.scheduleText??null;
  }
  function activeDefaults(){
    return freeze({
      studentName:preferences.studentName()||factory.studentName,
      scheduleText:defaultSchedule()??factory.scheduleText
    });
  }
  async function hydrate(){
    await chain.catch(()=>undefined);
    state=clonePlans(codec.plans(await repositories.plans.read()));
    persistedDraft=state.draft;
    failure=null;
    ready=true;
    return true;
  }
  function writeDraft(value:string|null,options:Readonly<PlanDataWriteOptions>={}){
    if(!ready)return Promise.reject(new Error('Plan storage is still loading.'));
    const clean=clonePlans(codec.plans({...state,draft:value}));
    // Authorization precedes publication to the in-memory Plan view. If the
    // page lost ownership, readDraft() must not claim an unauthorized value.
    const token=options.ownershipToken||ownership.issueWriteToken('save Plan data',{allowHydrating:options.allowHydrating===true});
    state=clean;
    return enqueue(async activeToken=>{
      if(persistedDraft===value&&options.force!==true&&options.strictDurability!==true){failure=null;return true;}
      await repositories.plans.writeDraft(value,{
        ownershipToken:activeToken,
        allowHydrating:options.allowHydrating===true,
        backupCapture:options.backupCapture===true,
        strictDurability:options.strictDurability===true
      });
      persistedDraft=value;
      failure=null;
      return true;
    },options,token);
  }
  function writeLibrary(value:PlanLibrary,options:Readonly<PlanLibraryWriteOptions>={}){
    if(!ready)return Promise.reject(new Error('Plan storage is still loading.'));
    const clean=clonePlans(codec.plans({...state,savedPlans:value.savedPlans,defaultId:value.defaultId}));
    return enqueue(async token=>{
      codec.plans({...clean,draft:state.draft});
      await repositories.plans.writeLibrary({savedPlans:clean.savedPlans,defaultId:clean.defaultId},{
        ownershipToken:token,allowHydrating:options.allowHydrating===true
      });
      state=clonePlans({...state,savedPlans:clean.savedPlans,defaultId:clean.defaultId});
      failure=null;
      return true;
    },options);
  }
  async function rewriteAfterStorageReset(){
    if(!ready)return false;
    await chain.catch(()=>undefined);
    const snapshot=clonePlans(codec.plans(state));
    return enqueue(async()=>{
      await repositories.plans.replace(snapshot);
      persistedDraft=snapshot.draft;
      failure=null;
      return true;
    });
  }
  async function settled(options:Readonly<{backupCapture?:boolean}>={}){
    await chain;
    await preferences.flush(options);
    if(failure)throw failure;
    return true;
  }
  async function currentPreferences(){
    const canonical=await repositories.preferences.read();
    return codec.preferences(canonical??preferences.fallback());
  }
  async function exportData({flush=true,backupCapture=false}:Readonly<{flush?:boolean;backupCapture?:boolean}>={}){
    if(flush&&runtime.canMutate()){
      if(await runtime.flushDraft({backupCapture})===false)throw new Error('Save the current Plan draft before exporting.');
      await settled({backupCapture});
    }
    return codec.normalize({version:2,plans:await repositories.plans.read(),preferences:await currentPreferences()});
  }
  async function importData(value:unknown){
    const clean=codec.normalize(value);
    await settled();
    await enqueue(async()=>{
      const portable=await repositories.plans.replacePortable(clean);
      state=clonePlans(clean.plans);
      persistedDraft=clean.plans.draft;
      failure=null;
      preferences.accept(portable);
      preferences.refreshAppearance(portable);
      preferences.applyRuntime(portable);
      return true;
    });
    runtime.replaceDraftText(String(clean.plans.draft??activeDefaults().scheduleText));
    runtime.previewDraft();
    runtime.renderSavedPlans();
    return true;
  }
  async function verify(value:unknown){
    await settled();
    const actual=codec.normalize({version:2,plans:await repositories.plans.read(),preferences:await currentPreferences()});
    const expected=codec.normalize(value);
    if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Restored Plans or Preferences did not match the selected backup.');
    return true;
  }
  const controller=freeze({
    format:'study-director.plan-data' as const,contractVersion:1 as const,factory,
    hydrate,writeDraft,writeLibrary,rewriteAfterStorageReset,settled,exportData,importData,verify,
    readDraft:()=>state.draft,
    library:()=>cloneLibrary(state),
    defaultSchedule,
    activeDefaults,
    ready:()=>ready
  });
  return controller;
}

function createController(input:Readonly<PlanControllerHostInput>){
  exactObject(input,['module','data','ports'],'Plan controller host input');
  if(input.module.format!=='study-director.plan-module'||input.module.contractVersion!==1)throw new TypeError('Plan module is unavailable or incompatible.');
  if(input.data.format!=='study-director.plan-data'||input.data.contractVersion!==1)throw new TypeError('Plan data host is unavailable or incompatible.');
  if(!Object.isFrozen(input.ports))throw new TypeError('Plan controller host ports must be frozen.');
  const persistence=freeze({
    lastError:input.ports.persistence.lastError,
    readDraft:input.data.readDraft,
    readLibrary:input.data.library,
    writeLibrary:input.data.writeLibrary,
    writeDraft:input.data.writeDraft,
    reportDraftResult:input.ports.persistence.reportDraftResult
  });
  const defaults=freeze({active:input.data.activeDefaults,applyStudentName:input.ports.defaults.applyStudentName,factory:input.data.factory});
  const controller=input.module.createController(freeze({ports:freeze({...input.ports,persistence,defaults})}));
  if(!Object.isFrozen(controller)||controller.format!=='study-director.plan-controller'||controller.contractVersion!==1)throw new TypeError('Study Director Plan controller is unavailable or incompatible.');
  return controller;
}

const createModule=():PlanHostContract=>freeze({format:'study-director.plan-host-module',contractVersion:1,createData,createController});
registry.define('plan-host',1,createModule);
return createModule;
})();
export type PlanHostModule=ReturnType<typeof sdPlanHostFactory>;
