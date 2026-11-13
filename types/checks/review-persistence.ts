import type {AppData} from '../data-bootstrap-host.ts';
import type {ReviewPersistenceInput} from '../review-persistence.ts';
import type {BrowserRegistry} from '../browser-registry.ts';
import type {RecordCodecsModule} from '../../source/core/record-codecs.ts';
import type {SaveLaneModule} from '../pilot.ts';
declare const registry:BrowserRegistry;
declare const appData:AppData;
declare const codec:ReturnType<RecordCodecsModule['createDailyRecordCodec']>;
declare const saveLane:SaveLaneModule;
declare const input:Omit<ReviewPersistenceInput,'records'|'codec'|'saveLane'>;
const module=registry.require('review-persistence',1);
const persistence=module.createPersistence(Object.freeze({
  ...input,
  records:Object.freeze({
    get:appData.dailyRecords.get,save:appData.dailyRecords.save,remove:appData.dailyRecords.remove,
    verifyCanonical:appData.dailyRecords.verifyCanonical,verifyCanonicalAbsent:appData.dailyRecords.verifyCanonicalAbsent,
    timestamp:appData.dailyRecords.timestamp
  }),
  codec:Object.freeze({createDiaryRecord:codec.createDiaryRecord}),
  saveLane
}));
void persistence.DailyReflectionPersistence.load('2026-11-13');
void persistence.DiaryEditor.settled(document.createElement('textarea'));
// @ts-expect-error -- a fallback-only repository surface is incomplete.
module.createPersistence(Object.freeze({...input,records:Object.freeze({get:appData.dailyRecords.get}),codec:Object.freeze({createDiaryRecord:codec.createDiaryRecord}),saveLane}));
