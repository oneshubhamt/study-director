import type {ModuleRegistration} from '../../types/module-registration.ts';
import type {
  NoteLinkBar,NoteLinkBarOptions,NoteLinkNavigation,NoteLinkNavigationInput,NoteLinksController,NoteLinksInput,
  NoteLinksModule as NoteLinksModuleContract,NotePickOptions,NotePickerAnchor,NoteTag,NoteTagCompletion,NoteTagPickOptions
} from '../../types/note-links.ts';
import type {NoteView} from '../../types/notes-host.ts';

const sdNoteLinksFactory=(()=>{
'use strict';
const registry=(globalThis as typeof globalThis&{[key:symbol]:ModuleRegistration<'note-links','study-director.note-links-module'>|undefined})[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,declaredFunctions:requireFunctions}=registry.contracts;
const createModule=():NoteLinksModuleContract=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    view:freeze(['document']),
    notes:freeze(['documents','get','link','linkedFrom','list']),
    text:freeze(['tagsIn']),
    ownership:freeze(['canMutate'])
  });
  const SHOWN=50;
  type PickerValue=NoteView|NoteTagCompletion;
  type PickerRow=Readonly<{title:string;detail?:string;value:PickerValue}>;
  type PickerMode=Readonly<{
    label:string;placeholder:string;empty:string;
    rows:(query:string)=>readonly PickerRow[];
    typed:(value:string)=>PickerValue|null;
    dismiss:(value:string)=>PickerValue|null;
    key:(event:KeyboardEvent,value:string,active:PickerRow|undefined)=>PickerValue|undefined;
  }>;
  interface PickerState{
    readonly dialog:HTMLDialogElement;readonly field:HTMLInputElement;readonly list:HTMLDivElement;readonly empty:HTMLDivElement;
    settle:((result:PickerValue|null)=>void)|null;rows:readonly PickerRow[];active:number;mode:PickerMode;exclude:string[];
    fill():void;close(result:PickerValue|null):void;
  }
  function createController(input:Readonly<NoteLinksInput>):Readonly<NoteLinksController>{
    exactObject(input,['ports'],'Note links input');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Note links ports');
    exactObject(ports.view,PORT_FIELDS.view,'Note links view port');
    requireFunctions(ports.notes,PORT_FIELDS.notes,'Note links notes port');
    requireFunctions(ports.ownership,PORT_FIELDS.ownership,'Note links ownership port');
    requireFunctions(ports.text,PORT_FIELDS.text,'Note links text port');
    const {document}=ports.view,notes=ports.notes,text=ports.text,canMutate=ports.ownership.canMutate;
    if(!document||typeof document.createElement!=='function')throw new TypeError('Note links document is unavailable.');
    const leaf=(label:unknown):string=>String(label||'').split(/\s*>\s*/u).filter(Boolean).at(-1)||String(label||'');
    const path=(label:unknown):string=>String(label||'').split(/\s*>\s*/u).filter(Boolean).slice(0,-1).join(' › ');
    const element=<K extends keyof HTMLElementTagNameMap>(tag:K,className:string,textValue?:unknown):HTMLElementTagNameMap[K]=>{
      const node=document.createElement(tag);if(className)node.className=className;if(textValue!==undefined)node.textContent=String(textValue);return node;
    };
    const button=(className:string,textValue:string,label?:string):HTMLButtonElement=>{
      const node=element('button',className,textValue);node.type='button';if(label){node.setAttribute('aria-label',label);node.title=label;}return node;
    };

    function matches(query:unknown,exclude:readonly string[]):readonly NoteView[]{
      const words=String(query||'').toLowerCase().split(/\s+/u).filter(Boolean),skip=new Set(exclude);
      const rows=[...notes.list()].filter(row=>!skip.has(row.id));
      if(!words.length)return rows.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,SHOWN).map(row=>notes.get(row.id)).filter((row):row is NoteView=>row!==null);
      const first=words[0]??'',scored:Array<readonly [number,NoteView]>=[];
      for(const metadata of rows){
        const row=notes.get(metadata.id);if(!row)continue;
        const label=String(row.label||'').toLowerCase();if(!words.every(word=>label.includes(word)))continue;
        scored.push(freeze([leaf(label).startsWith(first)?0:label.startsWith(first)?1:2,row] as const));
      }
      return scored.sort((a,b)=>a[0]-b[0]||a[1].label.localeCompare(b[1].label)).slice(0,SHOWN).map(([,row])=>row);
    }
    let tagCache=new Map<string,Readonly<{revision:string;tags:readonly string[]}>>();
    let tagIndex:Readonly<{revision:number;byTag:Map<string,Set<string>>;list:readonly NoteTag[]}>|null=null;
    function tagState(){
      const snapshot=notes.documents();if(tagIndex&&tagIndex.revision===snapshot.revision)return tagIndex;
      const next=new Map<string,Readonly<{revision:string;tags:readonly string[]}>>(),byTag=new Map<string,Set<string>>();
      for(const record of snapshot.documents){
        const key=String(record.key||''),revision=String(record.revision||'');let cached=tagCache.get(key);
        if(!cached||cached.revision!==revision){const value=String(record.value||'');cached=freeze({revision,tags:value.includes('#')?freeze([...text.tagsIn(value)]):freeze([])});}
        next.set(key,cached);for(const tag of cached.tags){let keys=byTag.get(tag);if(!keys){keys=new Set<string>();byTag.set(tag,keys);}keys.add(key);}
      }
      tagCache=next;
      tagIndex=freeze({revision:snapshot.revision,byTag,list:freeze([...byTag].map(([tag,keys])=>freeze({tag,count:keys.size})).sort((a,b)=>a.tag.localeCompare(b.tag)))});
      return tagIndex;
    }
    function tags():readonly NoteTag[]{return tagState().list;}
    function tagged(names:readonly string[]):Set<string>{
      const byTag=tagState().byTag;let keys:Set<string>|null=null;
      for(const name of names){
        const having=byTag.get(name)||new Set<string>();
        keys=keys===null?new Set<string>(having):new Set<string>([...keys].filter((key:string)=>having.has(key)));
      }
      return keys||new Set<string>();
    }
    const tagRows=(query:string):readonly PickerRow[]=>{
      const typed=String(query||'').trim().toLowerCase().replace(/^#/u,''),all=tags();
      const rows=typed?all.filter(row=>row.tag!==typed&&row.tag.includes(typed)).sort((a,b)=>Number(b.tag.startsWith(typed))-Number(a.tag.startsWith(typed))):[...all];
      return rows.slice(0,SHOWN).map(row=>freeze({title:`#${row.tag}`,detail:`${row.count} ${row.count===1?'note':'notes'}`,value:freeze({text:row.tag,end:' '})}));
    };
    const TAG_CHARACTER=/^[\p{L}\p{M}\p{N}_-]$/u;
    let picker:PickerState|null=null;
    const NOTE_MODE:PickerMode=freeze({
      label:'Choose a note',placeholder:'Search notes…',empty:'No notes match.',
      rows:(query:string)=>matches(query,picker?.exclude||[]).map(row=>freeze({title:leaf(row.label),detail:path(row.label),value:row})),
      typed:()=>null,dismiss:()=>null,key:()=>undefined
    });
    const TAG_MODE:PickerMode=freeze({
      label:'Choose a tag',placeholder:'Tag',empty:'',rows:tagRows,
      typed:(value:string)=>freeze({text:value,end:' '}),dismiss:(value:string)=>freeze({text:value,end:''}),
      key:(event:KeyboardEvent,value:string,active:PickerRow|undefined)=>{
        if(event.key==='Tab')return active?active.value:freeze({text:value,end:' '});
        if(event.key===' ')return freeze({text:value,end:' '});
        if(event.key==='Backspace'&&!value)return freeze({text:'',end:''});
        if(event.key.length<=2&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!TAG_CHARACTER.test(event.key))return freeze({text:value,end:event.key});
        return undefined;
      }
    });
    function pickerParts():PickerState{
      if(picker)return picker;
      const dialog=element('dialog','note-picker'),field=element('input','note-picker-field ui-field'),list=element('div','note-picker-list'),empty=element('div','note-picker-empty ui-status');
      field.type='search';field.autocomplete='off';
      list.setAttribute('role','listbox');list.id='note-picker-list';field.setAttribute('aria-controls',list.id);empty.hidden=true;
      dialog.append(field,list,empty);document.body.append(dialog);
      const state:PickerState={
        dialog,field,list,empty,settle:null,rows:freeze([]),active:0,mode:NOTE_MODE,exclude:[],
        fill:()=>undefined,close:()=>undefined
      };
      const show=(index:number)=>{
        state.active=Math.max(0,Math.min(state.rows.length-1,index));
        [...list.children].forEach((child,position)=>{
          if(!(child instanceof HTMLElement))return;
          const on=position===state.active;child.classList.toggle('active',on);child.setAttribute('aria-selected',on?'true':'false');
          if(on){child.scrollIntoView?.({block:'nearest'});field.setAttribute('aria-activedescendant',child.id);}
        });
      };
      const close=(result:PickerValue|null)=>{
        const settle=state.settle;state.settle=null;if(dialog.open)dialog.close();if(settle)settle(result);
      };
      const choose=(index:number)=>{const row=state.rows[index];if(row)close(row.value);};
      state.fill=()=>{
        state.rows=state.mode.rows(field.value);
        list.replaceChildren(...state.rows.map((row,index)=>{
          const option=element('div','note-picker-option');option.id=`note-picker-option-${index}`;option.setAttribute('role','option');
          option.append(element('span','note-picker-title',row.title));if(row.detail)option.append(element('span','note-picker-path',row.detail));
          option.addEventListener('pointerdown',event=>event.preventDefault());option.addEventListener('click',()=>choose(index));return option;
        }));
        list.hidden=!state.rows.length;empty.textContent=state.mode.empty;empty.hidden=state.rows.length>0||!state.mode.empty;show(0);
      };
      state.close=close;
      field.addEventListener('input',()=>state.fill());
      field.addEventListener('keydown',event=>{
        if(event.isComposing)return;
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();show(state.active+(event.key==='ArrowDown'?1:-1));return;}
        if(event.key==='Enter'){event.preventDefault();const row=state.rows[state.active];close(row?row.value:state.mode.typed(field.value));return;}
        const result=state.mode.key(event,field.value,state.rows[state.active]);if(result!==undefined){event.preventDefault();close(result);}
      });
      dialog.addEventListener('cancel',event=>{event.preventDefault();close(state.mode.dismiss(field.value));});
      dialog.addEventListener('click',event=>{if(event.target===dialog)close(state.mode.dismiss(field.value));});
      picker=state;return state;
    }
    function open(mode:PickerMode,query:unknown,anchor?:NotePickerAnchor|null):Promise<PickerValue|null>{
      const parts=pickerParts();if(parts.settle)parts.close(null);
      parts.mode=mode;parts.dialog.setAttribute('aria-label',mode.label);parts.field.placeholder=mode.placeholder;parts.field.setAttribute('aria-label',mode.label);
      parts.field.value=String(query||'');parts.fill();
      const style=parts.dialog.style;parts.dialog.classList.toggle('note-picker-anchored',!!anchor);
      if(anchor){const view=document.defaultView,below=anchor.bottom<(view?.innerHeight||0)*0.6;style.left=`${Math.max(8,Math.min(anchor.left,(view?.innerWidth||0)-288))}px`;style.top=below?`${anchor.bottom+6}px`:'';style.bottom=below?'':`${(view?.innerHeight||0)-anchor.top+6}px`;}
      else style.left=style.top=style.bottom='';
      const restore=document.activeElement instanceof HTMLElement?document.activeElement:null;
      return new Promise(resolve=>{
        parts.settle=result=>{resolve(result);try{restore?.focus({preventScroll:true});}catch{}};
        try{parts.dialog.showModal();const end=parts.field.value.length;parts.field.focus();parts.field.setSelectionRange(end,end);}catch{parts.close(null);}
      });
    }
    async function pick({exclude=[],query=''}:NotePickOptions={}):Promise<NoteView|null>{
      const parts=pickerParts();parts.exclude=[...exclude];const result=await open(NOTE_MODE,query);
      return result&&'id' in result&&'key' in result?result:null;
    }
    async function pickTag({query='',anchor=null}:NoteTagPickOptions={}):Promise<NoteTagCompletion|null>{
      const typed=String(query||'').toLowerCase();if(!typed||!tags().some(row=>row.tag!==typed&&row.tag.startsWith(typed)))return null;
      const result=await open(TAG_MODE,query,anchor);return result&&'text' in result&&'end' in result?result:null;
    }
    function bar({ref,label='',own=false,current='',onOpen,onChange=()=>undefined}:NoteLinkBarOptions):NoteLinkBar{
      const root=element('div','note-links') as NoteLinkBar;root.setAttribute('role','group');root.setAttribute('aria-label','Linked notes');
      const render=()=>{
        const note=notes.get(ref),id=note?note.id:'',writable=canMutate();
        const linked=(note?note.links:[]).map(other=>notes.get(other)).filter((other):other is NoteView=>other!==null);
        const row=element('div','note-links-row');
        if(own){const chip=button(`note-link-chip own${!current||current===id?' current':''}`,leaf(note?note.label:label),note?note.label:label);chip.addEventListener('click',()=>{onOpen(ref);});row.append(chip);}
        for(const other of linked){
          const chip=element('span',`note-link-chip${current===other.id?' current':''}`),openButton=button('note-link-open',leaf(other.label));openButton.title=other.label;openButton.addEventListener('click',()=>{onOpen(other.id);});chip.append(openButton);
          if(writable){const remove=button('note-link-remove','×',`Remove ${leaf(other.label)} from linked notes`);remove.addEventListener('click',()=>{if(notes.link(ref,other.id,{on:false}).status==='changed'){render();onChange();}});chip.append(remove);}row.append(chip);
        }
        if(writable){
          const add=button('note-links-add',linked.length?'+':'+ Link note',linked.length?'Link another note':'Link note');
          add.addEventListener('click',()=>{void pick({exclude:[id,...linked.map(other=>other.id)]}).then(chosen=>{if(chosen&&notes.link(ref,chosen.id,{label}).status==='changed'){render();onChange();}});});row.append(add);
        }
        const from=id?notes.linkedFrom(id):[],parts:HTMLElement[]=[row];
        if(from.length){const line=element('div','note-links-from');line.append(element('span','note-links-from-label','Linked from'));for(const other of from){if(!other)continue;const openButton=button('note-link-from',leaf(other.label));openButton.title=other.label;openButton.addEventListener('click',()=>{onOpen(other.id);});line.append(openButton);}parts.push(line);}
        root.replaceChildren(...(row.childElementCount||from.length?parts:[]));root.hidden=!row.childElementCount&&!from.length;
      };
      root.refresh=render;render();return root;
    }
    return freeze({pick,pickTag,tags,tagged,bar,cancel:()=>picker?.close(null)});
  }
  function createNavigation(input:Readonly<NoteLinkNavigationInput>):Readonly<NoteLinkNavigation>{
    exactObject(input,['controller','notes','execution','library'],'Note link navigation input');
    requireFunctions(input.controller,['pick','pickTag'],'Note link navigation controller');
    requireFunctions(input.notes,['get'],'Note link navigation notes');
    requireFunctions(input.execution,['isLiveTrackableTimer','current','open'],'Note link navigation execution');
    requireFunctions(input.library,['open','reveal','filterTag'],'Note link navigation library');
    const {controller,notes,execution,library}=input;
    async function open(id:string,field:HTMLTextAreaElement|null=null):Promise<boolean>{
      if(!notes.get(id))return false;
      if(field?.id==='pn-extra'&&execution.isLiveTrackableTimer()){
        const current=execution.current();return await execution.open(id,current.taskId,current.ownNote);
      }
      if(!await library.open())return false;return library.reveal(id);
    }
    async function showTagged(name:string,passive:boolean,field:HTMLTextAreaElement|null=null):Promise<void>{
      const inLibrary=!!field?.closest('#library-notes-editor');
      if(passive){if(inLibrary)library.filterTag(name);return;}
      if(!inLibrary&&!await library.open())return;library.filterTag(name,{show:!inLibrary});
    }
    function richText(field:HTMLTextAreaElement|null=null){
      return freeze({
        pick:()=>controller.pick(),
        title:(id:string)=>notes.get(id)?.label??null,
        open:(id:string)=>{void open(id,field);},
        tag:(name:string,passive:boolean)=>{void showTagged(name,passive,field);},
        pickTag:(options?:NoteTagPickOptions)=>controller.pickTag(options)
      });
    }
    return freeze({open,richText,showTagged});
  }
  return freeze({format:'study-director.note-links-module',contractVersion:1,createController,createNavigation});
};
registry.define('note-links',1,createModule);
return createModule;
})();
export type NoteLinksModule=ReturnType<typeof sdNoteLinksFactory>;
