
(()=>{
  // The active profile, read before anything opens storage. The profile list
  // belongs to the device; every other durable name belongs to one profile.
  // The first profile keeps the plain names, a later one adds ~<its scope>.
  const key=Symbol.for('studyDirector.profileScope.v1');
  if(window[key])return;
  const registryKey='@@SD_PROFILES_STORAGE_KEY@@',separator='@@SD_PROFILE_SCOPE_SEPARATOR@@',pattern=/^prof_[a-z0-9]{1,24}_[a-z0-9]{6,12}_[a-f0-9]{8}$/;
  let id='',scope='';
  try{
    const list=JSON.parse(localStorage.getItem(registryKey)||'null'),valid=entry=>!!entry&&pattern.test(entry.id)&&(entry.scope===''||pattern.test(entry.scope));
    // A newer version's list still names the active profile the same way where it can.
    const profiles=list&&Number(list.version)>=1&&Array.isArray(list.profiles)?list.profiles.filter(valid):[],active=profiles.find(entry=>entry.id===list.active)||profiles[0];
    if(active){id=active.id;scope=active.scope;}
  }catch{}
  Object.defineProperty(window,key,{value:Object.freeze({registryKey,separator,pattern,id,scope,scoped:name=>scope?`${name}${separator}${scope}`:String(name)}),configurable:false,writable:false});
})();
