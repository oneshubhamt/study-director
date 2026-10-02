import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {WORDGARD_METADATA} from './wordgard-metadata.mjs';

const EXPECTED_UPSTREAM_SHA256=WORDGARD_METADATA.patchInputSha256;

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
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


function patchInput(source){
  source=exactReplace(source,
`function copy(wg: Wordgard, event: ClipboardEvent) {
  let {state} = wg
  if (!state.selection.empty && event.clipboardData) { // FIXME block-wise copying
    let {slice, context} = selectionSlice(state)
    writeClipboard(state, slice, context, event.clipboardData)
    if (event.type == "cut" && !state.readOnly)
      wg.dispatch({
        changes: state.selection.ranges.map(r => ({from: r.from, to: r.to, fit: true})),
        selection: (cx, changes) => GardSelection.near(cx, changes.mapPos(state.selection.from, -1), 1),
        scrollIntoView: true,
        userEvent: "delete.cut"
      })
  }
  return true
}`,
`function copy(wg: Wordgard, event: ClipboardEvent) {
  wg.flush()
  let {state} = wg
  if (state.selection.empty) return false
  if (!event.clipboardData) return false
  let {slice, context} = selectionSlice(state)
  writeClipboard(state, slice, context, event.clipboardData)
  if (event.type == "cut" && !state.readOnly)
    wg.dispatch({
      changes: state.selection.ranges.map(r => ({from: r.from, to: r.to, fit: true})),
      selection: (cx, changes) => GardSelection.near(cx, changes.mapPos(state.selection.from, -1), 1),
      scrollIntoView: true,
      userEvent: "delete.cut"
    })
  return true
}`,
'input native cut fallback');
  return exactReplace(source,
`  deleteContent: wg => {
    let tr = deleteSelection(wg.state)
    if (tr) wg.dispatch(tr)
    return !!tr
  },`,
`  deleteContent: wg => {
    let tr = deleteSelection(wg.state)
    if (tr) wg.dispatch(tr)
    return !!tr
  },
  deleteByCut: wg => {
    wg.flush()
    let {state} = wg
    if (state.readOnly || state.selection.empty) return false
    wg.dispatch({
      changes: state.selection.ranges.map(r => ({from: r.from, to: r.to, fit: true})),
      selection: (cx, changes) => GardSelection.near(cx, changes.mapPos(state.selection.from, -1), 1),
      scrollIntoView: true,
      userEvent: "delete.cut"
    })
    return true
  },`,
'input beforeinput cut deletion');
}

export function applyWordgardSourcePatch(rel,source,helperImport='./inert-html'){
  const expected=EXPECTED_UPSTREAM_SHA256[rel];
  if(!expected)throw new Error(`Unsupported Wordgard patch target: ${rel}`);
  const actual=sha256(source);
  if(actual!==expected)
    throw new Error(`Wordgard upstream source changed at ${rel}; expected ${expected}, got ${actual}. Rebase the Study Director patch explicitly.`);
  if(rel==='doc/node.ts')return patchNode(source);
  if(rel==='editor/clipboard.ts')return patchClipboard(source,helperImport);
  if(rel==='editor/input.ts')return patchInput(source);
  return patchState(source,helperImport);
}

export function wordgardSourcePatchPlugin({root}){
  const vendorRoot=path.join(root,'vendor/wordgard/src');
  const inertHelper=path.join(root,'rich-text/wordgard-patches/inert-html.ts');
  const targets=new Map([
    [path.join(vendorRoot,'doc/node.ts'),'doc/node.ts'],
    [path.join(vendorRoot,'editor/clipboard.ts'),'editor/clipboard.ts'],
    [path.join(vendorRoot,'editor/input.ts'),'editor/input.ts'],
    [path.join(vendorRoot,'state/state.ts'),'state/state.ts'],
  ]);
  return {
    name:'study-director-wordgard-patches',
    setup(build){
      build.onLoad({filter:/[\\/]vendor[\\/]wordgard[\\/]src[\\/](?:doc[\\/]node|editor[\\/](?:clipboard|input)|state[\\/]state)\.ts$/},args=>{
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
