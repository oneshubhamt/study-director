import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {InstallCaptureBridge,InstallPromptEventPort,InstallationAction,InstallationState,NativeCapabilitiesController,NativeCapabilitiesInput,NativeCapabilitiesStatus,NativeNavigatorPort,StorageMode,SyncWakeOptions,TaskPriority,TaskScheduler,TaskSchedulerEnvironment,TaskSchedulerOptions,WakeLockSentinelPort} from '../../types/native-capabilities.ts';
const sdNativeCapabilitiesFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'native-capabilities','study-director.native-capabilities-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,functionPort:functions}=registry.contracts;
const createModule=()=>{
  const freeze=Object.freeze;
  function createTaskScheduler(environment:TaskSchedulerEnvironment=globalThis as unknown as TaskSchedulerEnvironment):Readonly<TaskScheduler>{
    const check=(signal?:AbortSignal)=>{if(signal?.aborted)throw signal.reason??new DOMException('Operation cancelled.','AbortError');};
    async function yieldTask({signal,priority='user-visible'}:TaskSchedulerOptions={}):Promise<void>{
      check(signal);
      const scheduler=environment.scheduler;
      if(priority==='background'&&typeof scheduler?.postTask==='function'){
        const options=signal?{priority:'background' as const,signal}:{priority:'background' as const};
        await scheduler.postTask(()=>{},options);
      }else if(typeof scheduler?.yield==='function')await scheduler.yield();
      else await new Promise<void>(resolve=>environment.setTimeout(resolve,0));
      check(signal);
    }
    function budget(milliseconds=8){let start=environment.performance.now();return ()=>{const now=environment.performance.now();if(now-start<milliseconds)return false;start=now;return true;};}
    return freeze({yieldTask,budget});
  }
  function createController(input:Readonly<NativeCapabilitiesInput>):Readonly<NativeCapabilitiesController>{
    if(!input||!Object.isFrozen(input))throw new TypeError('Native-capabilities input must be frozen.');
    exactObject(input,['configuration','environment','hooks'],'Native-capabilities input');
    exactObject(input.configuration,['installNoticeKey','wakePreferenceKey'],'Native-capabilities configuration');
    exactObject(input.environment,['document','navigator','window'],'Native-capabilities environment');
    functions(input.hooks,['capture','isTimerRunning','readPreference','render','writePreference'],'Native-capabilities hooks');
    const {environment,hooks}=input;
    const doc=environment.document,nav:NativeNavigatorPort=environment.navigator,win=environment.window;
    const storage=nav?.storage;
    const storageStatusSupported=typeof storage?.persisted==='function';
    const storageRequestSupported=storageStatusSupported&&typeof storage?.persist==='function';
    const wakeSupported=typeof nav?.wakeLock?.request==='function';
    const badgeSupported=typeof nav?.setAppBadge==='function'&&typeof nav?.clearAppBadge==='function';
    const installedRelatedAppsSupported=typeof nav?.getInstalledRelatedApps==='function';
    let installed=false,revision=0;
    let storageMode:StorageMode=storageStatusSupported?'checking':'unsupported',storageBusy=false,storageMessage='';
    let keepAwake=false,wakeSentinel:WakeLockSentinelPort|null=null,wakeRequest:Promise<boolean>|null=null;
    let installPrompt:InstallPromptEventPort|null=null,installFeedback='',standalone=false,installedEvent=false,relatedInstalled=false;
    let installing=false,installInspecting=false,installInspectionPromise:Promise<NativeCapabilitiesStatus>|null=null,installHelpRequested=false,installNoticeVisible=false,installNoticeOffered=false;
    let badgeActive:boolean|null=null;

    function capture(scope:string,error:unknown){try{hooks.capture(scope,error);}catch{}}
    function isStandalone(){
      try{return nav?.standalone===true||!!win.matchMedia?.('(display-mode: standalone)').matches;}
      catch{return false;}
    }
    function userAgent(){return String(nav?.userAgent||'');}
    function isDesktopModeIPad(){return String(nav?.platform||'')==='MacIntel'&&Number(nav?.maxTouchPoints||0)>1;}
    function platformName(){
      const value=`${String(nav?.userAgentData?.platform||'')} ${String(nav?.platform||'')} ${userAgent()}`;
      if(/android/i.test(value))return 'android';
      if(isDesktopModeIPad()||/ipad|iphone|ipod/i.test(value))return 'ios';
      if(/mac/i.test(value))return 'macos';
      if(/win/i.test(value))return 'windows';
      if(/linux|x11/i.test(value))return 'linux';
      return 'other';
    }
    function browserName(){
      const value=userAgent();
      if(/edg(?:e|ios|a)?\//i.test(value))return 'edge';
      if(/firefox|fxios/i.test(value))return 'firefox';
      if(/crios|chrome|chromium/i.test(value))return 'chrome';
      if(/safari/i.test(value)&&!/android/i.test(value))return 'safari';
      return 'other';
    }
    function deviceName(){
      const platform=platformName(),ua=userAgent();
      if(platform==='ios')return isDesktopModeIPad()||/ipad/i.test(ua)?'iPad':/iphone|ipod/i.test(ua)?'iPhone':'iPhone or iPad';
      if(platform==='android')return /mobile/i.test(ua)?'Android phone':'Android tablet';
      if(platform==='macos')return 'Mac';
      if(platform==='windows')return 'Windows PC';
      if(platform==='linux')return 'Linux computer';
      return 'This device';
    }
    function browserLabel(){
      const browser=browserName();
      return browser==='chrome'?'Chrome':browser==='edge'?'Edge':browser==='firefox'?'Firefox':browser==='safari'?'Safari':'Browser';
    }
    function installedConfirmed(){return standalone||installedEvent||relatedInstalled;}
    function installationState():InstallationState{
      if(standalone)return 'opened-as-app';
      if(installedEvent||relatedInstalled)return 'installed';
      if(installing)return 'installing';
      if(installPrompt)return 'available';
      return 'manual';
    }
    function installationLabel(state:InstallationState=installationState()){
      return state==='opened-as-app'?'Opened as app':state==='installed'?'Installed':state==='installing'?'Installing…':state==='available'?'Ready to install':'Browser setup needed';
    }
    function installationAction(state:InstallationState=installationState()):InstallationAction{
      return state==='available'?'install':state==='installed'?'find':state==='manual'?'help':'none';
    }
    function installationActionLabel(action:InstallationAction=installationAction()){
      return action==='install'?'Install app':action==='find'?'Where to find it':action==='help'?'How to install':'';
    }
    function installationSummary(state:InstallationState=installationState()){
      return state==='opened-as-app'?'Study Director is running in its installed app window.':
        state==='installed'?'Study Director is installed on this device.':
        state==='installing'?'Complete the browser installation step.':
        state==='available'?'Install for easier access and a dedicated app window.':
        `Follow the ${deviceName()} steps below to add a standalone Study Director app.`;
    }
    function installationGuidance(state:InstallationState=installationState()){
      const platform=platformName(),browser=browserName();
      const steps:string[]=[],fallback:string[]=[];
      if(state==='opened-as-app')steps.push('You are already using Study Director in its installed app window.');
      if(state==='installed'){
        if(platform==='android')steps.push('Open your app list and tap Study Director.','To add it to the Home screen, long-press Study Director and drag it into place.');
        else if(platform==='ios')steps.push('Return to the Home Screen and tap the Study Director icon.');
        else if(platform==='macos')steps.push('Open Study Director from Applications, Spotlight or Launchpad.','After it opens, Control-click its Dock icon and choose Options → Keep in Dock if you want it there.');
        else if(platform==='windows')steps.push('Open the Start menu, search for Study Director, and open it.','Right-click the result to pin it to Start or the taskbar if useful.');
        else steps.push('Open Study Director from your system app launcher.');
      }
      if(!steps.length&&platform==='ios'){
        steps.push(`Open Study Director in ${browserLabel()}.`,'Tap the Share button in the browser toolbar.','Choose Add to Home Screen. If it is hidden, scroll through the actions or choose Edit Actions.','Review the name, tap Add, then open Study Director from the Home Screen.');
        if(browser!=='safari'&&browser!=='chrome')fallback.push('If Add to Home Screen is unavailable in this browser, open this page in Safari and repeat the steps.');
      }else if(!steps.length&&platform==='android'){
        if(browser==='firefox')steps.push('Tap the three-dot menu.','Choose Install.','Confirm with Add or Add automatically.');
        else if(browser==='edge')steps.push('Tap the three-dot menu.','Choose Add to phone or Install app.','Confirm the installation.');
        else steps.push('Tap the three-dot browser menu.','Choose Install app. In some Chrome versions this is under Add to Home screen or Install and create shortcut.','Confirm with Install.');
        fallback.push('If no install choice appears, refresh once. If it is still absent, open this page in the latest Chrome.');
      }else if(!steps.length&&platform==='macos'&&browser==='safari'){
        steps.push('In Safari, open the File menu.','Choose Add to Dock.','Confirm the app name, then choose Add.');
        fallback.push('Add to Dock requires macOS Sonoma 14 or later. On an older Mac, bookmark the page or install it from current Chrome or Edge.');
      }else if(!steps.length&&browser==='edge'){
        steps.push('Open the three-dot menu.','Choose Apps → Install Study Director.','Confirm with Install.');
        fallback.push('You can also use the install icon at the right side of the address bar when it appears.');
      }else if(!steps.length&&browser==='chrome'){
        steps.push('Select the install icon at the right side of Chrome’s address bar.','If there is no icon, open the three-dot menu and choose Install Study Director or Cast, save, and share → Install page as app.','Confirm with Install.');
      }else if(!steps.length&&browser==='firefox'&&platform==='windows'){
        steps.push('Look for the web-app icon at the right side of Firefox’s address bar.','Select the icon, then confirm the installation.');
        fallback.push('If the icon is absent, this Firefox version or profile does not offer web-app installation. Open the page in current Edge or Chrome.');
      }else if(!steps.length&&browser==='firefox'){
        fallback.push('Firefox on this computer does not currently provide a standalone web-app install for this page. Open it in current Chrome or Edge and use that browser’s install option.');
      }else if(!steps.length){
        steps.push('Open the browser menu.','Choose Install app, Install Study Director or Add to Home Screen.','Confirm the installation, then open Study Director from your app launcher.');
        fallback.push('If your browser has no install option, open this page in current Chrome, Edge or Safari.');
      }
      return freeze({context:`${deviceName()} · ${browserLabel()}`,steps:freeze(steps),fallback:freeze(fallback)});
    }
    function installationInstructions(state:InstallationState=installationState()){
      const guidance=installationGuidance(state);
      return [...guidance.steps,...guidance.fallback].join(' ');
    }
    function snapshot():NativeCapabilitiesStatus{
      standalone=isStandalone();
      const state=installationState(),action=installationAction(state);
      const guidance=installationGuidance(state);
      return freeze({
        format:'study-director.native-capabilities-status',contractVersion:1,
        installed,revision,
        storageStatusSupported,storageRequestSupported,storageMode,storageBusy,storageMessage,
        wakeSupported,keepAwake,wakeAcquired:!!wakeSentinel,wakeRequesting:!!wakeRequest,
        installedRelatedAppsSupported,installInspecting,installAvailable:!!installPrompt&&!standalone,standalone,
        installedConfirmed:installedConfirmed(),installationState:state,installationLabel:installationLabel(state),
        installationAction:action,installationActionLabel:installationActionLabel(action),installationSummary:installationSummary(state),
        installationContext:guidance.context,installationSteps:guidance.steps,installationFallback:guidance.fallback,
        installationInstructions:installationInstructions(state),installFeedback,installHelpRequested,installNoticeVisible,
        iosGuidance:platformName()==='ios'&&!standalone&&!installPrompt,installMessage:installFeedback,
        badgeSupported,badgeActive:badgeActive===true
      });
    }
    function publish(){revision+=1;const state=snapshot();hooks.render(state);return state;}
    function readWakePreference(){
      try{return hooks.readPreference(input.configuration.wakePreferenceKey)===true;}
      catch(error){capture('native.wake-preference-read',error);return false;}
    }
    function writeWakePreference(value:boolean){
      try{return hooks.writePreference(input.configuration.wakePreferenceKey,value===true)!==false;}
      catch(error){capture('native.wake-preference-write',error);return false;}
    }
    function installNoticeWasShown(){
      try{return hooks.readPreference(input.configuration.installNoticeKey)===true;}
      catch(error){capture('native.install-notice-read',error);return false;}
    }
    function rememberInstallNotice(){
      try{return hooks.writePreference(input.configuration.installNoticeKey,true)!==false;}
      catch(error){capture('native.install-notice-write',error);return false;}
    }
    async function inspectStorage(){
      const persisted=storage?.persisted;
      if(typeof persisted!=='function'){storageMode='unsupported';storageMessage='Browser-managed storage is in use; persistent-storage requests are unavailable here.';return publish();}
      storageBusy=true;storageMessage='';publish();
      const persist=storage?.persist;
      let canRequest=false;
      try{
        const alreadyProtected=(await persisted.call(storage))===true;
        storageMode=alreadyProtected?'protected':'standard';
        canRequest=!alreadyProtected&&typeof persist==='function';
      }catch(error){storageMode='standard';capture('native.storage-status',error);}
      if(canRequest&&persist){
        try{
          storageMode=(await persist.call(storage))===true?'protected':'standard';
          storageMessage=storageMode==='protected'
            ? 'Persistent local storage is enabled for this browser profile.'
            : 'The browser kept Study Director in browser-managed storage. You can try protection again here.';
        }catch(error){
          storageMode='standard';storageMessage='The browser kept Study Director in browser-managed storage. You can try protection again here.';
          capture('native.storage-protect-auto',error);
        }
      }else if(storageMode==='protected')storageMessage='Persistent local storage is enabled for this browser profile.';
      storageBusy=false;
      return publish();
    }
    async function protectLocalData(){
      const persist=storage?.persist;
      if(typeof persist!=='function'){
        storageMode=storageStatusSupported?'standard':'unsupported';
        storageMessage='Browser-managed storage is in use; persistent-storage requests are unavailable here.';
        return publish();
      }
      storageBusy=true;storageMessage='Requesting browser storage protection…';publish();
      try{
        storageMode=(await persist.call(storage))===true?'protected':'standard';
        storageMessage=storageMode==='protected'
          ? 'Persistent local storage is enabled for this browser profile.'
          : 'The browser kept Study Director in browser-managed storage. You can try protection again here.';
      }catch(error){
        storageMode='standard';storageMessage='The browser kept Study Director in browser-managed storage. You can try protection again here.';
        capture('native.storage-protect',error);
      }finally{storageBusy=false;}
      return publish();
    }
    function shouldHoldWakeLock(){return wakeSupported&&keepAwake&&!doc.hidden&&hooks.isTimerRunning()===true;}
    async function releaseWakeLock(){
      const sentinel=wakeSentinel;wakeSentinel=null;
      if(!sentinel)return false;
      try{if(!sentinel.released&&typeof sentinel.release==='function')await sentinel.release();}
      catch(error){capture('native.wake-release',error);}
      return true;
    }
    async function requestWakeLock(){
      if(wakeRequest)return wakeRequest;
      wakeRequest=(async()=>{
        try{
          const wakeLock=nav?.wakeLock;
          if(!wakeLock)return false;
          const sentinel=await wakeLock.request('screen');
          if(!shouldHoldWakeLock()){
            try{await sentinel.release();}catch(error){capture('native.wake-late-release',error);}
            return false;
          }
          wakeSentinel=sentinel;
          if(typeof sentinel.addEventListener==='function')sentinel.addEventListener('release',()=>{
            if(wakeSentinel===sentinel){wakeSentinel=null;publish();}
          },{once:true});
          return true;
        }catch(error){capture('native.wake-request',error);return false;}
        finally{wakeRequest=null;publish();}
      })();
      publish();
      return wakeRequest;
    }
    async function syncWake(options:SyncWakeOptions={}){
      if(!wakeSupported)return false;
      if(options.forceCycle===true)await releaseWakeLock();
      if(!shouldHoldWakeLock()){
        const released=await releaseWakeLock();
        if(released)publish();
        return false;
      }
      if(wakeSentinel&&!wakeSentinel.released)return true;
      return requestWakeLock();
    }
    async function setKeepAwake(value:unknown){
      keepAwake=value===true;
      if(!writeWakePreference(keepAwake))keepAwake=readWakePreference();
      publish();
      await syncWake();
      return snapshot();
    }
    function installPromptEvent(value:unknown):InstallPromptEventPort|null{
      if(!value||typeof value!=='object')return null;
      const candidate=value as Partial<InstallPromptEventPort>;
      return typeof candidate.prompt==='function'?candidate as InstallPromptEventPort:null;
    }
    function handleBeforeInstallPrompt(event:Event){
      const prompt=installPromptEvent(event);
      if(!prompt)return;
      prompt.preventDefault?.();
      if(standalone||installedEvent)return;
      installPrompt=prompt;installing=false;installFeedback='';publish();
    }
    function handleInstalled(){installPrompt=null;installedEvent=true;installing=false;installFeedback='Installed on this device.';installNoticeVisible=false;publish();}
    function installCaptureBridge():InstallCaptureBridge|null{
      const value=(win as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.installCapture.v1')];
      if(!value||typeof value!=='object')return null;
      const bridge=value as Partial<InstallCaptureBridge>;
      return typeof bridge.status==='function'&&typeof bridge.subscribe==='function'?bridge as InstallCaptureBridge:null;
    }
    function connectInstallCapture(){
      const bridge=installCaptureBridge();
      if(bridge){
        const current=bridge.status();
        const currentPrompt=installPromptEvent(current?.prompt);
        if(currentPrompt)handleBeforeInstallPrompt(currentPrompt as unknown as Event);
        if(current?.installed)handleInstalled();
        bridge.subscribe(event=>{
          const prompt=installPromptEvent(event?.prompt);
          if(event?.type==='prompt'&&prompt)handleBeforeInstallPrompt(prompt as unknown as Event);
          if(event?.type==='installed')handleInstalled();
        });
        return;
      }
      win.addEventListener('beforeinstallprompt',handleBeforeInstallPrompt);
      win.addEventListener('appinstalled',handleInstalled);
    }
    async function inspectInstallation(){
      if(installInspectionPromise)return installInspectionPromise;
      standalone=isStandalone();
      const inspect=nav?.getInstalledRelatedApps;
      if(typeof inspect!=='function'){publish();return snapshot();}
      installInspectionPromise=(async()=>{
        installInspecting=true;publish();
        try{
          const apps=await inspect.call(nav);
          relatedInstalled=Array.isArray(apps)&&apps.some(app=>app?.platform==='webapp');
          if(relatedInstalled){installing=false;installPrompt=null;}
        }catch(error){capture('native.install-inspection',error);}
        finally{installInspecting=false;installInspectionPromise=null;publish();}
        return snapshot();
      })();
      return installInspectionPromise;
    }
    function revealInstallHelp(){installHelpRequested=true;installFeedback='';return publish();}
    async function offerInstallNotice(){
      if(installedRelatedAppsSupported)await inspectInstallation();
      if(installNoticeOffered||installedConfirmed()||installNoticeWasShown())return snapshot();
      installNoticeOffered=true;rememberInstallNotice();
      installNoticeVisible=true;return publish();
    }
    function dismissInstallNotice(){installNoticeVisible=false;return publish();}
    async function promptInstall(){
      const prompt=installPrompt;
      if(!prompt||isStandalone()||installedConfirmed())return false;
      installPrompt=null;installFeedback='';publish();
      try{
        await prompt.prompt();
        const choice=prompt.userChoice?await prompt.userChoice:null;
        const accepted=choice?.outcome==='accepted';
        installing=accepted&&!installedEvent&&!relatedInstalled&&!isStandalone();
        installFeedback=accepted?(installedConfirmed()?'Installed on this device.':'Installation accepted. Finish the browser step if it is still open.'):'Installation was not completed.';
        if(accepted)installNoticeVisible=false;
        publish();
        if(accepted)await inspectInstallation();
        return accepted;
      }catch(error){capture('native.install-prompt',error);installing=false;installFeedback='Installation could not start in this browser.';publish();return false;}
    }
    async function updateBadge(active:unknown){
      const next=active===true;
      if(!badgeSupported){badgeActive=false;return false;}
      if(badgeActive===next)return true;
      try{
        if(next)await nav.setAppBadge!(1);else await nav.clearAppBadge!();
        badgeActive=next;return true;
      }catch(error){capture('native.badge',error);return false;}
      finally{publish();}
    }
    function handleVisibility(){void syncWake();}
    function install(){
      if(installed)return snapshot();
      installed=true;standalone=isStandalone();keepAwake=wakeSupported&&readWakePreference();
      doc.addEventListener('visibilitychange',handleVisibility);
      connectInstallCapture();
      const displayMode=win.matchMedia?.('(display-mode: standalone)');
      displayMode?.addEventListener?.('change',publish);
      publish();void inspectInstallation();void syncWake();return snapshot();
    }
    return freeze({
      format:'study-director.native-capabilities',contractVersion:1,
      install,status:snapshot,inspectStorage,protectLocalData,inspectInstallation,promptInstall,revealInstallHelp,
      offerInstallNotice,dismissInstallNotice,setKeepAwake,syncWake,updateBadge
    });
  }
  return freeze({format:'study-director.native-capabilities-module',contractVersion:1,createController,createTaskScheduler});
};
registry.define('native-capabilities',1,createModule);return createModule;
})();
export type NativeCapabilitiesModule=ReturnType<typeof sdNativeCapabilitiesFactory>;
