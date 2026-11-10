import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readCoreScript,coreScriptPath} from '../../helpers/core-script.mjs';
class Textarea {constructor(){this.dataset={input:'save'};}closest(){return this;}}
const context=vm.createContext({HTMLTextAreaElement:Textarea});
for(const name of ['internal','foundation-host'])vm.runInContext(readCoreScript(name),context,{filename:coreScriptPath(name)});
const foundation=vm.runInContext("globalThis[Symbol.for('studyDirector.internalModules.v1')].require('foundation-host',1)",context);

// Dictionary safety, null/default semantics, and scalar validation survive extraction.
const p=foundation.createPrimitives({document:{},APP_LIMITS:{maxNoteChars:3},CompletionModel:{fromUnits:(done,total)=>100*done/total}});
const records=p.KeyedRecord.create(JSON.parse('{"__proto__":1,"constructor":2,"empty":null}'));
assert.equal(Object.getPrototypeOf(records),null);assert.equal(p.KeyedRecord.get(records,'__proto__'),1);
assert.equal(p.KeyedRecord.get(records,'missing'),null);assert.equal(p.KeyedRecord.get(records,'missing',false),false);
assert.equal(p.KeyedRecord.get(records,'empty',false),null);assert.equal(p.KeyedRecord.has(records,'toString'),false);
assert.equal(p.clampText('abcd'),'abc');assert.equal(p.boundedInt('3.7',{max:3}),3);
assert.equal(p.boundedNumber(Infinity,{fallback:7}),7);assert.equal(p.optionalBoundedNumber('3'),null);
assert.equal(p.sameDataValue({nested:[1,{a:2,b:3}]},{nested:[1,{b:3,a:2}]}),true);
assert.equal(p.sameDataValue([1,2],[2,1]),false);assert.equal(p.sameDataValue([],{}),false);
const text={textContent:'same'};assert.equal(p.setElementText(text,'same'),false);assert.equal(p.setElementText(text,null),true);assert.equal(text.textContent,'');

// Status adapters preserve source routing, bounded copy and resolution.
const notices=[],resolved=[];
const views=foundation.createNoticeViews({document:{},notifications:()=>({emit:event=>{notices.push(event);return 'notice';},resolveEvent:(...args)=>resolved.push(args)}),clampText:p.clampText,maxStatusMessageChars:4});
for(const [id,source] of [['library-status','library'],['notes-status','notes'],['save-status','review']]){
 views.setStatus(id,'abcdef',false);const event=notices.at(-1);assert.equal(event.source,source);assert.equal(event.message,'abcd');assert.equal(event.lifecycle,'failed');assert.equal(event.cue,'none');
 views.setStatus(id,'');assert.deepEqual(resolved.at(-1),[source,'status-'+id]);
}
views.setStatus('save-status','Wait',true,'running');assert.equal(notices.at(-1).lifecycle,'running');
// An action raised before recovery initialization retains the old no-op path.
let history=null;
const backups=foundation.createBackupActions({history:()=>history});
assert.equal(await backups.showBackupPresentation('restore','history'),undefined);
history={open:()=>true};assert.equal(await backups.showBackupPresentation('restore','history'),true);
const modes=[],persisted=[];let mutable=false;
const sound=foundation.createSound({document:{querySelectorAll:()=>[],getElementById:()=>null},NoticeCoordinator:{setSoundMode:mode=>modes.push(mode),soundStatus:()=>({mode:'full',readiness:'ready'})},appCanMutate:()=>mutable,persistProtectedPreferences:value=>persisted.push(value)});
sound.handleSoundModeChange({target:{value:'off'}});assert.equal(modes.length,0);mutable=true;
for(const mode of ['full','minimal','off'])sound.handleSoundModeChange({target:{value:mode}});
for(const target of [null,{}, {value:'unsupported'}])sound.handleSoundModeChange({target});
assert.deepEqual(modes,['full','minimal','off']);assert.deepEqual(persisted.map(value=>value.soundMode),modes);

