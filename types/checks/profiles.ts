import type {BrowserRegistry} from '../browser-registry.ts';
import type {ProfilesInput} from '../profiles.ts';
declare const registry:BrowserRegistry;
declare const input:Readonly<ProfilesInput>;
const module=registry.require('profiles',1);
const controller=module.createController(input);
const current=controller.current();
if(current){const id:string=current.id;void id;}
void controller.ensure('Asha',{fresh:true});
void controller.setAccount({email:'asha@example.com',folder:'folder_1'});
// @ts-expect-error -- first-start options have a closed shape.
void controller.ensure('Asha',{fresh:'yes'});
// @ts-expect-error -- profile module identity is closed.
registry.load('profiles',1,'study-director.native-capabilities-module',1);
registry.require('profiles-host',1);
