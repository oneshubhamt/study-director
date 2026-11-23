import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {OptionalPluginDescriptor,PluginFileState,PluginFileStatus,PluginRegistrationStatus,PluginRuntimeStatus,PublicApiHostModule as PublicApiHostContract,PublicApiInput,PublicApiRuntime,PublicApiRuntimeInput,StudyDirectorPluginDescriptor,StudyDirectorPublicApi} from '../../types/public-api-host.ts';
import type {InsightsPreviewProvider} from './insights-host.ts';
const sdPublicApiHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'public-api-host','study-director.public-api-host-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
const {exactFrozenObject,functionPort}=registry.contracts,freeze=Object.freeze;
const ensureFunctions=(value:object,names:readonly string[],label:string)=>{const row=value as Record<string,unknown>;for(const name of names)if(typeof row[name]!=='function')throw new TypeError(label+' is unavailable or incompatible.');};
const MAX_LOAD_ATTEMPTS=2,MAX_REGISTRATION_ATTEMPTS=2;
const isRecord=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);

function createRuntime(input:Readonly<PublicApiRuntimeInput>):Readonly<PublicApiRuntime>{
  exactFrozenObject(input,['configuration','environment','tabs','preview','clampText'],'Public API runtime input');
  exactFrozenObject(input.configuration,['capabilities','descriptors'],'Public API configuration');
  exactFrozenObject(input.environment,['document','trustedAssetURL'],'Public API environment');
  exactFrozenObject(input.tabs,['registerTab','renderTab'],'Public API tab ports');
  exactFrozenObject(input.preview,['registerProvider'],'Public API preview ports');
  ensureFunctions(input.environment,['trustedAssetURL'],'Public API environment');
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

  const descriptorsByTab=new Map(descriptors.map(descriptor=>[descriptor.tabId,descriptor] as const));
  const descriptorsByPlugin=new Map(descriptors.map(descriptor=>[descriptor.pluginName,descriptor] as const));
  const files=new Map<string,PluginFileStatus>(descriptors.map(descriptor=>[descriptor.tabId,freeze({...descriptor,state:'not-requested' as PluginFileState,detail:'',attempts:0,updatedAt:null})]));
  const loadPromises=new Map<string,Promise<boolean>>();
  const registered=new Map<string,PluginRegistrationStatus>();
  let publicApi:StudyDirectorPublicApi|null=null;
  const nowStamp=()=>new Date().toISOString();

  function fileState(tabId:string):PluginFileStatus|null{
    const descriptor=descriptorsByTab.get(tabId);
    return descriptor?(files.get(tabId)||freeze({...descriptor,state:'not-requested',detail:'',attempts:0,updatedAt:null})):null;
  }
  function markFile(tabId:string,state:PluginFileState,detail='',attempts:number|null=null):PluginFileStatus|null{
    const descriptor=descriptorsByTab.get(tabId);if(!descriptor)return null;
    const previous=fileState(tabId);
    const next=freeze({
      ...descriptor,state,
      detail:input.clampText(detail||'',200),
      attempts:attempts===null?Math.max(0,Number(previous?.attempts)||0):Math.max(0,Number(attempts)||0),
      updatedAt:nowStamp()
    });
    files.set(tabId,next);
    const pane=input.environment.document.getElementById('pane-'+tabId);
    if(pane)pane.setAttribute('aria-busy',state==='loading'?'true':'false');
    return next;
  }
  function activeTabId(){return input.environment.document.querySelector<HTMLElement>('.nav-item.on[data-tab]')?.dataset['tab']||'';}
  function renderIfActive(tabId:string){if(activeTabId()===tabId)input.tabs.renderTab(tabId);}
  function canRetry(record:PluginFileStatus|null){return !!record&&(['loaded','missing','failed'] as PluginFileState[]).includes(record.state)&&record.attempts<MAX_LOAD_ATTEMPTS;}
  function placeholderMessage(record:PluginFileStatus){
    if(record.state==='loading')return `Loading ${record.label}…`;
    if(record.state==='missing')return `${record.label} could not be loaded. The core app remains available.`;
    if(record.state==='incompatible')return `${record.label} is not compatible with this core build.`;
    if(record.state==='failed')return `${record.label} could not start. The core app remains available.`;
    if(record.state==='loaded')return `${record.label} loaded but did not register.`;
    if(record.state==='registered')return `Opening ${record.label}…`;
    return `${record.label} loads only when you open this tab.`;
  }
  function renderPlaceholder(context:Readonly<{pane:HTMLElement|null}>|null|undefined,descriptor:Readonly<OptionalPluginDescriptor>){
    const pane=context?.pane;if(!pane)return;
    const record=fileState(descriptor.tabId);if(!record)return;
    pane.setAttribute('aria-busy',record.state==='loading'?'true':'false');
    const panel=input.environment.document.createElement('section');
    const insightsLoading=descriptor.tabId==='insights'&&!['missing','incompatible','failed','loaded'].includes(record.state);
    panel.className='ui-panel'+(insightsLoading?' plugin-loading-panel':'');
    const kicker=input.environment.document.createElement('div');kicker.className='ui-label';kicker.textContent=insightsLoading?'Study Coach + Evidence Dashboard':'Optional module';
    const title=input.environment.document.createElement('h1');title.className='ui-title';title.textContent=descriptor.label;
    const status=input.environment.document.createElement('div');
    const isError=['missing','incompatible','failed','loaded'].includes(record.state);
    status.className='ui-status'+(isError?' err':'');status.setAttribute('role',isError?'alert':'status');status.setAttribute('aria-live',isError?'assertive':'polite');
    status.textContent=insightsLoading?(record.state==='registered'?'Opening Insights…':'Preparing your saved study history…'):placeholderMessage(record);
    panel.append(kicker,title,status);
    if(insightsLoading){
      const copy=input.environment.document.createElement('div');copy.className='ui-body plugin-loading-copy';copy.textContent='Insights is loading once for this app session. Your existing page will be retained on later visits unless its source data changes.';
      const track=input.environment.document.createElement('div');track.className='plugin-loading-track';track.setAttribute('aria-hidden','true');panel.append(copy,track);
    }
    if(record.detail){const detail=input.environment.document.createElement('div');detail.className='ui-helper';detail.textContent=record.detail;panel.appendChild(detail);}
    if(canRetry(record)){
      const retry=input.environment.document.createElement('button');retry.className='mini-btn ui-btn';retry.type='button';retry.textContent='Retry loading';
      retry.addEventListener('click',()=>{void requestTab(descriptor.tabId,{retry:true});renderIfActive(descriptor.tabId);});panel.appendChild(retry);
    }
    pane.replaceChildren(panel);
  }
  function registerPlaceholders(){
    let complete=true;
    for(const descriptor of descriptors){
      if(!input.tabs.registerTab({id:descriptor.tabId,label:descriptor.label,icon:descriptor.icon,render:context=>renderPlaceholder(context,descriptor)}))complete=false;
    }
    return complete;
  }
  type NormalizedPluginDescriptor=Readonly<{source:Record<string,unknown>;name:string;version:string;requires:Readonly<Record<string,number>>;previewProviders:Readonly<Record<string,InsightsPreviewProvider>>;setup:StudyDirectorPluginDescriptor['setup']}>;
  const isPluginSetup=(value:unknown):value is StudyDirectorPluginDescriptor['setup']=>typeof value==='function';
  const isPreviewProvider=(value:unknown):value is InsightsPreviewProvider=>typeof value==='function';
  function normalizePluginDescriptor(value:unknown):NormalizedPluginDescriptor|null{
    if(!isRecord(value)||!isPluginSetup(value['setup'])||typeof value['name']!=='string')return null;
    const name=input.clampText(value['name'],80).trim();if(!name)return null;
    let version='';if(value['version']!==undefined){if(typeof value['version']!=='string')return null;version=input.clampText(value['version'],40);}
    const requirementEntries:Array<[string,number]>=[];
    if(value['requires']!==undefined){
      if(!isRecord(value['requires']))return null;
      for(const [key,minimum] of Object.entries(value['requires'])){if(!key||typeof minimum!=='number'||!Number.isFinite(minimum)||minimum<0)return null;requirementEntries.push([key,minimum]);}
    }
    const previewEntries:Array<[string,InsightsPreviewProvider]>=[];
    if(value['previewProviders']!==undefined){
      if(!isRecord(value['previewProviders']))return null;
      for(const [target,provider] of Object.entries(value['previewProviders'])){if(!target||!isPreviewProvider(provider))return null;previewEntries.push([target,provider]);}
    }
    return freeze({source:value,name,version,requires:freeze(Object.fromEntries(requirementEntries)),previewProviders:freeze(Object.fromEntries(previewEntries)),setup:value['setup']});
  }
  function unmetCapabilities(requirements:Readonly<Record<string,number>>):Array<[string,number]>{
    return Object.entries(requirements).filter(([key,minimum])=>{
      const available=Object.hasOwn(input.configuration.capabilities,key)?input.configuration.capabilities[key]:0;
      return (typeof available==='number'?available:0)<minimum;
    });
  }
  function register(value:unknown){
    if(!publicApi)return false;
    let plugin:NormalizedPluginDescriptor|null=null;
    try{plugin=normalizePluginDescriptor(value);}catch{return false;}
    if(!plugin)return false;
    const {name}=plugin,descriptor=descriptorsByPlugin.get(name)||null,previous=registered.get(name);
    if(previous?.state==='registered'){
      if(descriptor){markFile(descriptor.tabId,'registered','',fileState(descriptor.tabId)?.attempts??null);renderIfActive(descriptor.tabId);}return true;
    }
    if(previous?.state==='incompatible'){
      if(descriptor){markFile(descriptor.tabId,'incompatible',previous.detail||'',fileState(descriptor.tabId)?.attempts??null);renderIfActive(descriptor.tabId);}return false;
    }
    const attempts=Math.max(0,Number(previous?.attempts)||0);
    if(attempts>=MAX_REGISTRATION_ATTEMPTS){
      if(descriptor){markFile(descriptor.tabId,'failed','Registration attempt limit reached.',fileState(descriptor.tabId)?.attempts??null);renderIfActive(descriptor.tabId);}return false;
    }
    const nextAttempt=attempts+1,unmet=unmetCapabilities(plugin.requires);
    if(unmet.length){
      const detail='Missing capabilities: '+unmet.map(([key,minimum])=>`${key}>=${minimum}`).join(', ');
      registered.set(name,{name,version:plugin.version,state:'incompatible',attempts:nextAttempt,detail:input.clampText(detail,160),updatedAt:nowStamp()});
      if(descriptor){markFile(descriptor.tabId,'incompatible',detail,fileState(descriptor.tabId)?.attempts??null);renderIfActive(descriptor.tabId);}return false;
    }
    try{
      const ok=Reflect.apply(plugin.setup,plugin.source,[publicApi])!==false,detail=ok?'':'Plugin setup did not activate.';
      if(ok)for(const [target,provider] of Object.entries(plugin.previewProviders))input.preview.registerProvider(target,provider);
      registered.set(name,{name,version:plugin.version,state:ok?'registered':'inactive',attempts:nextAttempt,detail,updatedAt:nowStamp()});
      if(descriptor){markFile(descriptor.tabId,ok?'registered':'failed',detail,fileState(descriptor.tabId)?.attempts??null);renderIfActive(descriptor.tabId);}return ok;
    }catch(error){
      const detail=input.clampText(isRecord(error)&&typeof error['message']==='string'&&error['message']||String(error),160);
      registered.set(name,{name,version:plugin.version,state:'failed',attempts:nextAttempt,detail,updatedAt:nowStamp()});
      if(descriptor){markFile(descriptor.tabId,'failed',detail,fileState(descriptor.tabId)?.attempts??null);renderIfActive(descriptor.tabId);}return false;
    }
  }
  function startLoad(descriptor:Readonly<OptionalPluginDescriptor>){
    const previous=fileState(descriptor.tabId),attempts=Math.max(0,Number(previous?.attempts)||0)+1;
    markFile(descriptor.tabId,'loading','',attempts);
    const promise=new Promise<boolean>(resolve=>{
      const script=input.environment.document.createElement('script');
      Reflect.set(script,'src',input.environment.trustedAssetURL(descriptor.src));script.async=false;script.dataset['studyDirectorPlugin']='optional';script.dataset['studyDirectorPluginTab']=descriptor.tabId;
      script.onload=()=>{const latest=fileState(descriptor.tabId);if(latest?.state==='loading')markFile(descriptor.tabId,'loaded','Plugin file loaded but did not register.',attempts);renderIfActive(descriptor.tabId);resolve(fileState(descriptor.tabId)?.state==='registered');};
      script.onerror=()=>{script.remove();markFile(descriptor.tabId,'missing',`Could not load ${descriptor.src}.`,attempts);renderIfActive(descriptor.tabId);resolve(false);};
      input.environment.document.head.appendChild(script);
    });
    loadPromises.set(descriptor.tabId,promise);
    void promise.finally(()=>{if(loadPromises.get(descriptor.tabId)===promise)loadPromises.delete(descriptor.tabId);});
    return promise;
  }
  function requestTab(tabIdInput:unknown,{retry=false}:Readonly<{retry?:boolean}>={}){
    const descriptor=descriptorsByTab.get(String(tabIdInput||'').trim());if(!descriptor)return null;
    const pending=loadPromises.get(descriptor.tabId);if(pending)return pending;
    const record=fileState(descriptor.tabId);
    if(record?.state==='registered')return Promise.resolve(true);
    if(record?.state==='not-requested')return startLoad(descriptor);
    if(retry&&canRetry(record))return startLoad(descriptor);
    return Promise.resolve(false);
  }
  function status():PluginRuntimeStatus{return {optionalFiles:descriptors.map(descriptor=>fileState(descriptor.tabId)).filter((row):row is PluginFileStatus=>row!==null),registered:[...registered.values()]};}

  function createPublicApi(apiInput:Readonly<PublicApiInput>):StudyDirectorPublicApi{
    if(publicApi)return publicApi;
    exactFrozenObject(apiInput,['version','data','insights','logic','plan','preview','backup','installation','appearance','ui'],'Public API composition');
    functionPort(apiInput.plan,['getDraft','loadDraft'],'Public API plan');
    ensureFunctions(apiInput.backup,['createCheckpoint','inspect','releaseFile','receiveStream','checksum','restore','downloadSafetyCopy','device'],'Public API backup');
    functionPort(apiInput.backup.profile,['id','name','bind','deleted','controls'],'Public API backup profile');
    functionPort(apiInput.backup.providers,['register','list'],'Public API backup providers');
    functionPort(apiInput.installation,['status','promptInstall','inspectInstallation','revealInstallHelp'],'Public API installation');
    ensureFunctions(apiInput.appearance.theme,['get','set'],'Public API theme');
    ensureFunctions(apiInput.appearance.presentation,['list','register','get','set'],'Public API presentation');
    ensureFunctions(apiInput.ui,['registerTab','goTab','navigationStatus'],'Public API UI');
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
  return freeze({format:'study-director.public-api-host',contractVersion:1,registerPlaceholders,requestTab,register,status,createPublicApi});
}
const createModule=():PublicApiHostContract=>freeze({format:'study-director.public-api-host-module',contractVersion:1,createRuntime});
registry.define('public-api-host',1,createModule);return createModule;
})();
export type PublicApiHostModule=ReturnType<typeof sdPublicApiHostFactory>;
