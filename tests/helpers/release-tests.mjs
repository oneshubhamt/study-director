export const RELEASE_TEST_SCRIPTS=Object.freeze([
  'tests/architecture/build/typescript-gates.mjs',
  'tests/architecture/build/syntax-check.mjs',
  'tests/architecture/build/dependency-assurance.mjs',
  'tests/architecture/build/deployment-contract.mjs',
  'tests/integration/rich-text/wg1-codec.mjs',
  'tests/integration/backup/binary-backup-capacity.mjs',
  'tests/integration/search/search-worker-extreme.mjs',
  'tests/architecture/build/rich-text-bundle.mjs',
  'tests/architecture/build/generated-syntax-check.mjs',
  'tests/architecture/build/verify-minified-release.mjs',
  'tests/architecture/build/performance-budgets.mjs',
  'tests/architecture/build/terser-compression-contracts.mjs',
]);

export const RELEASE_TEST_SET=new Set(RELEASE_TEST_SCRIPTS);
