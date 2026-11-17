import {externalModules} from '../../build/module-manifest.mjs';
import {readRuntimeSource} from './runtime-source.mjs';

const insights=externalModules.find(module=>module.id==='insights');
if(!insights||!Array.isArray(insights.sources))throw new Error('Insights runtime sources are not declared.');
export const insightsModelSources=Object.freeze(insights.sources.slice(0,-1));
export function readInsightsModelRuntimeSource(){
  return insightsModelSources.map(source=>readRuntimeSource(new URL(`../../source/${source}`,import.meta.url))).join('\n');
}
