import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {wordgardDeclarationsCli} from './wordgard-declarations.mts';
export * from './wordgard-declarations.mts';
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))wordgardDeclarationsCli();
