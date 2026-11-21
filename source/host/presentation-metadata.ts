import type {PresentationKernel} from '../../types/presentation.ts';

const key=Symbol.for('studyDirector.presentationKernel.v1');
const target=window as unknown as Record<PropertyKey,unknown>;
const value=target[key];
const record=(input:unknown):input is Record<string,unknown>=>typeof input==='object'&&input!==null;
if(!record(value)||value['format']!=='study-director.presentation-kernel'||value['version']!==1||typeof value['synchronizeMetadata']!=='function'){
  throw new Error('Study Director presentation kernel is unavailable or incompatible.');
}
(value as unknown as PresentationKernel).synchronizeMetadata();
