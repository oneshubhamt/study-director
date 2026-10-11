(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
registry.define('library-clear',1,()=>{
  const freeze=Object.freeze;
  const clone=value=>value==null?value:structuredClone(value);
  const callable=(value,names)=>value&&names.every(name=>typeof value[name]==='function');
  function comparable(value){
    if(value==null||typeof value!=='object')return value;
    if(Array.isArray(value))return value.map(comparable);
    const out={};
    for(const key of Object.keys(value).sort()){
      if(['libraryView','syncStatus'].includes(key))continue;
      out[key]=comparable(value[key]);
    }
    return out;
  }
  const same=(a,b)=>JSON.stringify(comparable(a))===JSON.stringify(comparable(b));
  function createState(ports){
    if(!ports||typeof ports!=='object')throw new TypeError('Library-clear state ports are required.');
    const data=ports.data,references=ports.references,attachments=ports.attachments,review=ports.review;
    if(typeof ports.createRollbackScope!=='function'||typeof ports.withPersistenceSuppressed!=='function')throw new TypeError('Library-clear state lifecycle ports are incomplete.');
    if(!data||!callable(data.notes,['readFreshPayload','replace','updateValidatedRich','flush','failure'])||!callable(data.dailyRecords,['get','list','saveBatch','restoreBatch'])||!callable(data.activeSession,['load','nextRevision','save','clear']))throw new TypeError('Library-clear state data ports are incomplete.');
    if(!references||!callable(references,['scan','remove','listSources']))throw new TypeError('Library-clear state reference ports are incomplete.');
    if(!attachments||!callable(attachments,['inventory','verifyMetadata','restoreMetadata']))throw new TypeError('Library-clear state attachment ports are incomplete.');
    if(!review||!callable(review,['hydrate','invalidateBindings']))throw new TypeError('Library-clear state review ports are incomplete.');
    const nowIso=typeof ports.nowIso==='function'?ports.nowIso:()=>new Date().toISOString();

    function transformReference(value,target,label){
      const ids=[...(target?.attachmentIds||[])].map(String).filter(Boolean),text=String(value||'');
      if(!ids.length)throw new Error(`${label} has no attachment references to remove.`);
      if(Object.hasOwn(target||{},'expectedValue')&&String(target.expectedValue||'')!==text)throw new Error(`${label} changed before attachment removal.`);
      const before=references.scan(text),present=new Set(before.assetIds||[]);
      for(const id of ids)if(!present.has(id))throw new Error(`${label} changed before attachment removal.`);
      const next=references.remove(text,ids);
      if(!next||!next.removed?.total)throw new Error(`${label} references could not be transformed.`);
      const remaining=new Set(references.scan(next.value).assetIds||[]);
      for(const id of ids)if(remaining.has(id))throw new Error(`${label} reference removal did not verify.`);
      return next.value;
    }

    async function readSession(){
      const loaded=await data.activeSession.load(0,{strict:true});
      if(loaded?.ok!==true||loaded.error)throw loaded?.error||new Error('Active Session could not be read completely.');
      return loaded.value;
    }

    async function rewriteReferences(targets){
      const grouped=Array.isArray(targets)?targets.filter(Boolean):[];
      let changed=0;
      await ports.withPersistenceSuppressed(async()=>{
        const noteTargets=grouped.filter(target=>target.kind==='note');
        if(noteTargets.length){
          const fresh=await data.notes.readFreshPayload()||{},expected=new Map();
          for(const target of noteTargets){
            const current=fresh[target.key];
            if(!current)throw new Error('A note changed before attachment removal.');
            const value=transformReference(current.text,target,'The note');
            const result=data.notes.updateValidatedRich(target.key,current.label||target.label,value,current.updatedAt||'');
            if(!['changed','unchanged'].includes(result.status))throw new Error('The note changed during attachment removal.');
            expected.set(target.key,value);changed++;
          }
          await data.notes.flush({strict:true});
          if(data.notes.failure().failed)throw new Error('Note reference removal did not save safely.');
          const verified=await data.notes.readFreshPayload()||{};
          for(const [key,value] of expected)if(String(verified[key]?.text||'')!==value)throw new Error('Note reference removal verification failed.');
        }
        const dayTargets=grouped.filter(target=>target.kind==='day');
        if(dayTargets.length){
          const rows=[],expected=new Map();
          for(const target of dayTargets){
            const current=await data.dailyRecords.get(target.key,{strict:true});
            if(!current)throw new Error('A Saved Day changed before attachment removal.');
            const value=transformReference(current.reflection,target,'The Saved-Day');
            rows.push({...current,reflection:value});expected.set(target.key,value);changed++;
          }
          await data.dailyRecords.saveBatch(rows);
          for(const [key,value] of expected){const verified=await data.dailyRecords.get(key,{strict:true});if(String(verified?.reflection||'')!==value)throw new Error('Saved-Day reference removal verification failed.');}
        }
        const sessionTargets=grouped.filter(target=>target.kind==='session');
        if(sessionTargets.length>1)throw new Error('Attachment removal found conflicting active-session reference sources.');
        if(sessionTargets.length){
          const target=sessionTargets[0],current=await readSession();
          if(!current)throw new Error('The session reflection changed before attachment removal.');
          const value=transformReference(current.snapshot?.review?.reflection,target,'The session reflection');
          const next={...current,revision:data.activeSession.nextRevision(),updatedAt:nowIso(),snapshot:{...current.snapshot,review:{...current.snapshot.review,reflection:value}}};
          const saved=await data.activeSession.save(next);
          if(!saved?.ok)throw saved?.error||new Error('Session reference removal failed.');
          const verified=await readSession();
          if(String(verified?.snapshot?.review?.reflection||'')!==value)throw new Error('Session reference removal verification failed.');
          review.hydrate({date:verified.date,snapshotReview:verified.snapshot?.review});review.invalidateBindings();changed++;
        }
      });
      return changed;
    }

    async function capture(plan,policy){
      const scope=ports.createRollbackScope(plan,policy),wanted=new Set(policy.deleteIds||[]);
      const notePayload=scope.notes.mode!=='none'?await data.notes.readFreshPayload()||{}:null;
      let noteSnapshot=null;
      if(scope.notes.mode==='all')noteSnapshot={mode:'all',entries:clone(notePayload||{})};
      else if(scope.notes.mode==='selected'){
        const entries={};
        for(const key of scope.notes.keys){const note=notePayload?.[key];if(!note)throw new Error('A note changed before the Library safety journal could be prepared. No Library data was changed.');entries[key]=clone(note);}
        noteSnapshot={mode:'selected',entries};
      }
      let daySnapshot=null;
      if(scope.savedDays.mode==='all')daySnapshot={mode:'all',entries:clone(await data.dailyRecords.list({strict:true})||[])};
      else if(scope.savedDays.mode==='selected'){
        const entries=[];
        for(const key of scope.savedDays.keys){const day=await data.dailyRecords.get(key,{strict:true});if(!day)throw new Error('A Saved Day changed before the Library safety journal could be prepared. No Library data was changed.');entries.push(clone(day));}
        daySnapshot={mode:'selected',entries};
      }
      const capturedSession=scope.session.capture?await readSession():null;
      if(scope.session.capture&&!capturedSession)throw new Error('The active-session reflection changed before the Library safety journal could be prepared. No Library data was changed.');
      const inventory=wanted.size?await attachments.inventory():[],attachmentMetadata=(inventory||[]).filter(row=>wanted.has(row.id)).map(clone);
      if(attachmentMetadata.length!==wanted.size)throw new Error('Attachment metadata changed before the Library safety journal could be prepared. No Library data was changed.');
      if(attachmentMetadata.length)await attachments.verifyMetadata(attachmentMetadata);
      return freeze({
        format:'study-director.library-clear-rollback',version:1,selection:clone(plan.selection),planSignature:plan.signature,
        notes:noteSnapshot,dailyRecords:daySnapshot,
        sessionCaptured:scope.session.capture,activeSession:scope.session.capture?clone(capturedSession):null,
        attachmentMetadata
      });
    }

    async function verifyLogical(plan,policy){
      if(plan.selection.ongoingNotes&&Object.keys(await data.notes.readFreshPayload()||{}).length)throw new Error('Notes deletion did not verify.');
      if(plan.selection.savedDays&&(await data.dailyRecords.list({strict:true})).length)throw new Error('Saved Days deletion did not verify.');
      const ids=new Set(policy.deleteIds||[]),sources=await references.listSources();
      for(const source of sources)for(const id of source.ids||[])if(ids.has(id))throw new Error('An attachment selected for deletion is still referenced by retained data.');
      return true;
    }

    async function verifyFinal(plan,policy){
      await verifyLogical(plan,policy);
      const inventory=await attachments.inventory(),present=new Set(inventory.map(row=>row.id));
      for(const id of policy.deleteIds||[])if(present.has(id))throw new Error('Attachment metadata deletion did not verify.');
      if(plan.selection.attachments&&!policy.forceReferenced)for(const id of plan.attachments.protectedIds||[])if(!present.has(id))throw new Error('A referenced attachment that should have been protected is missing.');
      return true;
    }

    async function restoreNotes(snapshot){
      if(!snapshot)return;
      if(snapshot.mode==='all'){await data.notes.replace(clone(snapshot.entries||{}));await data.notes.flush({strict:true});return;}
      if(snapshot.mode!=='selected')throw new Error('Notes rollback scope is invalid.');
      const current=await data.notes.readFreshPayload()||{};
      for(const [key,original] of Object.entries(snapshot.entries||{})){
        const live=current[key]||null,result=data.notes.updateValidatedRich(key,original.label||key,original.text||'',live?.updatedAt||'');
        if(!['changed','unchanged'].includes(result.status))throw new Error('Note rollback could not restore a targeted record.');
      }
      await data.notes.flush({strict:true});
    }

    async function restore(payload){
      if(!payload||payload.format!=='study-director.library-clear-rollback'||payload.version!==1)throw new Error('Library-clear rollback payload is invalid.');
      await ports.withPersistenceSuppressed(async()=>{
        if(payload.attachmentMetadata?.length)await attachments.restoreMetadata(payload.attachmentMetadata);
        await restoreNotes(payload.notes);
        if(payload.dailyRecords){
          if(!['all','selected'].includes(payload.dailyRecords.mode))throw new Error('Saved-Day rollback scope is invalid.');
          if(payload.dailyRecords.entries?.length)await data.dailyRecords.restoreBatch(clone(payload.dailyRecords.entries));
        }
        if(payload.sessionCaptured){
          if(payload.activeSession){
            const restored={...clone(payload.activeSession),revision:data.activeSession.nextRevision(),updatedAt:nowIso()};
            const saved=await data.activeSession.save(restored);if(!saved?.ok)throw saved?.error||new Error('Active-session rollback failed.');
            const verified=await readSession();if(!verified)throw new Error('Active-session rollback verification failed.');
            review.hydrate({date:verified.date,snapshotReview:verified.snapshot?.review});review.invalidateBindings();
          }else{
            const cleared=await data.activeSession.clear();if(!cleared?.ok)throw cleared?.error||new Error('Active-session rollback clear failed.');
          }
        }
      });
      return true;
    }

    async function verifyRestore(payload){
      if(payload.notes){
        const notes=await data.notes.readFreshPayload()||{},expected=payload.notes.entries||{};
        if(payload.notes.mode==='all'&&Object.keys(notes).length!==Object.keys(expected).length)throw new Error('Notes rollback restored an unexpected record count.');
        for(const [key,original] of Object.entries(expected)){const actual=notes[key];if(!actual||String(actual.label||'')!==String(original.label||'')||String(actual.text||'')!==String(original.text||''))throw new Error('Notes rollback verification failed.');}
      }
      if(payload.dailyRecords){
        const current=await data.dailyRecords.list({strict:true}),map=new Map(current.map(row=>[row.date,row])),expected=payload.dailyRecords.entries||[];
        if(payload.dailyRecords.mode==='all'&&current.length!==expected.length)throw new Error('Saved Days rollback restored an unexpected record count.');
        for(const original of expected){const actual=map.get(original.date);if(!actual||!same(actual,original))throw new Error('Saved Days rollback verification failed.');}
      }
      if(payload.sessionCaptured){
        const actual=await readSession(),expected=payload.activeSession;
        if(!expected&&actual)throw new Error('Active-session rollback verification failed.');
        if(expected&&(!actual||!same(actual.snapshot,expected.snapshot)))throw new Error('Active-session rollback verification failed.');
      }
      const inventory=await attachments.inventory(),map=new Map(inventory.map(row=>[row.id,row]));
      for(const expected of payload.attachmentMetadata||[]){const actual=map.get(expected.id);if(!actual||!same(actual,expected))throw new Error('Attachment metadata rollback verification failed.');}
      return true;
    }

    return freeze({
      format:'study-director.library-clear-state',contractVersion:1,
      transformReference,rewriteReferences,capture,verifyLogical,verifyFinal,restore,verifyRestore
    });
  }

  const cleanSelection=value=>freeze({
    savedDays:!!value?.savedDays,
    ongoingNotes:!!value?.ongoingNotes,
    attachments:!!value?.attachments
  });
  const sourceDeleted=(source,selection)=>source?.kind==='note'?selection.ongoingNotes:source?.kind==='day'?selection.savedDays:false;
  const sortedUnique=values=>[...new Set(values.map(value=>String(value||'')).filter(Boolean))].sort();
  function normalizeSource(source){
    return freeze({
      kind:String(source?.kind||''),
      key:String(source?.key||''),
      label:String(source?.label||''),
      ids:freeze(sortedUnique([...(source?.ids||[])]))
    });
  }
  function signatureFor(selection,attachments,sources){
    return JSON.stringify({
      selection,
      attachments:sortedUnique(attachments.map(row=>row?.id)),
      sources:sources.map(normalizeSource).sort((a,b)=>`${a.kind}:${a.key}`.localeCompare(`${b.kind}:${b.key}`)).map(source=>[source.kind,source.key,source.ids])
    });
  }
  function groupedRewriteTargets(references){
    const grouped=new Map();
    for(const ref of references||[]){
      const kind=String(ref?.kind||''),key=String(ref?.key||''),attachmentId=String(ref?.attachmentId||'');
      if(!kind||!key||!attachmentId)continue;
      const identity=`${kind}:${key}`;
      let target=grouped.get(identity);
      if(!target){target={kind,key,label:String(ref?.label||key||kind),attachmentIds:new Set()};grouped.set(identity,target);}
      target.attachmentIds.add(attachmentId);
    }
    return freeze([...grouped.values()]
      .sort((a,b)=>`${a.kind}:${a.key}`.localeCompare(`${b.kind}:${b.key}`))
      .map(target=>freeze({kind:target.kind,key:target.key,label:target.label,attachmentIds:freeze(sortedUnique([...target.attachmentIds]))})));
  }
  function createRollbackScope(plan,policy={}){
    const force=policy?.forceReferenced===true,rewriteTargets=force?(plan?.attachments?.rewriteTargets||[]):[];
    const keys=kind=>freeze(sortedUnique(rewriteTargets.filter(target=>target.kind===kind).map(target=>target.key)));
    const notes=keys('note'),days=keys('day'),sessions=keys('session');
    return freeze({
      notes:freeze({mode:plan?.selection?.ongoingNotes?'all':notes.length?'selected':'none',keys:notes}),
      savedDays:freeze({mode:plan?.selection?.savedDays?'all':days.length?'selected':'none',keys:days}),
      session:freeze({capture:sessions.length>0,keys:sessions})
    });
  }
  function createPlan(input={}){
    const selection=cleanSelection(input.selection),attachments=Array.isArray(input.attachments)?input.attachments.filter(row=>row&&row.id):[],sources=Array.isArray(input.sources)?input.sources.filter(Boolean):[];
    const unreferenced=[],selectedRecordOnly=[],safe=[],protectedIds=[],protectedReferences=[],referenceIndex=new Map();
    if(selection.attachments){
      for(const source of sources){
        if(!source?.ids||typeof source.ids[Symbol.iterator]!=='function')continue;
        for(const rawId of source.ids){const id=String(rawId||'');if(!id)continue;let refs=referenceIndex.get(id);if(!refs){refs=[];referenceIndex.set(id,refs);}refs.push(source);}
      }
      for(const row of [...attachments].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
        const id=String(row.id),refs=referenceIndex.get(id)||[];
        const surviving=refs.filter(source=>!sourceDeleted(source,selection));
        if(!refs.length){unreferenced.push(id);safe.push(id);continue;}
        if(!surviving.length){selectedRecordOnly.push(id);safe.push(id);continue;}
        protectedIds.push(id);
        for(const source of surviving){
          protectedReferences.push(freeze({attachmentId:id,kind:String(source.kind||''),key:String(source.key||''),label:String(source.label||'')}));
        }
      }
    }
    protectedReferences.sort((a,b)=>`${a.attachmentId}:${a.kind}:${a.key}`.localeCompare(`${b.attachmentId}:${b.kind}:${b.key}`));
    return freeze({
      format:'study-director.library-clear-plan',contractVersion:1,
      selection,
      signature:signatureFor(selection,attachments,sources),
      attachments:freeze({
        total:selection.attachments?attachments.length:0,
        unreferencedIds:freeze(unreferenced),
        selectedRecordOnlyIds:freeze(selectedRecordOnly),
        safeIds:freeze(safe),
        protectedIds:freeze(protectedIds),
        protectedReferences:freeze(protectedReferences),
        rewriteTargets:groupedRewriteTargets(protectedReferences)
      })
    });
  }
  function createCoordinator(ports){
    if(!ports||typeof ports!=='object')throw new TypeError('Library-clear coordinator ports are required.');
    const required=['runExclusive','canMutate','assertAuthority','assertEligible','settle','snapshot','createProtectedSafety','capture','deleteOngoingNotes','deleteSavedDays','removeReferences','verifyLogical','removeAttachmentMetadata','verifyFinal','restore','verifyRestore','sweep','failClosed','clearFault'];
    if(required.some(key=>typeof ports[key]!=='function'))throw new TypeError('Library-clear coordinator ports are incomplete.');
    if(!ports.journal||['prepare','read','mark','clear'].some(key=>typeof ports.journal[key]!=='function'))throw new TypeError('Library-clear journal ports are incomplete.');
    function record(method,...args){try{return ports.diagnostics?.[method]?.(...args);}catch{return '';}}
    async function traced(kind,work){const id=record('start',kind,'Local data',{target:'local-data'}),trace={mark:(name,details={})=>record('mark',name,details,id)};try{const result=await work(trace);record('finish',{status:result.status||'completed',pending:result.pending===true,recovered:result.recovered===true,savedDays:Number(result.savedDays)||0,notes:Number(result.ongoingNotes)||0,attachmentsRemoved:Number(result.attachmentsRemoved)||0,sweepPending:result.sweepPending===true},id);return result;}catch(error){record('fail',error,{},id);throw error;}}
    const makeId=()=>`libraryclear_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,12)}`;
    async function freshPlan(selection){
      await ports.settle();
      const snapshot=await ports.snapshot();
      return createPlan({selection,attachments:snapshot.attachments,sources:snapshot.sources});
    }
    async function preflight(selection){return freshPlan(selection);}
    async function rollbackJournal(journal,error,{startup=false,trace}={}){
      try{
        trace?.mark('clear-rollback-start');ports.assertAuthority({allowDurableProtected:true});
        await ports.journal.mark(journal.state.id,startup?'startup-rolling-back':'rolling-back');
        ports.assertAuthority({allowDurableProtected:true});
        await ports.restore(journal.payload);
        ports.assertAuthority({allowDurableProtected:true});
        await ports.verifyRestore(journal.payload);
        ports.assertAuthority({allowDurableProtected:true});
        await ports.journal.mark(journal.state.id,startup?'startup-rolled-back':'rolled-back');
        await ports.journal.clear(journal.state.id);
        ports.clearFault();trace?.mark('clear-rollback-complete');
        return true;
      }catch(rollbackError){
        trace?.mark('clear-rollback-failed');const message='Library data recovery required. Study Director retained the Library-clear journal. Reload to complete recovery. Do not clear site data.';
        ports.failClosed(message);
        if(startup)throw new Error(message+' Automatic startup recovery failed: '+(rollbackError?.message||rollbackError));
        throw new Error((error?.message||error)+' Automatic Library rollback also failed: '+(rollbackError?.message||rollbackError));
      }
    }
    async function execute(options={}){
      const selection=cleanSelection(options.selection),expectedSignature=String(options.signature||''),forceReferenced=options.forceReferenced===true;
      return traced('library-clear',trace=>ports.runExclusive('clear-library',async()=>{
        trace.mark('clear-preflight');
        ports.assertAuthority();
        await ports.assertEligible();
        await ports.settle();
        const snapshot=await ports.snapshot(),plan=createPlan({selection,attachments:snapshot.attachments,sources:snapshot.sources});
        if(expectedSignature&&plan.signature!==expectedSignature)throw new Error('Library data changed while Clear Library was open. Review the refreshed selection before deleting.');
        const deleteIds=selection.attachments?sortedUnique(forceReferenced?[...plan.attachments.safeIds,...plan.attachments.protectedIds]:[...plan.attachments.safeIds]):[];
        const policy=freeze({forceReferenced,deleteIds:freeze(deleteIds),protectedIds:plan.attachments.protectedIds});
        const safety=await ports.createProtectedSafety('before-clear-library');trace.mark('clear-safety-verified',{available:safety?.verified===true});
        ports.assertAuthority();
        const payload=await ports.capture(plan,policy),id=makeId();
        let journal=null,logicalCommitted=false,savedDays=0,ongoingNotes=0,attachmentsRemoved=0;
        try{
          ports.assertAuthority();
          journal=await ports.journal.prepare({id,signature:plan.signature,payload});trace.mark('clear-journal-prepared');
          ports.assertAuthority();
          await ports.journal.mark(id,'deleting-records');
          if(selection.ongoingNotes){ports.assertAuthority();const result=await ports.deleteOngoingNotes();ongoingNotes=Math.max(0,Number(result?.count)||0);}
          if(selection.savedDays){ports.assertAuthority();const result=await ports.deleteSavedDays();savedDays=Math.max(0,Number(result?.count)||0);}
          if(selection.attachments&&forceReferenced&&plan.attachments.rewriteTargets.length){
            ports.assertAuthority();
            await ports.journal.mark(id,'removing-references');
            await ports.removeReferences(plan.attachments.rewriteTargets);
          }
          ports.assertAuthority();
          await ports.verifyLogical(plan,policy);trace.mark('clear-logical-verified');
          if(deleteIds.length){
            ports.assertAuthority();
            await ports.journal.mark(id,'removing-attachment-metadata');
            const result=await ports.removeAttachmentMetadata(deleteIds);
            attachmentsRemoved=Math.max(0,Number(result?.removed)||0);
          }
          ports.assertAuthority();
          await ports.verifyFinal(plan,policy);trace.mark('clear-final-verified');
          ports.assertAuthority();
          await ports.journal.mark(id,'verified');
          ports.assertAuthority();
          await ports.journal.clear(id);
          journal=null;logicalCommitted=true;ports.clearFault();trace.mark('clear-journal-retired');
        }catch(error){
          if(journal&&!logicalCommitted){await rollbackJournal(journal,error,{trace});}
          throw error;
        }
        let swept=0,sweepPending=false;
        try{swept=await ports.sweep();}catch{ sweepPending=true; }
        trace.mark('clear-sweep-complete',{sweepPending,swept});return freeze({status:'completed',selection:plan.selection,signature:plan.signature,savedDays,ongoingNotes,attachmentsRemoved,attachmentsProtected:selection.attachments&&!forceReferenced?plan.attachments.protectedIds.length:0,safety:safety&&typeof safety==='object'?freeze({...safety}):null,swept,sweepPending});
      }));
    }
    async function recoverInterrupted(){return traced('library-clear-recovery',async trace=>{
      let journal;
      try{journal=await ports.journal.read();trace.mark('clear-recovery-journal-read',{pending:!!journal?.state});}
      catch(error){
        const message='Library data recovery required. The Library-clear journal could not be verified. Preserve browser storage and restore from an external backup before making changes.';
        ports.failClosed(message);throw new Error(message+' '+(error?.message||error));
      }
      if(!journal?.state)return freeze({recovered:false,pending:false});
      if(!ports.canMutate()){
        ports.failClosed('Library data recovery required. Study Director retained the Library-clear journal. Reload in the primary tab to complete recovery. Do not clear site data.');
        return freeze({recovered:false,pending:true});
      }
      return ports.runExclusive('library-clear-recovery',async()=>{
        ports.assertAuthority();
        await rollbackJournal(journal,new Error('Interrupted Library clear'),{startup:true,trace});
        return freeze({recovered:true,pending:false});
      });
    });}
    return freeze({format:'study-director.library-clear-coordinator',contractVersion:1,preflight,execute,recoverInterrupted});
  }
  return freeze({format:'study-director.library-clear-module',contractVersion:2,createPlan,createRollbackScope,createState,createCoordinator});
});
})();
