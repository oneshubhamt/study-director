(()=>{
 interface InstallPromptChoice{readonly outcome?:string}
 interface InstallPromptEvent extends Event{prompt():PromiseLike<void>;readonly userChoice?:PromiseLike<InstallPromptChoice>}
 type InstallCaptureEvent=Readonly<{type:'prompt';prompt:InstallPromptEvent}|{type:'installed'}>;
 type InstallListener=(event:InstallCaptureEvent)=>void;
 interface InstallCaptureBridge{status():Readonly<{prompt:InstallPromptEvent|null;installed:boolean}>;subscribe(listener:InstallListener):boolean}
 const key=Symbol.for('studyDirector.installCapture.v1'),target=window as unknown as Record<PropertyKey,unknown>;
 if(target[key])return;
 let prompt:InstallPromptEvent|null=null,installed=false;
 const listeners=new Set<InstallListener>(),notify=(event:InstallCaptureEvent)=>listeners.forEach(listener=>{try{listener(event);}catch{}});
 const bridge:Readonly<InstallCaptureBridge>=Object.freeze({status:()=>Object.freeze({prompt,installed}),subscribe:(listener:InstallListener)=>{listeners.add(listener);return true;}});
 Object.defineProperty(window,key,{value:bridge,configurable:false,writable:false});
 window.addEventListener('beforeinstallprompt',event=>{const candidate=event as Event&Partial<Pick<InstallPromptEvent,'prompt'|'userChoice'>>;if(typeof candidate.prompt!=='function')return;event.preventDefault();prompt=candidate as InstallPromptEvent;notify(Object.freeze({type:'prompt',prompt}));});
 window.addEventListener('appinstalled',()=>{prompt=null;installed=true;notify(Object.freeze({type:'installed'}));});
})();
