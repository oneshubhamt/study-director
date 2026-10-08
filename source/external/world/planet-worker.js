const SDWorldPlanetWorker = (() => {
    'use strict';
    const REQUEST_FORMAT = 'study-director.world.planet-worker-request';
    const RESPONSE_FORMAT = 'study-director.world.planet-worker-response';
    let patchSession = null;
    function transferables(value) {
        const buffers = [], seenObjects = new Set(), seenBuffers = new Set();
        function visit(current) { if (!current || typeof current !== 'object' || seenObjects.has(current)) return; seenObjects.add(current); if (ArrayBuffer.isView(current)) { if (current.buffer && !seenBuffers.has(current.buffer)) { seenBuffers.add(current.buffer); buffers.push(current.buffer); } return; } if (current instanceof ArrayBuffer) { if (!seenBuffers.has(current)) { seenBuffers.add(current); buffers.push(current); } return; } for (const child of Object.values(current)) visit(child); }
        visit(value); return buffers;
    }
    function handle(request) {
        const requestId = typeof request?.requestId === 'string' && request.requestId.length <= 96 ? request.requestId : '';
        if (!request || request.format !== REQUEST_FORMAT || request.version !== 1 || !['generate', 'evolve-ecology', 'reconstruct-systems', 'build-systems', 'initialize-patches', 'update-patches', 'select-cover', 'prepare-patch', 'release-patches'].includes(request.operation) || !requestId) return Object.freeze({ format: RESPONSE_FORMAT, version: 1, requestId, ok: false, error: Object.freeze({ name: 'TypeError', message: 'Invalid planet-worker request.' }) });
        try {
            let result;
            if (request.operation === 'generate') result = SDWorldPlanetGeneratorEngine.generate(request.options);
            else if (request.operation === 'evolve-ecology' || request.operation === 'reconstruct-systems') { const evolved = request.checkpoint
                    ? SDWorldPlanetaryEcologyEngine.resumeWithResumeCheckpoint(request.timeline, request.planet, request.checkpoint, request.options)
                    : SDWorldPlanetaryEcologyEngine.buildWithResumeCheckpoint(request.timeline, request.planet, request.options); if (request.operation === 'evolve-ecology') result = evolved; else { const atmosphere = SDWorldPlanetAtmosphereEngine.build(request.planet, evolved.state, request.when || {}), sampler = SDWorldPlanetTerrainRendererEngine.createPlanetSampler(request.planet, evolved.state), wildlife = SDWorldPlanetWildlifeEngine.build(request.planet, evolved.state, atmosphere, { sampler }); sampler.clear?.(); result = Object.freeze({ ...evolved, atmosphere, wildlife }); } }
            else if (request.operation === 'build-systems') { const atmosphere = SDWorldPlanetAtmosphereEngine.build(request.planet, request.ecology, request.when || {}), sampler = SDWorldPlanetTerrainRendererEngine.createPlanetSampler(request.planet, request.ecology), wildlife = SDWorldPlanetWildlifeEngine.build(request.planet, request.ecology, atmosphere, { sampler }); sampler.clear?.(); result = Object.freeze({ atmosphere, wildlife }); }
            else if (request.operation === 'initialize-patches' || request.operation === 'update-patches') {
                const sessionPlanet = request.operation === 'initialize-patches' ? request.planet : patchSession?.planet; if (!sessionPlanet || sessionPlanet.format !== SDWorldPlanetGeneratorEngine.format || sessionPlanet.audit?.fingerprintMatches !== true) throw new TypeError('Patch preparation requires a certified spherical planet.');
                patchSession?.sampler?.clear?.(); const ecology = request.ecology || null, sampler = SDWorldPlanetTerrainRendererEngine.createPlanetSampler(sessionPlanet, ecology); patchSession = { planet: sessionPlanet, ecology, sampler, generation: Number(request.generation) || 0 }; result = Object.freeze({ ready: true, planetFingerprint: sessionPlanet.fingerprint, ecologyFingerprint: ecology?.fingerprint || null, generation: patchSession.generation, inlandWater: request.operation === 'initialize-patches' ? SDWorldPlanetTerrainRendererEngine.buildInlandWaterDescriptor(sessionPlanet, sampler) : null });
            } else if (request.operation === 'select-cover') {
                if (!patchSession || Number(request.generation) !== patchSession.generation) throw new RangeError('Cover-selection session is stale.');
                const cover = SDWorldPlanetTerrainRendererEngine.selectCover(request.camera, request.viewport, patchSession.planet, { sampler: patchSession.sampler, maximumLevel: request.maximumLevel, patchBudget: request.patchBudget, pixelError: request.pixelError }); result = Object.freeze({ generation: patchSession.generation, epoch: Number(request.epoch) || 0, cover });
            } else if (request.operation === 'prepare-patch') {
                if (!patchSession || request.planetFingerprint !== patchSession.planet.fingerprint || Number(request.generation) !== patchSession.generation) throw new RangeError('Patch preparation session is stale.');
                const row = request.patch || {}, terrain = SDWorldPlanetTerrainRendererEngine.buildPatchDescriptor(patchSession.planet, row.cellId, row.targetEdgeLevels, { sampler: patchSession.sampler, bornSeconds: Number(request.bornSeconds) || 0 }), water = Number(row.level) >= 4 ? SDWorldPlanetTerrainRendererEngine.buildWaterPatchDescriptor(patchSession.planet, row.cellId, row.targetEdgeLevels, patchSession.sampler) : null, projection = patchSession.ecology && Number(row.level) >= SDWorldPlanetNaturalEngine.limits.minimumPatchLevel ? SDWorldPlanetNaturalEngine.buildPatchProjection(patchSession.planet, patchSession.ecology, row.cellId, { sampler: patchSession.sampler }) : null, natural = projection ? SDWorldPlanetTerrainRendererEngine.packNaturalDescriptor(patchSession.planet, projection, Number(request.bornSeconds) || 0) : null; result = Object.freeze({ generation: patchSession.generation, key: String(request.key || ''), terrain, water, natural, entities: projection?.entities || Object.freeze([]) });
            } else { patchSession?.sampler?.clear?.(); patchSession = null; result = Object.freeze({ released: true }); }
            return Object.freeze({ format: RESPONSE_FORMAT, version: 1, requestId, ok: true, result });
        }
        catch (error) { return Object.freeze({ format: RESPONSE_FORMAT, version: 1, requestId, ok: false, error: Object.freeze({ name: String(error?.name || 'Error').slice(0, 80), message: String(error?.message || 'Planet worker operation failed.').slice(0, 500) }) }); }
    }
    function install(scope) {
        if (!scope || typeof scope.addEventListener !== 'function' || typeof scope.postMessage !== 'function') throw new TypeError('Planet worker requires a worker-like scope.');
        scope.addEventListener('message', event => { const response = handle(event?.data); scope.postMessage(response, response.ok ? transferables(response.result) : []); });
        return true;
    }
    return Object.freeze({ requestFormat: REQUEST_FORMAT, responseFormat: RESPONSE_FORMAT, handle, install, transferables });
})();

if (typeof self !== 'undefined' && typeof self.importScripts === 'function' && typeof self.document === 'undefined') SDWorldPlanetWorker.install(self);
