// An in-memory stand-in for the browser's FileSystemDirectoryHandle, enough for
// backup storage: nested folders, files written through createWritable, async
// listing and removal. Each file's lastModified comes from the given clock.
// `faults` lets a test corrupt the next read-back of a named file or remove a
// folder from under its handle.
type BlobPart=NonNullable<ConstructorParameters<typeof Blob>[0]>[number];
type Clock=()=>number;
type FileEntry={
  kind:'file';name:string;
  createWritable(options?:{keepExistingData?:boolean}):Promise<{write(blob:BlobPart):Promise<void>;close():Promise<void>;abort():Promise<void>}>;
  getFile():Promise<File>;touch(at:number):void;
};
type DirectoryEntry={
  kind:'directory';name:string;readonly removed:boolean;markRemoved():void;
  getDirectoryHandle(child:string,options?:{create?:boolean}):Promise<DirectoryEntry>;
  getFileHandle(child:string,options?:{create?:boolean}):Promise<FileEntry>;
  removeEntry(child:string):Promise<void>;entries():AsyncIterableIterator<[string,DirectoryEntry|FileEntry]>;names():string[];
};
type Options={now?:Clock;faults?:{corruptReadOf:Set<string>}};
export function createMemoryDirectory({now:initialNow=()=>Date.now(),faults={corruptReadOf:new Set<string>()}}:Options={}){
  // Pages on one device share its clock, but each simulated page keeps its
  // own and an idle one lags. A folder that several pages use stamps files
  // with the latest of their clocks, as the device's one clock would.
  const clocks=[initialNow],now=()=>Math.max(...clocks.map(clock=>Number(clock())));
  function notFound(name:string){return Object.assign(new Error(`${name} was not found.`),{name:'NotFoundError'});}
  function directory(name:string):DirectoryEntry{
    const entries=new Map<string,DirectoryEntry|FileEntry>();let removed=false;
    const handle:DirectoryEntry={
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
  function file(name:string):FileEntry{
    let content=new Blob([]),modified=now();
    return {
      kind:'file',name,
      async createWritable(_options?:{keepExistingData?:boolean}){const parts:BlobPart[]=[];return {write:async (blob:BlobPart)=>{parts.push(blob);},close:async()=>{content=new Blob(parts);modified=now();},abort:async()=>{parts.length=0;}};},
      async getFile(){
        let blob=content;
        if(faults.corruptReadOf.has(name)&&blob.size){faults.corruptReadOf.delete(name);const bytes=new Uint8Array(await blob.arrayBuffer());bytes[0]=bytes[0]!^0xff;blob=new Blob([bytes]);}
        const result=new File([blob],name,{lastModified:modified});return result;
      },
      touch(at){modified=at;}
    };
  }
  return Object.assign(directory('root'),{useClock:(clock:Clock)=>{if(!clocks.includes(clock))clocks.push(clock);}});
}
