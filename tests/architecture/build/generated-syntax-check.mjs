import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {captureProcess} from '../../helpers/subprocess.mjs';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const DIST=path.join(ROOT,'dist');
const files=[];
function walk(directory){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const absolute=path.join(directory,entry.name);
    if(entry.isDirectory())walk(absolute);
    else files.push(absolute);
  }
}
walk(DIST);
const jsFiles=files.filter(file=>file.endsWith('.js')).sort();
let inlineScripts=0;
function checkFile(file,label){
  const checked=captureProcess(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(checked.status,0,`Generated syntax failed for ${label}:\n${checked.stderr||checked.stdout}`);
}
jsFiles.forEach(file=>checkFile(file,path.relative(ROOT,file)));
for(const htmlFile of files.filter(file=>file.endsWith('.html')).sort()){
  const html=fs.readFileSync(htmlFile,'utf8');
  const regex=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match,index=0;
  while((match=regex.exec(html))){
    const attrs=match[1]||'',body=match[2]||'';
    if(/\bsrc\s*=/.test(attrs)||/\btype\s*=\s*["'](?:application\/json|importmap)["']/i.test(attrs)||!body.trim())continue;
    const temp=path.join(os.tmpdir(),`qa-inline-${process.pid}-${inlineScripts++}.js`);
    fs.writeFileSync(temp,body);
    try{checkFile(temp,`${path.relative(ROOT,htmlFile)} inline script ${++index}`);}
    finally{fs.rmSync(temp,{force:true});}
  }
}
console.log(JSON.stringify({status:'PASS',generatedJsFiles:jsFiles.length,inlineScripts},null,2));
