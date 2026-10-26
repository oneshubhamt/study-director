import {readFileSync} from 'node:fs';
void readFileSync;
// @ts-expect-error -- Node tools must not depend on a browser document.
void document;
// @ts-expect-error -- Node tools must not depend on service-worker globals.
void clients;
