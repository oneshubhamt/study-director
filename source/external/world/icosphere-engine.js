const SDWorldIcosphereEngine = (() => {
    'use strict';
    const FORMAT = 'study-director.world.icosphere-topology';
    const VERSION = 1;
    const MAX_LEVEL = 16;
    const MAX_ANALYSIS_LEVEL = 6;
    const MAX_STITCH_LEVEL = 12;
    const ID_PATTERN = /^i1:(\d{2})(?:\/([0-3]+))?$/;
    const EDGE_VERTICES = Object.freeze([Object.freeze([1, 2]), Object.freeze([2, 0]), Object.freeze([0, 1])]);
    const BOUNDARY_EDGE_ORDER = Object.freeze([2, 0, 1]);
    const Math3 = SDWorldSphericalMathEngine;
    const Vector = Math3.vector;
    const CELL_CACHE_LIMIT = 16384;
    const NEIGHBOUR_CACHE_LIMIT = 8192;
    const CELL_CACHE = new Map();
    const NEIGHBOUR_CACHE = new Map();

    function cacheRead(cache, key) { if (!cache.has(key)) return null; const value = cache.get(key); cache.delete(key); cache.set(key, value); return value; }
    function cacheWrite(cache, key, value, limit) { if (cache.has(key)) cache.delete(key); cache.set(key, value); while (cache.size > limit) cache.delete(cache.keys().next().value); return value; }

    const PHI = (1 + Math.sqrt(5)) / 2;
    const rawVertices = [
        [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
        [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
        [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]
    ];
    const ROOT_VERTICES = Object.freeze(rawVertices.map(([x, y, z]) => Vector.normalize({ x, y, z }, 'icosahedron vertex')));
    const rawFaces = [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];
    function orientedFace(indices) {
        const [aIndex, bIndex, cIndex] = indices, a = ROOT_VERTICES[aIndex], b = ROOT_VERTICES[bIndex], c = ROOT_VERTICES[cIndex];
        const normal = Vector.cross(Vector.subtract(b, a), Vector.subtract(c, a)), centre = Vector.add(Vector.add(a, b), c);
        return Object.freeze(Vector.dot(normal, centre) > 0 ? [aIndex, bIndex, cIndex] : [aIndex, cIndex, bIndex]);
    }
    const ROOT_FACES = Object.freeze(rawFaces.map(orientedFace));
    const ROOT_IDS = Object.freeze(ROOT_FACES.map((_face, root) => `i1:${String(root).padStart(2, '0')}`));

    function integer(value, minimum, maximum, label) {
        const number = Number(value);
        if (!Number.isInteger(number) || number < minimum || number > maximum) throw new RangeError(`${label} must be an integer from ${minimum} through ${maximum}.`);
        return number;
    }
    function parseId(value) {
        const text = String(value || ''), match = ID_PATTERN.exec(text);
        if (!match) throw new TypeError('Icosphere cell ID must use i1:RR/path with child digits 0–3.');
        const root = Number(match[1]), path = match[2] || '';
        if (root < 0 || root >= ROOT_FACES.length) throw new RangeError('Icosphere root index is outside 00–19.');
        if (path.length > MAX_LEVEL) throw new RangeError(`Icosphere cell level exceeds ${MAX_LEVEL}.`);
        const canonical = `${ROOT_IDS[root]}${path ? `/${path}` : ''}`;
        if (canonical !== text) throw new TypeError(`Icosphere cell ID is not canonical: ${text}.`);
        return Object.freeze({ id: canonical, root, path, level: path.length });
    }
    function makeId(rootValue, pathValue = '') {
        const root = integer(rootValue, 0, ROOT_FACES.length - 1, 'root'), path = String(pathValue || '');
        if (!/^[0-3]*$/.test(path) || path.length > MAX_LEVEL) throw new TypeError(`Icosphere path must contain at most ${MAX_LEVEL} child digits.`);
        return `${ROOT_IDS[root]}${path ? `/${path}` : ''}`;
    }
    function parentId(value) {
        const parsed = parseId(value);
        return parsed.level ? makeId(parsed.root, parsed.path.slice(0, -1)) : null;
    }
    function childIds(value) {
        const parsed = parseId(value);
        if (parsed.level >= MAX_LEVEL) throw new RangeError(`Icosphere cell level exceeds ${MAX_LEVEL}.`);
        return Object.freeze([0, 1, 2, 3].map(child => makeId(parsed.root, `${parsed.path}${child}`)));
    }
    function isAncestor(ancestorValue, descendantValue, includeSelf = false) {
        const ancestor = parseId(ancestorValue), descendant = parseId(descendantValue);
        return ancestor.root === descendant.root && descendant.path.startsWith(ancestor.path) && (includeSelf || descendant.level > ancestor.level);
    }
    function midpoint(a, b) { return Vector.normalize(Vector.add(a, b), 'icosphere edge midpoint'); }
    function freezeTriangle(vertices) { return Object.freeze(vertices.map(vertex => Object.freeze({ x: vertex.x, y: vertex.y, z: vertex.z }))); }
    function subdivideVertices(verticesValue) {
        const [a, b, c] = verticesValue, ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
        return Object.freeze([
            freezeTriangle([a, ab, ca]),
            freezeTriangle([ab, b, bc]),
            freezeTriangle([ca, bc, c]),
            freezeTriangle([ab, bc, ca])
        ]);
    }
    function solidAngleForVertices(vertices) {
        const [a, b, c] = vertices, determinant = Math.abs(Vector.dot(a, Vector.cross(b, c))), denominator = 1 + Vector.dot(a, b) + Vector.dot(b, c) + Vector.dot(c, a);
        return 2 * Math.atan2(determinant, denominator);
    }
    function cell(value) {
        const parsed = parseId(value), cached = cacheRead(CELL_CACHE, parsed.id); if (cached) return cached; const face = ROOT_FACES[parsed.root];
        let vertices = freezeTriangle(face.map(index => ROOT_VERTICES[index]));
        for (const digit of parsed.path) vertices = subdivideVertices(vertices)[Number(digit)];
        const centre = Vector.normalize(Vector.add(Vector.add(vertices[0], vertices[1]), vertices[2]), 'icosphere cell centre');
        const result = Object.freeze({ ...parsed, parentId: parsed.level ? parentId(parsed.id) : null, vertices, centre, solidAngleSteradians: solidAngleForVertices(vertices) }); return cacheWrite(CELL_CACHE, parsed.id, result, CELL_CACHE_LIMIT);
    }
    function edgeEndpoints(cellOrId, edgeValue) {
        const edgeIndex = integer(edgeValue, 0, 2, 'edgeIndex'), current = typeof cellOrId === 'string' ? cell(cellOrId) : cellOrId, indices = EDGE_VERTICES[edgeIndex];
        if (!current || !Array.isArray(current.vertices) || current.vertices.length !== 3) throw new TypeError('Expected an icosphere cell or cell ID.');
        return Object.freeze([current.vertices[indices[0]], current.vertices[indices[1]]]);
    }
    function directionKey(value) {
        const direction = Vector.normalize(value, 'direction'), quantize = component => Math.round((Math.abs(component) < 5e-14 ? 0 : component) * 1e12);
        return `${quantize(direction.x)},${quantize(direction.y)},${quantize(direction.z)}`;
    }
    function edgeKey(a, b) { const left = directionKey(a), right = directionKey(b); return left < right ? `${left}|${right}` : `${right}|${left}`; }

    function buildRootNeighbours() {
        const byEdge = new Map(), rows = ROOT_FACES.map(() => Array(3).fill(null));
        for (let root = 0; root < ROOT_FACES.length; root += 1) {
            const face = ROOT_FACES[root];
            for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
                const [left, right] = EDGE_VERTICES[edgeIndex], key = [face[left], face[right]].sort((a, b) => a - b).join(':');
                if (!byEdge.has(key)) byEdge.set(key, []);
                byEdge.get(key).push({ root, edgeIndex });
            }
        }
        for (const [key, incidences] of byEdge) {
            if (incidences.length !== 2) throw new Error(`Invalid root edge incidence at ${key}.`);
            const [a, b] = incidences;
            rows[a.root][a.edgeIndex] = Object.freeze({ cellId: ROOT_IDS[b.root], edgeIndex: b.edgeIndex });
            rows[b.root][b.edgeIndex] = Object.freeze({ cellId: ROOT_IDS[a.root], edgeIndex: a.edgeIndex });
        }
        return Object.freeze(rows.map(row => Object.freeze(row)));
    }
    const ROOT_NEIGHBOURS = buildRootNeighbours();
    const INTERNAL_NEIGHBOUR = Object.freeze({
        '0:0': Object.freeze({ child: 3, edgeIndex: 1 }),
        '1:1': Object.freeze({ child: 3, edgeIndex: 2 }),
        '2:2': Object.freeze({ child: 3, edgeIndex: 0 }),
        '3:0': Object.freeze({ child: 2, edgeIndex: 2 }),
        '3:1': Object.freeze({ child: 0, edgeIndex: 0 }),
        '3:2': Object.freeze({ child: 1, edgeIndex: 1 })
    });
    const PARENT_BOUNDARY_EDGE = Object.freeze({
        '0:1': 1, '0:2': 2,
        '1:0': 0, '1:2': 2,
        '2:0': 0, '2:1': 1
    });
    function squaredDistance(a, b) { const x = a.x - b.x, y = a.y - b.y, z = a.z - b.z; return x * x + y * y + z * z; }
    function sameUndirectedEndpoints(left, right) {
        return (squaredDistance(left[0], right[0]) <= 1e-20 && squaredDistance(left[1], right[1]) <= 1e-20)
            || (squaredDistance(left[0], right[1]) <= 1e-20 && squaredDistance(left[1], right[0]) <= 1e-20);
    }
    function neighbourAcross(value, edgeValue) {
        const parsed = parseId(value), edgeIndex = integer(edgeValue, 0, 2, 'edgeIndex');
        if (!parsed.level) return ROOT_NEIGHBOURS[parsed.root][edgeIndex];
        const child = Number(parsed.path.at(-1)), parentPath = parsed.path.slice(0, -1), internal = INTERNAL_NEIGHBOUR[`${child}:${edgeIndex}`];
        if (internal) return Object.freeze({ cellId: makeId(parsed.root, `${parentPath}${internal.child}`), edgeIndex: internal.edgeIndex });
        const parentEdge = PARENT_BOUNDARY_EDGE[`${child}:${edgeIndex}`];
        if (parentEdge === undefined) throw new Error(`Incomplete child-edge topology for ${parsed.id} edge ${edgeIndex}.`);
        const adjacentParent = neighbourAcross(makeId(parsed.root, parentPath), parentEdge), target = edgeEndpoints(parsed.id, edgeIndex);
        for (const candidateId of childIds(adjacentParent.cellId)) {
            const candidate = cell(candidateId);
            for (let candidateEdge = 0; candidateEdge < 3; candidateEdge += 1) {
                if (sameUndirectedEndpoints(target, edgeEndpoints(candidate, candidateEdge))) return Object.freeze({ cellId: candidateId, edgeIndex: candidateEdge });
            }
        }
        throw new Error(`Unable to resolve neighbour for ${parsed.id} edge ${edgeIndex}.`);
    }
    function neighbours(value) {
        const parsed = parseId(value), cached = cacheRead(NEIGHBOUR_CACHE, parsed.id); if (cached) return cached;
        const result = Object.freeze([0, 1, 2].map(edgeIndex => { const adjacent = neighbourAcross(parsed.id, edgeIndex); return Object.freeze({ edgeIndex, cellId: adjacent.cellId, neighbourEdgeIndex: adjacent.edgeIndex }); })); return cacheWrite(NEIGHBOUR_CACHE, parsed.id, result, NEIGHBOUR_CACHE_LIMIT);
    }
    function clearCaches() { CELL_CACHE.clear(); NEIGHBOUR_CACHE.clear(); return true; }

    function cellCount(levelValue) { const level = integer(levelValue, 0, MAX_LEVEL, 'level'); return 20 * (4 ** level); }
    function indexPath(indexValue, level) {
        let value = integer(indexValue, 0, (4 ** level) - 1, 'cell index'), path = '';
        for (let place = level - 1; place >= 0; place -= 1) { const divisor = 4 ** place, digit = Math.floor(value / divisor); path += String(digit); value -= digit * divisor; }
        return path;
    }
    function* idsAtLevel(levelValue) {
        const level = integer(levelValue, 0, MAX_LEVEL, 'level'), perRoot = 4 ** level;
        for (let root = 0; root < ROOT_FACES.length; root += 1) for (let index = 0; index < perRoot; index += 1) yield makeId(root, indexPath(index, level));
    }
    function idAtLevelIndex(indexValue, levelValue) {
        const level = integer(levelValue, 0, MAX_LEVEL, 'level'), perRoot = 4 ** level, index = integer(indexValue, 0, ROOT_FACES.length * perRoot - 1, 'cell index'), root = Math.floor(index / perRoot); return makeId(root, indexPath(index % perRoot, level));
    }
    function planetRadius(planetValue) { return Math3.normalizePlanet(planetValue || Math3.defaultPlanet).radiusMeters; }
    function area(value, planetValue) { const current = cell(value), radius = planetRadius(planetValue); return current.solidAngleSteradians * radius * radius; }
    function totalAreaAtLevel(levelValue, planetValue) {
        const level = integer(levelValue, 0, MAX_ANALYSIS_LEVEL, 'level'), radius = planetRadius(planetValue);
        let sum = 0, compensation = 0;
        for (const id of idsAtLevel(level)) { const next = solidAngleForVertices(cell(id).vertices) * radius * radius - compensation, total = sum + next; compensation = (total - sum) - next; sum = total; }
        return sum;
    }
    function analyzeLevel(levelValue, planetValue) {
        const level = integer(levelValue, 0, MAX_ANALYSIS_LEVEL, 'level'), vertices = new Set(), edges = new Map(), radius = planetRadius(planetValue);
        let totalArea = 0, compensation = 0, outwardFaces = 0;
        for (const id of idsAtLevel(level)) {
            const current = cell(id), triangle = current.vertices;
            for (const vertex of triangle) vertices.add(directionKey(vertex));
            for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) { const [a, b] = edgeEndpoints(current, edgeIndex), key = edgeKey(a, b); edges.set(key, (edges.get(key) || 0) + 1); }
            if (Vector.dot(Vector.cross(Vector.subtract(triangle[1], triangle[0]), Vector.subtract(triangle[2], triangle[0])), current.centre) > 0) outwardFaces += 1;
            const next = current.solidAngleSteradians * radius ** 2 - compensation, sum = totalArea + next; compensation = (sum - totalArea) - next; totalArea = sum;
        }
        const edgeIncidences = [...edges.values()], faces = cellCount(level), expectedVertices = 10 * (4 ** level) + 2, expectedEdges = 30 * (4 ** level), expectedArea = 4 * Math.PI * radius ** 2;
        return Object.freeze({
            level, faces, vertices: vertices.size, edges: edges.size, expectedVertices, expectedEdges,
            eulerCharacteristic: vertices.size - edges.size + faces,
            closed: edgeIncidences.every(count => count === 2), boundaryEdges: edgeIncidences.filter(count => count === 1).length,
            nonManifoldEdges: edgeIncidences.filter(count => count > 2).length, outwardFaces,
            totalAreaSquareMeters: totalArea, expectedAreaSquareMeters: expectedArea, relativeAreaError: Math.abs(totalArea - expectedArea) / expectedArea
        });
    }
    function analyzeRoots() {
        const edgeIncidence = new Map(), vertexFaces = Array(ROOT_VERTICES.length).fill(0), symmetric = [];
        for (let root = 0; root < ROOT_FACES.length; root += 1) {
            const face = ROOT_FACES[root];
            for (const vertex of face) vertexFaces[vertex] += 1;
            for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
                const [a, b] = EDGE_VERTICES[edgeIndex], key = [face[a], face[b]].sort((left, right) => left - right).join(':'); edgeIncidence.set(key, (edgeIncidence.get(key) || 0) + 1);
                const adjacent = ROOT_NEIGHBOURS[root][edgeIndex], reverse = ROOT_NEIGHBOURS[parseId(adjacent.cellId).root][adjacent.edgeIndex]; symmetric.push(reverse.cellId === ROOT_IDS[root] && reverse.edgeIndex === edgeIndex);
            }
        }
        return Object.freeze({ vertices: ROOT_VERTICES.length, edges: edgeIncidence.size, faces: ROOT_FACES.length, everyEdgeSharedTwice: [...edgeIncidence.values()].every(count => count === 2), everyVertexValenceFive: vertexFaces.every(count => count === 5), neighbourSymmetry: symmetric.every(Boolean), vertexFaceIncidence: Object.freeze([...vertexFaces]) });
    }

    function normalizeLeafIds(values) {
        if (!Array.isArray(values) || !values.length) throw new TypeError('Adaptive icosphere cover requires at least one leaf cell ID.');
        const parsed = values.map(parseId), ids = parsed.map(row => row.id), unique = new Set(ids);
        if (unique.size !== ids.length) throw new Error('Adaptive icosphere cover contains duplicate cells.');
        for (const row of parsed) { let ancestor = parentId(row.id); while (ancestor) { if (unique.has(ancestor)) throw new Error(`Adaptive cover overlaps ${ancestor} and ${row.id}.`); ancestor = parentId(ancestor); } }
        return Object.freeze([...ids].sort());
    }
    function validateCover(values) {
        const leaves = normalizeLeafIds(values), selected = new Set(leaves), branches = new Set();
        for (const id of leaves) { let current = id; while (current) { branches.add(current); current = parentId(current); } }
        function covered(id) {
            if (selected.has(id)) return true;
            if (!branches.has(id)) return false;
            return childIds(id).every(covered);
        }
        const uncoveredRoots = ROOT_IDS.filter(id => !covered(id));
        return Object.freeze({ valid: !uncoveredRoots.length, complete: !uncoveredRoots.length, leaves, maximumLevel: Math.max(...leaves.map(id => parseId(id).level)), uncoveredRoots: Object.freeze(uncoveredRoots) });
    }
    function refineCover(values, cellsToRefine) {
        const cover = validateCover(values);
        if (!cover.complete) throw new Error('Only a complete adaptive cover can be refined.');
        const next = new Set(cover.leaves), requested = Array.isArray(cellsToRefine) ? cellsToRefine.map(value => parseId(value).id) : [parseId(cellsToRefine).id];
        for (const id of requested) { if (!next.has(id)) throw new Error(`Cannot refine non-leaf cell ${id}.`); next.delete(id); for (const child of childIds(id)) next.add(child); }
        return validateCover([...next]).leaves;
    }
    function edgeChain(value, edgeValue, targetLevelValue) {
        const current = cell(value), edgeIndex = integer(edgeValue, 0, 2, 'edgeIndex'), targetLevel = integer(targetLevelValue ?? current.level, current.level, MAX_STITCH_LEVEL, 'targetLevel');
        let points = [...edgeEndpoints(current, edgeIndex)];
        for (let level = current.level; level < targetLevel; level += 1) { const refined = [points[0]]; for (let index = 0; index < points.length - 1; index += 1) refined.push(midpoint(points[index], points[index + 1]), points[index + 1]); points = refined; }
        return Object.freeze(points);
    }
    function segmentKeys(points) { const keys = []; for (let index = 0; index < points.length - 1; index += 1) keys.push(edgeKey(points[index], points[index + 1])); return Object.freeze(keys); }
    function planStitching(values) {
        const cover = validateCover(values);
        if (!cover.complete) throw new Error(`Adaptive cover is incomplete at roots: ${cover.uncoveredRoots.join(', ')}.`);
        if (cover.maximumLevel > MAX_STITCH_LEVEL) throw new RangeError(`Mixed-LOD stitching supports levels through ${MAX_STITCH_LEVEL}.`);
        const nodeCount = cover.leaves.length * 3, parents = Array.from({ length: nodeCount }, (_value, index) => index), rank = Array(nodeCount).fill(0), segmentMap = new Map();
        const find = value => { let root = value; while (parents[root] !== root) root = parents[root]; while (parents[value] !== value) { const next = parents[value]; parents[value] = root; value = next; } return root; };
        const union = (left, right) => { let a = find(left), b = find(right); if (a === b) return; if (rank[a] < rank[b]) [a, b] = [b, a]; parents[b] = a; if (rank[a] === rank[b]) rank[a] += 1; };
        for (let leafIndex = 0; leafIndex < cover.leaves.length; leafIndex += 1) for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
            const node = leafIndex * 3 + edgeIndex, points = edgeChain(cover.leaves[leafIndex], edgeIndex, cover.maximumLevel);
            for (const key of segmentKeys(points)) { if (!segmentMap.has(key)) segmentMap.set(key, []); segmentMap.get(key).push(node); }
        }
        let unmatchedSegments = 0, nonManifoldSegments = 0;
        for (const nodes of segmentMap.values()) { const unique = [...new Set(nodes)]; if (unique.length === 2) union(unique[0], unique[1]); else if (unique.length < 2) unmatchedSegments += 1; else nonManifoldSegments += 1; }
        if (unmatchedSegments || nonManifoldSegments) throw new Error(`Adaptive cover segment topology is invalid: ${unmatchedSegments} unmatched, ${nonManifoldSegments} non-manifold.`);
        const componentLevel = new Map();
        for (let node = 0; node < nodeCount; node += 1) { const root = find(node), level = parseId(cover.leaves[Math.floor(node / 3)]).level; componentLevel.set(root, Math.max(componentLevel.get(root) || 0, level)); }
        const targets = cover.leaves.map((_id, leafIndex) => Object.freeze([0, 1, 2].map(edgeIndex => componentLevel.get(find(leafIndex * 3 + edgeIndex)))));
        return Object.freeze({ format: 'study-director.world.icosphere-stitch-plan', version: 1, leaves: cover.leaves, maximumLevel: cover.maximumLevel, targetEdgeLevels: Object.freeze(targets), canonicalSegments: segmentMap.size, unmatchedSegments, nonManifoldSegments });
    }
    function planBalancedStitching(values) {
        const cover = validateCover(values); if (!cover.complete) throw new Error(`Adaptive cover is incomplete at roots: ${cover.uncoveredRoots.join(', ')}.`);
        const selected = new Set(cover.leaves), branches = new Set(); for (const leaf of cover.leaves) { let current = parentId(leaf); while (current) { branches.add(current); current = parentId(current); } }
        const targets = cover.leaves.map(id => { const level = parseId(id).level; return Object.freeze([0, 1, 2].map(edgeIndex => { const adjacent = neighbourAcross(id, edgeIndex).cellId; if (selected.has(adjacent)) return level; const parent = parentId(adjacent); if (parent && selected.has(parent)) return level; if (branches.has(adjacent)) return level + 1; throw new Error(`Adaptive cover is not one-level balanced at ${id} edge ${edgeIndex}.`); })); });
        return Object.freeze({ format: 'study-director.world.icosphere-stitch-plan', version: 1, leaves: cover.leaves, maximumLevel: cover.maximumLevel, targetEdgeLevels: Object.freeze(targets), balancedFastPath: true });
    }
    function stitchPatch(value, targetEdgeLevelsValue) {
        const current = cell(value), targetEdgeLevels = Array.isArray(targetEdgeLevelsValue) ? targetEdgeLevelsValue : [targetEdgeLevelsValue ?? current.level, targetEdgeLevelsValue ?? current.level, targetEdgeLevelsValue ?? current.level];
        if (targetEdgeLevels.length !== 3) throw new TypeError('Stitch patch requires exactly three target edge levels.');
        const normalizedTargets = Object.freeze(targetEdgeLevels.map(level => integer(level, current.level, MAX_STITCH_LEVEL, 'target edge level'))), edges = [0, 1, 2].map(edgeIndex => { const points = edgeChain(current.id, edgeIndex, normalizedTargets[edgeIndex]); return Object.freeze({ edgeIndex, targetLevel: normalizedTargets[edgeIndex], vertices: points, keys: Object.freeze(points.map(directionKey)) }); });
        const boundary = [];
        for (const edgeIndex of BOUNDARY_EDGE_ORDER) boundary.push(...edges[edgeIndex].vertices.slice(0, -1));
        const vertices = Object.freeze([current.centre, ...boundary]), triangles = Object.freeze(boundary.map((_vertex, index) => Object.freeze([0, index + 1, ((index + 1) % boundary.length) + 1])));
        return Object.freeze({ format: 'study-director.world.icosphere-stitch-patch', version: 1, cellId: current.id, level: current.level, targetEdgeLevels: normalizedTargets, vertices, triangles, edges: Object.freeze(edges), boundaryVertexCount: boundary.length });
    }
    function buildStitchedMesh(values) {
        const plan = planStitching(values), vertices = [], vertexIndex = new Map(), triangles = [], patches = [];
        const mergeVertex = direction => { const key = directionKey(direction); if (vertexIndex.has(key)) { const index = vertexIndex.get(key); if (squaredDistance(vertices[index], direction) > 1e-18) throw new Error(`Direction-key collision at ${key}.`); return index; } const index = vertices.length; vertexIndex.set(key, index); vertices.push(direction); return index; };
        for (let leafIndex = 0; leafIndex < plan.leaves.length; leafIndex += 1) {
            const patch = stitchPatch(plan.leaves[leafIndex], plan.targetEdgeLevels[leafIndex]), start = triangles.length;
            const indices = patch.vertices.map(mergeVertex);
            for (const triangle of patch.triangles) triangles.push(Object.freeze(triangle.map(local => indices[local])));
            patches.push(Object.freeze({ cellId: patch.cellId, level: patch.level, targetEdgeLevels: patch.targetEdgeLevels, triangleStart: start, triangleCount: patch.triangles.length }));
        }
        return Object.freeze({ format: 'study-director.world.icosphere-stitched-mesh', version: 1, plan, vertices: Object.freeze(vertices), triangles: Object.freeze(triangles), patches: Object.freeze(patches), rootVertexKeys: Object.freeze(ROOT_VERTICES.map(directionKey)) });
    }
    function auditStitchedMesh(mesh, planetValue) {
        if (!mesh || mesh.format !== 'study-director.world.icosphere-stitched-mesh') throw new TypeError('Expected an icosphere stitched mesh.');
        const usages = new Map(), radius = planetRadius(planetValue); let solidAngle = 0, compensation = 0, outwardTriangles = 0, degenerateTriangles = 0;
        for (const indices of mesh.triangles) {
            const triangle = indices.map(index => mesh.vertices[index]), signed = Vector.dot(triangle[0], Vector.cross(triangle[1], triangle[2]));
            if (signed > 1e-15) outwardTriangles += 1; else degenerateTriangles += 1;
            for (let edge = 0; edge < 3; edge += 1) { const a = indices[edge], b = indices[(edge + 1) % 3], key = a < b ? `${a}:${b}` : `${b}:${a}`; usages.set(key, (usages.get(key) || 0) + 1); }
            const next = solidAngleForVertices(triangle) - compensation, sum = solidAngle + next; compensation = (sum - solidAngle) - next; solidAngle = sum;
        }
        const counts = [...usages.values()], rootIndices = mesh.rootVertexKeys.map(key => mesh.vertices.findIndex(vertex => directionKey(vertex) === key)), rootVerticesMerged = new Set(rootIndices.filter(index => index >= 0)).size;
        return Object.freeze({
            vertices: mesh.vertices.length, triangles: mesh.triangles.length, edges: usages.size,
            closed: counts.every(count => count === 2), crackEdges: counts.filter(count => count === 1).length, nonManifoldEdges: counts.filter(count => count > 2).length,
            outwardTriangles, degenerateTriangles, rootVerticesMerged,
            totalAreaSquareMeters: solidAngle * radius * radius, expectedAreaSquareMeters: 4 * Math.PI * radius * radius,
            relativeAreaError: Math.abs(solidAngle - 4 * Math.PI) / (4 * Math.PI)
        });
    }

    return Object.freeze({
        format: FORMAT, version: VERSION,
        limits: Object.freeze({ maxLevel: MAX_LEVEL, maxAnalysisLevel: MAX_ANALYSIS_LEVEL, maxStitchLevel: MAX_STITCH_LEVEL, cellCache: CELL_CACHE_LIMIT, neighbourCache: NEIGHBOUR_CACHE_LIMIT }),
        rootIds: ROOT_IDS, rootVertices: ROOT_VERTICES, rootFaces: ROOT_FACES, rootNeighbours: ROOT_NEIGHBOURS,
        parseId, makeId, parentId, childIds, isAncestor, cell, subdivideVertices, edgeEndpoints, directionKey,
        neighbourAcross, neighbours, clearCaches, cellCount, idsAtLevel, idAtLevelIndex, area, totalAreaAtLevel, analyzeRoots, analyzeLevel,
        validateCover, refineCover, edgeChain, planStitching, planBalancedStitching, stitchPatch, buildStitchedMesh, auditStitchedMesh
    });
})();
