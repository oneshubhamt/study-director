import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {Script} from 'node:vm';

// One synchronous, cache-free erasure path for runtime code and coverage.
// Strip mode preserves UTF-16 offsets/lines, so V8 coverage maps directly to TS.
// Non-erasable syntax fails. The classic-script wrapper also rejects runtime ESM.
export function eraseTypes(source: string, filename: string): string {
  if (!filename.endsWith('.ts')) return source;
  const output=stripTypeScriptTypes(source,{mode:'strip'});
  if (output.length!==source.length || output.split('\n').length!==source.split('\n').length) {
    throw new Error(`Type erasure changed source positions: ${filename}`);
  }
  return output;
}
export function compileScript(source: string, filename: string): string {
  const output=eraseTypes(source,filename);
  if(filename.endsWith(".ts"))new Script(output,{filename});
  return output;
}
export function readScript(filename: string): string {
  return compileScript(fs.readFileSync(filename,'utf8'),filename);
}
