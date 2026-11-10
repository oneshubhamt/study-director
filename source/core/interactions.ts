import type {InteractionChoice,InteractionGroup,InteractionCheckbox,InteractionOptions,InteractionKind,InteractionResult,InteractionResults,InteractionRequest,ActiveInteraction,InteractionInput,ToastEntry} from '../../types/interactions.ts';
import type {WorkspaceDescriptor,WorkspaceCloseMeta} from '../../types/workspace.ts';
import type {NotificationAction,NotificationRequest} from '../../types/notifications.ts';
import type {NotificationEvent,NotificationState} from './notice-coordinator.ts';
import type {ModuleRegistration} from '../../types/module-registration.ts';
const sdInteractionsFactory=(()=>{
'use strict';
const registry=(globalThis as unknown as Record<symbol,unknown>)[Symbol.for('studyDirector.internalModules.v1')] as ModuleRegistration<'interactions','study-director.interactions-module'>|undefined;
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const createModule=()=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    environment:freeze(['clearTimeout','document','nativeConfirm','nativePrompt','requestAnimationFrame','setTimeout','window']),
    diagnostics:freeze(['capture']),
    history:freeze(['closed','opened','requestClose']),
    notifications:freeze(['dismissAll','dismissEvent','notify','pauseEvent','setHidden','setPaused','subscribe'])
  });
  // Correctness fallback only. Normal removal follows transition completion;
  // this intentionally does not mirror any presentation duration token.
  const TOAST_REMOVE_FALLBACK_MS=1000;
  // Stack layout: cards peeking behind the front one, the sideways distance
  // that closes a card, and the phone width (matches the stylesheet).
  const PEEK_LIMIT=2,SWIPE_DISTANCE=80,PHONE_QUERY='(max-width: 560px)';
  function exactObject<T>(value:T,keys:readonly string[],label:string){
    const actual=value&&typeof value==='object'?Object.keys(value).sort():[];
    const expected=[...keys].sort();
    if(!value||!Object.isFrozen(value)||actual.join('|')!==expected.join('|')){
      throw new TypeError(`${label} is incomplete, mutable, or contains unexpected fields (frozen=${!!value&&Object.isFrozen(value)}; actual=${actual.join(',')||'none'}; expected=${expected.join(',')}).`);
    }
    return value;
  }
  function functions<T>(value:T,keys:readonly string[],label:string){
    exactObject(value,keys,label);
    if(keys.some(key=>typeof (value as Record<string,unknown>)[key]!=='function'))throw new TypeError(label+' must contain functions only.');
  }
  function isList<T>(value:readonly T[]|undefined):value is readonly T[]{return Array.isArray(value);}
  function createController(controllerInput:InteractionInput){
    exactObject(controllerInput,['ports'],'Interaction input');
    const ports=exactObject(controllerInput.ports,Object.keys(PORT_FIELDS),'Interaction ports');
    exactObject(ports.environment,PORT_FIELDS.environment,'Interaction environment');
    functions(ports.diagnostics,PORT_FIELDS.diagnostics,'Interaction diagnostics');
    functions(ports.history,PORT_FIELDS.history,'Interaction history');
    functions(ports.notifications,PORT_FIELDS.notifications,'Interaction notifications');
    const notifications=ports.notifications;
    const {clearTimeout,document,nativeConfirm,nativePrompt,requestAnimationFrame,setTimeout,window}=ports.environment;
    const {capture}=ports.diagnostics,historyPort=ports.history;
    const historyNonce=String(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9_-]/g,'').slice(0,24)||'session';
    let active:ActiveInteraction|null=null;
    const queue:InteractionRequest[]=[];
    let historySequence=0;

    function cleanText(value:unknown,max=2000){
      const text=String(value??'').trim();
      return text.length>max?text.slice(0,max):text;
    }
    function cleanOptions<T extends object>(options:T|string|null|undefined):T|{message:string}{return options&&typeof options==='object'?options:{message:String(options||'')};}
    function dialogElement(){return document.getElementById('sd-interaction-dialog');}
    function toastRegion(){return document.getElementById('sd-toast-region');}
    function supportsDialog(dialog:HTMLElement|null):dialog is HTMLDialogElement{return !!(dialog&&typeof (dialog as HTMLDialogElement).showModal==='function'&&typeof (dialog as HTMLDialogElement).close==='function');}
    function fallbackMessage(options:InteractionOptions){
      const title=cleanText(options.title,160),message=cleanText(options.message),details=isList(options.details)?options.details.map(item=>cleanText(item,500)).filter(Boolean):[];
      return [title,message,...details].filter(Boolean).join('\n\n');
    }
    function fallback(type:InteractionKind,options:InteractionOptions):Promise<InteractionResult>{
      const message=fallbackMessage(options);
      try{
        if(type==='confirm')return Promise.resolve(!!nativeConfirm(message));
        if(type==='input'){
          if(options.inputType==='password')return Promise.resolve(null);
          const result=nativePrompt(message,cleanText(options.defaultValue,500));
          if(result===null)return Promise.resolve(null);
          const value=String(result);
          const error=typeof options.validate==='function'?cleanText(options.validate(value,String(options.defaultOption||'')),300):'';
          if(error){nativeConfirm(error);return Promise.resolve(null);}
          const checkbox=options.checkbox&&options.checkbox.label?{checked:!!nativeConfirm([cleanText(options.checkbox.label,180),'OK = yes · Cancel = no'].join('\n'))}:{};
          return Promise.resolve(freeze({value,option:String(options.defaultOption||''),...checkbox}));
        }
        if(type==='choose'){
          const choices=isList(options.choices)?options.choices:[];
          const labels=choices.map((choice,index)=>`${index+1}. ${cleanText(choice.label,100)}`).join('\n');
          const result=nativePrompt(`${message}\n\n${labels}`,choices.length?'1':'');
          const index=Math.floor(Number(result))-1;
          return Promise.resolve(index>=0&&index<choices.length?String(choices[index]!.value):null);
        }
        if(type==='configure'){
          if(!nativeConfirm(message))return Promise.resolve(null);
          const rows=(isList(options.groups)?options.groups:[]).map((group:InteractionGroup)=>{
            const id=String(group&&group.id||''),choices=isList(group&&group.choices)?(group.choices as readonly InteractionChoice[]).filter((choice:InteractionChoice)=>choice&&choice.value!==undefined&&choice.label):[];
            return id&&choices.length?{group,id,choices,values:new Set(choices.map(choice=>String(choice.value)))}:null;
          }).filter(row=>row!==null),byId=new Map(rows.map(row=>[row.id,row])),values:Record<string,string|boolean>={};
          const applyValues=(choice:InteractionChoice)=>{
            const targets=choice&&choice.applyValues&&!Array.isArray(choice.applyValues)&&typeof choice.applyValues==='object'?choice.applyValues:null;if(!targets)return;
            for(const [targetId,targetValue] of Object.entries(targets)){const row=byId.get(String(targetId)),clean=String(targetValue);if(row&&row.values.has(clean))values[row.id]=clean;}
          };
          for(const row of rows){
            const {group,id,choices}=row,current=values[id]??String(group.defaultValue??choices[0]!.value),selected=Math.max(0,choices.findIndex(choice=>String(choice.value)===current));
            const labels=choices.map((choice,index)=>`${index+1}. ${cleanText(choice.label,100)}`).join('\n');
            const result=nativePrompt(`${message}\n\n${cleanText(group.label||'Choose an option',120)}\n${labels}`,String(selected+1));
            if(result===null)return Promise.resolve(null);
            const index=Math.floor(Number(result))-1;
            if(index<0||index>=choices.length)return Promise.resolve(null);
            const choice=choices[index]!;values[id]=String(choice.value);applyValues(choice);
          }
          for(const checkbox of isList(options.checkboxes)?options.checkboxes:[]){
            const id=String(checkbox&&checkbox.id||''),label=cleanText(checkbox&&checkbox.label,180);if(!id||!label)continue;
            const detail=cleanText(checkbox&&checkbox.description,300),prompt=[label,detail,'OK = checked · Cancel = unchecked'].filter(Boolean).join('\n');
            values[id]=!!nativeConfirm(prompt);
          }
          return Promise.resolve(freeze(values));
        }
      }catch(error){capture('interaction.fallback',error);}
      return Promise.resolve(type==='confirm'?false:null);
    }
    function button(label:unknown,className=''){
      const element=document.createElement('button');
      element.type='button';element.className='interaction-action ui-btn '+className;element.textContent=cleanText(label,100);
      return element;
    }
    function appendCopy(body:HTMLElement,options:InteractionOptions){
      if(options.message){const message=document.createElement('p');message.className='interaction-message ui-body';message.textContent=cleanText(options.message);body.appendChild(message);}
      const details=isList(options.details)?options.details.map(item=>cleanText(item,500)).filter(Boolean):[];
      if(details.length){
        const list=document.createElement('ul');list.className='interaction-details ui-body';
        details.forEach(item=>{const row=document.createElement('li');row.textContent=item;list.appendChild(row);});
        body.appendChild(list);
      }
    }
    function sameHistoryDescriptor(a:WorkspaceDescriptor|null,b:WorkspaceDescriptor|null){return !!a&&!!b&&a.kind===b.kind&&a.token===b.token;}
    function completeSettlement(current:ActiveInteraction,value:InteractionResult){
      if(active!==current)return false;
      active=null;
      current.resolve(value);
      requestAnimationFrame(pump);
      return true;
    }
    function settle(value:InteractionResult,meta:WorkspaceCloseMeta={}){
      const current=active;if(!current)return false;
      const fromHistory=meta.fromHistory===true;
      if(current.historyPending){
        if(!fromHistory)return false;
        return completeSettlement(current,current.settlementValue??null);
      }
      const descriptor=current.historyDescriptor||null;
      const historyPending=!!(descriptor&&!fromHistory&&historyPort.requestClose(descriptor));
      try{current.dialog.close();}catch(error){current.dialog.removeAttribute('open');}
      current.dialog.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(field=>{field.value='';});
      current.dialog.replaceChildren();
      if(descriptor)historyPort.closed(descriptor,freeze({fromHistory,historyPending}));
      if(current.restoreFocus&&document.contains(current.restoreFocus))current.restoreFocus.focus({preventScroll:true});
      if(historyPending){
        current.historyPending=true;
        current.settlementValue=value;
        return true;
      }
      return completeSettlement(current,value);
    }
    function renderRequest(request:InteractionRequest){
      const dialog=dialogElement(),options=request.options;
      if(!supportsDialog(dialog)){void fallback(request.type,options).then(request.resolve);requestAnimationFrame(pump);return;}
      const shell=document.createElement('div');shell.className='interaction-shell';
      const header=document.createElement('div');header.className='interaction-header';
      const eyebrow=document.createElement('div');eyebrow.className='interaction-eyebrow ui-label';eyebrow.textContent=cleanText(options.eyebrow||'Study Director',80);
      const title=document.createElement('h2');title.className='interaction-title ui-title';title.id='sd-interaction-title';title.textContent=cleanText(options.title||'Confirm action',160);
      header.append(eyebrow,title);shell.appendChild(header);
      const body=document.createElement('div');body.className='interaction-body';appendCopy(body,options);shell.appendChild(body);
      const error=document.createElement('div');error.className='interaction-error ui-status';error.id='sd-interaction-error';error.setAttribute('role','alert');error.hidden=true;
      let inputElement:HTMLInputElement|null=null,inputCheckbox:HTMLInputElement|null=null,confirmationElement:HTMLInputElement|null=null,selectedOption=String(options.defaultOption||''),configuredValues:Record<string,string|boolean>|null=null;
      // One tick-box row with its description, for input's tick box and configure's list.
      const checkboxRow=(checkbox:InteractionCheckbox,label:string,onChange:((checked:boolean)=>void)|null=null)=>{
        const row=document.createElement('label');row.className='interaction-checkbox-row ui-body';
        const box=document.createElement('input');box.type='checkbox';box.className='interaction-checkbox';box.checked=checkbox.defaultChecked===true;
        const copy=document.createElement('span');copy.className='interaction-checkbox-copy';
        const title=document.createElement('strong');title.textContent=label;copy.appendChild(title);
        if(checkbox.description){const description=document.createElement('span');description.textContent=cleanText(checkbox.description,300);copy.appendChild(description);}
        if(onChange)box.addEventListener('change',()=>onChange(box.checked));
        row.append(box,copy);return Object.freeze({row,box});
      };
      if(request.type==='input'){
        const optionRows=isList(options.options)?options.options.filter((option:InteractionChoice)=>option&&option.value!==undefined&&option.label):[];
        if(optionRows.length){
          const group=document.createElement('div');group.className='interaction-options';group.setAttribute('role','radiogroup');group.setAttribute('aria-label',cleanText(options.optionLabel||'Location',100));
          optionRows.forEach((option,index)=>{
            const choice=document.createElement('button');choice.type='button';choice.className='interaction-option ui-btn';choice.dataset['value']=String(option.value);choice.setAttribute('role','radio');
            const activeChoice=selectedOption?selectedOption===String(option.value):index===0;
            if(activeChoice)selectedOption=String(option.value);
            choice.setAttribute('aria-checked',activeChoice?'true':'false');choice.classList.toggle('selected',activeChoice);
            const label=document.createElement('strong');label.textContent=cleanText(option.label,100);choice.appendChild(label);
            if(option.description){const description=document.createElement('span');description.textContent=cleanText(option.description,240);choice.appendChild(description);}
            choice.addEventListener('click',()=>{
              selectedOption=String(option.value);
              group.querySelectorAll<HTMLElement>('.interaction-option').forEach(item=>{const selected=item===choice;item.classList.toggle('selected',selected);item.setAttribute('aria-checked',selected?'true':'false');});
              if(typeof options.preview==='function'){
                const preview=body.querySelector('.interaction-preview');if(preview)preview.textContent=cleanText(options.preview(inputElement?inputElement.value:'',selectedOption),300);
              }
            });
            group.appendChild(choice);
          });
          body.appendChild(group);
        }
        const field=document.createElement('label');field.className='interaction-field ui-body';field.textContent=cleanText(options.inputLabel||'Value',120);
        inputElement=document.createElement('input');inputElement.className='interaction-input ui-field';inputElement.type=options.inputType==='password'?'password':options.inputType==='date'?'date':'text';inputElement.autocomplete='off';inputElement.spellcheck=options.spellcheck!==false;
        inputElement.value=String(options.defaultValue||'');inputElement.placeholder=cleanText(options.placeholder,160);
        if(options.inputType==='date'){inputElement.min=cleanText(options.min,32);inputElement.max=cleanText(options.max,32);}else inputElement.maxLength=Math.max(1,Math.min(10000,Number(options.maxLength)||500));
        field.appendChild(inputElement);body.appendChild(field);
        if(options.inputType==='password'){inputElement.spellcheck=false;inputElement.autocomplete=options.confirmPassword?'new-password':'current-password';if(options.confirmPassword){const confirm=document.createElement('label');confirm.className='interaction-field ui-body';confirm.textContent='Confirm password';confirmationElement=inputElement.cloneNode() as HTMLInputElement;confirmationElement.value='';confirm.appendChild(confirmationElement);body.appendChild(confirm);}}
        if(options.hint){const hint=document.createElement('div');hint.className='interaction-hint ui-helper';hint.textContent=cleanText(options.hint,500);body.appendChild(hint);}
        // One optional tick box; when shown, the result carries `checked`.
        if(options.checkbox&&options.checkbox.label){
          const checks=document.createElement('div'),made=checkboxRow(options.checkbox,cleanText(options.checkbox.label,180));checks.className='interaction-checks';
          inputCheckbox=made.box;checks.appendChild(made.row);body.appendChild(checks);
        }
        if(typeof options.preview==='function'){
          const preview=document.createElement('div');preview.className='interaction-preview ui-mono';preview.textContent=cleanText(options.preview!(inputElement!.value,selectedOption),300);body.appendChild(preview);
          inputElement.addEventListener('input',()=>{preview.textContent=cleanText(options.preview!(inputElement!.value,selectedOption),300);error.hidden=true;});
        }else inputElement.addEventListener('input',()=>{error.hidden=true;});
      }
      if(request.type==='choose'){
        const choices=document.createElement('div');choices.className='interaction-choices';
        (isList(options.choices)?options.choices:[]).forEach(choice=>{
          const action=button(choice.label,['danger','caution','primary'].includes(choice.kind||'')?choice.kind:'');
          action.classList.add('interaction-choice');
          if(choice.description){const description=document.createElement('span');description.className='interaction-choice-description';description.textContent=cleanText(choice.description,300);action.appendChild(description);}
          action.addEventListener('click',()=>settle(String(choice.value)));
          choices.appendChild(action);
        });
        body.appendChild(choices);
      }
      if(request.type==='configure'){
        configuredValues={};
        const form=document.createElement('div');form.className='interaction-form';
        const groupRows=(isList(options.groups)?options.groups:[]).map((group:InteractionGroup)=>{
          const id=String(group&&group.id||''),choices=isList(group&&group.choices)?(group.choices as readonly InteractionChoice[]).filter((option:InteractionChoice)=>option&&option.value!==undefined&&option.label):[];
          if(!id||!choices.length)return null;
          return {group,id,choices,values:new Set(choices.map(option=>String(option.value)))};
        }).filter(row=>row!==null),groupById=new Map(groupRows.map(row=>[row.id,row])),hosts=new Map<string,HTMLElement>();
        for(const row of groupRows){
          const configuredDefault=String(row.group.defaultValue??row.choices[0]!.value);
          configuredValues![row.id]=row.values.has(configuredDefault)?configuredDefault:String(row.choices[0]!.value);
        }
        const applyValue=(id:unknown,value:unknown)=>{
          const row=groupById.get(String(id)),clean=String(value);if(!row||!row.values.has(clean))return false;
          configuredValues![row.id]=clean;
          const host=hosts.get(row.id);if(host)host.querySelectorAll<HTMLElement>('.interaction-option').forEach(item=>{const selected=item.dataset['value']===clean;item.classList.toggle('selected',selected);item.setAttribute('aria-checked',selected?'true':'false');});
          return true;
        };
        const applyConfiguredValues=(option:InteractionChoice)=>{
          const values=option&&option.applyValues&&!Array.isArray(option.applyValues)&&typeof option.applyValues==='object'?option.applyValues:null;
          if(!values)return;
          for(const [targetId,targetValue] of Object.entries(values))applyValue(targetId,targetValue);
        };
        groupRows.forEach(({group,id,choices:optionRows})=>{
          const fieldset=document.createElement('fieldset');fieldset.className='interaction-group';
          const legend=document.createElement('legend');legend.className='interaction-group-title ui-label';legend.textContent=cleanText(group.label||'Choose an option',120);fieldset.appendChild(legend);
          if(group.description){const description=document.createElement('div');description.className='interaction-group-description ui-body';description.textContent=cleanText(group.description,400);fieldset.appendChild(description);}
          const optionsHost=document.createElement('div');optionsHost.className='interaction-options';optionsHost.setAttribute('role','radiogroup');optionsHost.setAttribute('aria-label',legend.textContent);hosts.set(id,optionsHost);
          optionRows.forEach(option=>{
            const choice=document.createElement('button');choice.type='button';choice.className='interaction-option ui-btn';choice.dataset['value']=String(option.value);choice.setAttribute('role','radio');
            const selected=configuredValues![id]===String(option.value);
            choice.setAttribute('aria-checked',selected?'true':'false');choice.classList.toggle('selected',selected);
            const label=document.createElement('strong');label.textContent=cleanText(option.label,100);choice.appendChild(label);
            if(option.description){const description=document.createElement('span');description.textContent=cleanText(option.description,300);choice.appendChild(description);}
            choice.addEventListener('click',()=>{applyValue(id,option.value);applyConfiguredValues(option);});
            optionsHost.appendChild(choice);
          });
          fieldset.appendChild(optionsHost);
          // A full comparison is an ephemeral, read-only view. Keep complete
          // text out of radio labels and out of persistent modal state.
          if(group.comparison&&typeof group.comparison==='object'){
            const disclosure=document.createElement('details');disclosure.className='interaction-comparison';
            const savedPlan=String(group.label||'').startsWith('Saved plan ·');
            const kind=savedPlan?'Saved Plan':'Plan draft';
            const summary=document.createElement('summary');summary.textContent='Compare complete '+kind+' texts before choosing';
            disclosure.appendChild(summary);fieldset.appendChild(disclosure);
            disclosure.addEventListener('toggle',()=>{
              if(!disclosure.open||disclosure.dataset['loaded'])return;
              disclosure.dataset['loaded']='1';
              const currentPresent=group.comparison!.current!=null,keptPresent=group.comparison!.kept!=null,
                current=currentPresent?String(group.comparison!.current):'',
                kept=keptPresent?String(group.comparison!.kept):'',
                currentLabel=String(group.comparison!.currentLabel||''),
                keptLabel=String(group.comparison!.keptLabel||'');
              const currentLines=current.split('\n'),keptLines=kept.split('\n');
              let first=0;
              while(first<Math.min(currentLines.length,keptLines.length)&&currentLines[first]===keptLines[first])first++;
              const status=document.createElement('p');status.className='interaction-comparison-status';
              const namesDiffer=currentLabel!==keptLabel;
              status.textContent=currentPresent!==keptPresent
                ?'One side has no saved '+kind.toLowerCase()+'; the other has an authored version, even if its text is empty.'
                :current===kept
                  ?(namesDiffer?'Plan names differ; complete schedule texts match.':'Complete Plan texts are identical.')
                  :(namesDiffer?'Plan names differ. ':'')+'First differing line: '+(first+1)+'. Both complete texts are shown below.';
              const panes=document.createElement('div');panes.className='interaction-comparison-panes';
              for(const [label,value,present,name] of [
                ['This device',current,currentPresent,currentLabel],
                ['Kept alternative',kept,keptPresent,keptLabel]
              ] as const){
                const pane=document.createElement('section'),heading=document.createElement('strong'),full=document.createElement('pre');
                pane.className='interaction-comparison-pane';heading.textContent=label+(name?' · '+name:'');
                full.textContent=!present?'(not saved)':value||'(saved, intentionally empty)';
                full.tabIndex=0;full.setAttribute('aria-label',label+' — complete '+kind+' text');
                pane.append(heading,full);panes.appendChild(pane);
              }
              disclosure.append(status,panes);
            });
          }
          form.appendChild(fieldset);
        });
        const checkboxRows=(isList(options.checkboxes)?options.checkboxes:[]).map(checkbox=>{
          const id=String(checkbox&&checkbox.id||''),label=cleanText(checkbox&&checkbox.label,180);return id&&label?{checkbox,id,label}:null;
        }).filter(row=>row!==null);
        if(checkboxRows.length){
          const checks=document.createElement('div');checks.className='interaction-checks';
          for(const {checkbox,id,label} of checkboxRows){
            const made=checkboxRow(checkbox,label,checked=>{configuredValues![id]=checked;});
            configuredValues![id]=made.box.checked;checks.appendChild(made.row);
          }
          form.appendChild(checks);
        }
        body.appendChild(form);
      }
      body.appendChild(error);
      const actions=document.createElement('div');actions.className='interaction-actions';
      const cancel=button(options.cancelLabel||'Cancel','ghost');cancel.dataset['interactionCancel']='true';cancel.addEventListener('click',()=>settle(request.type==='confirm'?false:null));
      actions.appendChild(cancel);
      let primary:HTMLButtonElement|null=null;
      if(request.type!=='choose'){
        primary=button(options.confirmLabel||(request.type==='input'?'Continue':'Confirm'),options.danger?'danger':options.caution?'caution':'primary');
        primary.addEventListener('click',()=>{
          if(request.type==='confirm'){settle(true);return;}
          if(request.type==='configure'){settle(freeze({...configuredValues}));return;}
          const raw=String(inputElement?inputElement.value:''),value=options.inputType==='password'?raw:raw.trim();
          if(confirmationElement&&confirmationElement.value!==value){error.textContent='Passwords do not match.';error.hidden=false;confirmationElement.focus();return;}
          const validation=typeof options.validate==='function'?cleanText(options.validate(value,selectedOption),300):(options.required&&!value?cleanText(options.requiredMessage||'Enter a value to continue.',300):'');
          if(validation){error.textContent=validation;error.hidden=false;inputElement?.focus();return;}
          settle(freeze({value,option:selectedOption,...(inputCheckbox?{checked:inputCheckbox.checked}:{})}));
        });
        actions.appendChild(primary);
      }
      shell.appendChild(actions);dialog.appendChild(shell);
      dialog.setAttribute('aria-labelledby','sd-interaction-title');dialog.className='interaction-dialog'+(options.danger?' danger':options.caution?' caution':'');
      if(request.type==='configure'&&isList(options.groups)&&options.groups.some(group=>group&&group.comparison))dialog.classList.add('with-comparison');
      dialog.oncancel=event=>{event.preventDefault();settle(request.type==='confirm'?false:null);};
      const historyDescriptor=freeze({kind:'prompt',token:`prompt:${historyNonce}:${++historySequence}`});
      active={...request,dialog,historyDescriptor,restoreFocus:document.activeElement&&typeof (document.activeElement as HTMLElement).focus==='function'?document.activeElement as HTMLElement:null};
      try{dialog.showModal();}
      catch(error){active=null;dialog.replaceChildren();capture('interaction.show-modal',error);void fallback(request.type,options).then(request.resolve);requestAnimationFrame(pump);return;}
      historyPort.opened(historyDescriptor,freeze({replace:false,url:''}));
      requestAnimationFrame(()=>{
        if(inputElement)inputElement.focus();
        else if(options.initialFocus==='primary'&&primary)primary.focus();
        else cancel.focus();
      });
      dialog.onkeydown=event=>{
        if(event.key==='Enter'&&request.type==='input'&&document.activeElement===inputElement){event.preventDefault();primary?.click();}
      };
    }
    function pump(){
      if(active||!queue.length)return;
      renderRequest(queue.shift()!);
    }
    // Queue storage is heterogeneous; type selects the sole rendering/settlement branch.
    function enqueue<K extends InteractionKind>(type:K,rawOptions:InteractionOptions|string):Promise<InteractionResults[K]>{
      const options:InteractionOptions=cleanOptions(rawOptions);
      if(options.signal?.aborted)return Promise.resolve(null);
      let request:InteractionRequest;const abort=()=>{if(active?.resolve===request.resolve)settle(null);else{const index=queue.indexOf(request);if(index>=0){queue.splice(index,1);request.resolve(null);}}};
      return new Promise<InteractionResult>(resolve=>{request={type,options,resolve};options.signal?.addEventListener('abort',abort,{once:true});queue.push(request);pump();}).finally(()=>options.signal?.removeEventListener('abort',abort)) as Promise<InteractionResults[K]>;
    }
    function confirm(options:InteractionOptions|string){return enqueue('confirm',options);}
    function input(options:InteractionOptions|string){return enqueue('input',options);}
    function choose(options:InteractionOptions|string){return enqueue('choose',options);}
    async function configure(options:InteractionOptions){
      options=cleanOptions(options);
      const identities=new Set();
      for(const item of [...(options.groups||[]),...(options.checkboxes||[])]){
        const id=item&&item.id;
        if(typeof id!=='string'||!id||id.length>80||id.trim()!==id||['__proto__','constructor','prototype'].includes(id)||identities.has(id))throw new TypeError('Configuration controls require unique, unchanged identifiers of at most 80 characters.');
        identities.add(id);
        if('choices' in item&&isList(item.choices)){
          const choices=item.choices.map(choice=>String(choice.value));
          if(new Set(choices).size!==choices.length)throw new TypeError('Configuration choices require unique identifiers.');
        }
      }
      return enqueue('configure',options);
    }
    function removeToast(toast:HTMLElement|null){
      if(!toast||!toast.parentNode)return false;
      if(toast.classList.contains('leaving'))return false;
      // A closing card takes no more clicks: its button cannot run twice.
      toast.classList.add('leaving');toast.inert=true;
      let timer=0,done=false;
      const finish=()=>{
        if(done)return;done=true;
        toast.removeEventListener('transitionend',onEnd);
        if(timer)clearTimeout(timer);
        toast.remove();
      };
      const onEnd=(event:TransitionEvent)=>{if(event.target===toast&&(event.propertyName==='opacity'||event.propertyName==='transform'))finish();};
      toast.addEventListener('transitionend',onEnd);
      timer=setTimeout(finish,TOAST_REMOVE_FALLBACK_MS);
      return true;
    }
    // The pop-up stack (docs/areas/notifications.md, stack). Collapsed: pinned
    // cards in full (two, or one on a phone), the newest of the rest in full
    // with up to two cards peeking behind it, and "+N more". Expanded: one
    // scrolling column over a see-through backdrop. Every card stays in the
    // page; the layout only places it.
    const renderedToasts=new Map<string,ToastEntry>();
    let toastRows:readonly NotificationEvent[]=[],stackExpanded=false,stackBar:HTMLDivElement|null=null,moreButton:HTMLButtonElement|null=null,clearButton:HTMLButtonElement|null=null,backdrop:HTMLDivElement|null=null,announcer:HTMLDivElement|null=null,frontObserver:ResizeObserver|null=null,observedFront:HTMLElement|null=null,watchingRegion:HTMLElement|null=null,phoneQuery:MediaQueryList|null=null;
    // Writes only real changes: the stack watches the hidden attribute to follow the
    // Connect card, and every write is a change record.
    function setHiddenFlag(element:HTMLElement,value:HTMLElement["hidden"]){if(element.hidden!==value)element.hidden=value;}
    function phoneLayout(){return !!phoneQuery?.matches;}
    function externalCards(region:HTMLElement){return [...region.querySelectorAll<HTMLElement>(':scope>[data-toast-card]')].filter(card=>!card.hidden);}
    function isStackCard(node:Node|null):node is HTMLElement{
      if(!node||node.nodeType!==1)return false;
      const element=node as HTMLElement;
      if(element.classList.contains('interaction-toast'))return !element.classList.contains('leaving');
      return element.dataset['toastCard']!==undefined&&!element.hidden;
    }
    function nextStackCard(node:Node|null):HTMLElement|null{let next=node;while(next&&!isStackCard(next))next=next.nextSibling;return next as HTMLElement|null;}
    function cardClamped(card:HTMLElement){const message=card.querySelector<HTMLElement>('.interaction-toast-message');return !!message&&!message.hidden&&message.scrollHeight>message.clientHeight+1;}
    function setStackHeight(region:HTMLElement,front:HTMLElement|null){
      if(front&&front.offsetHeight)region.style.setProperty('--sd-stack-front',`${front.offsetHeight}px`);
      else region.style.removeProperty('--sd-stack-front');
    }
    function watchFront(region:HTMLElement,front:HTMLElement|null){
      if(observedFront===front)return;
      frontObserver?.disconnect();observedFront=front;
      if(!front)return;
      frontObserver=new window.ResizeObserver(()=>setStackHeight(region,observedFront));frontObserver.observe(front);
    }
    function ensureBar(region:HTMLElement){
      if(stackBar)return stackBar;
      stackBar=document.createElement('div');stackBar!.className='sd-toast-bar';stackBar!.setAttribute('aria-live','off');
      moreButton=document.createElement('button');moreButton!.type='button';moreButton!.className='sd-toast-more';
      moreButton!.setAttribute('aria-controls',region.id||'sd-toast-region');
      moreButton!.addEventListener('click',()=>setExpanded(!stackExpanded));
      clearButton=document.createElement('button');clearButton!.type='button';clearButton!.className='sd-toast-clear';clearButton!.textContent='Clear all';
      clearButton!.addEventListener('click',clearAll);
      stackBar!.append(moreButton,clearButton);
      return stackBar;
    }
    function announce(text:string){
      const region=toastRegion();if(!region||!text)return;
      if(!announcer){
        announcer=document.createElement('div');announcer.className='sd-toast-announcer';announcer.setAttribute('role','status');announcer.setAttribute('aria-live','polite');
        region.after(announcer);
      }
      announcer.textContent='';requestAnimationFrame(()=>{announcer!.textContent=text;});
    }
    function layoutStack(){
      const region=toastRegion();if(!region)return;
      const card=(row:NotificationEvent)=>renderedToasts.get(row.key)?.toast||null;
      const pinned=toastRows.filter(row=>row.pinned).map(card).filter(row=>row!==null);
      const stream=[...externalCards(region),...toastRows.filter(row=>!row.pinned).map(card).filter(row=>row!==null)];
      const order=[...pinned,...stream],total=order.length;
      // Cards follow the stack's order in the page, moving only those out of place.
      let reference=nextStackCard(region.firstChild);
      for(const item of order){
        if(item===reference){reference=nextStackCard(item.nextSibling);continue;}
        region.insertBefore(item,reference);
      }
      const clamped=!stackExpanded&&order.some(cardClamped);
      if(stackExpanded&&total<2&&!order.some(cardClamped))setExpanded(false,{layout:false});
      region.dataset['stack']=stackExpanded?'expanded':'collapsed';
      const showPinned=Math.min(pinned.length,phoneLayout()?1:2);
      let hiddenCount=0,front:HTMLElement|null=null;
      const place=(item:HTMLElement,where:string,row:number)=>{
        if(item.dataset['stackPlace']!==where)item.dataset['stackPlace']=where;
        item.style.gridRow=row?String(row):'';
      };
      if(stackExpanded)for(const item of order)place(item,'open',0);
      else{
        pinned.forEach((item,index)=>{if(index<showPinned)place(item,'full',index+1);else{place(item,'hidden',0);hiddenCount++;}});
        const row=showPinned+1;
        stream.forEach((item,index)=>{
          if(index===0){front=item;place(item,'front',row);}
          else if(index<=PEEK_LIMIT){place(item,`behind-${index}`,row);hiddenCount++;}
          else{place(item,'hidden',0);hiddenCount++;}
        });
      }
      region.dataset['peek']=String(stackExpanded?0:Math.min(PEEK_LIMIT,Math.max(0,stream.length-1)));
      setStackHeight(region,front);watchFront(region,front);
      // The bar: "+N more" or Show less, and Clear all, once two cards show.
      const needBar=total>=2||stackExpanded||clamped&&total>0;
      if(needBar){
        ensureBar(region);
        const more=stackExpanded?'Show less':hiddenCount?`+${hiddenCount} more`:'Show all';
        if(moreButton!.textContent!==more)moreButton!.textContent=more;
        setHiddenFlag(moreButton!,!stackExpanded&&!hiddenCount&&!clamped);
        moreButton!.setAttribute('aria-expanded',stackExpanded?'true':'false');
        moreButton!.setAttribute('aria-label',stackExpanded?'Show fewer notifications':hiddenCount?`Show ${hiddenCount} more notification${hiddenCount===1?'':'s'}`:'Show notifications in full');
        setHiddenFlag(clearButton!,total<2);
        if(stackBar!.parentNode!==region||region.lastChild!==stackBar)region.appendChild(stackBar!);
        stackBar!.style.gridRow=stackExpanded?'':String(showPinned+(stream.length?2:1));
        setHiddenFlag(stackBar!,moreButton!.hidden&&clearButton!.hidden);
      }else if(stackBar?.parentNode)stackBar!.remove();
    }
    // Expanding stops every pop-up's clock; Escape, a click outside or Show
    // less folds the stack again.
    function setExpanded(value:boolean,{layout=true}={}){
      const region=toastRegion();value=!!value&&!!region;
      if(stackExpanded===value){if(layout)layoutStack();return;}
      stackExpanded=value;
      notifications.setPaused('expanded',value);
      if(value){
        if(!backdrop){
          backdrop=document.createElement('div');backdrop.className='sd-toast-backdrop';backdrop.setAttribute('aria-hidden','true');
          backdrop.addEventListener('click',()=>setExpanded(false));
        }
        region!.prepend(backdrop);
      }else{
        backdrop?.remove();
        region?.scrollTo(0,0);
      }
      if(layout)layoutStack();
      // Focus left inside a card that folded away moves to "+N more".
      const focused=document.activeElement;
      if(!value&&region&&focused&&region.contains(focused)&&focused.closest('[data-stack-place="hidden"],[data-stack-place^="behind"]'))moreButton?.focus({preventScroll:true});
    }
    function clearAll(){
      notifications.dismissAll();
      const region=toastRegion();
      if(region)for(const card of externalCards(region))card.querySelector<HTMLButtonElement>('[data-card-close]')?.click();
      setExpanded(false);
    }
    // Closing a card by hand: an app pop-up through the coordinator, the
    // Connect card through its own close button.
    function closeCard(card:HTMLElement){
      for(const [key,entry] of renderedToasts)if(entry.toast===card){if(entry.row.dismissible===false)return false;return notifications.dismissEvent(key,entry.row.deliveryId);}
      const close=card.querySelector<HTMLButtonElement>('[data-card-close]');if(close){close.click();return true;}
      return false;
    }
    function cardDismissible(card:HTMLElement){
      for(const entry of renderedToasts.values())if(entry.toast===card)return entry.row.dismissible!==false;
      return !!card.querySelector<HTMLButtonElement>('[data-card-close]');
    }
    function stackCardFrom(target:Element){
      const region=toastRegion(),card=target.closest<HTMLElement>('.interaction-toast,[data-toast-card]');
      return card&&card.parentNode===region&&isStackCard(card)?card:null;
    }
    // A card in full view whose button only opens something does the same
    // when clicked anywhere (docs/areas/notifications.md, stack); other cards, and
    // cards behind the front one, expand the stack.
    function openCard(card:HTMLElement){
      if(card.dataset['opens']!=='true')return false;
      // Selecting text in a card is not a click on it.
      const selection=window.getSelection?.();
      if(selection&&!selection.isCollapsed&&card.contains(selection.anchorNode))return true;
      card.querySelector<HTMLButtonElement>('.interaction-action')?.click();
      return true;
    }
    function onRegionClick(event:MouseEvent){
      const target=event.target as Element|null;if(!target||typeof target.closest!=='function')return;
      if(target.closest('button,a,input,select,textarea,label'))return;
      if(Date.now()-swipedAt<400)return;
      const card=stackCardFrom(target);
      if(stackExpanded){if(card)openCard(card);else if(event.target===toastRegion())setExpanded(false);return;}
      if(!card)return;
      if(['front','full'].includes(card.dataset['stackPlace']||'')&&openCard(card))return;
      const cards=[...toastRegion()!.children].filter(isStackCard);
      if(cards.length>1||cardClamped(card))setExpanded(true);
    }
    // A sideways swipe (touch or pen) closes a card; one that cannot be
    // closed springs back.
    let swipe:{card:HTMLElement;id:number;x:number;y:number;dx:number;active:boolean;dismissible:boolean}|null=null,swipedAt=0;
    function onPointerDown(event:PointerEvent){
      const target=event.target as Element|null;if(!target||typeof target.closest!=='function')return;
      if(!['touch','pen'].includes(event.pointerType)||target.closest('button,a,input'))return;
      const card=stackCardFrom(target);if(!card)return;
      swipe={card,id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,active:false,dismissible:cardDismissible(card)};
    }
    function onPointerMove(event:PointerEvent){
      if(!swipe||event.pointerId!==swipe.id)return;
      const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;
      if(!swipe.active){
        if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){swipe=null;return;}
        if(Math.abs(dx)<10)return;
        // Capture fails only if the pointer has already gone; the swipe still works.
        swipe.active=true;swipe.card.classList.add('swiping');try{swipe.card.setPointerCapture(event.pointerId);}catch{}
      }
      swipe.dx=swipe.dismissible?dx:dx/4;
      swipe.card.style.transform=`translateX(${swipe.dx}px)`;swipe.card.style.opacity=String(Math.max(.2,1-Math.abs(swipe.dx)/240));
    }
    function onPointerEnd(event:PointerEvent){
      if(!swipe||event.pointerId!==swipe.id)return;
      const {card,dx,active,dismissible}=swipe;swipe=null;
      if(!active)return;
      swipedAt=Date.now();card.classList.remove('swiping');
      if(dismissible&&Math.abs(dx)>=SWIPE_DISTANCE&&event.type!=='pointercancel'){
        card.style.transform=`translateX(${dx>0?'110%':'-110%'})`;card.style.opacity='0';
        if(!closeCard(card)){card.style.transform='';card.style.opacity='';}
        else if(card.dataset['toastCard']!==undefined)setTimeout(()=>{card.style.transform='';card.style.opacity='';},TOAST_REMOVE_FALLBACK_MS);
        return;
      }
      card.style.transform='';card.style.opacity='';
    }
    // The stack's own wiring, set up once the notification area is first used.
    function watchRegion(region:HTMLElement){
      if(watchingRegion===region)return;
      watchingRegion=region;
      region.addEventListener('click',onRegionClick);
      region.addEventListener('pointerdown',onPointerDown);
      region.addEventListener('pointermove',onPointerMove);
      for(const type of ['pointerup','pointercancel'] as const)region.addEventListener(type,onPointerEnd);
      document.addEventListener('keydown',event=>{if(event.key==='Escape'&&stackExpanded){event.preventDefault();event.stopPropagation();setExpanded(false);}},true);
      phoneQuery=window.matchMedia(PHONE_QUERY);phoneQuery.addEventListener('change',()=>layoutStack());
      // The Connect card shows and hides itself; the stack follows.
      new window.MutationObserver(()=>layoutStack()).observe(region,{attributes:true,attributeFilter:['hidden'],subtree:true});
    }
    function renderToasts(state:NotificationState){
      const region=toastRegion();if(!region)return;
      watchRegion(region);
      const wanted=new Map(state.toasts.map(row=>[row.key,row]));
      for(const [key,entry] of renderedToasts){
        const row=wanted.get(key);
        if(!row||row.deliveryId!==entry.deliveryId){renderedToasts.delete(key);removeToast(entry.toast);}
      }
      const added:ToastEntry[]=[];
      for(const row of state.toasts){
        let entry=renderedToasts.get(row.key);
        if(!entry){
          const toast=document.createElement('div'),copy=document.createElement('div'),title=document.createElement('strong'),message=document.createElement('div');
          toast.className='interaction-toast entering';toast.dataset['key']=row.id;toast.dataset['toastId']=row.deliveryId;
          copy.className='interaction-toast-copy';title.className='interaction-toast-title ui-label';message.className='interaction-toast-message ui-body';
          const close=button('×','interaction-toast-close');close.className='interaction-toast-close';close.setAttribute('aria-label','Dismiss notification');
          close.addEventListener('click',()=>notifications.dismissEvent(row.key,row.deliveryId));
          for(const [event,reason,paused] of [['mouseenter','hover',true],['mouseleave','hover',false],['focusin','focus',true],['focusout','focus',false]] as const){
            toast.addEventListener(event,eventValue=>{if(event==='focusout'&&toast.contains((eventValue as FocusEvent).relatedTarget as Node|null))return;notifications.pauseEvent(row.key,row.deliveryId,reason,paused);});
          }
          copy.append(title,message);toast.append(copy);if(row.dismissible!==false)toast.append(close);region.appendChild(toast);
          entry={toast,copy,title,message,row,deliveryId:row.deliveryId,action:null,actionSpec:null,secondary:null,secondarySpec:null};renderedToasts.set(row.key,entry);
          added.push(entry);
          requestAnimationFrame(()=>toast.classList.remove('entering'));
        }
        entry.row=row;
        const {toast,title,message,copy}=entry;
        for(const kind of ['error','warning','success','info'])toast.classList.toggle(kind,row.severity===kind);
        if(toast.dataset['tier']!==row.tier)toast.dataset['tier']=row.tier;
        toast.setAttribute('role',row.severity==='error'?'alert':'status');
        if(title.textContent!==row.title)title.textContent=row.title;
        if(message.textContent!==row.message)message.textContent=row.message;
        setHiddenFlag(message,!row.message);
        // A card's own button closes it, except critical cards and decisions
        // that close themselves once settled.
        const actionButton=(spec:NotificationAction)=>{const control=button(spec.label);control.addEventListener('click',()=>{
          const current=entry!.row;
          if(current.dismissible!==false&&current.tier!=='critical')notifications.dismissEvent(current.key,current.deliveryId,'acted');
          try{Promise.resolve(spec.run()).catch(error=>capture('notification.action',error));}catch(error){capture('notification.action',error);}
        });return control;};
        if(entry.actionSpec?.run!==row.action?.run||entry.actionSpec?.label!==row.action?.label||entry.secondarySpec?.run!==row.secondaryAction?.run||entry.secondarySpec?.label!==row.secondaryAction?.label){
          entry.action?.remove();entry.secondary?.remove();entry.action=entry.secondary=null;entry.actionSpec=row.action;entry.secondarySpec=row.secondaryAction||null;
          if(row.action){entry.action=actionButton(row.action);copy.appendChild(entry.action);}
          if(row.action&&row.secondaryAction){entry.secondary=actionButton(row.secondaryAction);copy.appendChild(entry.secondary);}
        }
        // One button that only opens something: the whole card opens it.
        const opens=row.action?.opens===true&&!row.secondaryAction?'true':'false';
        if(toast.dataset['opens']!==opens)toast.dataset['opens']=opens;
      }
      toastRows=state.toasts;
      layoutStack();
      // A card that arrives out of full view is read out once.
      for(const entry of added)if(['hidden','behind-1','behind-2'].includes(entry.toast.dataset['stackPlace']||''))announce([entry.row.title,entry.row.message].filter(Boolean).join('. '));
    }
    notifications.subscribe(renderToasts);
    if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',()=>notifications.setHidden(document.hidden));
    notifications.setHidden(document.hidden);
    function notify(rawOptions:NotificationRequest|string){
      if(!toastRegion())return '';
      return notifications.notify(cleanOptions(rawOptions));
    }
    function dismiss(){return active?settle(active.type==='confirm'?false:null):false;}
    function historyDescriptor(){return active?.historyDescriptor||null;}
    function reconcileHistory(desired:WorkspaceDescriptor|null){
      const current=historyDescriptor();
      if(current&&sameHistoryDescriptor(current,desired))return current;
      if(current)settle(active!.type==='confirm'?false:null,{fromHistory:true});
      return null;
    }
    return freeze({format:'study-director.interactions',contractVersion:1,confirm,input,choose,configure,notify,dismiss,historyDescriptor,reconcileHistory});
  }
  return freeze({format:'study-director.interactions-module',contractVersion:1,createController});
};
registry.define('interactions',1,createModule);return createModule;
})();
export type InteractionsModule=ReturnType<typeof sdInteractionsFactory>;
