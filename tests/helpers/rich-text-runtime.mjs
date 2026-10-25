import fs from 'node:fs';
import path from 'node:path';
import {externalModules} from '../../build/module-manifest.mjs';

// The rich-text runtime as the app loads it: Wordgard's own module, then Study
// Director's editor, joined into one script in that order (as the build does).
export function richTextRuntimeSource(root=process.cwd()){
  const module=externalModules.find(row=>row.id==='rich-text');
  return module.sources.map(file=>fs.readFileSync(path.join(root,'source',file),'utf8')).join('\n');
}
