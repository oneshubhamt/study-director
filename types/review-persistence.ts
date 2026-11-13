import type {AppData} from './data-bootstrap-host.ts';
import type {DailyRecord,DiaryRecord,Limits,RecordHelpers} from './record-models.ts';
import type {DailyCodec,DailyView} from './repositories.ts';
import type {SaveLane,SaveLaneModule,SaveState,FlushOptions} from './pilot.ts';
import type {ReviewDailyReflectionPort,ReviewDailyReflectionResult,ReviewRichInputMeta} from './review.ts';

export type SavedDayRecord=DailyRecord|DailyView;
export interface DiaryDraft extends DiaryRecord{readonly dayOfWeek:number;readonly dayName:string}
export interface DiaryEditorCallbacks{
  readonly onSaved?:((record:SavedDayRecord|null)=>void)|null;
  readonly onState?:((state:SaveState,message:string)=>void)|null;
}
export interface DiaryEditorBinding{
  readonly date:string;readonly revision:number;
}
export interface DiaryEditorDocument{
  readonly documentId:string;readonly label:string;readonly initialValue:string;readonly maxWords:number;readonly surface:'reflection';
}
export interface ReviewPersistenceInput{
  readonly configuration:Readonly<{limits:Pick<Limits,'maxReflectionChars'|'maxRichTextWords'>;dataContract:Readonly<{schemas:Readonly<{DailyRecord:Readonly<{version:number}>}>}>}>;
  readonly records:Pick<AppData['dailyRecords'],'get'|'save'|'remove'|'verifyCanonical'|'verifyCanonicalAbsent'|'timestamp'>;
  readonly codec:Readonly<Pick<DailyCodec,'createDiaryRecord'>>;
  readonly ownership:Readonly<{canMutate():boolean;revision():number}>;
  readonly text:Readonly<Pick<RecordHelpers,'clampEditorContent'|'editorContentWithinLimits'> & {plain(value:unknown):string;isRich(value:unknown):boolean}>;
  readonly richText:Readonly<{closeField(field:HTMLTextAreaElement):unknown;syncField(field:HTMLTextAreaElement):unknown;validatedInput(event:Event|undefined,field:HTMLTextAreaElement):ReviewRichInputMeta|null}>;
  readonly dates:Readonly<{isSupported(date:string):boolean;insights(date:string):Readonly<{dayOfWeek:number;dayName:string}>}>;
  readonly saveLane:SaveLaneModule;
  readonly environment:Readonly<{nowIso():string;queueMicrotask(callback:()=>void):void;setTimeout(callback:()=>void,delay:number):number;clearTimeout(handle:number):void}>;
}
export interface DiaryEditor{
  bind(field:HTMLTextAreaElement,date:string,record:SavedDayRecord,callbacks?:DiaryEditorCallbacks):Readonly<DiaryEditorBinding>|null;
  capture(field:HTMLTextAreaElement,event?:Event):string;
  clear(field:HTMLTextAreaElement):boolean;
  deleteEntry(date:string,options?:Readonly<{backupCapture?:boolean}>):Promise<boolean>;
  documentFor(field:HTMLTextAreaElement):Readonly<DiaryEditorDocument>|null;
  draft(date:string):Readonly<DiaryDraft>|null;
  flush(field:HTMLTextAreaElement,options?:FlushOptions):Promise<SavedDayRecord|null|void>;
  schedule(field:HTMLTextAreaElement,value:string):boolean;
  settled(field:HTMLTextAreaElement):Promise<boolean>;
}
export interface ReviewPersistence{
  readonly format:'study-director.review-persistence';readonly contractVersion:1;
  readonly DailyReflectionPersistence:Readonly<ReviewDailyReflectionPort>;
  readonly DiaryEditor:Readonly<DiaryEditor>;
}
export interface ReviewPersistenceModule{
  readonly format:'study-director.review-persistence-module';readonly contractVersion:1;
  createPersistence(input:Readonly<ReviewPersistenceInput>):Readonly<ReviewPersistence>;
}
