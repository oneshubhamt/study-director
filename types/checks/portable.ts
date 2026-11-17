import type {InsightsLabEvidence,InsightsPreparedWindow,InsightsResult} from '../../source/external/insights-model.ts';

const value: unknown = JSON.parse('{}');
void value;
// @ts-expect-error -- portable contracts have no DOM.
void document;
// @ts-expect-error -- portable contracts have no workers.
void postMessage;
// @ts-expect-error -- portable contracts have no Node globals.
void process;

// P5.9: the checked model must expose an exact type-only handoff for P5.10.
declare const insightsResult: InsightsResult;
declare const insightsWindow: InsightsPreparedWindow;
const insightsLab: InsightsLabEvidence=insightsResult.getLabEvidence();
void insightsLab;
void insightsWindow.records;
