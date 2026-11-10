export interface ProfileScopeValue{
  readonly registryKey:string;readonly separator:string;readonly pattern:RegExp;readonly id:string;readonly scope:string;readonly safe:boolean;
  scoped(name:unknown):string;
}
