import {readRuntimeSource} from './runtime-source.mts';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';

async function load(file:string):Promise<Record<string,unknown>>{
  const value:unknown=await import(pathToFileURL(file).href);
  if(!value||typeof value!=='object')throw new Error(`Invalid source module: ${file}`);
  return Object.fromEntries(Object.entries(value).map(([key,entry]:[string,unknown])=>[key,entry]));
}
function strip(file:string){return stripTypeScriptTypes(readRuntimeSource(file),{mode:'strip'});}

export async function importRichTextReconciliationSource(){
  const temp=fs.mkdtempSync(path.join(process.env['TMPDIR']||'/tmp','sd-rte-reconcile-'));
  const limits=pathToFileURL(path.resolve('contracts/production-limits.mjs')).href;
  fs.writeFileSync(path.join(temp,'wg1-codec.mjs'),strip('rich-text/wg1-codec.ts').replace("from '../contracts/production-limits.mjs'",`from '${limits}'`));
  const source=strip('rich-text/reconciliation.ts').replace("from './wg1-codec';","from './wg1-codec.mjs';");
  fs.writeFileSync(path.join(temp,'reconciliation.mjs'),source);
  return load(path.join(temp,'reconciliation.mjs'));
}

// The DOM-free note text rules: tags and the Markdown reader for import.
export async function importRichTextNoteTextSource(){
  const temp=fs.mkdtempSync(path.join(process.env['TMPDIR']||'/tmp','sd-rte-note-text-'));
  const limits=pathToFileURL(path.resolve('contracts/production-limits.mjs')).href;
  fs.writeFileSync(path.join(temp,'wg1-codec.mjs'),strip('rich-text/wg1-codec.ts').replace("from '../contracts/production-limits.mjs'",`from '${limits}'`));
  fs.writeFileSync(path.join(temp,'markdown.mjs'),strip('rich-text/markdown.ts').replace("from '../contracts/production-limits.mjs'",`from '${limits}'`).replace("from './wg1-codec';","from './wg1-codec.mjs';"));
  fs.writeFileSync(path.join(temp,'tags.mjs'),strip('rich-text/tags.ts'));
  const [tags,markdown]=await Promise.all([load(path.join(temp,'tags.mjs')),load(path.join(temp,'markdown.mjs'))]);
  return {...tags,markdownToHtml:markdown['markdownToHtml'],looksLikeMarkdown:markdown['looksLikeMarkdown'],markdownDocument:markdown['markdownDocument']};
}
