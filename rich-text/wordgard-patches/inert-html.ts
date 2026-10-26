// The policy never leaves this module. TrustedHTML is used only in a detached
// document; callers must apply their schema/allowlist before inserting nodes.
let detachedDoc: Document | null = null;
// Native Trusted Types objects are opaque; only the detached HTML sink consumes them.
type HTMLPolicy={createHTML(value:string):unknown};
type TrustedTypesFactory={createPolicy(name:string,rules:{createHTML(value:string):string}):HTMLPolicy};
let policy: HTMLPolicy | undefined;

function getDetachedDoc(): Document {
  if (typeof document != 'object' || !document.implementation)
    throw new Error('Trying to parse an HTML string in a non-browser context.');
  return detachedDoc || (detachedDoc = document.implementation.createHTMLDocument('title'));
}

export function parseInertHTML(html: string): HTMLElement {
  const doc = getDetachedDoc();
  const types = (globalThis as typeof globalThis & {trustedTypes?:TrustedTypesFactory}).trustedTypes;
  if (types && !policy) policy = types.createPolicy('sd-inert-html', {createHTML: (value: string) => value});
  const root = doc.createElement('div');
  root.innerHTML = types && policy ? policy.createHTML(html) as string : html;
  return root;
}
