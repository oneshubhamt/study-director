import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {EXTERNAL_REPOSITORY_IDENTITIES} from '../../../contracts/canonical-identities.mjs';
import {createDriveHarness,repositoryDigest} from '../../helpers/drive-harness.mjs';

// A large Drive repository: 1,000 versions and 50,000 stored objects. Version
// History reads each version's summary from the listing itself, so listing the
// versions costs one request per 1,000 files and nothing is downloaded.
const VERSIONS=1000,OBJECTS=50000;
const drive=createDriveHarness();await drive.provider.prepare();await drive.provider.authorize();
const hex=n=>n.toString(16).padStart(32,'0'),idMarker=EXTERNAL_REPOSITORY_IDENTITIES.driveRepositoryIdMarker,kindMarker=EXTERNAL_REPOSITORY_IDENTITIES.driveRepositoryKindMarker;
const blob=new Blob(['scale fixture']),digest=await repositoryDigest(blob);
for(const [kind,id] of [['object','obj_'+hex(1)],['checkpoint','cp_'+hex(1)],['commit','cp_'+hex(1)]])await drive.provider.repository.upload({kind,id,name:'',blob,size:blob.size,digest,exportedAt:'2026-10-06T08:00:00.000Z',appVersion:'QA_FIXTURE'});
// Copy each uploaded file to reach the target counts without uploading them one by one.
const templates=[...drive.state.files.values()].filter(file=>file.appProperties?.[idMarker]);
for(const template of templates){
  const kind=template.appProperties[kindMarker];
  const count=kind==='object'?OBJECTS:VERSIONS,prefix=kind==='object'?'obj_':'cp_',original=template.appProperties[idMarker];
  for(let n=2;n<=count;n++){
    const copyId=prefix+hex(n),fileId=`${template.id}-${n}`;
    drive.state.files.set(fileId,{...template,id:fileId,name:template.name.replace(original,copyId),appProperties:{...template.appProperties,[idMarker]:copyId}});
  }
}
const measure=async kind=>{
  const before=drive.state.requests.length,started=performance.now(),listed=await drive.provider.repository.list({kind});
  return {items:listed.items.length,overflow:listed.overflow,requests:drive.state.requests.length-before,ms:Math.round(performance.now()-started)};
};
const checkpoints=await measure('checkpoint'),commits=await measure('commit'),objects=await measure('object');
assert.equal(checkpoints.items,VERSIONS);assert.equal(commits.items,VERSIONS);assert.equal(objects.items,OBJECTS);
assert.equal(checkpoints.overflow||commits.overflow||objects.overflow,false,'the whole inventory is read');
// One folder check plus one page per 1,000 files; no request per version.
assert.ok(checkpoints.requests<=2&&commits.requests<=2,`listing 1,000 versions must take at most two requests per kind (checkpoints ${checkpoints.requests}, commits ${commits.requests})`);
assert.ok(objects.requests<=OBJECTS/1000+1,`listing 50,000 objects must take one request per 1,000 (took ${objects.requests})`);
assert.equal(drive.state.requests.filter(request=>/[?&]alt=media/u.test(request.url)).length,0,'listing downloads nothing');
console.log(JSON.stringify({status:'PASS',suite:'drive-repository-scale',versions:VERSIONS,objects:OBJECTS,listing:{checkpoints,commits,objects}},null,2));
