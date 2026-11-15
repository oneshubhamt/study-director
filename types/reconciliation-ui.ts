import type {AssetStore,MountedRichTextEditor,MountOptions,RichTextApi} from '../rich-text/editor.ts';
import type {RichTextComparison,RichTextMergeResult,ThreeWayMergeResult} from '../rich-text/reconciliation.ts';

export type ReconciliationConflict=Readonly<{
  key:string;label:string;localCandidateId:string;incomingCandidateId:string;
  localValue:string;incomingValue:string;ancestorAvailable:boolean;ancestorValue:string;
  requireContent?:boolean;incomingLabel:string;
}>;
export type ReconciliationAsset=Readonly<{assetId:string;blob:Blob}>;
export type ReconciliationNoteResult=Readonly<{text:string;localCandidateId:string;incomingCandidateId:string}>;
export type ReconciliationResult=Readonly<{
  format:'study-director.note-reconciliation-result';version:1;
  notes:Readonly<Record<string,ReconciliationNoteResult>>;
}>;
export type ReconciliationResolveOptions=Readonly<{
  conflicts:readonly ReconciliationConflict[];
  incomingAssets?:readonly ReconciliationAsset[];
  purpose?:string;
  signal?:AbortSignal|null|undefined;
  manualOnly?:boolean;
  startWith?:string;
}>;
export type ReconciliationAssetStore=Pick<AssetStore,'get'|'put'|'remove'>;
export type ReconciliationMountOptions=Pick<MountOptions,'field'|'label'|'initialValue'|'maxWords'|'maxBytes'|'assets'|'surface'|'focusOnMount'|'allowAssetInsert'|'readOnly'>;
export type ReconciliationRichText=Readonly<{
  mountRichTextEditor(options:ReconciliationMountOptions):Promise<MountedRichTextEditor>;
  compareRichText:RichTextApi['compareRichText'];
  mergeIncomingAdditions(localValue:unknown,incomingValue:unknown):RichTextMergeResult;
  appendIncomingAdditions(localValue:unknown,incomingValue:unknown):RichTextMergeResult;
  mergeThreeWay(baseValue:unknown,localValue:unknown,incomingValue:unknown):ThreeWayMergeResult;
}>;
export interface ReconciliationUiInput{
  readonly ports:Readonly<{
    assets:Readonly<Pick<AssetStore,'get'>>;
    configuration:Readonly<{maxBytes:number;maxWords:number}>;
    diagnostics:Readonly<{capture(scope:string,error:unknown,level:'warn'|'error'):unknown}>;
    richText:ReconciliationRichText;
    view:Readonly<{
      document:Document;
      requestAnimationFrame(callback:FrameRequestCallback):number;
      cancelAnimationFrame(id:number):unknown;
    }>;
  }>;
}
export interface ReconciliationUiController{
  readonly format:'study-director.reconciliation-ui';
  readonly contractVersion:1;
  resolve(options:ReconciliationResolveOptions):Promise<ReconciliationResult|null>;
  cancel():Promise<void>|false;
}
export interface ReconciliationUiModule{
  readonly format:'study-director.reconciliation-ui-module';
  readonly contractVersion:1;
  createController(input:Readonly<ReconciliationUiInput>):Readonly<ReconciliationUiController>;
}

export type ReconciliationState={
  conflict:ReconciliationConflict;
  working:string;incoming:string;smartValue:string|null;result:string|null;applied:boolean;
};
export type ReconciliationPane={pane:HTMLElement;sub:HTMLElement;field:HTMLTextAreaElement};
export type ReconciliationEditor=MountedRichTextEditor;
export type ReconciliationComparison=RichTextComparison;
