import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import * as esbuild from 'esbuild-wasm';
import {minify} from 'terser';
import {wordgardSourcePatchPlugin} from './wordgard-source-patches.mjs';
import {WORDGARD_METADATA} from './wordgard-metadata.mjs';
import {integrityWorkerCompanion} from './integrity-worker-companion.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'..');
const ENTRY=path.join(ROOT,'rich-text/editor.ts');
const SEARCH_ENTRY=path.join(ROOT,'rich-text/search-worker.ts');
const OUTPUT=path.join(ROOT,'source/external/rich-text.js');
const SEARCH_OUTPUT=path.join(ROOT,'source/external/search-worker.js');
const WORDGARD_FACADE=path.join(ROOT,'rich-text/wordgard-source');
const WORDGARD_SOURCE_ALIASES=Object.freeze({
  'wordgard/doc':path.join(WORDGARD_FACADE,'doc.ts'),
  'wordgard/types':path.join(WORDGARD_FACADE,'types.ts'),
  'wordgard/state':path.join(WORDGARD_FACADE,'state.ts'),
  'wordgard/editor':path.join(WORDGARD_FACADE,'editor.ts'),
  'wordgard/command':path.join(WORDGARD_FACADE,'command.ts'),
  'wordgard/history':path.join(WORDGARD_FACADE,'history.ts'),
  'wordgard/phrases':path.join(WORDGARD_FACADE,'phrases.ts')
});
const HEADER=`/* Study Director @@SD_RELEASE@@ rich text bundle. Wordgard ${WORDGARD_METADATA.version} · MIT. */\n`;
const SEARCH_HEADER='/* Study Director @@SD_RELEASE@@ transient Ongoing Notes search worker. */\n';

function byteMetrics(source){
  const bytes=Buffer.from(source);
  return Object.freeze({
    raw:bytes.length,
    gzip:zlib.gzipSync(bytes,{level:9}).length,
    brotli:zlib.brotliCompressSync(bytes,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:11}}).length
  });
}


async function buildBrowserBundle(entry,header){
  const bundled=await esbuild.build({
    absWorkingDir:ROOT,
    entryPoints:[entry],
    bundle:true,
    write:false,
    format:'iife',
    platform:'browser',
    target:['es2020'],
    treeShaking:true,
    minify:true,
    legalComments:'none',
    conditions:['production','browser'],
    alias:WORDGARD_SOURCE_ALIASES,
    plugins:[wordgardSourcePatchPlugin({root:ROOT})],
    define:{'process.env.NODE_ENV':'"production"','__SD_WORDGARD_VERSION__':JSON.stringify(WORDGARD_METADATA.version)},
    metafile:true,
    logLevel:'silent'
  });
  if(bundled.outputFiles.length!==1)throw new Error(`Expected one browser output, got ${bundled.outputFiles.length}.`);
  const mangled=await minify(bundled.outputFiles[0].text,{ecma:2020,compress:{passes:2,unsafe:false,keep_fargs:true},mangle:true,format:{comments:false}});
  if(!mangled.code)throw new Error('Terser produced no browser output.');
  const source=header+mangled.code.trim()+'\n';
  return Object.freeze({source,metrics:byteMetrics(source),inputs:Object.freeze(Object.keys(bundled.metafile.inputs).sort())});
}

export async function buildWordgardBundle(){
  return buildBrowserBundle(ENTRY,HEADER);
}

export async function buildSearchWorkerBundle(){
  return buildBrowserBundle(SEARCH_ENTRY,SEARCH_HEADER);
}

export async function buildExportWorkerBundle(){const bundle=await buildBrowserBundle(path.join(ROOT,'portable/worker.ts'),'/* Study Director @@SD_RELEASE@@ portable data worker. */\n');const source=bundle.source+integrityWorkerCompanion();return Object.freeze({...bundle,source,metrics:byteMetrics(source)});}
export async function buildImageWorkerBundle(){return buildBrowserBundle(path.join(ROOT,'rich-text/image-worker.ts'),'/* Study Director @@SD_RELEASE@@ image preparation worker. */\n');}
export async function buildAttachmentWorkerBundle(){return buildBrowserBundle(path.join(ROOT,'portable/attachment-worker.ts'),'/* Study Director @@SD_RELEASE@@ attachment ingest worker. */\n');}

export async function writeWordgardBundle(){
  const [bundle,searchWorker,exportWorker,imageWorker,attachmentWorker]=await Promise.all([buildWordgardBundle(),buildSearchWorkerBundle(),buildExportWorkerBundle(),buildImageWorkerBundle(),buildAttachmentWorkerBundle()]);
  fs.writeFileSync(path.join(ROOT,'source/external/export-worker.js'),exportWorker.source);
  fs.writeFileSync(path.join(ROOT,'source/external/image-worker.js'),imageWorker.source);
  fs.writeFileSync(path.join(ROOT,'source/external/attachment-worker.js'),attachmentWorker.source);
  fs.writeFileSync(OUTPUT,bundle.source);
  fs.writeFileSync(SEARCH_OUTPUT,searchWorker.source);
  return Object.freeze({...bundle,searchWorker});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const write=process.argv.includes('--write');
  const bundle=write?await writeWordgardBundle():await buildWordgardBundle();
  if(!write)process.stdout.write(bundle.source);
  console.error(JSON.stringify({status:'PASS',written:write,modules:bundle.inputs.length,...bundle.metrics,searchWorker:bundle.searchWorker?{modules:bundle.searchWorker.inputs.length,...bundle.searchWorker.metrics}:undefined},null,2));
}
