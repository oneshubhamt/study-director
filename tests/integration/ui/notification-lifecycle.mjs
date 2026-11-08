import {readHostHtml} from '../../../build/host-source.mjs';
import {readScript} from '../../../build/source-script.mts';
import {readCoreScript,coreScriptPath} from '../../helpers/core-script.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const name of ['internal','notice-coordinator','backup-presentation','interactions'])vm.runInThisContext(readCoreScript(name),{filename:coreScriptPath(name)});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')],module=registry.require('notice-coordinator',1),freeze=Object.freeze;
function clock(){
  let time=0,sequence=0;const pending=new Map();
  return {now:()=>time,setTimeout:(fn,delay)=>{pending.set(++sequence,{fn,at:time+delay});return sequence;},clearTimeout:id=>pending.delete(id),
    tick(ms){const end=time+ms;let rounds=0;while(true){const next=[...pending].filter(([,item])=>item.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;assert.ok(++rounds<1000,'scheduler must not spin');time=next[1].at;pending.delete(next[0]);next[1].fn();}time=end;},count:()=>pending.size};
}
function coordinator(){const time=clock(),renders=[];return {time,renders,notices:module.createCoordinator(freeze({...time,render:s=>renders.push(s)}))};}
{
  const {notices:n,time,renders}=coordinator();
  const safety={kind:'safety',title:'Unsaved work',message:'Local save failed'};
  n.publish('safety',safety);assert.match(renders.at(-1).announcement,/Local save failed/);
  n.acknowledge('safety');n.publish('safety',safety);assert.equal(n.status().active,null,'acknowledgement suppresses the same active condition');
  n.publish('safety',{...safety,visible:false});n.publish('safety',safety);assert.match(renders.at(-1).announcement,/Local save failed/,'resolution re-arms an identical recurring problem');
  n.dismiss('safety');n.publish('safety',safety);assert.match(renders.at(-1).announcement,/Local save failed/,'removal resets the live announcement');
  n.publish('installation',{kind:'installation',title:'Install',message:'Install app'});assert.equal(n.status().active.id,'safety');
  n.dismiss('safety');assert.equal(n.status().active,null);time.tick(1200);assert.equal(n.status().active.id,'installation');
  n.clear();assert.equal(time.count(),0);
}
{
  const {notices:n,time}=coordinator();
  n.notify({key:'failure',kind:'error',title:'Not saved',message:'Retry'});
  for(let i=0;i<7;i++)n.notify({key:`done-${i}`,kind:'success',title:'Done'});
  // Nothing waits out of sight: every pop-up is in the stack, the error
  // pinned first, then the newest first.
  assert.deepEqual(n.eventStatus().toasts.map(row=>row.id),['failure','done-6','done-5','done-4','done-3','done-2','done-1','done-0']);
  assert.equal(n.eventStatus().toasts[0].pinned,true);assert.equal(n.eventStatus().toasts[1].pinned,false);
  time.tick(50000);assert.deepEqual(n.eventStatus().toasts.map(row=>row.id),['failure'],'routine results cannot evict or expire unresolved errors');
  const error=n.eventStatus().toasts[0];n.dismissEvent(error.key,error.deliveryId);n.emit({source:'interaction',id:'failure',severity:'error',lifecycle:'failed',title:'Not saved',message:'Retry'});
  assert.equal(n.eventStatus().toasts.length,0,'identical updates cannot undo acknowledgement');
  n.resolveEvent('interaction','failure');n.notify({key:'failure',kind:'error',title:'Not saved',message:'Retry'});assert.equal(n.eventStatus().toasts.length,1);
  n.clear();
  const id=n.notify({key:'saved',title:'Saved',duration:4000});time.tick(2000);assert.equal(n.notify({key:'saved',title:'Saved',duration:4000}),id);time.tick(2001);assert.equal(n.eventStatus().toasts.length,0,'duplicates do not restart expiry');n.notify({key:'saved',title:'Saved',duration:4000});assert.equal(n.eventStatus().toasts.length,1,'a new foreground notification can recur after expiry');n.clear();
  n.emit({source:'device',id:'automatic',foreground:false,lifecycle:'succeeded',message:'Verified'});assert.equal(n.eventStatus().toasts.length,0,'background success is quiet by default');n.clear();
  assert.throws(()=>n.emit({source:'test',id:'bad',severity:'constructor'}),/severity/);
  assert.throws(()=>n.emit({source:'test',id:'bad',progress:{total:-1}}),/progress/);
}
{
  const {notices:n,time}=coordinator();let cancelled=0;
  const first=n.begin({source:'drive',id:'backup',operationId:'one',title:'Backup',action:{label:'Cancel',run:()=>cancelled++}});
  const second=n.begin({source:'drive',id:'backup',operationId:'two',title:'Backup'});
  assert.equal(first.update({message:'Late progress'}),false);assert.equal(first.resolve(),false);
  assert.throws(()=>n.emit({source:'drive',id:'backup',message:'Unscoped overwrite'}),/operation/);
  second.update({message:'Writing',progress:{current:1,total:2}});const row=n.eventStatus().toasts[0];
  n.dismissEvent(row.key,row.deliveryId);second.update({message:'Verifying'});assert.equal(n.eventStatus().toasts.length,0);assert.equal(cancelled,0,'dismissal cannot invoke an operation action');
  second.update({lifecycle:'succeeded',severity:'success',message:'Verified'});assert.equal(n.eventStatus().toasts.length,1,'a dismissed progress summary can report its terminal result');
  assert.equal(second.update({lifecycle:'running',message:'Late update'}),false);time.tick(5000);assert.equal(n.eventStatus().toasts.length,0,'running persistence must not leak into success');
  const third=n.begin({source:'drive',id:'backup',operationId:'three',title:'Backup'});third.update({lifecycle:'cancelled',message:'Cancelled safely'});
  assert.equal(third.update({message:'Wrong success',lifecycle:'succeeded'}),false);assert.equal(n.eventStatus().events.at(-1).lifecycle,'cancelled');
}
class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.parentNode=null;this.dataset={};this.attributes={};this.listeners=new Map();this.className='';this.textContent='';this.classList={contains:k=>this.className.split(' ').includes(k),add:k=>this.className+=' '+k,remove:k=>this.className=this.className.split(' ').filter(v=>v!==k).join(' '),toggle:(k,on)=>on?this.classList.add(k):this.classList.remove(k)};}
  append(...items){for(const item of items){item.parentNode=this;this.children.push(item);}}
  appendChild(item){this.append(item);}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(item=>item!==this);this.parentNode=null;}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type,handler){const rows=this.listeners.get(type)||[];rows.push(handler);this.listeners.set(type,rows);}
  removeEventListener(type,handler){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item!==handler));}
  dispatch(type,event={}){for(const handler of [...(this.listeners.get(type)||[])])handler({target:this,...event});}
  contains(target){return target===this||this.children.some(child=>child.contains(target));}
}
{
  // Hover and focus hold one pop-up's time; a hidden page holds every one.
  // The renderer itself is checked in a real page (tests/browser/ui/notification-stack.mjs).
  const {notices:n,time}=coordinator();
  n.notify({key:'saved',title:'Saved',duration:4000});const saved=n.eventStatus().toasts[0];time.tick(1000);
  n.pauseEvent(saved.key,saved.deliveryId,'hover',true);time.tick(10000);assert.equal(n.eventStatus().toasts.length,1);
  n.pauseEvent(saved.key,saved.deliveryId,'focus',true);n.pauseEvent(saved.key,saved.deliveryId,'hover',false);time.tick(10000);assert.equal(n.eventStatus().toasts.length,1,'keyboard focus retains a paused toast');
  n.pauseEvent(saved.key,saved.deliveryId,'focus',false);time.tick(2000);n.setHidden(true);time.tick(10000);assert.equal(n.eventStatus().toasts.length,1);
  n.setHidden(false);time.tick(1001);assert.equal(n.eventStatus().toasts.length,0);
  // Exercise the actual attachment error call site, rather than inferring severity from wording.
  const source=readScript('source/core/attachments.ts'),start=source.indexOf('    function reportError('),end=source.indexOf('\n    async function operation',start);
  new Function('notifications',source.slice(start,end)+';reportError(new Error("Disk full"));')(n.presentation('attachments')); 
  const failure=n.eventStatus().toasts[0];
  assert.deepEqual([failure.severity,failure.tier,failure.pinned,failure.duration],['error','result',true,0],'a failed action is red, pinned and stays');
  assert.equal(n.dismissEvent(failure.key,failure.deliveryId),true);assert.equal(n.eventStatus().toasts.length,0);
  n.clear();assert.equal(time.count(),0);
}
{
  const {notices:n}=coordinator(),nodes=new Map(['device-folder','google-drive'].map(source=>[`backup-operation-note-${source}`,new Element()]));
  const presentation=registry.require('backup-presentation',1).createPresentation(freeze({notifications:n}));
  const html=readHostHtml(),a=html.indexOf('BackupPresentation.subscribe(()=>{'),b=html.indexOf('const REPOSITORY_MAINTENANCE_FORMAT',a);
  new Function('BackupPresentation','document','renderFileBackup',html.slice(a,b))(presentation,{getElementById:id=>nodes.get(id)||null},()=>{});
  for(const sourceId of ['device-folder','google-drive']){
    const handle=presentation.begin(sourceId,'restore-version',{label:sourceId,message:'Verifying safety copy'});
    handle.update({progress:{current:1,total:2}});const node=nodes.get(`backup-operation-note-${sourceId}`);assert.equal(node.hidden,false);assert.match(node.textContent,/Verifying safety copy · 1 of 2 complete/);
    handle.finish({message:'Restored locally. External backup update is pending.'});assert.match(node.textContent,/External backup update is pending/);
    assert.equal(handle.update({message:'Stale progress'}),false);assert.match(node.textContent,/External backup update is pending/,'completed projection must reject late progress');
  }
  n.clear();assert.ok([...nodes.values()].every(node=>node.hidden));
}
{
  const {notices:n}=coordinator();for(let i=0;i<200;i++)n.notify({key:`routine-${i}`,title:'Saved'});
  assert.ok(n.eventStatus().events.length<=100,'routine notification queues and dedup history remain bounded');n.clear();
  const html=readHostHtml(),a=html.indexOf('function renderCoordinatedNotice(state){'),b=html.indexOf('function noticeCanCompact',a);
  const announcer=new Element(),render=new Function('document',html.slice(a,b)+';return renderCoordinatedNotice;')({getElementById:id=>id==='install-notice-announcer'?announcer:null});
  render({active:{kind:'safety'},announcement:'Local save failed'});assert.equal(announcer.textContent,'Local save failed');render({active:null,announcement:''});assert.equal(announcer.textContent,'','the DOM live region must clear between identical recurrences');render({active:{kind:'safety'},announcement:'Local save failed'});assert.equal(announcer.textContent,'Local save failed');
}
{
  const {notices:n}=coordinator(),presentation=registry.require('backup-presentation',1).createPresentation(freeze({notifications:n}));
  const source=readScript('source/core/backup.ts'),a=source.indexOf('async function exportPortableBackup(){'),b=source.indexOf('function exportLocalBackup(){',a);
  let error=new Error('Disk full');
  const run=new Function('OperationDiagnostics','notifyStatus','createCheckpoint','presentation','Exports','portableBackupFilename','getStudentNameFromDisplay','exportReporter','portableCopy','markBackupCompleted',`const portableAssets=true;let localExportPromise=null,portablePresentation=null;const setLocalExportStatus=(message,ok)=>portablePresentation.update({message,severity:ok?'info':'error'}),finishPortablePresentation=patch=>portablePresentation.finish(patch);${source.match(/const fields=[^\n]+;/u)[0]}${source.slice(a,b)};return exportPortableBackup;`)({start:()=>'',mark:()=>{},finish:()=>{},fail:()=>{}},()=>{},async()=>{throw error;},presentation,{chooseSave:()=>Promise.resolve(null)},()=>'student-study-director-backup.sdbackup',()=>'Student',()=>({stage(){},progress(){}}),()=>({}),()=>{});
  assert.equal((await run()).status,'failed');assert.equal(n.eventStatus().toasts.at(-1).severity,'error');assert.equal(presentation.read('file').lifecycle,'failed');
  error=Object.assign(new Error('Cancelled'),{name:'AbortError'});assert.equal((await run()).status,'cancelled');assert.equal(n.eventStatus().toasts.length,0);assert.equal(presentation.read('file').lifecycle,'cancelled','user cancellation is neutral feedback');n.clear();

}
{
  const {notices:n}=coordinator();for(let i=0;i<200;i++)n.emit({source:'maintenance',id:`quiet-${i}`,foreground:false,lifecycle:'succeeded',message:'Done'});
  assert.ok(n.eventStatus().events.length<=64,'quiet background results also have bounded retention');n.clear();
  const html=readHostHtml(),start=html.indexOf('function renderDeviceBackup(state){'),end=html.indexOf('\nfunction markStorageHealthOk',start),status=new Element(),note=new Element(),recover=new Element(),cleared=[];
  let actionsDrawn=0;
  new Function('document','storageHealthTime','schedulePwaUpdateEvaluation','NoticeCoordinator','BackupPresentation','renderBackupActions','scheduleSyncStatus',html.slice(start,end)+`;renderDeviceBackup({busy:true,foregroundKind:'restore-version',cancellable:false,connected:true,hasNote:true});`)({getElementById:id=>({'device-backup-status':status,'device-backup-note':note}[id]||null)},()=>'',()=>{}, {resolveEvent:(...args)=>cleared.push(args)},registry.require('backup-presentation',1).createPresentation(freeze({notifications:n})),()=>{actionsDrawn+=1;},()=>{});
  assert.equal(status.textContent,'Restoring…');assert.equal(note.hidden,true);assert.equal(cleared.length,0,'Device state cannot erase the coordinator summary during cancellation');assert.equal(actionsDrawn,1,'the shared actions follow the Device Folder row');
}
{
  // One Back up now and one Version History for every location: shown while
  // any location is connected; a running restore can still be reopened.
  const html=readHostHtml(),start=html.indexOf('function renderBackupActions(){'),end=html.indexOf('\n// Back up each enabled destination independently.',start);
  const draw=states=>{
    const nodes=new Map(['backup-shared-actions','backup-now','open-version-history'].map(id=>[id,new Element()]));for(const node of nodes.values())node.hidden=false;
    new Function('document','BackupProviderRuntime',html.slice(start,end)+'\n;renderBackupActions();')({getElementById:id=>nodes.get(id)||null},{locationStatus:id=>states[id]||null});
    return {group:nodes.get('backup-shared-actions').hidden,backupNow:nodes.get('backup-now').disabled,versions:nodes.get('open-version-history').disabled};
  };
  const off={connected:false},on={connected:true,busy:false};
  assert.deepEqual(draw({'device-folder':off,'google-drive':off}).group,true,'nothing to back up or restore while no location is connected');
  assert.deepEqual(draw({'device-folder':off,'google-drive':on}),{group:false,backupNow:false,versions:false},'Drive alone shows both');
  assert.deepEqual(draw({'device-folder':{...on,busy:true,foregroundKind:'restore-version'},'google-drive':on}),{group:false,backupNow:true,versions:false},'a running restore can be reopened, and nothing else starts');
  assert.deepEqual(draw({'device-folder':{...on,busy:true,foregroundKind:'backup'},'google-drive':on}),{group:false,backupNow:true,versions:true});
}
{
  // The portable-file row is drawn by the app too: Export and Cancel follow the
  // backup controller and the file processor; Version History's Cancel follows an import.
  const html=readHostHtml(),start=html.indexOf('let fileBackupRowReady=false;'),end=html.indexOf("// Each location row opens its settings in place",start);
  const ids=['download-backup','cancel-standalone-import','cancel-backup-import','backup-file-status'];
  const draw=({exporting=false,fileBusy=false,importing=false,event=null}={})=>{
    const nodes=new Map(ids.map(id=>[id,new Element()]));
    new Function('document','BackupController','Exports','BackupPresentation',html.slice(start,end)+';fileBackupRowReady=true;renderFileBackup();')(
      {getElementById:id=>nodes.get(id)||null},{status:()=>({standaloneExportActive:exporting,importActive:importing,importHoldsBackground:importing})},{status:()=>({fileBusy})},
      {current:()=>event,summary:value=>value?.message||''});
    return id=>nodes.get(id);
  };
  let row=draw();assert.equal(row('download-backup').textContent,'Export backup…');assert.equal(row('download-backup').disabled,false);assert.equal(row('cancel-standalone-import').hidden,true);assert.equal(row('backup-file-status').hidden,true);
  row=draw({exporting:true,event:{message:'Saving backup…'}});assert.equal(row('download-backup').textContent,'Preparing backup…');assert.equal(row('download-backup').disabled,true);assert.equal(row('cancel-standalone-import').hidden,false);assert.equal(row('backup-file-status').textContent,'Saving backup…');
  row=draw({fileBusy:true});assert.equal(row('cancel-standalone-import').hidden,false,'a running file job can be cancelled');
  row=draw({importing:true});assert.equal(row('cancel-backup-import').hidden,false,'an import can be cancelled from Version History');
}
{
  // Google Drive's row is drawn by the app from engine status, with the same
  // parts as the Device Folder row.
  const html=readHostHtml(),start=html.indexOf('function renderDriveBackup(){'),end=html.indexOf('\nfunction renderDeviceBackup(',start);
  const ids=['backup-provider-row-status-google-drive','connect-drive-backup','cancel-drive-backup','drive-backup-settings','drive-backup-settings-panel','drive-backup-settings-last','disconnect-drive-backup'];
  const draw=(state,verifiedAt='')=>{
    const nodes=new Map(ids.map(id=>[id,new Element()]));nodes.get('drive-backup-settings-panel').hidden=false;
    new Function('document','BackupProviderRuntime','BackupPresentation','verifiedRecoveryState','storageHealthTime','renderProfile','FirstStart',html.slice(start,end)+';renderDriveBackup();')(
      {getElementById:id=>nodes.get(id)||null},{locationStatus:()=>state},{locationLabel:(_id,value)=>value.connected?'On':value.wasConnected?'Signed out':'Off'},
      {providers:verifiedAt?{'google-drive':{at:verifiedAt}}:{}},()=>'09:30',()=>{profileDraws++;},{isOpen:()=>false,render(){}});
    const view=id=>nodes.get(id);return {shown:ids.slice(1,4).filter(id=>!view(id).hidden),view};
  };
  const base={connected:false,wasConnected:false,engineBusy:false,busy:false,backingUp:false,cancellable:false,foregroundKind:''};
  let profileDraws=0;
  let row=draw(base);assert.equal(profileDraws,1,'the profile panel follows the Drive row');assert.deepEqual(row.shown,['connect-drive-backup']);assert.equal(row.view('connect-drive-backup').textContent,'Connect');
  row=draw({...base,wasConnected:true});assert.deepEqual(row.shown,['connect-drive-backup'],'a lapsed sign-in leaves one Reconnect button');assert.equal(row.view('connect-drive-backup').textContent,'Reconnect');assert.equal(row.view('drive-backup-settings-panel').hidden,true,'settings close when Drive is not connected');
  row=draw({...base,connected:true,wasConnected:true},'2026-10-10T09:30:00.000Z');assert.deepEqual(row.shown,['drive-backup-settings'],'Back up now and Version History are shared by both locations');assert.equal(row.view('drive-backup-settings-last').textContent,'Last backup 09:30');
  row=draw({...base,connected:true,wasConnected:true,engineBusy:true,busy:true,cancellable:true,foregroundKind:'backup'});assert.deepEqual(row.shown,['cancel-drive-backup','drive-backup-settings'],'a running backup offers Cancel');assert.equal(row.view('disconnect-drive-backup').disabled,true);
}
{
  const {notices:n,time}=coordinator(),actions=[];
  const presentation=registry.require('backup-presentation',1).createPresentation(freeze({notifications:n,action:(source,kind)=>({label:'Show details',run:()=>actions.push({source,kind})})}));
  const old=presentation.begin('google-drive','backup',{label:'Google Drive'});
  const next=presentation.begin('google-drive','backup',{label:'Google Drive'});
  assert.equal(old.update({message:'late'}),false);assert.equal(old.finish(),false);
  next.update({message:'Writing',progress:{current:1,total:3,completedBytes:2048,totalBytes:4096}});
  assert.equal(presentation.detail(next.read()),'1 of 3 complete · 2 KB of 4 KB');
  n.dismissEvent(next.read().key,next.read().deliveryId);assert.deepEqual(actions,[]);
  next.finish({message:'External backup verified.'});assert.equal(n.eventStatus().toasts.length,1);assert.equal(next.finish(),false);assert.equal(n.eventStatus().toasts.length,1,'completion is announced once');
  assert.ok(presentation.read('google-drive','backup-verified').completedAt);
  time.tick(5000);assert.equal(n.eventStatus().toasts.length,0);assert.equal(presentation.read('google-drive').message,'External backup verified.','toast expiry retains reopenable inline state');
  presentation.condition('google-drive','permission','Reconnect to resume backup.');const permission=n.eventStatus().toasts[0];n.dismissEvent(permission.key,permission.deliveryId);presentation.condition('google-drive','permission','Reconnect to resume backup.');assert.equal(n.eventStatus().toasts.length,0,'condition updates do not undo dismissal');
  presentation.condition('google-drive','permission','');presentation.condition('google-drive','permission','Reconnect to resume backup.');assert.equal(n.eventStatus().toasts.length,1,'resolved permission failures can recur');presentation.condition('google-drive','permission','');
  const recovery=presentation.begin('device-folder','restore-version',{label:'Device Folder'});recovery.finish({message:presentation.outcome('restore-version','Device Folder',{status:'pending'})});
  const automatic=presentation.begin('device-folder','backup',{id:'external-backup',label:'Device Folder',foreground:false});automatic.finish({message:'External backup verified.'});
  assert.match(presentation.read('device-folder').message,/restored locally.*backs it up next/);assert.equal(n.eventStatus().toasts.length,1,'automatic success does not add a confirmation');
  const cancel=presentation.begin('file','import',{label:'File backup'});cancel.finish({message:'Cancelled safely.',lifecycle:'cancelled'});assert.equal(cancel.update({message:'late'}),false);assert.equal(n.eventStatus().toasts.filter(row=>row.source==='file').length,0);
  presentation.reset('google-drive');assert.equal(presentation.read('google-drive'),null);assert.equal(presentation.read('google-drive','backup-verified'),null,'disconnect clears stale source summaries');
  n.clear();assert.equal(time.count(),0);
}
// Reused caller operation IDs must not give stale handles access to replacement state.
{
  const {notices:n,time}=coordinator(),port=n.presentation('plan');
  const first=port.begin({id:'save',operationId:'caller-id',surfaceId:'status'});
  const second=port.begin({id:'save',operationId:'caller-id',surfaceId:'status'});
  assert.equal(first.read(),null);assert.equal(first.finish('failed','Late failure'),false);
  second.finish('succeeded','Saved');assert.equal(second.read().message,'Saved');n.clear();
  const node=new Element();node.id='status';const nodes=[node];
  const html=readHostHtml(),start=html.indexOf('function renderNotificationSurfaces(state){'),end=html.indexOf('const BackupPresentation=',start);
  new Function('NoticeCoordinator','document',html.slice(start,end))(n,{getElementById:id=>id==='status'?node:null,querySelectorAll:()=>nodes.filter(node=>node.dataset.notificationKey)});
  port.feedback({id:'hint',surfaceId:'status',surface:'inline',message:'First hint'});
  const operation=port.begin({id:'work',surfaceId:'status',announce:false});operation.finish('succeeded','Completed');
  port.feedback({id:'hint',surfaceId:'status',surface:'inline',message:'Latest hint',retainInline:false,duration:2000});
  assert.equal(node.textContent,'Latest hint','new feedback wins even when its identity predates an operation');
  time.tick(2100);assert.equal(node.textContent,'','expiry must not resurrect superseded inline messages');
  n.clear();assert.equal(time.count(),0);
}
// Exercise the actual file picker handler: AbortError is neutral; recovery clears the condition.
{
  const {notices:n}=coordinator(),presentation=registry.require('backup-presentation',1).createPresentation(freeze({notifications:n}));
  const html=readHostHtml(),start=html.indexOf("  'pick-import-file': async()=>{"),end=html.indexOf("  'test-sound':",start);
  let failure=Object.assign(new Error('Cancelled'),{name:'AbortError'}),imports=0;
  const handler=new Function('Exports','document','BackupController','NoticeCoordinator','BackupPresentation','return ({'+html.slice(start,end)+'})["pick-import-file"];')({open:async()=>{if(failure)throw failure;return new Blob(['backup']);}},{getElementById:()=>({})},{importLocal:async()=>imports++},n,presentation);
  await handler();assert.equal(n.eventStatus().events.length,0);
  failure=new Error('Access denied');await handler();assert.equal(n.readEvent('file','file-open').lifecycle,'failed');
  failure=null;await handler();assert.equal(imports,1);assert.equal(n.readEvent('file','file-open'),null);n.clear();
}
{
  const {notices:n}=coordinator(),verified={at:'2026-10-01T06:44:00.000Z'};
  const presentation=registry.require('backup-presentation',1).createPresentation(freeze({notifications:n,timeLabel:()=> '06:44',verified:()=>verified}));
  assert.equal(presentation.locationLabel('device-folder',{connected:true,lastBackupAt:verified.at}),presentation.locationLabel('google-drive',{connected:true}));
  assert.equal(presentation.locationLabel('google-drive',{connected:true}),'On · Last backup 06:44','resting state uses the same compact timestamp and retained verification metadata');
  for(const source of ['device-folder','google-drive'])for(const [kind,label] of [['backup','Backing up…'],['history','Reading backups…'],['restore-version','Restoring…'],['bring-in','Combining…']])assert.equal(presentation.locationLabel(source,{connected:true,busy:true,foregroundKind:kind}),label);
  assert.equal(presentation.locationLabel('google-drive',{wasConnected:true}),'Signed out');
  for(const source of ['device-folder','google-drive'])assert.equal(presentation.locationLabel(source,{connected:true,locked:true}),'Needs password','with encryption locked, a row never claims automatic backups are on');
  assert.equal(presentation.locationLabel('device-folder',{mode:'permission'}),'Permission needed');
  // A row reads "Backing up…" while an external backup runs (the engine reports
  // it as backingUp) and returns to its resting label when it finishes.
  const external=presentation.begin('google-drive','backup',{id:'external-backup',foreground:false});
  assert.equal(presentation.locationLabel('google-drive',{connected:true,backingUp:external.read().lifecycle==='running'}),'Backing up…');
  external.finish({message:'External backup verified in Google Drive.'});
  assert.equal(presentation.locationLabel('google-drive',{connected:true,backingUp:external.read().lifecycle==='running'}),'On · Last backup 06:44');
  assert.equal(presentation.summary(external.read()),'✓ External backup verified in Google Drive.');
  assert.equal(presentation.summary({...external.read(),message:'✓ External backup verified in Google Drive.'}),'✓ External backup verified in Google Drive.','success marks cannot duplicate');
  assert.equal(presentation.summary({...external.read(),lifecycle:'cancelled',severity:'info',message:'Cancelled.'}),'Cancelled.');
  assert.equal(presentation.summary({...external.read(),lifecycle:'failed',severity:'error',message:'Failed.'}),'Failed.');
  const restored=presentation.begin('device-folder','restore-version');restored.finish({message:presentation.outcome('restore-version','Device Folder',{status:'pending'})});
  assert.match(presentation.summary(restored.read()),/^✓ Backup restored locally and verified\. Device Folder backs it up next\.$/u,'success mark refers to completed local recovery, not pending external convergence');
  // Drive carries a restore to the other devices; other locations say whether they hold it.
  assert.equal(presentation.outcome('restore-version','Google Drive',{source:{status:'pending',shared:true},others:[{label:'Device Folder',status:'pending'}]}),'Backup restored locally and verified. Device Folder backs it up next. Your other devices get it at their next sync.');
  assert.equal(presentation.outcome('restore-version','Device Folder',{source:{status:'completed'},others:[{label:'Google Drive',status:'failed',shared:true}]}),'Backup restored locally and verified. Device Folder already holds it. Google Drive backup needs attention.');
  assert.equal(presentation.reach(),'','no reach line without a syncing location');
  n.clear();
}
// A condition that only a decision can clear stays on screen until it is resolved.
{
  const {notices:n,time}=coordinator();let restored=0,continued=0;
  n.emit({source:'storage-reset',id:'detected',severity:'warning',lifecycle:'succeeded',surface:'toast',persistent:true,dismissible:false,title:'Browser data was cleared',action:{label:'Restore from backup',run:()=>{restored++;}},secondaryAction:{label:'Continue with current data',run:()=>{continued++;}}});
  const row=n.eventStatus().toasts[0];assert.equal(row.dismissible,false);
  assert.equal(n.dismissEvent(row.key,row.deliveryId),false,'a decision notice ignores dismissal');time.tick(60000);
  assert.deepEqual(n.eventStatus().toasts.map(item=>item.id),['detected'],'a decision notice never expires');
  row.action.run();row.secondaryAction.run();assert.deepEqual([restored,continued],[1,1],'both choices stay available');
  assert.throws(()=>n.emit({source:'storage-reset',id:'bad',surface:'toast',title:'x',action:{label:'Go',run:()=>{}},secondaryAction:{label:'',run:()=>{}}}),/secondary action is invalid/);
  n.emit({source:'plain',id:'single',surface:'toast',title:'Only primary',secondaryAction:{label:'Ignored',run:()=>{}}});
  assert.equal(n.eventStatus().toasts.find(item=>item.id==='single').secondaryAction,null,'a second choice needs a primary action');n.resolveEvent('plain','single');
  n.resolveEvent('storage-reset','detected');assert.equal(n.eventStatus().toasts.length,0,'only resolution clears it');
  n.emit({source:'plain',id:'ordinary',severity:'warning',surface:'toast',persistent:true,dismissible:false,title:'No action'});
  const plain=n.eventStatus().toasts[0];assert.equal(plain.dismissible,true,'without an action a notice stays dismissible');assert.equal(n.dismissEvent(plain.key,plain.deliveryId),true);
}
{
  // While the study timer runs, pop-ups that block nothing wait, untimed, and
  // show when it stops; blocking ones and the person's own results show at once.
  const {notices:n,time}=coordinator(),presentation=registry.require('backup-presentation',1).createPresentation(freeze({notifications:n}));
  const ids=()=>n.eventStatus().toasts.map(row=>row.id).sort();
  n.setStudying(true);
  presentation.notice('google-drive','sync-review','Google Drive has changes from another device that need your review.',{tier:'news'});
  n.notify({source:'sync',key:'kept-new',kind:'warning',tier:'news',title:'Kept for review',message:'One version was kept.'});
  presentation.notice('google-drive','retry-exhausted','Syncing with Google Drive keeps failing.',{error:true});
  presentation.notice('google-drive','permission','Google Drive sign-in expired.');
  n.notify({key:'saved',kind:'success',title:'Saved'});
  assert.deepEqual(ids(),['permission','retry-exhausted','saved'],'blocking pop-ups and the person’s own results show while studying');
  assert.equal(n.eventStatus().toasts.find(row=>row.id==='retry-exhausted').severity,'error','retries that ran out are red');
  assert.equal(n.eventStatus().toasts.find(row=>row.id==='permission').severity,'warning','a sign-in that ended is amber');
  time.tick(60000);assert.deepEqual(ids(),['permission','retry-exhausted'],'results fade; blocking pop-ups stay until closed or resolved');
  for(const row of n.eventStatus().toasts)n.dismissEvent(row.key,row.deliveryId);assert.deepEqual(ids(),[]);
  n.resolveEvent('sync','kept-new');n.setStudying(false);
  assert.deepEqual(ids(),['sync-review'],'held pop-ups show when the timer stops; one resolved meanwhile never shows');
  time.tick(11000);assert.deepEqual(ids(),['sync-review'],'and keep their full time');time.tick(1001);assert.deepEqual(ids(),[]);
  n.notify({source:'sync',key:'kept-new',kind:'warning',tier:'news',title:'Kept for review',message:'Two versions were kept.'});
  time.tick(4000);n.setStudying(true);assert.deepEqual(ids(),[],'a pop-up on screen steps aside when the timer starts');
  time.tick(60000);n.setStudying(false);time.tick(7999);assert.deepEqual(ids(),['kept-new'],'and comes back with the time it had left');time.tick(1);assert.deepEqual(ids(),[]);
  n.clear();
}
{
  // Kinds decide how long a pop-up stays, where it sits and what it sounds
  // like (docs/areas/notifications.md, kinds).
  const {notices:n,time}=coordinator(),played=[],system=[];
  n.configureDelivery({audio:{play:name=>{played.push(name);return Promise.resolve(true);},stop:()=>{},status:()=>'ready'},system:event=>{system.push(event.id);return true;},context:()=>({owner:true,foreground:true})});
  const ids=()=>n.eventStatus().toasts.map(row=>row.id),toast=id=>n.eventStatus().toasts.find(row=>row.id===id);
  n.notify({key:'r1',kind:'success',title:'Saved'});
  n.emit({source:'bg',id:'n1',severity:'info',foreground:false,surface:'toast',title:'Synced elsewhere'});
  n.emit({source:'bg',id:'b1',severity:'warning',foreground:false,surface:'toast',title:'Sign in again'});
  n.emit({source:'bg',id:'c1',severity:'warning',foreground:false,surface:'toast',tier:'critical',title:'Browser data was cleared'});
  n.notify({key:'r2',kind:'info',title:'Copied'});
  assert.deepEqual(['r1','n1','b1','c1','r2'].map(id=>toast(id).tier),['result','news','blocking','critical','result'],'kinds default from foreground and severity');
  assert.deepEqual(ids(),['c1','b1','r2','n1','r1'],'critical, then blocking, pinned; then newest first');
  assert.deepEqual(['r1','n1','b1','c1'].map(id=>toast(id).duration),[4200,12000,0,0],'results 4.2 s, news 12 s, blocking and critical stay');
  assert.equal(toast('c1').dismissible,false,'a critical pop-up cannot be closed');assert.equal(n.dismissEvent(toast('c1').key,toast('c1').deliveryId),false);
  assert.throws(()=>n.emit({source:'bg',id:'bad',tier:'urgent'}),/tier/);
  n.notify({key:'r1',kind:'success',title:'Saved',message:'Again'});assert.deepEqual(ids(),['c1','b1','r2','n1','r1'],'an update keeps its place');
  // Sounds: knock for amber blocking, Attention for critical, a chime for news.
  assert.deepEqual(played,['chime','knock','attention'],'news chimes, blocking knocks, critical sounds Attention');
  n.emit({source:'bg',id:'b1',severity:'warning',foreground:false,surface:'toast',title:'Sign in again',message:'Still signed out.'});
  assert.equal(played.length,3,'a blocking pop-up sounds once per occurrence');
  n.emit({source:'bg',id:'b2',severity:'error',foreground:false,surface:'toast',title:'Sync stopped'});assert.equal(played.at(-1),'attention','red blocking sounds Attention');
  n.emit({source:'bg',id:'n2',severity:'info',foreground:false,surface:'toast',title:'More news'});assert.equal(played.at(-1),'attention','a second chime within 4 s is skipped');
  time.tick(4000);n.emit({source:'bg',id:'n3',severity:'success',foreground:false,surface:'toast',title:'Later news'});assert.equal(played.at(-1),'chime');
  // Closing everything leaves only what cannot be closed; clocks stop while the stack is open.
  assert.ok(n.dismissAll()>=5);assert.deepEqual(ids(),['c1'],'Clear all keeps the critical pop-up');
  n.notify({key:'held',title:'Held'});n.setPaused('expanded',true);time.tick(60000);assert.ok(ids().includes('held'),'an expanded stack stops every clock');
  n.setPaused('expanded',false);time.tick(4200);assert.ok(!ids().includes('held'));
  // A blocking pop-up closed by hand comes back, with its sound, only if raised again.
  const count=played.length;n.notify({source:'bg',key:'block',kind:'warning',tier:'blocking',title:'Needs password'});assert.equal(played.length,count+1);
  n.dismissEvent(toast('block').key,toast('block').deliveryId);n.notify({source:'bg',key:'block',kind:'warning',tier:'blocking',title:'Needs password'});
  assert.ok(ids().includes('block'));assert.equal(played.at(-1),'knock');assert.equal(played.length,count+2);
  // Minimal plays the knock but not the chime; news waits, and chimes, after a work block.
  n.setSoundMode('minimal');time.tick(5000);n.emit({source:'bg',id:'n4',foreground:false,surface:'toast',title:'Minimal news'});assert.equal(played.length,count+2);
  n.setSoundMode('full');n.setStudying(true);time.tick(5000);n.emit({source:'bg',id:'n5',foreground:false,surface:'toast',title:'Held news'});assert.equal(played.length,count+2,'held news does not chime');
  n.setStudying(false);assert.equal(played.at(-1),'chime','it chimes when it shows');
  // No hidden queue: at most 32, the oldest that would fade go first.
  n.clear();for(let i=0;i<40;i++)n.notify({key:`many-${i}`,title:`Many ${i}`});
  assert.equal(ids().length,32);assert.equal(ids()[0],'many-39');assert.ok(!ids().includes('many-7')&&ids().includes('many-8'));
  // Explicit cues and device notifications: a session moving away notifies the device while hidden.
  n.clear();n.setHidden(true);n.notify({source:'session',key:'session-yield',tier:'news',cue:'session-moved',system:true,title:'Session continued on another device'});
  assert.deepEqual(system,['session-yield'],'in the background the device is notified instead');n.setHidden(false);
  n.clear();
}
{
  // Banners: unsaved work sounds Attention, storage the softer knock; once per
  // new line, again only after the banner clears and returns.
  const {notices:n,time}=coordinator(),played=[];
  n.configureDelivery({audio:{play:name=>{played.push(name);return Promise.resolve(true);},stop:()=>{},status:()=>'ready'},context:()=>({owner:true,foreground:true})});
  // Each step waits out the sound before it, which a lesser sound never cuts off.
  n.publish('safety',{kind:'safety',title:'Unsaved work needs attention',message:'Today’s session could not be saved.'});
  n.publish('safety',{kind:'safety',title:'Unsaved work needs attention',message:'Today’s session could not be saved.'});
  assert.deepEqual(played,['attention']);
  time.tick(4000);n.publish('safety',{visible:false});n.publish('storage',{kind:'storage',title:'Storage or recovery notice',message:'Backup reminder: over a week.'});
  assert.deepEqual(played,['attention','knock']);
  time.tick(4000);n.acknowledge('storage');n.publish('storage',{kind:'storage',title:'Storage or recovery notice',message:'Backup reminder: over a week.\nStorage is almost full.'});
  assert.equal(played.length,3,'a new line sounds again');
  n.publish('storage',{kind:'storage',title:'Storage or recovery notice',message:'Storage is almost full.'});assert.equal(played.length,3,'a line going away is silent');
  time.tick(4000);n.publish('storage',{visible:false});n.publish('storage',{kind:'storage',title:'Storage or recovery notice',message:'Storage is almost full.'});assert.equal(played.length,4,'it sounds again after it cleared');
  n.publish('update',{kind:'update',title:'Update ready',message:'A new version is ready.'});assert.equal(played.length,4,'other banners are silent');
  const recent=n.recent().entries;assert.deepEqual(recent.map(entry=>[entry.source,entry.title,entry.outcome]),[['banner','Storage or recovery notice','open'],['banner','Storage or recovery notice','resolved'],['banner','Unsaved work needs attention','resolved']],'banners enter Recent');
  n.clearRecent();n.publish('storage',{kind:'storage',title:'Storage or recovery notice',message:'Storage is almost full.\nStill full.'});
  assert.equal(n.recent().entries.length,0,'a banner still showing stays out of Recent after Clear');
}
{
  // Recent: today's pop-ups and banners, newest first, at most 20; news that
  // faded untouched counts as unseen until Recent is opened.
  const {notices:n,time}=coordinator(),seen=[];let ran=0;
  const day=new Date(2026,10,2,9,0).getTime();time.tick(day);
  n.subscribeRecent(state=>seen.push(state));
  n.notify({key:'saved',kind:'success',title:'Saved'});
  n.emit({source:'sync',id:'kept',severity:'warning',foreground:false,surface:'toast',tier:'news',title:'Kept for review',action:{label:'Review',run:()=>{ran++;}}});
  let state=n.recent();assert.deepEqual(state.entries.map(entry=>entry.title),['Kept for review','Saved']);assert.equal(state.entries[0].actionLabel,'Review','a live pop-up offers its button');assert.equal(state.unseen,0);
  time.tick(12000);state=n.recent();assert.equal(state.unseen,1,'news that faded untouched is unseen');assert.equal(state.entries[1].outcome,'expired');
  assert.equal(n.runRecentAction(state.entries[0].id),true);assert.equal(ran,1,'Recent runs the pop-up’s own action');
  assert.equal(n.markRecentSeen().unseen,0);
  n.notify({key:'hovered',tier:'news',title:'Hovered'});const hovered=n.eventStatus().toasts.find(row=>row.id==='hovered');n.pauseEvent(hovered.key,hovered.deliveryId,'hover',true);n.pauseEvent(hovered.key,hovered.deliveryId,'hover',false);
  time.tick(12000);assert.equal(n.recent().unseen,0,'a hovered pop-up counts as seen');
  n.notify({key:'closed',tier:'news',title:'Closed'});const closed=n.eventStatus().toasts.find(row=>row.id==='closed');n.dismissEvent(closed.key,closed.deliveryId);
  assert.equal(n.recent().entries[0].outcome,'dismissed');assert.equal(n.recent().unseen,0);
  for(let i=0;i<25;i++)n.notify({key:`r-${i}`,title:`Result ${i}`});assert.equal(n.recent().entries.length,20);assert.equal(n.recent().entries[0].title,'Result 24');
  assert.deepEqual(n.recent().entries.slice(0,3).map(entry=>entry.title),['Result 24','Result 23','Result 22'],'pop-ups still on screen do not come back after being trimmed');
  const running=n.begin({source:'drive',id:'upload',title:'Uploading',announce:true,surface:'inline'});
  assert.ok(!n.recent().entries.some(entry=>entry.title==='Uploading'),'running work enters Recent only with its result');
  running.update({lifecycle:'succeeded',severity:'success',message:'Uploaded'});assert.equal(n.recent().entries[0].title,'Uploading');
  // Kept across a reload: today's entries come back as text; other days, other shapes and duplicates are dropped.
  const saved=n.recent().entries.map(({id,source,tier,severity,title,message,at,outcome,seen})=>({id,source,tier,severity,title,message,at,outcome,seen}));
  const {notices:fresh,time:clock}=coordinator();clock.tick(day+60000);
  const restored=fresh.restoreRecent([...saved.slice(0,3),{...saved[3],at:day-24*3600000},{...saved[4],tier:'loud'},saved[0]]);
  assert.equal(restored.entries.length,3);assert.ok(restored.entries.every(entry=>!entry.actionLabel&&entry.id.startsWith('restored:')));
  assert.equal(fresh.clearRecent().entries.length,0);
  n.clearRecent();n.notify({key:'r-24',title:'Result 24',message:'Updated'});assert.equal(n.recent().entries.length,0,'or after Clear');
  // Entries from yesterday drop off at midnight.
  time.tick(24*3600000);assert.equal(n.recent().entries.length,0);
  assert.ok(seen.length>3,'listeners hear each change');
}
// A button that only opens something marks its card (and its Recent row) as
// opening from anywhere; other buttons, and absent flags, do not.
{
  const {notices:n}=coordinator();let ran=0;
  n.notify({source:'sync',key:'opens',tier:'news',title:'Needs review',action:{label:'Review',opens:true,run:()=>ran++}});
  n.notify({key:'undo',kind:'success',title:'Moved',action:{label:'Undo',run:()=>ran++}});
  n.notify({key:'yes-ish',kind:'success',title:'Odd',action:{label:'Open',opens:'yes',run:()=>ran++}});
  const actions=Object.fromEntries(n.eventStatus().events.map(event=>[event.title,event.action.opens]));
  assert.deepEqual(actions,{'Needs review':true,Moved:false,Odd:false},'only opens:true counts');
  const rows=Object.fromEntries(n.recent().entries.map(entry=>[entry.title,entry.actionOpens]));
  assert.deepEqual(rows,{'Needs review':true,Moved:false,Odd:false});
  const id=n.recent().entries.find(entry=>entry.title==='Needs review').id;
  n.runRecentAction(id);assert.equal(ran,1);
  assert.equal(n.eventStatus().events.find(event=>event.title==='Needs review').dismissed,true,'the pop-up closes');
  assert.equal(n.recent().entries.find(entry=>entry.id===id).actionOpens,true,'while the review still waits, its row still opens it');
  n.resolveEvent('sync','opens');
  assert.equal(n.recent().entries.find(entry=>entry.id===id).actionOpens,false,'once resolved, the row opens nothing');
  n.clear();
}
console.log(JSON.stringify({status:'PASS',suite:'notification-lifecycle',checks:['priority and persistent errors','decision notices persist until resolved','deduplication','hover/focus/hidden expiry','dismissal versus cancellation','recurring notices','stale operation handles','terminal fencing','renderer severity','Device and Drive summaries','study-timer hold','kinds, order and sounds','no hidden queue','banner sounds','recent and unseen','opening cards']},null,2));
