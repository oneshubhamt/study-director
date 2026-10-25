import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {captureProcess} from './subprocess.mjs';
import assert from 'node:assert/strict';
const [baseline,candidate]=process.argv.slice(2).map(value=>path.resolve(value));
if(process.argv.length!==4||!baseline||!candidate)throw Error('Pass baseline and candidate source directories');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sd-baseline-'));
const projection=`async function projectBackup(value){return {records:value.records,notes:value.data.notes,active:value.importedActiveSession,personal:value.importedPersonalData,descriptors:value.assetDescriptors,assets:await Promise.all(value.importedAssets.map(async asset=>({id:asset.assetId,bytes:Array.from(new Uint8Array(await asset.blob.arrayBuffer()))}))),checkpoint:value.protectedCheckpointManifest};}`;
function run(root,phase,append){
 const fixture=path.join(root,'tests/integration/backup/current-canonical-roundtrip.mjs');
 let source=fs.readFileSync(fixture,'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,quote,target)=>`from ${JSON.stringify(pathToFileURL(path.resolve(path.dirname(fixture),target)).href)}`);
 source+='\n'+projection+'\n'+append;
 const script=path.join(temp,phase+'.mjs');fs.writeFileSync(script,source);
 const result=captureProcess(process.execPath,[script],{cwd:root,encoding:'utf8',timeout:120000});
 process.stdout.write(result.stdout);process.stderr.write(result.stderr);assert.equal(result.status,0,phase+' failed');
}
try{
 run(baseline,'baseline-export',`fs.writeFileSync(${JSON.stringify(path.join(temp,'baseline.sdbackup'))},new Uint8Array(await file.arrayBuffer()));fs.writeFileSync(${JSON.stringify(path.join(temp,'baseline.json'))},JSON.stringify(await projectBackup(parsed)));`);
 run(candidate,'candidate-import-reexport',`const fromBaseline=await codec.inspectCurrent(new Blob([fs.readFileSync(${JSON.stringify(path.join(temp,'baseline.sdbackup'))})]));const expectedBaseline=JSON.parse(fs.readFileSync(${JSON.stringify(path.join(temp,'baseline.json'))},'utf8'));assert.deepEqual(JSON.parse(JSON.stringify(await projectBackup(fromBaseline))),expectedBaseline,'candidate must preserve the actual baseline export');groups[1][1][0]=fromBaseline.importedPersonalData;const roundtripBaseline=await assemble();const checkedBaseline=await codec.inspectCurrent(roundtripBaseline);assert.notEqual(checkedBaseline.protectedCheckpointManifest.checkpointId,expectedBaseline.checkpoint.checkpointId,'a new export has its own checkpoint identity');expectedBaseline.checkpoint.checkpointId=checkedBaseline.protectedCheckpointManifest.checkpointId;assert.deepEqual(JSON.parse(JSON.stringify(await projectBackup(checkedBaseline))),expectedBaseline,'candidate re-export preserves baseline content, attachment identities, tombstones and preferences');const encryptedBaseline=[];await transformEncrypted(roundtripBaseline,key,{write:async b=>encryptedBaseline.push(b.slice())});const decryptedBaseline=[];await transformEncrypted(new Blob(encryptedBaseline),key,{write:async b=>decryptedBaseline.push(b.slice())},{decrypt:true});assert.deepEqual(JSON.parse(JSON.stringify(await projectBackup(await codec.inspectCurrent(new Blob(decryptedBaseline))))),expectedBaseline);console.log(JSON.stringify({status:'PASS',suite:'baseline-to-candidate-backup-regression',baseline:${JSON.stringify(path.basename(baseline))},candidate:${JSON.stringify(path.basename(candidate))},records:fromBaseline.records.length,notes:Object.keys(fromBaseline.data.notes).length,activeSessions:1,logicalAttachments:fromBaseline.assetDescriptors.length,encryptedReexport:true,preserved:['Study Day','Diary','ongoing WG1 note','suspended Review/session','draft and saved plan','preferences','deletion tombstones','logical attachment IDs and deduplicated bytes']}));`);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
