import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {OPFS_IDENTITIES,OBSOLETE_OPFS_IDENTITIES} from '../../../contracts/canonical-identities.mjs';

const render=value=>value.replaceAll('@@SD_ATTACHMENT_OPFS_DIRECTORY@@',OPFS_IDENTITIES.attachments).replaceAll('@@SD_LEGACY_ATTACHMENT_OPFS_DIRECTORY@@',OBSOLETE_OPFS_IDENTITIES.attachmentsV1);
for(const file of ['source/core/internal.js','source/core/asset-storage.js'])vm.runInThisContext(file.endsWith('asset-storage.js')?render(fs.readFileSync(file,'utf8')):fs.readFileSync(file,'utf8'),{filename:file});
const registry=globalThis[Symbol.for('studyDirector.internalModules.v1')];
const AssetStorage=registry.require('asset-storage',1);

const validId=value=>/^asset-[a-z0-9-]+$/i.test(value);
const validType=value=>['application/pdf','audio/mpeg','image/png'].includes(value);
const v1={version:1,storage:'opfs',hash:'a'.repeat(64),size:12,type:'application/pdf',name:'old.pdf',library:false};
const v2={version:2,storage:'opfs',file:'attblob-1234567890abcdef1234',hash:'b'.repeat(64),size:34,type:'application/pdf',name:'new.pdf',library:true};
const rows=new Map([['asset-old',v1],['asset-new',v2]]);
const removedDirectories=[];
let canMutate=true;
const root={
  async getDirectoryHandle(){throw new Error('not used');},
  async removeEntry(name,options){removedDirectories.push([name,options]);if(name===OBSOLETE_OPFS_IDENTITIES.attachmentsV1&&removedDirectories.length>1){const error=new Error('missing');error.name='NotFoundError';throw error;}}
};
const locks={request:async(_name,arg2,arg3)=>{const work=typeof arg2==='function'?arg2:arg3;return work({name:'lock'});}};
const store=AssetStorage.create({
  name:'StudyDirector',protocol:'https:',storage:{getDirectory:async()=>root},locks,
  ingest:{ingest:async()=>{throw new Error('not used');},verify:async()=>true,remove:async()=>{}},
  validId,validType,maxBytes:1024*1024,limitForType:()=>1024*1024,
  canMutate:()=>canMutate,
  issueToken:options=>{if(!canMutate)throw new Error('not-primary');return {allowHydrating:!!options?.allowHydrating};},
  assertToken:()=>{if(!canMutate)throw new Error('ownership-lost');},
  read:async id=>rows.get(id)??null,keys:async()=>[...rows.keys()],entries:async()=>[...rows.entries()],
  commit:async(upserts,remove)=>{for(const [id,row] of upserts)rows.set(id,row);for(const id of remove)rows.delete(id);}
});

assert.equal(typeof store.cleanupLegacy,'function','Asset storage must expose explicit legacy cleanup.');
canMutate=false;
const skipped=await store.cleanupLegacy();
assert.equal(skipped.status,'skipped');
assert.equal(skipped.reason,'not-primary');
assert.equal(rows.has('asset-old'),true,'non-primary tabs must not mutate attachment storage.');

canMutate=true;
const first=await store.cleanupLegacy();
assert.equal(first.status,'completed');
assert.equal(first.removed,1);
assert.equal(rows.has('asset-old'),false,'v1 attachment metadata must be removed.');
assert.deepEqual(rows.get('asset-new'),v2,'v2 metadata must remain untouched.');
assert.deepEqual(removedDirectories[0],[OBSOLETE_OPFS_IDENTITIES.attachmentsV1,{recursive:true}]);

const second=await store.cleanupLegacy();
assert.equal(second.status,'completed');
assert.equal(second.removed,0,'cleanup must be idempotent.');
assert.equal(rows.has('asset-new'),true);
assert.equal(removedDirectories.length,1,'completed legacy cleanup should be one-time per runtime.');

console.log(JSON.stringify({status:'PASS',suite:'legacy-attachment-cleanup',surface:'legacy attachment cleanup'},null,2));
