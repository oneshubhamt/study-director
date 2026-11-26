import type {PersonalPreferences} from './record-models.ts';
import type {PresentationKernel} from './presentation.ts';

export type AppearancePreferenceOverrides=Partial<Pick<PersonalPreferences,'theme'|'presentation'|'fontScale'>>;
export interface AnchoredPopoverPort{show(trigger:HTMLElement):unknown;hide():unknown}
export type AppearanceDocument=Document;
export interface PresentationHostInput{
  readonly kernel:PresentationKernel;
  readonly document:AppearanceDocument;
  readonly window:Window;
  readonly storage:Readonly<{
    keys:Readonly<{theme:string;presentation:string;fontScale:string}>;
    getText(key:string,fallback:string):string;
    setText(key:string,value:string):boolean;
    remove(key:string):boolean;
    lastError():unknown;
  }>;
  readonly preferences:Readonly<{
    hydrated():boolean;
    current():Readonly<PersonalPreferences>;
    persist(value:AppearancePreferenceOverrides):boolean;
  }>;
  readonly ownership:Readonly<{require(reason:string):boolean;captureOrigin(reason:string):()=>void}>;
  readonly diagnostics:Readonly<{capture(scope:string,error:unknown,level:'warn'|'error'):unknown}>;
  readonly popovers:Readonly<{create(menu:HTMLElement):AnchoredPopoverPort}>;
}
export interface PresentationHostController{
  readonly format:'study-director.presentation-host';readonly contractVersion:1;
  refreshMirrors(value:Readonly<PersonalPreferences>):boolean;
  applyPreferences(value:Readonly<PersonalPreferences>):Readonly<{theme:string;presentation:string;fontScale:number}>;
  restoreTheme():string;restorePresentation():string;restoreFontScale():number;
  renderControls():void;renderThemeControls():void;renderPresentationControls():void;
  applyTheme(themeId:unknown,options?:Readonly<{persist?:boolean;restoreFocus?:boolean}>):string;
  setTheme(themeId:unknown,options?:Readonly<{restoreFocus?:boolean;origin?:HTMLElement|null}>):string;
  handleThemeSelection(event:Event):void;
  applyPresentation(presentationId:unknown,options?:Readonly<{persist?:boolean;restoreFocus?:boolean}>):string;
  setPresentation(presentationId:unknown,options?:Readonly<{restoreFocus?:boolean;origin?:HTMLElement|null}>):string;
  registerPresentation(value:unknown):boolean;
  handlePresentationSelection(event:Event):void;
  normalizeFontScale(value:unknown):number;readFontScale():number;applyFontScale(value:unknown):number;setFontScale(value:unknown):number;stepFontScale(delta:number):number;
  toggleDisplayTools():void;
}
export interface PresentationHostModule{
  readonly format:'study-director.presentation-host-module';readonly contractVersion:1;
  createController(input:Readonly<PresentationHostInput>):Readonly<PresentationHostController>;
}
