export {};
declare const scope: DedicatedWorkerGlobalScope;
void scope.addEventListener;
// @ts-expect-error -- worker code has no DOM document.
void document;
// @ts-expect-error -- worker code has no Node process.
void process;
