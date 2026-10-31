import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hostScripts,htmlSource} from './module-manifest.mjs';
import {compileScript} from './source-script.mts';

const sourceRoot=fileURLToPath(new URL('../source/',import.meta.url));

// Preserve inline execution, DOM position and script boundaries. This shared
// path serves build composition and source-text tests; it adds no runtime loader.
export function composeHostHtml(template,readSource){
  let previous=-1;
  for(const script of hostScripts){
    const position=template.indexOf(script.marker);
    if(position<0||template.indexOf(script.marker,position+script.marker.length)!==-1){
      throw new Error(`Host marker must occur exactly once: ${script.id}`);
    }
    if(position<=previous)throw new Error(`Host script order differs from manifest: ${script.id}`);
    if(!template.slice(0,position).endsWith('<script>')||!template.slice(position+script.marker.length).startsWith('</script>')){
      throw new Error(`Host marker must occupy a plain inline script: ${script.id}`);
    }
    previous=position;
  }
  let html=template;
  for(const script of hostScripts){
    const body=compileScript(readSource(script.source),script.source);
    if(/<\/script/i.test(body))throw new Error(`Host source contains a closing script tag: ${script.id}`);
    html=html.replace(script.marker,()=>body);
  }
  if(/@SD_HOST_[A-Z_]+@/.test(html))throw new Error('Unknown or unresolved host marker');
  return html;
}

export function readHostHtml(root=sourceRoot){
  return composeHostHtml(fs.readFileSync(path.join(root,htmlSource),'utf8'),
    name=>fs.readFileSync(path.join(root,name),'utf8'));
}
