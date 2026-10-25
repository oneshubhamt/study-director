import assert from 'node:assert/strict';
import {artifactPath,writeArtifact} from '../../helpers/artifacts.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import releaseConfig from '../../../release.config.mjs';
import {buildLeanRichText} from '../../../build/wordgard-bundle.mjs';
import {DEPENDENCY_AUDIT_POLICY,DEPENDENCY_INVENTORY,VENDORED_DEPENDENCIES} from '../../../contracts/dependency-inventory.mjs';

const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
const packageName=path=>path.replace(/^node_modules\//,'');
const locked=Object.entries(lock.packages||{}).filter(([path])=>path.startsWith('node_modules/')).map(([path,value])=>({name:packageName(path),...(value.link?lock.packages[value.resolved]||{}:value),...value}));
const inventoryByName=new Map(DEPENDENCY_INVENTORY.map(row=>[row.name,row]));
const rootDevDependencies=lock.packages[''].devDependencies||{};
assert.equal(Object.hasOwn(rootDevDependencies,'wordgard'),false,'Vendored Wordgard source must not be installed as a local npm package.');
assert.equal(Object.hasOwn(lock.packages||{},'node_modules/wordgard'),false,'Vendored Wordgard must not create a node_modules link entry.');
assert.equal(Object.hasOwn(lock.packages||{},'vendor/wordgard'),false,'Vendored Wordgard package metadata must not pull its upstream dev toolchain into Study Director.');
assert.equal(new Set(DEPENDENCY_INVENTORY.map(row=>row.name)).size,DEPENDENCY_INVENTORY.length,'Dependency inventory contains duplicate packages.');
assert.deepEqual([...inventoryByName.keys()].sort(),locked.map(row=>row.name).sort(),'Dependency inventory does not cover the complete lockfile.');
for(const row of locked){
  const declared=inventoryByName.get(row.name);
  assert.equal(declared.version,row.version,`${row.name} inventory version drifted from the lockfile.`);
  assert.equal(declared.license,row.license,`${row.name} inventory license drifted from the lockfile.`);
  assert.equal(declared.direct,Object.hasOwn(rootDevDependencies,row.name),`${row.name} direct/transitive classification drifted.`);
}

const bundle=await buildLeanRichText();
const bundledPackages=new Set(bundle.inputs.filter(path=>path.startsWith('node_modules/')).map(path=>{
  const parts=path.slice('node_modules/'.length).split('/');
  return parts[0].startsWith('@')?`${parts[0]}/${parts[1]}`:parts[0];
}));
assert.deepEqual([...bundledPackages].sort(),DEPENDENCY_INVENTORY.filter(row=>row.shipped).map(row=>row.name).sort(),'Bundled npm dependency inventory drifted from the reproducible rich-text build.');
assert.ok(bundle.inputs.some(path=>path.includes('vendor/wordgard/src/editor/editor.ts')),'Granular vendored Wordgard editor source is absent from the bundle.');
for(const tableSource of ['cellselection.ts','correct.ts','tablepaste.ts'])
  assert.ok(bundle.inputs.some(path=>path.includes(`vendor/wordgard/src/table/${tableSource}`)),`Granular vendored Wordgard table semantics are absent from the bundle: ${tableSource}.`);
assert.ok(!bundle.inputs.some(path=>path.includes('vendor/wordgard/dist/')),'Flattened Wordgard dist modules must not enter the rich runtime.');
for(const row of VENDORED_DEPENDENCIES){
  const manifest=JSON.parse(fs.readFileSync(`${row.path}/package.json`,'utf8'));
  assert.equal(row.version,manifest.version,'Vendored dependency inventory drifted from its reviewed source manifest.');
  for(const dependencyName of Object.keys(manifest.dependencies||{})){
    if(bundledPackages.has(dependencyName))assert.ok(Object.hasOwn(rootDevDependencies,dependencyName),`Bundled vendored runtime dependency must be pinned directly by Study Director: ${dependencyName}.`);
    else assert.equal(Object.hasOwn(rootDevDependencies,dependencyName),false,`Unbundled vendored dependency must not be installed by Study Director: ${dependencyName}.`);
  }
  assert.ok(fs.statSync(row.path).isDirectory(),`Vendored dependency path is missing: ${row.path}.`);
  assert.match(fs.readFileSync(row.notice,'utf8'),/MIT License/i,`Vendored dependency notice is invalid: ${row.notice}.`);
}

const audit=spawnSync('npm',['audit','--json','--audit-level=high'],{encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env}});
assert.equal(audit.error,undefined,`Full dependency audit could not start: ${audit.error&&audit.error.message}.`);
let report=null;
try{report=JSON.parse(audit.stdout);}catch(error){throw new Error(`Full dependency audit is unverified: ${audit.stderr||audit.stdout||error.message}`);}
if(report&&report.error&&report.message){
  throw new Error(`Full dependency audit is environment-blocked: ${report.message}`);
}
assert.equal(report.auditReportVersion,2,'Unsupported npm audit report version.');
assert.ok(report.metadata&&report.metadata.vulnerabilities,'Full dependency audit did not return vulnerability metadata.');
const vulnerabilities=Object.entries(report.vulnerabilities||{}).map(([name,value])=>({name,...value}));
const blocked=vulnerabilities.filter(row=>DEPENDENCY_AUDIT_POLICY.failSeverities.includes(row.severity));
assert.deepEqual(blocked,[],`High/critical dependency findings: ${blocked.map(row=>`${row.name}:${row.severity}`).join(', ')}`);
const today=new Date().toISOString().slice(0,10);
for(const finding of vulnerabilities.filter(row=>DEPENDENCY_AUDIT_POLICY.waiverSeverities.includes(row.severity))){
  const sources=(finding.via||[]).map(value=>typeof value==='object'?String(value.source||''):String(value)).filter(Boolean);
  const waiver=DEPENDENCY_AUDIT_POLICY.moderateWaivers.find(row=>row.package===finding.name&&sources.every(source=>row.advisories.includes(source)));
  assert.ok(waiver,`Moderate dependency finding lacks an explicit waiver: ${finding.name} (${sources.join(', ')}).`);
  assert.match(waiver.reason,/\S/);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(waiver.expires)&&waiver.expires>=today,`Dependency waiver expired: ${finding.name}.`);
}
assert.equal(audit.status,0,vulnerabilities.length?`npm audit returned unresolved findings: ${audit.stderr}`:'npm audit failed without a reported vulnerability.');

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const components=[...DEPENDENCY_INVENTORY.map(row=>({
  type:'library',name:row.name,version:row.version,scope:row.shipped?'required':'excluded',
  licenses:[{license:{id:row.license}}],properties:[
    {name:'study-director:use',value:row.use},
    {name:'study-director:direct',value:String(row.direct)}
  ],purl:`pkg:npm/${row.name.replace('@','%40')}@${row.version}`
})),...VENDORED_DEPENDENCIES.map(row=>({
  type:'library',name:row.name,version:row.version,scope:'required',licenses:[{license:{id:row.license}}],
  properties:[{name:'study-director:use',value:row.use},{name:'study-director:path',value:row.path}]
}))];
const sbom={
  bomFormat:'CycloneDX',specVersion:'1.5',serialNumber:`urn:uuid:${crypto.randomUUID()}`,version:1,
  metadata:{timestamp:new Date().toISOString(),component:{type:'application',name:'Study Director',version:releaseConfig.release}},components
};
writeArtifact('dependencies.cdx.json',`${JSON.stringify(sbom,null,2)}\n`);

console.log(JSON.stringify({
  status:'PASS',release:releaseConfig.release,audit:'full lockfile',packages:locked.length,bundled:[...bundledPackages].sort(),
  vendored:VENDORED_DEPENDENCIES.map(row=>`${row.name}@${row.version}`),vulnerabilities:report.metadata.vulnerabilities,
  sbom:{format:'CycloneDX 1.5',components:components.length,sha256:sha256(JSON.stringify(sbom))}
},null,2));
