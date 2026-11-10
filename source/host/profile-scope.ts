(()=>{
  // The active profile is resolved before anything opens profile-owned storage.
  // The device registry remains unscoped; every other durable name follows this scope.
  const key=Symbol.for('studyDirector.profileScope.v1');
  const target=window as unknown as Record<PropertyKey,unknown>;
  if(target[key])return;
  const registryKey='@@SD_PROFILES_STORAGE_KEY@@',separator='@@SD_PROFILE_SCOPE_SEPARATOR@@',pattern=/^prof_[a-z0-9]{1,24}_[a-z0-9]{6,12}_[a-f0-9]{8}$/;
  let id='',scope='';
  const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object';
  try{
    const parsed=JSON.parse(localStorage.getItem(registryKey)||'null') as unknown;
    const list=record(parsed)?parsed:null;
    const valid=(entry:unknown)=>{
      if(!record(entry))return false;
      return typeof entry['id']==='string'&&pattern.test(entry['id'])&&(entry['scope']===''||(typeof entry['scope']==='string'&&pattern.test(entry['scope'])));
    };
    // A newer version's list still names the active profile the same way where it can.
    const profiles=list&&Number(list['version'])>=1&&Array.isArray(list['profiles'])?(list['profiles'].filter(valid) as Record<string,unknown>[]):[];
    const activeId=typeof list?.['active']==='string'?list['active']:'';
    const active=profiles.find(entry=>entry['id']===activeId)||profiles[0];
    if(active){
      id=typeof active['id']==='string'?active['id']:'';
      scope=typeof active['scope']==='string'?active['scope']:'';
    }
  }catch{}
  const value=Object.freeze({registryKey,separator,pattern,id,scope,scoped:(name:unknown)=>scope?`${String(name)}${separator}${scope}`:String(name)});
  Object.defineProperty(window,key,{value,configurable:false,writable:false});
})();
