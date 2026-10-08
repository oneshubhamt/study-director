const SDWorldSphericalMathEngine = (() => {
    'use strict';
    const FORMAT = 'study-director.world.spherical-math';
    const VERSION = 1;
    const EPSILON = 1e-12;
    const POLE_EPSILON = 1e-10;
    const TAU = Math.PI * 2;
    const RAD_TO_DEG = 180 / Math.PI;
    const DEG_TO_RAD = Math.PI / 180;

    function finite(value, label = 'value') {
        const number = Number(value);
        if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite.`);
        return number;
    }
    function vector(value, label = 'vector') {
        if (!value || typeof value !== 'object') throw new TypeError(`${label} must be a three-dimensional vector.`);
        return Object.freeze({ x: finite(value.x, `${label}.x`), y: finite(value.y, `${label}.y`), z: finite(value.z, `${label}.z`) });
    }
    function quaternion(value, label = 'quaternion') {
        if (!value || typeof value !== 'object') throw new TypeError(`${label} must be a quaternion.`);
        return Object.freeze({ x: finite(value.x, `${label}.x`), y: finite(value.y, `${label}.y`), z: finite(value.z, `${label}.z`), w: finite(value.w, `${label}.w`) });
    }
    const add = (a, b) => Object.freeze({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
    const subtract = (a, b) => Object.freeze({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
    const scale = (value, amount) => Object.freeze({ x: value.x * amount, y: value.y * amount, z: value.z * amount });
    const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const cross = (a, b) => Object.freeze({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
    const length = value => Math.hypot(value.x, value.y, value.z);
    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
    function normalize(value, label = 'vector') {
        const source = vector(value, label), magnitude = length(source);
        if (!(magnitude > EPSILON)) throw new RangeError(`${label} must have non-zero length.`);
        return Object.freeze({ x: source.x / magnitude, y: source.y / magnitude, z: source.z / magnitude });
    }
    function radians(degrees) { return finite(degrees, 'degrees') * DEG_TO_RAD; }
    function degrees(radiansValue) { return finite(radiansValue, 'radians') * RAD_TO_DEG; }
    function wrapRadians(value) {
        let wrapped = ((finite(value, 'longitude') + Math.PI) % TAU + TAU) % TAU - Math.PI;
        if (Math.abs(wrapped) < EPSILON) wrapped = 0;
        return wrapped;
    }
    function wrapLongitudeDegrees(value) { return degrees(wrapRadians(radians(value))); }
    function clampLatitudeDegrees(value) { return clamp(finite(value, 'latitude'), -90, 90); }

    function orthogonalUnit(value) {
        const n = normalize(value, 'direction');
        const basis = Math.abs(n.x) <= Math.abs(n.y) && Math.abs(n.x) <= Math.abs(n.z)
            ? Object.freeze({ x: 1, y: 0, z: 0 })
            : Math.abs(n.y) <= Math.abs(n.z)
                ? Object.freeze({ x: 0, y: 1, z: 0 })
                : Object.freeze({ x: 0, y: 0, z: 1 });
        return normalize(cross(n, basis), 'orthogonal axis');
    }
    function normalizeReference(axisValue, primeValue) {
        const axis = normalize(axisValue || { x: 0, y: 1, z: 0 }, 'planet.axis');
        const candidate = vector(primeValue || { x: 1, y: 0, z: 0 }, 'planet.primeMeridian');
        const projected = subtract(candidate, scale(axis, dot(candidate, axis)));
        const primeMeridian = length(projected) > EPSILON ? normalize(projected, 'planet.primeMeridian') : orthogonalUnit(axis);
        const equatorialEast = normalize(cross(axis, primeMeridian), 'planet.equatorialEast');
        return Object.freeze({ axis, primeMeridian, equatorialEast });
    }
    function normalizePlanet(value = {}) {
        const radiusMeters = finite(value.radiusMeters ?? 30000, 'planet.radiusMeters');
        if (!(radiusMeters > 0)) throw new RangeError('planet.radiusMeters must be positive.');
        const seaLevelMeters = finite(value.seaLevelMeters ?? 0, 'planet.seaLevelMeters');
        const minimumElevationMeters = finite(value.minimumElevationMeters ?? -1200, 'planet.minimumElevationMeters');
        const maximumElevationMeters = finite(value.maximumElevationMeters ?? 1800, 'planet.maximumElevationMeters');
        if (minimumElevationMeters > maximumElevationMeters) throw new RangeError('Planet elevation bounds are inverted.');
        if (radiusMeters + seaLevelMeters + minimumElevationMeters <= 0) throw new RangeError('Planet elevation reaches or crosses its centre.');
        const center = vector(value.center || { x: 0, y: 0, z: 0 }, 'planet.center');
        const reference = normalizeReference(value.axis, value.primeMeridian);
        const axialTiltDegrees = finite(value.axialTiltDegrees ?? 23.44, 'planet.axialTiltDegrees');
        return Object.freeze({
            format: 'study-director.world.analytic-planet', version: 1, center, ...reference,
            radiusMeters, seaLevelMeters, minimumElevationMeters, maximumElevationMeters, axialTiltDegrees,
            circumferenceMeters: TAU * radiusMeters, surfaceAreaSquareMeters: 4 * Math.PI * radiusMeters * radiusMeters
        });
    }
    const DEFAULT_PLANET = normalizePlanet();
    function planetOrDefault(value) { return value ? normalizePlanet(value) : DEFAULT_PLANET; }

    function fromLatLon(latitudeDegrees, longitudeDegrees, planetValue) {
        const planet = planetOrDefault(planetValue), latitude = radians(clampLatitudeDegrees(latitudeDegrees)), longitude = wrapRadians(radians(longitudeDegrees));
        const horizontal = Math.cos(latitude);
        return normalize(add(add(scale(planet.primeMeridian, horizontal * Math.cos(longitude)), scale(planet.equatorialEast, horizontal * Math.sin(longitude))), scale(planet.axis, Math.sin(latitude))), 'spherical direction');
    }
    function toLatLon(directionValue, planetValue) {
        const planet = planetOrDefault(planetValue), direction = normalize(directionValue, 'direction'), axisAmount = clamp(dot(direction, planet.axis), -1, 1), equatorial = subtract(direction, scale(planet.axis, axisAmount)), equatorialLength = length(equatorial), latitude = Math.atan2(axisAmount, equatorialLength);
        const longitudeDefined = equatorialLength > POLE_EPSILON;
        const longitude = longitudeDefined ? wrapRadians(Math.atan2(dot(equatorial, planet.equatorialEast), dot(equatorial, planet.primeMeridian))) : 0;
        return Object.freeze({ latitudeDegrees: degrees(latitude), longitudeDegrees: degrees(longitude), longitudeDefined });
    }
    function surfacePoint(directionValue, altitudeMeters = 0, planetValue) {
        const planet = planetOrDefault(planetValue), direction = normalize(directionValue, 'direction'), radius = planet.radiusMeters + planet.seaLevelMeters + finite(altitudeMeters, 'altitudeMeters');
        if (!(radius > 0)) throw new RangeError('Surface point reaches or crosses the planet centre.');
        return add(planet.center, scale(direction, radius));
    }
    function directionFromPoint(pointValue, planetValue) {
        const planet = planetOrDefault(planetValue);
        return normalize(subtract(vector(pointValue, 'point'), planet.center), 'point relative to planet centre');
    }
    function altitudeFromPoint(pointValue, planetValue) {
        const planet = planetOrDefault(planetValue);
        return length(subtract(vector(pointValue, 'point'), planet.center)) - planet.radiusMeters - planet.seaLevelMeters;
    }
    function localFrame(directionValue, planetValue) {
        const planet = planetOrDefault(planetValue), up = normalize(directionValue, 'direction');
        const candidate = cross(planet.axis, up), east = length(candidate) > POLE_EPSILON ? normalize(candidate, 'local east') : planet.equatorialEast;
        const north = normalize(cross(up, east), 'local north');
        return Object.freeze({ east, north, up, atPole: Math.abs(dot(up, planet.axis)) >= 1 - POLE_EPSILON });
    }

    function quatNormalize(value) {
        const source = quaternion(value), magnitude = Math.hypot(source.x, source.y, source.z, source.w);
        if (!(magnitude > EPSILON)) throw new RangeError('Quaternion must have non-zero length.');
        return Object.freeze({ x: source.x / magnitude, y: source.y / magnitude, z: source.z / magnitude, w: source.w / magnitude });
    }
    function quatConjugate(value) { const q = quaternion(value); return Object.freeze({ x: -q.x, y: -q.y, z: -q.z, w: q.w }); }
    function quatMultiply(leftValue, rightValue) {
        const a = quaternion(leftValue, 'left quaternion'), b = quaternion(rightValue, 'right quaternion');
        return Object.freeze({
            x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
            y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
            z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
            w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
        });
    }
    function quatFromAxisAngle(axisValue, angleRadians) {
        const axis = normalize(axisValue, 'rotation axis'), half = finite(angleRadians, 'angleRadians') * .5, sine = Math.sin(half);
        return quatNormalize({ x: axis.x * sine, y: axis.y * sine, z: axis.z * sine, w: Math.cos(half) });
    }
    function quatBetweenVectors(fromValue, toValue) {
        const from = normalize(fromValue, 'from direction'), to = normalize(toValue, 'to direction'), cosine = clamp(dot(from, to), -1, 1);
        if (cosine > 1 - EPSILON) return Object.freeze({ x: 0, y: 0, z: 0, w: 1 });
        if (cosine < -1 + EPSILON) return quatFromAxisAngle(orthogonalUnit(from), Math.PI);
        const axis = cross(from, to);
        return quatNormalize({ x: axis.x, y: axis.y, z: axis.z, w: 1 + cosine });
    }
    function quatRotateVector(quaternionValue, vectorValue) {
        const q = quatNormalize(quaternionValue), value = vector(vectorValue), pure = { x: value.x, y: value.y, z: value.z, w: 0 }, rotated = quatMultiply(quatMultiply(q, pure), quatConjugate(q));
        return Object.freeze({ x: rotated.x, y: rotated.y, z: rotated.z });
    }

    function angularDistance(fromValue, toValue) { return Math.acos(clamp(dot(normalize(fromValue, 'from direction'), normalize(toValue, 'to direction')), -1, 1)); }
    function greatCircleDistance(fromValue, toValue, planetValue) { return angularDistance(fromValue, toValue) * planetOrDefault(planetValue).radiusMeters; }
    function interpolateGeodesic(fromValue, toValue, amount) {
        const from = normalize(fromValue, 'from direction'), to = normalize(toValue, 'to direction'), t = clamp(finite(amount, 'amount'), 0, 1), angle = angularDistance(from, to);
        if (angle < EPSILON) return from;
        const rotation = quatBetweenVectors(from, to);
        const sine = Math.sin(angle * t * .5), axisLength = Math.hypot(rotation.x, rotation.y, rotation.z);
        if (axisLength <= EPSILON) return from;
        const axis = { x: rotation.x / axisLength, y: rotation.y / axisLength, z: rotation.z / axisLength };
        return normalize(quatRotateVector({ x: axis.x * sine, y: axis.y * sine, z: axis.z * sine, w: Math.cos(angle * t * .5) }, from), 'interpolated direction');
    }
    function tangentUnit(directionValue, tangentValue) {
        const direction = normalize(directionValue, 'direction'), tangent = vector(tangentValue, 'tangent'), projected = subtract(tangent, scale(direction, dot(tangent, direction)));
        return normalize(projected, 'surface tangent');
    }
    function moveGeodesic(directionValue, tangentValue, angleRadians) {
        const direction = normalize(directionValue, 'direction'), tangent = tangentUnit(direction, tangentValue), angle = finite(angleRadians, 'angleRadians');
        return normalize(add(scale(direction, Math.cos(angle)), scale(tangent, Math.sin(angle))), 'moved direction');
    }
    function tangentForBearing(directionValue, bearingRadians, planetValue) {
        const frame = localFrame(directionValue, planetValue), bearing = finite(bearingRadians, 'bearingRadians');
        return normalize(add(scale(frame.north, Math.cos(bearing)), scale(frame.east, Math.sin(bearing))), 'bearing tangent');
    }
    function destination(directionValue, bearingRadians, distanceMeters, planetValue) {
        const planet = planetOrDefault(planetValue), direction = normalize(directionValue, 'direction'), tangent = tangentForBearing(direction, bearingRadians, planet);
        return moveGeodesic(direction, tangent, finite(distanceMeters, 'distanceMeters') / planet.radiusMeters);
    }
    function initialBearing(fromValue, toValue, planetValue) {
        const from = normalize(fromValue, 'from direction'), to = normalize(toValue, 'to direction'), projected = subtract(to, scale(from, dot(to, from)));
        if (length(projected) <= EPSILON) return 0;
        const tangent = normalize(projected, 'destination tangent'), frame = localFrame(from, planetValue);
        return wrapRadians(Math.atan2(dot(tangent, frame.east), dot(tangent, frame.north)));
    }
    function transportTangent(tangentValue, fromValue, toValue) {
        const from = normalize(fromValue, 'from direction'), to = normalize(toValue, 'to direction'), tangent = tangentUnit(from, tangentValue), rotation = quatBetweenVectors(from, to), rotated = quatRotateVector(rotation, tangent);
        return tangentUnit(to, rotated);
    }

    return Object.freeze({
        format: FORMAT, version: VERSION, epsilon: EPSILON, defaultPlanet: DEFAULT_PLANET,
        vector: Object.freeze({ add, subtract, scale, dot, cross, length, normalize, orthogonalUnit }),
        radians, degrees, wrapRadians, wrapLongitudeDegrees, clampLatitudeDegrees,
        normalizePlanet, fromLatLon, toLatLon, surfacePoint, directionFromPoint, altitudeFromPoint, localFrame,
        quaternion: Object.freeze({ normalize: quatNormalize, conjugate: quatConjugate, multiply: quatMultiply, fromAxisAngle: quatFromAxisAngle, betweenVectors: quatBetweenVectors, rotateVector: quatRotateVector }),
        angularDistance, greatCircleDistance, interpolateGeodesic, tangentUnit, moveGeodesic, tangentForBearing, destination, initialBearing, transportTangent
    });
})();
