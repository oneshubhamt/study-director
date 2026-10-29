import type {PilotRegistry} from './pilot.ts';
// Definition-only port: full consumer APIs are inferred from checked factories.
export interface ModuleRegistration<Name extends string,Format extends string,ContractVersion extends number=1,Input extends unknown[]=[],RegistryVersion extends number=1>{
 readonly format:'study-director.internal-module-registry';readonly version:1;
 readonly contracts:PilotRegistry['contracts'];
 define(name:Name,version:RegistryVersion,factory:(...input:Input)=>{readonly format:Format;readonly contractVersion:ContractVersion}):boolean;
}
