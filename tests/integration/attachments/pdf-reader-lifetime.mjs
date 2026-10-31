import {readHostHtml} from '../../../build/host-source.mjs';
import {createNotifications} from '../../helpers/notifications.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=readHostHtml();
const start=source.indexOf('function openPdfWorkspace('),end=source.indexOf('const SystemNotifications=',start);
const adapter=source.split('\n').find(line=>line.trim().startsWith('openPdf:')).trim().slice('openPdf:'.length,-1);
const {coordinator}=createNotifications();
let options,mode='open',releases=0,revokes=0;
const sandbox={NoticeCoordinator:coordinator,Blob,URL:{createObjectURL:()=> 'blob:pdf-test',revokeObjectURL:()=>revokes++},document:{createElement:()=>({append(){}})},prefersNativePdfNavigation:()=>false,WorkspaceOverlay:{open:value=>{options=value;if(mode==='throw')throw Error('overlay failed');return mode==='busy'?null:{};}},Interactions:{notify:coordinator.notify},reopenPdfWorkspace:()=>{}};
vm.createContext(sandbox);vm.runInContext(source.slice(start,end)+`\nglobalThis.openPdf=${adapter};`,sandbox);
const file=new Blob(['pdf'],{type:'application/pdf'}),row={id:'att-pdf',type:'application/pdf',name:'Test PDF'};
assert.equal(sandbox.openPdf(row,file,null,()=>releases++),true);assert.equal(releases,0,'reader remains retained while viewer is open');options.onAfterClose();options.onAfterClose();assert.equal(releases,1,'host adapter forwards release and close is idempotent');assert.equal(revokes,1);
mode='busy';assert.equal(sandbox.openPdf(row,file,null,()=>releases++),false);assert.equal(releases,2);
mode='throw';assert.throws(()=>sandbox.openPdf(row,file,null,()=>releases++),/overlay failed/);assert.equal(releases,3);assert.equal(revokes,3);
console.log(JSON.stringify({status:'PASS',suite:'pdf-reader-lifetime',openRetains:true,closeReleases:true,busyAndFailureRelease:true}));

mode='open';assert.equal(sandbox.openPdf(row,file,null,()=>releases++),true);assert.equal(coordinator.readEvent('attachments','pdf-overlay-busy'),null,'successful reopen clears the earlier persistent warning');options.onAfterClose();mode='busy';sandbox.openPdf(row,file,null,()=>releases++);assert.equal(coordinator.readEvent('attachments','pdf-overlay-busy').lifecycle,'failed','a recurring open failure is visible again');coordinator.clear();
