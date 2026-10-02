import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
export const companionMarker='\n/* Study Director bounded integrity worker companion. Generated from portable sources. */\n';
export function integrityWorkerCompanion(){
  const sources=['sha256.js','file-output.js','stream-encryption.js','integrity-hash.js','integrity-output.js','integrity-segments.js'].map(name=>fs.readFileSync(new URL('portable/'+name,root),'utf8').replace(/^import .*;\s*$/gmu,'').replace(/\bexport (?=(?:async )?(?:function|class|const))/gu,''));
  return companionMarker+'(()=>{\n'+sources.join('\n')+'\nconst previous=self.onmessage;self.onmessage=async event=>{const {id,type,data}=event.data||{};if(!["integrity.append","integrity.decrypt","integrity.digest"].includes(type))return previous(event);try{self.postMessage({id,value:await integritySegment(type,data)});}catch(error){self.postMessage({id,error:{code:error.code,name:error.name,message:error.message}});}};\n})();\n';
}
export function writeIntegrityWorkerCompanion(){const file=new URL('source/external/export-worker.js',root),source=fs.readFileSync(file,'utf8').split(companionMarker)[0];fs.writeFileSync(file,source+integrityWorkerCompanion());}
if(process.argv[1]===fileURLToPath(import.meta.url))writeIntegrityWorkerCompanion();
