import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCli} from './build.mts';
export * from './build.mts';
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))buildCli();
