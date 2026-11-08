import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {eraseTypes} from '../../build/source-script.mts';

// Inspect authored runtime text using the production erasure primitive. Runtime
// ESM remains ESM; VM callers must still select the appropriate execution mode.
export function readRuntimeSource(file){
  const filename=file instanceof URL?fileURLToPath(file):String(file);
  return eraseTypes(fs.readFileSync(file,'utf8'),filename);
}
