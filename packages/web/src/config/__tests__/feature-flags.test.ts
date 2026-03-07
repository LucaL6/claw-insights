import { describe, expect, it, vi } from 'vitest';

describe('feature flags', () => {
  it('defaults schema v2 flag to false', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SCHEMA_V2_ENABLED', undefined);

    const { getFeatureFlags, isSchemaV2Enabled } = await import('../feature-flags');

    expect(getFeatureFlags().schemaV2Enabled).toBe(false);
    expect(isSchemaV2Enabled()).toBe(false);
  });

  it('parses VITE_SCHEMA_V2_ENABLED=true as enabled', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SCHEMA_V2_ENABLED', 'true');

    const { getFeatureFlags, isSchemaV2Enabled } = await import('../feature-flags');

    expect(getFeatureFlags().schemaV2Enabled).toBe(true);
    expect(isSchemaV2Enabled()).toBe(true);
  });

  it('documents current phase as build-level toggle, not instant runtime rollback', async () => {
    vi.resetModules();
    const { SCHEMA_V2_FLAG_DOC } = await import('../feature-flags');

    expect(SCHEMA_V2_FLAG_DOC).toContain('build-level');
    expect(SCHEMA_V2_FLAG_DOC).toContain('restart');
  });
});
