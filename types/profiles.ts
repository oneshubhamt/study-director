export interface ProfileEntry{
  readonly id:string;readonly scope:string;readonly name:string;readonly email:string;readonly folder:string;
  readonly createdAt:string;readonly fresh:boolean;readonly from:string|null;
}
export interface ProfileListState{
  readonly version:1;readonly active:string;readonly profiles:readonly ProfileEntry[];
  readonly removing:readonly string[];readonly unsupported:boolean;
}
export interface ProfileScopePort{readonly pattern:RegExp;readonly registryKey:string;readonly scope:string;readonly separator:string}
export interface ProfileStoragePort{
  keys():readonly string[];read():string|null;remove(key:string):boolean;write(text:string):boolean;
}
export interface ProfileNamesPort{readonly database:string;readonly directories:readonly string[];readonly keys:readonly string[]}
export interface ProfilePlatformPort{
  deleteDatabase(name:string):PromiseLike<unknown>;
  listen(handler:(key:string|null)=>void):()=>void;
  now():number;
  random(bytes:number):string;
  reload():void;
  removeDirectory(name:string):PromiseLike<unknown>;
}
export interface ProfilesInput{
  readonly ports:Readonly<{
    scope:Readonly<ProfileScopePort>;
    storage:Readonly<ProfileStoragePort>;
    names:Readonly<ProfileNamesPort>;
    platform:Readonly<ProfilePlatformPort>;
    limits:Readonly<{maxName:number}>;
  }>;
}
export interface ProfileCollectResult{readonly removed:boolean;readonly error:unknown|null}
export interface ProfilesController{
  current():Readonly<ProfileEntry>|null;
  list():readonly Readonly<ProfileEntry>[];
  ensure(name:string,options?:Readonly<{fresh?:boolean}>):Readonly<ProfileEntry>|null;
  rename(name:string):Readonly<ProfileEntry>|null;
  setAccount(account?:Readonly<{email?:unknown;folder?:unknown}>):Readonly<ProfileEntry>|null;
  adopt(id:string):boolean;
  renew():Readonly<ProfileEntry>|null;
  finishFirstStart():Readonly<ProfileEntry>|null;
  add():boolean;
  switchTo(id:string):boolean;
  remove():boolean;
  collect():Promise<Readonly<ProfileCollectResult>>;
  watch():()=>void;
  removalPending():number;
  unsupported():boolean;
}
export interface ProfilesModulePort{
  readonly format:'study-director.profiles-module';readonly contractVersion:1;
  createController(input:Readonly<ProfilesInput>):Readonly<ProfilesController>;
}
