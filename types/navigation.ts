import type {WorkspaceDescriptor} from './workspace.ts';
export type TabId='plan'|'execute'|'review'|'library'|'insights'|'guide';
export type HistoryMode='push'|'replace'|'none';
export interface NavigationContext {readonly from:TabId;readonly to:TabId;readonly source:string;readonly generation:number;readonly traversal:boolean;readonly restoreScroll?:boolean;readonly reconciliation?:boolean;current():boolean}
export type DepartureContext=Omit<NavigationContext,'current'>;
export interface NavigationResult {readonly ok:boolean;readonly tab:TabId;readonly changed:boolean;readonly reason:string;readonly generation:number;readonly source:string}
export interface NavigationOptions {source?:string;history?:HistoryMode;traversal?:boolean;traversalPosition?:number|null;workspaceSpecified?:boolean;workspace?:WorkspaceDescriptor|null;force?:boolean;normalize?:boolean;ensureEntry?:boolean;url?:string|null;restoreScroll?:boolean}
export interface NavigationHost {
 currentTab():string;
 prepare(context:DepartureContext):boolean|Promise<boolean>;
 present(context:NavigationContext,commit:()=>Promise<boolean>):unknown;
 commit(context:NavigationContext):boolean|Promise<boolean>;
 ready(context:NavigationContext):unknown;
 report(scope:string,error:unknown):void;
 workspace?:{current():WorkspaceDescriptor|null;reconcile(desired:WorkspaceDescriptor|null,context:NavigationContext):unknown};
}
export interface NavigationEventPort {navigationType:string;destination:{url:string;getState?():unknown};canIntercept?:boolean;intercept(options:{focusReset:'manual';scroll:'manual';handler:()=>Promise<unknown>}):void}
export interface NavigationWindow {
 location:Pick<Location,'href'|'origin'|'pathname'>;
 history?:{readonly state:unknown;replaceState(state:unknown,title:string,url:string):void;pushState(state:unknown,title:string,url:string):void;go(delta:number):void;back():void};
 navigation?:{addEventListener(type:'navigate',listener:(event:NavigationEventPort)=>void):void};
 addEventListener(type:'popstate',listener:(event:{state:unknown})=>unknown):void;
}
export interface NavigationInput {window:NavigationWindow;host:NavigationHost}
