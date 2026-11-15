import type {AssetStorageModule} from '../../source/core/asset-storage.ts';
import type {AttachmentsModule} from '../../source/core/attachments.ts';
import type {BackupModule} from '../../source/core/backup.ts';
import type {BackupIntegrityHostModule} from '../../source/core/backup-integrity-host.ts';
import type {BackupMaintenanceHostModule} from '../../source/core/backup-maintenance-host.ts';
import type {BackupReadinessHostModule} from '../../source/core/backup-readiness-host.ts';
import type {RepositoriesModule} from '../../source/core/repositories.ts';
import type {RepositoriesInput} from '../repositories.ts';
import type {BackgroundMaintenanceInput,RepositoryMaintenanceController} from '../backup-maintenance-host.ts';
import type {BackupIntegrityController,BackupIntegrityInput} from '../backup-integrity-host.ts';
import type {CanonicalCommitController} from '../backup-readiness-host.ts';
import type {MetadataOwners} from '../data-bootstrap-host.ts';

type BackupRuntime=ReturnType<BackupModule['createRuntime']>;
type AppData=ReturnType<RepositoriesModule['createAppData']>;
type AssetStore=ReturnType<AssetStorageModule['create']>;
type References=ReturnType<AttachmentsModule['createReferenceCoordinator']>;

declare const runtime:BackupRuntime;
declare const appData:AppData;
declare const repositoryMaintenance:RepositoryMaintenanceController;
declare const integrity:BackupIntegrityController;
declare const storage:AssetStore;
declare const references:References;
declare const canonical:CanonicalCommitController;
declare const metadataOwners:MetadataOwners;
declare const canonicalEvent:Parameters<RepositoriesInput['hooks']['onCanonicalCommit']>[0];

runtime.providers.configureRepositoryMaintenance(repositoryMaintenance.hooks);
runtime.providers.configureIntegrityScrub(integrity.repositoryHooks);

const backgroundData=Object.freeze({
  maintenance:appData.maintenance,
  notes:appData.notes
}) satisfies BackgroundMaintenanceInput['data'];
void backgroundData;

const providerForeground=runtime.providers satisfies BackgroundMaintenanceInput['foreground']['providers'];
const controllerForeground=runtime.controller satisfies BackgroundMaintenanceInput['foreground']['backupController'];
void providerForeground;void controllerForeground;

const integrityMetadata=Object.freeze({attachment:metadataOwners.HostAppMeta,repository:metadataOwners.BackupAppMeta}) satisfies BackupIntegrityInput['metadata'];
const integrityStorage=storage satisfies BackupIntegrityInput['storage'];
const integrityReferences=references satisfies BackupIntegrityInput['references'];
const integrityProvider=runtime.providers satisfies BackupIntegrityInput['provider'];
void integrityMetadata;void integrityStorage;void integrityReferences;void integrityProvider;

canonical.handle(canonicalEvent);

