import fs from 'node:fs';
import {externalModules} from '../../build/module-manifest.mjs';
import {generatedRuntimePath} from '../../build/generated-runtime-paths.mjs';

// The rich-text runtime as the app loads it: Wordgard's own module, then Study
// Director's editor, joined into one script in that order (as the build does).
export function richTextRuntimeSource(root=process.cwd()){
  const module=externalModules.find(row=>row.id==='rich-text');
  if(!module||!Array.isArray(module.generatedSources))throw new Error('Rich-text generated runtime manifest entry is missing.');
  return module.generatedSources.map(file=>fs.readFileSync(generatedRuntimePath(root,file),'utf8')).join('\n');
}
