import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {PersonalPreferences} from '../../types/record-models.ts';
import type {PresentationHostController,PresentationHostInput} from '../../types/presentation-host.ts';

const sdPresentationHostFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'presentation-host','study-director.presentation-host-module'>|undefined;
if(!registry||registry.version!==1)throw new Error('Study Director internal module registry is unavailable.');
const freeze=Object.freeze;
const FONT_SCALE_STEPS=freeze([0.95,1,1.08,1.16]);

function createController(input:Readonly<PresentationHostInput>):Readonly<PresentationHostController>{
  const {kernel,document,window,storage,preferences,ownership,diagnostics,popovers}=input;
  if(kernel.format!=='study-director.presentation-kernel'||kernel.version!==1||kernel.manifest.format!=='study-director.presentation-manifest'||kernel.manifest.version!==1){
    throw new TypeError('Study Director presentation kernel is unavailable or incompatible.');
  }
  const root=document.documentElement;
  let appearanceShiftTimer:number|null=null,displayToolsPopover:ReturnType<PresentationHostInput['popovers']['create']>|null=null;

  function beginAppearanceShift():void{
    root.setAttribute('data-sd-appearance-shift','');
    if(appearanceShiftTimer!==null)window.clearTimeout(appearanceShiftTimer);
    appearanceShiftTimer=window.setTimeout(()=>{appearanceShiftTimer=null;root.removeAttribute('data-sd-appearance-shift');},520);
  }
  function runAppearanceChange(origin:HTMLElement|null,change:()=>void):void{
    const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduce||document.visibilityState!=='visible'){change();return;}
    if(typeof document.startViewTransition!=='function'){beginAppearanceShift();change();return;}
    const rect=origin?.getBoundingClientRect()??null;
    const x=rect?rect.left+rect.width/2:window.innerWidth/2,y=rect?rect.top+rect.height/2:window.innerHeight/2;
    const radius=Math.hypot(Math.max(x,window.innerWidth-x),Math.max(y,window.innerHeight-y));
    root.style.setProperty('--sd-reveal-x',`${Math.round(x)}px`);
    root.style.setProperty('--sd-reveal-y',`${Math.round(y)}px`);
    root.style.setProperty('--sd-reveal-radius',`${Math.ceil(radius)}px`);
    root.setAttribute('data-sd-appearance-reveal','');
    const settle=()=>{root.removeAttribute('data-sd-appearance-reveal');['--sd-reveal-x','--sd-reveal-y','--sd-reveal-radius'].forEach(name=>root.style.removeProperty(name));};
    try{
      const transition=document.startViewTransition(change);
      void Promise.resolve(transition.finished).then(settle,settle);
      void Promise.resolve(transition.ready).catch(()=>undefined);
    }catch{
      root.removeAttribute('data-sd-appearance-reveal');change();
    }
  }
  function renderThemeControls():void{
    const controls=document.getElementById('theme-controls');if(!controls)return;
    const ids=Object.keys(kernel.manifest.themes),shouldExpose=ids.length>1;
    controls.hidden=!shouldExpose;if(!shouldExpose){controls.replaceChildren();return;}
    const label=document.createElement('span');label.className='theme-controls-label ui-label';label.textContent='Theme';
    const active=kernel.activeThemeId(),buttons:HTMLButtonElement[]=[];
    for(const id of ids){
      const definition=kernel.manifest.themes[id];if(!definition)continue;
      const button=document.createElement('button');button.className='theme-btn';button.type='button';
      button.dataset['action']='set-theme';button.dataset['themeId']=id;button.textContent=definition.label;
      button.setAttribute('aria-pressed',id===active?'true':'false');buttons.push(button);
    }
    controls.replaceChildren(label,...buttons);
  }
  function applyTheme(themeId:unknown,{persist=false,restoreFocus=false}:Readonly<{persist?:boolean;restoreFocus?:boolean}>={}):string{
    const clean=kernel.switchTheme(themeId,{persist:false});
    if(persist)preferences.persist({theme:clean});
    renderThemeControls();
    if(restoreFocus)document.querySelector<HTMLElement>(`.theme-btn[data-theme-id="${CSS.escape(clean)}"]`)?.focus();
    return clean;
  }
  function setTheme(themeId:unknown,{restoreFocus=false,origin=null}:Readonly<{restoreFocus?:boolean;origin?:HTMLElement|null}>={}):string{
    if(!ownership.require('change appearance settings'))return kernel.activeThemeId();
    const clean=kernel.normalizeThemeId(themeId);
    if(clean===kernel.activeThemeId())return applyTheme(clean,{persist:true,restoreFocus});
    runAppearanceChange(origin,()=>{applyTheme(clean,{persist:true,restoreFocus});});
    return clean;
  }
  function handleThemeSelection(event:Event):void{
    const target=event.target;if(!(target instanceof Element))return;
    const control=target.closest<HTMLElement>('[data-theme-id]');if(control)setTheme(control.dataset['themeId'],{restoreFocus:true,origin:control});
  }
  function renderPresentationControls():void{
    const controls=document.getElementById('presentation-controls');if(!controls)return;
    const profiles=kernel.listPresentations(),shouldExpose=profiles.length>1;
    controls.hidden=!shouldExpose;if(!shouldExpose){controls.replaceChildren();return;}
    const label=document.createElement('span');label.className='presentation-controls-label ui-label';label.textContent='Skin';
    const active=kernel.activePresentationId(),buttons:HTMLButtonElement[]=[];
    for(const profile of profiles){
      const button=document.createElement('button');button.className='presentation-btn';button.type='button';
      button.dataset['action']='set-presentation';button.dataset['presentationId']=profile.id;button.textContent=profile.label;
      button.setAttribute('aria-pressed',profile.id===active?'true':'false');buttons.push(button);
    }
    controls.replaceChildren(label,...buttons);
  }
  function applyPresentation(presentationId:unknown,{persist=false,restoreFocus=false}:Readonly<{persist?:boolean;restoreFocus?:boolean}>={}):string{
    const clean=kernel.switchPresentation(presentationId,{persist:false});
    if(persist)preferences.persist({presentation:clean});
    renderPresentationControls();
    if(restoreFocus)document.querySelector<HTMLElement>(`.presentation-btn[data-presentation-id="${CSS.escape(clean)}"]`)?.focus();
    return clean;
  }
  function setPresentation(presentationId:unknown,{restoreFocus=false,origin=null}:Readonly<{restoreFocus?:boolean;origin?:HTMLElement|null}>={}):string{
    if(!ownership.require('change appearance settings'))return kernel.activePresentationId();
    const clean=kernel.normalizePresentationId(presentationId);
    if(clean===kernel.activePresentationId())return applyPresentation(clean,{persist:true,restoreFocus});
    runAppearanceChange(origin,()=>{applyPresentation(clean,{persist:true,restoreFocus});});
    return clean;
  }
  function registerPresentation(value:unknown):boolean{
    const accepted=kernel.registerPresentation(value);if(accepted)renderPresentationControls();return accepted;
  }
  function handlePresentationSelection(event:Event):void{
    const target=event.target;if(!(target instanceof Element))return;
    const control=target.closest<HTMLElement>('[data-presentation-id]');if(control)setPresentation(control.dataset['presentationId'],{restoreFocus:true,origin:control});
  }
  function normalizeFontScale(value:unknown):number{
    const numeric=Number(value);if(!Number.isFinite(numeric))return 1;
    return FONT_SCALE_STEPS.reduce((best,step)=>Math.abs(step-numeric)<Math.abs(best-numeric)?step:best,1);
  }
  function readFontScale():number{
    if(preferences.hydrated())return normalizeFontScale(preferences.current().fontScale??1);
    return normalizeFontScale(storage.getText(storage.keys.fontScale,'1'));
  }
  function applyFontScale(value:unknown):number{
    const clean=normalizeFontScale(value),percent=Math.round(clean*1000)/10;
    root.style.fontSize=`${percent}%`;root.dataset['typeScale']=String(clean);root.dataset['fontScale']=String(clean);
    document.querySelectorAll<HTMLElement>('.type-btn[data-action^="font-"]').forEach(button=>{
      const action=button.dataset['action'];button.setAttribute('aria-pressed',action==='font-reset'&&clean===1?'true':'false');
    });
    return clean;
  }
  function setFontScale(value:unknown):number{
    const clean=applyFontScale(value);preferences.persist({fontScale:clean});return clean;
  }
  function stepFontScale(delta:number):number{
    const current=applyFontScale(readFontScale()),index=FONT_SCALE_STEPS.indexOf(current);
    const next=FONT_SCALE_STEPS[Math.min(FONT_SCALE_STEPS.length-1,Math.max(0,index+delta))]??1;
    return setFontScale(next);
  }
  function refreshMirrors(value:Readonly<PersonalPreferences>):boolean{
    const entries:readonly (readonly [keyof Pick<PersonalPreferences,'theme'|'presentation'|'fontScale'>,string|null|number])[]=[
      ['theme',value.theme],['presentation',value.presentation],['fontScale',value.fontScale]
    ];
    for(const [name,current] of entries){
      const key=storage.keys[name],ok=current===null?storage.remove(key):storage.setText(key,String(current));
      if(!ok)diagnostics.capture('preferences.mirror-write',storage.lastError()??new Error(`${name} startup mirror could not be refreshed.`),'warn');
    }
    return true;
  }
  function applyPreferences(value:Readonly<PersonalPreferences>){
    const fontScale=applyFontScale(value.fontScale??1);
    const theme=applyTheme(value.theme??kernel.manifest.defaults.theme);
    const presentation=applyPresentation(value.presentation??kernel.manifest.defaults.preferredPresentation);
    renderControls();
    return freeze({theme,presentation,fontScale});
  }
  function restoreTheme():string{
    return applyTheme(kernel.readStoredTheme((key,fallback)=>storage.getText(key,fallback)),{persist:false});
  }
  function restorePresentation():string{
    return applyPresentation(kernel.readStoredPresentation((key,fallback)=>storage.getText(key,fallback)),{persist:false});
  }
  function restoreFontScale():number{return applyFontScale(readFontScale());}
  function renderControls():void{renderThemeControls();renderPresentationControls();}
  function toggleDisplayTools():void{
    const menu=document.getElementById('display-tools-menu'),trigger=document.getElementById('display-tools-trigger');
    if(!menu||!trigger)return;
    displayToolsPopover??=popovers.create(menu);
    if(menu.hidden)displayToolsPopover.show(trigger);else displayToolsPopover.hide();
  }
  return freeze({
    format:'study-director.presentation-host' as const,contractVersion:1 as const,
    refreshMirrors,applyPreferences,restoreTheme,restorePresentation,restoreFontScale,
    renderControls,renderThemeControls,renderPresentationControls,
    applyTheme,setTheme,handleThemeSelection,applyPresentation,setPresentation,registerPresentation,handlePresentationSelection,
    normalizeFontScale,readFontScale,applyFontScale,setFontScale,stepFontScale,toggleDisplayTools
  });
}
const createModule=()=>freeze({format:'study-director.presentation-host-module' as const,contractVersion:1 as const,createController});
registry.define('presentation-host',1,createModule);return createModule;
})();
export type PresentationHostModule=ReturnType<typeof sdPresentationHostFactory>;
