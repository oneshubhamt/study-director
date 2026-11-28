export type PendingEntry=Readonly<{providerId:string;requestedAt:string;sourceRevision:string}>;
export type PendingRecord=Readonly<{format:'study-director.managed-provider-backup-pending';version:1;entries:readonly PendingEntry[]}>;
export type PendingStoreInput={storage:{read():Promise<unknown>;write(value:PendingRecord):Promise<unknown>;remove():Promise<unknown>};diagnostics:{capture(scope:string,error:unknown,level:'error'|'warn'):void};sourceRevision():unknown};
export type PendingHooks={read(id:string):Promise<PendingEntry|null>;mark(id:string):Promise<boolean>;clear(id:string,expected?:PendingEntry|null):Promise<boolean>};
