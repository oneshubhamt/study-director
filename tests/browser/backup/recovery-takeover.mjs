import assert from 'node:assert/strict';
import {instrumentedHtml,startReleaseServer,launchChromium,waitFor,waitForStudyDirector,skipFirstStart} from '../../helpers/browser-harness.mjs';

const server=await startReleaseServer();
server.setOverride('deployment','recovery-takeover.html',instrumentedHtml().replace('Object.freeze({StartupLifecycle,','Object.freeze({AppMutationCoordinator,LibraryClearCoordinator,LibraryClearState,StartupLifecycle,'));
const url=server.url('deployment','recovery-takeover.html');
const results=[];
try{
  for(const kind of ['library-clear','restore']){
    const browser=await launchChromium({profilePrefix:'sd-recovery-takeover-'+kind+'-'});
    try{
      const open=async()=>{const page=await browser.createPage(url,{bypassServiceWorker:true});await waitForStudyDirector(page,{instrumented:true});return page;};
      let primary=await open();await skipFirstStart(primary);await waitFor(()=>primary.evaluate('__PWA6.AppOwnership.canMutate()'),{label:'initial primary'});
      const original=await primary.evaluate(`(async()=>{const d=__PWA6;d.AppData.notes.update('Ethics','Ethics','original journal recovery note');await d.AppData.notes.flush({strict:true});return Object.values(await d.AppData.notes.readFreshPayload()).find(note=>note.label==='Ethics');})()`);
      assert.equal(original?.text,'original journal recovery note','fixture must establish the canonical preimage');
      assert.ok(original.key,'the canonical note identity must be captured before deletion');
      const secondary=await open();
      await waitFor(()=>secondary.evaluate('__PWA6.AppOwnership.state==="secondary"'),{label:'initialized secondary'});
      const fixture=await primary.evaluate(`(async()=>{
        const d=__PWA6,kind=${JSON.stringify(kind)},data=d.AppData,id=kind==='library-clear'?'libraryclear_takeover_12345':'restore_takeover_12345';
        const journal=kind==='library-clear'?data.libraryClearJournal:data.restoreJournal;
        await d.AppMutationCoordinator.runExclusive(kind==='library-clear'?'clear-library':'restore-backup',async()=>{
          if(kind==='library-clear'){
            const plan=await d.LibraryClearCoordinator.preflight({notes:true});
            const payload=await d.LibraryClearState.capture(plan,{forceReferenced:false,deleteIds:[],protectedIds:plan.attachments.protectedIds});
            await journal.prepare({id,signature:plan.signature,payload});
          }else{
            const checkpoint=await d.BackupController.createCheckpoint();
            try{const blob=new Blob([await checkpoint.blob.arrayBuffer()],{type:checkpoint.blob.type});await journal.prepare({id,blob,filename:checkpoint.filename,savedDayDeletions:await data.deletionRecovery.savedDays(),noteDeletions:await data.deletionRecovery.notes(),attachmentDeletions:await data.deletionRecovery.attachments()});}
            finally{await checkpoint.release();}
          }
          await journal.mark(id,'applying-notes');
          await data.notes.clearAll();
          await data.notes.flush({strict:true});
        });
        return {id: (await journal.read()).state.id,notes:Object.keys(await data.notes.readFreshPayload())};
      })()`);
      assert.equal(fixture.notes.length,0,'the partial operation changed real canonical Notes');
      assert.equal(await secondary.evaluate('__PWA6.AppOwnership.canMutate()'),false,'secondary remains read-only until primary closes');
      console.log(JSON.stringify({kind,stage:'durable journal prepared after secondary startup',fixture}));
      await browser.closePage(primary);primary=null;
      // Wait for the terminal result, not merely the HYDRATING interval. The
      // old code becomes primary here with an unretired recovery journal.
      const admission=await waitFor(async()=>{const status=await secondary.evaluate(`(()=>{const d=__PWA6,s=d.AppOwnership.status();return {state:s.state,canMutate:d.AppOwnership.canMutate(),fault:d.AppMutationCoordinator.status().recoveryKind};})()`);return ['primary','faulted'].includes(status.state)?status:null;},{label:kind+' takeover decision'});
      assert.equal(admission.canMutate,false,kind+' pending journal must prevent primary admission');
      assert.equal(admission.state,'faulted',kind+' must deny the takeover before hydrated writes');
      assert.equal(admission.fault,kind,kind+' recovery reason must remain visible');
      const blocked=await secondary.evaluate(`(async()=>{const d=__PWA6,data=d.AppData,kind=${JSON.stringify(kind)},journal=kind==='library-clear'?data.libraryClearJournal:data.restoreJournal;try{data.notes.update('Successor','Successor','MUST NOT COMMIT');await data.notes.flush({strict:true});}catch{}return {id:(await journal.read()).state.id,notes:Object.keys(await data.notes.readFreshPayload()),banner:document.querySelector('.ownership-banner')?.textContent};})()`);
      assert.equal(blocked.id,fixture.id,'takeover must retain the exact recovery journal');assert.deepEqual(blocked.notes,[],'blocked tab must not write successor notes');assert.match(blocked.banner,/Reload to complete recovery/u);
      // Close the blocked page and open a new document, the same startup
      // recovery path as reload. It must replay and verify before admission.
      await browser.closePage(secondary);
      const recovered=await open();await waitFor(()=>recovered.evaluate('__PWA6.AppOwnership.canMutate()'),{label:kind+' recovered primary'});
      const proof=await recovered.evaluate(`(async()=>{const d=__PWA6,data=d.AppData,kind=${JSON.stringify(kind)},journal=kind==='library-clear'?data.libraryClearJournal:data.restoreJournal;return {journal:await journal.read(),note:(await data.notes.readFreshPayload())[${JSON.stringify(original.key)}]?.text,owner:d.AppOwnership.canMutate()};})()`);
      assert.deepEqual(proof,{journal:null,note:'original journal recovery note',owner:true},kind+' fresh startup must verify the preimage and retire the journal');
      // Real host composition: keep an authority past retirement, then lose
      // AppOwnership during a second mutation. No fake storage or lease port.
      if(kind==='library-clear'){
        const witness=await recovered.evaluate(`(async()=>{
          const d=__PWA6,c=d.AppMutationCoordinator;let old,retired=false,borrowed=false,rollbackDenied=false,aborted=false,operationRejected=false;
          const code=error=>error?.code==='STUDY_DIRECTOR_MUTATION_AUTHORITY_LOST';
          await c.runExclusive('clear-library',authority=>{old=authority;authority.assert();});
          try{old.assert();}catch(error){retired=code(error);}
          try{await c.runExclusive('clear-library',authority=>{
            try{old.assert({allowDurableProtected:true});}catch(error){borrowed=code(error);}
            authority.assert();
            d.AppOwnership.release();d.AppOwnership.setPrimary(false);
            try{authority.assert({allowDurableProtected:true});}catch(error){rollbackDenied=code(error);}
            aborted=authority.signal.aborted;
          });}catch(error){operationRejected=code(error);}
          const request={id:'mutation_takeover_probe_12345',owner:'tab_takeover_probe_owner',kind:'restore',expiresAt:Date.now()+60000},lease=await d.AppData.mutationLease.acquire(request);
          const released=lease.acquired&&await d.AppData.mutationLease.release(request.id,request.owner);
          return {retired,borrowed,rollbackDenied,aborted,operationRejected,released,active:c.status().active,fault:!!c.status().recoveryFault};
        })()`);
        assert.deepEqual(witness,{retired:true,borrowed:true,rollbackDenied:true,aborted:true,operationRejected:true,released:true,active:'',fault:true},'real host must retire old authorities, reject rollback after ownership loss and release the original durable lease');
      }
      results.push({kind,denied:true,journalRetained:true,recovered:true,mutationLifetime:kind==='library-clear'});await browser.closePage(recovered);
    }finally{await browser.close();}
  }
  console.log(JSON.stringify({status:'PASS',suite:'recovery-takeover',results}));
}finally{await server.close();}
