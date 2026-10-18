import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const name of ['internal','notice-coordinator','backup-presentation','interactions'])vm.runInThisContext(fs.readFileSync(`source/core/${name}.js`,'utf8'),{filename:`source/core/${name}.js`});
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
  assert.equal(n.eventStatus().toasts.length,4);assert.equal(n.eventStatus().toasts[0].id,'failure');
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
  const {notices:n,time}=coordinator(),region=new Element(),document=new Element('document'),errors=[];
  document.getElementById=id=>id==='sd-toast-region'?region:null;document.createElement=tag=>new Element(tag);document.hidden=false;
  const controller=registry.require('interactions',1).createController(freeze({ports:freeze({
    environment:freeze({document,window:{},nativeConfirm:()=>false,nativePrompt:()=>null,requestAnimationFrame:fn=>fn(),setTimeout:time.setTimeout,clearTimeout:time.clearTimeout}),
    history:freeze({opened:()=>{},closed:()=>{},requestClose:()=>false}),diagnostics:freeze({capture:(scope,error)=>errors.push({scope,error})}),
    notifications:freeze({notify:n.notify,subscribe:n.subscribe,dismissEvent:n.dismissEvent,pauseEvent:n.pauseEvent,setHidden:n.setHidden})
  })}));
  controller.notify({key:'saved',title:'Saved',duration:4000});const toast=region.children[0];time.tick(1000);toast.dispatch('mouseenter');time.tick(10000);assert.equal(n.eventStatus().toasts.length,1);
  toast.dispatch('focusin');toast.dispatch('mouseleave');time.tick(10000);assert.equal(n.eventStatus().toasts.length,1,'keyboard focus retains a paused toast');
  toast.dispatch('focusout',{relatedTarget:null});time.tick(2000);document.hidden=true;document.dispatch('visibilitychange');time.tick(10000);assert.equal(n.eventStatus().toasts.length,1);
  document.hidden=false;document.dispatch('visibilitychange');time.tick(1001);assert.equal(n.eventStatus().toasts.length,0);time.tick(1000);assert.equal(region.children.length,0,'dismissed DOM and exit timer are cleaned up');
  // Exercise the actual attachment error call site, rather than inferring severity from wording.
  const source=fs.readFileSync('source/core/attachments.js','utf8'),start=source.indexOf('    function reportError('),end=source.indexOf('\n    async function operation',start);
  new Function('notifications',source.slice(start,end)+';reportError(new Error("Disk full"));')(n.presentation('attachments')); 
  const failure=region.children[0];assert.ok(failure.classList.contains('error'));assert.equal(failure.attributes.role,'alert');
  failure.children[1].dispatch('click');time.tick(1000);assert.equal(region.children.length,0);
  assert.deepEqual(errors,[]);n.clear();assert.equal(time.count(),0);
}
{
  const {notices:n}=coordinator(),nodes=new Map(['device-folder','google-drive'].map(source=>[`backup-operation-note-${source}`,new Element()]));
  const presentation=registry.require('backup-presentation',1).createPresentation(freeze({notifications:n}));
  const html=fs.readFileSync('source/app.html','utf8'),a=html.indexOf('BackupPresentation.subscribe(()=>{'),b=html.indexOf('const REPOSITORY_MAINTENANCE_FORMAT',a);
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
  const html=fs.readFileSync('source/app.html','utf8'),a=html.indexOf('function renderCoordinatedNotice(state){'),b=html.indexOf('function noticeCanCompact',a);
  const announcer=new Element(),render=new Function('document',html.slice(a,b)+';return renderCoordinatedNotice;')({getElementById:id=>id==='install-notice-announcer'?announcer:null});
  render({active:{kind:'safety'},announcement:'Local save failed'});assert.equal(announcer.textContent,'Local save failed');render({active:null,announcement:''});assert.equal(announcer.textContent,'','the DOM live region must clear between identical recurrences');render({active:{kind:'safety'},announcement:'Local save failed'});assert.equal(announcer.textContent,'Local save failed');
}
{
  const {notices:n}=coordinator(),presentation=registry.require('backup-presentation',1).createPresentation(freeze({notifications:n}));
  const source=fs.readFileSync('source/core/backup.js','utf8'),a=source.indexOf('async function exportPortableBackup(){'),b=source.indexOf('function exportLocalBackup(){',a);
  let error=new Error('Disk full');
  const run=new Function('OperationDiagnostics','notifyStatus','createCheckpoint','presentation','Exports','portableBackupFilename','getStudentNameFromDisplay','exportReporter','portableCopy','markBackupCompleted',`const portableAssets=true;let localExportPromise=null,portablePresentation=null;const setLocalExportStatus=(message,ok)=>portablePresentation.update({message,severity:ok?'info':'error'}),finishPortablePresentation=patch=>portablePresentation.finish(patch);${source.slice(a,b)};return exportPortableBackup;`)({start:()=>'',mark:()=>{},finish:()=>{},fail:()=>{}},()=>{},async()=>{throw error;},presentation,{chooseSave:()=>Promise.resolve(null)},()=>'student-study-director-backup.sdbackup',()=>'Student',()=>({stage(){},progress(){}}),()=>({}),()=>{});
  assert.equal((await run()).status,'failed');assert.equal(n.eventStatus().toasts.at(-1).severity,'error');assert.equal(presentation.read('file').lifecycle,'failed');
  error=Object.assign(new Error('Cancelled'),{name:'AbortError'});assert.equal((await run()).status,'cancelled');assert.equal(n.eventStatus().toasts.length,0);assert.equal(presentation.read('file').lifecycle,'cancelled','user cancellation is neutral feedback');n.clear();

}
{
  const {notices:n}=coordinator();for(let i=0;i<200;i++)n.emit({source:'maintenance',id:`quiet-${i}`,foreground:false,lifecycle:'succeeded',message:'Done'});
  assert.ok(n.eventStatus().events.length<=64,'quiet background results also have bounded retention');n.clear();
  const html=fs.readFileSync('source/app.html','utf8'),start=html.indexOf('function renderDeviceBackup(state){'),end=html.indexOf('\nfunction markStorageHealthOk',start),status=new Element(),note=new Element(),recover=new Element(),cleared=[];
  new Function('document','storageHealthTime','schedulePwaUpdateEvaluation','NoticeCoordinator','BackupPresentation',html.slice(start,end)+`;renderDeviceBackup({busy:true,foregroundKind:'restore-version',cancellable:false,connected:true,hasNote:true});`)({getElementById:id=>({'device-backup-status':status,'device-backup-note':note,'recover-device-backup':recover}[id]||null)},()=>'',()=>{}, {resolveEvent:(...args)=>cleared.push(args)},registry.require('backup-presentation',1).createPresentation(freeze({notifications:n})));
  assert.equal(status.textContent,'Restoring…');assert.equal(recover.disabled,false,'a cancelling recovery remains reopenable');assert.equal(note.hidden,true);assert.equal(cleared.length,0,'Device state cannot erase the coordinator summary during cancellation');
}
{
  // The portable-file row is drawn by the app too: Export and Cancel follow the
  // backup controller and the file processor; Version History's Cancel follows an import.
  const html=fs.readFileSync('source/app.html','utf8'),start=html.indexOf('let fileBackupRowReady=false;'),end=html.indexOf("// Each location row opens its settings in place",start);
  const ids=['download-backup','cancel-standalone-import','cancel-backup-import','backup-file-status'];
  const draw=({exporting=false,fileBusy=false,importing=false,event=null}={})=>{
    const nodes=new Map(ids.map(id=>[id,new Element()]));
    new Function('document','BackupController','Exports','BackupPresentation',html.slice(start,end)+';fileBackupRowReady=true;renderFileBackup();')(
      {getElementById:id=>nodes.get(id)||null},{status:()=>({standaloneExportActive:exporting,importActive:importing})},{status:()=>({fileBusy})},
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
  const html=fs.readFileSync('source/app.html','utf8'),start=html.indexOf('function renderDriveBackup(){'),end=html.indexOf('\nfunction renderDeviceBackup(',start);
  const ids=['backup-provider-row-status-google-drive','connect-drive-backup','drive-backup-now','cancel-drive-backup','recover-drive-backup','drive-backup-settings','drive-backup-settings-panel','drive-backup-settings-last','disconnect-drive-backup'];
  const draw=(state,verifiedAt='')=>{
    const nodes=new Map(ids.map(id=>[id,new Element()]));nodes.get('drive-backup-settings-panel').hidden=false;
    new Function('document','BackupProviderRuntime','BackupPresentation','verifiedRecoveryState','storageHealthTime','renderProfile','FirstStart',html.slice(start,end)+';renderDriveBackup();')(
      {getElementById:id=>nodes.get(id)||null},{locationStatus:()=>state},{locationLabel:(_id,value)=>value.connected?'On':value.wasConnected?'Signed out':'Off'},
      {providers:verifiedAt?{'google-drive':{at:verifiedAt}}:{}},()=>'09:30',()=>{profileDraws++;},{isOpen:()=>false,render(){}});
    const view=id=>nodes.get(id);return {shown:ids.slice(1,6).filter(id=>!view(id).hidden),view};
  };
  const base={connected:false,wasConnected:false,engineBusy:false,busy:false,backingUp:false,cancellable:false,foregroundKind:''};
  let profileDraws=0;
  let row=draw(base);assert.equal(profileDraws,1,'the profile panel follows the Drive row');assert.deepEqual(row.shown,['connect-drive-backup','recover-drive-backup']);assert.equal(row.view('connect-drive-backup').textContent,'Connect');assert.equal(row.view('recover-drive-backup').textContent,'Versions');
  row=draw({...base,wasConnected:true});assert.deepEqual(row.shown,['connect-drive-backup'],'a lapsed sign-in leaves one Reconnect button');assert.equal(row.view('connect-drive-backup').textContent,'Reconnect');assert.equal(row.view('drive-backup-settings-panel').hidden,true,'settings close when Drive is not connected');
  row=draw({...base,connected:true,wasConnected:true},'2026-10-10T09:30:00.000Z');assert.deepEqual(row.shown,['drive-backup-now','recover-drive-backup','drive-backup-settings']);assert.equal(row.view('recover-drive-backup').textContent,'Versions');assert.equal(row.view('drive-backup-settings-last').textContent,'Last verified 09:30');
  row=draw({...base,connected:true,wasConnected:true,engineBusy:true,busy:true,cancellable:true,foregroundKind:'backup'});assert.deepEqual(row.shown,['cancel-drive-backup','recover-drive-backup','drive-backup-settings'],'a running backup offers Cancel in place of Back up now');assert.equal(row.view('disconnect-drive-backup').disabled,true);
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
  assert.match(presentation.read('device-folder').message,/restored locally.*pending/);assert.equal(n.eventStatus().toasts.length,1,'automatic success does not add a confirmation');
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
  const html=fs.readFileSync('source/app.html','utf8'),start=html.indexOf('function renderNotificationSurfaces(state){'),end=html.indexOf('const BackupPresentation=',start);
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
  const html=fs.readFileSync('source/app.html','utf8'),start=html.indexOf("  'pick-import-file': async()=>{"),end=html.indexOf("  'test-sound':",start);
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
  assert.equal(presentation.locationLabel('google-drive',{connected:true}),'On · Last verified 06:44','resting state uses the same compact timestamp and retained verification metadata');
  for(const source of ['device-folder','google-drive'])for(const [kind,label] of [['backup','Backing up…'],['history','Reading backups…'],['restore-version','Restoring…'],['bring-in','Combining…']])assert.equal(presentation.locationLabel(source,{connected:true,busy:true,foregroundKind:kind}),label);
  assert.equal(presentation.locationLabel('google-drive',{wasConnected:true}),'Signed out');
  for(const source of ['device-folder','google-drive'])assert.equal(presentation.locationLabel(source,{connected:true,locked:true}),'Needs password','with encryption locked, a row never claims automatic backups are on');
  assert.equal(presentation.locationLabel('device-folder',{mode:'permission'}),'Permission needed');
  // A row reads "Backing up…" while an external backup runs (the engine reports
  // it as backingUp) and returns to its resting label when it finishes.
  const external=presentation.begin('google-drive','backup',{id:'external-backup',foreground:false});
  assert.equal(presentation.locationLabel('google-drive',{connected:true,backingUp:external.read().lifecycle==='running'}),'Backing up…');
  external.finish({message:'External backup verified in Google Drive.'});
  assert.equal(presentation.locationLabel('google-drive',{connected:true,backingUp:external.read().lifecycle==='running'}),'On · Last verified 06:44');
  assert.equal(presentation.summary(external.read()),'✓ External backup verified in Google Drive.');
  assert.equal(presentation.summary({...external.read(),message:'✓ External backup verified in Google Drive.'}),'✓ External backup verified in Google Drive.','success marks cannot duplicate');
  assert.equal(presentation.summary({...external.read(),lifecycle:'cancelled',severity:'info',message:'Cancelled.'}),'Cancelled.');
  assert.equal(presentation.summary({...external.read(),lifecycle:'failed',severity:'error',message:'Failed.'}),'Failed.');
  const restored=presentation.begin('device-folder','restore-version');restored.finish({message:presentation.outcome('restore-version','Device Folder',{status:'pending'})});
  assert.match(presentation.summary(restored.read()),/^✓ Backup restored locally and verified\..*pending/,'success mark refers to completed local recovery, not pending external convergence');
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
console.log(JSON.stringify({status:'PASS',suite:'notification-lifecycle',checks:['priority and persistent errors','decision notices persist until resolved','deduplication','hover/focus/hidden expiry','dismissal versus cancellation','recurring notices','stale operation handles','terminal fencing','renderer severity','Device and Drive summaries']},null,2));
