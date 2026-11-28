import type {BackupRecoveryHostModule} from '../../source/core/backup-recovery-host.ts';
import type {PendingRecord, PendingStoreInput} from '../../types/backup-recovery-host.ts';

// Reopen the production pending store against the same persisted metadata.
export function restorePendingStore(host: BackupRecoveryHostModule, sourceRevision: string) {
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
