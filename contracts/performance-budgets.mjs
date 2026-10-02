const KiB=1024;
export const PERFORMANCE_BUDGETS=Object.freeze({
  referenceInsightsDays:590,
  insightsWorkerMinimumRecords:120,
  insightsShellMs:100,
  insightsCompleteMs:1000,
  insightsMaxMainThreadTaskMs:100,
  insightsTargetMainThreadTaskMs:50,
  insightsMaxDomChunkMs:100,
  // Search gates are catastrophic-regression guards, not byte/latency targets.
  ongoingNotesWorkerCold1000x100Ms:350,
  ongoingNotesWorkerHotP95Ms:25,
  ongoingNotesWorkerIncrementalMs:25,
  ongoingNotesHostSnapshotHotP95Ms:5,
  ongoingNotesExtremeColdMs:5000,
  ongoingNotesExtremeHotP95Ms:100,
  ongoingNotesExtremePostMs:50,
  // Historical transfer-size references. SDVB72B reports these measurements;
  // user-authorized features are not constrained by package byte ceilings.
  coldCriticalTransferBytes:500*KiB,
  fontTransferBytes:120*KiB,
  maxCriticalInlineStyleBytes:512,
  minifiedTextRawBytes:2500*KiB,
  // SDVB72A: OPFS, shared-content coordination and verified cleanup add 2.5 KiB
  // gzip over SDVB72. User-authorized +2 KiB ceiling; other budgets unchanged.
  minifiedTextGzipBytes:652*KiB,
  minifiedInsightsGzipBytes:165*KiB,
  coldPrecacheTransferBytes:1050*KiB
});

export function assertPerformanceBudgets(value=PERFORMANCE_BUDGETS){
  if(!Object.isFrozen(value))throw new TypeError('Performance budgets must be frozen.');
  for(const [name,limit] of Object.entries(value))if(!Number.isFinite(limit)||limit<=0)throw new TypeError(`Performance budget ${name} is invalid.`);
  if(value.insightsTargetMainThreadTaskMs>value.insightsMaxMainThreadTaskMs)throw new RangeError('Insights target exceeds its hard main-thread budget.');
  return true;
}
assertPerformanceBudgets();
