(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,declaredFunctions:requireFunctions}=registry.contracts;
// Links between notes and their tags: the one picker (the bar's +, the Link
// menu's Note, typing [[ and the # suggestions all open it), the linked-notes
// bar that sits under a note's text, and the tags read from the notes' text.
// Notes are named by id; titles are only shown.
registry.define('note-links',1,()=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    view:freeze(['document']),
    notes:freeze(['documents','get','link','linkedFrom','list']),
    text:freeze(['tagsIn']),
    ownership:freeze(['canMutate'])
  });
  const SHOWN=50;
  function createController(input){
    exactObject(input,['ports'],'Note links input');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Note links ports');
    exactObject(ports.view,PORT_FIELDS.view,'Note links view port');requireFunctions(ports.notes,PORT_FIELDS.notes,'Note links notes port');requireFunctions(ports.ownership,PORT_FIELDS.ownership,'Note links ownership port');requireFunctions(ports.text,PORT_FIELDS.text,'Note links text port');
    const {document}=ports.view,notes=ports.notes,text=ports.text,canMutate=ports.ownership.canMutate;
    if(!document||typeof document.createElement!=='function')throw new TypeError('Note links document is unavailable.');
    const leaf=label=>String(label||'').split(/\s*>\s*/).filter(Boolean).at(-1)||String(label||'');
    const path=label=>String(label||'').split(/\s*>\s*/).filter(Boolean).slice(0,-1).join(' › ');
    const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
    const button=(className,text,label)=>{const node=element('button',className,text);node.type='button';if(label){node.setAttribute('aria-label',label);node.title=label;}return node;};

    // Notes whose title has every word typed, those starting with it first;
    // with nothing typed, the most recently edited.
    function matches(query,exclude){
      const words=String(query||'').toLowerCase().split(/\s+/).filter(Boolean),skip=new Set(exclude);
      const rows=notes.list().filter(row=>!skip.has(row.id));
      if(!words.length)return rows.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,SHOWN);
      const scored=[];
      for(const row of rows){const label=String(row.label||'').toLowerCase();if(!words.every(word=>label.includes(word)))continue;scored.push([leaf(label).startsWith(words[0])?0:label.startsWith(words[0])?1:2,row]);}
      return scored.sort((a,b)=>a[0]-b[0]||String(a[1].label).localeCompare(String(b[1].label))).slice(0,SHOWN).map(([,row])=>row);
    }
    // Tags are read from the notes' text and kept per note revision, so only
    // edited notes are read again. Keys are the notes' title keys.
    let tagCache=new Map(),tagIndex=null;
    function tagState(){
      const snapshot=notes.documents();if(tagIndex&&tagIndex.revision===snapshot.revision)return tagIndex;
      const next=new Map(),byTag=new Map();
      for(const record of snapshot.documents){
        const key=String(record.key||''),revision=String(record.revision||'');let cached=tagCache.get(key);
        if(!cached||cached.revision!==revision){const value=String(record.value||'');cached={revision,tags:value.includes('#')?text.tagsIn(value):[]};}
        next.set(key,cached);for(const tag of cached.tags){let keys=byTag.get(tag);if(!keys)byTag.set(tag,keys=new Set());keys.add(key);}
      }
      tagCache=next;
      tagIndex=freeze({revision:snapshot.revision,byTag,list:freeze([...byTag].map(([tag,keys])=>freeze({tag,count:keys.size})).sort((a,b)=>a.tag.localeCompare(b.tag)))});
      return tagIndex;
    }
    // Every tag in use, with how many notes have it, A to Z.
    function tags(){return tagState().list;}
    // The keys of the notes that have every tag named.
    function tagged(names){
      const byTag=tagState().byTag;let keys=null;
      for(const name of names){const having=byTag.get(name)||new Set();keys=keys?new Set([...keys].filter(key=>having.has(key))):new Set(having);}
      return keys||new Set();
    }
    // Tags holding what was typed, those starting with it first. The text typed
    // so far is left out: the note being written already counts it as a tag,
    // and choosing it would change nothing.
    const tagRows=query=>{
      const typed=String(query||'').trim().toLowerCase().replace(/^#/,''),all=tags();
      const rows=typed?all.filter(row=>row.tag!==typed&&row.tag.includes(typed)).sort((a,b)=>(b.tag.startsWith(typed)?1:0)-(a.tag.startsWith(typed)?1:0)):[...all];
      return rows.slice(0,SHOWN).map(row=>({title:`#${row.tag}`,detail:`${row.count} ${row.count===1?'note':'notes'}`,value:{text:row.tag,end:' '}}));
    };
    const TAG_CHARACTER=/^[\p{L}\p{M}\p{N}_-]$/u;
    // The picker's two uses. Notes resolve to the note chosen or null. Tags
    // resolve to the name to write after the # and what follows it: a tag
    // chosen, or what was typed when a space, a stop or Escape ends it.
    const NOTE_MODE=freeze({label:'Choose a note',placeholder:'Search notes…',empty:'No notes match.',
      rows:query=>matches(query,picker.exclude).map(row=>({title:leaf(row.label),detail:path(row.label),value:row})),typed:()=>null,dismiss:()=>null,key:()=>undefined});
    const TAG_MODE=freeze({label:'Choose a tag',placeholder:'Tag',empty:'',rows:tagRows,
      typed:value=>({text:value,end:' '}),dismiss:value=>({text:value,end:''}),
      key:(event,value,active)=>{
        if(event.key==='Tab'){return active?active.value:{text:value,end:' '};}
        if(event.key===' ')return {text:value,end:' '};
        if(event.key==='Backspace'&&!value)return {text:'',end:''};
        if(event.key.length<=2&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!TAG_CHARACTER.test(event.key))return {text:value,end:event.key};
        return undefined;
      }});
    let picker=null;
    function pickerParts(){
      if(picker)return picker;
      const dialog=element('dialog','note-picker'),field=element('input','note-picker-field ui-field'),list=element('div','note-picker-list'),empty=element('div','note-picker-empty ui-status');
      field.type='search';field.autocomplete='off';
      list.setAttribute('role','listbox');list.id='note-picker-list';field.setAttribute('aria-controls',list.id);empty.hidden=true;
      dialog.append(field,list,empty);document.body.append(dialog);
      picker={dialog,field,list,empty,settle:null,rows:[],active:0,mode:NOTE_MODE,exclude:[]};
      const show=index=>{picker.active=Math.max(0,Math.min(picker.rows.length-1,index));[...list.children].forEach((option,position)=>{const on=position===picker.active;option.classList.toggle('active',on);option.setAttribute('aria-selected',on?'true':'false');if(on){option.scrollIntoView?.({block:'nearest'});field.setAttribute('aria-activedescendant',option.id);}});};
      const close=result=>{const settle=picker.settle;picker.settle=null;if(dialog.open)dialog.close();if(settle)settle(result===undefined?null:result);};
      const choose=index=>{const row=picker.rows[index];if(row)close(row.value);};
      picker.fill=()=>{
        picker.rows=picker.mode.rows(field.value);
        list.replaceChildren(...picker.rows.map((row,index)=>{
          const option=element('div','note-picker-option');option.id=`note-picker-option-${index}`;option.setAttribute('role','option');
          option.append(element('span','note-picker-title',row.title));if(row.detail)option.append(element('span','note-picker-path',row.detail));
          option.addEventListener('pointerdown',event=>event.preventDefault());option.addEventListener('click',()=>choose(index));
          return option;
        }));
        list.hidden=!picker.rows.length;empty.textContent=picker.mode.empty;empty.hidden=picker.rows.length>0||!picker.mode.empty;show(0);
      };
      field.addEventListener('input',()=>picker.fill());
      field.addEventListener('keydown',event=>{
        if(event.isComposing)return;
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();show(picker.active+(event.key==='ArrowDown'?1:-1));return;}
        if(event.key==='Enter'){event.preventDefault();const row=picker.rows[picker.active];close(row?row.value:picker.mode.typed(field.value));return;}
        const result=picker.mode.key(event,field.value,picker.rows[picker.active]);
        if(result!==undefined){event.preventDefault();close(result);}
      });
      dialog.addEventListener('cancel',event=>{event.preventDefault();close(picker.mode.dismiss(field.value));});
      dialog.addEventListener('click',event=>{if(event.target===dialog)close(picker.mode.dismiss(field.value));});
      picker.close=close;
      return picker;
    }
    function open(mode,query,anchor){
      const parts=pickerParts();
      if(parts.settle)parts.close(null);
      parts.mode=mode;parts.dialog.setAttribute('aria-label',mode.label);parts.field.placeholder=mode.placeholder;parts.field.setAttribute('aria-label',mode.label);
      parts.field.value=String(query||'');parts.fill();
      // Tag suggestions sit by the text being typed; notes take the middle.
      const style=parts.dialog.style;parts.dialog.classList.toggle('note-picker-anchored',!!anchor);
      if(anchor){const view=document.defaultView,below=anchor.bottom<(view?.innerHeight||0)*0.6;style.left=`${Math.max(8,Math.min(anchor.left,(view?.innerWidth||0)-288))}px`;style.top=below?`${anchor.bottom+6}px`:'';style.bottom=below?'':`${(view?.innerHeight||0)-anchor.top+6}px`;}
      else style.left=style.top=style.bottom='';
      const restore=document.activeElement;
      return new Promise(resolve=>{
        parts.settle=result=>{resolve(result);try{restore?.focus?.({preventScroll:true});}catch{}};
        try{parts.dialog.showModal();const end=parts.field.value.length;parts.field.focus();parts.field.setSelectionRange?.(end,end);}catch{parts.close(null);}
      });
    }
    // Resolves to the chosen note ({id,key,label}) or null.
    function pick({exclude=[],query=''}={}){const parts=pickerParts();parts.exclude=[...exclude];return open(NOTE_MODE,query);}
    // Offers the tags in use that hold what was typed; when none does, nothing
    // opens and the text stays as typed.
    function pickTag({query='',anchor=null}={}){
      const typed=String(query||'').toLowerCase();
      if(!typed||!tags().some(row=>row.tag!==typed&&row.tag.startsWith(typed)))return Promise.resolve(null);
      return open(TAG_MODE,query,anchor);
    }

    // The bar under a note: the notes it links to (tap to open, × to remove),
    // + to add one, and the notes that link to it. ref is the note's id, or a
    // title that has no note yet. own (Execute) puts the block's own note
    // first; current marks the note on screen.
    function bar({ref,label='',own=false,current='',onOpen,onChange=()=>{}}){
      const root=element('div','note-links');root.setAttribute('role','group');root.setAttribute('aria-label','Linked notes');
      const render=()=>{
        const note=notes.get(ref),id=note?note.id:'',writable=canMutate();
        // A deleted note drops out of the bar and comes back if restored.
        const linked=(note?note.links:[]).map(other=>notes.get(other)).filter(Boolean);
        const row=element('div','note-links-row');
        if(own){const chip=button(`note-link-chip own${!current||current===id?' current':''}`,leaf(note?note.label:label),note?note.label:label);chip.addEventListener('click',()=>onOpen(ref));row.append(chip);}
        for(const other of linked){
          const chip=element('span',`note-link-chip${current===other.id?' current':''}`),open=button('note-link-open',leaf(other.label));open.title=other.label;open.addEventListener('click',()=>onOpen(other.id));chip.append(open);
          if(writable){const remove=button('note-link-remove','×',`Remove ${leaf(other.label)} from linked notes`);remove.addEventListener('click',()=>{if(notes.link(ref,other.id,{on:false}).status==='changed'){render();onChange();}});chip.append(remove);}
          row.append(chip);
        }
        if(writable){
          const add=button('note-links-add',linked.length?'+':'+ Link note','Link another note');
          add.addEventListener('click',async()=>{const chosen=await pick({exclude:[id,...linked.map(other=>other.id)]});if(chosen&&notes.link(ref,chosen.id,{label}).status==='changed'){render();onChange();}});
          row.append(add);
        }
        const from=id?notes.linkedFrom(id):[];
        const parts=[row];
        if(from.length){const line=element('div','note-links-from');line.append(element('span','note-links-from-label','Linked from'));for(const other of from){const open=button('note-link-from',leaf(other.label));open.title=other.label;open.addEventListener('click',()=>onOpen(other.id));line.append(open);}parts.push(line);}
        root.replaceChildren(...(row.childElementCount||from.length?parts:[]));root.hidden=!row.childElementCount&&!from.length;
      };
      render();root.refresh=render;
      return root;
    }
    return freeze({pick,pickTag,tags,tagged,bar,cancel:()=>picker?.close?.(null)});
  }
  return freeze({format:'study-director.note-links-module',contractVersion:1,createController});
});
})();
