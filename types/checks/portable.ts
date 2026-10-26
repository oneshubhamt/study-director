export {};
const value: unknown = JSON.parse('{}');
void value;
// @ts-expect-error -- portable contracts have no DOM.
void document;
// @ts-expect-error -- portable contracts have no workers.
void postMessage;
// @ts-expect-error -- portable contracts have no Node globals.
void process;
