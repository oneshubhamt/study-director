const SDWorldChronologyEngine = (() => {
    'use strict';
    const FORMAT = 'study-director.world.chronology';
    const VERSION = 1;
    const DAY_MS = 86400000;
    const CHECKPOINT_SPAN_DAYS = 56;
    const MAX_CHECKPOINTS = 48;
    const MAX_SNAPSHOTS = 4;
    const MAX_REPLAY_FRAMES = 96;
    function ordinal(date) {
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
        const value = Date.parse(`${date}T00:00:00Z`);
        return Number.isFinite(value) ? Math.floor(value / DAY_MS) : null;
    }
    function dateFromOrdinal(value) { return new Date(Number(value) * DAY_MS).toISOString().slice(0, 10); }
    function clampOrdinal(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function weekStart(value) { return value - ((value + 3) % 7); }
    function weekEnd(value) { return weekStart(value) + 6; }
    function isWeekEnd(value) { return weekEnd(value) === value; }
    function sourceKey(timeline, datasetRevision, simulationVersion = '') {
        if (!timeline?.source) throw new TypeError('Chronology requires a BehaviourTimeline source.');
        return `${simulationVersion}|${timeline.source.currentStudyDate}|${datasetRevision == null ? 'fallback' : String(datasetRevision)}|${timeline.source.fingerprint}`;
    }
    function createTimeline(timeline) {
        if (!timeline?.source) throw new TypeError('Chronology requires a BehaviourTimeline.');
        const end = ordinal(timeline.source.currentStudyDate), firstRecord = ordinal(timeline.source.firstDate), start = firstRecord == null ? end : firstRecord;
        if (start == null || end == null) throw new RangeError('Chronology requires valid ISO study dates.');
        const activeDates = Object.freeze((timeline.days || []).filter(day => day?.active).map(day => day.date));
        const checkpoints = [];
        let cursor = weekEnd(start);
        if (cursor < start) cursor += 7;
        for (; cursor <= end; cursor += CHECKPOINT_SPAN_DAYS) checkpoints.push(dateFromOrdinal(cursor));
        if (isWeekEnd(end) && checkpoints.at(-1) !== dateFromOrdinal(end)) checkpoints.push(dateFromOrdinal(end));
        return Object.freeze({
            format: FORMAT, version: VERSION, startDate: dateFromOrdinal(start), endDate: dateFromOrdinal(end), startOrdinal: start, endOrdinal: end,
            totalDays: end - start + 1, activeDates, checkpointDates: Object.freeze(checkpoints)
        });
    }
    function clampDate(date, model) {
        const value = ordinal(date), fallback = model?.endOrdinal;
        return dateFromOrdinal(clampOrdinal(value == null ? fallback : value, model.startOrdinal, model.endOrdinal));
    }
    function offsetDate(date, days, model) { return dateFromOrdinal(clampOrdinal((ordinal(date) ?? model.endOrdinal) + Math.trunc(days || 0), model.startOrdinal, model.endOrdinal)); }
    function calendarShift(date, { months = 0, years = 0 } = {}, model) {
        const clean = clampDate(date, model), [year, month, day] = clean.split('-').map(Number);
        const monthIndex = month - 1 + Math.trunc(months || 0) + Math.trunc(years || 0) * 12, targetYear = year + Math.floor(monthIndex / 12), targetMonth = ((monthIndex % 12) + 12) % 12;
        const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate(), target = `${String(targetYear).padStart(4, '0')}-${String(targetMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
        return clampDate(target, model);
    }
    function scopeRange(date, scope, model) {
        const clean = clampDate(date, model), [year, month] = clean.split('-').map(Number);
        let start = model.startDate, end = model.endDate;
        if (scope === 'month') { start = `${year}-${String(month).padStart(2, '0')}-01`; end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10); }
        else if (scope === 'year') { start = `${year}-01-01`; end = `${year}-12-31`; }
        return Object.freeze({ startDate: clampDate(start, model), endDate: clampDate(end, model) });
    }
    function scopedReplayDates(date, scope, model, maxFrames = MAX_REPLAY_FRAMES) { const range = scopeRange(date, scope, model); return replayDates(range.startDate, range.endDate, model, maxFrames); }
    function position(date, model) { const value = clampOrdinal(ordinal(date) ?? model.endOrdinal, model.startOrdinal, model.endOrdinal); return value - model.startOrdinal; }
    function dateAtPosition(value, model) { return dateFromOrdinal(clampOrdinal(model.startOrdinal + Math.round(Number(value) || 0), model.startOrdinal, model.endOrdinal)); }
    function latestCheckpoint(date, model) {
        const target = ordinal(clampDate(date, model)); let best = null;
        for (const value of model.checkpointDates) { const o = ordinal(value); if (o <= target) best = value; else break; }
        return best;
    }
    function replayDates(fromDate, toDate, model, maxFrames = MAX_REPLAY_FRAMES) {
        let from = clampOrdinal(ordinal(fromDate) ?? model.startOrdinal, model.startOrdinal, model.endOrdinal), to = clampOrdinal(ordinal(toDate) ?? model.endOrdinal, model.startOrdinal, model.endOrdinal);
        if (from > to) [from, to] = [to, from];
        const span = Math.max(0, to - from), frames = Math.max(2, Math.min(maxFrames, span + 1));
        const step = span <= 45 ? 1 : span <= 365 ? 7 : Math.max(14, Math.ceil(span / Math.max(1, frames - 1)));
        const out = [];
        for (let value = from; value <= to; value += step) out.push(dateFromOrdinal(value));
        const end = dateFromOrdinal(to); if (out.at(-1) !== end) out.push(end);
        return Object.freeze(out.slice(-maxFrames));
    }
    function historicalDateTime(date, minuteOfDay = 12 * 60) {
        const minute = Math.max(0, Math.min(1439, Math.round(minuteOfDay)));
        return `${date}T${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00`;
    }
    function contributionSummary(timeline, snapshotDate, domainKey = '') {
        const end = ordinal(snapshotDate), rows = (timeline?.days || []).filter(day => { const value = ordinal(day?.date); return value !== null && value <= end; });
        let minutes = 0, depthMinutes = 0, revisionMinutes = 0, sessions = 0, activeDays = 0; const growth = [];
        for (const day of rows) {
            const effective = Number(day?.evidence?.effectiveMinutes) || 0, domains = day?.domains || [];
            const matched = domainKey ? domains.find(row => row.key === domainKey) : null, share = domainKey ? Math.min(1, Math.max(0, (Number(matched?.minutes) || 0) / Math.max(1e-9, effective))) : 1;
            const linked = domainKey ? Number(matched?.minutes) || 0 : effective; if (linked <= 0) continue;
            minutes += linked; depthMinutes += (Number(day?.evidence?.depthMinutes) || 0) * share; revisionMinutes += effective * (Number(day?.dimensions?.revision) || 0) * share; sessions += (Number(day?.evidence?.sessions) || 0) * share; if (day.active) activeDays += 1;
            growth.push({ date: day.date, score: linked + (Number(day?.evidence?.depthMinutes) || 0) * share * .45 + effective * (Number(day?.dimensions?.revision) || 0) * share * .25 });
        }
        growth.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
        return Object.freeze({ minutes, depthMinutes, revisionMinutes, sessions: Math.round(sessions), activeDays, growthDates: Object.freeze(growth.slice(0, 3).map(row => row.date)) });
    }
    function provenance(selection, snapshotDate, timeline, ecology, geometry) {
        if (!selection) return null;
        const source = selection.source || {}, detail = selection.detail || {}, facts = [];
        let establishedDate = snapshotDate, label = 'Present in this reconstruction', certainty = 'exact', domainKey = '';
        const cell = Number(source.cell), regionId = Number.isInteger(cell) ? geometry?.fields?.regionId?.[cell] : Number(source.regionId) || null, region = regionId ? ecology?.regions?.[regionId - 1] : null;
        if (selection.type === 'discovery') {
            establishedDate = String(source.occurredAt || snapshotDate).slice(0, 10); label = 'Discovery occurred';
            facts.push(...(source.provenance?.conditions || [])); if (source.calendarBucket) facts.push(`Deterministic calendar bucket: ${source.calendarBucket}`);
        } else if (selection.type === 'region' || selection.type === 'water' || selection.type === 'geology') {
            establishedDate = timeline?.source?.firstDate || snapshotDate; label = selection.type === 'water' ? 'Hydrology present from world origin' : selection.type === 'geology' ? 'Landscape feature visible by' : 'Region present from world origin'; certainty = selection.type === 'region' || selection.type === 'water' ? 'exact' : 'derived';
        } else if (selection.type === 'wildlife') {
            label = 'Observed in this historical window'; facts.push(detail.behavior || 'active', detail.habitatClass || 'qualified habitat');
        } else if (selection.type === 'tree') {
            const cohortKey = source.archetype === 'pioneer-light' ? 'pioneer' : source.archetype === 'riparian-willow' ? 'wetland' : source.archetype === 'conifer-spire' || source.archetype === 'ancient-spread' ? 'canopy' : 'understory';
            const cohort = region?.cohorts?.find(row => row.key === cohortKey), age = Math.max(0, Number(cohort?.ageDays) || 0), snap = ordinal(snapshotDate), first = ordinal(timeline?.source?.firstDate);
            if (snap != null && age > 0) establishedDate = dateFromOrdinal(Math.max(first ?? snap, Math.round(snap - age)));
            label = 'Ecological establishment period'; certainty = 'cohort-derived'; domainKey = region?.domainInfluence?.[0]?.key || '';
            if (region?.habitatClass) facts.push(String(region.habitatClass).replaceAll('-', ' ')); if (domainKey) facts.push(`Strongest domain influence: ${domainKey}`); facts.push(`Succession ${Math.round((Number(region?.succession) || 0) * 100)}%`);
        } else if (['flower', 'shrub', 'deadwood', 'rock'].includes(selection.type)) {
            establishedDate = timeline?.source?.firstDate || snapshotDate; label = selection.type === 'deadwood' ? 'Deadwood accumulation visible by' : 'Local feature established by'; certainty = 'ecology-derived'; domainKey = region?.domainInfluence?.[0]?.key || '';
            if (region?.habitatClass) facts.push(String(region.habitatClass).replaceAll('-', ' '));
        }
        if (region && !domainKey) domainKey = region.domainInfluence?.[0]?.key || '';
        if (region) {
            if (region.habitatClass && !facts.includes(String(region.habitatClass).replaceAll('-', ' '))) facts.push(`Habitat: ${String(region.habitatClass).replaceAll('-', ' ')}`);
            if (domainKey && selection.type !== 'tree') facts.push(`Strongest domain influence: ${domainKey}`);
            const contribution = contributionSummary(timeline, snapshotDate, domainKey);
            if (contribution.minutes > 0) facts.push(`${domainKey ? 'Domain-linked' : 'Regional'} study contribution: ${(contribution.minutes / 60).toFixed(1)} h across ${contribution.activeDays} active days`);
            if (contribution.depthMinutes > 0) facts.push(`Deep-work contribution: ${(contribution.depthMinutes / 60).toFixed(1)} h · ~${contribution.sessions} sessions`);
            if (contribution.revisionMinutes > 0) facts.push(`Revision contribution: ${(contribution.revisionMinutes / 60).toFixed(1)} h`);
            if (contribution.growthDates.length) facts.push(`Major growth periods: ${contribution.growthDates.join(' · ')}`);
        }
        return Object.freeze({ establishedDate, label, certainty, facts: Object.freeze(facts.filter(Boolean).slice(0, 9)) });
    }
    return Object.freeze({ format: FORMAT, version: VERSION, limits: Object.freeze({ checkpointSpanDays: CHECKPOINT_SPAN_DAYS, maxCheckpoints: MAX_CHECKPOINTS, maxSnapshots: MAX_SNAPSHOTS, maxReplayFrames: MAX_REPLAY_FRAMES }), ordinal, dateFromOrdinal, weekEnd, isWeekEnd, sourceKey, createTimeline, clampDate, offsetDate, calendarShift, scopeRange, scopedReplayDates, position, dateAtPosition, latestCheckpoint, replayDates, historicalDateTime, contributionSummary, provenance });
})();
