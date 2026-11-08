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
  // A running catch-up or upload: its stage and counts. Its opening line
  // ("Syncing with Google Drive…") only repeats the status, so it is left out.
  function operationText(op){
    if(!op)return '';
    const message=String(op.message||''),stage=/^(Syncing with|Backing up to) /u.test(message)?'':message;
    return [stage,detail(op.progress||{})].filter(Boolean).join(' · ');
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
    // A problem the person ran into while doing something (a backup file that
    // would not open): it stays until closed or resolved.
    function condition(source,id,message){if(!message)return notifications.resolveEvent(source,id);return notifications.emit({source,id,message,severity:'warning',lifecycle:'failed',foreground:false,tier:'result',title:source==='file'?'File backup':source==='device-folder'?'Device Folder backup':'Google Drive backup',action:action(source,id),surface:'toast',persistent:true});}
    // A heads-up from background work. Blocking (the default: a sign-in that
    // ended, a password, an app update, retries that ran out) stays pinned
    // until closed or resolved and sounds once; news (a sync review) fades
    // after 12 s and waits while a work block runs. Repeating the same notice
    // does not show it again until it is resolved. Red (error) only for
    // retries that ran out (docs/areas/notifications.md, kinds).
    function notice(source,id,message,{error=false,tier='blocking'}={}){return notifications.emit({source,id,message,severity:error?'error':'warning',lifecycle:'succeeded',foreground:false,tier,title:source==='device-folder'?'Device Folder backup':'Google Drive backup',action:action(source,id),surface:'toast',duration:12000});}
    // The reach line for a restore or combine dialog, while Drive syncs.
    function reach(){try{return typeof input.synced==='function'&&input.synced()===true?RESTORE_CHOICES.reach:'';}catch{return '';}}
    function reset(source){for(const event of notifications.eventStatus().events)if(event.source===source)notifications.resolveEvent(source,event.id);}
    // The profile indicator on every screen size: a ring for sync health and a
    // badge for the most important thing that needs the person, plus the text
    // and actions for the profile panel. The host gathers the inputs; this only
    // decides. States and priorities: docs/areas/status-indicator.md.
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
        // Retries ran out, for a catch-up or an upload (the counter resets on
        // every success).
        else if(drive.retryBackoffCapped===true)ring='error';
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
        if(turn)return `Waiting for ${String(sync.turnDevice||'')||'another device'} to finish saving…`;
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
      // A session suspended on another device waits here: an offer, so no badge.
      else if(value.sessionReady)add('session-ready','info','Today’s session is ready',`Today’s session was suspended ${value.sessionReady}. Continue it here when you’re ready.`,'continue-session','Continue here');
      if(value.updateReady===true)add('update-ready','info','Update ready','A new version of Study Director is ready.','apply-update','Update');
      const order={error:0,warning:1,review:2,info:3};items.sort((a,b)=>order[a.tone]-order[b.tone]);
      // Signed out, password and update needs already show in the ring and their
      // own badge; the amber ! is for the other warnings.
      const count=kept+(review?1:0),ownBadge=new Set(['signed-out','password','sync-password','update-needed']),hasTone=tone=>items.some(item=>item.tone===tone&&!ownBadge.has(item.id));
      // News that faded unseen (docs/areas/notifications.md, Recent) shares the
      // blue info badge, with its count.
      const unseen=Math.max(0,Math.floor(Number(value.unseen)||0)),unseenText=unseen?`${unseen} new notification${unseen===1?'':'s'}`:'';
      const badge=hasTone('error')?'error':lockHere||syncPassword?'lock':newer?'update':hasTone('warning')?'warning':count?'review':value.updateReady===true||unseen?'info':'';
      let primary='',headline='',detail='';
      switch(ring){
        case 'off':primary=deviceOn?`Only on this device${device.lastBackupAt?` · Device Folder backup ${timeText(device.lastBackupAt)}`:''}`:'Only on this device';headline=deviceOn?'Not syncing. This device backs up to its Device Folder.':'Only on this device. Connect Google Drive to sync your devices.';break;
        // Waiting only for this device's own upload: Drive's latest is here.
        case 'syncing':primary=activity();headline=primary;detail=slow?'Google Drive’s latest is on this device. Its own changes upload next.':operationText(value.operation);break;
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
      const label=[...urgent.slice(0,2).map(item=>item.short),primary,...items.filter(item=>item.tone==='info').slice(0,1).map(item=>item.short),unseenText].filter(Boolean).join(' · ');
      // A button only when something waits: another device's turn (Sync now
      // goes ahead without it), a retry, or a stop. None while syncing works.
      const ready=connected&&online&&!connecting&&!lockHere&&!syncPassword&&!newer;
      const action=!ready?null:ring==='error'?freeze({action:'retry',label:'Try again'}):slow||ring==='pending'&&failed?freeze({action:'sync-now',label:'Sync now'}):null;
      return freeze({ring,slow,badge,count,unseen,label,primary,headline,detail,action,items:freeze(items)});
    }
    // The card shown from Connect (or Sign in) until the first sync ends:
    // three steps, the live sentence, the running operation with its counts
    // and how it ended. The host keeps the history (when it started, whether
    // a catch-up or an upload ran since); this only decides. Phase 3 of
    // docs/areas/status-indicator.md.
    function connectProgress(value={}){
      const phase=String(value.phase||'signing-in'),drive=value.drive||null,sync=drive?.sync||{},op=value.operation||null,seen=value.seen||{},online=value.online!==false;
      const started=Number(value.startedAt)||0,syncedAt=Date.parse(String(sync.syncedAt||''))||0,kept=Math.max(0,Number(value.keptNew)||0);
      const syncing=!!(sync.syncing||op?.kind==='sync'),uploading=!!(op?.kind==='upload'&&['upload','commit','complete'].includes(String(op.progress?.stage||''))),working=syncing||!!drive?.backingUp||!!op;
      const p=op?.progress||{},fraction=p.total>0?Math.min(1,(Number(p.current)||0)/p.total):p.totalBytes>0?Math.min(1,(Number(p.completedBytes)||0)/p.totalBytes):null;
      const opDetail=operationText(op);
      const steps=(active,failed='',waiting=false)=>{
        const order=['sign-in','bring-in','upload'],at=order.indexOf(active);
        const labels={
          'sign-in':at>0||active==='done'?'Signed in to Google':'Sign in to Google',
          'bring-in':active==='done'?(seen.sync?'Brought in changes from Google Drive':'Nothing new on Google Drive'):at>1?(seen.sync?'Brought in changes from Google Drive':'Checked Google Drive'):'Bring in what’s on Google Drive',
          upload:active==='done'?(seen.upload?'Uploaded this device’s data':'Nothing to upload'):'Upload this device’s data'
        };
        return freeze(order.map((id,index)=>freeze({id,label:labels[id],state:id===failed?(waiting?'waiting':'failed'):active==='done'||index<at?'done':index===at?'active':'pending'})));
      };
      // A step that waits (for a retry or a sign-in) is amber; failed (×) is red.
      const result=(tone,title,status,active,{waiting=false,...extra}={})=>freeze({tone,title,status,detail:'',fraction:null,action:null,done:false,...extra,steps:steps(active,extra.failed||'',waiting)});
      const act=(action,label)=>freeze({action,label});
      if(phase==='failed')return result('error','Google Drive wasn’t connected',String(value.error||'Sign-in didn’t finish.'),'sign-in',{failed:'sign-in',action:act('sign-in','Try again')});
      if(phase==='signing-in')return result('working','Connecting Google Drive','Signing in to Google…','sign-in');
      if(!drive?.connected)return result('attention','Google Drive signed out','Sign in again to finish syncing.','bring-in',{failed:'bring-in',waiting:true,action:act('sign-in','Sign in')});
      // After a catch-up, what remains is this device's upload. Waiting for
      // another device's turn comes only after Drive's latest is here.
      const turn=Number(sync.turnWaits)>0,active=uploading||turn||seen.sync&&!syncing?'upload':'bring-in';
      if(!online)return result('attention','Syncing with Google Drive','Offline. Syncing continues when you’re back online.',active);
      if(sync.password)return result('attention','Enter your backup password','Another device encrypts this library. Enter its password to finish syncing.','bring-in',{action:act('unlock-sync','Enter password')});
      if(drive.locked)return result('attention','Enter your backup password','Your backups are encrypted. Enter the password on this device to finish syncing.',active,{action:act('enter-password','Enter password')});
      if(sync.newer)return result('attention','Update the app to finish syncing','Google Drive holds data from a newer version of Study Director.','bring-in',{action:act('check-update','Check for update')});
      if(!working&&drive.retryBackoffCapped)return result('error','Sync stopped','Syncing stopped after several tries.',active,{failed:active,action:act('retry','Try again')});
      // Still retrying: amber; red only once retries ran out (above).
      if(!working&&sync.failed){const next=timeText(drive.nextEligibleAt);return result('attention','Syncing with Google Drive',`Couldn’t finish syncing.${next?` Trying again at ${next}.`:' Trying again shortly.'}`,active,{failed:active,waiting:true,action:act('retry','Try now')});}
      // A review leaves the sync time as it was, and nothing comes in or
      // goes up until it is settled.
      if(!working&&sync.review)return result('attention','Google Drive has changes to review','Some changes need your review before they come in.','bring-in',{failed:'bring-in',waiting:true,action:act('review-sync','Review')});
      if(!working&&syncedAt>=started&&syncedAt>0&&!drive.waiting){
        const when=timeText(sync.syncedAt);
        if(kept)return result('done','Synced with Google Drive',`Synced at ${when}. ${kept} version${kept===1?'':'s'} kept for you to review.`,'done',{done:true,action:act('review-kept','Review')});
        return result('done','Synced with Google Drive',`Synced at ${when}. This device is up to date.`,'done',{done:true});
      }
      if(!working&&turn)return result('working','Syncing with Google Drive',`Waiting for ${String(sync.turnDevice||'')||'another device'} to finish saving…`,'upload',{failed:'upload',waiting:true,action:act('sync-now','Sync now')});
      const status=active==='upload'?'Uploading this device’s data…':syncing?'Bringing in changes from Google Drive…':'Checking Google Drive…';
      return result('working','Syncing with Google Drive',status,active,{detail:opDetail,fraction});
    }
    return freeze({begin,read,current,feedback,condition,notice,bytes,detail,outcome,locationLabel,syncLabel,status,connectProgress,summary,reach,restoreChoices:RESTORE_CHOICES,resolve:(source,id='backup-operation')=>notifications.resolveEvent(source,id),reset,subscribe:notifications.subscribe});
  }
  return freeze({format:'study-director.backup-presentation-module',contractVersion:1,createPresentation});
});
})();
