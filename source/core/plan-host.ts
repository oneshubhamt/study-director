import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {SavedPlans} from '../../types/record-models.ts';
import type {PlanDataController,PlanDataHostInput,PlanDataWriteOptions,PlanDataSettleOptions,PlanImportOptions,PlanHostModule as PlanHostContract,PlanLibraryWriteOptions,PlanControllerHostInput} from '../../types/plan-host.ts';
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
  functions(input.runtime,['canMutate','flushDraft','authoredDraft','replaceDraftText','previewDraft','renderSavedPlans'],'Plan runtime hooks');
  if(!objectRecord(input.defaults)||!objectRecord(input.defaults.factory)||typeof input.defaults.factory.studentName!=='string'||typeof input.defaults.factory.scheduleText!=='string')throw new TypeError('Plan factory defaults are invalid.');

  const {codec,repositories,ownership,storage,preferences,runtime}=input;
  const factory=freeze({studentName:input.defaults.factory.studentName,scheduleText:input.defaults.factory.scheduleText});
  let state:SavedPlans={draft:null,savedPlans:[],defaultId:null},draftKnown=true,libraryKnown=true,ready=false,chain:Promise<unknown>=Promise.resolve();
  const failures=new Map<'draft'|'library'|'replacement',unknown>();
  const requireKnownReplacement=()=>{if(failures.has('replacement')&&(!draftKnown||!libraryKnown))throw new Error('Portable Plan storage is unconfirmed. Recover or reload before editing Plans.');};
  const libraryKey=(value:PlanLibrary)=>JSON.stringify(value);
  const uncertainDraft=(error:unknown)=>Object.assign(new Error(error instanceof Error?error.message:String(error),{cause:error}),{planDraftUnconfirmed:true as const});

  function enqueue<T>(lane:'draft'|'library'|'replacement',work:(token:WriteToken)=>Promise<T>,options:Readonly<PlanDataWriteOptions|PlanLibraryWriteOptions>={},preparedToken:WriteToken|null=null):Promise<T>{
    const token=preparedToken||options.ownershipToken||ownership.issueWriteToken('save Plan data',{allowHydrating:options.allowHydrating===true});
    const next=chain.catch(()=>undefined).then(()=>{
      ownership.assertWriteToken(token,'save Plan data');
      return work(token);
    });
    chain=next;
    void next.catch(error=>{
      try{ownership.assertWriteToken(token,'reporting Plan save failure');}catch{return;}
      failures.set(lane,error);
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
  let hydrationGeneration=0;
  async function hydrate(assertOrigin?:()=>void){
    assertOrigin?.();
    const generation=++hydrationGeneration;
    const check=()=>{
      assertOrigin?.();
      if(generation!==hydrationGeneration)throw new Error('Plan hydration was superseded.');
    };
    for(;;){
      const observed=chain;
      await observed.catch(()=>undefined);check();
      const loaded=clonePlans(codec.plans(await repositories.plans.read()));
      check();
      // A write admitted during the read may have changed the canonical bytes.
      if(observed!==chain)continue;
      state=loaded;draftKnown=libraryKnown=true;
      failures.clear();ready=true;
      return true;
    }
  }
  function writeDraft(value:string|null,options:Readonly<PlanDataWriteOptions>={}){
    if(!ready)return Promise.reject(new Error('Plan storage is still loading.'));
    requireKnownReplacement();
    codec.plans({...state,draft:value});
    const token=options.ownershipToken||ownership.issueWriteToken('save Plan data',{allowHydrating:options.allowHydrating===true});
    ownership.assertWriteToken(token,'admitting Plan draft');
    return enqueue('draft',async activeToken=>{
      requireKnownReplacement();
      // A preceding saved-plan write can change the combined 1 MiB allowance.
      codec.plans({...state,draft:value});
      const before=state.draft;
      if(draftKnown&&before===value&&options.force!==true&&options.strictDurability!==true){failures.delete('draft');return true;}
      try{
        await repositories.plans.writeDraft(value,{
          ownershipToken:activeToken,
          allowHydrating:options.allowHydrating===true,
          backupCapture:options.backupCapture===true,
          strictDurability:options.strictDurability===true
        });
        ownership.assertWriteToken(activeToken,'acknowledging Plan draft');
      }catch(error){
        // A rejection after commit is not permission to restore older bytes.
        // Read only under the original owner, within the same serial lane.
        draftKnown=false;
        let observed:SavedPlans|null=null;
        try{
          ownership.assertWriteToken(activeToken,'checking failed Plan draft');
          const current=codec.plans(await repositories.plans.read());
          ownership.assertWriteToken(activeToken,'checking failed Plan draft');
          observed=current;
        }catch{}
        if(observed&&observed.draft===before){draftKnown=true;throw error;}
        if(observed&&observed.draft===value){state={...state,draft:value};draftKnown=true;}
        throw uncertainDraft(error);
      }
      state={...state,draft:value};draftKnown=true;failures.delete('draft');
      return true;
    },options,token);
  }
  function writeLibrary(value:PlanLibrary,options:Readonly<PlanLibraryWriteOptions>={}){
    if(!ready)return Promise.reject(new Error('Plan storage is still loading.'));
    requireKnownReplacement();
    const clean=cloneLibrary(codec.plans({...state,savedPlans:value.savedPlans,defaultId:value.defaultId}));
    const baseline=libraryKey(cloneLibrary(state));
    return enqueue('library',async token=>{
      requireKnownReplacement();
      if(!libraryKnown){
        const current=codec.plans(await repositories.plans.read());
        ownership.assertWriteToken(token,'checking saved plans');
        if(libraryKey(cloneLibrary(current))!==libraryKey(cloneLibrary(state)))throw new Error('Saved plans changed in storage. Reload before editing them.');
        libraryKnown=true;
      }
      if(libraryKey(cloneLibrary(state))!==baseline)throw new Error('Saved plans changed before this save. Review the list and try again.');
      codec.plans({...clean,draft:state.draft});
      try{
        await repositories.plans.writeLibrary(clean,{
          ownershipToken:token,allowHydrating:options.allowHydrating===true
        });
        ownership.assertWriteToken(token,'acknowledging saved plans');
      }catch(error){
        libraryKnown=false;
        try{
          ownership.assertWriteToken(token,'checking failed saved plans');
          const observed=cloneLibrary(codec.plans(await repositories.plans.read()));
          ownership.assertWriteToken(token,'checking failed saved plans');
          const key=libraryKey(observed);
          if(key===libraryKey(clean)){state={...state,...observed};libraryKnown=true;}
          else if(key===baseline)libraryKnown=true;
        }catch{}
        throw error;
      }
      state={...state,...clean};libraryKnown=true;failures.delete('library');
      return true;
    },options);
  }
  async function rewriteAfterStorageReset(assertOrigin?:()=>void){
    if(!ready)return false;
    assertOrigin?.();const token=ownership.issueWriteToken('recovering Plan data after storage loss');
    return enqueue('replacement',async activeToken=>{
      // Recover open authored text, not an optimistic failed replacement.
      // Read it in the queue after preceding writes settle.
      assertOrigin?.();const snapshot=clonePlans(codec.plans({...state,draft:runtime.authoredDraft()??state.draft}));
      await repositories.plans.replace(snapshot,{ownershipToken:activeToken,...(assertOrigin?{assertOrigin}:{})});
      assertOrigin?.();ownership.assertWriteToken(activeToken,'acknowledging recovered Plan data');
      state=snapshot;draftKnown=libraryKnown=true;
      failures.clear();
      return true;
    },{},token);
  }
  async function settled(options:Readonly<PlanDataSettleOptions>={}){
    await chain;
    options.assertOrigin?.();
    await preferences.flush(options);
    options.assertOrigin?.();
    if(failures.size)throw failures.values().next().value;
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
  function projectReplacement(plans:SavedPlans,portable:unknown){
    state=clonePlans(plans);
    draftKnown=libraryKnown=true;
    preferences.accept(portable);
    preferences.refreshAppearance(portable);
    preferences.applyRuntime(portable);
    runtime.replaceDraftText(String(plans.draft??activeDefaults().scheduleText));
    runtime.previewDraft();
    runtime.renderSavedPlans();
  }
  async function importData(value:unknown,options:PlanImportOptions={}){
    if(options.rollback===true&&typeof options.assertOrigin!=='function')throw new TypeError('Plan rollback requires the original protected recovery authority.');
    options.assertOrigin?.();
    const clean=codec.normalize(value),token=ownership.issueWriteToken('importing portable Plan data');
    const check=()=>{options.assertOrigin?.();ownership.assertWriteToken(token,'importing portable Plan data');};
    if(options.rollback===true){
      // The verified restore journal owns the preimage. A failed replacement
      // must not prevent its rollback, but never discard unrelated edit failures.
      await chain.catch(()=>undefined);check();
      if(failures.has('draft')||failures.has('library'))throw new Error('Unsettled Plan edits prevent automatic portable rollback.');
      await preferences.flush({assertOrigin:check});
    }else await settled({assertOrigin:check});
    check();
    await enqueue('replacement',async activeToken=>{
      check();
      const before=options.rollback===true?null:codec.normalize({version:2,plans:await repositories.plans.read(),preferences:await currentPreferences()});
      check();
      let portable;
      try{
        portable=await repositories.plans.replacePortable(clean,{ownershipToken:activeToken,assertOrigin:check});
        check();
      }catch(error){
        draftKnown=libraryKnown=false;
        // A rejected acknowledgement need not mean the transaction aborted.
        // Only the original authority may classify a read-back or project it.
        try{
          check();
          const plans=codec.plans(await repositories.plans.read()),stored=await repositories.preferences.read();
          check();
          const actual=codec.normalize({version:2,plans,preferences:codec.preferences(stored??preferences.fallback())});
          if(stored!=null&&JSON.stringify(actual)===JSON.stringify(clean)){
            projectReplacement(plans,stored);
          }else if(before&&JSON.stringify(actual)===JSON.stringify(before)){
            state=clonePlans(plans);draftKnown=libraryKnown=true;
          }
        }catch{}
        throw error;
      }
      projectReplacement(clean.plans,portable);
      failures.clear();
      return true;
    },{},token);
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
  // A primary lease is not enough to make Plan writable: canonical Plan data
  // must also have completed hydration. This keeps controls fail-closed when
  // startup faults after ownership is acquired but before Plan storage is ready.
  const ownership=freeze({...input.ports.ownership,canMutate:()=>input.data.ready()&&input.ports.ownership.canMutate()});
  const controller=input.module.createController(freeze({ports:freeze({...input.ports,persistence,defaults,ownership})}));
  if(!Object.isFrozen(controller)||controller.format!=='study-director.plan-controller'||controller.contractVersion!==1)throw new TypeError('Study Director Plan controller is unavailable or incompatible.');
  return controller;
}

const createModule=():PlanHostContract=>freeze({format:'study-director.plan-host-module',contractVersion:1,createData,createController});
registry.define('plan-host',1,createModule);
return createModule;
})();
export type PlanHostModule=ReturnType<typeof sdPlanHostFactory>;
