import {privateModules} from '../../build/module-manifest.mts';
import {readScript} from '../../build/source-script.mts';
export function coreScriptPath(id:string){const entry=privateModules.find(row=>row.id===id);if(!entry)throw new Error(`Unknown core module: ${id}`);return `source/${entry.source}`;}
export function readCoreScript(id:string){return readScript(coreScriptPath(id));}
