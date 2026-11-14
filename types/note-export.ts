import type {RichTextApi} from '../rich-text/editor.ts';
import type {ExportsModule} from '../source/core/exports.ts';

type ExportCoordinator=ReturnType<ExportsModule['createCoordinator']>;
export type NoteExportRecord=Readonly<{key?:string;label?:string;text?:string}>;
export type NoteExportResult=Readonly<{
  status:string;filename?:string;kind?:'markdown'|'zip';notes?:number;assets?:number;missing?:number;maxBytes?:number;
}>;
export interface NoteExportInput{
  readonly ports:Readonly<{
    notes:Readonly<{get(key:string):NoteExportRecord|null|undefined}>;
    assets:Readonly<{get(id:string):PromiseLike<Blob|null>|Blob|null}>;
    richText:Readonly<Pick<RichTextApi,'assetIds'|'exportDocument'>>;
    output:Readonly<Pick<ExportCoordinator,'chooseSave'|'save'>>;
    processing:Readonly<Pick<ExportCoordinator,'job'|'run'|'cancel'|'check'>>;
    scheduling:Readonly<{yieldTask():PromiseLike<unknown>|unknown;budget():()=>boolean}>;
  }>;
}
export interface NoteExporter{
  readonly format:'study-director.note-exporter';readonly contractVersion:2;
  exportKeys(keys:readonly unknown[]):Promise<NoteExportResult>;cancel():unknown;
}
export interface NoteExportModule{
  readonly format:'study-director.note-export-module';readonly contractVersion:2;
  createExporter(input:Readonly<NoteExportInput>):Readonly<NoteExporter>;
  readonly limits:Readonly<{maxExportBytes:number}>;
  readonly testing:Readonly<{cleanBaseName(value:unknown,fallback?:string):string}>;
}
