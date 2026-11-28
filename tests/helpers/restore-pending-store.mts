import type {PendingHooks, PendingRecord, PendingStoreInput} from '../../types/provider-pending.ts';

// Reopen the production pending store against the same persisted metadata.
export function restorePendingStore(host: {createPendingStore(input: PendingStoreInput): PendingHooks}, sourceRevision: string) {
  let persisted: PendingRecord | null = null;
  const input: PendingStoreInput = {
    sourceRevision: () => sourceRevision,
    diagnostics: {capture: (_scope, error) => { throw error; }},
    storage: {
      read: async () => structuredClone(persisted),
      write: async value => { persisted = structuredClone(value); },
      remove: async () => { persisted = null; }
    }
  };
  Object.freeze(input.storage);
  Object.freeze(input.diagnostics);
  Object.freeze(input);
  return () => host.createPendingStore(input);
}
