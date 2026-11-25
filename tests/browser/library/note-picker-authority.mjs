import assert from 'node:assert/strict';
import {readScript} from '../../../build/source-script.mts';
import {launchChromium} from '../../helpers/browser-harness.mjs';

const browser=await launchChromium({profilePrefix:'qa-note-picker-authority-'});
try{
  const page=await browser.createPage('about:blank');
  for(const file of ['source/core/internal.ts','source/core/note-links.ts'])await page.evaluate(readScript(file),{returnByValue:false});
  const outcomes=await page.evaluate(`(async()=>{
    const freeze=Object.freeze,module=globalThis[Symbol.for('studyDirector.internalModules.v1')].require('note-links',1);
    let owner=1,writable=true,sourceId='a',changes=0,feedback=0;
    const note=(id,key,label)=>({id,key,label,text:'',links:[],updatedAt:'2026-11-25T00:00:00.000Z'});
    const get=ref=>ref==='source'?note(sourceId,'source','Source'):ref==='b'?note('b','target','Target'):null;
    const controller=module.createController(freeze({ports:freeze({
      view:freeze({document}),notes:freeze({documents:()=>({revision:1,documents:[]}),get,link:()=>{changes++;return {status:'changed'};},linkedFrom:()=>[],list:()=>[get('b')]}),
      text:freeze({tagsIn:()=>[]}),ownership:freeze({canMutate:()=>writable,revision:()=>owner})
    })}));
    const cases=[];
    for(const action of ['normal','lost','reacquired','detached','replaced']){
      sourceId='a';writable=true;owner++;
      const bar=controller.bar({ref:'source',onOpen(){},onChange(){feedback++;}});
      document.body.append(bar);
      const prior=changes,priorFeedback=feedback;
      bar.querySelector('.note-links-add').click();
      const choice=document.querySelector('.note-picker-option');if(!choice)throw new Error('Missing picker option');
      if(action==='lost'||action==='reacquired'){writable=false;owner++;if(action==='reacquired'){writable=true;owner++;}}
      if(action==='detached')bar.remove();
      if(action==='replaced')sourceId='new';
      choice.click();
      await new Promise(resolve=>setTimeout(resolve,0));
      cases.push({action,writes:changes-prior,feedback:feedback-priorFeedback});bar.remove();
    }
    return cases;
  })()`);
  assert.deepEqual(outcomes,['normal','lost','reacquired','detached','replaced'].map(action=>({action,writes:action==='normal'?1:0,feedback:action==='normal'?1:0})));
  console.log(JSON.stringify({status:'PASS',suite:'note-picker-authority',outcomes}));
}finally{await browser.close();}
