const SDWorldPlanetHistoryEngine = (() => {
    'use strict';
    const FORMAT = 'study-director.world.planet-history-snapshot';
    const COMPARISON_FORMAT = 'study-director.world.planet-history-comparison';
    const PROVENANCE_FORMAT = 'study-director.world.planet-history-provenance';
    const VERSION = 1;
    const ENGINE_VERSION = 1;
    const MAX_SNAPSHOTS = 4;
    const MAX_CHECKPOINTS = 48;
    const MAX_TIMELINES = 24;

    function deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value) || ArrayBuffer.isView(value)) return value;
        Object.freeze(value);
        for (const child of Object.values(value)) deepFreeze(child);
        return value;
    }
    function fnv1a(text, seed = 0x811c9dc5) {
        let hash = seed >>> 0;
        for (const char of String(text)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 0x01000193); }
        return hash >>> 0;
    }
    function fingerprint(prefix, value) {
        const canonical = JSON.stringify(value, (_key, child) => ArrayBuffer.isView(child) ? Array.from(child) : child);
        return `${prefix}-${fnv1a(canonical).toString(16).padStart(8, '0')}${fnv1a(canonical, 0x9e3779b9).toString(16).padStart(8, '0')}`;
    }
    function remember(map, key, value, limit) {
        if (map.has(key)) map.delete(key);
        map.set(key, value);
        while (map.size > limit) map.delete(map.keys().next().value);
        return value;
    }
    function validatePlanet(planet) {
        if (!planet || planet.format !== SDWorldPlanetGeneratorEngine.format || planet.version !== SDWorldPlanetGeneratorEngine.version || planet.audit?.fingerprintMatches !== true) throw new TypeError('Planet history requires a certified spherical planet.');
        return planet;
    }
    function abortError() {
        return typeof DOMException === 'function' ? new DOMException('Planet history reconstruction was aborted.', 'AbortError') : Object.assign(new Error('Planet history reconstruction was aborted.'), { name: 'AbortError' });
    }
    function checkSignal(signal) { if (signal?.aborted) throw abortError(); }
    function sourceKey(source, simulationVersion) {
        if (!source?.timeline?.source || !Array.isArray(source.records)) throw new TypeError('Planet history requires canonical records and a BehaviourTimeline.');
        return SDWorldChronologyEngine.sourceKey(source.timeline, source.datasetRevision, simulationVersion);
    }
    function historicalWhen(date) { return Object.freeze({ localDateTime: SDWorldChronologyEngine.historicalDateTime(date), timezoneOffsetMinutes: 0 }); }
    function timelineMinutes(timeline) { return Number(timeline?.current?.lifetime?.evidence?.effectiveMinutes) || 0; }
    function ecologicalValues(snapshot) {
        const summary = snapshot?.ecology?.summary || {};
        return Object.freeze({
            biomass: Number(summary.meanBiomass) || 0,
            canopy: Number(summary.meanCanopyClosure) || 0,
            succession: Number(summary.meanSuccession) || 0,
            biodiversity: Number(summary.meanBiodiversityPotential) || 0,
            habitatQuality: Number(summary.meanHabitatQuality) || 0,
            ecologicalReach: Number(summary.meanEcologicalReach) || 0,
            studyMinutes: timelineMinutes(snapshot?.timeline),
            cloudCoverage: Number(snapshot?.atmosphere?.fields?.summary?.meanCloudCoverage) || 0,
            precipitation: Number(snapshot?.atmosphere?.fields?.summary?.meanPrecipitation) || 0,
            meanTemperatureC: (() => { const fields = snapshot?.atmosphere?.fields?.temperatureC; if (!fields?.length) return 0; let total = 0; for (const value of fields) total += Number(value) || 0; return total / fields.length; })(),
            observations: Number(snapshot?.wildlife?.observations?.length) || 0,
            discoveries: Number(snapshot?.wildlife?.discoveries?.length) || 0
        });
    }
    function compare(before, after) {
        if (!before || before.format !== FORMAT || !after || after.format !== FORMAT) throw new TypeError('Planet history comparison requires two planetary history snapshots.');
        if (before.sourceKey !== after.sourceKey) throw new RangeError('Planet history snapshots belong to different canonical-history revisions.');
        if (before.planetFingerprint !== after.planetFingerprint) throw new RangeError('Planet history snapshots belong to different immutable planets.');
        const left = ecologicalValues(before), right = ecologicalValues(after), delta = {};
        for (const key of Object.keys(left)) delta[key] = right[key] - left[key];
        const value = { format: COMPARISON_FORMAT, version: 1, sourceKey: before.sourceKey, planetFingerprint: before.planetFingerprint, beforeDate: before.date, afterDate: after.date, before: left, after: right, delta: Object.freeze(delta), fingerprint: null };
        value.fingerprint = fingerprint('phc1', { ...value, fingerprint: undefined });
        return deepFreeze(value);
    }
    function selectionDirection(selection) { return selection?.direction || selection?.point || selection?.source?.direction || null; }
    function resolveCellIndex(selection, planet) {
        const id = selection?.cellId || selection?.anchorCellId || selection?.habitatCellId || selection?.source?.cellId;
        if (id) { const index = planet.topology.ids.indexOf(String(id)); if (index >= 0) return index; }
        const direction = selectionDirection(selection);
        if (!direction) return null;
        let best = -Infinity, found = null;
        for (let index = 0; index < planet.cellCount; index += 1) { const offset = index * 3, score = direction.x * planet.topology.directions[offset] + direction.y * planet.topology.directions[offset + 1] + direction.z * planet.topology.directions[offset + 2]; if (score > best) { best = score; found = index; } }
        return found;
    }
    function provenance(selection, snapshot) {
        if (!selection || !snapshot || snapshot.format !== FORMAT) return null;
        const planet = snapshot.planet, cellIndex = resolveCellIndex(selection, planet), regionIndex = cellIndex === null ? null : planet.ecology.regionIndex[cellIndex], region = Number.isInteger(regionIndex) ? snapshot.ecology.regions[regionIndex] : null, domainKey = region?.domainInfluence?.[0]?.key || '', contribution = SDWorldChronologyEngine.contributionSummary(snapshot.timeline, snapshot.date, domainKey), type = String(selection.type || 'terrain'), entityId = String(selection.entityId || selection.id || selection.cellId || 'spherical-point');
        const facts = [
            cellIndex === null ? null : `Canonical cell: ${planet.topology.ids[cellIndex]}`,
            region ? `Ecological region: ${region.id} · ${region.habitatClass}` : null,
            domainKey ? `Strongest study-domain influence: ${domainKey}` : null,
            contribution.minutes > 0 ? `Domain-linked study: ${(contribution.minutes / 60).toFixed(1)} h across ${contribution.activeDays} active days` : null,
            contribution.depthMinutes > 0 ? `Deep-work contribution: ${(contribution.depthMinutes / 60).toFixed(1)} h` : null,
            contribution.growthDates.length ? `Major growth periods: ${contribution.growthDates.join(' · ')}` : null,
            `Immutable planet: ${snapshot.planetFingerprint}`,
            `Canonical history: ${snapshot.sourceKey}`
        ].filter(Boolean);
        const value = { format: PROVENANCE_FORMAT, version: 1, snapshotDate: snapshot.date, sourceKey: snapshot.sourceKey, planetFingerprint: snapshot.planetFingerprint, entityId, entityType: type, cellIndex, cellId: cellIndex === null ? null : planet.topology.ids[cellIndex], regionId: region?.id || null, domainKey: domainKey || null, establishedDate: type === 'discovery' ? String(selection.occurredAt || snapshot.date).slice(0, 10) : snapshot.timeline.source.firstDate || snapshot.date, label: type === 'discovery' ? 'Discovery occurred' : type === 'wildlife' ? 'Observed in this reconstruction' : type === 'terrain' || type === 'water' ? 'Planetary feature present from world origin' : 'Ecological entity present in this reconstruction', certainty: ['terrain', 'water', 'geology'].includes(type) ? 'exact' : 'deterministic-reconstruction', facts: Object.freeze(facts), fingerprint: null };
        value.fingerprint = fingerprint('php1', { ...value, fingerprint: undefined });
        return deepFreeze(value);
    }
    function create(options = {}) {
        const planet = validatePlanet(options.planet), source = options.source, simulationVersion = String(options.simulationVersion || 'planet-history-v1'), canonicalKey = sourceKey(source, simulationVersion), model = SDWorldChronologyEngine.createTimeline(source.timeline), snapshots = new Map(), checkpoints = new Map(), timelines = new Map();
        const buildTimeline = typeof options.buildTimeline === 'function' ? options.buildTimeline : date => SDWorldBehaviourEngine.buildTimeline(source.records, { currentStudyDate: date, datasetRevision: source.datasetRevision });
        const evolve = typeof options.evolve === 'function' ? options.evolve : async (timeline, checkpoint, signal) => { checkSignal(signal); return checkpoint ? SDWorldPlanetaryEcologyEngine.resumeWithResumeCheckpoint(timeline, planet, checkpoint, { engineVersion: SDWorldPlanetaryEcologyEngine.engineVersion }) : SDWorldPlanetaryEcologyEngine.buildWithResumeCheckpoint(timeline, planet, { engineVersion: SDWorldPlanetaryEcologyEngine.engineVersion }); };
        const reconstructSystems = typeof options.reconstructSystems === 'function' ? options.reconstructSystems : null;
        const samplerFactory = typeof options.samplerFactory === 'function' ? options.samplerFactory : ecology => SDWorldPlanetTerrainRendererEngine.createPlanetSampler(planet, ecology);
        let destroyed = false, cacheHits = 0, reconstructions = 0;
        function timelineAt(date) { const clean = SDWorldChronologyEngine.clampDate(date, model); if (timelines.has(clean)) { const value = timelines.get(clean); remember(timelines, clean, value, MAX_TIMELINES); return value; } return remember(timelines, clean, buildTimeline(clean), MAX_TIMELINES); }
        function nearestCheckpoint(date) { const target = SDWorldChronologyEngine.ordinal(date); let result = null, best = -Infinity; for (const checkpoint of checkpoints.values()) { const ordinal = SDWorldChronologyEngine.ordinal(checkpoint.currentStudyDate); if (ordinal !== null && ordinal <= target && ordinal > best) { result = checkpoint; best = ordinal; } } return result; }
        async function reconstruct(date, runtime = {}) {
            if (destroyed) throw new Error('Planet history session has been destroyed.');
            checkSignal(runtime.signal); const clean = SDWorldChronologyEngine.clampDate(date, model);
            if (snapshots.has(clean)) { cacheHits += 1; const value = snapshots.get(clean); remember(snapshots, clean, value, MAX_SNAPSHOTS); return value; }
            const timeline = timelineAt(clean), checkpoint = nearestCheckpoint(clean), result = reconstructSystems ? await reconstructSystems(timeline, checkpoint, runtime.signal, historicalWhen(clean)) : await evolve(timeline, checkpoint, runtime.signal); checkSignal(runtime.signal);
            const ecology = result?.state; if (!ecology || ecology.source?.planetFingerprint !== planet.fingerprint || ecology.audit?.fingerprintMatches !== true) throw new Error('Planet history ecology reconstruction failed certification.');
            if (result.checkpoint?.resumable) remember(checkpoints, result.checkpoint.currentStudyDate, result.checkpoint, MAX_CHECKPOINTS);
            const atmosphere = result.atmosphere || SDWorldPlanetAtmosphereEngine.build(planet, ecology, historicalWhen(clean)), sampler = result.wildlife ? null : samplerFactory(ecology), wildlife = result.wildlife || SDWorldPlanetWildlifeEngine.build(planet, ecology, atmosphere, { sampler }); sampler?.clear?.();
            const audit = Object.freeze({ immutableGeometry: ecology.source.planetFingerprint === planet.fingerprint && atmosphere.source.planetFingerprint === planet.fingerprint && wildlife.source.planetFingerprint === planet.fingerprint, ecologyCertified: ecology.audit.fingerprintMatches === true, atmosphereCertified: atmosphere.audit.fingerprintMatches === true, wildlifeCertified: wildlife.audit.fingerprintMatches === true, sourceCurrentStudyDate: timeline.source.currentStudyDate === clean });
            const value = { format: FORMAT, version: VERSION, engineVersion: ENGINE_VERSION, date: clean, historical: clean !== model.endDate, sourceKey: canonicalKey, planetFingerprint: planet.fingerprint, planet, timeline, ecology, atmosphere, wildlife, audit, fingerprint: null };
            value.fingerprint = fingerprint('ph1', { date: clean, sourceKey: canonicalKey, planetFingerprint: planet.fingerprint, timeline: timeline.source.fingerprint, ecology: ecology.fingerprint, atmosphere: atmosphere.fingerprint, wildlife: wildlife.fingerprint });
            reconstructions += 1; return remember(snapshots, clean, deepFreeze(value), MAX_SNAPSHOTS);
        }
        function clear() { snapshots.clear(); checkpoints.clear(); timelines.clear(); }
        function stats() { return Object.freeze({ sourceKey: canonicalKey, planetFingerprint: planet.fingerprint, snapshots: snapshots.size, checkpoints: checkpoints.size, timelines: timelines.size, cacheHits, reconstructions, limits: Object.freeze({ snapshots: MAX_SNAPSHOTS, checkpoints: MAX_CHECKPOINTS, timelines: MAX_TIMELINES }) }); }
        return Object.freeze({ format: 'study-director.world.planet-history-session', version: 1, engineVersion: ENGINE_VERSION, sourceKey: canonicalKey, planetFingerprint: planet.fingerprint, model, reconstruct, compare, provenance: (selection, snapshot) => provenance(selection, snapshot), clear, stats, destroy() { destroyed = true; clear(); } });
    }
    return Object.freeze({ format: FORMAT, comparisonFormat: COMPARISON_FORMAT, provenanceFormat: PROVENANCE_FORMAT, version: VERSION, engineVersion: ENGINE_VERSION, limits: Object.freeze({ maxSnapshots: MAX_SNAPSHOTS, maxCheckpoints: MAX_CHECKPOINTS, maxTimelines: MAX_TIMELINES }), sourceKey, create, compare, provenance });
})();
