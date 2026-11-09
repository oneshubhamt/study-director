import fs from 'node:fs';
import path from 'node:path';
import {RELEASE_TEST_SET} from './release-tests.mjs';

export function discoverTestFiles(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(directory,entry.name);
    return entry.isDirectory()?discoverTestFiles(file):entry.isFile()&&/\.(?:mjs|mts)$/u.test(entry.name)?[file]:[];
  });
}
export function discoverFastTests(root,category){
  return discoverTestFiles(path.join(root,'tests',category))
    .map(file=>path.relative(root,file).split(path.sep).join('/'))
    .filter(file=>!RELEASE_TEST_SET.has(file)).sort();
}
