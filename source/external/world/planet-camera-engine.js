const SDWorldPlanetCameraEngine = (() => {
    'use strict';
    const FORMAT = 'study-director.world.spherical-camera-state';
    const VERSION = 2;
    const ENGINE_VERSION = 2;
    const FOV_RADIANS = Math.PI / 3;
    const MIN_DISTANCE_METERS = 54;
    const MAX_DISTANCE_RADII = 5.5;
    const MAX_TILT_RADIANS = 1.26;
    const CLEARANCE_METERS = 48;
    const PICK_STEPS = 72;
    const PICK_REFINEMENTS = 14;
    const Math3 = SDWorldSphericalMathEngine;
    const Vector = Math3.vector;
    const Quaternion = Math3.quaternion;

    function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
    function finite(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
    function planetOf(value) { const planet = value?.planet || value; if (!planet || !(Number(planet.radiusMeters) > 0)) throw new TypeError('Spherical camera requires an analytic planet.'); return planet; }
    function normalizeDirection(value, fallback = { x: .43, y: .56, z: .71 }) { try { return Vector.normalize(value || fallback, 'camera direction'); } catch (_error) { return Vector.normalize(fallback, 'default camera direction'); } }
    function tangent(direction, value, fallback) { try { return Math3.tangentUnit(direction, value); } catch (_error) { return Math3.tangentUnit(direction, fallback); } }
    function headingTangent(direction, source, planet) {
        const frame = Math3.localFrame(direction, planet), angle = Math3.wrapRadians(finite(source.headingRadians, -.38)), fallback = Vector.add(Vector.scale(frame.east, Math.cos(angle)), Vector.scale(frame.north, Math.sin(angle)));
        return tangent(direction, source.headingTangent, fallback);
    }
    function headingFromTangent(direction, value, planet) { const frame = Math3.localFrame(direction, planet), current = tangent(direction, value, frame.east); return Math3.wrapRadians(Math.atan2(Vector.dot(current, frame.north), Vector.dot(current, frame.east))); }
    function semanticZoom(distanceMeters, planet) { return distanceMeters > planet.radiusMeters * 1.4 ? 'Orbit' : distanceMeters > 5000 ? 'Planet' : distanceMeters > 800 ? 'Region' : 'Detail'; }
    function focusPlace(value) { if (!value || typeof value !== 'object' || !value.direction) return null; try { return Object.freeze({ id: String(value.id || value.cellId || '').slice(0, 200), label: String(value.label || 'Focus place').slice(0, 240), direction: normalizeDirection(value.direction) }); } catch (_error) { return null; } }
    function normalize(value, planetValue) {
        const planet = planetOf(planetValue), source = value && typeof value === 'object' ? value : {}, focusDirection = normalizeDirection(source.focusDirection), orientation = headingTangent(focusDirection, source, planet);
        const distanceMeters = clamp(finite(source.distanceMeters, planet.radiusMeters * 2.65), MIN_DISTANCE_METERS, planet.radiusMeters * MAX_DISTANCE_RADII);
        return Object.freeze({
            format: FORMAT,
            version: VERSION,
            contract: 'PlanetCameraState.v2',
            focusDirection,
            headingTangent: orientation,
            distanceMeters,
            headingRadians: headingFromTangent(focusDirection, orientation, planet),
            tiltRadians: clamp(finite(source.tiltRadians, .18), 0, MAX_TILT_RADIANS),
            selectedFocusPlace: focusPlace(source.selectedFocusPlace),
            semanticZoomLevel: semanticZoom(distanceMeters, planet)
        });
    }
    function serialize(value, planetValue) { const state = normalize(value, planetValue); return Object.freeze({ format: FORMAT, version: VERSION, contract: state.contract, focusDirection: state.focusDirection, headingTangent: state.headingTangent, distanceMeters: state.distanceMeters, headingRadians: state.headingRadians, tiltRadians: state.tiltRadians, selectedFocusPlace: state.selectedFocusPlace, semanticZoomLevel: state.semanticZoomLevel }); }
    function deserialize(value, planetValue) {
        if (!value || typeof value !== 'object') return null;
        if (value.format !== undefined && value.format !== FORMAT) return null;
        if (value.version !== undefined && ![1, VERSION].includes(Number(value.version))) return null;
        try {
            if (!value.focusDirection || !['x', 'y', 'z'].every(axis => Number.isFinite(Number(value.focusDirection[axis])))) return null;
            return normalize(value, planetValue);
        } catch (_error) { return null; }
    }
    function surfaceHeight(direction, planet, sampler) { const sample = sampler?.sample?.(direction), elevation = finite(sample?.elevationMeters, planet.seaLevelMeters || 0); return Math.max(finite(planet.seaLevelMeters, 0), elevation); }
    function pose(value, planetValue, sampler) {
        const planet = planetOf(planetValue), state = normalize(value, planet), direction = state.focusDirection, targetHeight = surfaceHeight(direction, planet, sampler), target = Vector.add(planet.center || { x: 0, y: 0, z: 0 }, Vector.scale(direction, planet.radiusMeters + targetHeight)), radial = Vector.normalize(Vector.add(Vector.scale(direction, Math.cos(state.tiltRadians)), Vector.scale(state.headingTangent, Math.sin(state.tiltRadians))), 'camera radial'), baseEye = Vector.add(target, Vector.scale(radial, state.distanceMeters));
        let eye = baseEye, clearanceMeters = Infinity;
        for (let iteration = 0; iteration < 3; iteration += 1) {
            const relative = Vector.subtract(eye, planet.center || { x: 0, y: 0, z: 0 }), eyeDirection = Vector.normalize(relative, 'camera eye direction'), distance = Vector.length(relative), groundRadius = planet.radiusMeters + surfaceHeight(eyeDirection, planet, sampler), minimumRadius = groundRadius + CLEARANCE_METERS;
            clearanceMeters = distance - groundRadius;
            if (clearanceMeters >= CLEARANCE_METERS - 1e-7) break;
            eye = Vector.add(planet.center || { x: 0, y: 0, z: 0 }, Vector.scale(eyeDirection, minimumRadius));
        }
        const forward = Vector.normalize(Vector.subtract(target, eye), 'camera forward'), desiredUp = Vector.add(Vector.scale(state.headingTangent, Math.cos(state.tiltRadians)), Vector.scale(direction, -Math.sin(state.tiltRadians))), projectedUp = Vector.subtract(desiredUp, Vector.scale(forward, Vector.dot(desiredUp, forward))), fallbackUp = Math3.localFrame(direction, planet).north, viewUp = tangent(forward, projectedUp, fallbackUp), right = Vector.normalize(Vector.cross(forward, viewUp), 'camera right'), correctedUp = Vector.normalize(Vector.cross(right, forward), 'camera up'), relativeEye = Vector.subtract(eye, planet.center || { x: 0, y: 0, z: 0 }), eyeDirection = Vector.normalize(relativeEye, 'camera eye direction'), eyeGroundRadius = planet.radiusMeters + surfaceHeight(eyeDirection, planet, sampler);
        return Object.freeze({ state, target, eye, forward, right, viewUp: correctedUp, distanceFromCentre: Vector.length(relativeEye), surfaceElevationMeters: targetHeight, clearanceMeters: Vector.length(relativeEye) - eyeGroundRadius });
    }
    function viewportOf(value) { return Object.freeze({ width: Math.max(1, finite(value?.width, 1)), height: Math.max(1, finite(value?.height, 1)) }); }
    function ray(value, pixelValue, viewportValue, planetValue, sampler) {
        const viewport = viewportOf(viewportValue), pixel = { x: finite(pixelValue?.x, viewport.width / 2), y: finite(pixelValue?.y, viewport.height / 2) }, cameraPose = pose(value, planetValue, sampler), aspect = viewport.width / viewport.height, tangentFov = Math.tan(FOV_RADIANS / 2), ndcX = pixel.x / viewport.width * 2 - 1, ndcY = 1 - pixel.y / viewport.height * 2, direction = Vector.normalize(Vector.add(Vector.add(cameraPose.forward, Vector.scale(cameraPose.right, ndcX * tangentFov * aspect)), Vector.scale(cameraPose.viewUp, ndcY * tangentFov)), 'pointer ray');
        return Object.freeze({ origin: cameraPose.eye, direction, pose: cameraPose, pixel: Object.freeze(pixel), viewport });
    }
    function sphereInterval(rayValue, radius, centreValue = { x: 0, y: 0, z: 0 }) {
        const offset = Vector.subtract(rayValue.origin, centreValue), b = Vector.dot(offset, rayValue.direction), c = Vector.dot(offset, offset) - radius * radius, discriminant = b * b - c;
        if (discriminant < 0) return null;
        const root = Math.sqrt(Math.max(0, discriminant)), near = -b - root, far = -b + root;
        if (far < 0) return null;
        return Object.freeze({ near: Math.max(0, near), far });
    }
    function surfaceAtRay(rayValue, planetValue, sampler) {
        const planet = planetOf(planetValue), centre = planet.center || { x: 0, y: 0, z: 0 }, outerRadius = planet.radiusMeters + Math.max(finite(planet.maximumElevationMeters, 0), finite(planet.seaLevelMeters, 0)), interval = sphereInterval(rayValue, outerRadius, centre);
        if (!interval) return null;
        const signed = distance => { const point = Vector.add(rayValue.origin, Vector.scale(rayValue.direction, distance)), relative = Vector.subtract(point, centre), direction = Vector.normalize(relative, 'surface ray direction'); return Vector.length(relative) - planet.radiusMeters - surfaceHeight(direction, planet, sampler); };
        let previousDistance = interval.near, previousSigned = signed(previousDistance);
        if (previousSigned <= 0) previousDistance = Math.max(0, previousDistance - .01), previousSigned = signed(previousDistance);
        for (let step = 1; step <= PICK_STEPS; step += 1) {
            const distance = interval.near + (interval.far - interval.near) * step / PICK_STEPS, currentSigned = signed(distance);
            if (currentSigned <= 0 && previousSigned > 0) {
                let low = previousDistance, high = distance;
                for (let iteration = 0; iteration < PICK_REFINEMENTS; iteration += 1) { const middle = (low + high) / 2; if (signed(middle) > 0) low = middle; else high = middle; }
                const hitDistance = (low + high) / 2, point = Vector.add(rayValue.origin, Vector.scale(rayValue.direction, hitDistance)), direction = Vector.normalize(Vector.subtract(point, centre), 'surface hit direction'), sample = sampler?.sample?.(direction) || null;
                return Object.freeze({ distance: hitDistance, point, direction, altitudeMeters: surfaceHeight(direction, planet, sampler), sample });
            }
            previousDistance = distance; previousSigned = currentSigned;
        }
        return null;
    }
    function rotateState(value, rotation, planetValue) { const planet = planetOf(planetValue), state = normalize(value, planet), focusDirection = normalizeDirection(Quaternion.rotateVector(rotation, state.focusDirection)), orientation = tangent(focusDirection, Quaternion.rotateVector(rotation, state.headingTangent), Math3.localFrame(focusDirection, planet).east); return normalize({ ...state, focusDirection, headingTangent: orientation }, planet); }
    function travelTowards(value, targetDirectionValue, progressValue, planetValue, targetDistanceMeters = null) { const planet = planetOf(planetValue), state = normalize(value, planet), target = normalizeDirection(targetDirectionValue), progress = clamp(finite(progressValue, 0), 0, 1), angle = Math3.angularDistance(state.focusDirection, target); if (angle <= 1e-12) return normalize({ ...state, focusDirection: progress >= 1 ? target : state.focusDirection, distanceMeters: targetDistanceMeters === null ? state.distanceMeters : state.distanceMeters + (finite(targetDistanceMeters, state.distanceMeters) - state.distanceMeters) * progress }, planet); const tangentDirection = tangent(state.focusDirection, Vector.subtract(target, Vector.scale(state.focusDirection, Vector.dot(target, state.focusDirection))), Math3.localFrame(state.focusDirection, planet).east), nextFocus = progress >= 1 ? target : Math3.moveGeodesic(state.focusDirection, tangentDirection, angle * progress), rotated = rotateState(state, Quaternion.betweenVectors(state.focusDirection, nextFocus), planet), distanceMeters = targetDistanceMeters === null ? state.distanceMeters : state.distanceMeters + (finite(targetDistanceMeters, state.distanceMeters) - state.distanceMeters) * progress; return normalize({ ...rotated, focusDirection: nextFocus, distanceMeters }, planet); }
    function rotateHeading(value, angleRadians, planetValue) { const planet = planetOf(planetValue), state = normalize(value, planet), rotation = Quaternion.fromAxisAngle(state.focusDirection, finite(angleRadians, 0)), orientation = tangent(state.focusDirection, Quaternion.rotateVector(rotation, state.headingTangent), state.headingTangent); return normalize({ ...state, headingTangent: orientation }, planet); }
    function orbit(value, dx, dy, planetValue) { const planet = planetOf(planetValue), yawed = rotateHeading(value, -finite(dx, 0) * .0065, planet); return normalize({ ...yawed, tiltRadians: yawed.tiltRadians + finite(dy, 0) * .005 }, planet); }
    function fallbackTravel(value, fromPixel, toPixel, viewportValue, planetValue) {
        const planet = planetOf(planetValue), state = normalize(value, planet), dx = finite(toPixel?.x, 0) - finite(fromPixel?.x, 0), dy = finite(toPixel?.y, 0) - finite(fromPixel?.y, 0), scale = clamp(state.distanceMeters / planet.radiusMeters, .002, 3.5) * .0017, frame = pose(state, planet, null), tangentMove = Vector.add(Vector.scale(frame.right, -dx), Vector.scale(frame.viewUp, dy)), projected = Vector.subtract(tangentMove, Vector.scale(state.focusDirection, Vector.dot(tangentMove, state.focusDirection)));
        if (Vector.length(projected) <= 1e-12) return state;
        const nextFocus = Math3.moveGeodesic(state.focusDirection, projected, clamp(Math.hypot(dx, dy) * scale, 0, .42)), rotation = Quaternion.betweenVectors(state.focusDirection, nextFocus);
        return rotateState(state, rotation, planet);
    }
    function beginGrab(value, pixel, viewportValue, planetValue, sampler) { const state = normalize(value, planetValue), hit = surfaceAtRay(ray(state, pixel, viewportValue, planetValue, sampler), planetValue, sampler); return Object.freeze({ anchorDirection: hit?.direction || null, lastPixel: Object.freeze({ x: finite(pixel?.x, 0), y: finite(pixel?.y, 0) }), surface: Boolean(hit) }); }
    function dragGrab(value, grabValue, pixel, viewportValue, planetValue, sampler) {
        let state = normalize(value, planetValue); const nextPixel = Object.freeze({ x: finite(pixel?.x, 0), y: finite(pixel?.y, 0) });
        if (grabValue?.anchorDirection) {
            for (let iteration = 0; iteration < 3; iteration += 1) { const current = surfaceAtRay(ray(state, nextPixel, viewportValue, planetValue, sampler), planetValue, sampler); if (!current) break; const angle = Math3.angularDistance(current.direction, grabValue.anchorDirection); if (angle <= 1e-10) break; state = rotateState(state, Quaternion.betweenVectors(current.direction, grabValue.anchorDirection), planetValue); }
        } else state = fallbackTravel(state, grabValue?.lastPixel || nextPixel, nextPixel, viewportValue, planetValue);
        return Object.freeze({ camera: state, grab: Object.freeze({ anchorDirection: grabValue?.anchorDirection || null, lastPixel: nextPixel, surface: Boolean(grabValue?.anchorDirection) }) });
    }
    function dragBetween(value, fromPixel, toPixel, viewportValue, planetValue, sampler) { return dragGrab(value, beginGrab(value, fromPixel, viewportValue, planetValue, sampler), toPixel, viewportValue, planetValue, sampler).camera; }
    function zoomByFactorAt(value, factorValue, pixel, viewportValue, planetValue, sampler) {
        const planet = planetOf(planetValue), before = normalize(value, planet), anchor = surfaceAtRay(ray(before, pixel, viewportValue, planet, sampler), planet, sampler), factor = clamp(finite(factorValue, 1), .05, 20); let state = normalize({ ...before, distanceMeters: before.distanceMeters * factor }, planet);
        if (!anchor) return state;
        for (let iteration = 0; iteration < 4; iteration += 1) { const current = surfaceAtRay(ray(state, pixel, viewportValue, planet, sampler), planet, sampler); if (!current) break; const angle = Math3.angularDistance(current.direction, anchor.direction); if (angle <= 1e-10) break; state = rotateState(state, Quaternion.betweenVectors(current.direction, anchor.direction), planet); }
        return state;
    }
    function zoomAt(value, delta, pixel, viewportValue, planetValue, sampler) { return zoomByFactorAt(value, Math.exp(clamp(finite(delta, 0), -1200, 1200) * .00145), pixel, viewportValue, planetValue, sampler); }
    function projectDirection(value, directionValue, viewportValue, planetValue, sampler) {
        const planet = planetOf(planetValue), viewport = viewportOf(viewportValue), cameraPose = pose(value, planet, sampler), direction = normalizeDirection(directionValue), point = Vector.add(planet.center || { x: 0, y: 0, z: 0 }, Vector.scale(direction, planet.radiusMeters + surfaceHeight(direction, planet, sampler))), offset = Vector.subtract(point, cameraPose.eye), depth = Vector.dot(offset, cameraPose.forward);
        if (!(depth > 0)) return null;
        const tangentFov = Math.tan(FOV_RADIANS / 2), ndcX = Vector.dot(offset, cameraPose.right) / (depth * tangentFov * viewport.width / viewport.height), ndcY = Vector.dot(offset, cameraPose.viewUp) / (depth * tangentFov);
        return Object.freeze({ x: (ndcX + 1) * viewport.width / 2, y: (1 - ndcY) * viewport.height / 2, depth, visible: Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1 });
    }
    function pick(value, pixel, viewportValue, planetValue, sampler) {
        const planetResult = planetValue?.planet ? planetValue : null, planet = planetOf(planetValue), hit = surfaceAtRay(ray(value, pixel, viewportValue, planet, sampler), planet, sampler); if (!hit) return null;
        const coordinates = Math3.toLatLon(hit.direction, planet), sample = hit.sample || sampler?.sample?.(hit.direction) || {}, index = Number.isInteger(sample.index) ? sample.index : null, regionIndex = index !== null && planetResult?.ecology?.regionIndex ? planetResult.ecology.regionIndex[index] : null, region = Number.isInteger(regionIndex) ? planetResult.ecology.regions[regionIndex] : null, biome = Number.isInteger(sample.biomeIndex) ? (planetResult?.ecology?.biomeNames?.[sample.biomeIndex] || `biome-${sample.biomeIndex}`) : 'unclassified';
        return Object.freeze({ format: 'study-director.world.spherical-place', version: 1, id: sample.cellId || `direction:${IcosphereSafeKey(hit.direction)}`, cellId: sample.cellId || null, direction: hit.direction, point: hit.point, latitudeDegrees: coordinates.latitudeDegrees, longitudeDegrees: coordinates.longitudeDegrees, longitudeDefined: coordinates.longitudeDefined, altitudeMeters: hit.altitudeMeters, canonicalElevationMeters: finite(sample.canonicalElevationMeters, hit.altitudeMeters), biome, biomeIndex: Number.isInteger(sample.biomeIndex) ? sample.biomeIndex : null, isOcean: Boolean(sample.isOcean), temperatureC: finite(sample.temperatureC, 0), precipitationMm: finite(sample.precipitationMm, 0), snowFraction: finite(sample.snowFraction, 0), slope: finite(sample.slope, 0), regionId: region?.id || null, regionIndex: Number.isInteger(regionIndex) ? regionIndex : null, riverOrder: index !== null && planetResult?.hydrology?.riverOrder ? Number(planetResult.hydrology.riverOrder[index]) : 0, distanceMeters: hit.distance });
    }
    function IcosphereSafeKey(direction) { return [direction.x, direction.y, direction.z].map(value => Math.round(value * 1e7)).join(':'); }

    return Object.freeze({
        format: FORMAT, version: VERSION, engineVersion: ENGINE_VERSION,
        limits: Object.freeze({ fovRadians: FOV_RADIANS, minimumDistanceMeters: MIN_DISTANCE_METERS, maximumDistanceRadii: MAX_DISTANCE_RADII, maximumTiltRadians: MAX_TILT_RADIANS, clearanceMeters: CLEARANCE_METERS }),
        normalize, serialize, deserialize, semanticZoom, pose, ray, sphereInterval, intersectSurface: surfaceAtRay, projectDirection, rotateState, travelTowards, rotateHeading, orbit, beginGrab, dragGrab, dragBetween, zoomAt, zoomByFactorAt, pick
    });
})();
