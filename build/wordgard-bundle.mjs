import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import * as esbuild from 'esbuild-wasm';
import {minify} from 'terser';
import {wordgardSourcePatchPlugin} from './wordgard-source-patches.mjs';
import {WORDGARD_METADATA} from './wordgard-metadata.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'..');
const ENTRY=path.join(ROOT,'rich-text/editor.ts');
const WORDGARD_ENTRY=path.join(ROOT,'rich-text/wordgard-module.ts');
const SEARCH_ENTRY=path.join(ROOT,'rich-text/search-worker.ts');
const OUTPUT=path.join(ROOT,'source/external/rich-text.js');
const WORDGARD_OUTPUT=path.join(ROOT,'source/external/wordgard.js');
const SEARCH_OUTPUT=path.join(ROOT,'source/external/search-worker.js');
const WORDGARD_FACADE=path.join(ROOT,'rich-text/wordgard-source');
// Where each Wordgard package specifier comes from in vendor/wordgard (through
// the build-only facades, which pick what Study Director reaches).
const WORDGARD_SOURCE_ALIASES=Object.freeze({
  'wordgard/doc':path.join(WORDGARD_FACADE,'doc.ts'),
  'wordgard/types':path.join(WORDGARD_FACADE,'types.ts'),
  'wordgard/state':path.join(WORDGARD_FACADE,'state.ts'),
  'wordgard/editor':path.join(WORDGARD_FACADE,'editor.ts'),
  'wordgard/command':path.join(WORDGARD_FACADE,'command.ts'),
  'wordgard/history':path.join(WORDGARD_FACADE,'history.ts'),
  'wordgard/phrases':path.join(WORDGARD_FACADE,'phrases.ts'),
  'wordgard/set':path.join(WORDGARD_FACADE,'set.ts'),
  'wordgard/table':path.join(WORDGARD_FACADE,'table.ts'),
  'wordgard/inert-html':path.join(ROOT,'rich-text/wordgard-patches/inert-html.ts')
});
// Wordgard's own module puts its packages on this global; the editor module
// reads them from it.
export const WORDGARD_GLOBAL='StudyDirectorWordgard';
const WORDGARD_NAMESPACES=Object.freeze({doc:'doc',types:'types',state:'state',editor:'editor',command:'command',history:'history',phrases:'phrases',set:'set',table:'table','inert-html':'inertHtml'});
const HEADER=`/* Study Director @@SD_RELEASE@@ rich text editor. Wordgard ${WORDGARD_METADATA.version} is in wordgard.js. */\n`;
const WORDGARD_HEADER=`/* Wordgard ${WORDGARD_METADATA.version} · MIT · Marijn Haverbeke. Built for Study Director @@SD_RELEASE@@ from vendor/wordgard
 * (exact upstream source) with the build-time rewrites in build/wordgard-source-patches.mjs. Holds the parts of
 * each package that Study Director's editor uses, on globalThis.${WORDGARD_GLOBAL}. A new Wordgard replaces this
 * module: replace vendor/wordgard and run npm run build:richtext. */\n`;
const LEAN_HEADER=`/* Study Director @@SD_RELEASE@@ rich text editor with Wordgard ${WORDGARD_METADATA.version} · MIT. */\n`;
const SEARCH_HEADER='/* Study Director @@SD_RELEASE@@ transient notes search worker. */\n';

// The editor module imports Wordgard packages from the global the Wordgard
// module sets, so the two stay separate files.
function wordgardGlobalPlugin(){
  return {
    name:'study-director-wordgard-global',
    setup(build){
      build.onResolve({filter:/^wordgard\/[a-z-]+$/},args=>{
        const name=args.path.slice('wordgard/'.length);
        if(!Object.hasOwn(WORDGARD_NAMESPACES,name))throw new Error(`Wordgard package is not in the Wordgard module: ${args.path}`);
        return {path:name,namespace:'study-director-wordgard'};
      });
      build.onLoad({filter:/.*/,namespace:'study-director-wordgard'},args=>{
        const key=WORDGARD_NAMESPACES[args.path];
        return {contents:`const wordgard=globalThis.${WORDGARD_GLOBAL};if(!wordgard||!wordgard.${key})throw new Error('Wordgard is not loaded.');module.exports=wordgard.${key};`,loader:'js'};
      });
    }
  };
}

function byteMetrics(source){
  const bytes=Buffer.from(source);
  return Object.freeze({
    raw:bytes.length,
    gzip:zlib.gzipSync(bytes,{level:9}).length,
    brotli:zlib.brotliCompressSync(bytes,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:11}}).length
  });
}


