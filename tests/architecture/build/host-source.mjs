import assert from 'node:assert/strict';
import fs from 'node:fs';
import {composeHostHtml,readHostHtml} from '../../../build/host-source.mjs';
import {hostScripts} from '../../../build/module-manifest.mjs';
import {readScript} from '../../../build/source-script.mts';

const template=fs.readFileSync('source/app.html','utf8');
const html=readHostHtml();
const inline=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gu)].filter(row=>! /\bsrc\s*=/u.test(row[1]));
assert.equal(inline.length,hostScripts.length);
hostScripts.forEach((script,index)=>assert.equal(inline[index][2],readScript(`source/${script.source}`),`${script.id}: preserve body and position`));
assert.doesNotMatch(html,/@SD_HOST_/u);
assert.ok(html.indexOf('studyDirector.profileScope.v1')<html.indexOf('studyDirector.presentationKernel.v1'));
assert.ok(html.indexOf('studyDirector.installCapture.v1')<html.indexOf('@@SD_EXTERNAL_GLASS_FILENAME@@'));
assert.ok(html.indexOf('@@SD_RICH_TEXT_FILENAME@@')<html.indexOf('const INTERNAL_MODULES='));
assert.ok(html.indexOf('StartupLifecycle.start();')<html.indexOf('@@SD_EXTERNAL_DRIVE_FILENAME@@'));

const [first,second]=hostScripts;
const fixture=hostScripts.map(script=>`<script>${script.marker}</script>`).join('\n');
const body="\n(()=>{const value='$& $` $$';})();\n";
assert.equal(composeHostHtml(fixture,()=>body),hostScripts.map(()=>`<script>${body}</script>`).join('\n'),'replacement must preserve literal dollar sequences');
assert.throws(()=>composeHostHtml(fixture.replace(first.marker,''),()=>body),/exactly once/u);
assert.throws(()=>composeHostHtml(fixture+first.marker,()=>body),/exactly once/u);
const reversed=fixture.replace(first.marker,'SWAP').replace(second.marker,first.marker).replace('SWAP',second.marker);
assert.throws(()=>composeHostHtml(reversed,()=>body),/order/u);
assert.throws(()=>composeHostHtml(fixture.replace('<script>','<script defer>'),()=>body),/plain inline script/u);
assert.throws(()=>composeHostHtml(fixture+'<!-- @SD_HOST_UNKNOWN@ -->',()=>body),/Unknown or unresolved/u);
assert.throws(()=>composeHostHtml(fixture,()=>'</SCRIPT>'),/closing script tag/u);
console.log(JSON.stringify({status:'PASS',suite:'host-source',scripts:hostScripts.length,malformedTemplatesRejected:true,literalReplacement:true}));
