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
  // Banners kept in Recent, with their kind, and the ones that sound.
  const BANNER_TIERS=freeze({critical:'critical',safety:'critical',storage:'blocking'});
  const BANNER_CUES=freeze({safety:'attention',storage:'needs-you'});
  function createCoordinator(input){
    if(!input||!Object.isFrozen(input))throw new TypeError('Notice coordinator input must be frozen.');
    const render=typeof input.render==='function'?input.render:()=>{};
    const now=typeof input.now==='function'?input.now:()=>Date.now();
    const setTimer=typeof input.setTimeout==='function'?input.setTimeout:setTimeout;
    const clearTimer=typeof input.clearTimeout==='function'?input.clearTimeout:clearTimeout;
    const cooldownMs=Math.max(0,Number(input.installationCooldownMs)||1200);
    const rows=new Map(),dismissedNotices=new Map(),bannerLines=new Map(),bannerEntries=new Map();
    let active=null,revision=0,timer=null,bannerSerial=0;
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
    // A banner on screen enters Recent, and a new line on an unsaved-work or
    // storage banner sounds once (Attention, or the softer needs-you); the
    // same lines sound again only after the banner clears and returns.
    function noteBanner(key){
      const row=rows.get(key);
      if(!row||!active||active.id!==key||!BANNER_TIERS[row.kind])return;
      // Entered once per appearance; later only updated, so Clear keeps it out.
      let entry=bannerEntries.get(key);const created=!entry;if(created){entry=`banner:${key}#${++bannerSerial}`;bannerEntries.set(key,entry);}
      upsertRecent(entry,{key:'',source:'banner',deliveryId:'',tier:BANNER_TIERS[row.kind],severity:row.kind==='storage'?'warning':'error',title:row.title,message:row.message},created);
      const lines=row.message.split('\n').map(line=>line.trim()).filter(Boolean),known=bannerLines.get(key)||new Set();
      const fresh=lines.some(line=>!known.has(line));
      for(const line of lines)known.add(line);bannerLines.set(key,known);
      if(fresh&&BANNER_CUES[row.kind])playCue(BANNER_CUES[row.kind],{key:`banner:${key}`,isCurrent:()=>active?.id===key});
      flushRecent();
    }
    function endBanner(key,outcome){
      bannerLines.delete(key);const entry=bannerEntries.get(key);bannerEntries.delete(key);
      if(entry){settleRecent(entry,outcome);flushRecent();}
    }
    // Whichever banner ends up on screen is noted, also one that a higher
    // banner had kept back.
    function shown(state){if(state.active)noteBanner(state.active.id);return state;}
    function publish(id,value){
      const key=cleanId(id);
      if(!value||value.visible===false){rows.delete(key);dismissedNotices.delete(key);endBanner(key,'resolved');return shown(recompute());}
      const previous=rows.get(key);
      rows.set(key,cleanNotice(key,value,previous));
      return shown(recompute());
    }
    function dismiss(id){const key=cleanId(id);rows.delete(key);dismissedNotices.delete(key);endBanner(key,'dismissed');return shown(recompute());}
    function acknowledge(id){
      const row=rows.get(cleanId(id));if(row)dismissedNotices.set(row.id,row.signature);
      const entry=row&&bannerEntries.get(row.id);if(entry){settleRecent(entry,'dismissed');flushRecent();}
      return shown(recompute());
    }
    function clear(){clearEvents();rows.clear();dismissedNotices.clear();bannerLines.clear();bannerEntries.clear();active=null;if(timer!==null)clearTimer(timer);timer=null;revision+=1;render(snapshot(''));return snapshot();}
    // Shared presentation state. Feature controllers retain execution and cancellation.
    const events=new Map(),listeners=new Set(),recentListeners=new Set();
    const SEVERITY=freeze({error:400,warning:300,info:200,success:100});
    const LIFECYCLES=new Set(['running','succeeded','failed','cancelled','resolved']);
    const SURFACES=new Set(['toast','inline','quiet']);
    // A pop-up's kind decides how long it stays, where it sits, its sound and
    // whether it waits (docs/NOTIFICATIONS.md, kinds):
    //   result    answers the person's own action;
    //   news      background, blocks nothing; waits while a work block runs;
    //   blocking  something stops until the person acts; stays, pinned;
    //   critical  data at risk; stays, pinned first, cannot be closed.
    const TIERS=freeze(new Set(['result','news','blocking','critical']));
    const STACK_LIMIT=32,HISTORY_LIMIT=64,RECENT_LIMIT=20,NEWS_MS=12000,CHIME_GAP_MS=4000;
    const RECENT_OUTCOMES=freeze(new Set(['open','expired','dismissed','acted','resolved','replaced','ended']));
    let sequence=0,eventRevision=0,eventTimer=null,hidden=false,studying=false,lastChimeAt=-Infinity,recentDirty=false;
    const stackPauses=new Set(),recentEntries=[];
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
      const foreground=raw.foreground!==false;
      // Without a stated kind: the person's own action is a result; background
      // success or information is news; a background warning or error blocks.
      const tier=raw.tier==null||raw.tier===''?(foreground?'result':severity==='warning'||severity==='error'?'blocking':'news'):String(raw.tier);
      if(!TIERS.has(tier))throw new TypeError('Notification tier is invalid.');
      const operationId=raw.operationId==null?'':identity(raw.operationId,'operation id');
      const title=String(raw.title||'Study Director').trim().slice(0,120),message=String(raw.message||'').trim().slice(0,surface==='toast'?500:2000);
      let progress=null,action=null,secondaryAction=null;
      if(raw.progress){
        const number=key=>{const value=Number(raw.progress[key]||0);if(!Number.isFinite(value)||value<0)throw new TypeError('Notification progress is invalid.');return value;};
        progress=freeze({stage:String(raw.progress.stage||''),current:number('current'),total:number('total'),completedBytes:number('completedBytes'),totalBytes:number('totalBytes'),loadedBytes:number('loadedBytes'),activeBytes:number('activeBytes')});
      }
      if(raw.action){
        if(!String(raw.action.label||'').trim()||typeof raw.action.run!=='function')throw new TypeError('Notification action is invalid.');
        // opens: the button only opens something (a dialog, a place, a sign-in),
        // so a click anywhere on the card may do the same (docs/NOTIFICATIONS.md).
        action=freeze({label:String(raw.action.label).trim().slice(0,100),run:raw.action.run,opens:raw.action.opens===true});
      }
      // A decision notice may offer a second choice beside its primary action.
      if(action&&raw.secondaryAction){
        if(!String(raw.secondaryAction.label||'').trim()||typeof raw.secondaryAction.run!=='function')throw new TypeError('Notification secondary action is invalid.');
        secondaryAction=freeze({label:String(raw.secondaryAction.label).trim().slice(0,100),run:raw.secondaryAction.run});
      }
      // Blocking and critical pop-ups stay until settled; so do running work
      // and failures.
      const persistent=tier==='blocking'||tier==='critical'||raw.persistent===true||lifecycle==='running'||lifecycle==='failed';
      // Critical ones, and a condition that only a decision can clear
      // (dismissible:false), keep their pop-up until resolved.
      const dismissible=tier!=='critical'&&!(persistent&&raw.dismissible===false&&raw.action);
      const duration=persistent?0:Math.max(1800,Math.min(12000,Number(raw.duration)||(tier==='news'?NEWS_MS:severity==='warning'?7000:4200)));
      return freeze({source,id,operationId,surfaceId:String(raw.surfaceId||''),retainInline:raw.retainInline!==false,occurrence:String(raw.occurrence||''),cue:String(raw.cue||''),system:raw.system===true,kind:String(raw.kind||''),outcome:String(raw.outcome||''),completedAt:String(raw.completedAt||''),announce:raw.announce===true,severity,lifecycle,foreground,tier,title,message,progress,action,secondaryAction,surface,persistent,dismissible,duration});
    }
    function signature(event){return JSON.stringify({...event,action:event.action?[event.action.label,event.action.opens]:null,secondaryAction:event.secondaryAction?event.secondaryAction.label:null});}
    function pinned(event){return event.tier==='critical'||event.tier==='blocking'||event.severity==='error';}
    function publicEvent(row){return freeze({...row.event,key:row.key,deliveryId:String(row.sequence),revision:row.revision,surfaceRevision:row.surfaceRevision,dismissed:row.dismissed,pinned:pinned(row.event)});}
    function rank(row){return row.event.tier==='critical'?0:pinned(row.event)?1:2;}
    // Every pop-up is in the stack at once, urgent ones pinned first, then
    // newest first; an update keeps its place. While this device's timer runs
    // on a work block, news waits, unseen and untimed.
    function visibleEvents(){
      return [...events.values()].filter(row=>!row.dismissed&&(row.event.surface==='toast'||row.event.announce)&&row.event.lifecycle!=='resolved'&&!(studying&&row.event.tier==='news'))
        .sort((a,b)=>rank(a)-rank(b)||b.sequence-a.sequence);
    }
    function eventSnapshot(){return freeze({events:freeze([...events.values()].map(publicEvent)),toasts:freeze(visibleEvents().map(publicEvent))});}
    function accountTime(){
      const time=now();
      for(const row of events.values())if(row.started!==null){row.remaining=Math.max(0,row.remaining-(time-row.started));row.started=null;if(row.remaining===0&&!row.dismissed){row.dismissed=true;settleRecent(row,'expired');}}
    }
    function publishEvents(){
      if(eventTimer!==null){clearTimer(eventTimer);eventTimer=null;}
      let visible=visibleEvents();
      // Nothing waits out of sight. Past the limit, the oldest pop-ups that
      // would fade anyway go first.
      if(visible.length>STACK_LIMIT){
        const fading=visible.filter(row=>!row.event.persistent).sort((a,b)=>a.sequence-b.sequence);
        for(const row of fading.slice(0,visible.length-STACK_LIMIT)){row.dismissed=true;settleRecent(row,'expired');}
        visible=visibleEvents();
      }
      // Keep a small deduplication history; never discard an unresolved error or active operation.
      const retired=[...events.values()].filter(row=>(row.dismissed||row.event.surface==='quiet')&&row.event.lifecycle!=='running'&&row.event.lifecycle!=='failed');
      while(retired.length>HISTORY_LIMIT){const row=retired.shift();events.delete(row.key);}
      const visibleKeys=new Set(visible.map(row=>row.key));let next=Infinity;
      const timed=new Set([...visible,...[...events.values()].filter(row=>row.event.surfaceId&&!row.event.retainInline&&!row.dismissed)]);
      for(const row of events.values())if(!visibleKeys.has(row.key))row.pauses.clear();
      // Every visible pop-up counts down, in front or behind; hovering one,
      // or the expanded stack, stops the clock.
      for(const row of timed)if(!hidden&&!row.pauses.size&&!(stackPauses.size&&visibleKeys.has(row.key))&&row.event.duration){row.started=now();next=Math.min(next,row.remaining);}
      if(Number.isFinite(next))eventTimer=setTimer(()=>{eventTimer=null;accountTime();publishEvents();},next);
      for(const row of visible)noteShown(row);
      const state=eventSnapshot();for(const listener of listeners)try{listener(state);}catch(error){if(typeof input.capture==='function')input.capture('notifications.render',error);}
      flushRecent();
      return state;
    }
    // A pop-up on screen enters Recent once it has a result, and news chimes
    // once when it first shows (after a work block, if it waited).
    function noteShown(row){
      const event=row.event;if(event.lifecycle==='running')return;
      // Entered once; later only updated, so a cleared or trimmed entry stays gone.
      recordRecent(row,!row.recorded);row.recorded=true;
      if(event.tier==='news'&&!row.chimed){
        row.chimed=true;
        if(!event.cue&&now()-lastChimeAt>=CHIME_GAP_MS&&playCue('news',{key:row.key,isCurrent:()=>events.get(row.key)?.sequence===row.sequence&&!events.get(row.key).dismissed}))lastChimeAt=now();
      }
    }
    function storeEvent(event,{fresh=false,dismissed=false}={}){
      const key=eventKey(event.source,event.id),previous=events.get(key),sig=signature(event);
      if(!fresh&&previous&&previous.signature===sig&&previous.event.action?.run===event.action?.run&&previous.event.secondaryAction?.run===event.secondaryAction?.run)return publicEvent(previous);
      accountTime();
      const renewed=fresh||!previous;
      const row={key,event,signature:sig,revision:++eventRevision,surfaceRevision:event.operationId&&!fresh&&previous?previous.surfaceRevision:eventRevision,sequence:renewed?++sequence:previous.sequence,dismissed,remaining:event.duration,started:null,pauses:previous&&!fresh?previous.pauses:new Set(),chimed:!renewed&&previous.chimed===true,recorded:!renewed&&previous.recorded===true};
      // A pop-up raised again after it was closed is a new occurrence.
      if(fresh&&previous){tierSounds.delete(key);settleRecent(previous,'replaced');}
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
      accountTime();settleRecent(row,'resolved');events.delete(key);failureSounds.delete(key);tierSounds.delete(key);if(activeSound?.key===key)stopSound();publishEvents();return true;
    }
    // Closing a pop-up (×, swipe, Clear all, or its own button: reason
    // 'acted') only hides it; the work and the condition are unaffected.
    function dismissEvent(key,deliveryId,reason='dismissed'){
      const row=events.get(key);if(!row||String(row.sequence)!==String(deliveryId)||row.event.dismissible===false)return false;
      accountTime();row.dismissed=true;settleRecent(row,reason==='acted'?'acted':'dismissed');publishEvents();return true;
    }
    function dismissAll(){
      accountTime();let count=0;
      for(const row of visibleEvents())if(row.event.dismissible!==false){row.dismissed=true;settleRecent(row,'dismissed');count++;}
      if(count)publishEvents();
      return count;
    }
    function pauseEvent(key,deliveryId,reason,paused){
      const row=events.get(key);if(!row||String(row.sequence)!==String(deliveryId))return false;
      accountTime();if(paused){row.pauses.add(reason);markSeen(entryId(row));}else row.pauses.delete(reason);publishEvents();return true;
    }
    // Stops every visible pop-up's clock, for example while the stack is expanded.
    function setPaused(reason,value){
      const id=String(reason||'');if(!id||!!value===stackPauses.has(id))return false;
      accountTime();if(value)stackPauses.add(id);else stackPauses.delete(id);publishEvents();return true;
    }
    function setHidden(value){if(hidden===!!value)return;accountTime();hidden=!!value;if(hidden)stopSound();publishEvents();}
    function setStudying(value){if(studying===!!value)return;accountTime();studying=!!value;publishEvents();}
    function subscribe(listener){if(typeof listener!=='function')throw new TypeError('Notification listener is required.');listeners.add(listener);listener(eventSnapshot());return ()=>listeners.delete(listener);}
    function clearEvents(){accountTime();events.clear();failureSounds.clear();tierSounds.clear();heard.clear();stackPauses.clear();stopSound();publishEvents();}
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
    // Recent: today's pop-ups and banners, newest first, at most RECENT_LIMIT.
    // Entries hold text only; a pop-up still live offers its button.
    function localDay(ms){const date=new Date(ms);return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;}
    function entryId(row){return `${row.key}#${row.sequence}`;}
    function trimRecent(){
      const today=localDay(now()),before=recentEntries.length;
      for(let index=recentEntries.length-1;index>=0;index--)if(localDay(recentEntries[index].at)!==today)recentEntries.splice(index,1);
      if(recentEntries.length>RECENT_LIMIT)recentEntries.length=RECENT_LIMIT;
      if(recentEntries.length!==before)recentDirty=true;
    }
    function upsertRecent(id,fields,create=true){
      const entry=recentEntries.find(item=>item.id===id);
      if(!entry){if(create){recentEntries.unshift({id,...fields,at:now(),outcome:'open',seen:false});trimRecent();recentDirty=true;}return;}
      for(const [name,value] of Object.entries(fields))if(entry[name]!==value){entry[name]=value;recentDirty=true;}
      if(entry.outcome!=='open'){entry.outcome='open';recentDirty=true;}
    }
    function recordRecent(row,create){
      const event=row.event;
      upsertRecent(entryId(row),{key:row.key,source:event.source,deliveryId:String(row.sequence),tier:event.tier,severity:event.severity,title:event.title,message:event.message},create);
    }
    function settleRecent(rowOrId,outcome){
      const id=typeof rowOrId==='string'?rowOrId:entryId(rowOrId),entry=recentEntries.find(item=>item.id===id);
      if(entry&&entry.outcome==='open'){entry.outcome=outcome;recentDirty=true;}
    }
    function markSeen(id){const entry=recentEntries.find(item=>item.id===id);if(entry&&!entry.seen){entry.seen=true;recentDirty=true;}}
    function recentSnapshot(){
      trimRecent();
      const entries=recentEntries.map(entry=>{
        const row=events.get(entry.key),live=!!row&&String(row.sequence)===entry.deliveryId&&!!row.event.action&&row.event.lifecycle!=='resolved';
        return freeze({id:entry.id,source:entry.source,tier:entry.tier,severity:entry.severity,title:entry.title,message:entry.message,at:entry.at,outcome:entry.outcome,seen:entry.seen,actionLabel:live?row.event.action.label:'',actionOpens:live&&row.event.action.opens===true});
      });
      // Unseen: news that faded on its own, untouched, since Recent was last opened.
      return freeze({entries:freeze(entries),unseen:entries.filter(entry=>entry.tier==='news'&&entry.outcome==='expired'&&!entry.seen).length});
    }
    function flushRecent(){
      if(!recentDirty)return;recentDirty=false;
      const state=recentSnapshot();recentDirty=false;
      for(const listener of recentListeners)try{listener(state);}catch(error){if(typeof input.capture==='function')input.capture('notifications.recent',error);}
    }
    function subscribeRecent(listener){if(typeof listener!=='function')throw new TypeError('Recent listener is required.');recentListeners.add(listener);listener(recentSnapshot());return ()=>recentListeners.delete(listener);}
    function markRecentSeen(){for(const entry of recentEntries)if(!entry.seen){entry.seen=true;recentDirty=true;}flushRecent();return recentSnapshot();}
    function clearRecent(){if(recentEntries.length){recentEntries.length=0;recentDirty=true;}flushRecent();return recentSnapshot();}
    // Entries kept from earlier in this window (a reload) come back as text:
    // their pop-ups are gone, so they never offer a button or count as unseen
    // unless they had already faded unseen.
    function restoreRecent(list){
      if(!Array.isArray(list))return recentSnapshot();
      const today=localDay(now()),known=new Set(recentEntries.map(entry=>entry.id));
      for(const item of list.slice(0,RECENT_LIMIT)){
        if(!item||typeof item!=='object')continue;
        const at=Number(item.at),tier=String(item.tier||''),severity=String(item.severity||''),outcome=String(item.outcome||'');
        const title=String(item.title||'').trim().slice(0,120),message=String(item.message||'').trim().slice(0,500),id=`restored:${String(item.id||'').slice(0,200)}`;
        if(!Number.isFinite(at)||localDay(at)!==today||!TIERS.has(tier)||!Object.hasOwn(SEVERITY,severity)||!RECENT_OUTCOMES.has(outcome)||!title||known.has(id))continue;
        known.add(id);
        recentEntries.push({id,key:'',source:String(item.source||'').slice(0,120),deliveryId:'',tier,severity,title,message,at,outcome:outcome==='open'?'ended':outcome,seen:item.seen===true});
      }
      recentEntries.sort((a,b)=>b.at-a.at);recentDirty=true;trimRecent();flushRecent();
      return recentSnapshot();
    }
    // Recent's button runs the pop-up's own action, as its button would.
    function runRecentAction(id){
      const entry=recentEntries.find(item=>item.id===id),row=entry&&events.get(entry.key);
      if(!row||String(row.sequence)!==entry.deliveryId||!row.event.action||row.event.lifecycle==='resolved')return false;
      const run=row.event.action.run;
      if(row.event.dismissible!==false&&row.event.tier!=='critical')dismissEvent(row.key,row.sequence,'acted');
      else{settleRecent(row,'acted');flushRecent();}
      try{Promise.resolve(run()).catch(error=>input.capture?.('notifications.recent-action',error));}catch(error){input.capture?.('notifications.recent-action',error);}
      return true;
    }
    // Delivery policy runs only on accepted event edges, never on rendering.
    // [sound, plays in Minimal, priority]
    const CUES=freeze({
      'study-start':['begin',true,30], 'day-complete':['day',true,40],
      'block-complete':['complete',true,35], 'next-block':['resume',false,20],
      pause:['pause',false,20], resume:['resume',false,20], skip:['skip',false,20],
      pomodoro:['invitation',true,50], 'break-complete':['return',true,50],
      overtime:['overtime',true,55], 'practice-target':['target',true,25],
      'practice-near':['hint',false,10], confirmation:['confirm',false,15], attention:['attention',true,80],
      'fixed-start':['settle',true,40], 'session-moved':['handoff',true,45],
      'needs-you':['knock',true,60], news:['chime',false,12]
    });
    let delivery=null,soundMode='full',activeSound=null,soundEpoch=0;
    const heard=new Set(),failureSounds=new Map(),tierSounds=new Map();
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
      const shown=event.surface==='toast'||event.announce;
      // Blocking and critical pop-ups sound once per occurrence, even during a
      // work block: Attention when red or critical, otherwise a soft knock.
      if(shown&&(event.tier==='blocking'||event.tier==='critical')){
        const level=event.tier==='critical'||event.severity==='error'?2:1;
        if((tierSounds.get(key)||0)>=level)return '';
        tierSounds.set(key,level);return level===2?'attention':'needs-you';
      }
      if(event.lifecycle==='failed'&&(shown||event.source==='local-saving')){
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
      playCue(cue,{key,isCurrent,source:event.source,acceptedAt});
    }
    // One in-app sound, foreground only, by mode and priority: a sound never
    // cuts off a more important one that is still playing.
    function playCue(cue,{key,isCurrent=()=>true,source='',acceptedAt=now()}={}){
      const policy=CUES[cue];
      if(!policy||!delivery||!deliveryContext().owner)return false;
      if(hidden||!deliveryContext().foreground||soundMode==='off'||soundMode==='minimal'&&!policy[1])return false;
      const priority=source==='local-saving'?100:policy[2];
      if(activeSound&&activeSound.until>now()&&activeSound.priority>priority)return false;
      stopSound();const epoch=soundEpoch;
      activeSound={key,priority,until:now()+3200};
      const eligible=()=>epoch===soundEpoch&&isCurrent()&&now()-acceptedAt<1200&&!hidden&&deliveryContext().foreground&&soundMode!=='off'&&(soundMode==='full'||policy[1]);
      Promise.resolve(delivery.audio.play(policy[0],{isCurrent:eligible})).catch(error=>input.capture?.('notifications.audio',error)).finally(()=>{if(epoch===soundEpoch)activeSound=null;});
      return true;
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
      readEvent:(source,id)=>{const row=events.get(eventKey(source,id));return row?publicEvent(row):null;},emit,begin,presentation,configureDelivery,setSoundMode,soundStatus,testSound,stopSound,deliverSystem,resolveEvent,dismissEvent,dismissAll,pauseEvent,setPaused,setHidden,setStudying,subscribe,notify,eventStatus:eventSnapshot,
      recent:recentSnapshot,subscribeRecent,markRecentSeen,clearRecent,restoreRecent,runRecentAction});
  }
  return freeze({format:'study-director.notice-coordinator-module',contractVersion:1,priorities:PRIORITIES,createCoordinator});
});
})();
