import {readScript} from '../../../build/source-script.mts';
import {readHostHtml} from '../../../build/host-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {privateModules} from '../../../build/module-manifest.mjs';

const coreRoot='source/core';
const internal=readScript(path.join(coreRoot,'internal.ts'));
const app=readHostHtml();
const coreFiles=fs.readdirSync(coreRoot).filter(name=>/\.(?:js|ts)$/u.test(name)).sort();
const sources=new Map(coreFiles.map(name=>[name,readScript(path.join(coreRoot,name))]));

assert.match(internal,/const contracts=freeze\(\{exactFrozenObject,functionPort,declaredFunctions\}\)/u,'the registry owns the canonical shared contract validators');
assert.match(internal,/function load\(name\s*,registryVersion\s*,format\s*,contractVersion\s*,input\s*\)/u,'the registry owns validated module loading');
assert.equal((app.match(/INTERNAL_MODULES\.load\(/gu)||[]).length,privateModules.length-1,'the host resolves all private modules through the validated loader');
const loaded=[...app.matchAll(/INTERNAL_MODULES\.load\('([^']+)'/gu)].map(row=>row[1]);assert.deepEqual([...loaded].sort(),privateModules.filter(row=>row.id!=='internal').map(row=>row.registryId||row.id).sort(),'every declared private module must cross the validated host boundary exactly once');
assert.equal((app.match(/INTERNAL_MODULES\.require\(/gu)||[]).length,0,'the host must not bypass validated module loading');
for(const [name,format,version] of [
  ['attachments','study-director.attachments-module',1],
  ['app-meta','study-director.app-meta',1],
  ['exports','study-director.exports-module',1]
]) assert.match(app,new RegExp(`INTERNAL_MODULES\\.load\\('${name}',1,'${format}',${version}(?:,Object\\.freeze\\(\\{lifecycle:OperationLifecycle\\}\\))?\\)`,'u'),`${name} must be validated at the host module boundary`);
const attachmentsSource=privateModules.find(module=>module.id==='attachments').source;
assert.match(sources.get(path.basename(attachmentsSource)),/format:'study-director\.attachments-module',contractVersion:1/u,'attachments exposes explicit module identity metadata');

const localExact=coreFiles.filter(name=>/function\s+exactObject\s*\(/u.test(sources.get(name)));
const localFunctions=coreFiles.filter(name=>/function\s+functions\s*\(/u.test(sources.get(name)));
const localDeclared=coreFiles.filter(name=>/function\s+requireFunctions\s*\(/u.test(sources.get(name)));
assert.deepEqual(localExact,['interactions.ts','reconciliation-ui.js'],'only the intentional diagnostic/non-frozen exact-object validators remain local');
assert.deepEqual(localFunctions,['interactions.ts'],'only the diagnostic interaction function validator remains local');
assert.deepEqual(localDeclared,[],'declared-function validation is fully centralized');
assert.equal(coreFiles.filter(name=>sources.get(name).includes('registry.contracts')).length,39,'all modules using the ordinary shared validators consume the registry primitives');

console.log(JSON.stringify({status:'PASS',boundary:'internal-modules',validatedHostLoads:privateModules.length-1,sharedValidatorConsumers:39,localExactExceptions:localExact},null,2));
