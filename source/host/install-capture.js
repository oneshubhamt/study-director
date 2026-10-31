
(()=>{
  const key=Symbol.for('studyDirector.installCapture.v1');
  if(window[key])return;
  let prompt=null,installed=false;
  const listeners=new Set();
  const notify=event=>listeners.forEach(listener=>{try{listener(event);}catch(error){}});
  const bridge=Object.freeze({
    status:()=>Object.freeze({prompt,installed}),
    subscribe:listener=>{if(typeof listener!=='function')return false;listeners.add(listener);return true;}
  });
  Object.defineProperty(window,key,{value:bridge,configurable:false,writable:false});
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();prompt=event;notify(Object.freeze({type:'prompt',prompt:event}));
  });
  window.addEventListener('appinstalled',()=>{
    prompt=null;installed=true;notify(Object.freeze({type:'installed'}));
  });
})();