// Late-bound editor state gates departure; failures preserve the previous tab.
let editor={settled:async()=>{}},saved=true,diary=true;const statuses=[];
const nav=foundation.createNavigation({document:{},window:{},clampText:p.clampText,controller:()=>null,
 library:()=>({settleDiary:async()=>diary}),reviewEditor:()=>editor,flushPendingReviewSave:()=>saved,
 setStatus:(...args)=>statuses.push(args)});
assert.equal(await nav.goTab('plan'),false);
const departure={from:'review',to:'plan',source:'test',generation:1,traversal:false};
assert.equal(await nav.prepareTabDeparture(departure),true);
saved=false;assert.equal(await nav.prepareTabDeparture(departure),false);saved=true;
for(const [failure,message] of [[new Error('Save failed'),'Save failed'],[{message:'Disk full'},'Disk full'],[new Error(''),'Reflection could not be saved safely.'],[null,'Reflection could not be saved safely.']]){
 editor={settled:async()=>{throw failure;}};assert.equal(await nav.prepareTabDeparture(departure),false);assert.deepEqual(statuses.at(-1),['save-status',message,false]);
}
diary=false;assert.equal(await nav.prepareTabDeparture({...departure,from:'library'}),false);
assert.equal(await nav.prepareTabDeparture({...departure,to:'review'}),true);

// Dispatch must retain ownership gates and textarea revision ordering while
// ignoring synthetic events whose target has no element capabilities.
let owner=false,mutations=0,revisions=0,prevented=0,stopped=0;const routes=[],ratings=[];
const table={save:()=>{mutations++;}},owned=new Set(['save']);
const delegated=foundation.createDelegated({document:{getElementById:()=>null},goTab:(...args)=>{routes.push(args);return Promise.resolve(true);},setStudyQuality:value=>ratings.push(value),requirePrimaryTab:()=>owner,
 CLICK_ACTIONS:table,CHANGE_ACTIONS:table,INPUT_ACTIONS:table,BLUR_ACTIONS:table,KEYDOWN_ACTIONS:{save:()=>{mutations++;return false;}},
 OWNER_REQUIRED_CLICK_ACTIONS:owned,OWNER_REQUIRED_CHANGE_ACTIONS:owned,OWNER_REQUIRED_INPUT_ACTIONS:owned,OWNER_REQUIRED_BLUR_ACTIONS:owned,OWNER_REQUIRED_KEYDOWN_ACTIONS:owned,
 editedTextarea:()=>revisions++,UiTabRegistry:{handleKeydown:()=>false},Pomodoro:{stop:()=>{}}});
const event=target=>({target,key:'Enter',preventDefault(){prevented++;},stopPropagation(){stopped++;}});
for(const method of ['handleDelegatedClick','handleDelegatedChange','handleDelegatedInput','handleDelegatedBlur','handleDelegatedKeydown'])for(const target of [null,{},new EventTarget()])assert.doesNotThrow(()=>delegated[method](event(target)));
const target={dataset:{action:'save',change:'save',input:'save',blur:'save',keydown:'save'},closest:selector=>selector==='[data-action]'?target:null};
for(const method of ['handleDelegatedClick','handleDelegatedChange','handleDelegatedInput','handleDelegatedBlur','handleDelegatedKeydown'])delegated[method](event(target));
assert.equal(mutations,0);delegated.handleDelegatedInput(event(new Textarea()));assert.equal(revisions,1);assert.equal(mutations,0);
owner=true;
for(const method of ['handleDelegatedClick','handleDelegatedChange','handleDelegatedInput','handleDelegatedBlur','handleDelegatedKeydown'])delegated[method](event(target));
assert.equal(mutations,5);assert.equal(prevented,2);assert.equal(stopped,1);
const tab={dataset:{tab:'library'},closest:selector=>selector==='[data-tab]'?tab:null};delegated.handleDelegatedClick(event(tab));assert.equal(routes[0][0],'library');assert.equal(routes[0][1].source,'primary-tab');
const quality={dataset:{quality:''},closest:selector=>selector==='[data-quality]'?quality:null};delegated.handleDelegatedClick(event(quality));assert.deepEqual(ratings,[null]);
console.log(JSON.stringify({status:'PASS',suite:'foundation-host',dictionaryAndScalars:true,departureSafety:true,delegationOwnership:true,nonElementTargets:true}));
