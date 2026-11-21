type MetadataKernel=Readonly<{format:'study-director.presentation-kernel';version:1;synchronizeMetadata():void}>;
const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null;
const isMetadataKernel=(value:unknown):value is MetadataKernel=>record(value)&&value['format']==='study-director.presentation-kernel'&&value['version']===1&&typeof value['synchronizeMetadata']==='function';

const key=Symbol.for('studyDirector.presentationKernel.v1');
const target=window as unknown as Record<PropertyKey,unknown>;
const value=target[key];
if(!isMetadataKernel(value))throw new Error('Study Director presentation kernel is unavailable or incompatible.');
value.synchronizeMetadata();
