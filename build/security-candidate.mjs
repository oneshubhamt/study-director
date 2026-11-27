import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {securityCandidateCli} from './security-candidate.mts';
export * from './security-candidate.mts';
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))securityCandidateCli();
