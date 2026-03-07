export const SCHEMA_V2_FLAG_DOC =
  'build-level toggle for current phase (requires restart/rebuild; not instant runtime rollback)';

export type FeatureFlags = {
  /**
   * Build-level rollback toggle for current migration phase.
   *
   * This is intentionally not an instant runtime switch yet.
   * Changing it requires restart/rebuild in local dev/test.
   */
  schemaV2Enabled: boolean;
};

type FeatureFlagEnv = Pick<ImportMetaEnv, 'VITE_SCHEMA_V2_ENABLED'>;

const isEnabled = (value: string | undefined): boolean => value === 'true';

export const getFeatureFlags = (env: Partial<FeatureFlagEnv> = import.meta.env): FeatureFlags => ({
  schemaV2Enabled: isEnabled(env.VITE_SCHEMA_V2_ENABLED),
});

export const isSchemaV2Enabled = (env: Partial<FeatureFlagEnv> = import.meta.env): boolean =>
  getFeatureFlags(env).schemaV2Enabled;
