(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,declaredFunctions:requireFunctions}=registry.contracts;
// Links between notes: the one note picker (the bar's +, the Link menu's
// Note and typing [[ all open it) and the linked-notes bar that sits under a
// note's text. Notes are named by id; titles are only shown.
registry.define('note-links',1,()=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    view:freeze(['document']),
    notes:freeze(['get','link','linkedFrom','list']),
    ownership:freeze(['canMutate'])
  });
  const SHOWN=50;
  function createController(input){
    exactObject(input,['ports'],'Note links input');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Note links ports');
    exactObject(ports.view,PORT_FIELDS.view,'Note links view port');requireFunctions(ports.notes,PORT_FIELDS.notes,'Note links notes port');requireFunctions(ports.ownership,PORT_FIELDS.ownership,'Note links ownership port');
    const {document}=ports.view,notes=ports.notes,canMutate=ports.ownership.canMutate;
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
    let picker=null;
    function pickerParts(){
      if(picker)return picker;
      const dialog=element('dialog','note-picker'),field=element('input','note-picker-field ui-field'),list=element('div','note-picker-list'),empty=element('div','note-picker-empty ui-status','No notes match.');
      dialog.setAttribute('aria-label','Choose a note');field.type='search';field.placeholder='Search notes…';field.autocomplete='off';field.setAttribute('aria-label','Search notes');
      list.setAttribute('role','listbox');list.id='note-picker-list';field.setAttribute('aria-controls',list.id);empty.hidden=true;
      dialog.append(field,list,empty);document.body.append(dialog);
      picker={dialog,field,list,empty,settle:null,rows:[],active:0};
      const show=index=>{picker.active=Math.max(0,Math.min(picker.rows.length-1,index));[...list.children].forEach((option,position)=>{const on=position===picker.active;option.classList.toggle('active',on);option.setAttribute('aria-selected',on?'true':'false');if(on){option.scrollIntoView?.({block:'nearest'});field.setAttribute('aria-activedescendant',option.id);}});};
      const choose=index=>{const row=picker.rows[index];if(row)close(row);};
      const close=result=>{const settle=picker.settle;picker.settle=null;if(dialog.open)dialog.close();if(settle)settle(result||null);};
      picker.fill=()=>{
        picker.rows=matches(field.value,picker.exclude);
        list.replaceChildren(...picker.rows.map((row,index)=>{
          const option=element('div','note-picker-option');option.id=`note-picker-option-${index}`;option.setAttribute('role','option');
          option.append(element('span','note-picker-title',leaf(row.label)));const where=path(row.label);if(where)option.append(element('span','note-picker-path',where));
          option.addEventListener('pointerdown',event=>event.preventDefault());option.addEventListener('click',()=>choose(index));
          return option;
        }));
        empty.hidden=picker.rows.length>0;show(0);
      };
      field.addEventListener('input',()=>picker.fill());
      field.addEventListener('keydown',event=>{
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();show(picker.active+(event.key==='ArrowDown'?1:-1));}
        else if(event.key==='Enter'){event.preventDefault();choose(picker.active);}
      });
      dialog.addEventListener('cancel',event=>{event.preventDefault();close(null);});
      dialog.addEventListener('click',event=>{if(event.target===dialog)close(null);});
      picker.close=close;
      return picker;
    }
    // Resolves to the chosen note ({id,key,label}) or null.
    function pick({exclude=[],query=''}={}){
      const parts=pickerParts();
      if(parts.settle)parts.close(null);
      parts.exclude=[...exclude];parts.field.value=String(query||'');parts.fill();
      const restore=document.activeElement;
      return new Promise(resolve=>{
        parts.settle=result=>{resolve(result);try{restore?.focus?.({preventScroll:true});}catch{}};
        try{parts.dialog.showModal();parts.field.focus();}catch{parts.close(null);}
      });
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
    return freeze({pick,bar,cancel:()=>picker?.close?.(null)});
  }
  return freeze({format:'study-director.note-links-module',contractVersion:1,createController});
});
})();
