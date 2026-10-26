// Stable canonical IDs for synthetic test fixtures, derived from fixture labels.
const freeze=Object.freeze,TRASH_PREFIX='~deleted ',ID=/^n_[0-9a-f]{16}$/u,utf8=new TextEncoder();
const titleKey=value=>String(value??'').split('>').map(part=>part.trim().replace(/\s+/g,' ')).filter(Boolean).join(' > ').toLowerCase();
const noteKeys=freeze({
  isId:value=>ID.test(String(value||'')),
  isTrash:value=>String(value||'').startsWith(TRASH_PREFIX)&&ID.test(String(value).slice(TRASH_PREFIX.length)),
  isKey:value=>noteKeys.isId(value)||noteKeys.isTrash(value),
  trash:id=>noteKeys.isId(id)?TRASH_PREFIX+id:'',
  id:key=>noteKeys.isTrash(key)?String(key).slice(TRASH_PREFIX.length):noteKeys.isId(key)?String(key):''
});
function derive(text){
  let hash=0xcbf29ce484222325n;
  for(const byte of utf8.encode(text)){hash^=BigInt(byte);hash=(hash*0x100000001b3n)&0xffffffffffffffffn;}
  return 'n_'+hash.toString(16).padStart(16,'0');
}
// A deterministic fixture ID; production creates its own permanent IDs.
const noteId=title=>derive(titleKey(title));
// Accept fixture labels and already-created canonical keys in test constructors.
const fixtureNoteKey=raw=>{const value=String(raw||'');if(noteKeys.isKey(value))return value;if(value.startsWith(TRASH_PREFIX)){const old=value.slice(TRASH_PREFIX.length).trim();return old?TRASH_PREFIX+derive(TRASH_PREFIX+old):'';}const name=titleKey(value);return name?derive(name):'';};
// The stored row of the live note with this title, if there is one.
const storedNote=(map,title)=>{const wanted=titleKey(title);for(const row of map.values())if(noteKeys.isId(row.key)&&titleKey(row.label)===wanted)return row;return undefined;};
const noteRow=(title,text='',updatedAt='2026-09-01T00:00:00.000Z',label=title)=>({version:3,key:noteId(title),label,text,updatedAt});

export {TRASH_PREFIX,noteKeys,noteId,fixtureNoteKey,noteRow,storedNote,titleKey};
