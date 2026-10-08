const SDWorldPlanetGeneratorEngine = (() => {
    'use strict';
    const FORMAT = 'study-director.world.spherical-planet-generation';
    const VERSION = 2;
    const ENGINE_VERSION = 2;
    const WORKER_FILENAME = '@@SD_WORLD_PLANET_WORKER_FILENAME@@';
    const DEFAULT_LEVEL = 6;
    const MAX_LEVEL = 6;
    const MAX_SEED_CHARS = 128;
    const FLOW_EPSILON_METERS = 0.001;
    const Math3 = SDWorldSphericalMathEngine;
    const Icosphere = SDWorldIcosphereEngine;
    const Vector = Math3.vector;
    const BIOMES = Object.freeze([
        'deep-ocean', 'shelf-sea', 'freshwater-lake', 'wetland', 'ice', 'tundra', 'alpine', 'boreal-forest',
        'temperate-rainforest', 'temperate-forest', 'temperate-grassland', 'cold-desert', 'hot-desert',
        'savanna', 'seasonal-woodland', 'tropical-rainforest'
    ]);

    function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
    function finite(value, label) { const number = Number(value); if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite.`); return number; }
    function integer(value, minimum, maximum, label) { const number = Number(value); if (!Number.isInteger(number) || number < minimum || number > maximum) throw new RangeError(`${label} must be an integer from ${minimum} through ${maximum}.`); return number; }
    function normalizeSeed(value) { const seed = typeof value === 'number' && Number.isFinite(value) ? String(Math.trunc(value)) : String(value ?? '').trim(); if (!seed || seed.length > MAX_SEED_CHARS) throw new TypeError(`Planet generation requires a non-empty seed up to ${MAX_SEED_CHARS} characters.`); return seed; }
    function mix32(value) { let x = value >>> 0; x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16; return x >>> 0; }
    function fnv1a(text, seed = 0x811c9dc5) { let hash = seed >>> 0; const value = String(text); for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); } return hash >>> 0; }
    function hash32(seed, ...parts) { let value = fnv1a(seed); for (const part of parts) value = mix32(fnv1a(String(part), value) ^ 0x9e3779b9); return value >>> 0; }
    function hashUnit(seed, ...parts) { return hash32(seed, ...parts) / 4294967296; }
    function hashDirection(seed, label, index) {
        const vertical = hashUnit(seed, label, index, 'z') * 2 - 1, angle = hashUnit(seed, label, index, 'a') * Math.PI * 2, horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
        return Object.freeze({ x: horizontal * Math.cos(angle), y: vertical, z: horizontal * Math.sin(angle) });
    }
    function typedClone(value) { return value && ArrayBuffer.isView(value) ? new value.constructor(value) : value; }
    function plainPlanet(value) {
        const planet = Math3.normalizePlanet(value || Math3.defaultPlanet);
        return Object.freeze({
            format: planet.format, version: planet.version,
            center: planet.center, axis: planet.axis, primeMeridian: planet.primeMeridian, equatorialEast: planet.equatorialEast,
            radiusMeters: planet.radiusMeters, seaLevelMeters: planet.seaLevelMeters,
            minimumElevationMeters: planet.minimumElevationMeters, maximumElevationMeters: planet.maximumElevationMeters,
            axialTiltDegrees: planet.axialTiltDegrees, circumferenceMeters: planet.circumferenceMeters,
            surfaceAreaSquareMeters: planet.surfaceAreaSquareMeters
        });
    }
    function normalizeOptions(value = {}) {
        if (!value || typeof value !== 'object') throw new TypeError('Planet-generation options must be an object.');
        const seed = normalizeSeed(value.seed), level = integer(value.level ?? DEFAULT_LEVEL, 0, MAX_LEVEL, 'level'), planet = plainPlanet(value.planet),
            oceanCoverageTarget = finite(value.oceanCoverageTarget ?? 0.61, 'oceanCoverageTarget'), plateCount = integer(value.plateCount ?? 12, 6, 24, 'plateCount');
        if (!(oceanCoverageTarget >= 0.35 && oceanCoverageTarget <= 0.80)) throw new RangeError('oceanCoverageTarget must be from 0.35 through 0.80.');
        return Object.freeze({ seed, level, planet, oceanCoverageTarget, plateCount });
    }

    class MinHeap {
        constructor() { this.items = []; }
        push(index, priority) { const item = { index, priority }, items = this.items; items.push(item); let position = items.length - 1; while (position > 0) { const parent = (position - 1) >> 1, other = items[parent]; if (other.priority < priority || (other.priority === priority && other.index <= index)) break; items[position] = other; position = parent; } items[position] = item; }
        pop() { const items = this.items; if (!items.length) return null; const first = items[0], last = items.pop(); if (items.length) { let position = 0; while (true) { const left = position * 2 + 1; if (left >= items.length) break; const right = left + 1, child = right < items.length && (items[right].priority < items[left].priority || (items[right].priority === items[left].priority && items[right].index < items[left].index)) ? right : left, other = items[child]; if (other.priority > last.priority || (other.priority === last.priority && other.index >= last.index)) break; items[position] = other; position = child; } items[position] = last; } return first; }
        get size() { return this.items.length; }
    }

    function buildTopology(options) {
        const ids = [...Icosphere.idsAtLevel(options.level)], count = ids.length, directions = new Float64Array(count * 3), areas = new Float64Array(count), neighbours = new Int32Array(count * 3), roots = new Uint8Array(count), indexById = new Map(ids.map((id, index) => [id, index]));
        for (let index = 0; index < count; index += 1) {
            const current = Icosphere.cell(ids[index]), direction = current.centre;
            directions[index * 3] = direction.x; directions[index * 3 + 1] = direction.y; directions[index * 3 + 2] = direction.z;
            areas[index] = current.solidAngleSteradians * options.planet.radiusMeters ** 2; roots[index] = current.root;
        }
        for (let index = 0; index < count; index += 1) {
            const adjacent = Icosphere.neighbours(ids[index]);
            for (let edge = 0; edge < 3; edge += 1) { const neighbour = indexById.get(adjacent[edge].cellId); if (neighbour === undefined) throw new Error(`Missing same-level neighbour ${adjacent[edge].cellId}.`); neighbours[index * 3 + edge] = neighbour; }
        }
        return Object.freeze({ level: options.level, ids: Object.freeze(ids), count, directions, areas, neighbours, roots });
    }
    function directionAt(topology, index) { const offset = index * 3; return { x: topology.directions[offset], y: topology.directions[offset + 1], z: topology.directions[offset + 2] }; }
    function buildSpectralTerms(seed, label, count) {
        const terms = [];
        for (let index = 0; index < count; index += 1) terms.push(Object.freeze({ axis: hashDirection(seed, `${label}:axis`, index), axis2: hashDirection(seed, `${label}:axis2`, index), frequency: 1.15 * (1.42 ** index), phase: hashUnit(seed, label, index, 'phase') * Math.PI * 2, amplitude: 0.62 ** index }));
        return Object.freeze(terms);
    }
    function spectral(direction, terms) { let total = 0, weight = 0; for (const term of terms) { const first = Math.sin(term.frequency * Vector.dot(direction, term.axis) * Math.PI + term.phase), second = Math.cos(term.frequency * 0.73 * Vector.dot(direction, term.axis2) * Math.PI - term.phase * 0.61); total += (first * 0.68 + second * 0.32) * term.amplitude; weight += term.amplitude; } return weight ? total / weight : 0; }
    function buildPlates(options) {
        const plates = [];
        for (let index = 0; index < options.plateCount; index += 1) {
            const centre = hashDirection(options.seed, 'plate-centre', index), pole = hashDirection(options.seed, 'plate-pole', index), speed = 0.55 + hashUnit(options.seed, 'plate-speed', index) * 0.9,
                angularVelocity = Vector.scale(pole, speed), continental = hashUnit(options.seed, 'plate-crust', index) >= 0.39, buoyancy = hashUnit(options.seed, 'plate-buoyancy', index) * 2 - 1;
            plates.push(Object.freeze({ index, centre, angularVelocity, speed, continental, buoyancy }));
        }
        return Object.freeze(plates);
    }
    function sampleGeology(seedValue, directionValue, plateValue = {}) {
        const seed = normalizeSeed(seedValue), direction = Vector.normalize(directionValue, 'geology direction'), plateCount = integer(plateValue.plateCount ?? 12, 6, 24, 'plateCount'), options = { seed, plateCount }, plates = plateValue.plates || buildPlates(options), macroTerms = plateValue.macroTerms || buildSpectralTerms(seed, 'geology-macro', 7), detailTerms = plateValue.detailTerms || buildSpectralTerms(seed, 'geology-detail', 10);
        let first = -1, second = -1, firstScore = -Infinity, secondScore = -Infinity;
        for (let index = 0; index < plates.length; index += 1) { const score = Vector.dot(direction, plates[index].centre); if (score > firstScore) { second = first; secondScore = firstScore; first = index; firstScore = score; } else if (score > secondScore) { second = index; secondScore = score; } }
        const primary = plates[first], secondary = plates[second], margin = Math.max(0, firstScore - secondScore), boundaryStrength = Math.exp(-margin * margin * 150), primaryVelocity = Vector.cross(primary.angularVelocity, direction), secondaryVelocity = Vector.cross(secondary.angularVelocity, direction), relative = Vector.subtract(primaryVelocity, secondaryVelocity), rawNormal = Vector.subtract(primary.centre, secondary.centre), projectedNormal = Vector.subtract(rawNormal, Vector.scale(direction, Vector.dot(rawNormal, direction))), normalLength = Vector.length(projectedNormal), boundaryNormal = normalLength > 1e-12 ? Vector.scale(projectedNormal, 1 / normalLength) : Vector.orthogonalUnit(direction), convergenceSigned = Vector.dot(relative, boundaryNormal), convergence = clamp(convergenceSigned * 0.72, -1, 1), shear = clamp(Vector.length(relative) * 0.35, 0, 1), macro = spectral(direction, macroTerms), detail = spectral(direction, detailTerms), crust = primary.continental ? 430 : -360, plateBias = primary.buoyancy * 230,
            erosionCorrectionMeters = detail * (1 - boundaryStrength) * 85, elevationRawMeters = crust + plateBias + macro * 760 + detail * 220 + erosionCorrectionMeters + boundaryStrength * (Math.max(0, convergence) * 1250 + shear * 280 - Math.max(0, -convergence) * 360), hardness = clamp(0.34 + (primary.continental ? 0.18 : 0) + boundaryStrength * 0.22 + detail * 0.12, 0, 1), uplift = clamp(0.42 + convergence * 0.42 + boundaryStrength * 0.28, 0, 1);
        return Object.freeze({ elevationRawMeters, erosionCorrectionMeters, plateIndex: first, secondaryPlateIndex: second, boundaryStrength, convergence, shear, hardness, uplift });
    }
    function createGeologySampler(seedValue, value = {}) {
        const seed = normalizeSeed(seedValue), plateCount = integer(value.plateCount ?? 12, 6, 24, 'plateCount'), context = Object.freeze({ plateCount, plates: buildPlates({ seed, plateCount }), macroTerms: buildSpectralTerms(seed, 'geology-macro', 7), detailTerms: buildSpectralTerms(seed, 'geology-detail', 10) });
        return Object.freeze({ seed, plateCount, sample(directionValue) { return sampleGeology(seed, directionValue, context); } });
    }
    function buildGeology(options, topology) {
        const plates = buildPlates(options), macroTerms = buildSpectralTerms(options.seed, 'geology-macro', 7), detailTerms = buildSpectralTerms(options.seed, 'geology-detail', 10), rawElevationMeters = new Float64Array(topology.count), elevationMeters = new Float64Array(topology.count), erosionCorrectionMeters = new Float32Array(topology.count), plateIndex = new Uint16Array(topology.count), boundaryStrength = new Float32Array(topology.count), convergence = new Float32Array(topology.count), hardness = new Float32Array(topology.count), uplift = new Float32Array(topology.count);
        const context = { plateCount: options.plateCount, plates, macroTerms, detailTerms };
        for (let index = 0; index < topology.count; index += 1) { const sample = sampleGeology(options.seed, directionAt(topology, index), context); rawElevationMeters[index] = sample.elevationRawMeters; erosionCorrectionMeters[index] = sample.erosionCorrectionMeters; plateIndex[index] = sample.plateIndex; boundaryStrength[index] = sample.boundaryStrength; convergence[index] = sample.convergence; hardness[index] = sample.hardness; uplift[index] = sample.uplift; }
        const byElevation = Array.from({ length: topology.count }, (_value, index) => index).sort((left, right) => rawElevationMeters[left] - rawElevationMeters[right] || left - right), targetArea = options.planet.surfaceAreaSquareMeters * options.oceanCoverageTarget;
        let area = 0, seaLevelRawMeters = rawElevationMeters[byElevation[0]];
        for (const index of byElevation) { area += topology.areas[index]; seaLevelRawMeters = rawElevationMeters[index]; if (area >= targetArea) break; }
        for (let index = 0; index < topology.count; index += 1) elevationMeters[index] = clamp(rawElevationMeters[index] - seaLevelRawMeters, options.planet.minimumElevationMeters, options.planet.maximumElevationMeters);
        const slope = new Float32Array(topology.count), roughness = new Float32Array(topology.count);
        for (let index = 0; index < topology.count; index += 1) { const direction = directionAt(topology, index); let maximum = 0, total = 0; for (let edge = 0; edge < 3; edge += 1) { const other = topology.neighbours[index * 3 + edge], distance = Math.max(1, Math3.greatCircleDistance(direction, directionAt(topology, other), options.planet)), difference = Math.abs(elevationMeters[index] - elevationMeters[other]); maximum = Math.max(maximum, difference / distance); total += difference; } slope[index] = maximum; roughness[index] = total / 3; }
        return Object.freeze({ plates, rawElevationMeters, elevationMeters, erosionCorrectionMeters, plateIndex, boundaryStrength, convergence, hardness, uplift, slope, roughness, seaLevelRawMeters });
    }

    function connectedComponents(mask, topology) {
        const component = new Int32Array(topology.count); component.fill(-1); const sizes = [], minimumCells = [];
        for (let start = 0; start < topology.count; start += 1) { if (!mask[start] || component[start] !== -1) continue; const id = sizes.length, queue = [start]; component[start] = id; let head = 0, size = 0, minimum = start; while (head < queue.length) { const current = queue[head++]; size += 1; minimum = Math.min(minimum, current); for (let edge = 0; edge < 3; edge += 1) { const next = topology.neighbours[current * 3 + edge]; if (mask[next] && component[next] === -1) { component[next] = id; queue.push(next); } } } sizes.push(size); minimumCells.push(minimum); }
        return Object.freeze({ component, sizes: Object.freeze(sizes), minimumCells: Object.freeze(minimumCells) });
    }
    function buildOcean(options, topology, geology) {
        const isOcean = new Uint8Array(topology.count), depthMeters = new Float32Array(topology.count), isCoast = new Uint8Array(topology.count), isShelf = new Uint8Array(topology.count), oceanDistanceSteps = new Uint16Array(topology.count); oceanDistanceSteps.fill(65535);
        let oceanArea = 0;
        for (let index = 0; index < topology.count; index += 1) if (geology.elevationMeters[index] <= 0) { isOcean[index] = 1; depthMeters[index] = -geology.elevationMeters[index]; isShelf[index] = depthMeters[index] <= 180 ? 1 : 0; oceanArea += topology.areas[index]; oceanDistanceSteps[index] = 0; }
        const queue = [];
        for (let index = 0; index < topology.count; index += 1) if (isOcean[index]) queue.push(index);
        for (let head = 0; head < queue.length; head += 1) { const current = queue[head], distance = oceanDistanceSteps[current]; for (let edge = 0; edge < 3; edge += 1) { const next = topology.neighbours[current * 3 + edge]; if (oceanDistanceSteps[next] > distance + 1) { oceanDistanceSteps[next] = distance + 1; queue.push(next); } } }
        for (let index = 0; index < topology.count; index += 1) if (!isOcean[index]) for (let edge = 0; edge < 3; edge += 1) if (isOcean[topology.neighbours[index * 3 + edge]]) { isCoast[index] = 1; break; }
        const components = connectedComponents(isOcean, topology);
        return Object.freeze({ isOcean, depthMeters, isCoast, isShelf, oceanDistanceSteps, component: components.component, components: components.sizes, componentMinimumCells: components.minimumCells, areaSquareMeters: oceanArea, coverageFraction: oceanArea / options.planet.surfaceAreaSquareMeters });
    }
    function buildDrainage(topology, geology, ocean) {
        const filledElevationMeters = new Float64Array(topology.count), receiver = new Int32Array(topology.count), outletOceanCell = new Int32Array(topology.count), lakeDepthMeters = new Float32Array(topology.count), visited = new Uint8Array(topology.count), heap = new MinHeap();
        filledElevationMeters.fill(Infinity); receiver.fill(-2); outletOceanCell.fill(-1);
        for (let index = 0; index < topology.count; index += 1) if (ocean.isOcean[index]) { visited[index] = 1; filledElevationMeters[index] = geology.elevationMeters[index]; receiver[index] = -1; outletOceanCell[index] = index; heap.push(index, filledElevationMeters[index]); }
        while (heap.size) { const current = heap.pop(); for (let edge = 0; edge < 3; edge += 1) { const next = topology.neighbours[current.index * 3 + edge]; if (visited[next]) continue; visited[next] = 1; const filled = Math.max(geology.elevationMeters[next], current.priority + FLOW_EPSILON_METERS); filledElevationMeters[next] = filled; receiver[next] = current.index; outletOceanCell[next] = ocean.isOcean[current.index] ? current.index : outletOceanCell[current.index]; lakeDepthMeters[next] = Math.max(0, filled - geology.elevationMeters[next]); heap.push(next, filled); } }
        for (let index = 0; index < topology.count; index += 1) if (!visited[index]) throw new Error(`Hydrology failed to reach cell ${topology.ids[index]}.`);
        return Object.freeze({ filledElevationMeters, receiver, outletOceanCell, lakeDepthMeters });
    }

    function buildClimate(options, topology, geology, ocean, drainage) {
        const meanTemperatureC = new Float32Array(topology.count), seasonalRangeC = new Float32Array(topology.count), annualPrecipitationMm = new Float32Array(topology.count), moisture = new Float32Array(topology.count), exposure = new Float32Array(topology.count), oceanicity = new Float32Array(topology.count), aridityIndex = new Float32Array(topology.count), snowFraction = new Float32Array(topology.count), runoffCoefficient = new Float32Array(topology.count), latitudeDegrees = new Float32Array(topology.count), windEast = new Float32Array(topology.count), windNorth = new Float32Array(topology.count), climateTerms = buildSpectralTerms(options.seed, 'climate', 8), moistureTerms = buildSpectralTerms(options.seed, 'moisture', 9), meanCellSpacing = Math.sqrt(options.planet.surfaceAreaSquareMeters / topology.count);
        for (let index = 0; index < topology.count; index += 1) {
            const direction = directionAt(topology, index), coordinate = Math3.toLatLon(direction, options.planet), latitude = coordinate.latitudeDegrees, absoluteLatitude = Math.abs(latitude), frame = Math3.localFrame(direction, options.planet), zonal = absoluteLatitude < 30 || absoluteLatitude > 62 ? -1 : 1, meridional = latitude === 0 ? 0 : (absoluteLatitude < 30 ? -Math.sign(latitude) * 0.18 : absoluteLatitude < 62 ? Math.sign(latitude) * 0.12 : -Math.sign(latitude) * 0.08), wind = Vector.normalize(Vector.add(Vector.scale(frame.east, zonal), Vector.scale(frame.north, meridional)), 'climate wind'), oceanDistanceMeters = ocean.oceanDistanceSteps[index] * meanCellSpacing, oceanity = ocean.isOcean[index] ? 1 : Math.exp(-oceanDistanceMeters / 17000), elevation = Math.max(0, geology.elevationMeters[index]), climateNoise = spectral(direction, climateTerms), moistureNoise = spectral(direction, moistureTerms), equatorialRain = Math.exp(-((absoluteLatitude / 17) ** 2)), subtropicalDry = Math.exp(-(((absoluteLatitude - 27) / 10) ** 2)), midlatitudeRain = Math.exp(-(((absoluteLatitude - 48) / 15) ** 2));
            let upwind = -1, bestProjection = -Infinity;
            for (let edge = 0; edge < 3; edge += 1) { const candidate = topology.neighbours[index * 3 + edge], candidateDirection = directionAt(topology, candidate), toward = Vector.subtract(candidateDirection, Vector.scale(direction, Vector.dot(candidateDirection, direction))), projection = -Vector.dot(toward, wind); if (projection > bestProjection) { bestProjection = projection; upwind = candidate; } }
            const upwindRise = upwind >= 0 ? Math.max(0, geology.elevationMeters[index] - geology.elevationMeters[upwind]) : 0, temperature = clamp(29 - absoluteLatitude * 0.45 - elevation * 0.0064 + oceanity * 1.7 + climateNoise * 2.2, -38, 38), seasonality = clamp(3.5 + absoluteLatitude * 0.34 + (1 - oceanity) * 7 + Math.abs(climateNoise) * 2, 2, 42), precipitation = clamp(420 + equatorialRain * 1900 + midlatitudeRain * 660 - subtropicalDry * 720 + oceanity * 520 + moistureNoise * 360 + upwindRise * 0.48, 70, 4400), potentialEvaporation = clamp(470 + Math.max(-10, temperature) * 31 + (1 - oceanity) * 160, 120, 1900), aridity = clamp(precipitation / potentialEvaporation, 0.04, 5), snow = clamp((-temperature + seasonality * 0.18) / 22, 0, 1), runoff = clamp(0.08 + Math.min(1, aridity / 1.6) * 0.48 + geology.slope[index] * 0.9 + drainage.lakeDepthMeters[index] / 600, 0.06, 0.88);
            latitudeDegrees[index] = latitude; meanTemperatureC[index] = temperature; seasonalRangeC[index] = seasonality; annualPrecipitationMm[index] = precipitation; moisture[index] = clamp(aridity / 1.8, 0, 1); exposure[index] = clamp(.22 + geology.slope[index] * 1.6 + (1 - oceanity) * .26 + Math.abs(climateNoise) * .14, 0, 1); oceanicity[index] = oceanity; aridityIndex[index] = aridity; snowFraction[index] = snow; runoffCoefficient[index] = runoff; windEast[index] = Vector.dot(wind, frame.east); windNorth[index] = Vector.dot(wind, frame.north);
        }
        return Object.freeze({ latitudeDegrees, meanTemperatureC, seasonalRangeC, annualPrecipitationMm, moisture, exposure, oceanicity, aridityIndex, snowFraction, runoffCoefficient, windEast, windNorth });
    }
    function completeHydrology(topology, geology, ocean, drainage, climate) {
        const localRunoffCubicMeters = new Float64Array(topology.count), dischargeCubicMeters = new Float64Array(topology.count), riverOrder = new Uint8Array(topology.count), maximumIncomingOrder = new Uint8Array(topology.count), maximumIncomingCount = new Uint8Array(topology.count), riverMask = new Uint8Array(topology.count), land = [];
        let localRunoffTotal = 0;
        for (let index = 0; index < topology.count; index += 1) if (!ocean.isOcean[index]) { const runoff = climate.annualPrecipitationMm[index] / 1000 * topology.areas[index] * climate.runoffCoefficient[index]; localRunoffCubicMeters[index] = runoff; dischargeCubicMeters[index] = runoff; localRunoffTotal += runoff; land.push(index); }
        land.sort((left, right) => drainage.filledElevationMeters[right] - drainage.filledElevationMeters[left] || right - left);
        for (const index of land) { const incoming = maximumIncomingOrder[index]; riverOrder[index] = incoming ? incoming + (maximumIncomingCount[index] >= 2 ? 1 : 0) : 1; const next = drainage.receiver[index]; if (next < 0) throw new Error(`Land cell ${topology.ids[index]} has no drainage receiver.`); dischargeCubicMeters[next] += dischargeCubicMeters[index]; const order = riverOrder[index]; if (order > maximumIncomingOrder[next]) { maximumIncomingOrder[next] = order; maximumIncomingCount[next] = 1; } else if (order === maximumIncomingOrder[next]) maximumIncomingCount[next] = Math.min(255, maximumIncomingCount[next] + 1); }
        const ranked = land.slice().sort((left, right) => dischargeCubicMeters[left] - dischargeCubicMeters[right] || left - right), thresholdIndex = Math.max(0, Math.floor(ranked.length * 0.94)), riverThresholdCubicMeters = ranked.length ? dischargeCubicMeters[ranked[thresholdIndex]] : Infinity;
        for (const index of land) if (dischargeCubicMeters[index] >= riverThresholdCubicMeters && riverOrder[index] >= 2) riverMask[index] = 1;
        let oceanDischargeTotal = 0; for (let index = 0; index < topology.count; index += 1) if (ocean.isOcean[index]) oceanDischargeTotal += dischargeCubicMeters[index];
        return Object.freeze({ ...drainage, localRunoffCubicMeters, dischargeCubicMeters, riverOrder, riverMask, riverThresholdCubicMeters, localRunoffTotalCubicMeters: localRunoffTotal, oceanDischargeTotalCubicMeters: oceanDischargeTotal });
    }

    function classifyBiome(index, geology, ocean, hydrology, climate) {
        if (ocean.isOcean[index]) return ocean.depthMeters[index] > 180 ? 0 : 1;
        if (hydrology.lakeDepthMeters[index] > 1.5) return 2;
        const temperature = climate.meanTemperatureC[index], precipitation = climate.annualPrecipitationMm[index], aridity = climate.aridityIndex[index], elevation = geology.elevationMeters[index], wet = hydrology.lakeDepthMeters[index] > 0.18 || (hydrology.riverMask[index] && geology.slope[index] < 0.17 && aridity > 0.75);
        if (wet) return 3; if (temperature < -12 || climate.snowFraction[index] > 0.82) return 4; if (temperature < -2) return 5; if (elevation > 1150 && temperature < 11) return 6; if (temperature < 7) return aridity >= 0.72 ? 7 : 11; if (temperature < 18) { if (precipitation > 2100) return 8; if (aridity > 1.02) return 9; if (aridity > 0.55) return 10; return 11; } if (aridity < 0.30) return 12; if (aridity < 0.68) return 13; if (aridity < 1.25) return 14; return 15;
    }
    function buildEcology(topology, geology, ocean, hydrology, climate) {
        const biomeIndex = new Uint8Array(topology.count), regionIndex = new Int32Array(topology.count), macroLevel = Math.min(2, topology.level), macroById = new Map(), accumulators = [];
        for (let index = 0; index < topology.count; index += 1) {
            const biome = classifyBiome(index, geology, ocean, hydrology, climate), parsed = Icosphere.parseId(topology.ids[index]), macroId = Icosphere.makeId(parsed.root, parsed.path.slice(0, macroLevel)); biomeIndex[index] = biome;
            let region = macroById.get(macroId); if (region === undefined) { region = accumulators.length; macroById.set(macroId, region); accumulators.push({ macroId, minimumCell: index, cellCount: 0, area: 0, elevation: 0, temperature: 0, precipitation: 0, biomeAreas: new Float64Array(BIOMES.length) }); }
            regionIndex[index] = region; const row = accumulators[region], weight = topology.areas[index]; row.minimumCell = Math.min(row.minimumCell, index); row.cellCount += 1; row.area += weight; row.elevation += geology.elevationMeters[index] * weight; row.temperature += climate.meanTemperatureC[index] * weight; row.precipitation += climate.annualPrecipitationMm[index] * weight; row.biomeAreas[biome] += weight;
        }
        const regions = accumulators.map((row, index) => { let biome = 0; for (let candidate = 1; candidate < row.biomeAreas.length; candidate += 1) if (row.biomeAreas[candidate] > row.biomeAreas[biome]) biome = candidate; return Object.freeze({ id: `eco:${BIOMES[biome]}:${row.macroId}`, index, biomeIndex: biome, biome: BIOMES[biome], macroCellId: row.macroId, minimumCellId: topology.ids[row.minimumCell], cellCount: row.cellCount, areaSquareMeters: row.area, meanElevationMeters: row.elevation / row.area, meanTemperatureC: row.temperature / row.area, meanAnnualPrecipitationMm: row.precipitation / row.area }); });
        return Object.freeze({ aggregation: Object.freeze({ method: 'level-2-connected-spherical-macro-cells', level: macroLevel, targetMinimumRegions: 300, targetMaximumRegions: 600 }), biomeNames: BIOMES, biomeIndex, regionIndex, regions: Object.freeze(regions) });
    }
    function fieldFingerprint(options, topology, geology, ocean, hydrology, climate, ecology) {
        let left = fnv1a(FORMAT, 0x811c9dc5), right = fnv1a(FORMAT, 0x9e3779b9); const feedText = value => { left = fnv1a(String(value), left); right = fnv1a(String(value), right); }, feedArray = (name, values, scale = 1) => { feedText(name); feedText(values.length); for (let index = 0; index < values.length; index += 1) { const value = Math.round(Number(values[index]) * scale); left = mix32(left ^ value ^ Math.imul(index + 1, 0x45d9f3b)); right = mix32(right ^ value ^ Math.imul(index + 1, 0x27d4eb2d)); } };
        feedText(VERSION); feedText(ENGINE_VERSION); feedText(options.seed); feedText(options.level); feedText(options.oceanCoverageTarget); feedText(options.plateCount); for (const key of ['radiusMeters','minimumElevationMeters','maximumElevationMeters','axialTiltDegrees']) feedText(options.planet[key]);
        feedArray('elevation', geology.elevationMeters, 100); feedArray('erosion', geology.erosionCorrectionMeters, 100); feedArray('plate', geology.plateIndex); feedArray('boundary', geology.boundaryStrength, 100000); feedArray('ocean', ocean.isOcean); feedArray('receiver', hydrology.receiver); feedArray('filled', hydrology.filledElevationMeters, 1000); feedArray('lake', hydrology.lakeDepthMeters, 100); feedArray('discharge', hydrology.dischargeCubicMeters, 0.001); feedArray('temperature', climate.meanTemperatureC, 1000); feedArray('precipitation', climate.annualPrecipitationMm, 100); feedArray('moisture', climate.moisture, 100000); feedArray('exposure', climate.exposure, 100000); feedArray('biome', ecology.biomeIndex); feedArray('region', ecology.regionIndex);
        return `pg2-${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
    }
    function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
    function auditWorld(world) {
        if (!world || world.format !== FORMAT || world.version !== VERSION) throw new TypeError('Expected a spherical planet-generation result.');
        const count = world.cellCount, seen = new Uint32Array(count), token = 1; let cycles = 0, incomplete = 0, maximumDrainageSteps = 0;
        for (let start = 0; start < count; start += 1) if (!world.ocean.isOcean[start]) { let current = start, steps = 0; while (current >= 0 && !world.ocean.isOcean[current] && steps <= count) { if (seen[current] === token + start) { cycles += 1; break; } seen[current] = token + start; const next = world.hydrology.receiver[current]; if (next < 0 || !(world.hydrology.filledElevationMeters[next] < world.hydrology.filledElevationMeters[current])) { incomplete += 1; break; } current = next; steps += 1; } if (steps > count || current < 0) incomplete += 1; maximumDrainageSteps = Math.max(maximumDrainageSteps, steps); }
        const across = { elevation: [], temperature: [], precipitation: [] }, inside = { elevation: [], temperature: [], precipitation: [] };
        for (let index = 0; index < count; index += 1) for (let edge = 0; edge < 3; edge += 1) { const next = world.topology.neighbours[index * 3 + edge]; if (next <= index) continue; const target = world.topology.roots[index] === world.topology.roots[next] ? inside : across; target.elevation.push(Math.abs(world.geology.elevationMeters[index] - world.geology.elevationMeters[next])); target.temperature.push(Math.abs(world.climate.meanTemperatureC[index] - world.climate.meanTemperatureC[next])); target.precipitation.push(Math.abs(world.climate.annualPrecipitationMm[index] - world.climate.annualPrecipitationMm[next])); }
        const contrasts = Object.freeze(Object.fromEntries(['elevation','temperature','precipitation'].map(name => { const boundaryMean = mean(across[name]), interiorMean = mean(inside[name]); return [name, Object.freeze({ rootBoundaryMean: boundaryMean, interiorMean, ratio: interiorMean > 1e-12 ? boundaryMean / interiorMean : boundaryMean === 0 ? 1 : Infinity })]; }))), maximumFaceContrastRatio = Math.max(...Object.values(contrasts).map(value => value.ratio)), regionCells = new Uint32Array(world.ecology.regions.length);
        for (let index = 0; index < count; index += 1) if (world.ecology.regionIndex[index] >= 0 && world.ecology.regionIndex[index] < regionCells.length) regionCells[world.ecology.regionIndex[index]] += 1;
        const accountedRegionCells = regionCells.reduce((sum, value) => sum + value, 0); let totalArea = 0, areaCompensation = 0; for (const value of world.topology.areas) { const corrected = value - areaCompensation, next = totalArea + corrected; areaCompensation = (next - totalArea) - corrected; totalArea = next; } const runoffError = Math.abs(world.hydrology.localRunoffTotalCubicMeters - world.hydrology.oceanDischargeTotalCubicMeters) / Math.max(1, world.hydrology.localRunoffTotalCubicMeters);
        return Object.freeze({
            cells: count, totalAreaSquareMeters: totalArea, areaRelativeError: Math.abs(totalArea - world.planet.surfaceAreaSquareMeters) / world.planet.surfaceAreaSquareMeters,
            oceanCoverageFraction: world.ocean.coverageFraction, oceanComponents: world.ocean.components.length,
            drainageCycles: cycles, incompleteDrainageCells: incomplete, maximumDrainageSteps, runoffConservationRelativeError: runoffError,
            ecologicalRegions: world.ecology.regions.length, ecologicalRegionTargetMet: world.level < 2 || (world.ecology.regions.length >= 300 && world.ecology.regions.length <= 600), accountedRegionCells, allCellsRegionAssigned: accountedRegionCells === count && regionCells.every(value => value > 0),
            faceBoundaryContrasts: contrasts, maximumFaceContrastRatio,
            fingerprintMatches: fieldFingerprint(world.options, world.topology, world.geology, world.ocean, world.hydrology, world.climate, world.ecology) === world.fingerprint
        });
    }
    function generate(value) {
        const options = normalizeOptions(value), topology = buildTopology(options), geology = buildGeology(options, topology), ocean = buildOcean(options, topology, geology), drainage = buildDrainage(topology, geology, ocean), climate = buildClimate(options, topology, geology, ocean, drainage), hydrology = completeHydrology(topology, geology, ocean, drainage, climate), ecology = buildEcology(topology, geology, ocean, hydrology, climate), fingerprint = fieldFingerprint(options, topology, geology, ocean, hydrology, climate, ecology);
        const world = Object.freeze({ format: FORMAT, version: VERSION, contract: 'PlanetGeometry.v2', engineVersion: ENGINE_VERSION, seed: options.seed, level: options.level, cellCount: topology.count, options, planet: options.planet, topology, geology, ocean, hydrology, climate, ecology, fingerprint }), result = Object.freeze({ ...world, audit: auditWorld(world) });
        Icosphere.clearCaches?.(); return result;
    }
    function cloneResult(world) {
        if (!world || world.format !== FORMAT) throw new TypeError('Expected a spherical planet-generation result.');
        const cloneGroup = group => Object.freeze(Object.fromEntries(Object.entries(group).map(([key, value]) => [key, typedClone(value)])));
        return Object.freeze({ ...world, topology: cloneGroup(world.topology), geology: cloneGroup(world.geology), ocean: cloneGroup(world.ocean), hydrology: cloneGroup(world.hydrology), climate: cloneGroup(world.climate), ecology: Object.freeze({ ...world.ecology, biomeIndex: typedClone(world.ecology.biomeIndex), regionIndex: typedClone(world.ecology.regionIndex) }) });
    }

    let workerSequence = 0;
    function generateInWorker(value, runtime = {}) {
        const options = normalizeOptions(value), WorkerClass = runtime.Worker || (typeof SDWorldWorkerRuntime !== 'undefined' ? SDWorldWorkerRuntime.Worker : globalThis.Worker);
        if (typeof WorkerClass !== 'function') return Promise.reject(new Error('Planet-generation worker is unavailable.'));
        let workerUrl = runtime.workerUrl;
        if (!workerUrl) { if (WORKER_FILENAME.includes('@@SD_')) return Promise.reject(new Error('Planet-generation worker URL is unresolved in canonical source.')); const base = runtime.baseUrl || globalThis.document?.baseURI || globalThis.location?.href; if (!base) return Promise.reject(new Error('Planet-generation worker base URL is unavailable.')); workerUrl = new URL(WORKER_FILENAME, base).href; }
        const timeoutMs = clamp(integer(runtime.timeoutMs ?? 60000, 1000, 120000, 'timeoutMs'), 1000, 120000), requestId = `planet-${++workerSequence}`;
        return new Promise((resolve, reject) => {
            const worker = new WorkerClass(workerUrl, { name: 'study-director-planet-generator' }); let settled = false, timer = 0;
            const finish = (callback, valueToReturn) => { if (settled) return; settled = true; if (timer) clearTimeout(timer); runtime.signal?.removeEventListener?.('abort', abort); try { worker.terminate(); } catch (_error) {} callback(valueToReturn); };
            const abort = () => finish(reject, new DOMException('Planet generation was aborted.', 'AbortError'));
            worker.onmessage = event => { const response = event && event.data; if (!response || response.requestId !== requestId) return; if (!response.ok) { const error = new Error(response.error?.message || 'Planet-generation worker failed.'); error.name = response.error?.name || 'Error'; finish(reject, error); return; } try { if (!response.result || response.result.format !== FORMAT || response.result.audit?.fingerprintMatches !== true) throw new Error('Planet-generation worker returned an invalid result.'); finish(resolve, response.result); } catch (error) { finish(reject, error); } };
            worker.onerror = event => finish(reject, new Error(event?.message || 'Planet-generation worker crashed.'));
            timer = setTimeout(() => finish(reject, new Error(`Planet-generation worker exceeded ${timeoutMs} ms.`)), timeoutMs);
            if (runtime.signal?.aborted) { abort(); return; } runtime.signal?.addEventListener?.('abort', abort, { once: true });
            try { worker.postMessage({ format: 'study-director.world.planet-worker-request', version: 1, requestId, operation: 'generate', options }); }
            catch (error) { finish(reject, error); }
        });
    }

    return Object.freeze({
        format: FORMAT, version: VERSION, engineVersion: ENGINE_VERSION, workerFilename: WORKER_FILENAME,
        limits: Object.freeze({ defaultLevel: DEFAULT_LEVEL, maximumLevel: MAX_LEVEL, maximumCells: Icosphere.cellCount(MAX_LEVEL), maximumSeedCharacters: MAX_SEED_CHARS }),
        biomeNames: BIOMES, normalizeOptions, sampleGeology, createGeologySampler, generate, generateInWorker, auditWorld, cloneResult, fingerprint: fieldFingerprint
    });
})();
