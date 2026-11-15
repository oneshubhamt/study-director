(()=>{
'use strict';
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
if(!registry||registry.format!=='study-director.internal-module-registry'||registry.version!==1){
  throw new Error('Study Director internal module registry is unavailable or incompatible.');
}
const {exactFrozenObject:exactObject,declaredFunctions:requireFunctions}=registry.contracts;
// The notes the Library lists: every stored note, every Area of today's plan
// that has notes, and every parent their paths name, in tree order (Support
// Activities first, then by name at every level). Notes are listed by title
// key; a stored note also carries its permanent id.
registry.define('note-catalogue',1,()=>{
  const freeze=Object.freeze;
  const PORT_FIELDS=freeze({
    names:freeze(['normalize','display','clamp','parentKeys']),
    sources:freeze(['notes','planAreas']),
    support:freeze(['key','label'])
  });
  function createCatalogue(input){
    exactObject(input,['ports'],'Note catalogue input');
    const ports=exactObject(input.ports,Object.keys(PORT_FIELDS),'Note catalogue ports');
    for(const [name,fields] of Object.entries(PORT_FIELDS))exactObject(ports[name],fields,'Note catalogue '+name+' port');
    requireFunctions(ports.names,PORT_FIELDS.names,'Note catalogue names port');
    requireFunctions(ports.sources,PORT_FIELDS.sources,'Note catalogue sources port');
    const {normalize,display,clamp,parentKeys}=ports.names,{notes,planAreas}=ports.sources;
    const SUPPORT=freeze({key:String(ports.support.key),label:String(ports.support.label)});
    const reservedRoot=normalize(SUPPORT.label);

    // "Support Activities" names the one shared support note, so no other
    // note takes it, alone or as the start of a path ("Support Activities >
    // res" made a second, look-alike Area).
    function reserved(key){return String(key||'').split(' > ')[0]===reservedRoot;}
    // A name as typed: its title key, its label, and whether it is reserved.
    function normalizeName(value){
      const raw=clamp(String(value||'').trim()),key=normalize(raw);
      if(!key)return null;
      return freeze({key,label:clamp(display(raw)),reserved:reserved(key)});
    }
    // Merges rows by title key and orders them as a tree, each with its depth.
    function order(source){
      const entries=new Map();
      for(const raw of source||[]){
        if(!raw||typeof raw!=='object')continue;
        const key=normalize(raw.key||raw.label);if(!key)continue;
        const existing=entries.get(key)||{key,id:'',label:display(raw.label||key),text:'',hasNote:false,current:false,updatedAt:'',ephemeral:false,support:false};
        if(raw.id)existing.id=String(raw.id);
        if(raw.label)existing.label=display(raw.label);
        if(raw.text!==undefined)existing.text=String(raw.text||'');
        existing.hasNote=existing.hasNote||!!raw.hasNote||!!existing.text.trim();
        existing.current=existing.current||!!raw.current;
        existing.ephemeral=existing.ephemeral||!!raw.ephemeral;
        existing.support=existing.support||!!raw.support||key===SUPPORT.key;
        if(raw.updatedAt)existing.updatedAt=String(raw.updatedAt);
        entries.set(key,existing);
      }
      const parentOf=key=>{const parts=String(key||'').split(' > ');return parts.length>1?parts.slice(0,-1).join(' > '):'';};
      const values=[...entries.values()],children=new Map();
      for(const entry of values){const parent=parentOf(entry.key),group=children.get(parent)||[];group.push(entry);children.set(parent,group);}
      // Support Activities first, then by name at every level.
      const compare=(a,b)=>(Number(b.support)-Number(a.support))||a.label.localeCompare(b.label,undefined,{sensitivity:'base',numeric:true});
      for(const group of children.values())group.sort(compare);
      const ordered=[],seen=new Set();
      const visit=entry=>{if(!entry||seen.has(entry.key))return;seen.add(entry.key);ordered.push(entry);for(const child of children.get(entry.key)||[])visit(child);};
      for(const entry of children.get('')||[])visit(entry);
      for(const entry of values.filter(item=>!seen.has(item.key)).sort(compare))visit(entry);
      return ordered.map(entry=>freeze({...entry,depth:Math.max(0,entry.key.split(' > ').length-1)}));
    }
    // The list, rebuilt only when the stored notes or today's Areas change.
    let cache=null;
    function entries(){
      const snapshot=notes(),areas=planAreas(),hierarchy=areas.map(area=>`${area.key}\u0000${area.label}`).join('\u0001');
      if(cache&&cache.revision===snapshot.revision&&cache.hierarchy===hierarchy)return cache.entries;
      const rows=new Map();
      const ensure=(key,label,{hasNote=false,current=false,updatedAt='',id=''}={})=>{
        const safeKey=normalize(key);if(!safeKey)return;
        const support=safeKey===SUPPORT.key;
        const existing=rows.get(safeKey)||{key:safeKey,id:'',label:support?SUPPORT.label:display(label||safeKey),hasNote:false,current:false,updatedAt:'',support};
        if(id)existing.id=String(id);
        if(label)existing.label=support?SUPPORT.label:display(label);
        existing.hasNote=existing.hasNote||!!hasNote;
        existing.current=existing.current||!!current;
        if(updatedAt)existing.updatedAt=String(updatedAt);
        rows.set(safeKey,existing);
      };
      for(const record of snapshot.records)ensure(record.key,record.label,{hasNote:record.hasNote,updatedAt:record.updatedAt,id:record.id});
      for(const area of areas)ensure(area.key,area.label,{current:true});
      for(const entry of [...rows.values()]){
        const labelParts=display(entry.label).split(' > ');
        parentKeys(entry.key).forEach((key,index)=>ensure(key,labelParts.slice(0,index+1).join(' > ')));
      }
      const ordered=freeze(order([...rows.values()]));
      cache=freeze({revision:snapshot.revision,hierarchy,entries:ordered});
      return ordered;
    }
    return freeze({entries,order,normalizeName,reserved});
  }
  return freeze({format:'study-director.note-catalogue-module',contractVersion:1,createCatalogue});
});
})();
