// Structured-clone inputs are unknown until checked; these helpers do not assert a payload schema.
export function messageObject(value:unknown):Record<string,unknown>{return value!==null&&typeof value==='object'?value as Record<string,unknown>:{};}
export type WorkerProgress={loaded:number;total:number;phase:string;mode?:string|undefined};
export type WorkerFailure={name:string;message:string;code?:unknown};
export type WorkerReply<T>={id:unknown;value:T}|{id:unknown;progress:WorkerProgress}|{id:unknown;error:WorkerFailure};
export function errorDescription(error:unknown,fallback:string):WorkerFailure{return {code:messageObject(error)['code'],name:error instanceof Error?error.name:'Error',message:error instanceof Error?error.message:fallback};}

export type AttachmentRequest<Binary> =
 | {id:number;type:'ingest';data:{directory:string;file:Binary;storageName:string}}
 | {id:number;type:'verify';data:{directory:string;storageName:string;expectedHash:string;size:number}}
 | {id:number;type:'remove';data:{directory:string;storageName:string}}
 | {type:'cancel';target:number};
export type AttachmentResult={storageName:string;hash:string;size:number;mode:'sync'|'async'};
export type SearchDocument={key:string;revision?:string;value?:string;plain?:string};
export type SearchRequest=
 | {type:'sync'|'batch';documents:readonly SearchDocument[]}
 | {type:'upsert';document:SearchDocument}
 | {type:'delete';key:string}
 | {type:'query';id:number;query:string};
export type SearchReply={type:'result';id:unknown;keys:string[]}|{type:'error';id:unknown};
export type ImageRequest<Binary>={file:Binary;mimeType:string};
export type ImageResult<Binary>={blob:Binary;width:number;height:number};
export type ImageReply<Binary>={unsupported:true}|{result:ImageResult<Binary>}|{error:WorkerFailure};
