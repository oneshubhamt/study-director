export interface WorkspaceDescriptor {readonly kind:string;readonly token:string;readonly key?:string;readonly version?:number}
export interface WorkspaceOpenMeta {readonly replace?:boolean;readonly url?:string|null}
export interface WorkspaceCloseMeta {readonly fromHistory?:boolean;readonly historyPending?:boolean}
export interface WorkspaceHistoryPort {
 opened(descriptor:WorkspaceDescriptor,options:WorkspaceOpenMeta):unknown;
 requestClose(descriptor:WorkspaceDescriptor):boolean;
 closed(descriptor:WorkspaceDescriptor,meta:WorkspaceCloseMeta):unknown;
}
export interface OverlayHistory extends WorkspaceOpenMeta {kind:string;token?:string|undefined;key?:string;reopen?:(descriptor:WorkspaceDescriptor)=>unknown;valid?:()=>boolean}
export interface OverlayOptions {content:HTMLElement;headerContent?:HTMLElement;label?:string;closeLabel?:string;className?:string;history?:OverlayHistory|null;onBeforeClose?:()=>void;onAfterClose?:()=>void}
export interface OverlayHandle {readonly dialog:HTMLDialogElement;close():boolean;closeFromHistory():boolean;readonly whenClosed:Promise<boolean>;readonly historyToken:string;forget():boolean}
export interface OverlayInput {readonly ports:{readonly environment:{readonly document:Document};readonly history?:WorkspaceHistoryPort}}
