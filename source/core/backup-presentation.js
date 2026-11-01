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
  // it is and stops, unchanged, at anything that would need a choice. While
  // Google Drive is signed in, what a restore changes reaches every device
  // (reach): the next sync uploads it and the other devices take it in.
  const RESTORE_CHOICES=freeze({
    missing:freeze({value:'missing',label:'Add only what’s missing',description:'Bring back Saved Days and attachments this device doesn’t have. Nothing you have now changes.'}),
    combine:freeze({value:'combine',label:'Combine with current data',kind:'primary',description:'Add what’s new. Notes, plans and settings changed on one side only since your last sync are taken for you; you choose the rest. Nothing is deleted unless it was deleted on purpose.'}),
    replace:freeze({value:'replace',label:'Replace current data',kind:'caution',description:'Make your data match this backup. You choose whether to keep what isn’t in it; notes it deleted go to Recently deleted.'}),
    needsDecision:'Some data differs from this backup and needs your choice, so nothing was changed. Use Combine to review the differences.',
    reach:'Google Drive is connected, so your other devices get the result at their next sync.'
  });
  // detail, when given, says what the restore or combine changed. A shared
  // location (Drive) carries the result to the other devices; every other
  // location says whether it already holds it or backs it up next.
  function outcome(kind,label,convergence,detail=''){
    const message=String(detail||'')||(kind==='restore-version'?'Backup restored locally and verified.':'Backup combined locally and verified.'),external=convergence?.source||convergence,parts=[message];let reach=false;
    const append=(name,state)=>{
      if(state?.status==='failed'){parts.push(`${name} backup needs attention.`);return;}
      if(state?.shared===true){if(['pending','completed'].includes(state?.status))reach=true;return;}
      if(state?.status==='pending')parts.push(`${name} backs it up next.`);else if(state?.status==='completed')parts.push(`${name} already holds it.`);
    };
    append(label,external);for(const other of convergence?.others||[])append(other.label,other);
    if(reach)parts.push('Your other devices get it at their next sync.');
    return parts.join(' ');
  }
  function createPresentation(input){
    if(!input||!Object.isFrozen(input)||!input.notifications||typeof input.notifications.readEvent!=='function')throw new TypeError('Backup presentation requires the notification coordinator.');
    const notifications=input.notifications,actions=new Map();
    const action=(source,kind)=>{const key=JSON.stringify([source,kind]);if(!actions.has(key))actions.set(key,typeof input.action==='function'?input.action(source,kind):null);return actions.get(key);};
    const read=(source,id='backup-operation')=>notifications.readEvent(source,id);
    function locationLabel(source,state={}){
      if(state.busy)return state.stalled?'Still working…':({prepare:'Preparing the backup folder…',history:'Reading backups…','restore-version':'Restoring…','bring-in':'Combining…','remove-version':'Removing version…'}[state.foregroundKind]||'Backing up…');
      if(state.backingUp)return state.sync?'Syncing…':'Backing up…';
      if(state.maintenanceBusy)return 'Maintaining backups…';
      if(state.mode==='unsupported')return 'Unavailable';
      if(state.mode==='permission')return 'Permission needed';
      if(state.mode==='error')return 'Needs attention';
      if(!state.connected)return state.wasConnected?'Signed out':'Off';
      // With backup encryption on, automatic backups wait for the password each launch.
      if(state.locked)return 'Needs password';
      const synced=syncLabel(state);if(synced)return synced;
      const saved=typeof input.verified==='function'?input.verified(source):null;
      const when=timeText(state.lastBackupAt||read(source,'backup-verified')?.completedAt||saved?.at);
      return `On${when?' · Last backup '+when:''}`;
    }
    function timeText(at){return at&&Number.isFinite(Date.parse(at))?(typeof input.timeLabel==='function'?input.timeLabel(at):new Date(at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false})):'';}
    // A shared location (Drive) says how this device stands with it: Syncing…,
    // Needs password (set or changed on another device), Needs review,
    // Synced 10:42, or Changes since 10:42 while this device has changes it
    // has not uploaded yet. '' before the first sync.
    function syncLabel(state={}){
      const sync=state.sync;if(!sync||!state.connected||state.locked)return '';
      if(sync.syncing||state.backingUp)return 'Syncing…';
      if(sync.password)return 'Needs password';
      if(sync.review)return 'Needs review';
      if(sync.newer)return 'Needs app update';
      // After a sync that failed, the last time it was in step (it keeps trying).
      return sync.syncedAt?`${sync.failed?'Last synced':state.waiting?'Changes since':'Synced'} ${timeText(sync.syncedAt)}`:'';
    }
    // What a location's row shows: its running operation, otherwise the newest
    // of its last operation, automatic backup or status message.
    function current(source){
      const rows=['backup-operation','external-backup','backup-status'].map(id=>read(source,id)).filter(Boolean);
      return rows.find(row=>row.id==='backup-operation'&&row.lifecycle==='running')||rows.sort((a,b)=>Number(b.deliveryId||0)-Number(a.deliveryId||0))[0]||null;
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
        if(result&&kind==='backup'&&lifecycle==='succeeded')notifications.emit({source,id:'backup-verified',severity:'success',lifecycle:'succeeded',foreground:false,surface:'quiet',message:`Backed up to ${options.label||source}.`,outcome:'external-backup-verified',completedAt:new Date().toISOString()});
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
    // The reach line for a restore or combine dialog, while Drive syncs.
    function reach(){try{return typeof input.synced==='function'&&input.synced()===true?RESTORE_CHOICES.reach:'';}catch{return '';}}
    function reset(source){for(const event of notifications.eventStatus().events)if(event.source===source)notifications.resolveEvent(source,event.id);}
    // The profile indicator on every screen size: a ring for sync health and a
    // badge for the most important thing that needs the person, plus the text
    // and actions for the profile panel. The host gathers the inputs; this only
    // decides. States and priorities: docs/STATUS-SYSTEM.md.
    function status(value={}){
      const drive=value&&value.drive||null,sync=drive&&drive.sync||{},device=value&&value.device||null;
      const online=value.online!==false,connecting=!!drive&&drive.connecting===true;
      const connected=!!drive&&drive.connected===true,setUp=connected||!!drive&&drive.setUp===true;
      const lockHere=value.passwordNeeded===true||connected&&drive.locked===true,syncPassword=connected&&sync.password===true;
      const newer=value.newerData===true||connected&&sync.newer===true;
      const driveBusy=connected&&(drive.busy===true||drive.backingUp===true||sync.syncing===true);
      const turn=connected&&Number(sync.turnWaits)>0;
      const deviceOn=!!device&&device.connected===true,deviceBusy=!!device&&(device.busy===true||device.backingUp===true);
      const failed=connected&&sync.failed===true,waiting=connected&&drive.waiting===true,review=connected&&sync.review===true;
      const kept=Math.max(0,Math.floor(Number(value.kept)||0)),storage=Array.isArray(value.storage)?value.storage:[];
      let ring='off';
      if(connecting&&online)ring='syncing';
      else if(setUp){
        if(!online)ring='offline';
        else if(!connected)ring='signed-out';
        else if(lockHere||syncPassword||newer)ring='blocked';
        else if(driveBusy||turn||deviceBusy)ring='syncing';
        else if(failed&&drive.retryBackoffCapped===true)ring='error';
        else if(waiting||failed||review||!sync.syncedAt)ring='pending';
        else ring='synced';
      }else if(deviceBusy)ring='syncing';
      const slow=ring==='syncing'&&turn&&!connecting&&!driveBusy&&!deviceBusy;
      const syncedAt=connected||setUp?timeText(sync.syncedAt):'';
      function activity(){
        if(connecting)return 'Connecting Google Drive…';
        if(connected&&drive.busy===true){
          if(drive.stalled===true)return 'Still working · Google Drive is slow to respond…';
          return ({history:'Reading backup versions…','restore-version':'Restoring a version…','bring-in':'Combining with a backup…','remove-version':'Removing a version…',prepare:'Preparing Google Drive…',backup:'Backing up to Google Drive…'})[String(drive.foregroundKind||'')]||'Syncing…';
        }
        if(connected&&sync.syncing===true)return 'Syncing · bringing in changes…';
        if(connected&&drive.backingUp===true)return 'Syncing · uploading changes…';
        if(deviceBusy)return device.foregroundKind==='connect'?'Connecting the Device Folder…':['history','restore-version','bring-in','remove-version'].includes(String(device.foregroundKind||''))?'Working in the Device Folder…':'Backing up to the Device Folder…';
        if(turn)return 'Waiting for another device to finish saving…';
        return 'Syncing…';
      }
      const items=[],add=(id,tone,short,text,action='',actionLabel='')=>items.push(freeze({id,tone,short,text,action,actionLabel}));
      if(ring==='error')add('sync-stopped','error','Sync stopped','Google Drive did not accept this device’s sync. Everything is still saved here; try again now or see Library → Data.','retry','Try again');
      if(setUp&&!connected&&!connecting)add('signed-out','warning','Google Drive signed out','Google Drive is signed out on this device. Sign in to keep syncing.','sign-in','Sign in');
      if(syncPassword)add('sync-password','warning','Needs password','The backup password was set or changed on another device. Enter it here to keep syncing.','unlock-sync','Enter password');
      else if(lockHere)add('password','warning','Needs password','Backups and sync wait until this profile’s backup password is entered on this device.','enter-password','Enter password');
      if(newer)add('update-needed','warning','Needs app update',value.newerData===true?'Data saved by a newer version of the app is kept safe on this device. Update the app to use and sync it.':'Google Drive has a version saved by a newer app. Update the app to keep syncing.','check-update','Update app');
      if(review)add('sync-review','review','Needs review','Google Drive has changes that need your review.','review-sync','Review');
      if(kept)add('kept','review',`${kept} kept version${kept===1?'':'s'} to review`,`${kept} kept version${kept===1?' is':'s are'} waiting for your review.`,'review-kept','Review');
      if(device&&device.mode==='permission')add('device-permission','warning','Device Folder needs permission','The Device Folder needs your permission again before it can back up.','device-permission','Allow access');
      const deviceFailing=!!device&&(device.mode==='error'||deviceOn&&device.retryBackoffCapped===true);
      if(deviceFailing)add('device-error','error','Device Folder backup failing','Backups to the Device Folder are not completing. Library → Data has the details.','open-data','Details');
      for(const issue of storage){const label=String(issue&&issue.label||'Storage');add('storage:'+String(issue&&issue.source||label),issue&&issue.level==='error'?'error':'warning',label,`${label}: ${String(issue&&issue.message||'').slice(0,180)}`,'open-data','Details');}
      if(value.reminder)add('reminder','warning','No backup in over a week',String(value.reminder).replace(/^Backup reminder:\s*/u,''),'open-data','Open backups');
      if(value.sessionElsewhere)add('session-elsewhere','info',`Today’s session is running ${value.sessionElsewhere}`,`Today’s session is running ${value.sessionElsewhere}.`,'open-execute','Go to Execute');
      if(value.updateReady===true)add('update-ready','info','Update ready','A new version of Study Director is ready.','apply-update','Update');
      const order={error:0,warning:1,review:2,info:3};items.sort((a,b)=>order[a.tone]-order[b.tone]);
      // Signed out, password and update needs already show in the ring and their
      // own badge; the amber ! is for the other warnings.
      const count=kept+(review?1:0),ownBadge=new Set(['signed-out','password','sync-password','update-needed']),hasTone=tone=>items.some(item=>item.tone===tone&&!ownBadge.has(item.id));
      const badge=hasTone('error')?'error':lockHere||syncPassword?'lock':newer?'update':hasTone('warning')?'warning':count?'review':value.updateReady===true?'info':'';
      let primary='',headline='',detail='';
      switch(ring){
        case 'off':primary=deviceOn?`Only on this device${device.lastBackupAt?` · Device Folder backup ${timeText(device.lastBackupAt)}`:''}`:'Only on this device';headline=deviceOn?'Not syncing. This device backs up to its Device Folder.':'Only on this device. Connect Google Drive to sync your devices.';break;
        case 'syncing':primary=activity();headline=primary;break;
        case 'synced':primary=`Synced ${syncedAt}`;headline=`Synced at ${syncedAt}. This device is up to date.`;detail='Checks Google Drive again when you return to the app.';break;
        case 'pending':
          if(failed){primary=syncedAt?`Last synced ${syncedAt} · retrying`:'Not synced yet · retrying';headline=syncedAt?`Last synced at ${syncedAt}. Syncing will retry.`:'Not synced yet. Syncing will retry.';const next=timeText(drive.nextEligibleAt);detail=next?`Next try at ${next}.`:'Syncing will try again shortly.';}
          else if(waiting){primary=syncedAt?`Changes since ${syncedAt}`:'Changes waiting to upload';headline=syncedAt?`Changes since ${syncedAt} are waiting to upload.`:'Changes are waiting to upload.';const due=timeText(drive.nextEligibleAt);detail=due?`Uploads by ${due}, or when you leave the app.`:'Uploads soon, or when you leave the app.';}
          else if(review){primary=syncedAt?`Last synced ${syncedAt}`:'Not synced yet';headline='Google Drive has changes that need your review.';}
          else{primary='Connected · first sync not finished';headline='Connected. The first sync hasn’t finished yet.';detail='It starts shortly.';}
          break;
        case 'offline':primary=syncedAt?`Offline · last synced ${syncedAt}`:'Offline · syncs when you’re back online';headline='Offline. Syncing resumes when you’re back online.';detail='Changes stay safe on this device meanwhile.';break;
        case 'signed-out':primary=syncedAt?`Google Drive signed out · last synced ${syncedAt}`:'Google Drive signed out';headline=syncedAt?`Not syncing. Last synced at ${syncedAt}.`:'Not syncing.';break;
        case 'blocked':primary=lockHere||syncPassword?'Needs password':'Needs app update';headline=syncedAt?`Syncing is paused. Last synced at ${syncedAt}.`:'Syncing is paused.';break;
        case 'error':{primary=syncedAt?`Sync stopped · last synced ${syncedAt}`:'Sync stopped';headline='Syncing stopped after several tries.';const next=timeText(drive.nextEligibleAt);detail=next?`Next try at ${next}.`:'';break;}
      }
      // The label (tooltip and screen readers) starts with the most urgent
      // thing that needs the person, then sync health, then the rest.
      const urgent=items.filter(item=>item.tone!=='info'&&item.short!==primary&&!primary.startsWith(item.short));
      const label=[...urgent.slice(0,2).map(item=>item.short),primary,...items.filter(item=>item.tone==='info').slice(0,1).map(item=>item.short)].filter(Boolean).join(' · ');
      const action=connected&&online&&!connecting&&!lockHere&&!syncPassword&&!newer&&ring!=='syncing'?freeze({action:ring==='error'?'retry':'sync-now',label:ring==='error'?'Try again':'Sync now'}):null;
      return freeze({ring,slow,badge,count,label,primary,headline,detail,action,items:freeze(items)});
    }
    return freeze({begin,read,current,feedback,condition,notice,bytes,detail,outcome,locationLabel,syncLabel,status,summary,reach,restoreChoices:RESTORE_CHOICES,resolve:(source,id='backup-operation')=>notifications.resolveEvent(source,id),reset,subscribe:notifications.subscribe});
  }
  return freeze({format:'study-director.backup-presentation-module',contractVersion:1,createPresentation});
});
})();
