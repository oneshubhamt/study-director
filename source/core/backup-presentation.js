(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1)throw new Error('Study Director internal module registry is unavailable or incompatible.');
registry.define('backup-presentation',1,()=>{
  const freeze=Object.freeze;
  const bytes=value=>{const amount=Math.max(0,Number(value)||0);return amount<1048576?`${Math.round(amount/1024)} KB`:`${(amount/1048576).toFixed(1)} MB`;};
  function detail(value){
    const p=value?.progress||value||{},parts=[];
    if(p.total>0)parts.push(`${Math.min(p.current||0,p.total)} of ${p.total} complete`);
    if(p.totalBytes>0)parts.push(`${bytes(p.completedBytes)} of ${bytes(p.totalBytes)}`);
    else if(p.activeBytes>0)parts.push(`${bytes(p.loadedBytes)} of ${bytes(p.activeBytes)} in current item`);
    return parts.join(' · ');
  }
  // The three ways a verified backup can be applied, worded once for every
  // backup location. Adding only what is missing leaves everything current as
  // it is and stops, unchanged, at anything that would need a choice.
  const RESTORE_CHOICES=freeze({
    missing:freeze({value:'missing',label:'Add only what’s missing',description:'Bring back Saved Days and attachments this device doesn’t have. Nothing you have now changes.'}),
    combine:freeze({value:'combine',label:'Combine with current data',description:'Keep current data and review genuine differences before applying them.'}),
    replace:freeze({value:'replace',label:'Replace current data',kind:'danger',description:'Make this backup authoritative. Current portable data not in this backup will be removed.'}),
    needsDecision:'Some data differs from this backup and needs your choice, so nothing was changed. Use Combine to review the differences.'
  });
  function outcome(kind,label,convergence){
    const message=kind==='restore-version'?'Backup restored locally and verified.':'Backup combined locally and verified.',external=convergence?.source||convergence,parts=[message];
    const append=(name,state)=>{if(state?.status==='pending')parts.push(`${name} backup update is pending.`);else if(state?.status==='completed')parts.push(`${name} backup state is verified.`);else if(state?.status==='failed')parts.push(`${name} backup status needs attention.`);};
    append(label,external);if(convergence?.device)append('Device Folder',convergence.device);return parts.join(' ');
  }
  function createPresentation(input){
    if(!input||!Object.isFrozen(input)||!input.notifications||typeof input.notifications.readEvent!=='function')throw new TypeError('Backup presentation requires the notification coordinator.');
    const notifications=input.notifications,actions=new Map();
    const action=(source,kind)=>{const key=JSON.stringify([source,kind]);if(!actions.has(key))actions.set(key,typeof input.action==='function'?input.action(source,kind):null);return actions.get(key);};
    const read=(source,id='backup-operation')=>notifications.readEvent(source,id);
    function locationLabel(source,state={}){
      if(state.busy)return state.stalled?'Still working…':({history:'Reading backups…','restore-version':'Restoring…','bring-in':'Combining…','remove-safety':'Removing safety backup…'}[state.foregroundKind]||'Backing up…');
      if(state.maintenanceBusy)return 'Maintaining backups…';
      if(state.mode==='unsupported')return 'Unavailable';
      if(state.mode==='permission')return 'Permission needed';
      if(state.mode==='error')return 'Needs attention';
      if(!state.connected)return state.wasConnected?'Signed out':'Off';
      const saved=typeof input.verified==='function'?input.verified(source):null;
      const at=state.lastBackupAt||read(source,'backup-verified')?.completedAt||saved?.verifiedAt;
      const when=at&&Number.isFinite(Date.parse(at))?(typeof input.timeLabel==='function'?input.timeLabel(at):new Date(at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false})):'';
      return `On${when?' · Last verified '+when:''}`;
    }
    function summary(event){
      if(!event)return '';
      const message=String(event.message||'');
      const success=message&&event.lifecycle==='succeeded'&&event.severity==='success';
      return [(success&&!message.startsWith('✓')?'✓ ':'')+message,detail(event)].filter(Boolean).join(' · ');
    }

    function begin(source,kind,options={}){
      notifications.resolveEvent(source,'backup-status');
      const handle=notifications.begin({source,id:'backup-operation',kind,foreground:options.foreground!==false,surface:'inline',title:options.label||source,message:options.message||'Preparing…',action:action(source,kind),...options});
      const current=handle.read;
      const update=patch=>handle.update({...patch,progress:patch.progress===undefined?current()?.progress:patch.progress});
      const finish=(patch={})=>{
        const event=current();if(!event||event.lifecycle!=='running')return false;
        const lifecycle=patch.lifecycle||'succeeded',condition=notifications.eventStatus().events.some(row=>row.source===source&&['permission','retry-exhausted'].includes(row.id));
        const result=handle.update({progress:null,...patch,lifecycle,severity:patch.severity||(lifecycle==='failed'?'error':lifecycle==='succeeded'?'success':'info'),announce:options.foreground!==false&&kind!=='history'&&lifecycle!=='cancelled'&&!(lifecycle==='failed'&&condition),surface:'inline'});
        if(result&&kind==='backup'&&lifecycle==='succeeded')notifications.emit({source,id:'backup-verified',severity:'success',lifecycle:'succeeded',foreground:false,surface:'quiet',message:`External backup verified in ${options.label||source}.`,outcome:'external-backup-verified',completedAt:new Date().toISOString()});
        return result;
      };
      return freeze({operationId:handle.operationId,read:current,update,finish,resolve:handle.resolve});
    }
    function feedback(source,message,ok=true){if(!message)return notifications.resolveEvent(source,'backup-status');return notifications.emit({source,id:'backup-status',message,severity:ok?'info':'error',lifecycle:ok?'succeeded':'failed',surface:'inline',title:source,action:action(source,'status')});}
    function condition(source,id,message){if(!message)return notifications.resolveEvent(source,id);return notifications.emit({source,id,message,severity:'warning',lifecycle:'failed',foreground:false,title:source==='file'?'File backup':source==='device-folder'?'Device Folder backup':'Google Drive backup',action:action(source,id),surface:'toast',persistent:true});}
    // A one-off heads-up (a sign-in that ended, repeated failures): a toast
    // that closes on its own or when dismissed. Repeating the same notice
    // does not show it again until it is resolved.
    function notice(source,id,message){return notifications.emit({source,id,message,severity:'warning',lifecycle:'succeeded',foreground:false,title:source==='device-folder'?'Device Folder backup':'Google Drive backup',action:action(source,id),surface:'toast',duration:12000});}
    function reset(source){for(const event of notifications.eventStatus().events)if(event.source===source)notifications.resolveEvent(source,event.id);}
    return freeze({begin,read,feedback,condition,notice,bytes,detail,outcome,locationLabel,summary,restoreChoices:RESTORE_CHOICES,resolve:(source,id='backup-operation')=>notifications.resolveEvent(source,id),reset,subscribe:notifications.subscribe});
  }
  return freeze({format:'study-director.backup-presentation-module',contractVersion:1,createPresentation});
});
})();
