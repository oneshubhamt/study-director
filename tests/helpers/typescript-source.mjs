import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';

function strip(file){return stripTypeScriptTypes(fs.readFileSync(file,'utf8'),{mode:'strip',sourceMap:false});}

export async function importRichTextReconciliationSource(){
  const temp=fs.mkdtempSync(path.join(process.env.TMPDIR||'/tmp','sd-rte-reconcile-'));
  const limits=pathToFileURL(path.resolve('contracts/production-limits.mjs')).href;
  fs.writeFileSync(path.join(temp,'wg1-codec.mjs'),strip('rich-text/wg1-codec.ts').replace("from '../contracts/production-limits.mjs'",`from '${limits}'`));
  const source=strip('rich-text/reconciliation.ts').replace("from './wg1-codec';","from './wg1-codec.mjs';");
  fs.writeFileSync(path.join(temp,'reconciliation.mjs'),source);
  return import(pathToFileURL(path.join(temp,'reconciliation.mjs')).href);
}