async function bundle(entry,{minify:minified=true,wordgardGlobal=false,globalName}={}){
  const bundled=await esbuild.build({
    absWorkingDir:ROOT,
    entryPoints:[entry],
    bundle:true,
    write:false,
    format:'iife',
    ...(globalName?{globalName}:{}),
    platform:'browser',
    target:['es2020'],
    treeShaking:true,
    minify:minified,
    legalComments:'none',
    conditions:['production','browser'],
    ...(wordgardGlobal?{}:{alias:WORDGARD_SOURCE_ALIASES}),
    plugins:wordgardGlobal?[wordgardGlobalPlugin()]:[wordgardSourcePatchPlugin({root:ROOT})],
    define:{'process.env.NODE_ENV':'"production"','__SD_WORDGARD_VERSION__':JSON.stringify(WORDGARD_METADATA.version)},
    metafile:true,
    logLevel:'silent'
  });
  if(bundled.outputFiles.length!==1)throw new Error(`Expected one browser output, got ${bundled.outputFiles.length}.`);
  return Object.freeze({text:bundled.outputFiles[0].text,inputs:Object.freeze(Object.keys(bundled.metafile.inputs).sort())});
}
async function mangle(text){
  const mangled=await minify(text,{ecma:2020,compress:{passes:2,unsafe:false,keep_fargs:true},mangle:true,format:{comments:false}});
  if(!mangled.code)throw new Error('Terser produced no browser output.');
  return mangled.code.trim();
}
function output(header,code,inputs){const source=header+code+'\n';return Object.freeze({source,metrics:byteMetrics(source),inputs});}
async function buildBrowserBundle(entry,header){
  const built=await bundle(entry);
  return output(header,await mangle(built.text),built.inputs);
}

// Wordgard's own module: readable (not minified), so it can be read and
// replaced on its own.
export async function buildWordgardModule(){
  const built=await bundle(WORDGARD_ENTRY,{minify:false,globalName:WORDGARD_GLOBAL});
  return output(WORDGARD_HEADER,built.text.trim(),built.inputs);
}
// Study Director's editor, reading Wordgard from the Wordgard module.
export async function buildRichTextModule(){
  const built=await bundle(ENTRY,{wordgardGlobal:true});
  return output(HEADER,await mangle(built.text),built.inputs);
}
// The minified deployment ships one lean script instead of the two: the editor
// and only the Wordgard code it reaches, tree-shaken and minified together.
export async function buildLeanRichText(){
  return buildBrowserBundle(ENTRY,LEAN_HEADER);
}

export async function buildSearchWorkerBundle(){
  return buildBrowserBundle(SEARCH_ENTRY,SEARCH_HEADER);
}

export async function buildExportWorkerBundle(){return buildBrowserBundle(path.join(ROOT,'portable/worker.ts'),'/* Study Director @@SD_RELEASE@@ portable data worker. */\n');}
export async function buildImageWorkerBundle(){return buildBrowserBundle(path.join(ROOT,'rich-text/image-worker.ts'),'/* Study Director @@SD_RELEASE@@ image preparation worker. */\n');}
export async function buildAttachmentWorkerBundle(){return buildBrowserBundle(path.join(ROOT,'portable/attachment-worker.ts'),'/* Study Director @@SD_RELEASE@@ attachment ingest worker. */\n');}

export async function writeWordgardBundle(){
  const [wordgard,richText,searchWorker,exportWorker,imageWorker,attachmentWorker]=await Promise.all([buildWordgardModule(),buildRichTextModule(),buildSearchWorkerBundle(),buildExportWorkerBundle(),buildImageWorkerBundle(),buildAttachmentWorkerBundle()]);
  fs.writeFileSync(path.join(ROOT,'source/external/export-worker.js'),exportWorker.source);
  fs.writeFileSync(path.join(ROOT,'source/external/image-worker.js'),imageWorker.source);
  fs.writeFileSync(path.join(ROOT,'source/external/attachment-worker.js'),attachmentWorker.source);
  fs.writeFileSync(WORDGARD_OUTPUT,wordgard.source);
  fs.writeFileSync(OUTPUT,richText.source);
  fs.writeFileSync(SEARCH_OUTPUT,searchWorker.source);
  return Object.freeze({wordgard,richText,searchWorker});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const write=process.argv.includes('--write');
  const summary=row=>({modules:row.inputs.length,...row.metrics});
  if(write){
    const built=await writeWordgardBundle(),lean=await buildLeanRichText();
    console.error(JSON.stringify({status:'PASS',written:true,wordgard:summary(built.wordgard),richText:summary(built.richText),leanDeployment:summary(lean),searchWorker:summary(built.searchWorker)},null,2));
  }else{
    const lean=await buildLeanRichText();process.stdout.write(lean.source);
    console.error(JSON.stringify({status:'PASS',written:false,leanDeployment:summary(lean)},null,2));
  }
}
