import fs from 'node:fs';

// rich-text/editor.ts is kept formatted by Prettier. Contract tests that match
// its source text read it compacted: whitespace outside strings, templates,
// regular expressions and comments is dropped, except a single space between
// two word characters ("const x", "return value"), and the semicolon Prettier
// adds before a closing brace, and any trailing comma, are dropped. The patterns then read as the code
// does, whatever the line breaks.
const WORD=/[A-Za-z0-9_$]/;
export function compactSource(source){
  const text=String(source);let out='',i=0,pendingSpace=false,last='';
  const regexAllowed=()=>{const prev=out.trimEnd().slice(-1);return !prev||/[(,=:[!&|?{};+\-*%<>~^]/.test(prev)||/\b(?:return|typeof|case|do|else|in|of|void|yield|await)$/.test(out.trimEnd());};
  const emit=chunk=>{if(pendingSpace&&WORD.test(last)&&WORD.test(chunk[0]))out+=' ';pendingSpace=false;out+=chunk;last=chunk.at(-1);};
  while(i<text.length){
    const c=text[i],n=text[i+1];
    if(/\s/.test(c)){pendingSpace=true;i++;continue;}
    if(c==='/'&&n==='/'){const end=text.indexOf('\n',i);const stop=end<0?text.length:end;emit(text.slice(i,stop));pendingSpace=true;i=stop;continue;}
    if(c==='/'&&n==='*'){const end=text.indexOf('*/',i+2)+2;emit(text.slice(i,end));i=end;continue;}
    if(c==='\''||c==='"'){let j=i+1;while(j<text.length&&text[j]!==c){if(text[j]==='\\')j++;j++;}emit(text.slice(i,j+1));i=j+1;continue;}
    if(c==='`'){let j=i+1,depth=0;while(j<text.length){if(text[j]==='\\'){j+=2;continue;}if(depth===0&&text[j]==='`')break;if(text[j]==='$'&&text[j+1]==='{'){depth++;j+=2;continue;}if(depth>0&&text[j]==='}'){depth--;j++;continue;}j++;}emit(text.slice(i,j+1));i=j+1;continue;}
    if(c==='/'&&regexAllowed()){let j=i+1,inClass=false;while(j<text.length){const d=text[j];if(d==='\\'){j+=2;continue;}if(d==='[')inClass=true;else if(d===']')inClass=false;else if(d==='/'&&!inClass)break;else if(d==='\n')break;j++;}j++;while(j<text.length&&/[a-z]/.test(text[j]))j++;emit(text.slice(i,j));i=j;continue;}
    if(c===';'||c===','){let j=i+1;while(j<text.length&&/\s/.test(text[j]))j++;if(c===';'&&text[j]==='}'||c===','&&/[}\])]/.test(text[j])){i++;continue;}}
    emit(c);i++;
  }
  return out;
}
export function readCompact(path){return compactSource(fs.readFileSync(path,'utf8'));}
