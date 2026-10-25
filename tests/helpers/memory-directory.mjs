// An in-memory stand-in for the browser's FileSystemDirectoryHandle, enough for
// backup storage: nested folders, files written through createWritable, async
// listing and removal. Each file's lastModified comes from the given clock.
// `faults` lets a test corrupt the next read-back of a named file or remove a
// folder from under its handle.
export function createMemoryDirectory({now=()=>Date.now(),faults={corruptReadOf:new Set()}}={}){
  function notFound(name){return Object.assign(new Error(`${name} was not found.`),{name:'NotFoundError'});}
  function directory(name){
    const entries=new Map();let removed=false;
    const handle={
      kind:'directory',name,
      get removed(){return removed;},
      markRemoved(){removed=true;},
      async getDirectoryHandle(child,{create=false}={}){
        if(removed)throw notFound(name);
        const existing=entries.get(child);if(existing){if(existing.kind!=='directory')throw Object.assign(new Error('type mismatch'),{name:'TypeMismatchError'});return existing;}
        if(!create)throw notFound(child);const made=directory(child);entries.set(child,made);return made;
      },
      async getFileHandle(child,{create=false}={}){
        if(removed)throw notFound(name);
        const existing=entries.get(child);if(existing){if(existing.kind!=='file')throw Object.assign(new Error('type mismatch'),{name:'TypeMismatchError'});return existing;}
        if(!create)throw notFound(child);const made=file(child);entries.set(child,made);return made;
      },
      async removeEntry(child){if(!entries.has(child))throw notFound(child);entries.delete(child);},
      async *entries(){for(const row of [...entries.entries()])yield row;},
      names(){return [...entries.keys()].sort();}
    };
    return handle;
  }
  function file(name){
    let content=new Blob([]),modified=now();
    return {
      kind:'file',name,
      async createWritable(){const parts=[];return {write:async blob=>{parts.push(blob);},close:async()=>{content=new Blob(parts);modified=now();},abort:async()=>{parts.length=0;}};},
      async getFile(){
        let blob=content;
        if(faults.corruptReadOf.has(name)&&blob.size){faults.corruptReadOf.delete(name);const bytes=new Uint8Array(await blob.arrayBuffer());bytes[0]^=0xff;blob=new Blob([bytes]);}
        const result=new File([blob],name,{lastModified:modified});return result;
      },
      touch(at){modified=at;}
    };
  }
  return directory('root');
}
