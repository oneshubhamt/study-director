export type ThemeId='dark'|'light';
export type PresentationField='typography'|'shape'|'material'|'depth'|'density'|'responsive'|'motion'|'charts';
export interface ThemeDefinition{readonly id:string;readonly label:string}
export interface PresentationProfile{
  readonly id:string;readonly label:string;
  readonly typography:string;readonly shape:string;readonly material:string;readonly depth:string;
  readonly density:string;readonly responsive:string;readonly motion:string;readonly charts:string;
}
export interface PresentationDefinition extends PresentationProfile{readonly contractVersion:number}
export type AppearanceStorageRead=(key:string,fallback:string)=>unknown;
export type AppearanceStorageWrite=(key:string,value:string)=>boolean;
export interface PresentationManifest{
  readonly format:'study-director.presentation-manifest';readonly version:1;
  readonly defaults:Readonly<{theme:string;preferredPresentation:string;fallbackPresentation:string}>;
  readonly themes:Readonly<Record<string,ThemeDefinition>>;
  readonly presentations:Readonly<Record<string,PresentationProfile>>;
  readonly breakpoints:Readonly<Record<string,unknown>>;
  readonly tokens:Readonly<{contractVersion:number;public:unknown;internal:unknown}>;
  readonly invariants:Readonly<Record<string,unknown>>;
}
export interface PresentationKernel{
  readonly format:'study-director.presentation-kernel';readonly version:1;readonly manifest:PresentationManifest;
  normalizeThemeId(value:unknown):string;
  normalizePresentationId(value:unknown):string;
  readStoredTheme(read?:AppearanceStorageRead):string;
  readStoredPresentation(read?:AppearanceStorageRead):string;
  restoreStoredPresentation(read?:AppearanceStorageRead):string;
  activeThemeId():string;
  activePresentationId():string;
  listPresentations():readonly PresentationProfile[];
  registerPresentation(value:unknown):boolean;
  switchPresentation(presentationId:unknown,options?:Readonly<{persist?:boolean;write?:AppearanceStorageWrite}>):string;
  synchronizeMetadata():void;
  switchTheme(themeId:unknown,options?:Readonly<{persist?:boolean;write?:AppearanceStorageWrite;syncMetadata?:boolean}>):string;
}
