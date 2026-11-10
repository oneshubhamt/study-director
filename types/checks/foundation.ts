import type {BrowserRegistry} from '../browser-registry.ts';
import type {NavigationInput} from '../navigation.ts';
import type {InteractionInput} from '../interactions.ts';
import type {FoundationHostModule} from '../../source/core/foundation-host.ts';
declare const registry:BrowserRegistry;
declare const interactionInput:InteractionInput;
declare const navigationInput:NavigationInput;
declare const foundation:FoundationHostModule;
const interactions=registry.require('interactions',1).createController(interactionInput);
const confirmed:Promise<boolean|null>=interactions.confirm({title:'Continue?'});
const chosen:Promise<string|null>=interactions.choose({choices:[{value:'keep',label:'Keep'}]});
void confirmed;void chosen;
// @ts-expect-error -- confirmation cannot resolve to a choice string.
const wrong:Promise<string|null>=interactions.confirm('Continue?');void wrong;
// @ts-expect-error -- validation receives text and must return a message.
void interactions.input({validate:()=>42});
// @ts-expect-error -- choice identities are text.
void interactions.choose({choices:[{value:42,label:'Bad'}]});
const notices=registry.require('notice-coordinator',1).createCoordinator({});
notices.emit({source:'test',id:'save',lifecycle:'succeeded',severity:'success'});
// @ts-expect-error -- lifecycle transitions have a closed vocabulary.
notices.emit({source:'test',id:'save',lifecycle:'pending'});
// @ts-expect-error -- progress counts cannot be text.
notices.emit({source:'test',id:'save',progress:{current:'1'}});
// @ts-expect-error -- only defined sound modes are accepted.
notices.setSoundMode('loud');
const navigation=registry.require('navigation',1).createController({...navigationInput,window});
void navigation.request('plan',{history:'replace'});
// @ts-expect-error -- navigation does not accept arbitrary history mutations.
void navigation.request('plan',{history:'rewrite'});
// @ts-expect-error -- workspace overlays require real content elements.
registry.require('workspace-overlay',1).createController({ports:{environment:{document}}}).open({content:'html'});
// @ts-expect-error -- module export identity is bound to its ID.
registry.load('foundation-host',1,'study-director.navigation-module',1);
const primitives=foundation.createPrimitives({document,APP_LIMITS:{maxNoteChars:100},CompletionModel:{fromUnits:(done,total)=>done/total*100}});
const button:HTMLButtonElement=primitives.textEl('button','action','Open');void button;
// @ts-expect-error -- a div is not an input element.
primitives.textEl('div').value='bad';
// @ts-expect-error -- DOM helper preserves the CSS value type.
primitives.setElementStyle(button,'opacity',1);
const maybe=primitives.KeyedRecord.get({known:1},'missing');
// @ts-expect-error -- keyed lookups retain absence.
const definite:number=maybe;void definite;
