// The policy never leaves this module. TrustedHTML is used only in a detached
// document; callers must apply their schema/allowlist before inserting nodes.
let detachedDoc: Document | null = null;
let policy: any;

function getDetachedDoc(): Document {
  if (typeof document != 'object' || !document.implementation)
    throw new Error('Trying to parse an HTML string in a non-browser context.');
  return detachedDoc || (detachedDoc = document.implementation.createHTMLDocument('title'));
}

export function parseInertHTML(html: string): HTMLElement {
  const doc = getDetachedDoc();
  const types = (globalThis as any).trustedTypes;
  if (types && !policy) policy = types.createPolicy('sd-inert-html', {createHTML: (value: string) => value});
  const root = doc.createElement('div');
  root.innerHTML = types ? policy.createHTML(html) : html;
  return root;
}
