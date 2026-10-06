import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {privateModules} from '../../../build/module-manifest.mjs';

const coreRoot='source/core';
const internal=fs.readFileSync(path.join(coreRoot,'internal.js'),'utf8');
const app=fs.readFileSync('source/app.html','utf8');
const coreFiles=fs.readdirSync(coreRoot).filter(name=>name.endsWith('.js')).sort();
const sources=new Map(coreFiles.map(name=>[name,fs.readFileSync(path.join(coreRoot,name),'utf8')]));

assert.match(internal,/const contracts=freeze\(\{exactFrozenObject,functionPort,declaredFunctions\}\)/u,'the registry owns the canonical shared contract validators');
assert.match(internal,/function load\(name,registryVersion,format,contractVersion,input\)/u,'the registry owns validated module loading');
assert.equal((app.match(/INTERNAL_MODULES\.load\(/gu)||[]).length,privateModules.length-1,'the host resolves all private modules through the validated loader');
const loaded=[...app.matchAll(/INTERNAL_MODULES\.load\('([^']+)'/gu)].map(row=>row[1]);assert.deepEqual([...loaded].sort(),privateModules.filter(row=>row.id!=='internal').map(row=>row.registryId||row.id).sort(),'every declared private module must cross the validated host boundary exactly once');
assert.equal((app.match(/INTERNAL_MODULES\.require\(/gu)||[]).length,0,'the host must not bypass validated module loading');
for(const [name,format,version] of [
  ['attachments','study-director.attachments-module',1],
  ['app-meta','study-director.app-meta',1],
  ['exports','study-director.exports-module',1]
]) assert.match(app,new RegExp(`INTERNAL_MODULES\\.load\\('${name}',1,'${format}',${version}(?:,Object\\.freeze\\(\\{lifecycle:OperationLifecycle\\}\\))?\\)`,'u'),`${name} must be validated at the host module boundary`);
assert.match(sources.get('attachments.js'),/format:'study-director\.attachments-module',contractVersion:1/u,'attachments exposes explicit module identity metadata');

const localExact=coreFiles.filter(name=>/function\s+exactObject\s*\(/u.test(sources.get(name)));
const localFunctions=coreFiles.filter(name=>/function\s+functions\s*\(/u.test(sources.get(name)));
const localDeclared=coreFiles.filter(name=>/function\s+requireFunctions\s*\(/u.test(sources.get(name)));
assert.deepEqual(localExact,['interactions.js','reconciliation-ui.js'],'only the intentional diagnostic/non-frozen exact-object validators remain local');
assert.deepEqual(localFunctions,['interactions.js'],'only the diagnostic interaction function validator remains local');
assert.deepEqual(localDeclared,[],'declared-function validation is fully centralized');
assert.equal(coreFiles.filter(name=>sources.get(name).includes('registry.contracts')).length,40,'all modules using the ordinary shared validators consume the registry primitives');

console.log(JSON.stringify({status:'PASS',boundary:'internal-modules',validatedHostLoads:privateModules.length-1,sharedValidatorConsumers:38,localExactExceptions:localExact},null,2));
