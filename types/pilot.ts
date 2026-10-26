// Transitional declaration of the existing JS registry, limited to checked modules.
// The registry implementation remains unchecked until its implementation phase; its runtime contract
// is covered by internal-modules and the pilot boundary tests.
export interface CanonicalModule {
  readonly format: 'study-director.canonical';
  readonly contractVersion: 1;
  signature(input: unknown): string | undefined;
  same(a: unknown, b: unknown): boolean;
}
export interface FlushOptions { readonly strict?: boolean; readonly backupCapture?: boolean }
export type SaveState = 'saving' | 'saved' | 'error';
export interface SaveEnvironment {
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(handle: number): void;
}
export interface LaneInput<T, R> {
  readonly label: string;
  readonly write: (value: T, options: FlushOptions) => R | PromiseLike<R>;
  readonly onState: (state: SaveState, error: unknown) => void;
  readonly environment: Readonly<SaveEnvironment>;
}
export interface SaveLane<T, R> {
  schedule(value: T): boolean;
  flush(options?: FlushOptions): Promise<R | void>;
  cancel(): void;
  pending(): boolean;
  writing(): boolean;
  tail(): Promise<R | void>;
  settled(): Promise<boolean>;
  failure(): Readonly<{error: unknown; message: string}> | null;
}
export interface SaveLaneModule {
  readonly format: 'study-director.save-lane-module';
  readonly contractVersion: 1;
  readonly DELAY_MS: 250;
  readonly RETRY_DELAYS_MS: readonly number[];
  createLane<T, R>(input: Readonly<LaneInput<T, R>>): Readonly<SaveLane<T, R>>;
  failureMessage(label: string, error: unknown): string;
  onBeforeFlush(callback: () => void): void;
  prepareFlush(): void;
}
export interface PilotModules { canonical: CanonicalModule; 'save-lane': SaveLaneModule }
export interface PilotRegistry {
  readonly format: 'study-director.internal-module-registry';
  readonly version: 1;
  readonly contracts: {
    exactFrozenObject<T>(input: T, keys: readonly string[], label: string): T;
  };
  define<K extends keyof PilotModules>(name: K, version: 1, factory: () => PilotModules[K]): boolean;
  require<K extends keyof PilotModules>(name: K, version: 1): Readonly<PilotModules[K]>;
  load<K extends keyof PilotModules>(name: K, version: 1, format: PilotModules[K]['format'], contractVersion: 1): Readonly<PilotModules[K]>;
}
