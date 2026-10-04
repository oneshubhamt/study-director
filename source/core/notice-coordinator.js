(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
registry.define('notice-coordinator',1,()=>{
  const freeze=Object.freeze;
  const PRIORITIES=freeze({critical:500,safety:400,storage:300,update:200,installation:100});
  const KINDS=freeze(new Set(Object.keys(PRIORITIES)));
  function createCoordinator(input){
    if(!input||!Object.isFrozen(input))throw new TypeError('Notice coordinator input must be frozen.');
    const render=typeof input.render==='function'?input.render:()=>{};
    const now=typeof input.now==='function'?input.now:()=>Date.now();
    const setTimer=typeof input.setTimeout==='function'?input.setTimeout:setTimeout;
    const clearTimer=typeof input.clearTimeout==='function'?input.clearTimeout:clearTimeout;
    const cooldownMs=Math.max(0,Number(input.installationCooldownMs)||1200);
    const rows=new Map(),dismissedNotices=new Map();
    let active=null,revision=0,timer=null;
    function cleanId(value){
      const id=String(value||'').trim();
      if(!/^[a-z][a-z0-9-]*$/.test(id))throw new TypeError('Notice id is invalid.');
      return id;
    }
    function cleanNotice(id,value,previous){
      const kind=String(value&&value.kind||'');
      if(!KINDS.has(kind))throw new TypeError('Notice kind is invalid.');
      const title=String(value&&value.title||'').trim();
      const message=String(value&&value.message||'').trim();
      if(!title||!message)throw new TypeError('Notice title and message are required.');
      const signature=[id,kind,title,message].join('|');
      return freeze({
        id,kind,title,message,priority:PRIORITIES[kind],signature,
        actionLabel:String(value&&value.actionLabel||''),compact:value&&value.compact!==false,
        deferred:kind==='installation'?!!(previous&&previous.deferred):false,
        eligibleAt:kind==='installation'?(previous&&Number.isFinite(previous.eligibleAt)?previous.eligibleAt:now()):now()
      });
    }
    function ordered(){return [...rows.values()].filter(row=>dismissedNotices.get(row.id)!==row.signature).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));}
    function schedule(at){
      if(timer!==null)clearTimer(timer);
      timer=setTimer(()=>{timer=null;recompute();},Math.max(0,at-now()));
    }
    function publicRow(row){return row?freeze({...row}):null;}
    function snapshot(announcement=''){
      return freeze({format:'study-director.notice-state',version:1,revision,active:publicRow(active),queued:freeze(ordered().filter(row=>!active||row.id!==active.id).map(publicRow)),announcement});
    }
    function recompute(){
      const currentTime=now();
      let candidates=ordered();
      const installation=rows.get('installation');
      const higher=candidates.some(row=>row.kind!=='installation'&&row.priority>PRIORITIES.installation);
      if(installation&&higher&&!installation.deferred){
        rows.set('installation',freeze({...installation,deferred:true,eligibleAt:Number.POSITIVE_INFINITY}));
        candidates=ordered();
      }else if(installation&&installation.deferred&&!higher&&!Number.isFinite(installation.eligibleAt)){
        rows.set('installation',freeze({...installation,eligibleAt:currentTime+cooldownMs}));
        candidates=ordered();
      }
      const next=candidates.find(row=>row.kind!=='installation'||(!row.deferred||row.eligibleAt<=currentTime))||null;
      const pendingInstallation=rows.get('installation');
      if(!next&&pendingInstallation&&Number.isFinite(pendingInstallation.eligibleAt)&&pendingInstallation.eligibleAt>currentTime)schedule(pendingInstallation.eligibleAt);
      else if(timer!==null){clearTimer(timer);timer=null;}
      const changed=(active&&active.signature)!==(next&&next.signature);
      active=next;revision+=changed?1:0;
      let announcement='';
      if(active&&changed){announcement=`${active.title}. ${active.message}`;}
      render(snapshot(announcement));
      return snapshot();
    }
    function publish(id,value){
      const key=cleanId(id);
      if(!value||value.visible===false){rows.delete(key);dismissedNotices.delete(key);return recompute();}
      const previous=rows.get(key);
      rows.set(key,cleanNotice(key,value,previous));
      return recompute();
    }
    function dismiss(id){const key=cleanId(id);rows.delete(key);dismissedNotices.delete(key);return recompute();}
    function acknowledge(id){const row=rows.get(cleanId(id));if(row)dismissedNotices.set(row.id,row.signature);return recompute();}
    function clear(){clearEvents();rows.clear();dismissedNotices.clear();active=null;if(timer!==null)clearTimer(timer);timer=null;revision+=1;render(snapshot(''));return snapshot();}
    // Shared presentation state. Feature controllers retain execution and cancellation.
    const events=new Map(),listeners=new Set();
    const SEVERITY=freeze({error:400,warning:300,info:200,success:100});
    const LIFECYCLES=new Set(['running','succeeded','failed','cancelled','resolved']);
    const SURFACES=new Set(['toast','inline','quiet']);
    const MAX_TOASTS=4,QUEUE_LIMIT=32,RECENT_LIMIT=64;
    let sequence=0,eventRevision=0,eventTimer=null,hidden=false;
    function identity(value,label){
      if(typeof value!=='string'||!value.trim()||value.length>120||/[\u0000-\u001f]/u.test(value))throw new TypeError(`Notification ${label} is invalid.`);
      return value;
    }
    function eventKey(source,id){return JSON.stringify([identity(source,'source'),identity(id,'id')]);}
    function normalize(raw){
      const source=identity(raw.source,'source'),id=identity(raw.id,'id');
      const severity=raw.severity||'info',lifecycle=raw.lifecycle||'succeeded',surface=raw.surface||(raw.foreground===false&&['succeeded','cancelled'].includes(lifecycle)?'quiet':'toast');
      if(!Object.hasOwn(SEVERITY,severity)||!LIFECYCLES.has(lifecycle)||!SURFACES.has(surface))throw new TypeError('Notification severity, lifecycle or surface is invalid.');
      if(raw.cue&&raw.cue!=='none'&&!Object.hasOwn(CUES,raw.cue))throw new TypeError('Notification cue is invalid.');
      const operationId=raw.operationId==null?'':identity(raw.operationId,'operation id');
      const title=String(raw.title||'Study Director').trim().slice(0,120),message=String(raw.message||'').trim().slice(0,surface==='toast'?500:2000);
      let progress=null,action=null;
      if(raw.progress){
        const number=key=>{const value=Number(raw.progress[key]||0);if(!Number.isFinite(value)||value<0)throw new TypeError('Notification progress is invalid.');return value;};
        progress=freeze({stage:String(raw.progress.stage||''),current:number('current'),total:number('total'),completedBytes:number('completedBytes'),totalBytes:number('totalBytes'),loadedBytes:number('loadedBytes'),activeBytes:number('activeBytes')});
      }
      if(raw.action){
        if(!String(raw.action.label||'').trim()||typeof raw.action.run!=='function')throw new TypeError('Notification action is invalid.');
        action=freeze({label:String(raw.action.label).trim().slice(0,100),run:raw.action.run});
      }
      const persistent=raw.persistent===true||lifecycle==='running'||lifecycle==='failed';
      // A condition that only a decision can clear (dismissible:false) keeps its toast until resolved.
      const dismissible=!(persistent&&raw.dismissible===false&&raw.action);
      const duration=persistent?0:Math.max(1800,Math.min(12000,Number(raw.duration)|| (severity==='warning'?7000:4200)));
      return freeze({source,id,operationId,surfaceId:String(raw.surfaceId||''),retainInline:raw.retainInline!==false,occurrence:String(raw.occurrence||''),cue:String(raw.cue||''),system:raw.system===true,kind:String(raw.kind||''),outcome:String(raw.outcome||''),completedAt:String(raw.completedAt||''),announce:raw.announce===true,severity,lifecycle,foreground:raw.foreground!==false,title,message,progress,action,surface,persistent,dismissible,duration});
    }
    function signature(event){return JSON.stringify({...event,action:event.action?event.action.label:null});}
    function publicEvent(row){return freeze({...row.event,key:row.key,deliveryId:String(row.sequence),revision:row.revision,surfaceRevision:row.surfaceRevision,dismissed:row.dismissed});}
    function visibleEvents(){
      return [...events.values()].filter(row=>!row.dismissed&&(row.event.surface==='toast'||row.event.announce)&&row.event.lifecycle!=='resolved')
        .sort((a,b)=>SEVERITY[b.event.severity]-SEVERITY[a.event.severity]||a.sequence-b.sequence).slice(0,MAX_TOASTS);
    }
    function eventSnapshot(){return freeze({events:freeze([...events.values()].map(publicEvent)),toasts:freeze(visibleEvents().map(publicEvent))});}
    function accountTime(){
      const time=now();
      for(const row of events.values())if(row.started!==null){row.remaining=Math.max(0,row.remaining-(time-row.started));row.started=null;if(row.remaining===0)row.dismissed=true;}
    }
    function publishEvents(){
      if(eventTimer!==null){clearTimer(eventTimer);eventTimer=null;}
      const displayed=new Set(visibleEvents().map(row=>row.key));
      const waiting=[...events.values()].filter(row=>!row.dismissed&&!row.event.persistent&&(row.event.surface==='toast'||row.event.announce)&&!displayed.has(row.key));
      while(waiting.length>QUEUE_LIMIT)waiting.shift().dismissed=true;
      // Keep a small deduplication history; never discard an unresolved error or active operation.
      const retired=[...events.values()].filter(row=>(row.dismissed||row.event.surface==='quiet')&&row.event.lifecycle!=='running'&&row.event.lifecycle!=='failed');
      while(retired.length>RECENT_LIMIT){const row=retired.shift();events.delete(row.key);}
      const visible=visibleEvents(),visibleKeys=new Set(visible.map(row=>row.key));let next=Infinity;
      const timed=new Set([...visible,...[...events.values()].filter(row=>row.event.surfaceId&&!row.event.retainInline&&!row.dismissed)]);
      for(const row of events.values())if(!visibleKeys.has(row.key))row.pauses.clear();
      for(const row of timed)if(!hidden&&!row.pauses.size&&row.event.duration){row.started=now();next=Math.min(next,row.remaining);}
      if(Number.isFinite(next))eventTimer=setTimer(()=>{eventTimer=null;accountTime();publishEvents();},next);
      const state=eventSnapshot();for(const listener of listeners)try{listener(state);}catch(error){if(typeof input.capture==='function')input.capture('notifications.render',error);}
      return state;
    }
    function storeEvent(event,{fresh=false,dismissed=false}={}){
      const key=eventKey(event.source,event.id),previous=events.get(key),sig=signature(event);
      if(!fresh&&previous&&previous.signature===sig&&previous.event.action?.run===event.action?.run)return publicEvent(previous);
      accountTime();
      const row={key,event,signature:sig,revision:++eventRevision,surfaceRevision:event.operationId&&!fresh&&previous?previous.surfaceRevision:eventRevision,sequence:fresh||!previous?++sequence:previous.sequence,dismissed,remaining:event.duration,started:null,pauses:previous&&!fresh?previous.pauses:new Set()};
      if(activeSound?.key===key&&(fresh||event.lifecycle!==previous?.event.lifecycle||event.occurrence!==previous?.event.occurrence))stopSound();
      events.set(key,row);publishEvents();deliverOccurrence(row,previous);return publicEvent(row);
    }
    function publishEvent(raw,renewDismissed=false){
      const event=normalize(raw),key=eventKey(event.source,event.id),previous=events.get(key);
      if(event.operationId)throw new TypeError('Operation notifications require begin() and its scoped update handle.');
      if(event.lifecycle==='resolved'){resolveEvent(event.source,event.id);return null;}
      if(previous?.event.operationId)throw new TypeError('An operation notification cannot be overwritten by an unscoped event.');
      return storeEvent(event,{fresh:renewDismissed&&previous?.dismissed===true});
    }
    function emit(raw){return publishEvent(raw);}
    function begin(raw){
      const event=normalize({...raw,operationId:raw.operationId||`operation-${sequence+1}`,lifecycle:'running'}),key=eventKey(event.source,event.id);
      storeEvent(event,{fresh:true});const generation=events.get(key).sequence;
      function update(patch){
        const row=events.get(key);
        if(!row||row.sequence!==generation||row.event.lifecycle!=='running')return false;
        const next=normalize({...row.event,persistent:patch.lifecycle&&patch.lifecycle!=='running'?false:row.event.persistent,...patch,source:event.source,id:event.id,operationId:event.operationId});
        if(next.lifecycle==='resolved'){resolveEvent(event.source,event.id,generation);return true;}
        // Dismissing running progress never cancels work, and updates cannot reopen it.
        return storeEvent(next,{dismissed:row.dismissed&&next.lifecycle==='running'});
      }
      return freeze({operationId:event.operationId,update,read:()=>{const row=events.get(key);return row?.sequence===generation?publicEvent(row):null;},resolve:()=>resolveEvent(event.source,event.id,generation)});
    }
    function resolveEvent(source,id,generation=null){
      const key=eventKey(source,id),row=events.get(key);if(!row||generation!==null&&row.sequence!==generation)return false;
      accountTime();events.delete(key);failureSounds.delete(key);if(activeSound?.key===key)stopSound();publishEvents();return true;
    }
    function dismissEvent(key,deliveryId){
      const row=events.get(key);if(!row||String(row.sequence)!==String(deliveryId)||row.event.dismissible===false)return false;
      accountTime();row.dismissed=true;publishEvents();return true;
    }
    function pauseEvent(key,deliveryId,reason,paused){
      const row=events.get(key);if(!row||String(row.sequence)!==String(deliveryId))return false;
      accountTime();if(paused)row.pauses.add(reason);else row.pauses.delete(reason);publishEvents();return true;
    }
    function setHidden(value){if(hidden===!!value)return;accountTime();hidden=!!value;if(hidden)stopSound();publishEvents();}
    function subscribe(listener){if(typeof listener!=='function')throw new TypeError('Notification listener is required.');listeners.add(listener);listener(eventSnapshot());return ()=>listeners.delete(listener);}
    function clearEvents(){accountTime();events.clear();failureSounds.clear();heard.clear();stopSound();publishEvents();}
    function notify(raw={}){
      const severity=raw.severity||raw.kind||'info',id=String(raw.key||`message-${++sequence}`);
      return publishEvent({...raw,kind:raw.operationKind||'',source:raw.source||'interaction',id,severity,lifecycle:raw.lifecycle||(severity==='error'?'failed':'succeeded')},true)?.deliveryId||'';
    }
    // Feature adapters carry handles, never a second message store. Inline surfaces
    // and toast summaries are projections of the same scoped event.
    function presentation(source,action=null){
      identity(source,'source');
      function start(raw={}){
        const id=raw.id||'operation',handle=begin({action,...raw,source,id,surface:'inline',announce:raw.foreground!==false&&raw.announce!==false});
        const read=handle.read;
        return freeze({operationId:handle.operationId,read,resolve:handle.resolve,update:handle.update,
          finish:(lifecycle,message,patch={})=>handle.update({lifecycle,message,progress:null,severity:lifecycle==='failed'?'error':lifecycle==='succeeded'?'success':'info',announce:raw.foreground!==false&&lifecycle!=='cancelled',...patch})});
      }
      return freeze({begin:start,feedback:raw=>emit({action,...raw,source})});
    }
    // Delivery policy runs only on accepted event edges, never on rendering.
    const CUES=freeze({
      'study-start':['begin',true,30], 'day-complete':['day',true,40],
      'block-complete':['complete',true,35], 'next-block':['resume',false,20],
      pause:['pause',false,20], resume:['resume',false,20], skip:['skip',false,20],
      pomodoro:['invitation',true,50], 'break-complete':['return',true,50],
      overtime:['overtime',true,55], 'practice-target':['target',true,25],
      'practice-near':['hint',false,10], confirmation:['confirm',false,15], attention:['attention',true,80]
    });
    let delivery=null,soundMode='full',activeSound=null,soundEpoch=0;
    const heard=new Set(),failureSounds=new Map();
    function deliveryContext(){return delivery?.context?.()||{owner:true,foreground:true};}
    function stopSound(){soundEpoch++;activeSound=null;delivery?.audio?.stop();}
    function configureDelivery(value){stopSound();delivery=value;}
    function setSoundMode(value){
      if(!['full','minimal','off'].includes(value))throw new TypeError('Invalid sound mode.');
      if(soundMode!==value){soundMode=value;stopSound();}
      return soundMode;
    }
    function soundStatus(){return freeze({mode:soundMode,readiness:delivery?.audio?.status?.()||'unavailable'});}
    function occurrenceCue(event,previous,key){
      if(event.lifecycle==='cancelled'||event.lifecycle==='resolved')return '';
      if(event.lifecycle==='succeeded')failureSounds.delete(key);
      if(event.cue)return event.cue==='none'?'':event.cue;
      if(event.kind==='os')return '';
      if(event.lifecycle==='failed'&&(event.announce||event.surface==='toast'||event.source==='local-saving')){
        if((failureSounds.get(key)||0)>=SEVERITY[event.severity])return '';
        failureSounds.set(key,SEVERITY[event.severity]);return 'attention';
      }
      const confirmations=['plan','review','library','attachments','attachment-ingest','file','device-folder','google-drive','recovery'];
      if(event.lifecycle==='succeeded'&&previous?.event.lifecycle==='running'&&event.foreground&&event.announce&&confirmations.includes(event.source))return 'confirmation';
      return '';
    }
    function deliverOccurrence(row,previous){
      const event=row.event,key=row.key,cue=occurrenceCue(event,previous,key),policy=CUES[cue];
      if(!policy)return;
      const token=JSON.stringify([key,event.operationId,event.occurrence||event.lifecycle,cue, event.lifecycle==='failed'?event.severity:'']);
      if(event.cue){
        if(heard.has(token))return;
        heard.add(token);if(heard.size>256)heard.delete(heard.values().next().value);
      }
      if(!delivery||!deliveryContext().owner)return;
      const acceptedAt=now();
      const isCurrent=()=>{
        const current=events.get(key);
        return current?.sequence===row.sequence&&current.event.operationId===event.operationId&&current.event.occurrence===event.occurrence&&current.event.lifecycle===event.lifecycle&&current.event.cue===event.cue&&!['cancelled','resolved'].includes(current.event.lifecycle)&&deliveryContext().owner;
      };
      if(event.system&&(!deliveryContext().foreground||hidden)){
        // The OS owns background audibility. Never add our own simultaneous bell.
        Promise.resolve(delivery.system?.(event,()=>isCurrent()&&now()-acceptedAt<30000&&!deliveryContext().foreground,()=>soundMode==='off')).catch(error=>input.capture?.('notifications.system',error));
        return;
      }
      if(hidden||!deliveryContext().foreground||soundMode==='off'||soundMode==='minimal'&&!policy[1])return;
      const priority=event.source==='local-saving'?100:policy[2];
      if(activeSound&&activeSound.until>now()&&activeSound.priority>priority)return;
      stopSound();const epoch=soundEpoch;
      activeSound={key,priority,until:now()+3200};
      const eligible=()=>epoch===soundEpoch&&isCurrent()&&now()-acceptedAt<1200&&!hidden&&deliveryContext().foreground&&soundMode!=='off'&&(soundMode==='full'||policy[1]);
      Promise.resolve(delivery.audio.play(policy[0],{isCurrent:eligible})).catch(error=>input.capture?.('notifications.audio',error)).finally(()=>{if(epoch===soundEpoch)activeSound=null;});
    }
    function testSound(){
      if(!delivery?.audio)return Promise.resolve(false);
      // Explicit audition bypasses mode only. Never interrupt a storage warning.
      if(activeSound?.priority>=80&&activeSound.until>now())return Promise.resolve(false);
      stopSound();const epoch=soundEpoch,started=now();
      return delivery.audio.play('begin',{explicit:true,isCurrent:()=>epoch===soundEpoch&&now()-started<2000&&!hidden&&deliveryContext().foreground});
    }
    async function deliverSystem(raw,deliver){
      if(delivery&&(!deliveryContext().owner||deliveryContext().foreground&&!raw.test))return false;
      const source=raw.source||'system',id=raw.id,occurrence=String(raw.occurrence||id),key=eventKey(source,id),previous=events.get(key);
      if(previous?.event.kind==='os'&&previous.event.occurrence===occurrence&&['running','succeeded'].includes(previous.event.lifecycle))return false;
      const createdAt=now();
      const handle=begin({...raw,source,id,occurrence,kind:'os',surface:'quiet',foreground:false,announce:false});
      const isCurrent=()=>events.get(key)?.event.operationId===handle.operationId&&events.get(key)?.event.lifecycle==='running'&&now()-createdAt<30000&&(!delivery||deliveryContext().owner&&(raw.test||!deliveryContext().foreground));
      try{
        const delivered=await deliver(isCurrent);
        if(!isCurrent()){handle.update({lifecycle:'cancelled',outcome:'expired-or-inactive'});return false;}
        handle.update({lifecycle:delivered?'succeeded':'cancelled',outcome:delivered?'delivered':'not-delivered'});
        return !!delivered;
      }catch(error){
        handle.update({lifecycle:'cancelled',outcome:'delivery-failed'});
        if(typeof input.capture==='function')input.capture('notifications.system',error);
        return false;
      }
    }
    function status(){return snapshot();}
    return freeze({format:'study-director.notice-coordinator',contractVersion:1,priorities:PRIORITIES,publish,dismiss,acknowledge,clear,status,
      readEvent:(source,id)=>{const row=events.get(eventKey(source,id));return row?publicEvent(row):null;},emit,begin,presentation,configureDelivery,setSoundMode,soundStatus,testSound,stopSound,deliverSystem,resolveEvent,dismissEvent,pauseEvent,setHidden,subscribe,notify,eventStatus:eventSnapshot});
  }
  return freeze({format:'study-director.notice-coordinator-module',contractVersion:1,priorities:PRIORITIES,createCoordinator});
});
})();
