import {externalModules} from '../../build/module-manifest.mjs';
import {readRuntimeSource} from './runtime-source.mjs';

const insights=externalModules.find(module=>module.id==='insights');
if(!insights||!Array.isArray(insights.sources))throw new Error('Insights runtime sources are not declared.');
export const insightsRuntimeSources=Object.freeze([...insights.sources]);
export const insightsModelSources=Object.freeze(insightsRuntimeSources.filter(source=>source==='external/insights-model.ts'));
export function readInsightsModelRuntimeSource(){
  return insightsModelSources.map(source=>readRuntimeSource(new URL(`../../source/${source}`,import.meta.url))).join('\n');
}

export function readInsightsRuntimeSource(){
  return insightsRuntimeSources.map(source=>readRuntimeSource(new URL(`../../source/${source}`,import.meta.url))).join('\n');
}
