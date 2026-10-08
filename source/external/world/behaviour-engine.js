const SDWorldBehaviourEngine = (() => {
    'use strict';
    const FORMAT = 'study-director.world.behaviour-timeline';
    const VERSION = 1;
    const MIN_SUPPORTED_DATE = '2025-01-01';
    const MAX_RECORDS = 10000;
    const MAX_TASKS_PER_DAY = 160;
    const MAX_DOMAINS_PER_DAY = 24;
    const DOMAIN_BUCKETS = 512;
    const MAX_DAY_MINUTES = 1440 * MAX_TASKS_PER_DAY;
    const ACTIVE_MINUTES = 5;
    const WINDOW_SPECS = Object.freeze([Object.freeze(['d7', 7]), Object.freeze(['d28', 28]), Object.freeze(['d90', 90])]);
    const CURRENT_WINDOW_SPECS = Object.freeze([Object.freeze(['d7', 7]), Object.freeze(['d28', 28]), Object.freeze(['d90', 90]), Object.freeze(['d365', 365])]);
    const REVISION_PATTERN = /(?:^|\b)(?:revision|revise|revising|review|recall|retrieval|spaced\s+repetition|flashcards?|anki|active\s+recall)(?:\b|$)/iu;
    const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu;
    const LN2 = Math.log(2), TAU = Math.PI * 2, DAY_MS = 86400000;
    function clamp(value, min = 0, max = 1) { return Math.min(max, Math.max(min, value)); }
    function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
    function bounded(value, min, max, fallback = null) { const number = finite(value); return number === null ? fallback : clamp(number, min, max); }
    function round(value, digits = 6) { if (value === null || value === undefined || !Number.isFinite(value))
        return null; const factor = 10 ** digits; return Math.round(value * factor) / factor; }
    function cleanText(value, max = 240) { return String(value ?? '').replace(CONTROL_CHARS, ' ').replace(/\s+/gu, ' ').trim().slice(0, max); }
    function cleanToken(value, max = 160) { return cleanText(value, max).toLocaleLowerCase('en-US'); }
    function positiveMinutes(value, max = MAX_DAY_MINUTES) { const number = finite(value); return number === null ? null : clamp(number, 0, max); }
    function isoOrdinal(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(String(value || ''));
        if (!match)
            return null;
        const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
        const stamp = Date.UTC(year, month - 1, day), date = new Date(stamp);
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
            return null;
        return Math.floor(stamp / DAY_MS);
    }
    function validStudyDate(value, asOfOrdinal) { const ordinal = isoOrdinal(value); return ordinal !== null && String(value) >= MIN_SUPPORTED_DATE && ordinal <= asOfOrdinal ? ordinal : null; }
    function smoothstep01(value) { const x = clamp(value); return x * x * (3 - 2 * x); }
    function saturateMinutes(minutes, scale) { const value = Math.max(0, Number(minutes) || 0); return value <= 0 ? 0 : 1 - Math.exp(-value / Math.max(1, scale)); }
    function depthKernel(meanSessionMinutes) { return smoothstep01((Math.max(0, meanSessionMinutes) - 15) / 75); }
    function recencyKernel(daysSinceActive) { const days = Math.max(0, Number(daysSinceActive) || 0); return clamp(Math.exp(-LN2 * days / 7)); }
    function fnv1a32(value, seed = 0x811c9dc5) { let hash = seed >>> 0; const text = String(value); for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    } return hash >>> 0; }
    function domainEvidenceFingerprint(entries) { let left = 0x811c9dc5, right = 0x9e3779b9; for (const [key, minutes] of entries) {
        const token = `${key}=${round(minutes, 3)}|`;
        left = fnv1a32(token, left);
        right = fnv1a32(token, right);
    } return `${left.toString(16).padStart(8, '0')}${right.toString(16).padStart(8, '0')}`; }
    function domainBucket(key) { return fnv1a32(key) % DOMAIN_BUCKETS; }
    function stableCompare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
    function deepFreeze(root) {
        if (!root || typeof root !== 'object' || Object.isFrozen(root))
            return root;
        const stack = [root], seen = new Set();
        while (stack.length) {
            const value = stack.pop();
            if (!value || typeof value !== 'object' || seen.has(value))
                continue;
            seen.add(value);
            for (const child of Object.values(value))
                if (child && typeof child === 'object' && !Object.isFrozen(child))
                    stack.push(child);
            Object.freeze(value);
        }
        return root;
    }
    function canonicalTaskArea(task) { return cleanToken(task && ((task.areaKey || task.area) || task.areaLabel) || 'general study', 160) || 'general study'; }
    function taskRevision(task) { const text = `${cleanText(task && task.name, 240)} ${cleanText(task && task.areaLabel, 160)} ${cleanText(task && task.area, 160)}`; return REVISION_PATTERN.test(text); }
    function parseLocalMinute(task) {
        const direct = finite(task && task.actualStartLocalMinute);
        if (direct !== null && direct >= 0 && direct < 1440)
            return direct;
        return null;
    }
    function addWeight(map, key, weight) { if (!(weight > 0))
        return; map.set(key, (map.get(key) || 0) + weight); }
    function mapEntriesByWeight(map) { return [...map.entries()].filter(([, weight]) => weight > 0).sort((a, b) => b[1] - a[1] || stableCompare(a[0], b[0])); }
    function normalizedEntropy(entries, total) {
        if (!(total > 0) || !entries.length)
            return null;
        if (entries.length === 1)
            return 0;
        let entropy = 0;
        for (const [, weight] of entries) {
            const p = weight / total;
            if (p > 0)
                entropy -= p * Math.log(p);
        }
        return clamp(entropy / Math.log(entries.length));
    }
    function hhi(entries, total) { if (!(total > 0) || !entries.length)
        return null; let value = 0; for (const [, weight] of entries) {
        const p = weight / total;
        value += p * p;
    } return clamp(value); }
    function normalizeCandidate(record, asOfOrdinal, diagnostics) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) {
            diagnostics.invalidRecords += 1;
            return null;
        }
        const date = cleanText(record.date, 10), ordinal = validStudyDate(date, asOfOrdinal);
        if (ordinal === null) {
            diagnostics.invalidDates += 1;
            return null;
        }
        const rawTasks = Array.isArray(record.tasks) ? record.tasks : [];
        if (rawTasks.length > MAX_TASKS_PER_DAY)
            diagnostics.cappedTasks += rawTasks.length - MAX_TASKS_PER_DAY;
        const tasks = rawTasks.slice(0, MAX_TASKS_PER_DAY).filter(task => task && typeof task === 'object' && !Array.isArray(task) && cleanToken(task.kind, 24) === 'work');
        let plannedTaskSum = 0, plannedKnown = false, completedTaskSum = 0, completionKnown = false, actualTaskSum = 0, actualKnown = false;
        let depthNumerator = 0, depthMinutes = 0, totalSessions = 0, temporalWeight = 0, temporalSin = 0, temporalCos = 0, revisionBase = 0, allocationBase = 0;
        const areaWeights = new Map();
        for (const task of tasks) {
            const duration = positiveMinutes(task.dur, 1440), actualSeconds = bounded(task.actualSeconds, 0, 1440 * 60, null), completion = bounded(task.completion, 0, 100, null);
            if (duration !== null) {
                plannedTaskSum += duration;
                plannedKnown = true;
            }
            let completed = null;
            if (duration !== null && completion !== null) {
                completed = duration * completion / 100;
                completedTaskSum += completed;
                completionKnown = true;
            }
            let actual = null;
            if (actualSeconds !== null) {
                actual = actualSeconds / 60;
                actualTaskSum += actual;
                actualKnown = true;
            }
            const effective = actual !== null ? actual : (completed !== null ? completed : 0);
            if (effective > 0) {
                const area = canonicalTaskArea(task);
                addWeight(areaWeights, area, effective);
                allocationBase += effective;
                if (taskRevision(task))
                    revisionBase += effective;
            }
            if (actual !== null && actual > 0) {
                const sessions = Math.max(1, Math.min(1000, Math.round(finite(task.sessionCount) || 1))), meanSession = actual / sessions, score = depthKernel(meanSession);
                depthNumerator += score * actual;
                depthMinutes += actual;
                totalSessions += sessions;
                const minute = parseLocalMinute(task);
                if (minute !== null) {
                    const angle = minute / 1440 * TAU;
                    temporalSin += Math.sin(angle) * actual;
                    temporalCos += Math.cos(angle) * actual;
                    temporalWeight += actual;
                }
            }
        }
        const metricPlanned = positiveMinutes(record.originalPlannedStudyMinutes), metricCompleted = positiveMinutes(record.completedEquivalentMinutes), metricFocused = positiveMinutes(record.actualFocusMinutes);
        const plannedMinutes = metricPlanned !== null ? metricPlanned : (plannedKnown ? plannedTaskSum : null);
        const completedMinutes = metricCompleted !== null ? metricCompleted : (completionKnown ? completedTaskSum : null);
        const focusedMinutes = metricFocused !== null ? metricFocused : (actualKnown ? actualTaskSum : null);
        const effectiveMinutes = focusedMinutes !== null ? focusedMinutes : (completedMinutes !== null ? completedMinutes : 0);
        if (effectiveMinutes > 0) {
            if (allocationBase > 0) {
                const scale = effectiveMinutes / allocationBase;
                for (const [key, weight] of areaWeights)
                    areaWeights.set(key, weight * scale);
                revisionBase *= scale;
            }
            else {
                areaWeights.set('general study', effectiveMinutes);
                allocationBase = effectiveMinutes;
            }
        }
        else
            areaWeights.clear();
        const areaEntries = mapEntriesByWeight(areaWeights), domainTotal = areaEntries.reduce((sum, [, weight]) => sum + weight, 0);
        const topEntries = areaEntries.slice(0, MAX_DOMAINS_PER_DAY), otherDomainMinutes = areaEntries.slice(MAX_DOMAINS_PER_DAY).reduce((sum, [, weight]) => sum + weight, 0);
        if (otherDomainMinutes > 0)
            diagnostics.truncatedDomainDays += 1;
        const bucketMap = new Map();
        for (const [key, weight] of areaEntries)
            addWeight(bucketMap, domainBucket(key), weight);
        const bucketWeights = [...bucketMap.entries()].sort((a, b) => a[0] - b[0]);
        const depth = depthMinutes > 0 ? clamp(depthNumerator / depthMinutes) : null;
        const completion = plannedMinutes !== null && plannedMinutes > 0 && completedMinutes !== null ? clamp(completedMinutes / plannedMinutes) : null;
        const revision = domainTotal > 0 ? clamp(revisionBase / domainTotal) : null;
        const diversityRaw = normalizedEntropy(areaEntries, domainTotal), diversity = diversityRaw === null ? null : clamp(diversityRaw * saturateMinutes(domainTotal, 120));
        const concentration = hhi(areaEntries, domainTotal);
        let temporalRhythm = null;
        if (temporalWeight > 0) {
            const resultant = Math.hypot(temporalSin, temporalCos) / temporalWeight, angle = (Math.atan2(temporalSin, temporalCos) + TAU) % TAU;
            temporalRhythm = { regularity: clamp(resultant * saturateMinutes(temporalWeight, 60)), phaseMinute: Math.round(angle / TAU * 1440) % 1440 };
        }
        const savedAt = cleanText(record.updatedAt || record.savedAt || '', 40);
        const day = {
            date, ordinal, active: effectiveMinutes >= ACTIVE_MINUTES,
            plannedMinutes, completedMinutes, focusedMinutes, effectiveMinutes,
            workTasks: tasks.length, totalSessions, depth, depthMinutes, completion, revision, revisionMinutes: revisionBase,
            volume: saturateMinutes(effectiveMinutes, 180), diversity, concentration, temporalRhythm, temporalWeight, temporalSin, temporalCos,
            domains: topEntries.map(([key, minutes]) => ({ key, minutes })), otherDomainMinutes, bucketWeights, domainFingerprint: domainEvidenceFingerprint(areaEntries), savedAt,
            evidenceRank: (focusedMinutes !== null ? 8 : 0) + (completedMinutes !== null ? 4 : 0) + (plannedMinutes !== null ? 2 : 0) + Math.min(1, tasks.length)
        };
        day.tieKey = JSON.stringify([day.evidenceRank, savedAt, round(effectiveMinutes, 3), round(plannedMinutes, 3), round(completedMinutes, 3), day.domainFingerprint]);
        return day;
    }
    function chooseDuplicate(a, b) { if (a.evidenceRank !== b.evidenceRank)
        return a.evidenceRank > b.evidenceRank ? a : b; if (a.savedAt !== b.savedAt)
        return a.savedAt > b.savedAt ? a : b; return a.tieKey >= b.tieKey ? a : b; }
    function ewmaScalar(previous, value, deltaDays, halfLife) { const decay = Math.exp(-LN2 * Math.max(1, deltaDays) / halfLife), alpha = 1 - Math.exp(-LN2 / halfLife); return previous * decay + alpha * value; }
    function ewmaObserved(state, value, deltaDays, halfLife) { const decay = Math.exp(-LN2 * Math.max(1, deltaDays) / halfLife), alpha = 1 - Math.exp(-LN2 / halfLife); state.numerator *= decay; state.weight *= decay; if (value !== null) {
        state.numerator += alpha * value;
        state.weight += alpha;
    } return state.weight > 1e-9 ? state.numerator / state.weight : null; }
    function weekKey(ordinal) { return Math.floor(ordinal / 7); }
    function makeAccumulator(windowDays = Infinity) { return {
        windowDays, start: 0, savedDays: 0, activeDays: 0, sumVolume: 0, sumEffective: 0, sumEffectiveSq: 0, depthNumerator: 0, depthMinutes: 0, planned: 0,
            completed: 0, completionPlanned: 0, revision: 0, domainMinutes: 0, timeWeight: 0, timeSin: 0, timeCos: 0, recoverySum: 0, recoveryEvents: 0, bins: new Float64Array(DOMAIN_BUCKETS),
            positiveBins: 0, sumWLogW: 0, sumBinSquares: 0, activeWeeks: new Map(), latestActiveOrdinal: null
    }; }
    function wLogW(value) { return value > 0 ? value * Math.log(value) : 0; }
    function updateBin(acc, index, delta) { const old = acc.bins[index], next = Math.max(0, old + delta); acc.sumWLogW += wLogW(next) - wLogW(old); acc.sumBinSquares += next * next - old * old; if (old <= 1e-9 && next > 1e-9)
        acc.positiveBins += 1;
    else if (old > 1e-9 && next <= 1e-9)
        acc.positiveBins -= 1; acc.bins[index] = next; }
    function updateWeek(acc, day, delta) { if (!day.active)
        return; const key = weekKey(day.ordinal), old = acc.activeWeeks.get(key) || 0, next = old + delta; if (next <= 0)
        acc.activeWeeks.delete(key);
    else
        acc.activeWeeks.set(key, next); }
    function addDay(acc, day, direction = 1) {
        acc.savedDays += direction;
        if (day.active) {
            acc.activeDays += direction;
            if (direction > 0)
                acc.latestActiveOrdinal = acc.latestActiveOrdinal === null ? day.ordinal : Math.max(acc.latestActiveOrdinal, day.ordinal);
            else if (day.ordinal === acc.latestActiveOrdinal)
                acc.latestActiveOrdinal = null;
        }
        acc.sumVolume += direction * day.volume;
        acc.sumEffective += direction * day.effectiveMinutes;
        acc.sumEffectiveSq += direction * day.effectiveMinutes * day.effectiveMinutes;
        if (day.depth !== null && day.depthMinutes > 0) {
            acc.depthNumerator += direction * day.depth * day.depthMinutes;
            acc.depthMinutes += direction * day.depthMinutes;
        }
        if (day.plannedMinutes !== null && day.plannedMinutes > 0 && day.completedMinutes !== null) {
            acc.planned += direction * day.plannedMinutes;
            acc.completed += direction * day.completedMinutes;
            acc.completionPlanned += direction * day.plannedMinutes;
        }
        if (day.revision !== null) {
            acc.revision += direction * day.revisionMinutes;
            acc.domainMinutes += direction * day.effectiveMinutes;
        }
        if (day.temporalWeight > 0) {
            acc.timeWeight += direction * day.temporalWeight;
            acc.timeSin += direction * day.temporalSin;
            acc.timeCos += direction * day.temporalCos;
        }
        if (day.recovery > 0) {
            acc.recoverySum += direction * day.recovery;
            acc.recoveryEvents += direction;
        }
        for (const [index, weight] of day.bucketWeights)
            updateBin(acc, index, direction * weight);
        updateWeek(acc, day, direction);
    }
    function trimAccumulator(acc, days, asOfOrdinal) { if (!Number.isFinite(acc.windowDays))
        return; const cutoff = asOfOrdinal - acc.windowDays + 1; while (acc.start < days.length && days[acc.start].ordinal < cutoff) {
        addDay(acc, days[acc.start], -1);
        acc.start += 1;
    } }
    function accumulatorVector(acc, asOfOrdinal, firstOrdinal, { lifetime = false } = {}) {
        const maximum = Number.isFinite(acc.windowDays) ? acc.windowDays : Math.max(1, asOfOrdinal - firstOrdinal + 1), calendarDays = Math.max(1, Math.min(maximum, asOfOrdinal - firstOrdinal + 1));
        const mean = acc.sumEffective / calendarDays, variance = Math.max(0, acc.sumEffectiveSq / calendarDays - mean * mean), cv = mean > 0 ? Math.sqrt(variance) / Math.max(30, mean) : 0, regularity = mean > 0 ? 1 / (1 + cv) : 0, activeRatio = clamp(acc.activeDays / calendarDays);
        const consistency = clamp(Math.sqrt(activeRatio * regularity)), volume = clamp(acc.sumVolume / calendarDays), depth = acc.depthMinutes > 1e-9 ? clamp(acc.depthNumerator / acc.depthMinutes) : null,
            completion = acc.completionPlanned > 1e-9 ? clamp(acc.completed / acc.planned) : null, revision = acc.domainMinutes > 1e-9 ? clamp(acc.revision / acc.domainMinutes) : null,
            recency = acc.latestActiveOrdinal === null ? 0 : recencyKernel(asOfOrdinal - acc.latestActiveOrdinal);
        let diversity = null, concentration = null;
        if (acc.sumEffective > 1e-9 && acc.positiveBins > 0) {
            const entropy = Math.log(acc.sumEffective) - acc.sumWLogW / acc.sumEffective, normalized = acc.positiveBins > 1 ? clamp(entropy / Math.log(acc.positiveBins)) : 0, adequacy = saturateMinutes(acc.sumEffective / Math.max(1, acc.activeDays), 120);
            diversity = clamp(normalized * adequacy);
            concentration = clamp(acc.sumBinSquares / (acc.sumEffective * acc.sumEffective));
        }
        let temporalRhythm = null;
        if (acc.timeWeight > 1e-9) {
            const resultant = Math.hypot(acc.timeSin, acc.timeCos) / acc.timeWeight, angle = (Math.atan2(acc.timeSin, acc.timeCos) + TAU) % TAU, adequacy = saturateMinutes(acc.timeWeight / Math.max(1, acc.activeDays), 60);
            temporalRhythm = { regularity: round(clamp(resultant * adequacy)), phaseMinute: Math.round(angle / TAU * 1440) % 1440 };
        }
        const weeks = Math.max(1, Math.ceil(calendarDays / 7)), activeWeekRatio = clamp(acc.activeWeeks.size / weeks), maturity = lifetime ? 1 - Math.exp(-weeks / 26) : 1, persistence = clamp(Math.sqrt(activeWeekRatio * activeRatio) * maturity);
        return {
            volume: round(volume), depth: round(depth), consistency: round(consistency), completion: round(completion), revision: round(revision), diversity: round(diversity),
                temporalRhythm, concentration: round(concentration), recency: round(recency), recovery: round(acc.recoveryEvents ? clamp(acc.recoverySum / acc.recoveryEvents) : 0),
                persistence: round(persistence),
            evidence: {
                calendarDays, savedDays: Math.max(0, acc.savedDays), activeDays: Math.max(0, acc.activeDays), effectiveMinutes: round(Math.max(0, acc.sumEffective),
                    3), plannedMinutes: round(Math.max(0, acc.planned), 3), depthMinutes: round(Math.max(0, acc.depthMinutes), 3), temporalMinutes: round(Math.max(0, acc.timeWeight),
                    3), activeWeeks: acc.activeWeeks.size
            }
        };
    }
    function vectorOnly(state) { return {
        volume: state.volume, depth: state.depth, consistency: state.consistency, completion: state.completion, revision: state.revision, diversity: state.diversity,
            temporalRhythm: state.temporalRhythm, concentration: state.concentration, recency: state.recency, recovery: state.recovery, persistence: state.persistence
    }; }
    function domainProfile(days, asOfOrdinal) {
        const cutoff = asOfOrdinal - 364, map = new Map();
        let other = 0;
        for (const day of days) {
            if (day.ordinal < cutoff || day.ordinal > asOfOrdinal)
                continue;
            for (const row of day.domains)
                addWeight(map, row.key, row.minutes);
            other += day.otherDomainMinutes;
        }
        const entries = mapEntriesByWeight(map), namedTotal = entries.reduce((sum, [, weight]) => sum + weight, 0), total = namedTotal + other;
        return {
            windowDays: 365, totalMinutes: round(total, 3), otherMinutes: round(other, 3), areas: entries.slice(0, 12).map(([key, minutes]) => ({ key, minutes: round(minutes, 3), share: round(total > 0 ? minutes / total : 0) }))
        };
    }
    function publicDay(day) {
        return {
            date: day.date, active: day.active,
            evidence: {
                plannedMinutes: round(day.plannedMinutes, 3), completedMinutes: round(day.completedMinutes, 3), focusedMinutes: round(day.focusedMinutes,
                    3), effectiveMinutes: round(day.effectiveMinutes, 3), workTasks: day.workTasks, sessions: day.totalSessions, depthMinutes: round(day.depthMinutes, 3)
            },
            dimensions: {
                volume: round(day.volume), depth: round(day.depth), completion: round(day.completion), revision: round(day.revision), diversity: round(day.diversity),
                    temporalRhythm: day.temporalRhythm ? { regularity: round(day.temporalRhythm.regularity), phaseMinute: day.temporalRhythm.phaseMinute } : null, concentration: round(day.concentration),
                    recency: round(day.recency), recovery: round(day.recovery)
            },
            trend: {
                volume7: round(day.trend.volume7), volume28: round(day.trend.volume28), depth14: round(day.trend.depth14), completion14: round(day.trend.completion14)
            },
            rolling: day.rolling,
            domains: day.domains.map(row => ({ key: row.key, minutes: round(row.minutes, 3) })), otherDomainMinutes: round(day.otherDomainMinutes, 3)
        };
    }
    function sourceFingerprint(days, asOfDate) { let left = 0x811c9dc5, right = 0x9e3779b9; const feed = value => { const text = String(value); left = fnv1a32(text, left); right = fnv1a32(text, right); }; feed(FORMAT); feed('|'); feed(VERSION); feed('|'); feed(asOfDate); for (const day of days) {
        feed('|');
        feed(day.date);
        feed(':');
        feed(round(day.effectiveMinutes, 3));
        feed(':');
        feed(round(day.plannedMinutes, 3));
        feed(':');
        feed(round(day.completedMinutes, 3));
        feed(':');
        feed(round(day.depth, 6));
        feed(':');
        feed(round(day.completion, 6));
        feed(':');
        feed(round(day.revision, 6));
        feed(':');
        feed(round(day.diversity, 6));
        feed(':');
        feed(round(day.concentration, 6));
        feed(':');
        feed(round(day.otherDomainMinutes, 3));
        feed(':');
        feed(day.domainFingerprint);
        feed(':');
        feed(day.temporalRhythm ? `${round(day.temporalRhythm.regularity, 6)}@${day.temporalRhythm.phaseMinute}` : '-');
    } return `${left.toString(16).padStart(8, '0')}${right.toString(16).padStart(8, '0')}`; }
    function buildTimeline(records, options = {}) {
        if (!Array.isArray(records))
            throw new TypeError('BehaviourTimeline.v1 requires an array of canonical daily records.');
        if (records.length > MAX_RECORDS)
            throw new RangeError(`BehaviourTimeline.v1 accepts at most ${MAX_RECORDS} records.`);
        const requestedAsOf = cleanText(options && options.currentStudyDate, 10), requestedOrdinal = isoOrdinal(requestedAsOf), fallbackOrdinals = records.map(record => isoOrdinal(record && record.date)).filter(value => value !== null),
            minimumOrdinal = isoOrdinal(MIN_SUPPORTED_DATE), asOfOrdinal = requestedOrdinal !== null ? Math.max(minimumOrdinal, requestedOrdinal) : (fallbackOrdinals.length ? Math.max(minimumOrdinal,
            Math.max(...fallbackOrdinals)) : minimumOrdinal), asOfDate = new Date(asOfOrdinal * DAY_MS).toISOString().slice(0, 10);
        const diagnostics = { inputRecords: records.length, invalidRecords: 0, invalidDates: 0, duplicateDates: 0, cappedTasks: 0, truncatedDomainDays: 0 };
        const byDate = new Map();
        for (const record of records) {
            const candidate = normalizeCandidate(record, asOfOrdinal, diagnostics);
            if (!candidate)
                continue;
            const existing = byDate.get(candidate.date);
            if (existing) {
                diagnostics.duplicateDates += 1;
                byDate.set(candidate.date, chooseDuplicate(existing, candidate));
            }
            else
                byDate.set(candidate.date, candidate);
        }
        const days = [...byDate.values()].sort((a, b) => a.ordinal - b.ordinal || stableCompare(a.date, b.date));
        if (!days.length) {
            const emptyState = {
                volume: 0, depth: null, consistency: 0, completion: null, revision: null, diversity: null, temporalRhythm: null, concentration: null, recency: 0, recovery: 0, persistence: 0, evidence: {
                    calendarDays: 1, savedDays: 0, activeDays: 0, effectiveMinutes: 0, plannedMinutes: 0, depthMinutes: 0, temporalMinutes: 0, activeWeeks: 0
                }
            };
            return deepFreeze({
                format: FORMAT, version: VERSION, source: {
                    currentStudyDate: asOfDate, datasetRevision: (options && options.datasetRevision) !== undefined ? options.datasetRevision : null, recordCount: 0, firstDate: null, lastDate: null, fingerprint: sourceFingerprint([], asOfDate)
                }, diagnostics, days: [], current: { d7: emptyState, d28: emptyState, d90: emptyState, d365: emptyState, lifetime: emptyState }, domainProfile: { windowDays: 365, totalMinutes: 0, otherMinutes: 0, areas: [] }
            });
        }
        let lastActiveOrdinal = null, volume7 = 0, volume28 = 0, lastTrendOrdinal = days[0].ordinal - 1;
        const depth14 = { numerator: 0, weight: 0 }, completion14 = { numerator: 0, weight: 0 };
        for (const day of days) {
            const delta = Math.max(1, day.ordinal - lastTrendOrdinal), baseline28 = volume28;
            if (day.active && lastActiveOrdinal !== null) {
                const inactiveDays = Math.max(0, day.ordinal - lastActiveOrdinal - 1);
                if (inactiveDays >= 2) {
                    const gapFactor = 1 - Math.exp(-inactiveDays / 5), returnRatio = clamp(day.volume / Math.max(0.12, baseline28));
                    day.recovery = clamp(gapFactor * returnRatio);
                }
                else
                    day.recovery = 0;
            }
            else
                day.recovery = 0;
            day.recency = day.active ? 1 : (lastActiveOrdinal === null ? 0 : recencyKernel(day.ordinal - lastActiveOrdinal));
            volume7 = ewmaScalar(volume7, day.volume, delta, 7);
            volume28 = ewmaScalar(volume28, day.volume, delta, 28);
            const depthValue = ewmaObserved(depth14, day.depth, delta, 14), completionValue = ewmaObserved(completion14, day.completion, delta, 14);
            day.trend = { volume7, volume28, depth14: depthValue, completion14: completionValue };
            if (day.active)
                lastActiveOrdinal = day.ordinal;
            lastTrendOrdinal = day.ordinal;
        }
        const firstOrdinal = days[0].ordinal, rolling = Object.fromEntries(WINDOW_SPECS.map(([key, windowDays]) => [key, makeAccumulator(windowDays)]));
        for (let index = 0; index < days.length; index += 1) {
            const day = days[index];
            for (const [key] of WINDOW_SPECS) {
                const acc = rolling[key];
                trimAccumulator(acc, days, day.ordinal);
                addDay(acc, day, 1);
            }
            day.rolling = Object.fromEntries(WINDOW_SPECS.map(([key]) => [key, vectorOnly(accumulatorVector(rolling[key], day.ordinal, firstOrdinal))]));
        }
        const currentAcc = Object.fromEntries(CURRENT_WINDOW_SPECS.map(([key, windowDays]) => [key, makeAccumulator(windowDays)])), lifetime = makeAccumulator(Infinity);
        for (const day of days) {
            addDay(lifetime, day, 1);
            for (const [key] of CURRENT_WINDOW_SPECS) {
                const acc = currentAcc[key];
                trimAccumulator(acc, days, day.ordinal);
                addDay(acc, day, 1);
            }
        }
        for (const [key] of CURRENT_WINDOW_SPECS)
            trimAccumulator(currentAcc[key], days, asOfOrdinal);
        const current = Object.fromEntries(CURRENT_WINDOW_SPECS.map(([key]) => [key, accumulatorVector(currentAcc[key], asOfOrdinal, firstOrdinal)]));
        current.lifetime = accumulatorVector(lifetime, asOfOrdinal, firstOrdinal, { lifetime: true });
        const publicDays = days.map(publicDay), timeline = {
            format: FORMAT, version: VERSION, source: {
                currentStudyDate: asOfDate, datasetRevision: (options && options.datasetRevision) !== undefined ? options.datasetRevision : null, recordCount: publicDays.length, firstDate: days[0].date, lastDate: days[days.length - 1].date, fingerprint: sourceFingerprint(days, asOfDate)
            }, diagnostics, days: publicDays, current, domainProfile: domainProfile(days, asOfOrdinal)
        };
        return deepFreeze(timeline);
    }
    function serialize(timeline) { if (!timeline || timeline.format !== FORMAT || timeline.version !== VERSION)
        throw new TypeError('Expected BehaviourTimeline.v1.'); return JSON.stringify(timeline); }
    return Object.freeze({
        format: FORMAT, version: VERSION, limits: Object.freeze({
            maxRecords: MAX_RECORDS, maxTasksPerDay: MAX_TASKS_PER_DAY, maxDomainsPerDay: MAX_DOMAINS_PER_DAY, domainBuckets: DOMAIN_BUCKETS, minSupportedDate: MIN_SUPPORTED_DATE
        }), buildTimeline, serialize
    });
})();
