// Browser fixtures must make an explicit restore decision. An empty decision
// object keeps local deletions; it does not mean "restore everything".
export function chooseIncomingBackup(options, overrides = {}) {
  return Object.fromEntries((options.groups || []).map(group => {
    const incoming = group.choices.find(choice => /_incoming$/.test(choice.value));
    return [group.id, overrides[group.id] ?? incoming?.value ?? group.defaultValue];
  }));
}

// Keep the actual host argument conversion and pass ordinary dialogs through.
export function withBackupFixtureChoices(html) {
  const call = 'Interactions.configure(';
  if (html.split(call).length !== 2) throw new Error('Expected one host backup configuration call.');
  return html.replace(call, `(options => window.restoreChoices
    ? Promise.resolve(typeof window.restoreChoices === 'function' ? window.restoreChoices(options) : window.restoreChoices)
    : Interactions.configure(options))(`);
}
