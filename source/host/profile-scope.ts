(()=>{
  // The active profile is resolved before anything opens profile-owned storage.
  // The device registry remains unscoped; every other durable name follows this scope.
  const key=Symbol.for('studyDirector.profileScope.v1');
  const target=window as unknown as Record<PropertyKey,unknown>;
  if(target[key])return;
  const registryKey='@@SD_PROFILES_STORAGE_KEY@@',separator='@@SD_PROFILE_SCOPE_SEPARATOR@@',pattern=/^prof_[a-z0-9]{1,24}_[a-z0-9]{6,12}_[a-f0-9]{8}$/,unsafeScope='__profile-registry-unreadable__';
  let id='',scope='',safe=true;
  const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object';
  try{
    const raw=localStorage.getItem(registryKey);
    if(raw!==null){
      const parsed=JSON.parse(raw) as unknown;
      const list=record(parsed)?parsed:null;
      const valid=(entry:unknown)=>{
        if(!record(entry))return false;
        return typeof entry['id']==='string'&&pattern.test(entry['id'])&&(entry['scope']===''||(typeof entry['scope']==='string'&&pattern.test(entry['scope'])));
      };
      // A readable newer registry still identifies the current profile, but
      // later profile mutations remain blocked by Profiles.unsupported().
      const version=Number(list?.['version']);
      const profiles=list&&Number.isInteger(version)&&version>=1&&Array.isArray(list['profiles'])?(list['profiles'].filter(valid) as Record<string,unknown>[]):[];
      const activeId=typeof list?.['active']==='string'?list['active']:'';
      const selected=profiles.find(entry=>entry['id']===activeId);
      const active=version===1?selected:(selected||profiles[0]);
      if(!active){safe=false;scope=unsafeScope;}
      else{
        id=typeof active['id']==='string'?active['id']:'';
        scope=typeof active['scope']==='string'?active['scope']:'';
      }
    }
  }catch{safe=false;scope=unsafeScope;}
  const value=Object.freeze({registryKey,separator,pattern,id,scope,safe,scoped:(name:unknown)=>scope?`${String(name)}${separator}${scope}`:String(name)});
  Object.defineProperty(window,key,{value,configurable:false,writable:false});
})();
