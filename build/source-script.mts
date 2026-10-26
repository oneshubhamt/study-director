import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {Script} from 'node:vm';

// One synchronous, cache-free path for classic app scripts and their VM tests.
// Strip mode preserves UTF-16 offsets/lines, so V8 coverage maps directly to TS.
// Runtime imports/exports and non-erasable syntax fail instead of changing loading.
export function compileScript(source: string, filename: string): string {
  if (!filename.endsWith('.ts')) return source;
  const output=stripTypeScriptTypes(source,{mode:'strip',sourceMap:false});
  if (output.length!==source.length || output.split('\n').length!==source.split('\n').length) {
    throw new Error(`Type erasure changed source positions: ${filename}`);
  }
  new Script(output,{filename});
  return output;
}
export function readScript(filename: string): string {
  return compileScript(fs.readFileSync(filename,'utf8'),filename);
}
