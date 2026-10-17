(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
registry.define('interactions',1,()=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    environment:freeze(['clearTimeout','document','nativeConfirm','nativePrompt','requestAnimationFrame','setTimeout','window']),
    diagnostics:freeze(['capture']),
    history:freeze(['closed','opened','requestClose']),
    notifications:freeze(['dismissEvent','notify','pauseEvent','setHidden','subscribe'])
  });
  // Correctness fallback only. Normal removal follows transition completion;
  // this intentionally does not mirror any presentation duration token.
  const TOAST_REMOVE_FALLBACK_MS=1000;
  function exactObject(value,keys,label){
    const actual=value&&typeof value==='object'?Object.keys(value).sort():[];
    const expected=[...keys].sort();
    if(!value||!Object.isFrozen(value)||actual.join('|')!==expected.join('|')){
      throw new TypeError(`${label} is incomplete, mutable, or contains unexpected fields (frozen=${!!value&&Object.isFrozen(value)}; actual=${actual.join(',')||'none'}; expected=${expected.join(',')}).`);
    }
    return value;
  }
  function functions(value,keys,label){
    exactObject(value,keys,label);
    if(keys.some(key=>typeof value[key]!=='function'))throw new TypeError(label+' must contain functions only.');
  }
  function createController(controllerInput){
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
    let active=null;
    const queue=[];
    let historySequence=0;

    function cleanText(value,max=2000){
      const text=String(value??'').trim();
      return text.length>max?text.slice(0,max):text;
    }
    function cleanOptions(options){return options&&typeof options==='object'?options:{message:String(options||'')};}
    function dialogElement(){return document.getElementById('sd-interaction-dialog');}
    function toastRegion(){return document.getElementById('sd-toast-region');}
    function supportsDialog(dialog){return !!(dialog&&typeof dialog.showModal==='function'&&typeof dialog.close==='function');}
    function fallbackMessage(options){
      const title=cleanText(options.title,160),message=cleanText(options.message),details=Array.isArray(options.details)?options.details.map(item=>cleanText(item,500)).filter(Boolean):[];
      return [title,message,...details].filter(Boolean).join('\n\n');
    }
    function fallback(type,options){
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
          const choices=Array.isArray(options.choices)?options.choices:[];
          const labels=choices.map((choice,index)=>`${index+1}. ${cleanText(choice.label,100)}`).join('\n');
          const result=nativePrompt(`${message}\n\n${labels}`,choices.length?'1':'');
          const index=Math.floor(Number(result))-1;
          return Promise.resolve(index>=0&&index<choices.length?String(choices[index].value):null);
        }
        if(type==='configure'){
          if(!nativeConfirm(message))return Promise.resolve(null);
          const rows=(Array.isArray(options.groups)?options.groups:[]).map(group=>{
            const id=String(group&&group.id||''),choices=Array.isArray(group&&group.choices)?group.choices.filter(choice=>choice&&choice.value!==undefined&&choice.label):[];
            return id&&choices.length?{group,id,choices,values:new Set(choices.map(choice=>String(choice.value)))}:null;
          }).filter(Boolean),byId=new Map(rows.map(row=>[row.id,row])),values={};
          const applyValues=choice=>{
            const targets=choice&&choice.applyValues&&!Array.isArray(choice.applyValues)&&typeof choice.applyValues==='object'?choice.applyValues:null;if(!targets)return;
            for(const [targetId,targetValue] of Object.entries(targets)){const row=byId.get(String(targetId)),clean=String(targetValue);if(row&&row.values.has(clean))values[row.id]=clean;}
          };
          for(const row of rows){
            const {group,id,choices}=row,current=values[id]??String(group.defaultValue??choices[0].value),selected=Math.max(0,choices.findIndex(choice=>String(choice.value)===current));
            const labels=choices.map((choice,index)=>`${index+1}. ${cleanText(choice.label,100)}`).join('\n');
            const result=nativePrompt(`${message}\n\n${cleanText(group.label||'Choose an option',120)}\n${labels}`,String(selected+1));
            if(result===null)return Promise.resolve(null);
            const index=Math.floor(Number(result))-1;
            if(index<0||index>=choices.length)return Promise.resolve(null);
            const choice=choices[index];values[id]=String(choice.value);applyValues(choice);
          }
          for(const checkbox of Array.isArray(options.checkboxes)?options.checkboxes:[]){
            const id=String(checkbox&&checkbox.id||''),label=cleanText(checkbox&&checkbox.label,180);if(!id||!label)continue;
            const detail=cleanText(checkbox&&checkbox.description,300),prompt=[label,detail,'OK = checked · Cancel = unchecked'].filter(Boolean).join('\n');
            values[id]=!!nativeConfirm(prompt);
          }
          return Promise.resolve(freeze(values));
        }
      }catch(error){capture('interaction.fallback',error);}
      return Promise.resolve(type==='confirm'?false:null);
    }
    function button(label,className=''){
      const element=document.createElement('button');
      element.type='button';element.className='interaction-action ui-btn '+className;element.textContent=cleanText(label,100);
      return element;
    }
    function appendCopy(body,options){
      if(options.message){const message=document.createElement('p');message.className='interaction-message ui-body';message.textContent=cleanText(options.message);body.appendChild(message);}
      const details=Array.isArray(options.details)?options.details.map(item=>cleanText(item,500)).filter(Boolean):[];
      if(details.length){
        const list=document.createElement('ul');list.className='interaction-details ui-body';
        details.forEach(item=>{const row=document.createElement('li');row.textContent=item;list.appendChild(row);});
        body.appendChild(list);
      }
    }
    function sameHistoryDescriptor(a,b){return !!a&&!!b&&a.kind===b.kind&&a.token===b.token;}
    function completeSettlement(current,value){
      if(active!==current)return false;
      active=null;
      current.resolve(value);
      requestAnimationFrame(pump);
      return true;
    }
    function settle(value,meta={}){
      const current=active;if(!current)return false;
      const fromHistory=meta.fromHistory===true;
      if(current.historyPending){
        if(!fromHistory)return false;
        return completeSettlement(current,current.settlementValue);
      }
      const descriptor=current.historyDescriptor||null;
      const historyPending=!!(descriptor&&!fromHistory&&historyPort.requestClose(descriptor));
      try{current.dialog.close();}catch(error){current.dialog.removeAttribute('open');}
      current.dialog.querySelectorAll('input[type="password"]').forEach(field=>{field.value='';});
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
    function renderRequest(request){
      const dialog=dialogElement(),options=request.options;
      if(!supportsDialog(dialog)){fallback(request.type,options).then(request.resolve);requestAnimationFrame(pump);return;}
      const shell=document.createElement('div');shell.className='interaction-shell';
      const header=document.createElement('div');header.className='interaction-header';
      const eyebrow=document.createElement('div');eyebrow.className='interaction-eyebrow ui-label';eyebrow.textContent=cleanText(options.eyebrow||'Study Director',80);
      const title=document.createElement('h2');title.className='interaction-title ui-title';title.id='sd-interaction-title';title.textContent=cleanText(options.title||'Confirm action',160);
      header.append(eyebrow,title);shell.appendChild(header);
      const body=document.createElement('div');body.className='interaction-body';appendCopy(body,options);shell.appendChild(body);
      const error=document.createElement('div');error.className='interaction-error ui-status';error.id='sd-interaction-error';error.setAttribute('role','alert');error.hidden=true;
      let inputElement=null,inputCheckbox=null,confirmationElement=null,selectedOption=String(options.defaultOption||''),configuredValues=null;
      // One tick-box row with its description, for input's tick box and configure's list.
      const checkboxRow=(checkbox,label,onChange=null)=>{
        const row=document.createElement('label');row.className='interaction-checkbox-row ui-body';
        const box=document.createElement('input');box.type='checkbox';box.className='interaction-checkbox';box.checked=checkbox.defaultChecked===true;
        const copy=document.createElement('span');copy.className='interaction-checkbox-copy';
        const title=document.createElement('strong');title.textContent=label;copy.appendChild(title);
        if(checkbox.description){const description=document.createElement('span');description.textContent=cleanText(checkbox.description,300);copy.appendChild(description);}
        if(onChange)box.addEventListener('change',()=>onChange(box.checked));
        row.append(box,copy);return Object.freeze({row,box});
      };
      if(request.type==='input'){
        const optionRows=Array.isArray(options.options)?options.options.filter(option=>option&&option.value!==undefined&&option.label):[];
        if(optionRows.length){
          const group=document.createElement('div');group.className='interaction-options';group.setAttribute('role','radiogroup');group.setAttribute('aria-label',cleanText(options.optionLabel||'Location',100));
          optionRows.forEach((option,index)=>{
            const choice=document.createElement('button');choice.type='button';choice.className='interaction-option ui-btn';choice.dataset.value=String(option.value);choice.setAttribute('role','radio');
            const activeChoice=selectedOption?selectedOption===String(option.value):index===0;
            if(activeChoice)selectedOption=String(option.value);
            choice.setAttribute('aria-checked',activeChoice?'true':'false');choice.classList.toggle('selected',activeChoice);
            const label=document.createElement('strong');label.textContent=cleanText(option.label,100);choice.appendChild(label);
            if(option.description){const description=document.createElement('span');description.textContent=cleanText(option.description,240);choice.appendChild(description);}
            choice.addEventListener('click',()=>{
              selectedOption=String(option.value);
              group.querySelectorAll('.interaction-option').forEach(item=>{const selected=item===choice;item.classList.toggle('selected',selected);item.setAttribute('aria-checked',selected?'true':'false');});
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
        if(options.inputType==='password'){inputElement.spellcheck=false;inputElement.autocomplete=options.confirmPassword?'new-password':'current-password';if(options.confirmPassword){const confirm=document.createElement('label');confirm.className='interaction-field ui-body';confirm.textContent='Confirm password';confirmationElement=inputElement.cloneNode();confirmationElement.value='';confirm.appendChild(confirmationElement);body.appendChild(confirm);}}
        if(options.hint){const hint=document.createElement('div');hint.className='interaction-hint ui-helper';hint.textContent=cleanText(options.hint,500);body.appendChild(hint);}
        // One optional tick box; when shown, the result carries `checked`.
        if(options.checkbox&&options.checkbox.label){
          const checks=document.createElement('div'),made=checkboxRow(options.checkbox,cleanText(options.checkbox.label,180));checks.className='interaction-checks';
          inputCheckbox=made.box;checks.appendChild(made.row);body.appendChild(checks);
        }
        if(typeof options.preview==='function'){
          const preview=document.createElement('div');preview.className='interaction-preview ui-mono';preview.textContent=cleanText(options.preview(inputElement.value,selectedOption),300);body.appendChild(preview);
          inputElement.addEventListener('input',()=>{preview.textContent=cleanText(options.preview(inputElement.value,selectedOption),300);error.hidden=true;});
        }else inputElement.addEventListener('input',()=>{error.hidden=true;});
      }
      if(request.type==='choose'){
        const choices=document.createElement('div');choices.className='interaction-choices';
        (Array.isArray(options.choices)?options.choices:[]).forEach(choice=>{
          const action=button(choice.label,['danger','caution','primary'].includes(choice.kind)?choice.kind:'');
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
        const groupRows=(Array.isArray(options.groups)?options.groups:[]).map(group=>{
          const id=String(group&&group.id||''),choices=Array.isArray(group&&group.choices)?group.choices.filter(option=>option&&option.value!==undefined&&option.label):[];
          if(!id||!choices.length)return null;
          return {group,id,choices,values:new Set(choices.map(option=>String(option.value)))};
        }).filter(Boolean),groupById=new Map(groupRows.map(row=>[row.id,row])),hosts=new Map();
        for(const row of groupRows){
          const configuredDefault=String(row.group.defaultValue??row.choices[0].value);
          configuredValues[row.id]=row.values.has(configuredDefault)?configuredDefault:String(row.choices[0].value);
        }
        const applyValue=(id,value)=>{
          const row=groupById.get(String(id)),clean=String(value);if(!row||!row.values.has(clean))return false;
          configuredValues[row.id]=clean;
          const host=hosts.get(row.id);if(host)host.querySelectorAll('.interaction-option').forEach(item=>{const selected=item.dataset.value===clean;item.classList.toggle('selected',selected);item.setAttribute('aria-checked',selected?'true':'false');});
          return true;
        };
        const applyConfiguredValues=option=>{
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
            const choice=document.createElement('button');choice.type='button';choice.className='interaction-option ui-btn';choice.dataset.value=String(option.value);choice.setAttribute('role','radio');
            const selected=configuredValues[id]===String(option.value);
            choice.setAttribute('aria-checked',selected?'true':'false');choice.classList.toggle('selected',selected);
            const label=document.createElement('strong');label.textContent=cleanText(option.label,100);choice.appendChild(label);
            if(option.description){const description=document.createElement('span');description.textContent=cleanText(option.description,300);choice.appendChild(description);}
            choice.addEventListener('click',()=>{applyValue(id,option.value);applyConfiguredValues(option);});
            optionsHost.appendChild(choice);
          });
          fieldset.appendChild(optionsHost);form.appendChild(fieldset);
        });
        const checkboxRows=(Array.isArray(options.checkboxes)?options.checkboxes:[]).map(checkbox=>{
          const id=String(checkbox&&checkbox.id||''),label=cleanText(checkbox&&checkbox.label,180);return id&&label?{checkbox,id,label}:null;
        }).filter(Boolean);
        if(checkboxRows.length){
          const checks=document.createElement('div');checks.className='interaction-checks';
          for(const {checkbox,id,label} of checkboxRows){
            const made=checkboxRow(checkbox,label,checked=>{configuredValues[id]=checked;});
            configuredValues[id]=made.box.checked;checks.appendChild(made.row);
          }
          form.appendChild(checks);
        }
        body.appendChild(form);
      }
      body.appendChild(error);
      const actions=document.createElement('div');actions.className='interaction-actions';
      const cancel=button(options.cancelLabel||'Cancel','ghost');cancel.dataset.interactionCancel='true';cancel.addEventListener('click',()=>settle(request.type==='confirm'?false:null));
      actions.appendChild(cancel);
      let primary=null;
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
      dialog.oncancel=event=>{event.preventDefault();settle(request.type==='confirm'?false:null);};
      const historyDescriptor=freeze({kind:'prompt',token:`prompt:${historyNonce}:${++historySequence}`});
      active={...request,dialog,historyDescriptor,restoreFocus:document.activeElement&&typeof document.activeElement.focus==='function'?document.activeElement:null};
      try{dialog.showModal();}
      catch(error){active=null;dialog.replaceChildren();capture('interaction.show-modal',error);fallback(request.type,options).then(request.resolve);requestAnimationFrame(pump);return;}
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
      renderRequest(queue.shift());
    }
    function enqueue(type,rawOptions){
      const options=cleanOptions(rawOptions);
      if(options.signal?.aborted)return Promise.resolve(null);
      let request;const abort=()=>{if(active?.resolve===request.resolve)settle(null);else{const index=queue.indexOf(request);if(index>=0){queue.splice(index,1);request.resolve(null);}}};
      return new Promise(resolve=>{request={type,options,resolve};options.signal?.addEventListener('abort',abort,{once:true});queue.push(request);pump();}).finally(()=>options.signal?.removeEventListener('abort',abort));
    }
    function confirm(options){return enqueue('confirm',options);}
    function input(options){return enqueue('input',options);}
    function choose(options){return enqueue('choose',options);}
    async function configure(options){
      options=cleanOptions(options);
      const identities=new Set();
      for(const item of [...(options.groups||[]),...(options.checkboxes||[])]){
        const id=item&&item.id;
        if(typeof id!=='string'||!id||id.length>80||id.trim()!==id||['__proto__','constructor','prototype'].includes(id)||identities.has(id))throw new TypeError('Configuration controls require unique, unchanged identifiers of at most 80 characters.');
        identities.add(id);
        if(Array.isArray(item.choices)){
          const choices=item.choices.map(choice=>String(choice.value));
          if(new Set(choices).size!==choices.length)throw new TypeError('Configuration choices require unique identifiers.');
        }
      }
      return enqueue('configure',options);
    }
    function removeToast(toast){
      if(!toast||!toast.parentNode)return false;
      if(toast.classList.contains('leaving'))return false;
      toast.classList.add('leaving');
      let timer=0,done=false;
      const finish=()=>{
        if(done)return;done=true;
        toast.removeEventListener('transitionend',onEnd);
        if(timer)clearTimeout(timer);
        toast.remove();
      };
      const onEnd=event=>{if(event.target===toast&&(event.propertyName==='opacity'||event.propertyName==='transform'))finish();};
      toast.addEventListener('transitionend',onEnd);
      timer=setTimeout(finish,TOAST_REMOVE_FALLBACK_MS);
      return true;
    }
    const renderedToasts=new Map();
    function renderToasts(state){
      const region=toastRegion();if(!region)return;
      const wanted=new Map(state.toasts.map(row=>[row.key,row]));
      for(const [key,entry] of renderedToasts){
        const row=wanted.get(key);
        if(!row||row.deliveryId!==entry.deliveryId){renderedToasts.delete(key);removeToast(entry.toast);}
      }
      for(const row of state.toasts){
        let entry=renderedToasts.get(row.key);
        if(!entry){
          const toast=document.createElement('div'),copy=document.createElement('div'),title=document.createElement('strong'),message=document.createElement('div');
          toast.className='interaction-toast entering';toast.dataset.key=row.id;toast.dataset.toastId=row.deliveryId;
          copy.className='interaction-toast-copy';title.className='interaction-toast-title ui-label';message.className='interaction-toast-message ui-body';
          const close=button('×','interaction-toast-close');close.className='interaction-toast-close';close.setAttribute('aria-label','Dismiss notification');
          close.addEventListener('click',()=>notifications.dismissEvent(row.key,row.deliveryId));
          for(const [event,reason,paused] of [['mouseenter','hover',true],['mouseleave','hover',false],['focusin','focus',true],['focusout','focus',false]]){
            toast.addEventListener(event,eventValue=>{if(event==='focusout'&&toast.contains(eventValue.relatedTarget))return;notifications.pauseEvent(row.key,row.deliveryId,reason,paused);});
          }
          copy.append(title,message);toast.append(copy);if(row.dismissible!==false)toast.append(close);region.appendChild(toast);
          entry={toast,copy,title,message,deliveryId:row.deliveryId,action:null,actionSpec:null,secondary:null,secondarySpec:null};renderedToasts.set(row.key,entry);
          requestAnimationFrame(()=>toast.classList.remove('entering'));
        }
        const {toast,title,message,copy}=entry;
        for(const kind of ['error','warning','success','info'])toast.classList.toggle(kind,row.severity===kind);
        toast.setAttribute('role',row.severity==='error'?'alert':'status');
        if(title.textContent!==row.title)title.textContent=row.title;
        if(message.textContent!==row.message)message.textContent=row.message;
        message.hidden=!row.message;
        const actionButton=spec=>{const control=button(spec.label);control.addEventListener('click',()=>{try{Promise.resolve(spec.run()).catch(error=>capture('notification.action',error));}catch(error){capture('notification.action',error);}});return control;};
        if(entry.actionSpec?.run!==row.action?.run||entry.actionSpec?.label!==row.action?.label||entry.secondarySpec?.run!==row.secondaryAction?.run||entry.secondarySpec?.label!==row.secondaryAction?.label){
          entry.action?.remove();entry.secondary?.remove();entry.action=entry.secondary=null;entry.actionSpec=row.action;entry.secondarySpec=row.secondaryAction||null;
          if(row.action){entry.action=actionButton(row.action);copy.appendChild(entry.action);}
          if(row.action&&row.secondaryAction){entry.secondary=actionButton(row.secondaryAction);copy.appendChild(entry.secondary);}
        }
      }
    }
    notifications.subscribe(renderToasts);
    if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',()=>notifications.setHidden(document.hidden));
    notifications.setHidden(document.hidden);
    function notify(rawOptions){
      if(!toastRegion())return '';
      return notifications.notify(cleanOptions(rawOptions));
    }
    function dismiss(){return active?settle(active.type==='confirm'?false:null):false;}
    function historyDescriptor(){return active?.historyDescriptor||null;}
    function reconcileHistory(desired){
      const current=historyDescriptor();
      if(current&&sameHistoryDescriptor(current,desired))return current;
      if(current)settle(active.type==='confirm'?false:null,{fromHistory:true});
      return null;
    }
    return freeze({format:'study-director.interactions',contractVersion:1,confirm,input,choose,configure,notify,dismiss,historyDescriptor,reconcileHistory});
  }
  return freeze({format:'study-director.interactions-module',contractVersion:1,createController});
});
})();
