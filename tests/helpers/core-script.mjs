import {privateModules} from '../../build/module-manifest.mjs';
import {readScript} from '../../build/source-script.mts';
export function coreScriptPath(id){const entry=privateModules.find(row=>row.id===id);if(!entry)throw new Error(`Unknown core module: ${id}`);return `source/${entry.source}`;}
export function readCoreScript(id){return readScript(coreScriptPath(id));}
