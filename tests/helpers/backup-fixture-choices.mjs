// Browser fixtures must make an explicit restore decision. An empty decision
// object keeps local deletions; it does not mean "restore everything".
export function chooseIncomingBackup(options, overrides = {}) {
  return Object.fromEntries((options.groups || []).map(group => {
    const incoming = group.choices.find(choice => /_incoming$/.test(choice.value));
    return [group.id, overrides[group.id] ?? incoming?.value ?? group.defaultValue];
  }));
}

export const configureFixtureHook = 'configure:options=>window.restoreChoices?Promise.resolve(typeof window.restoreChoices===\'function\'?window.restoreChoices(options):window.restoreChoices):Interactions.configure(options)';
