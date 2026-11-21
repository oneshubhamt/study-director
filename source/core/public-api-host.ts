import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {OptionalPluginDescriptor,PluginFileState,PluginFileStatus,PluginRegistrationStatus,PluginRuntimeStatus,PublicApiHostModule as PublicApiHostContract,PublicApiInput,PublicApiRuntime,PublicApiRuntimeInput,StudyDirectorPluginDescriptor,StudyDirectorPublicApi} from '../../types/public-api-host.ts';
const sdPublicApiHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'public-api-host','study-director.public-api-host-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
const {exactFrozenObject,functionPort}=registry.contracts,freeze=Object.freeze;
const MAX_LOAD_ATTEMPTS=2,MAX_REGISTRATION_ATTEMPTS=2;
const isRecord=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const errorMessage=(error:unknown,fallback:string)=>error instanceof Error&&error.message?error.message:String(error||fallback);

function createRuntime(input:Readonly<PublicApiRuntimeInput>):Readonly<PublicApiRuntime>{
  exactFrozenObject(input,['configuration','environment','tabs','preview','clampText'],'Public API runtime input');
  exactFrozenObject(input.configuration,['capabilities','descriptors'],'Public API configuration');
  exactFrozenObject(input.environment,['document','trustedAssetURL'],'Public API environment');
  exactFrozenObject(input.tabs,['registerTab','renderTab'],'Public API tab ports');
  exactFrozenObject(input.preview,['registerProvider'],'Public API preview ports');
  functionPort(input.environment,['trustedAssetURL'],'Public API environment');
  functionPort(input.tabs,['registerTab','renderTab'],'Public API tab ports');
  functionPort(input.preview,['registerProvider'],'Public API preview ports');
  if(typeof input.clampText!=='function')throw new TypeError('Public API text adapter is unavailable.');
  if(!Object.isFrozen(input.configuration.capabilities)||!Object.values(input.configuration.capabilities).every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0))throw new TypeError('Public API capabilities are invalid.');
  const descriptors=input.configuration.descriptors.map(raw=>{
    if(!raw||typeof raw!=='object')throw new TypeError('Optional plugin descriptor is invalid.');
    const descriptor=raw as OptionalPluginDescriptor;
    const tabId=String(descriptor.tabId||'').trim(),label=String(descriptor.label||'').trim(),icon=String(descriptor.icon||'').trim(),src=String(descriptor.src||'').trim(),pluginName=String(descriptor.pluginName||'').trim();
    if(!/^[a-z][a-z0-9-]{0,40}$/u.test(tabId)||!label||!src||!pluginName)throw new TypeError('Optional plugin descriptor is invalid.');
    return freeze({tabId,label,icon,src,pluginName});
  });
  if(new Set(descriptors.map(row=>row.tabId)).size!==descriptors.length||new Set(descriptors.map(row=>row.pluginName)).size!==descriptors.length)throw new TypeError('Optional plugin descriptors must be unique.');
  const descriptorsByTab=new Map(descriptors.map(row=>[row.tabId,row] as const)),descriptorsByPlugin=new Map(descriptors.map(row=>[row.pluginName,row] as const));
  const files=new Map(descriptors.map(row=>[row.tabId,{state:'not-requested' as PluginFileState,attempts:0,lastError:'',lastAttemptAt:''}]));
  const loadPromises=new Map<string,Promise<boolean>>(),registered=new Map<string,PluginRegistrationStatus>();
  let publicApi:StudyDirectorPublicApi|null=null,placeholdersRegistered=false;
  const nowStamp=()=>new Date().toISOString();

  function activeTabId(){return input.environment.document.querySelector<HTMLElement>('.nav-item.on[data-tab]')?.dataset['tab']||'';}
  function renderIfActive(tabId:string){if(activeTabId()===tabId)input.tabs.renderTab(tabId);}
  function fileStatus(tabId:string):PluginFileStatus|null{
    const descriptor=descriptorsByTab.get(tabId),record=files.get(tabId);if(!descriptor||!record)return null;
    return freeze({tabId,src:descriptor.src,state:record.state,attempts:record.attempts,lastError:record.lastError,lastAttemptAt:record.lastAttemptAt});
  }
  function markFile(tabId:string,state:PluginFileState,error=''){
    const record=files.get(tabId);if(!record)return;
    record.state=state;record.lastError=String(error||'');record.lastAttemptAt=nowStamp();
  }
  function canRetry(record:ReturnType<typeof files.get>){return !!record&&(['loaded','missing','failed'] as PluginFileState[]).includes(record.state)&&record.attempts<MAX_LOAD_ATTEMPTS;}
  function renderPlaceholder(descriptor:Readonly<OptionalPluginDescriptor>,pane:HTMLElement|null){
    if(!pane)return;
    const state=files.get(descriptor.tabId);if(!state)return;
    pane.replaceChildren();
    const card=input.environment.document.createElement('div');card.className='card plugin-loading-panel';
    const heading=input.environment.document.createElement('div');heading.className='ui-section-title';heading.textContent=descriptor.label;
    const message=input.environment.document.createElement('p');message.className='ui-body';
    if(state.state==='loading')message.textContent=`Loading ${descriptor.label}…`;
    else if(state.state==='loaded')message.textContent=`${descriptor.label} loaded, but did not register its interface.`;
    else if(state.state==='missing')message.textContent=`${descriptor.label} is unavailable in this copy of Study Director.`;
    else if(state.state==='failed')message.textContent=`${descriptor.label} could not start.`;
    else message.textContent=`${descriptor.label} loads only when you open it.`;
    card.append(heading,message);
    if(canRetry(state)){
      const retry=input.environment.document.createElement('button');retry.type='button';retry.className='mini-btn';retry.textContent='Retry loading';
      retry.addEventListener('click',()=>{void requestTab(descriptor.tabId,{retry:true});});card.appendChild(retry);
    }
    pane.appendChild(card);
  }
  function registerPlaceholders(){
    if(placeholdersRegistered)return true;
    for(const descriptor of descriptors){
      if(!input.tabs.registerTab({id:descriptor.tabId,label:descriptor.label,icon:descriptor.icon,render:context=>renderPlaceholder(descriptor,context.pane)}))return false;
    }
    placeholdersRegistered=true;return true;
  }
  function unmetCapabilities(requirements:unknown){
    if(!isRecord(requirements))return [] as string[];
    return Object.entries(requirements).filter(([key,minimum])=>Number(input.configuration.capabilities[key]||0)<Math.max(0,Number(minimum)||0)).map(([key,minimum])=>`${key} >= ${minimum}`);
  }
  function normalizePlugin(value:unknown):StudyDirectorPluginDescriptor|null{
    if(!isRecord(value)||typeof value['setup']!=='function')return null;
    const name=input.clampText(value['name']||'anonymous-plugin',80),version=input.clampText(value['version']||'',80);
    if(!name)return null;
    const requires=isRecord(value['requires'])?value['requires'] as Readonly<Record<string,number>>:freeze({});
    const previewProviders=isRecord(value['previewProviders'])?value['previewProviders'] as StudyDirectorPluginDescriptor['previewProviders']:undefined;
    const base={name,version,requires,setup:value['setup'] as StudyDirectorPluginDescriptor['setup']};
    return previewProviders?{...base,previewProviders}:base;
  }
  function register(value:unknown){
    const plugin=normalizePlugin(value);if(!plugin||!publicApi)return false;
    const previous=registered.get(plugin.name);
    if(previous?.state==='registered')return true;
    if(previous?.state==='incompatible')return false;
    const attempts=(previous?.attempts||0)+1;if(attempts>MAX_REGISTRATION_ATTEMPTS)return false;
    const descriptor=descriptorsByPlugin.get(plugin.name),missing=unmetCapabilities(plugin.requires);
    if(missing.length){
      registered.set(plugin.name,freeze({name:plugin.name,version:plugin.version||'',state:'incompatible',attempts,lastError:`Missing capability: ${missing.join(', ')}`,lastAttemptAt:nowStamp()}));
      if(descriptor){markFile(descriptor.tabId,'failed','This module needs a newer Study Director interface.');renderIfActive(descriptor.tabId);}return false;
    }
    try{
      const ok=plugin.setup(publicApi)!==false;
      if(ok&&plugin.previewProviders)for(const [target,provider] of Object.entries(plugin.previewProviders))if(typeof provider==='function')input.preview.registerProvider(target,provider);
      registered.set(plugin.name,freeze({name:plugin.name,version:plugin.version||'',state:ok?'registered':'inactive',attempts,lastError:ok?'':'Plugin setup returned false.',lastAttemptAt:nowStamp()}));
      if(descriptor){markFile(descriptor.tabId,ok?'registered':'failed',ok?'':'Plugin setup returned false.');renderIfActive(descriptor.tabId);}return ok;
    }catch(error){
      const message=errorMessage(error,'Plugin setup failed.');
      registered.set(plugin.name,freeze({name:plugin.name,version:plugin.version||'',state:'failed',attempts,lastError:message,lastAttemptAt:nowStamp()}));
      if(descriptor){markFile(descriptor.tabId,'failed',message);renderIfActive(descriptor.tabId);}return false;
    }
  }
  function startLoad(descriptor:Readonly<OptionalPluginDescriptor>){
    const current=files.get(descriptor.tabId);if(!current)return Promise.resolve(false);
    current.attempts+=1;markFile(descriptor.tabId,'loading','');renderIfActive(descriptor.tabId);
    const promise=new Promise<boolean>(resolve=>{
      const script=input.environment.document.createElement('script');script.async=false;script.dataset['studyDirectorPlugin']='optional';script.dataset['studyDirectorPluginTab']=descriptor.tabId;
      Reflect.set(script,'src',input.environment.trustedAssetURL(descriptor.src));
      script.onload=()=>{const state=files.get(descriptor.tabId);if(state?.state==='loading')markFile(descriptor.tabId,'loaded','The module loaded but did not register.');renderIfActive(descriptor.tabId);resolve(files.get(descriptor.tabId)?.state==='registered');};
      script.onerror=()=>{script.remove();markFile(descriptor.tabId,'missing','The optional module file could not be loaded.');renderIfActive(descriptor.tabId);resolve(false);};
      input.environment.document.head.appendChild(script);
    }).finally(()=>loadPromises.delete(descriptor.tabId));
    loadPromises.set(descriptor.tabId,promise);return promise;
  }
  function requestTab(tabIdInput:unknown,{retry=false}:Readonly<{retry?:boolean}>={}){
    const tabId=String(tabIdInput||'').trim().toLowerCase(),descriptor=descriptorsByTab.get(tabId);if(!descriptor)return null;
    const pending=loadPromises.get(tabId);if(pending)return pending;
    const record=files.get(tabId);if(record?.state==='registered')return Promise.resolve(true);
    if(record?.state==='not-requested')return startLoad(descriptor);
    if(retry&&canRetry(record))return startLoad(descriptor);
    return Promise.resolve(false);
  }
  function status():PluginRuntimeStatus{
    const optionalFiles=descriptors.map(row=>fileStatus(row.tabId)).filter((row):row is PluginFileStatus=>row!==null);
    return freeze({optionalFiles:freeze(optionalFiles),registered:freeze([...registered.values()].map(row=>freeze({...row})))});
  }
  function createPublicApi(apiInput:Readonly<PublicApiInput>):StudyDirectorPublicApi{
    if(publicApi)return publicApi;
    exactFrozenObject(apiInput,['version','data','insights','logic','plan','preview','backup','installation','appearance','ui'],'Public API composition');
    functionPort(apiInput.plan,['getDraft','loadDraft'],'Public API plan');
    functionPort(apiInput.backup,['createCheckpoint','inspect','releaseFile','receiveStream','checksum','restore','downloadSafetyCopy','device'],'Public API backup');
    functionPort(apiInput.backup.profile,['id','name','bind','deleted','controls'],'Public API backup profile');
    functionPort(apiInput.backup.providers,['register','list'],'Public API backup providers');
    functionPort(apiInput.installation,['status','promptInstall','inspectInstallation','revealInstallHelp'],'Public API installation');
    functionPort(apiInput.appearance.theme,['get','set'],'Public API theme');
    functionPort(apiInput.appearance.presentation,['list','register','get','set'],'Public API presentation');
    functionPort(apiInput.ui,['registerTab','goTab','navigationStatus'],'Public API UI');
    functionPort(apiInput.ui.workspaceHistory,['register','open','replace','close','closed'],'Public API workspace history');
    const backup=freeze({
      createCheckpoint:apiInput.backup.createCheckpoint,inspect:apiInput.backup.inspect,releaseFile:apiInput.backup.releaseFile,receiveStream:apiInput.backup.receiveStream,checksum:apiInput.backup.checksum,restore:apiInput.backup.restore,downloadSafetyCopy:apiInput.backup.downloadSafetyCopy,
      limits:freeze({maxFileBytes:apiInput.backup.maxFileBytes}),repositoryPolicy:apiInput.backup.repositoryPolicy,device:apiInput.backup.device,
      profile:freeze({...apiInput.backup.profile}),providers:freeze({...apiInput.backup.providers})
    });
    const installation=freeze({status:apiInput.installation.status,prompt:apiInput.installation.promptInstall,inspect:apiInput.installation.inspectInstallation,showHelp:apiInput.installation.revealInstallHelp});
    const appearance=freeze({
      theme:freeze({...apiInput.appearance.theme}),
      presentation:freeze({
        defaultId:apiInput.appearance.presentation.defaultId,
        get supported(){return apiInput.appearance.presentation.list();},
        invariants:apiInput.appearance.presentation.invariants,breakpoints:apiInput.appearance.presentation.breakpoints,tokens:apiInput.appearance.presentation.tokens,manifest:apiInput.appearance.presentation.manifest,
        list:apiInput.appearance.presentation.list,register:apiInput.appearance.presentation.register,get:apiInput.appearance.presentation.get,set:apiInput.appearance.presentation.set
      })
    });
    publicApi=freeze({
      version:String(apiInput.version||''),capabilities:input.configuration.capabilities,
      data:freeze({...apiInput.data}),insights:apiInput.insights,logic:apiInput.logic,plan:freeze({...apiInput.plan}),preview:apiInput.preview,backup,installation,appearance,
      ui:freeze({...apiInput.ui}),plugins:freeze({status}),registerPlugin:register
    });
    return publicApi;
  }
  return freeze({format:'study-director.public-api-host',contractVersion:1,registerPlaceholders,requestTab,status,createPublicApi});
}
const createModule=():PublicApiHostContract=>freeze({format:'study-director.public-api-host-module',contractVersion:1,createRuntime});
registry.define('public-api-host',1,createModule);return createModule;
})();
export type PublicApiHostModule=typeof sdPublicApiHostFactory;
