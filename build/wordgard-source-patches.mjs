import fs from 'node:fs';
import path from 'node:path';

// Study Director's build-only rewrites of vendored Wordgard. vendor/wordgard
// stays the exact upstream source; each rewrite names the upstream text it
// replaces, so a new Wordgard version builds unchanged unless that text moved,
// and then fails with the rewrite's name. Runtime behaviour Study Director adds
// lives in rich-text/wordgard-patches behind rich-text/wordgard-adapter.ts.
const posix=value=>value.split(path.sep).join('/');

function exactReplace(source,from,to,label){
  if(!source.includes(from))throw new Error(`Wordgard patch anchor changed: ${label}`);
  return source.replace(from,to);
}

function patchNode(source){
  return exactReplace(source,
`    slice(from: number, to = this.length) {
      return this.sliceInner(from, to)
    }`,
`    slice(from: number, to?: number) {
      return this.sliceInner(from, to === undefined ? this.length : to)
    }`,
'Node.slice build compatibility');
}

function patchClipboard(source,helperImport){
  source=`import {parseInertHTML} from ${JSON.stringify(helperImport)}\n${source}`;
  source=exactReplace(source,
`let _detachedDoc: Document | null = null
function detachedDoc() {
  return _detachedDoc || (_detachedDoc = document.implementation.createHTMLDocument("title"))
}

function maybeWrapTrusted(html: string): string {
  let trustedTypes = (window as any).trustedTypes
  if (!trustedTypes) return html
  // With the require-trusted-types-for CSP, Chrome will block
  // innerHTML, even on a detached document. This wraps the string in
  // a way that makes the browser allow us to use its parser again.
  return trustedTypes.createPolicy("detachedDocument", {createHTML: (s: string) => s}).createHTML(html)
}

`, `let _clipboardDoc: Document | null = null
function clipboardDoc() {
  return _clipboardDoc || (_clipboardDoc = document.implementation.createHTMLDocument("title"))
}

`, 'clipboard serialization document');
  source=exactReplace(source,
`  let doc = detachedDoc(), dom = serialize.slice(slice, {`,
`  let doc = clipboardDoc(), dom = serialize.slice(slice, {`,
'clipboard serialization document use');
  source=exactReplace(source,
`  let elt = detachedDoc().createElement("div")
  let firstTag = /<([a-z][^>\\s]+)/i.exec(html), wrap`,
`  let firstTag = /<([a-z][^>\\s]+)/i.exec(html), wrap`,
'clipboard detached element creation');
  source=exactReplace(source,
`  elt.innerHTML = maybeWrapTrusted(html)`,
`  let elt = parseInertHTML(html)`,
'clipboard shared inert parser');
  return source;
}

function patchState(source,helperImport){
  source=`import {parseInertHTML} from ${JSON.stringify(helperImport)}\n${source}`;
  return exactReplace(source,
`function readHTML(html: string): HTMLElement {
  if (typeof document != "object" || !document.implementation)
    throw new Error("Trying to parse an HTML string in a non-browser context.")
  let detachedDoc = document.implementation.createHTMLDocument("title")
  let trustedTypes = (window as any).trustedTypes
  if (trustedTypes) {
    // With the require-trusted-types-for CSP, Chrome will block
    // innerHTML, even on a detached document. This wraps the string in
    // a way that makes the browser allow us to use its parser again.
    html = trustedTypes.createPolicy("detachedDocument", {createHTML: (s: string) => s}).createHTML(html)
  }
  let elt = detachedDoc.createElement("div")
  elt.innerHTML = html
  return elt
}`,
`const readHTML = parseInertHTML`,
'state shared inert parser');
}


// Upstream history ships undo/redo menu buttons, which pull in Wordgard's
// generic menu and phrase tables. Study Director has its own toolbar.
function patchHistory(source){
  source=exactReplace(source,
`import {Command, Menu, undo as undoCmd, redo as redoCmd} from "wordgard/command"
import {phrases} from "wordgard/phrases"
`,
`import {Command, undo as undoCmd, redo as redoCmd} from "wordgard/command"
`,
'history menu imports');
  source=exactReplace(source,
`    undoButton,
    redoButton,
`,
``,
'history menu buttons in the extension');
  const buttons=source.indexOf('/// A menu button that undoes a change.');
  if(buttons<0||!/^export const redoButton = Menu\.Button\.define\(\{[\s\S]*?\n\}\)\n?$/mu.test(source.slice(buttons)))throw new Error('Wordgard patch anchor changed: history menu button definitions');
  return source.slice(0,buttons).replace(/\n+$/u,'\n');
}

const PATCHES=Object.freeze({
  'doc/node.ts':source=>patchNode(source),
  'editor/clipboard.ts':(source,helperImport)=>patchClipboard(source,helperImport),
  'state/state.ts':(source,helperImport)=>patchState(source,helperImport),
  'history/history.ts':source=>patchHistory(source)
});

export function applyWordgardSourcePatch(rel,source,helperImport='./inert-html'){
  const patch=PATCHES[rel];
  if(!patch)throw new Error(`Unsupported Wordgard patch target: ${rel}`);
  return patch(source,helperImport);
}

export function wordgardSourcePatchPlugin({root}){
  const vendorRoot=path.join(root,'vendor/wordgard/src');
  const inertHelper=path.join(root,'rich-text/wordgard-patches/inert-html.ts');
  const targets=new Map(Object.keys(PATCHES).map(rel=>[path.join(vendorRoot,rel),rel]));
  return {
    name:'study-director-wordgard-patches',
    setup(build){
      build.onLoad({filter:/[\\/]vendor[\\/]wordgard[\\/]src[\\/](?:doc[\\/]node|editor[\\/]clipboard|state[\\/]state|history[\\/]history)\.ts$/},args=>{
        const rel=targets.get(path.normalize(args.path));
        if(!rel)throw new Error(`Unexpected Wordgard patch target: ${args.path}`);
        const upstream=fs.readFileSync(args.path,'utf8');
        let helperImport=posix(path.relative(path.dirname(args.path),inertHelper));
        if(!helperImport.startsWith('.'))helperImport='./'+helperImport;
        const source=applyWordgardSourcePatch(rel,upstream,helperImport);
        return {contents:source,loader:'ts',resolveDir:path.dirname(args.path)};
      });
    }
  };
}

// Study Director Trusted Types policy name retained for CSP allow-listing: sd-inert-html.
