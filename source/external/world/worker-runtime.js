// This module owns one worker asset. It has no access to the host asset policy.
const SDWorldWorkerRuntime = (() => {
    'use strict';
    const filename = '@@SD_WORLD_PLANET_WORKER_FILENAME@@';
    let policy = null;
    function approvedURL(value) {
        const expected = new URL(filename, globalThis.location.href);
        const candidate = new URL(String(value), globalThis.location.href);
        if (expected.origin !== globalThis.location.origin || candidate.href !== expected.href)
            throw new TypeError('Unapproved Living World worker.');
        return expected.href;
    }
    function WorkerPort(url, options) {
        const approved = approvedURL(url);
        if (globalThis.trustedTypes && !policy)
            policy = globalThis.trustedTypes.createPolicy('sd-world-worker', { createScriptURL: approvedURL });
        return new globalThis.Worker(policy ? policy.createScriptURL(approved) : approved, options);
    }
    return Object.freeze({ Worker: WorkerPort });
})();
