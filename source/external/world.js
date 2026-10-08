(() => {
    'use strict';
    const READY_EVENT = 'studydirector:ready';
    const PLUGIN_NAME = 'SD-world';
    const PLUGIN_VERSION = '1.0.0-standalone';
    const STYLE_ID = 'sd-world-planetary-style';
    const STORAGE_PREFIX = 'studyDirector.plugin.living-world.v1.';
    const LEGACY_STORAGE_PREFIX = 'studyDirector.plugin.living-world.v0.';
    const STORAGE_SCHEMA = 2;
    const MAX_STORAGE_BYTES = 64 * 1024;
    const SAFE_KEY = /^[a-z][a-z0-9.-]{0,63}$/;
    const WORLD_SEED_KEY = 'seed';
    const WORLD_SIMULATION_KEY = 'simulation-version';
    const WORLD_SIMULATION_REVISION = 11;
    const SPHERICAL_ENGINE_KEY = 'spherical-engine-version';
    const ICOSPHERE_ENGINE_KEY = 'icosphere-engine-version';
    const PLANET_GENERATOR_ENGINE_KEY = 'planet-generator-engine-version';
    const PLANETARY_ECOLOGY_ENGINE_KEY = 'planetary-ecology-engine-version';
    const TERRAIN_RENDERER_ENGINE_KEY = 'terrain-renderer-engine-version';
    const CAMERA_ENGINE_KEY = 'spherical-camera-engine-version';
    const NATURAL_WORLD_ENGINE_KEY = 'natural-world-engine-version';
    const PLANET_ATMOSPHERE_ENGINE_KEY = 'planetary-atmosphere-engine-version';
    const PLANET_WILDLIFE_ENGINE_KEY = 'planetary-wildlife-engine-version';
    const PLANET_HISTORY_ENGINE_KEY = 'planet-history-engine-version';
    const CAMERA_KEY = 'spherical-camera';
    const FOCUS_KEY = 'spherical-focus-place';
    const VIEW_KEY = 'exploration-view';
    const DISCOVERY_LOG_KEY = 'planetary-discovery-log';
    const MAX_DISCOVERY_LOG = 128;
    function currentSimulationVersion() { return `r${WORLD_SIMULATION_REVISION}:s${SDWorldSphericalMathEngine.version}:i${SDWorldIcosphereEngine.version}:p${SDWorldPlanetGeneratorEngine.engineVersion}:pe${SDWorldPlanetaryEcologyEngine.engineVersion}:pa${SDWorldPlanetAtmosphereEngine.engineVersion}:pw${SDWorldPlanetWildlifeEngine.engineVersion}:ph${SDWorldPlanetHistoryEngine.engineVersion}:b${SDWorldBehaviourEngine.version}`; }
    const DIMENSIONS = Object.freeze(['volume', 'depth', 'consistency', 'completion', 'revision', 'diversity', 'temporalRhythm', 'concentration', 'recency', 'recovery', 'persistence']);
    // Private neutral input: never obtains records or revisions from Study Director.
    const StandaloneSource = Object.freeze({
        getCurrentDate() { const date = new Date(), pad = value => String(value).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; },
        revision: 'standalone-neutral-v1', records: Object.freeze([])
    });
    let API = null, activePane = null, mounted = false, renderRevision = 0, behaviourCache = null, planetCache = null, planetaryEcologyCache = null,
        planetaryAtmosphereCache = null, worldIdentity = null, rendererRuntime = null, atmosphereTimer = 0, explorationController = null, historyController = null, chronologyCache = null, displayedSnapshot = null, worldVisibilityHandler = null, worldOrientationHandler = null, worldRevisionTimer = 0, cameraPersistenceTimer = 0, pendingCameraState = null, planetGenerationController = null, planetEcologyController = null, planetSystemsController = null;

    function storageKey(key) { const clean = String(key || '').trim().toLowerCase(); if (!SAFE_KEY.test(clean))
        throw new Error('Invalid Living World storage key.'); return STORAGE_PREFIX + clean; }
    function structurallyValidStorageValue(key, value) {
        if (value === null || value === undefined) return true;
        if (key === WORLD_SEED_KEY) return typeof value === 'string' && /^[0-9a-f]{32}$/i.test(value.trim());
        if (key === WORLD_SIMULATION_KEY) return typeof value === 'string' && value.length > 0 && value.length <= 200;
        if (key === SPHERICAL_ENGINE_KEY) return Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < 1000;
        if (key === ICOSPHERE_ENGINE_KEY) return Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < 1000;
        if (key === PLANET_GENERATOR_ENGINE_KEY) return Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < 1000;
        if (key === PLANETARY_ECOLOGY_ENGINE_KEY) return Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < 1000;
        if (key === TERRAIN_RENDERER_ENGINE_KEY) return Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < 1000;
        if (key === CAMERA_ENGINE_KEY) return Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < 1000;
        if (key === NATURAL_WORLD_ENGINE_KEY) return Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < 1000;
        if (key === PLANET_ATMOSPHERE_ENGINE_KEY) return Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < 1000;
        if (key === PLANET_WILDLIFE_ENGINE_KEY) return Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < 1000;
        if (key === PLANET_HISTORY_ENGINE_KEY) return Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < 1000;
        if (key === VIEW_KEY) return ['overview', 'ecology', 'discoveries'].includes(value);
        if (key === CAMERA_KEY) {
            return Boolean(SDWorldPlanetCameraEngine.deserialize(value, SDWorldSphericalMathEngine.defaultPlanet));
        }
        if (key === FOCUS_KEY) {
            if (!value || value.format !== 'study-director.world.spherical-focus-place' || Number(value.version) !== 1 || !value.direction || typeof value.direction !== 'object') return false;
            return ['x','y','z'].every(axis => typeof value.direction[axis] === 'number' && Number.isFinite(value.direction[axis])) && String(value.cellId || '').length <= 160 && String(value.label || '').length <= 240;
        }
        if (key === DISCOVERY_LOG_KEY) return Boolean(value && typeof value === 'object' && value.version === 2 && Array.isArray(value.rows) && value.rows.length <= MAX_DISCOVERY_LOG * 2);
        return true;
    }
    function readStorage(key, fallback = null) { try {
        const fullKey = storageKey(key), raw = localStorage.getItem(fullKey);
        if (raw === null) return fallback;
        let value;
        try { value = JSON.parse(raw); }
        catch (_parseError) { try { localStorage.removeItem(fullKey); } catch (_removeError) {} return fallback; }
        if (!structurallyValidStorageValue(key, value)) { try { localStorage.removeItem(fullKey); } catch (_removeError) {} return fallback; }
        return value;
    }
    catch (_error) {
        return fallback;
    } }
    function readLegacySeed() { try {
        const raw = localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${WORLD_SEED_KEY}`);
        if (raw === null) return null;
        const value = JSON.parse(raw);
        return typeof value === 'string' && /^[0-9a-f]{32}$/i.test(value.trim()) ? value.trim() : null;
    }
    catch (_error) { return null; } }
    function writeStorage(key, value) { const serialized = JSON.stringify(value); if (typeof serialized !== 'string')
        throw new Error('Living World storage value is not serializable.'); const bytes = typeof TextEncoder === 'function' ? new TextEncoder().encode(serialized).byteLength : serialized.length * 2; if (bytes > MAX_STORAGE_BYTES)
        throw new Error('Living World storage value exceeds its namespace limit.'); try {
        localStorage.setItem(storageKey(key), serialized);
        return true;
    }
    catch (_error) {
        return false;
    } }
    function removeStorage(key) { try {
        localStorage.removeItem(storageKey(key));
        return true;
    }
    catch (_error) {
        return false;
    } }
    function clearStorage() { try {
        const keys = [];
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key && key.startsWith(STORAGE_PREFIX))
                keys.push(key);
        }
        keys.forEach(key => localStorage.removeItem(key));
        worldIdentity = null;
        planetCache = null;
        planetaryEcologyCache = null;
        planetaryAtmosphereCache = null;
        planetGenerationController?.abort?.(); planetGenerationController = null;
        planetEcologyController?.abort?.(); planetEcologyController = null;
        chronologyCache?.planetaryHistory?.clear?.();
        chronologyCache = null;
        displayedSnapshot = null;
        return keys.length;
    }
    catch (_error) {
        return 0;
    } }
    const Persistence = Object.freeze({
        namespace: STORAGE_PREFIX, schema: STORAGE_SCHEMA, get: readStorage, set: writeStorage, remove: removeStorage, clear: clearStorage
    });
    function installStyle() {
        if (document.getElementById(STYLE_ID))
            return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
#pane-world{min-width:0}
#pane-world .world-pass8{display:grid;gap:18px;min-width:0;padding:clamp(14px,2.5vw,30px)}
#pane-world .world-pass8-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;min-width:0}
#pane-world .world-pass8-heading{display:grid;gap:6px;min-width:0;max-width:850px}
#pane-world .world-pass8-kicker{font-family:var(--sd-type-label-family);font-size:var(--sd-type-label-size);font-weight:var(--sd-type-label-weight);letter-spacing:var(--sd-type-label-tracking);text-transform:var(--sd-type-label-transform);color:var(--sd-color-text-secondary-strong)}
#pane-world .world-pass8-title{margin:0;font-family:var(--sd-type-title-family);font-size:var(--sd-type-title-size);font-weight:var(--sd-type-title-weight);letter-spacing:var(--sd-type-title-tracking);text-transform:var(--sd-type-title-transform);color:var(--sd-color-text-primary)}
#pane-world .world-pass8-copy{margin:0;max-width:850px;font-family:var(--sd-type-body-family);font-size:var(--sd-type-body-size);line-height:var(--sd-type-body-leading);color:var(--sd-color-text-secondary)}
#pane-world .world-pass8-stage{position:relative;min-width:0;aspect-ratio:16/9;min-height:320px;max-height:720px;overflow:hidden;border:1px solid var(--sd-color-border-1);border-radius:var(--sd-shape-card-radius);background:linear-gradient(180deg,#071719 0%,#101a13 100%);isolation:isolate}
#pane-world .world-pass8-canvas{display:block;width:100%;height:100%;touch-action:none;background:#091716}
#pane-world .world-pass8-overlay{position:absolute;inset:0;pointer-events:none;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:12px}
#pane-world .world-pass8-badge{max-width:min(72%,560px);padding:8px 10px;border:1px solid color-mix(in srgb,var(--sd-color-border-1) 74%,transparent);border-radius:999px;background:var(--sd-material-panel);background:color-mix(in srgb,var(--sd-material-panel) 78%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-family:var(--sd-type-mono-family);font-size:11px;line-height:1.25;color:var(--sd-color-text-secondary);overflow-wrap:anywhere}
#pane-world .world-pass8-stage[data-render-state="loading"] .world-pass8-canvas{opacity:.45}
#pane-world .world-pass8-stage[data-render-state="failed"] .world-pass8-canvas{opacity:.26}
#pane-world .world-unavailable{position:absolute;inset:25% 10%;display:grid;place-content:center;margin:0;padding:20px;border-radius:var(--sd-shape-card-radius);background:var(--sd-material-panel);color:var(--sd-color-text-primary);font-family:var(--sd-type-body-family);font-size:var(--sd-type-body-size);line-height:var(--sd-type-body-leading);text-align:center}
#pane-world .world-pass8-status{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
#pane-world .world-pass8-card{min-width:0;padding:13px 14px;border:1px solid var(--sd-color-border-1);border-radius:var(--sd-shape-card-radius);background:var(--sd-material-panel)}
#pane-world .world-pass8-card strong{display:block;margin-bottom:5px;font-family:var(--sd-type-label-family);font-size:var(--sd-type-label-size);font-weight:var(--sd-type-label-weight);letter-spacing:var(--sd-type-label-tracking);text-transform:var(--sd-type-label-transform);color:var(--sd-color-text-primary)}
#pane-world .world-pass8-card span{display:block;overflow-wrap:anywhere;font-family:var(--sd-type-mono-family);font-size:var(--sd-type-mono-size);line-height:var(--sd-type-mono-leading);color:var(--sd-color-text-secondary)}
#pane-world .world-pass8-vector{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
#pane-world .world-pass8-metric{min-width:0;padding:10px 12px;border:1px solid var(--sd-color-border-1);border-radius:var(--sd-shape-card-radius);background:var(--sd-material-panel)}
#pane-world .world-pass8-metric b{display:block;font-family:var(--sd-type-label-family);font-size:var(--sd-type-label-size);font-weight:var(--sd-type-label-weight);letter-spacing:var(--sd-type-label-tracking);text-transform:var(--sd-type-label-transform);color:var(--sd-color-text-secondary-strong)}
#pane-world .world-pass8-metric output{display:block;margin-top:4px;font-family:var(--sd-type-mono-family);font-size:var(--sd-type-mono-size);line-height:var(--sd-type-mono-leading);color:var(--sd-color-text-primary)}
@media(max-width:980px){#pane-world .world-pass8-status{grid-template-columns:repeat(2,minmax(0,1fr))}#pane-world .world-pass8-vector{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){#pane-world .world-pass8{padding:12px;gap:14px}#pane-world .world-pass8-head{align-items:flex-start;flex-direction:column}#pane-world .world-pass8-stage{aspect-ratio:4/3;min-height:280px}#pane-world .world-pass8-status,#pane-world .world-pass8-vector{grid-template-columns:1fr}#pane-world .world-pass8-overlay{padding:8px}#pane-world .world-pass8-badge{max-width:78%;font-size:10px}}
@media(prefers-reduced-motion:reduce){#pane-world .world-pass8-canvas{scroll-behavior:auto}}

#pane-world .world-pass9-nav{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#pane-world .world-pass9-nav button,#pane-world .world-pass9-tools button,#pane-world .world-pass9-inspector button,#pane-world .world-pass9-discovery button{min-height:38px;padding:7px 11px;border:1px solid var(--sd-color-border-1);border-radius:999px;background:var(--sd-material-panel);color:var(--sd-color-text-primary);font:600 12px/1 var(--sd-type-label-family);cursor:pointer}
#pane-world .world-pass9-nav button[aria-pressed="true"]{border-color:var(--sd-color-text-secondary);background:color-mix(in srgb,var(--sd-material-panel) 70%,var(--sd-color-text-primary) 10%)}
#pane-world .world-pass9-tools{position:absolute;left:12px;bottom:12px;z-index:4;display:flex;flex-wrap:wrap;gap:6px;max-width:72%}
#pane-world .world-pass9-tools button{min-height:34px;background:color-mix(in srgb,var(--sd-material-panel) 82%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
#pane-world .world-pass9-zoom{position:absolute;right:12px;bottom:12px;z-index:4;padding:7px 10px;border:1px solid color-mix(in srgb,var(--sd-color-border-1) 74%,transparent);border-radius:999px;background:color-mix(in srgb,var(--sd-material-panel) 82%,transparent);font:600 11px/1 var(--sd-type-mono-family);color:var(--sd-color-text-secondary)}
#pane-world .world-pass9-inspector{position:absolute;right:12px;top:54px;z-index:5;width:min(330px,calc(100% - 24px));max-height:calc(100% - 110px);overflow:auto;padding:13px;border:1px solid var(--sd-color-border-1);border-radius:var(--sd-shape-card-radius);background:color-mix(in srgb,var(--sd-material-panel) 92%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 12px 38px rgba(0,0,0,.24)}
#pane-world .world-pass9-inspector[hidden]{display:none}
#pane-world .world-pass9-inspector h2{margin:0 0 4px;font:700 17px/1.2 var(--sd-type-title-family);color:var(--sd-color-text-primary)}
#pane-world .world-pass9-inspector-type{font:600 10px/1.3 var(--sd-type-label-family);letter-spacing:.08em;text-transform:uppercase;color:var(--sd-color-text-secondary-strong)}
#pane-world .world-pass9-inspector p{margin:9px 0;color:var(--sd-color-text-secondary);font:400 13px/1.45 var(--sd-type-body-family)}
#pane-world .world-pass9-inspector ul{margin:8px 0 12px;padding-left:18px;color:var(--sd-color-text-secondary);font:400 12px/1.45 var(--sd-type-body-family)}
#pane-world .world-pass9-view[hidden]{display:none}
#pane-world .world-pass9-ecology-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
#pane-world .world-pass9-eco-card,#pane-world .world-pass9-discovery{padding:12px 14px;border:1px solid var(--sd-color-border-1);border-radius:var(--sd-shape-card-radius);background:var(--sd-material-panel)}
#pane-world .world-pass9-eco-card strong,#pane-world .world-pass9-discovery strong{display:block;color:var(--sd-color-text-primary);font:600 12px/1.3 var(--sd-type-label-family)}
#pane-world .world-pass9-eco-card span,#pane-world .world-pass9-discovery span{display:block;margin-top:4px;color:var(--sd-color-text-secondary);font:400 12px/1.45 var(--sd-type-body-family)}
#pane-world .world-pass9-discovery-list{display:grid;gap:10px}
#pane-world .world-pass9-empty{padding:18px;border:1px dashed var(--sd-color-border-1);border-radius:var(--sd-shape-card-radius);color:var(--sd-color-text-secondary-strong)}
#pane-world .world-pass10-history{display:grid;gap:12px;padding:14px;border:1px solid var(--sd-color-border-1);border-radius:var(--sd-shape-card-radius);background:var(--sd-material-panel)}
#pane-world .world-pass10-history-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
#pane-world .world-pass10-history-date{font-family:var(--sd-type-title-family);font-weight:700;color:var(--sd-color-text-primary)}
#pane-world .world-pass10-history-meta{font-family:var(--sd-type-mono-family);font-size:11px;color:var(--sd-color-text-secondary-strong)}
#pane-world .world-pass10-history input[type=range]{width:100%;min-height:32px;accent-color:currentColor}
#pane-world .world-pass10-history-actions{display:flex;flex-wrap:wrap;gap:8px}
#pane-world .world-pass10-history-actions button{min-height:38px;padding:7px 11px;border:1px solid var(--sd-color-border-1);border-radius:999px;background:var(--sd-material-panel);color:var(--sd-color-text-primary);font:600 12px/1 var(--sd-type-label-family);cursor:pointer}
#pane-world .world-pass10-history-status{font-family:var(--sd-type-mono-family);font-size:11px;line-height:1.4;color:var(--sd-color-text-secondary)}
#pane-world .world-pass10-history-compare{padding:10px 12px;border:1px solid var(--sd-color-border-1);border-radius:12px;background:color-mix(in srgb,var(--sd-material-panel) 88%,transparent);font:400 12px/1.45 var(--sd-type-body-family);color:var(--sd-color-text-secondary)}
#pane-world .world-pass10-history-compare strong{color:var(--sd-color-text-primary)}
#pane-world .world-pass10-provenance{margin-top:10px;padding-top:10px;border-top:1px solid var(--sd-color-border-1);font-family:var(--sd-type-mono-family);font-size:11px;line-height:1.45;color:var(--sd-color-text-secondary)}
@media(max-width:760px){#pane-world .world-pass9-ecology-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#pane-world .world-pass9-tools{left:8px;bottom:8px;max-width:68%}#pane-world .world-pass9-zoom{right:8px;bottom:8px}#pane-world .world-pass9-inspector{right:8px;top:48px;width:calc(100% - 16px);max-height:calc(100% - 100px)}}

`;
        document.head.appendChild(style);
    }
    function createShell(pane) {
        const root = document.createElement('section');
        root.className = 'world-pass8';
        root.dataset.worldPass = '15.9';
        const head = document.createElement('header');
        head.className = 'world-pass8-head';
        const heading = document.createElement('div');
        heading.className = 'world-pass8-heading';
        const kicker = document.createElement('div');
        kicker.className = 'world-pass8-kicker';
        kicker.textContent = 'Living World · Standalone';
        const title = document.createElement('h1');
        title.className = 'world-pass8-title';
        title.textContent = 'Living World';
        const copy = document.createElement('p');
        copy.className = 'world-pass8-copy';
        copy.textContent = 'Explore a planet of its own. Drag to travel, scroll to zoom, or use the arrow keys. Your plans, sessions and study records are separate from this world.';
        heading.append(kicker, title, copy);
        const nav = document.createElement('div');
        nav.className = 'world-pass9-nav';
        nav.setAttribute('aria-label', 'Living World views');
        for (const [id, label] of [['overview', 'Overview'], ['ecology', 'Ecology'], ['discoveries', 'Discoveries']]) {
            const button = document.createElement('button');
            button.type = 'button'; button.dataset.worldView = id; button.textContent = label; button.setAttribute('aria-pressed', id === 'overview' ? 'true' : 'false');
            button.addEventListener('click', () => setWorldView(root, id));
            nav.appendChild(button);
        }
        head.append(heading, nav);
        const stage = document.createElement('div');
        stage.className = 'world-pass8-stage'; stage.dataset.renderState = 'loading';
        const canvas = document.createElement('canvas');
        canvas.className = 'world-pass8-canvas'; canvas.dataset.worldRendererSurface = 'true'; canvas.tabIndex = 0;
        canvas.setAttribute('role', 'application');
        canvas.setAttribute('aria-label', 'Interactive spherical Living World with detailed terrain, water, atmosphere, weather, wildlife and natural entities. Drag to travel, wheel or pinch to zoom, Shift-drag to tilt, and tap to inspect.');
        const overlay = document.createElement('div'); overlay.className = 'world-pass8-overlay';
        const rendererBadge = document.createElement('div'); rendererBadge.className = 'world-pass8-badge'; rendererBadge.dataset.worldRenderBadge = 'renderer'; rendererBadge.textContent = 'Preparing renderer';
        const projectionBadge = document.createElement('div'); projectionBadge.className = 'world-pass8-badge'; projectionBadge.dataset.worldRenderBadge = 'projection'; projectionBadge.textContent = 'Preparing projection';
        overlay.append(rendererBadge, projectionBadge);
        const tools = document.createElement('div'); tools.className = 'world-pass9-tools';
        for (const [action, label] of [['reset', 'Planet overview'], ['focus', 'Focus place']]) { const button = document.createElement('button'); button.type = 'button'; button.dataset.worldAction = action; button.textContent = label; tools.appendChild(button); }
        const zoom = document.createElement('div'); zoom.className = 'world-pass9-zoom'; zoom.dataset.worldZoom = 'true'; zoom.textContent = 'World';
        const inspector = document.createElement('aside'); inspector.className = 'world-pass9-inspector'; inspector.dataset.worldInspector = 'true'; inspector.hidden = true; inspector.setAttribute('aria-live', 'polite');
        stage.append(canvas, overlay, tools, zoom, inspector);
        const overview = document.createElement('section'); overview.className = 'world-pass9-view'; overview.dataset.worldViewPanel = 'overview';
        const status = document.createElement('div'); status.className = 'world-pass8-status';
        for (const [key, label] of [['renderer', 'Planet view'], ['planet', 'Planet'], ['atmosphere', 'Weather'], ['wildlife', 'Wildlife'], ['discoveries', 'Discoveries'], ['ecology', 'Ecology'], ['habitat', 'Habitats'], ['history', 'World source']]) {
            const card = document.createElement('div'); card.className = 'world-pass8-card'; card.dataset.worldStatus = key;
            const strong = document.createElement('strong'); strong.textContent = label; const value = document.createElement('span'); value.textContent = 'Preparing'; card.append(strong, value); status.appendChild(card);
        }
        const vector = document.createElement('div'); vector.className = 'world-pass8-vector'; vector.setAttribute('aria-label', 'Current 28-day behavioural vector');
        for (const key of DIMENSIONS) { const item = document.createElement('div'); item.className = 'world-pass8-metric'; item.dataset.worldMetric = key; const label = document.createElement('b'); label.textContent = key.replace(/([A-Z])/g, ' $1'); const output = document.createElement('output'); output.textContent = '—'; item.append(label, output); vector.appendChild(item); }
        overview.append(status);
        const historyView = document.createElement('section'); historyView.className = 'world-pass9-view'; historyView.dataset.worldViewPanel = 'history'; historyView.hidden = true;
        const historyBox = document.createElement('div'); historyBox.className = 'world-pass10-history';
        const historyHead = document.createElement('div'); historyHead.className = 'world-pass10-history-head';
        const historyDate = document.createElement('div'); historyDate.className = 'world-pass10-history-date'; historyDate.dataset.worldHistoryDate = 'true'; historyDate.textContent = 'Preparing timeline';
        const historyMeta = document.createElement('div'); historyMeta.className = 'world-pass10-history-meta'; historyMeta.dataset.worldHistoryMeta = 'true';
        historyHead.append(historyDate, historyMeta);
        const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '0'; slider.value = '0'; slider.step = '1'; slider.dataset.worldHistorySlider = 'true'; slider.setAttribute('aria-label', 'Living World historical date');
        const historyActions = document.createElement('div'); historyActions.className = 'world-pass10-history-actions';
        for (const [action, label] of [['year-back', '− Year'], ['month-back', '− Month'], ['back', '− Day'], ['forward', '+ Day'], ['month-forward', '+ Month'], ['year-forward', '+ Year'], ['play', 'Replay → now'], ['play-month', 'Replay month'], ['play-year', 'Replay year'], ['compare-before', 'Mark before'], ['compare-now', 'Compare here'], ['now', 'Return to now']]) { const button = document.createElement('button'); button.type = 'button'; button.dataset.worldHistoryAction = action; button.textContent = label; historyActions.appendChild(button); }
        const historyCompare = document.createElement('div'); historyCompare.className = 'world-pass10-history-compare'; historyCompare.dataset.worldHistoryCompare = 'true'; historyCompare.textContent = 'Before/after comparison: mark any historical date, move elsewhere on the timeline, then compare.';
        const historyStatus = document.createElement('div'); historyStatus.className = 'world-pass10-history-status'; historyStatus.dataset.worldHistoryStatus = 'true'; historyStatus.textContent = 'Historical worlds are reconstructed from this module’s private neutral source; checkpoints are rebuildable caches only.';
        historyBox.append(historyHead, slider, historyActions, historyCompare, historyStatus); historyView.appendChild(historyBox);
        const ecologyView = document.createElement('section'); ecologyView.className = 'world-pass9-view'; ecologyView.dataset.worldViewPanel = 'ecology'; ecologyView.hidden = true;
        const discoveriesView = document.createElement('section'); discoveriesView.className = 'world-pass9-view'; discoveriesView.dataset.worldViewPanel = 'discoveries'; discoveriesView.hidden = true;
        root.append(head, stage, overview, ecologyView, discoveriesView);
        pane.replaceChildren(root);
        return root;
    }
    function ensureMounted(pane) { if (!pane)
        return null; if (!mounted || activePane !== pane || !pane.querySelector('.world-pass8')) {
        activePane = pane;
        mounted = true;
        pane.dataset.worldMounted = 'true';
        createShell(pane);
    } return pane.querySelector('.world-pass8'); }
    function clearAtmosphereTimer() { if (atmosphereTimer) {
        clearTimeout(atmosphereTimer);
        atmosphereTimer = 0;
    } }
    function scheduleCameraPersistence(value) { pendingCameraState = value; if (cameraPersistenceTimer) clearTimeout(cameraPersistenceTimer); cameraPersistenceTimer = setTimeout(flushCameraPersistence, 180); }
    function flushCameraPersistence(value = pendingCameraState) { if (cameraPersistenceTimer) clearTimeout(cameraPersistenceTimer); cameraPersistenceTimer = 0; if (value) Persistence.set(CAMERA_KEY, value); pendingCameraState = null; }
    function destroyRenderer() { clearAtmosphereTimer(); if (explorationController) { try { explorationController.destroy(); } catch (_error) {} explorationController = null; } if (rendererRuntime) {
        flushCameraPersistence(rendererRuntime.getCamera?.());
        try {
            rendererRuntime.destroy();
        }
        catch (_error) { }
        rendererRuntime = null;
    } }
    function invalidateChronologyCache() { try { chronologyCache?.planetaryHistory?.destroy?.(); } catch (_error) {} chronologyCache = null; }
    function destroyHistory() { if (historyController) { try { historyController.destroy(); } catch (_error) {} historyController = null; } invalidateChronologyCache(); displayedSnapshot = null; }
    function clearWorldRevisionWatch() { if (worldRevisionTimer) { clearTimeout(worldRevisionTimer); worldRevisionTimer = 0; } }
    function scheduleWorldRevisionWatch() {
        clearWorldRevisionWatch();
        if (!mounted || !activePane || document.visibilityState === 'hidden') return;
        worldRevisionTimer = setTimeout(async () => {
            worldRevisionTimer = 0;
            try { await refreshStandaloneWorldIfNeeded(); } catch (_error) {}
            if (mounted && activePane && document.visibilityState !== 'hidden') scheduleWorldRevisionWatch();
        }, 5000);
    }
    async function refreshStandaloneWorldIfNeeded() {
        if (!mounted || !activePane || !API) return false;
        try {
            const currentStudyDate = StandaloneSource.getCurrentDate(), datasetRevision = StandaloneSource.revision;
            const changed = !behaviourCache || currentStudyDate !== behaviourCache.currentStudyDate || (datasetRevision !== null && String(datasetRevision) !== String(behaviourCache.datasetRevision));
            if (!changed) return false;
            const preferredDate = displayedSnapshot?.historical ? displayedSnapshot.date : currentStudyDate;
            invalidateChronologyCache();
            if (historyController?.refreshSource) {
                await getHistorySource(true);
                return Boolean(await historyController.refreshSource(preferredDate));
            }
            displayedSnapshot = null;
            await render({ pane: activePane });
            return true;
        } catch (_error) { return false; }
    }
    function removeWorldLifecycleWatchers() {
        clearWorldRevisionWatch();
        if (worldVisibilityHandler) {
            document.removeEventListener?.('visibilitychange', worldVisibilityHandler, false);
            globalThis.removeEventListener?.('pageshow', worldVisibilityHandler, false);
            worldVisibilityHandler = null;
        }
        if (worldOrientationHandler) {
            globalThis.removeEventListener?.('orientationchange', worldOrientationHandler, false);
            globalThis.screen?.orientation?.removeEventListener?.('change', worldOrientationHandler, false);
            worldOrientationHandler = null;
        }
    }
    function rollbackMount(pane) {
        renderRevision += 1;
        planetGenerationController?.abort?.(); planetGenerationController = null;
        planetEcologyController?.abort?.(); planetEcologyController = null;
        removeWorldLifecycleWatchers();
        destroyHistory(); destroyRenderer();
        if (pane) {
            try { pane.replaceChildren(); } catch (_error) {}
            try { delete pane.dataset.worldMounted; } catch (_error) {}
        }
        activePane = null; mounted = false;
    }
    function mount(context = {}) {
        const pane = context.pane;
        try {
            ensureMounted(pane);
            if (!worldVisibilityHandler) {
                worldVisibilityHandler = () => {
                    if (document.visibilityState === 'hidden') { clearAtmosphereTimer(); clearWorldRevisionWatch(); flushCameraPersistence(rendererRuntime?.getCamera?.()); rendererRuntime?.suspend?.(); return; }
                    rendererRuntime?.resume?.();
                    if (displayedSnapshot) startLiveRefresh(activePane.querySelector('.world-pass8'), displayedSnapshot);
                    refreshStandaloneWorldIfNeeded().catch(() => {});
                    scheduleWorldRevisionWatch();
                };
                document.addEventListener?.('visibilitychange', worldVisibilityHandler, false);
                globalThis.addEventListener?.('pageshow', worldVisibilityHandler, false);
            }
            if (!worldOrientationHandler) {
                worldOrientationHandler = () => { flushCameraPersistence(rendererRuntime?.getCamera?.()); rendererRuntime?.refreshViewport?.(); };
                globalThis.addEventListener?.('orientationchange', worldOrientationHandler, false);
                globalThis.screen?.orientation?.addEventListener?.('change', worldOrientationHandler, false);
            }
            scheduleWorldRevisionWatch();
            return true;
        } catch (_error) { rollbackMount(pane); return false; }
    }

    function unmount(context = {}) { renderRevision += 1; planetGenerationController?.abort?.(); planetGenerationController = null; planetEcologyController?.abort?.(); planetEcologyController = null; removeWorldLifecycleWatchers(); destroyHistory(); destroyRenderer(); planetaryAtmosphereCache = null; const pane = context.pane || activePane; if (pane) {
        pane.replaceChildren();
        delete pane.dataset.worldMounted;
    } planetSystemsController?.abort?.(); planetSystemsController = null; planetCache = null; planetaryEcologyCache = null; activePane = null; mounted = false; }
    function metricText(value) { if (value === null || value === undefined)
        return '—'; if (typeof value === 'object' && value.regularity !== undefined)
        return `${Math.round(value.regularity * 100)}% · ${String(Math.floor(value.phaseMinute / 60)).padStart(2, '0')}:${String(value.phaseMinute % 60).padStart(2, '0')}`; return `${Math.round(Number(value) * 100)}%`; }
    function paintVector(root, state) { for (const key of DIMENSIONS) {
        const output = root.querySelector(`[data-world-metric="${key}"] output`);
        if (output)
            output.textContent = metricText(state && state[key]);
    } }
    function setWorldView(root, view) {
        const id = ['overview', 'ecology', 'discoveries'].includes(view) ? view : 'overview';
        for (const button of root.querySelectorAll('[data-world-view]')) button.setAttribute('aria-pressed', button.dataset.worldView === id ? 'true' : 'false');
        for (const panel of root.querySelectorAll('[data-world-view-panel]')) panel.hidden = panel.dataset.worldViewPanel !== id;
        Persistence.set(VIEW_KEY, id);
    }
    function readDiscoveryLog() {
        const stored = Persistence.get(DISCOVERY_LOG_KEY, null);
        if (!stored || !Array.isArray(stored.rows)) return Object.freeze([]);
        const rows = stored.rows.filter(row => row && typeof row === 'object' && typeof row.id === 'string' && row.id.length <= 200 && typeof row.occurredAt === 'string' && row.occurredAt.length <= 40 && typeof row.entityId === 'string' && row.entityId.length <= 200).slice(0, MAX_DISCOVERY_LOG);
        if (rows.length !== stored.rows.length) Persistence.set(DISCOVERY_LOG_KEY, { version: 2, rows });
        return Object.freeze(rows);
    }
    function recordDiscoveries(wildlife, timeline = displayedSnapshot?.timeline) {
        if (wildlife?.format !== SDWorldPlanetWildlifeEngine.format || !wildlife?.discoveries?.length) return readDiscoveryLog();
        const existing = readDiscoveryLog(), byId = new Map(existing.map(row => [row.id, row])), timelineFingerprint = String(timeline?.source?.fingerprint || '');
        const occurredAt = `${displayedSnapshot?.date || timeline?.source?.currentStudyDate || new Date().toISOString().slice(0,10)}T12:00:00`;
        for (const item of wildlife.discoveries) { const direction = Object.freeze({ x: Number(item.direction.x), y: Number(item.direction.y), z: Number(item.direction.z) }), occurrenceId = `${item.id}@${occurredAt.slice(0, 10)}`; byId.set(occurrenceId, Object.freeze({ id: occurrenceId, entityId: item.id, title: item.label, type: item.type, occurredAt, timelineFingerprint, conditions: Object.freeze([item.category, item.speciesId, `cell ${item.cellId}`].filter(Boolean)), direction, point: direction, altitudeMeters: Number(item.altitudeMeters) || 0, stableAnchor: item.stableAnchor })); }
        const rows = [...byId.values()].sort((a, b) => String(b.occurredAt || '').localeCompare(String(a.occurredAt || '')) || a.id.localeCompare(b.id)).slice(0, MAX_DISCOVERY_LOG);
        Persistence.set(DISCOVERY_LOG_KEY, { version: 2, rows }); return Object.freeze(rows);
    }
    async function revalidateDiscoveryLog(cache) {
        const rows = readDiscoveryLog(); if (!rows.length) return rows;
        const valid = [], finiteDirection = value => Boolean(value && ['x','y','z'].every(axis => Number.isFinite(Number(value[axis]))));
        for (const row of rows) {
            const date = String(row.occurredAt || '').slice(0, 10); if (!date) continue;
            const clean = SDWorldChronologyEngine.clampDate(date, cache.model), timeline = historicalTimeline(cache, clean);
            if (timeline.source.fingerprint === row.timelineFingerprint && finiteDirection(row.direction)) { valid.push(row); continue; }
            try {
                const snapshot = await cache.planetaryHistory.reconstruct(clean), candidates = [...(snapshot.wildlife?.observations || []), ...(snapshot.wildlife?.discoveries || [])], replacement = candidates.find(item => item.id === row.entityId || item.id === String(row.id).split('@')[0]);
                if (!replacement || !finiteDirection(replacement.direction)) continue;
                const direction = Object.freeze({ x: Number(replacement.direction.x), y: Number(replacement.direction.y), z: Number(replacement.direction.z) });
                valid.push(Object.freeze({ ...row, timelineFingerprint: timeline.source.fingerprint, direction, point: direction, altitudeMeters: Number(replacement.altitudeMeters) || 0, rebuiltFromPlanetaryHistory: true }));
            } catch (_error) {}
        }
        if (valid.length !== rows.length) Persistence.set(DISCOVERY_LOG_KEY, { version: 2, rows: valid.slice(0, MAX_DISCOVERY_LOG) });
        return Object.freeze(valid.slice(0, MAX_DISCOVERY_LOG));
    }
    function renderEcologyPanel(root, ecology) {
        const panel = root.querySelector('[data-world-view-panel="ecology"]'); if (!panel) return;
        const summary = ecology?.summary || {}, metrics = [
            ['Biomass', summary.meanBiomass], ['Canopy', summary.meanCanopyClosure], ['Succession', summary.meanSuccession], ['Biodiversity', summary.meanBiodiversityPotential], ['Habitat quality', summary.meanHabitatQuality], ['Ecological reach', summary.meanEcologicalReach]
        ], heading = document.createElement('p'); heading.className = 'world-pass8-copy'; heading.textContent = `${ecology?.regions?.length || 0} connected, area-weighted spherical regions evolve from the standalone planet’s neutral ecology.`;
        const grid = document.createElement('div'); grid.className = 'world-pass9-ecology-grid';
        for (const [label, value] of metrics) { const card = document.createElement('div'); card.className = 'world-pass9-eco-card'; const strong = document.createElement('strong'); strong.textContent = label; const span = document.createElement('span'); span.textContent = `${Math.round((Number(value) || 0) * 100)}%`; card.append(strong, span); grid.appendChild(card); }
        for (const habitat of ecology?.habitats || []) { const card = document.createElement('div'); card.className = 'world-pass9-eco-card'; const strong = document.createElement('strong'); strong.textContent = String(habitat.className || 'habitat').replaceAll('-', ' '); const span = document.createElement('span'); span.textContent = `${habitat.regionIndices?.length || 0} regions · ${Math.round(Number(habitat.areaSquareMeters) || 0).toLocaleString()} m²`; card.append(strong, span); grid.appendChild(card); }
        panel.replaceChildren(heading, grid);
    }
    function renderDiscoveriesPanel(root, rowsSource, actions = {}) {
        const panel = root.querySelector('[data-world-view-panel="discoveries"]'); if (!panel) return;
        const rows = (Array.isArray(rowsSource) ? rowsSource : []).filter(row => row && typeof row === 'object').slice().sort((a, b) => String(b.occurredAt || '').localeCompare(String(a.occurredAt || '')) || String(a.id || '').localeCompare(String(b.id || ''))).slice(0, MAX_DISCOVERY_LOG), list = document.createElement('div'); list.className = 'world-pass9-discovery-list';
        if (!rows.length) { const empty = document.createElement('div'); empty.className = 'world-pass9-empty'; empty.textContent = 'No discovery has been encountered yet. Explore the planet to encounter its wildlife and ecological signs.'; panel.replaceChildren(empty); return; }
        for (const row of rows) {
            const card = document.createElement('article'); card.className = 'world-pass9-discovery'; const strong = document.createElement('strong'); strong.textContent = String(row.title || row.label || row.entityId || 'Discovery');
            const span = document.createElement('span'); span.textContent = [String(row.occurredAt || '').slice(0, 10), ...(Array.isArray(row.conditions) ? row.conditions : []).slice(0, 3)].filter(Boolean).join(' · ') || String(row.type || 'discovery'); card.append(strong, span);
            if (typeof actions.date === 'function' && row.occurredAt) { const when = document.createElement('button'); when.type = 'button'; when.textContent = 'View date'; when.addEventListener('click', () => actions.date(String(row.occurredAt).slice(0, 10), row)); card.appendChild(when); }
            if (typeof actions.focus === 'function' && (row.direction || row.point)) { const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Go to place'; button.addEventListener('click', () => actions.focus(row)); card.appendChild(button); }
            list.appendChild(card);
        }
        panel.replaceChildren(list);
    }
    function paintSphericalInspector(root, selection, actions = {}) {
        const panel = root.querySelector('[data-world-inspector]'); if (!panel) return;
        if (!selection) { panel.hidden = true; panel.dataset.entityId = ''; panel.replaceChildren(); return; }
        panel.dataset.entityId = selection.id;
        const natural = selection.type === 'natural-entity', wildlife = selection.type === 'wildlife', discovery = selection.type === 'discovery';
        const type = document.createElement('div'); type.className = 'world-pass9-inspector-type'; type.textContent = natural ? 'Stable spherical natural entity' : wildlife ? 'Stable spherical wildlife observation' : discovery ? 'Stable spherical discovery' : selection.isOcean ? 'Spherical ocean place' : 'Spherical terrain place';
        const title = document.createElement('h2'); title.textContent = natural || wildlife || discovery ? String(selection.label || selection.kind || 'natural entity').replaceAll('-', ' ') : String(selection.biome || 'unclassified').replaceAll('-', ' ');
        const latitude = Number(selection.latitudeDegrees) || 0, longitude = Number(selection.longitudeDegrees) || 0, summary = document.createElement('p'); summary.textContent = `${latitude.toFixed(4)}° latitude · ${selection.longitudeDefined ? `${longitude.toFixed(4)}° longitude` : 'longitude undefined at pole'} · ${Math.round(Number(selection.altitudeMeters) || 0)} m radial elevation`;
        const facts = document.createElement('ul');
        const rows = natural ? [`Entity ${selection.entityId}`, `Anchor ${selection.anchorCellId}`, selection.regionId ? `Ecological region ${selection.regionId}` : 'Ecological region unavailable', `Terrain contact ${(Number(selection.terrainContactMeters) || 0).toFixed(3)} m · ${String(selection.biome || 'unclassified').replaceAll('-', ' ')}`, `Biomass ${Math.round((selection.ecology?.biomass || 0) * 100)}% · habitat quality ${Math.round((selection.ecology?.habitatQuality || 0) * 100)}%`] : wildlife ? [`Observation ${selection.entityId}`, `Mode ${selection.mode} · guild ${String(selection.kind || 'wildlife').replaceAll('-', ' ')}`, `Cell ${selection.cellId}`, `${Number(selection.climate?.temperatureC || 0).toFixed(1)} °C · humidity ${Math.round((selection.climate?.humidity || 0) * 100)}% · wind ${Number(selection.climate?.windSpeedMps || 0).toFixed(1)} m/s`, selection.perchEntityId ? `Perched on ${selection.perchEntityId}` : `Terrain clearance ${(Number(selection.terrainContactMeters) || 0).toFixed(1)} m`, `Habitat quality ${Math.round((selection.ecology?.habitatQuality || 0) * 100)}% · biodiversity ${Math.round((selection.ecology?.biodiversity || 0) * 100)}%`] : discovery ? [`Discovery ${selection.entityId}`, `Category ${String(selection.kind || 'ecological sign').replaceAll('-', ' ')}`, `Cell ${selection.cellId}`, `Species ${selection.speciesId || 'unclassified'}`] : [`Cell ${selection.cellId || selection.id}`, selection.regionId ? `Ecological region ${selection.regionId}` : 'Ecological region unavailable', `${Number(selection.temperatureC || 0).toFixed(1)} °C mean · ${Math.round(Number(selection.precipitationMm) || 0)} mm annual precipitation`, `${Math.round((Number(selection.snowFraction) || 0) * 100)}% snow tendency · slope ${(Number(selection.slope) || 0).toFixed(2)}`, selection.riverOrder > 0 ? `River order ${selection.riverOrder}` : selection.isOcean ? 'Global ocean surface' : 'No canonical river channel'];
        for (const fact of rows) { const item = document.createElement('li'); item.textContent = fact; facts.appendChild(item); }
        const go = document.createElement('button'); go.type = 'button'; go.textContent = 'Center place'; go.addEventListener('click', () => actions.go?.(selection));
        const focus = document.createElement('button'); focus.type = 'button'; focus.textContent = 'Set focus place'; focus.addEventListener('click', () => actions.focus?.(selection));
        const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.addEventListener('click', () => actions.close?.());
        const provenance = document.createElement('div'); provenance.className = 'world-pass10-provenance'; provenance.textContent = natural ? 'Planet source · fixed level-12 anchor · deterministic entity slot · continuous terrain contact' : wildlife ? 'Planet source · climate-qualified habitat cell · stable species identity · radial grounding/flight/perch contract' : discovery ? 'Planet source · stable spherical discovery anchor · deterministic species and habitat conditions' : 'Planet source · planet fields · unit-vector position · hierarchical icosphere cell';
        panel.replaceChildren(type, title, summary, facts, provenance, go, focus, close); panel.hidden = false;
    }
    function installSphericalControls(root, runtime, ecology, wildlifeInitial, options = {}) {
        const resetButton = root.querySelector('[data-world-action="reset"]'), focusButton = root.querySelector('[data-world-action="focus"]'); let focusPlace = Persistence.get(FOCUS_KEY, null), selected = null;
        const reset = () => runtime.resetCamera?.(), goFocus = () => { if (focusPlace?.direction) runtime.focusDirection?.(focusPlace.direction, Math.min(runtime.getCamera?.().distanceMeters || 1800, 1800)); }, setSelection = selection => { selected = selection; paintSphericalInspector(root, selection, { go: row => runtime.focusDirection?.(row.direction), focus: row => { focusPlace = Object.freeze({ format: 'study-director.world.spherical-focus-place', version: 1, cellId: row.cellId, label: String(row.kind || row.biome || 'place').replaceAll('-', ' '), direction: row.direction, latitudeDegrees: row.latitudeDegrees, longitudeDegrees: row.longitudeDegrees, altitudeMeters: row.altitudeMeters }); Persistence.set(FOCUS_KEY, focusPlace); if (focusButton) focusButton.disabled = false; }, close: () => { selected = null; paintSphericalInspector(root, null); } }); };
        resetButton?.addEventListener('click', reset); focusButton?.addEventListener('click', goFocus); if (focusButton) focusButton.disabled = !focusPlace;
        setWorldView(root, Persistence.get(VIEW_KEY, 'overview'));
        renderEcologyPanel(root, ecology);
        renderDiscoveriesPanel(root, recordDiscoveries(wildlifeInitial), { focus: row => runtime.focusDirection?.(row.point || row.direction) });
        return Object.freeze({
            updateWildlife(next) { renderDiscoveriesPanel(root, recordDiscoveries(next), { focus: row => runtime.focusDirection?.(row.point || row.direction) }); if (selected?.type === 'wildlife' || selected?.type === 'discovery') setSelection(null); },
            select(selection) { setSelection(selection); return Boolean(selection); },
            cameraState() { return runtime.getCamera?.() || null; },
            goPoint(direction) { if (!direction) return false; runtime.focusDirection?.(direction); return true; },
            destroy() { selected = null; resetButton?.removeEventListener('click', reset); focusButton?.removeEventListener('click', goFocus); }
        });
    }
    function createSeed() {
        const bytes = new Uint32Array(4);
        if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function')
            globalThis.crypto.getRandomValues(bytes);
        else {
            let value = (Date.now() ^ Math.floor((globalThis.performance && performance.now ? performance.now() : 0) * 1000)) >>> 0;
            for (let index = 0; index < bytes.length; index += 1) {
                value = (Math.imul(value ^ 0x9e3779b9, 1664525) + 1013904223) >>> 0;
                bytes[index] = value;
            }
        }
        return Array.from(bytes, value => value.toString(16).padStart(8, '0')).join('');
    }
    function getWorldIdentity() {
        if (worldIdentity)
            return worldIdentity;
        let seed = Persistence.get(WORLD_SEED_KEY, null), simulationVersion = Persistence.get(WORLD_SIMULATION_KEY, null), sphericalEngineVersion = Persistence.get(SPHERICAL_ENGINE_KEY, null), icosphereEngineVersion = Persistence.get(ICOSPHERE_ENGINE_KEY, null), planetGeneratorEngineVersion = Persistence.get(PLANET_GENERATOR_ENGINE_KEY, null), planetaryEcologyEngineVersion = Persistence.get(PLANETARY_ECOLOGY_ENGINE_KEY, null), terrainRendererEngineVersion = Persistence.get(TERRAIN_RENDERER_ENGINE_KEY, null), cameraEngineVersion = Persistence.get(CAMERA_ENGINE_KEY, null), naturalWorldEngineVersion = Persistence.get(NATURAL_WORLD_ENGINE_KEY, null), planetaryAtmosphereEngineVersion = Persistence.get(PLANET_ATMOSPHERE_ENGINE_KEY, null), planetaryWildlifeEngineVersion = Persistence.get(PLANET_WILDLIFE_ENGINE_KEY, null), planetHistoryEngineVersion = Persistence.get(PLANET_HISTORY_ENGINE_KEY, null), persisted = true, migratedFromV1 = false;
        if (typeof seed !== 'string' || !seed.trim()) {
            seed = readLegacySeed();
            migratedFromV1 = Boolean(seed);
            if (!seed) seed = createSeed();
            persisted = Persistence.set(WORLD_SEED_KEY, seed) && persisted;
        }
        seed = String(seed).trim();
        const expectedSimulationVersion = currentSimulationVersion();
        if (simulationVersion === null || simulationVersion === undefined) {
            simulationVersion = expectedSimulationVersion;
            persisted = Persistence.set(WORLD_SIMULATION_KEY, simulationVersion) && persisted;
        }
        if (sphericalEngineVersion === null || sphericalEngineVersion === undefined) {
            sphericalEngineVersion = SDWorldSphericalMathEngine.version;
            persisted = Persistence.set(SPHERICAL_ENGINE_KEY, sphericalEngineVersion) && persisted;
        }
        if (icosphereEngineVersion === null || icosphereEngineVersion === undefined) {
            icosphereEngineVersion = SDWorldIcosphereEngine.version;
            persisted = Persistence.set(ICOSPHERE_ENGINE_KEY, icosphereEngineVersion) && persisted;
        }
        if (planetGeneratorEngineVersion === null || planetGeneratorEngineVersion === undefined) {
            planetGeneratorEngineVersion = SDWorldPlanetGeneratorEngine.engineVersion;
            persisted = Persistence.set(PLANET_GENERATOR_ENGINE_KEY, planetGeneratorEngineVersion) && persisted;
        }
        if (planetaryEcologyEngineVersion === null || planetaryEcologyEngineVersion === undefined) {
            planetaryEcologyEngineVersion = SDWorldPlanetaryEcologyEngine.engineVersion;
            persisted = Persistence.set(PLANETARY_ECOLOGY_ENGINE_KEY, planetaryEcologyEngineVersion) && persisted;
        }
        if (terrainRendererEngineVersion === null || terrainRendererEngineVersion === undefined) {
            terrainRendererEngineVersion = SDWorldPlanetTerrainRendererEngine.engineVersion;
            persisted = Persistence.set(TERRAIN_RENDERER_ENGINE_KEY, terrainRendererEngineVersion) && persisted;
        }
        if (cameraEngineVersion === null || cameraEngineVersion === undefined) {
            cameraEngineVersion = SDWorldPlanetCameraEngine.engineVersion;
            persisted = Persistence.set(CAMERA_ENGINE_KEY, cameraEngineVersion) && persisted;
        }
        if (naturalWorldEngineVersion === null || naturalWorldEngineVersion === undefined) {
            naturalWorldEngineVersion = SDWorldPlanetNaturalEngine.engineVersion;
            persisted = Persistence.set(NATURAL_WORLD_ENGINE_KEY, naturalWorldEngineVersion) && persisted;
        }
        if (planetaryAtmosphereEngineVersion === null || planetaryAtmosphereEngineVersion === undefined) {
            planetaryAtmosphereEngineVersion = SDWorldPlanetAtmosphereEngine.engineVersion;
            persisted = Persistence.set(PLANET_ATMOSPHERE_ENGINE_KEY, planetaryAtmosphereEngineVersion) && persisted;
        }
        if (planetaryWildlifeEngineVersion === null || planetaryWildlifeEngineVersion === undefined) {
            planetaryWildlifeEngineVersion = SDWorldPlanetWildlifeEngine.engineVersion;
            persisted = Persistence.set(PLANET_WILDLIFE_ENGINE_KEY, planetaryWildlifeEngineVersion) && persisted;
        }
        if (planetHistoryEngineVersion === null || planetHistoryEngineVersion === undefined) {
            planetHistoryEngineVersion = SDWorldPlanetHistoryEngine.engineVersion;
            persisted = Persistence.set(PLANET_HISTORY_ENGINE_KEY, planetHistoryEngineVersion) && persisted;
        }
        simulationVersion = String(simulationVersion);
        sphericalEngineVersion = Number(sphericalEngineVersion);
        icosphereEngineVersion = Number(icosphereEngineVersion);
        planetGeneratorEngineVersion = Number(planetGeneratorEngineVersion);
        planetaryEcologyEngineVersion = Number(planetaryEcologyEngineVersion);
        terrainRendererEngineVersion = Number(terrainRendererEngineVersion);
        cameraEngineVersion = Number(cameraEngineVersion);
        naturalWorldEngineVersion = Number(naturalWorldEngineVersion);
        planetaryAtmosphereEngineVersion = Number(planetaryAtmosphereEngineVersion);
        planetaryWildlifeEngineVersion = Number(planetaryWildlifeEngineVersion);
        planetHistoryEngineVersion = Number(planetHistoryEngineVersion);
        if (simulationVersion !== expectedSimulationVersion) { simulationVersion = expectedSimulationVersion; persisted = Persistence.set(WORLD_SIMULATION_KEY, simulationVersion) && persisted; invalidateChronologyCache(); }
        if (sphericalEngineVersion !== SDWorldSphericalMathEngine.version)
            throw new Error(`Living World spherical mathematics v${sphericalEngineVersion} is not supported by this build.`);
        if (icosphereEngineVersion !== SDWorldIcosphereEngine.version)
            throw new Error(`Living World icosphere topology v${icosphereEngineVersion} is not supported by this build.`);
        if (planetGeneratorEngineVersion !== SDWorldPlanetGeneratorEngine.engineVersion)
            throw new Error(`Living World spherical planet generator v${planetGeneratorEngineVersion} is not supported by this build.`);
        if (planetaryEcologyEngineVersion !== SDWorldPlanetaryEcologyEngine.engineVersion)
            throw new Error(`Living World planetary ecology engine v${planetaryEcologyEngineVersion} is not supported by this build.`);
        if (terrainRendererEngineVersion !== SDWorldPlanetTerrainRendererEngine.engineVersion) { terrainRendererEngineVersion = SDWorldPlanetTerrainRendererEngine.engineVersion; persisted = Persistence.set(TERRAIN_RENDERER_ENGINE_KEY, terrainRendererEngineVersion) && persisted; }
        if (cameraEngineVersion !== SDWorldPlanetCameraEngine.engineVersion) { cameraEngineVersion = SDWorldPlanetCameraEngine.engineVersion; persisted = Persistence.set(CAMERA_ENGINE_KEY, cameraEngineVersion) && persisted; }
        if (naturalWorldEngineVersion !== SDWorldPlanetNaturalEngine.engineVersion) { naturalWorldEngineVersion = SDWorldPlanetNaturalEngine.engineVersion; persisted = Persistence.set(NATURAL_WORLD_ENGINE_KEY, naturalWorldEngineVersion) && persisted; }
        if (planetaryAtmosphereEngineVersion !== SDWorldPlanetAtmosphereEngine.engineVersion) { planetaryAtmosphereEngineVersion = SDWorldPlanetAtmosphereEngine.engineVersion; persisted = Persistence.set(PLANET_ATMOSPHERE_ENGINE_KEY, planetaryAtmosphereEngineVersion) && persisted; }
        if (planetaryWildlifeEngineVersion !== SDWorldPlanetWildlifeEngine.engineVersion) { planetaryWildlifeEngineVersion = SDWorldPlanetWildlifeEngine.engineVersion; persisted = Persistence.set(PLANET_WILDLIFE_ENGINE_KEY, planetaryWildlifeEngineVersion) && persisted; }
        if (planetHistoryEngineVersion !== SDWorldPlanetHistoryEngine.engineVersion) { planetHistoryEngineVersion = SDWorldPlanetHistoryEngine.engineVersion; persisted = Persistence.set(PLANET_HISTORY_ENGINE_KEY, planetHistoryEngineVersion) && persisted; }
        const planet = SDWorldSphericalMathEngine.defaultPlanet, contract = Object.freeze({ format: 'study-director.world.planet-identity', version: 2, seed, radiusMeters: planet.radiusMeters, center: planet.center, rotationalAxis: planet.axis, axialTiltDegrees: planet.axialTiltDegrees, seaLevelMeters: planet.seaLevelMeters, generatorVersion: planetGeneratorEngineVersion, simulationVersion });
        worldIdentity = Object.freeze({ seed, simulationVersion, sphericalEngineVersion, icosphereEngineVersion, planetGeneratorEngineVersion, planetaryEcologyEngineVersion, terrainRendererEngineVersion, cameraEngineVersion, naturalWorldEngineVersion, planetaryAtmosphereEngineVersion, planetaryWildlifeEngineVersion, planetHistoryEngineVersion, planet, contract, persisted, migratedFromV1 });
        return worldIdentity;
    }
    async function getHistorySource(force = false) {
        if (!API) throw new Error('Living World API is unavailable.');
        const currentStudyDate = StandaloneSource.getCurrentDate(), datasetRevision = StandaloneSource.revision, revisionKey = datasetRevision === null ? 'fallback' : String(datasetRevision), cacheKey = `${currentStudyDate}|${revisionKey}`;
        if (!force && datasetRevision !== null && behaviourCache && behaviourCache.key === cacheKey && Array.isArray(behaviourCache.records)) return behaviourCache;
        const recordsRaw = StandaloneSource.records, records = Array.isArray(recordsRaw) ? recordsRaw : [], timeline = SDWorldBehaviourEngine.buildTimeline(records, { currentStudyDate, datasetRevision }), identity = getWorldIdentity(), historyKey = SDWorldChronologyEngine.sourceKey(timeline, datasetRevision, identity.simulationVersion);
        const source = Object.freeze({ key: cacheKey, historyKey, records: Object.freeze([...records]), timeline, currentStudyDate, datasetRevision });
        if (chronologyCache && chronologyCache.key !== historyKey) invalidateChronologyCache();
        behaviourCache = source;
        return source;
    }
    async function getBehaviourTimeline() { return (await getHistorySource()).timeline; }
    async function getSphericalPlanet() {
        const identity = getWorldIdentity(), cacheKey = `${identity.seed}|${identity.planetGeneratorEngineVersion}|level4`;
        if (planetCache?.key === cacheKey) return planetCache.promise;
        planetGenerationController?.abort?.(); planetGenerationController = new AbortController(); const controller = planetGenerationController;
        const options = Object.freeze({ seed: identity.seed, level: 4, planet: identity.planet, oceanCoverageTarget: .61, plateCount: 12 });
        const promise = SDWorldPlanetGeneratorEngine.generateInWorker(options, { signal: controller.signal, timeoutMs: 120000 }).then(planet => { if (planet.audit?.fingerprintMatches !== true) throw new Error('Spherical planet generation failed its fingerprint audit.'); return planet; }).finally(() => { if (planetGenerationController === controller) planetGenerationController = null; });
        planetCache = Object.freeze({ key: cacheKey, promise });
        try { return await promise; } catch (error) { if (planetCache?.promise === promise) planetCache = null; throw error; }
    }
    async function getPlanetaryEcologyState(timeline, planet) {
        const cacheKey = `${timeline.source.fingerprint}|${planet.fingerprint}|${SDWorldPlanetaryEcologyEngine.engineVersion}`;
        if (planetaryEcologyCache?.key === cacheKey) return planetaryEcologyCache.promise;
        planetEcologyController?.abort?.(); planetEcologyController = new AbortController(); const controller = planetEcologyController;
        const promise = SDWorldPlanetaryEcologyEngine.evolveInWorker(timeline, planet, { signal: controller.signal, timeoutMs: 120000 }).then(result => result?.state || result).then(state => { if (!state || state.audit?.fingerprintMatches !== true) throw new Error('Planetary ecology projection failed its invariant audit.'); return state; }).finally(() => { if (planetEcologyController === controller) planetEcologyController = null; });
        planetaryEcologyCache = Object.freeze({ key: cacheKey, promise });
        try { return await promise; } catch (error) { if (planetaryEcologyCache?.promise === promise) planetaryEcologyCache = null; throw error; }
    }
    async function getPlanetarySystemsState(planet, planetaryEcology, when = atmosphereNow()) {
        const minuteKey = String(when.localDateTime || '').slice(0,16), cacheKey = `${planet.fingerprint}|${planetaryEcology.fingerprint}|${minuteKey}|tz${Number(when.timezoneOffsetMinutes) || 0}|${SDWorldPlanetAtmosphereEngine.engineVersion}|${SDWorldPlanetWildlifeEngine.engineVersion}`;
        if (planetaryAtmosphereCache?.key === cacheKey) return planetaryAtmosphereCache.promise;
        planetSystemsController?.abort?.(); const controller = new AbortController(); planetSystemsController = controller;
        const promise = SDWorldPlanetaryEcologyEngine.systemsInWorker(planet, planetaryEcology, { when, signal: controller.signal, timeoutMs: 120000 }).then(result => { if (!result?.atmosphere?.audit?.fingerprintMatches || !result?.wildlife?.audit?.fingerprintMatches) throw new Error('Planetary natural systems failed their invariant audit.'); return Object.freeze({ atmosphere: result.atmosphere, wildlife: result.wildlife }); }).finally(() => { if (planetSystemsController === controller) planetSystemsController = null; }); planetaryAtmosphereCache = Object.freeze({ key: cacheKey, promise });
        try { return await promise; } catch (error) { if (planetaryAtmosphereCache?.promise === promise) planetaryAtmosphereCache = null; throw error; }
    }
    function describePlanetaryAtmosphere(state) { const summary = state.fields.summary; return `${state.time.utcIso.slice(11,16)} UTC · sun ${state.sun.declinationDegrees.toFixed(1)}° declination · cloud ${Math.round(summary.meanCloudCoverage * 100)}% · precipitation ${Math.round(summary.meanPrecipitation * 100)}% · ${summary.minimumTemperatureC.toFixed(1)}–${summary.maximumTemperatureC.toFixed(1)} °C`; }
    function describePlanetaryWildlife(state) { return `${state.observations.length} stable observations · ground ${state.audit.modes.ground} · flight ${state.audit.modes.flight} · perch ${state.audit.modes.perch} · ${state.discoveries.length} discoveries`; }
    function atmosphereNow() { const date = new Date(), pad = value => String(value).padStart(2, '0'); return Object.freeze({
        localDateTime: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`, timezoneOffsetMinutes: -date.getTimezoneOffset()
    }); }
    const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
    function rememberLru(map, key, value, limit) {
        if (map.has(key)) map.delete(key);
        map.set(key, value);
        while (map.size > limit) map.delete(map.keys().next().value);
        return value;
    }
    async function getChronologyCache(planet, forceSource = false) {
        const source = await getHistorySource(forceSource), model = SDWorldChronologyEngine.createTimeline(source.timeline);
        if (!chronologyCache || chronologyCache.key !== source.historyKey || chronologyCache.planetFingerprint !== planet.fingerprint) {
            chronologyCache?.planetaryHistory?.destroy?.();
            const planetaryHistory = SDWorldPlanetHistoryEngine.create({
                planet, source, simulationVersion: getWorldIdentity().simulationVersion,
                buildTimeline: date => SDWorldBehaviourEngine.buildTimeline(source.records, { currentStudyDate: date, datasetRevision: source.datasetRevision }),
                evolve: async (timeline, checkpoint, signal) => SDWorldPlanetaryEcologyEngine.evolveInWorker(timeline, planet, { checkpoint, signal, timeoutMs: 120000 }),
                reconstructSystems: async (timeline, checkpoint, signal, when) => SDWorldPlanetaryEcologyEngine.reconstructSystemsInWorker(timeline, planet, { checkpoint, signal, when, timeoutMs: 120000 }),
                samplerFactory: ecology => SDWorldPlanetTerrainRendererEngine.createPlanetSampler(planet, ecology)
            });
            chronologyCache = { key: source.historyKey, planetFingerprint: planet.fingerprint, planet, source, model, planetaryHistory, snapshots: new Map(), timelines: new Map(), provenance: new Map() };
        } else chronologyCache.source = source;
        return chronologyCache;
    }
    function historicalTimeline(cache, date) {
        const clean = SDWorldChronologyEngine.clampDate(date, cache.model);
        if (cache.timelines.has(clean)) return cache.timelines.get(clean);
        const timeline = SDWorldBehaviourEngine.buildTimeline(cache.source.records, { currentStudyDate: clean, datasetRevision: cache.source.datasetRevision });
        return rememberLru(cache.timelines, clean, timeline, 24);
    }
    async function buildHistoricalSnapshot(cache, date, runtime = {}) {
        const clean = SDWorldChronologyEngine.clampDate(date, cache.model);
        if (cache.snapshots.has(clean)) { const value = cache.snapshots.get(clean); return rememberLru(cache.snapshots, clean, value, SDWorldChronologyEngine.limits.maxSnapshots); }
        const [planetaryHistory, timeline] = await Promise.all([cache.planetaryHistory.reconstruct(clean, runtime), Promise.resolve(historicalTimeline(cache, clean))]);
        const snapshot = Object.freeze({ date: clean, historical: clean !== cache.model.endDate, timeline, planet: cache.planet, planetFingerprint: cache.planet.fingerprint, historySourceKey: cache.planetaryHistory.sourceKey, planetaryHistory, planetaryEcology: planetaryHistory.ecology, planetaryAtmosphere: planetaryHistory.atmosphere, planetaryWildlife: planetaryHistory.wildlife });
        return rememberLru(cache.snapshots, clean, snapshot, SDWorldChronologyEngine.limits.maxSnapshots);
    }
    function paintSnapshot(root, snapshot) {
        const status = key => root.querySelector(`[data-world-status="${key}"] span`), ecologyValue = status('ecology'), landscapeValue = status('landscape'), projectionValue = status('projection'), habitatValue = status('habitat'), historyValue = status('history'), atmosphereValue = status('atmosphere'), wildlifeValue = status('wildlife'), discoveriesValue = status('discoveries'), projectionBadge = root.querySelector('[data-world-render-badge="projection"]');
        const { timeline, planetaryEcology, planetaryAtmosphere, planetaryWildlife } = snapshot, summary = planetaryEcology.summary;
        if (ecologyValue) ecologyValue.textContent = `biomass ${Math.round(summary.meanBiomass * 100)}% · succession ${Math.round(summary.meanSuccession * 100)}% · biodiversity ${Math.round(summary.meanBiodiversityPotential * 100)}%`;
        if (landscapeValue) landscapeValue.textContent = `${planetaryEcology.fingerprint} · deterministic spherical trees, shrubs, grass, flowers, fungi, deadwood, cliffs, scree and banks`;
        if (projectionValue) projectionValue.textContent = 'one continuous analytic sphere · stable level-12 natural anchors · stitched mixed LOD · spherical ocean, lakes and rivers · no planar projection';
        if (projectionBadge) projectionBadge.textContent = `${snapshot.historical ? snapshot.date + ' · historical living state' : 'Now · living planet'} · one spherical terrain/water scene`;
        if (atmosphereValue) atmosphereValue.textContent = describePlanetaryAtmosphere(planetaryAtmosphere);
        if (wildlifeValue) wildlifeValue.textContent = describePlanetaryWildlife(planetaryWildlife);
        if (discoveriesValue) discoveriesValue.textContent = planetaryWildlife.discoveries.length ? planetaryWildlife.discoveries.map(row => `${row.label} [${row.category}]`).join(' · ') : 'No spherical discovery in this deterministic climate window';
        if (habitatValue) habitatValue.textContent = `${planetaryEcology.habitats.length} connected spherical habitats · quality ${Math.round(summary.meanHabitatQuality * 100)}% · reach ${Math.round(summary.meanEcologicalReach * 100)}%`;
        if (historyValue) historyValue.textContent = 'Neutral standalone world · no app records, plans or sessions connected';
        paintVector(root, timeline.current.d28); renderEcologyPanel(root, planetaryEcology);
        renderDiscoveriesPanel(root, readDiscoveryLog());
    }
    function startLiveRefresh(root, snapshot) {
        clearAtmosphereTimer();
        if (!snapshot || snapshot.historical) return;
        const { planet, planetaryEcology } = snapshot, revision = renderRevision;
        const atmosphereValue = root.querySelector('[data-world-status="atmosphere"] span'), wildlifeValue = root.querySelector('[data-world-status="wildlife"] span'), discoveriesValue = root.querySelector('[data-world-status="discoveries"] span');
        const refresh = async () => {
            if (revision !== renderRevision || !mounted || !rendererRuntime || document.visibilityState === 'hidden' || displayedSnapshot?.historical) return;
            try {
                const currentStudyDate = StandaloneSource.getCurrentDate(), datasetRevision = StandaloneSource.revision;
                if (!behaviourCache || currentStudyDate !== behaviourCache.currentStudyDate || (datasetRevision !== null && String(datasetRevision) !== String(behaviourCache.datasetRevision))) {
                    await refreshStandaloneWorldIfNeeded();
                    return;
                }
                const when = atmosphereNow(), systems = await getPlanetarySystemsState(planet, planetaryEcology, when), nextPlanetaryAtmosphere = systems.atmosphere, nextPlanetaryWildlife = systems.wildlife;
                if (revision !== renderRevision || !mounted || !rendererRuntime || document.visibilityState === 'hidden' || displayedSnapshot?.historical) return;
                rendererRuntime.setAtmosphere?.(nextPlanetaryAtmosphere); rendererRuntime.setWildlife?.(nextPlanetaryWildlife);
                displayedSnapshot = Object.freeze({ ...displayedSnapshot, planetaryAtmosphere: nextPlanetaryAtmosphere, planetaryWildlife: nextPlanetaryWildlife }); explorationController?.updateWildlife?.(nextPlanetaryWildlife);
                if (atmosphereValue) atmosphereValue.textContent = `${describePlanetaryAtmosphere(nextPlanetaryAtmosphere)} · ${nextPlanetaryAtmosphere.fingerprint}`;
                if (wildlifeValue) wildlifeValue.textContent = `${describePlanetaryWildlife(nextPlanetaryWildlife)} · ${nextPlanetaryWildlife.fingerprint}`;
                if (discoveriesValue) discoveriesValue.textContent = nextPlanetaryWildlife.discoveries.length ? nextPlanetaryWildlife.discoveries.map(row => row.label).join(' · ') : 'No spherical discovery in this deterministic climate window';
            } catch (_error) {}
            finally { if (revision === renderRevision && mounted && rendererRuntime && document.visibilityState !== 'hidden' && displayedSnapshot && !displayedSnapshot.historical) atmosphereTimer = setTimeout(refresh, 60000); }
        };
        atmosphereTimer = setTimeout(refresh, 60000);
    }
    async function startRenderer(root, planet, revision, snapshot = null) {
        destroyRenderer();
        const canvas = root.querySelector('.world-pass8-canvas'), stage = root.querySelector('.world-pass8-stage'), rendererBadge = root.querySelector('[data-world-render-badge="renderer"]'),
            rendererValue = root.querySelector('[data-world-status="renderer"] span'), atmosphereValue = root.querySelector('[data-world-status="atmosphere"] span'),
            wildlifeValue = root.querySelector('[data-world-status="wildlife"] span'), discoveriesValue = root.querySelector('[data-world-status="discoveries"] span');

        if (!canvas || !stage)
            return;
        const setText = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };
        const update = stats => {
            if (!mounted || !rendererRuntime) return;
            if (stage.dataset.renderState !== 'ready') stage.dataset.renderState = 'ready';
            setText(rendererBadge, stats.patchWorkerReady ? `${stats.backend} · level ${stats.maximumLevel ?? 0} · ${stats.visiblePatches || 0}/${stats.coverLeaves || 0} patches · ${stats.visibleEntities || 0} entities` : 'WebGPU ready · coarse planet visible · detailed terrain streaming in worker');
            setText(rendererValue, stats.patchWorkerReady ? 'WebGPU planet · terrain, water, weather and wildlife' : 'WebGPU planet · preparing detailed terrain');
        };
        stage.dataset.renderState = 'loading';
        if (rendererBadge)
            rendererBadge.textContent = 'Initializing WebGPU · acquiring device and pipelines';
        if (rendererValue)
            rendererValue.textContent = 'WebGPU renderer initialization in progress';
        let runtime = null;
        try {
            const zoomBadge = root.querySelector('[data-world-zoom]'), initialCamera = Persistence.get(CAMERA_KEY, null);
            runtime = await SDWorldPlanetTerrainRendererEngine.createRenderer(canvas, planet, {
                initialCamera,
                naturalState: snapshot?.planetaryEcology || null,
                atmosphereState: snapshot?.planetaryAtmosphere || null,
                wildlifeState: snapshot?.planetaryWildlife || null,
                onInitProgress: progress => {
                    if (!mounted || revision !== renderRevision) return;
                    const labels = { adapter: 'Requesting WebGPU adapter', device: 'Acquiring WebGPU device', pipelines: 'Compiling first-frame terrain pipeline', globals: 'Uploading lightweight first-frame planet', ready: 'WebGPU ready · preparing first frame' };
                    if (rendererBadge) rendererBadge.textContent = `${labels[progress?.phase] || 'Initializing WebGPU'} · ${Math.round(Number(progress?.elapsedMilliseconds) || 0)} ms`;
                },
                onStreamingState: state => {
                    if (!mounted || rendererRuntime !== runtime) return;
                    if (state?.phase === 'shell-pipeline' && rendererBadge) rendererBadge.textContent = 'Coarse planet visible · compiling atmosphere pipeline';
                    else if (state?.phase === 'initializing' && rendererBadge) rendererBadge.textContent = 'Atmosphere ready · detailed terrain streaming in worker';
                    else if (state?.phase === 'ready' && rendererBadge) rendererBadge.textContent = 'WebGPU ready · planetary terrain stream active';
                },
                onCameraChange: camera => {
                    scheduleCameraPersistence(camera);
                    if (zoomBadge) zoomBadge.textContent = camera.semanticZoomLevel || 'Detail';
                },
                onCameraCommit: camera => flushCameraPersistence(camera),
                onPick: selection => explorationController?.select?.(selection),
                onStats: update,
                onDeviceLost: info => {
                    if (!mounted || rendererRuntime !== runtime) return;
                    destroyRenderer();
                    stage.dataset.renderState = 'failed';
                    if (rendererBadge) rendererBadge.textContent = 'WebGPU device lost · resources released safely';
                    if (rendererValue) rendererValue.textContent = `WebGPU device lost${info?.message ? ` · ${info.message}` : ''} · reopen World to rebuild GPU resources`;
                },
                onGpuError: error => {
                    if (!mounted || rendererRuntime !== runtime) return;
                    destroyRenderer();
                    stage.dataset.renderState = 'failed';
                    if (rendererBadge) rendererBadge.textContent = 'WebGPU validation/runtime error · resources released safely';
                    if (rendererValue) rendererValue.textContent = `WebGPU error${error?.message ? ` · ${error.message}` : ''} · reopen World to retry`;
                },
                onRenderError: error => {
                    if (!mounted || rendererRuntime !== runtime) return;
                    destroyRenderer();
                    stage.dataset.renderState = 'failed';
                    if (rendererBadge) rendererBadge.textContent = 'WebGPU render interrupted · resources released safely';
                    if (rendererValue) rendererValue.textContent = `Render interrupted${error?.message ? ` · ${error.message}` : ''} · reopen World to retry`;
                }
            });
        }
        catch (error) {
            if (revision !== renderRevision || !mounted || activePane !== root.parentElement)
                return false;
            stage.dataset.renderState = 'unavailable';
            if (rendererBadge)
                rendererBadge.textContent = 'WebGPU view unavailable';
            if (rendererValue)
                rendererValue.textContent = `Living World requires WebGPU. ${error?.message || 'A suitable device could not be initialized.'}`;
            const notice = document.createElement('p');
            notice.className = 'world-unavailable'; notice.setAttribute('role', 'status');
            notice.textContent = 'Living World needs a browser and device with WebGPU support. The planet view is unavailable here; your study workspace is still ready to use.';
            stage.appendChild(notice); canvas.tabIndex = -1;
            canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Planet view unavailable: WebGPU is required.');
            for (const button of root.querySelectorAll('[data-world-action]')) button.disabled = true;
            return false;
        }
        if (revision !== renderRevision || !mounted || !root.isConnected) {
            runtime.destroy();
            return false;
        }
        rendererRuntime = runtime;
        rendererRuntime.start();
        displayedSnapshot = snapshot;
        explorationController = installSphericalControls(root, rendererRuntime, snapshot?.planetaryEcology, snapshot?.planetaryWildlife || null, { onDiscoveryDate: date => historyController?.showDate?.(date) });
        if (snapshot?.historical) return true;
        startLiveRefresh(root, displayedSnapshot);
        return true;
    }
    async function buildCurrentSnapshot(planet) {
        const timeline = await getBehaviourTimeline(), planetaryEcology = await getPlanetaryEcologyState(timeline, planet), systems = await getPlanetarySystemsState(planet, planetaryEcology), planetaryAtmosphere = systems.atmosphere, planetaryWildlife = systems.wildlife;
        return Object.freeze({ date: timeline.source.currentStudyDate, historical: false, timeline, planet, planetFingerprint: planet.fingerprint, historySourceKey: null, planetaryHistory: null, planetaryEcology, planetaryAtmosphere, planetaryWildlife });
    }
    function compareSnapshots(before, after) {
        if (before?.planetaryHistory && after?.planetaryHistory) {
            const comparison = SDWorldPlanetHistoryEngine.compare(before.planetaryHistory, after.planetaryHistory), sign = value => `${value >= 0 ? '+' : ''}${value}`,
                points = key => sign(Math.round((Number(comparison.delta[key]) || 0) * 100));
            return Object.freeze({ beforeDate: comparison.beforeDate, afterDate: comparison.afterDate, fingerprint: comparison.fingerprint, rows: Object.freeze([
                ['Biomass', `${points('biomass')} pp`], ['Canopy', `${points('canopy')} pp`], ['Succession', `${points('succession')} pp`],
                ['Biodiversity', `${points('biodiversity')} pp`], ['Habitat quality', `${points('habitatQuality')} pp`],
                ['Ecological reach', `${points('ecologicalReach')} pp`], ['Cloud', `${points('cloudCoverage')} pp`],
                ['Wildlife observations', sign(comparison.delta.observations)], ['Focused/effective study', `${sign((comparison.delta.studyMinutes / 60).toFixed(1))} h`]
            ]) });
        }
        const b = before?.planetaryEcology?.summary || {}, a = after?.planetaryEcology?.summary || {}, pct = value => Math.round((Number(value) || 0) * 100), delta = (x, y) => pct(y) - pct(x);
        const beforeMinutes = Number(before?.timeline?.current?.lifetime?.evidence?.effectiveMinutes) || 0, afterMinutes = Number(after?.timeline?.current?.lifetime?.evidence?.effectiveMinutes) || 0;
        return Object.freeze({
            beforeDate: before.date, afterDate: after.date,
            rows: Object.freeze([
                ['Biomass', `${delta(b.meanBiomass, a.meanBiomass) >= 0 ? '+' : ''}${delta(b.meanBiomass, a.meanBiomass)} pp`],
                ['Canopy', `${delta(b.meanCanopyClosure, a.meanCanopyClosure) >= 0 ? '+' : ''}${delta(b.meanCanopyClosure, a.meanCanopyClosure)} pp`],
                ['Succession', `${delta(b.meanSuccession, a.meanSuccession) >= 0 ? '+' : ''}${delta(b.meanSuccession, a.meanSuccession)} pp`],
                ['Biodiversity', `${delta(b.meanBiodiversityPotential, a.meanBiodiversityPotential) >= 0 ? '+' : ''}${delta(b.meanBiodiversityPotential, a.meanBiodiversityPotential)} pp`],
                ['Habitat quality', `${delta(b.meanHabitatQuality, a.meanHabitatQuality) >= 0 ? '+' : ''}${delta(b.meanHabitatQuality, a.meanHabitatQuality)} pp`],
                ['Ecological reach', `${delta(b.meanEcologicalReach, a.meanEcologicalReach) >= 0 ? '+' : ''}${delta(b.meanEcologicalReach, a.meanEcologicalReach)} pp`],
                ['Focused/effective study', `${(afterMinutes - beforeMinutes) >= 0 ? '+' : ''}${((afterMinutes - beforeMinutes) / 60).toFixed(1)} h`]
            ])
        });
    }
    function installHistory(root, planet, initialCache, initialSnapshot, revision) {
        historyController?.destroy?.();
        const slider = root.querySelector('[data-world-history-slider]'), dateValue = root.querySelector('[data-world-history-date]'), meta = root.querySelector('[data-world-history-meta]'), status = root.querySelector('[data-world-history-status]'), compareNode = root.querySelector('[data-world-history-compare]');
        const action = id => root.querySelector(`[data-world-history-action="${id}"]`), back = action('back'), forward = action('forward'), monthBack = action('month-back'), monthForward = action('month-forward'), yearBack = action('year-back'), yearForward = action('year-forward'), play = action('play'), playMonth = action('play-month'), playYear = action('play-year'), markBefore = action('compare-before'), compareHere = action('compare-now'), nowButton = action('now');
        if (!slider || !dateValue || !meta || !status) return null;
        let cache = initialCache, model = cache.model, selectedDate = model.endDate, compareBeforeDate = null, operation = 0, replay = 0, scrubTimer = 0, destroyed = false, activeReplayButton = null, pendingReconstruction = null;
        const replayLabels = new Map([[play, 'Replay → now'], [playMonth, 'Replay month'], [playYear, 'Replay year']].filter(([button]) => button));
        const updateControls = () => {
            slider.max = String(Math.max(0, model.totalDays - 1)); slider.value = String(SDWorldChronologyEngine.position(selectedDate, model));
            dateValue.textContent = selectedDate === model.endDate ? `${selectedDate} · Now` : `${selectedDate} · Historical reconstruction`;
            meta.textContent = `${model.totalDays} calendar days · ${model.activeDates.length} active study days`;
            const planetary = cache.planetaryHistory.stats();
            status.textContent = `${planetary.checkpoints}/${planetary.limits.checkpoints} planetary checkpoints · ${planetary.snapshots} recent spherical snapshots · derived caches only`;
        };
        const refreshCache = async () => {
            const next = await getChronologyCache(planet);
            if (next.key !== cache.key) { cache = next; model = next.model; selectedDate = SDWorldChronologyEngine.clampDate(selectedDate, model); compareBeforeDate = compareBeforeDate ? SDWorldChronologyEngine.clampDate(compareBeforeDate, model) : null; const validDiscoveries = await revalidateDiscoveryLog(cache); status.textContent = 'World calendar changed · historical checkpoints invalidated and encountered discoveries revalidated against their original dates.'; renderDiscoveriesPanel(root, validDiscoveries, { focus: row => explorationController?.goPoint?.(row.point), date: date => historyController?.showDate?.(date) }); }
            return cache;
        };
        const provenance = async (selection, snapshot = displayedSnapshot) => {
            const date = snapshot?.date || selectedDate, planetarySnapshot = snapshot?.planetaryHistory || await cache.planetaryHistory.reconstruct(date);
            return cache.planetaryHistory.provenance(selection, planetarySnapshot);
        };
        const installSnapshotExploration = (snapshot, previousState = null) => {
            explorationController?.destroy?.();
            if (previousState) rendererRuntime.setCamera?.(previousState);
            explorationController = installSphericalControls(root, rendererRuntime, snapshot.planetaryEcology, snapshot.planetaryWildlife || null, { onDiscoveryDate: date => historyController?.showDate?.(date) });
        };
        const swap = async snapshot => {
            if (destroyed || revision !== renderRevision || !mounted || !rendererRuntime) return false;
            const previousState = explorationController?.cameraState?.() || null;
            clearAtmosphereTimer();
            if (!rendererRuntime.setWorld?.(planet) || !rendererRuntime.setSnapshot?.(snapshot.planetaryEcology, snapshot.planetaryAtmosphere, snapshot.planetaryWildlife)) return false;
            displayedSnapshot = snapshot; selectedDate = snapshot.date; paintSnapshot(root, snapshot); recordDiscoveries(snapshot.planetaryWildlife, snapshot.timeline);
            installSnapshotExploration(snapshot, previousState); if (!snapshot.historical) startLiveRefresh(root, snapshot); updateControls(); return true;
        };
        const snapshotFor = async (date, signal = null) => {
            const clean = SDWorldChronologyEngine.clampDate(date, model);
            if (clean !== model.endDate) return buildHistoricalSnapshot(cache, clean, { signal });
            const [live, planetaryHistory] = await Promise.all([buildCurrentSnapshot(planet), cache.planetaryHistory.reconstruct(clean, { signal })]);
            return Object.freeze({ ...live, historySourceKey: cache.planetaryHistory.sourceKey, planetaryHistory });
        };
        const showDate = async (date, { replayFrame = false } = {}) => {
            const token = ++operation; if (!replayFrame) replay += 1;
            pendingReconstruction?.abort?.(); const controller = new AbortController(); pendingReconstruction = controller;
            await refreshCache(); const clean = SDWorldChronologyEngine.clampDate(date, model); selectedDate = clean; updateControls(); status.textContent = clean === model.endDate ? 'Returning to the live world…' : `Reconstructing ${clean} from the private world calendar…`;
            try {
                await yieldTask(); const snapshot = await snapshotFor(clean, controller.signal);
                if (destroyed || token !== operation || revision !== renderRevision) return false;
                const ok = await swap(snapshot), planetary = cache.planetaryHistory.stats(); if (ok) status.textContent = `${clean === model.endDate ? 'Live world' : 'Historical world'} ready · ${planetary.checkpoints} planetary checkpoints · ${planetary.snapshots} recent spherical snapshots`;
                return ok;
            } catch (error) { if (error?.name === 'AbortError') return false; throw error; }
            finally { if (pendingReconstruction === controller) pendingReconstruction = null; }
        };
        const stopReplay = () => { replay += 1; pendingReconstruction?.abort?.(); if (activeReplayButton) { activeReplayButton.textContent = replayLabels.get(activeReplayButton) || 'Replay'; activeReplayButton = null; } };
        const runReplayDates = async (dates, button) => {
            if (activeReplayButton === button) { stopReplay(); return; }
            stopReplay(); const token = ++replay; activeReplayButton = button; if (button) button.textContent = 'Pause';
            for (const date of dates) { if (destroyed || token !== replay) break; const ok = await showDate(date, { replayFrame: true }); if (!ok || token !== replay) break; await new Promise(resolve => setTimeout(resolve, 180)); }
            if (token === replay) stopReplay();
        };
        const beginReplay = () => runReplayDates(SDWorldChronologyEngine.replayDates(selectedDate === model.endDate ? model.startDate : selectedDate, model.endDate, model), play);
        const beginMonthReplay = () => runReplayDates(SDWorldChronologyEngine.scopedReplayDates(selectedDate, 'month', model), playMonth);
        const beginYearReplay = () => runReplayDates(SDWorldChronologyEngine.scopedReplayDates(selectedDate, 'year', model), playYear);
        const scrub = () => { stopReplay(); clearTimeout(scrubTimer); selectedDate = SDWorldChronologyEngine.dateAtPosition(slider.value, model); updateControls(); scrubTimer = setTimeout(() => { showDate(selectedDate).catch(() => { status.textContent = 'Historical reconstruction failed safely.'; }); }, 120); };
        const commitScrub = () => { stopReplay(); clearTimeout(scrubTimer); selectedDate = SDWorldChronologyEngine.dateAtPosition(slider.value, model); showDate(selectedDate).catch(() => { status.textContent = 'Historical reconstruction failed safely.'; }); };
        const step = delta => { stopReplay(); showDate(SDWorldChronologyEngine.offsetDate(selectedDate, delta, model)).catch(() => { status.textContent = 'Historical reconstruction failed safely.'; }); };
        const calendarStep = options => { stopReplay(); showDate(SDWorldChronologyEngine.calendarShift(selectedDate, options, model)).catch(() => { status.textContent = 'Historical reconstruction failed safely.'; }); };
        const goNow = () => { stopReplay(); showDate(model.endDate).catch(() => { status.textContent = 'Unable to restore the live world.'; }); };
        const markComparison = () => { compareBeforeDate = selectedDate; if (compareNode) { compareNode.replaceChildren(); const strong = document.createElement('strong'); strong.textContent = 'Before: '; compareNode.append(strong, document.createTextNode(`${compareBeforeDate}. Move to another date and choose Compare here.`)); } };
        const compareCurrent = async () => {
            if (!compareBeforeDate) { markComparison(); return; }
            stopReplay(); const token = ++operation, beforeDate = compareBeforeDate, afterDate = selectedDate; if (compareNode) compareNode.textContent = `Comparing ${beforeDate} → ${afterDate}…`;
            try { await refreshCache(); const [before, after] = await Promise.all([snapshotFor(beforeDate), snapshotFor(afterDate)]); if (destroyed || token !== operation) return; const comparison = compareSnapshots(before, after); if (compareNode) { compareNode.replaceChildren(); const strong = document.createElement('strong'); strong.textContent = `${comparison.beforeDate} → ${comparison.afterDate}`; const text = document.createTextNode(` · ${comparison.rows.map(([label, value]) => `${label} ${value}`).join(' · ')}`); compareNode.append(strong, text); } }
            catch (_error) { if (compareNode) compareNode.textContent = 'Before/after comparison failed safely.'; }
        };
        const listeners = [
            [slider, 'input', scrub], [slider, 'change', commitScrub], [back, 'click', () => step(-1)], [forward, 'click', () => step(1)],
            [monthBack, 'click', () => calendarStep({ months: -1 })], [monthForward, 'click', () => calendarStep({ months: 1 })], [yearBack, 'click', () => calendarStep({ years: -1 })], [yearForward, 'click', () => calendarStep({ years: 1 })],
            [play, 'click', beginReplay], [playMonth, 'click', beginMonthReplay], [playYear, 'click', beginYearReplay], [markBefore, 'click', markComparison], [compareHere, 'click', compareCurrent], [nowButton, 'click', goNow]
        ].filter(([node]) => node);
        for (const [node, type, handler] of listeners) node.addEventListener(type, handler);
        selectedDate = initialSnapshot.date; updateControls();
        return Object.freeze({
            showDate, provenance,
            async refreshSource(preferredDate = selectedDate) {
                if (destroyed) return false;
                stopReplay();
                await refreshCache();
                const nextDate = SDWorldChronologyEngine.clampDate(preferredDate, model);
                return showDate(nextDate);
            },
            destroy() { destroyed = true; operation += 1; replay += 1; pendingReconstruction?.abort?.(); clearTimeout(scrubTimer); for (const [node, type, handler] of listeners) node.removeEventListener(type, handler); }
        });
    }
    function activate(context = {}) {
        const pane = context.pane;
        if (!pane?.classList.contains('on') || pane.hidden || mounted) return;
        if (mount(context)) void render(context);
    }
    async function render(context = {}) {
        const pane = context.pane || activePane, root = ensureMounted(pane);
        if (!root || !API)
            return;
        const revision = ++renderRevision, status = key => root.querySelector(`[data-world-status="${key}"] span`), identityValue = status('identity'), planetValue = status('planet'), geometryValue = status('geometry'), ecologyValue = status('ecology'), landscapeValue = status('landscape'), projectionValue = status('projection'), habitatValue = status('habitat'), historyValue = status('history'), storageValue = status('storage'), rendererValue = status('renderer'), atmosphereValue = status('atmosphere'), wildlifeValue = status('wildlife'), discoveriesValue = status('discoveries'), projectionBadge = root.querySelector('[data-world-render-badge="projection"]'), stage = root.querySelector('.world-pass8-stage');
        if (rendererValue)
            rendererValue.textContent = 'Preparing an isolated planet view';
        if (atmosphereValue)
            atmosphereValue.textContent = `PlanetaryAtmosphereState.v${SDWorldPlanetAtmosphereEngine.version} · analytic sunlight and spherical weather · transient/not persisted`;
        if (wildlifeValue)
            wildlifeValue.textContent = `PlanetaryWildlifeState.v${SDWorldPlanetWildlifeEngine.version} · radial ground/flight/perch contracts · transient/not persisted`;
        if (discoveriesValue)
            discoveriesValue.textContent = 'Deterministic discoveries awaiting current ecological/calendar state';
        if (storageValue)
            storageValue.textContent = `${Persistence.namespace} · v2 identity + spherical camera/view · no Timer projection state · historical checkpoints/snapshots remain rebuildable memory caches`;
        try {
            const identity = getWorldIdentity();
            if (identityValue)
                identityValue.textContent = `PlanetIdentity.v${identity.contract.version} · seed ${identity.seed.slice(0, 12)}… · generator ${identity.planetGeneratorEngineVersion} · simulation ${identity.simulationVersion} · ${identity.migratedFromV1 ? 'seed copied from frozen v1 · ' : ''}${identity.persisted ? 'persistent' : 'session-only fallback'}`;
            if (planetValue) {
                const planet = identity.planet;
                planetValue.textContent = `Radius ${(planet.radiusMeters / 1000).toFixed(0)} km · circumference ${(planet.circumferenceMeters / 1000).toFixed(1)} km · surface ${(planet.surfaceAreaSquareMeters / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 })} km²`;
            }
            const planet = await getSphericalPlanet(), snapshot = await buildCurrentSnapshot(planet), historyCache = await getChronologyCache(planet);
            if (revision !== renderRevision || !mounted || activePane !== pane)
                return;
            if (geometryValue)
                geometryValue.textContent = `${planet.cellCount} canonical spherical cells · ${planet.fingerprint} · ${planet.ecology.regions.length} global ecological regions · stable natural anchors at level ${SDWorldPlanetNaturalEngine.limits.anchorLevel}`;
            paintSnapshot(root, snapshot);
            await startRenderer(root, planet, revision, snapshot);
            if (revision !== renderRevision || !mounted || activePane !== pane || !rendererRuntime) return;
            historyController = installHistory(root, planet, historyCache, snapshot, revision);
        }
        catch (_error) {
            if (revision !== renderRevision || !mounted || activePane !== pane) return;
            destroyRenderer();
            if (revision === renderRevision && mounted && activePane === pane) {
                if (stage)
                    stage.dataset.renderState = 'failed';
                if (rendererValue)
                    rendererValue.textContent = 'Renderer unavailable · failed safely';
                if (geometryValue)
                    geometryValue.textContent = 'World geometry unavailable · failed safely';
                if (ecologyValue)
                    ecologyValue.textContent = 'Ecological state unavailable · failed safely';
                if (landscapeValue)
                    landscapeValue.textContent = 'Living landscape unavailable · failed safely';
                if (atmosphereValue)
                    atmosphereValue.textContent = 'Atmosphere unavailable · failed safely';
                if (wildlifeValue)
                    wildlifeValue.textContent = 'Wildlife state unavailable · failed safely';
                if (discoveriesValue)
                    discoveriesValue.textContent = 'Discovery state unavailable · failed safely';
                if (projectionValue)
                    projectionValue.textContent = 'Render projection unavailable · no GPU state committed';
                if (habitatValue)
                    habitatValue.textContent = 'No derived habitat state committed';
                if (historyValue)
                    historyValue.textContent = 'Behaviour foundation unavailable · failed safely';
                if (projectionBadge)
                    projectionBadge.textContent = 'Projection unavailable';
                paintVector(root, null);
            }
        }
    }
    function setup(api) {
        if (!api || !api.ui || typeof api.ui.registerTab !== 'function')
            return false;
        const hadStyle = Boolean(document.getElementById(STYLE_ID));
        try {
            API = Object.freeze({ registerTab: api.ui.registerTab });
            installStyle();
            const registered = API.registerTab({ id: 'world', label: 'Living World', icon: '◌', render: activate, ready: () => true }) === true;
            const pane = document.getElementById('pane-world');
            const observer = new MutationObserver(() => {
                if (mounted && (!pane.classList.contains('on') || pane.hidden)) unmount({ pane });
            });
            observer.observe(pane, { attributes: true, attributeFilter: ['class', 'hidden'] });
            if (!registered) throw new Error('Living World tab registration did not complete.');
            return true;
        }
        catch (_error) {
            destroyHistory(); destroyRenderer();
            API = null; activePane = null; mounted = false;
            if (!hadStyle) { try { document.getElementById(STYLE_ID)?.remove?.(); } catch (_cleanupError) {} }
            return false;
        }
    }
    function init() {
        if (!window.StudyDirector || typeof window.StudyDirector.registerPlugin !== 'function')
            return null;
        try {
            return window.StudyDirector.registerPlugin(Object.freeze({
                name: PLUGIN_NAME, version: PLUGIN_VERSION, requires: Object.freeze({ pluginApi: 1, tabRegistry: 1 }), setup
            })) === true;
        }
        catch (_error) { return false; }
    }
    if (init() === null)
        window.addEventListener(READY_EVENT, () => { try { init(); } catch (_error) {} }, { once: true });
})();
