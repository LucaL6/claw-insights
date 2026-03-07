/**
 * Phase 1B Contract Alignment Tests
 *
 * Combined coverage from:
 * - CORE track: schema/resolver contract migration
 * - SELECTOR track: selector/filter typed contract + AMBIGUOUS_SELECTOR behavior
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildSchema, type GraphQLInputObjectType, type GraphQLObjectType, type GraphQLUnionType } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context.js';
import { createResolvers } from '../../resolvers/index.js';
import {
  type FilterInput,
  matchFilter,
  resolveSelector,
  type SelectorInput,
  type SourceCategory,
  type SourceEntry,
  type SourceProvider,
  type SourceStatus,
} from '../selector.js';

// ── Schema contract tests ──

const schemaSource = readFileSync(resolve(import.meta.dirname, '../../schema.graphql'), 'utf-8');
const schema = buildSchema(schemaSource);

describe('Phase1B schema contract', () => {
  it('AgentNamespace type exists with expected fields', () => {
    const t = schema.getType('AgentNamespace') as GraphQLObjectType;
    expect(t).toBeTruthy();
    const fields = Object.keys(t.getFields());
    expect(fields).toContain('sessions');
    expect(fields).toContain('metrics');
    expect(fields).toContain('gateway');
    expect(fields).toContain('sessionTranscript');
  });

  it('OpenClawSystem type exists with expected fields', () => {
    const t = schema.getType('OpenClawSystem') as GraphQLObjectType;
    expect(t).toBeTruthy();
    const fields = Object.keys(t.getFields());
    expect(fields).toContain('resources');
    expect(fields).toContain('channels');
  });

  it('LegacyContextNamespace output exists and QueryContext input exists', () => {
    const legacy = schema.getType('LegacyContextNamespace') as GraphQLObjectType;
    expect(legacy).toBeTruthy();
    const legacyFields = Object.keys(legacy.getFields());
    expect(legacyFields).toContain('source');
    expect(legacyFields).toContain('system');

    const queryContext = schema.getType('QueryContext') as GraphQLInputObjectType;
    expect(queryContext).toBeTruthy();
    expect((queryContext as { astNode?: { kind?: string } }).astNode?.kind).toBe('InputObjectTypeDefinition');
  });

  it('SourceNamespace / SystemNamespace union entry types exist', () => {
    const sourceNs = schema.getType('SourceNamespace') as GraphQLUnionType;
    const systemNs = schema.getType('SystemNamespace') as GraphQLUnionType;

    expect(sourceNs).toBeTruthy();
    expect(systemNs).toBeTruthy();
    expect(sourceNs.getTypes().map((t) => t.name)).toContain('AgentNamespace');
    expect(systemNs.getTypes().map((t) => t.name)).toContain('OpenClawSystem');
  });

  it('Query has new A2 root fields: system, sources, source', () => {
    const q = schema.getType('Query') as GraphQLObjectType;
    const fields = q.getFields();
    expect(fields['system']).toBeTruthy();
    expect(fields['sources']).toBeTruthy();
    expect(fields['source']).toBeTruthy();
  });

  it('Query root fields expose context/filter/selector args', () => {
    const q = schema.getType('Query') as GraphQLObjectType;
    const fields = q.getFields();

    expect(fields['system'].args.map((a) => a.name)).toEqual(['context']);
    expect(fields['sources'].args.map((a) => a.name)).toEqual(['filter', 'context']);
    expect(fields['source'].args.map((a) => a.name)).toEqual(['selector', 'context']);
  });

  it('Query.context still exists (deprecated compat)', () => {
    const q = schema.getType('Query') as GraphQLObjectType;
    expect(q.getFields()['context']).toBeTruthy();
    expect(q.getFields()['context'].deprecationReason).toBeTruthy();
  });

  it('ChannelProvider enum includes all supported gateway channel providers', () => {
    const channelProvider = schema.getType('ChannelProvider') as { getValues: () => Array<{ name: string }> };
    expect(channelProvider).toBeTruthy();

    const values = channelProvider.getValues().map((v) => v.name);
    expect(values).toEqual(
      expect.arrayContaining([
        'telegram',
        'slack',
        'discord',
        'webchat',
        'signal',
        'whatsapp',
        'irc',
        'googlechat',
        'imessage',
      ]),
    );
  });
});

// ── Resolver integration tests ──

function createMockCtx(): AppContext {
  return {
    db: {},
    ports: {
      sessions: {
        getSessions: vi.fn().mockReturnValue([]),
        getSessionById: vi.fn().mockReturnValue(null),
      },
      metrics: {
        getMetrics: vi.fn().mockReturnValue({
          date: '2026-03-07',
          range: 'ONE_HOUR',
          bucketMinutes: 60,
          timezone: 'UTC',
          buckets: [],
          totalTokensK: 0,
          rangeTokensK: 0,
          totalErrors: 0,
          totalWarnings: 0,
          uptimePercent: 100,
          totalTurns: 0,
          warnings: [],
        }),
      },
      gateway: {
        getGatewayStatus: vi.fn().mockResolvedValue({
          running: true,
          pid: 1,
          version: '1.0.0',
          updateAvailable: null,
          uptime: '1h',
          startedAt: new Date().toISOString(),
          connectLatencyMs: 1,
          latestVersion: '1.0.0',
          securitySummary: { critical: 0, warn: 0, info: 0 },
          channels: [],
          sessionDefaults: null,
        }),
      },
      cron: { getCronJobs: vi.fn().mockReturnValue([]) },
      logs: { getRecentLogs: vi.fn().mockReturnValue([]) },
      system: {
        getSystemMetrics: vi.fn().mockResolvedValue({
          cpu: 5,
          memoryMB: 100,
          diskMB: 200,
          uptime: '2h',
          platform: 'darwin',
          nodeVersion: process.version,
        }),
      },
      lifetime: {
        getStats: vi.fn().mockReturnValue({
          isReady: true,
          createdAt: new Date().toISOString(),
          daysSinceCreation: 1,
          totalSessions: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCacheReadTokens: 0,
          totalCacheWriteTokens: 0,
          totalTokens: 0,
          totalUserMessages: 0,
          totalAssistantMessages: 0,
        }),
      },
      transcript: { getTranscriptPath: vi.fn().mockReturnValue(null) },
      usage: {
        getUsageCost: vi.fn().mockResolvedValue({
          totalCost: 0,
          totalTokensM: 0,
          todayCost: 0,
          todayTokensM: 0,
          fetchedAt: new Date().toISOString(),
        }),
      },
    },
    dataValidator: { runValidation: vi.fn().mockReturnValue([]) },
  } as unknown as AppContext;
}

describe('Phase1B resolver contract', () => {
  let resolvers: ReturnType<typeof createResolvers>;

  beforeEach(() => {
    resolvers = createResolvers(createMockCtx());
  });

  it('resolver map has AgentNamespace and SourceNamespace (union) keys', () => {
    expect((resolvers as Record<string, unknown>).AgentNamespace).toBeTruthy();
    expect((resolvers as Record<string, unknown>).SourceNamespace).toBeTruthy();
  });

  it('resolver map has OpenClawSystem and SystemNamespace (union) keys', () => {
    expect((resolvers as Record<string, unknown>).OpenClawSystem).toBeTruthy();
    expect((resolvers as Record<string, unknown>).SystemNamespace).toBeTruthy();
  });

  it('resolver map keeps LegacyContextNamespace and has no output QueryContext resolver', () => {
    expect((resolvers as Record<string, unknown>).LegacyContextNamespace).toBeTruthy();
    expect((resolvers as Record<string, unknown>).QueryContext).toBeUndefined();
  });

  it('Query.system resolves OpenClawSystem fields', async () => {
    const systemRoot = await (resolvers.Query!.system as any)({}, {});
    const resources = await (resolvers as any).OpenClawSystem.resources(systemRoot, {});
    expect(resources).toMatchObject({ cpu: 5, memoryMB: 100 });
  });

  it('OpenClawSystem.health resolves non-null health payload', async () => {
    const systemRoot = await (resolvers.Query!.system as any)({}, {});
    const health = await (resolvers as any).OpenClawSystem.health(systemRoot, {});
    expect(health).toMatchObject({
      status: 'DEGRADED',
    });
    expect(Array.isArray(health.checks)).toBe(true);
    expect(health.checks.length).toBeGreaterThan(0);
  });

  it('OpenClawSystem.health falls back to UNHEALTHY instead of throwing on gateway failure', async () => {
    const failingCtx = createMockCtx();
    failingCtx.ports.gateway.getGatewayStatus = vi.fn().mockRejectedValue(new Error('gateway unavailable'));
    const failingResolvers = createResolvers(failingCtx);

    const systemRoot = await (failingResolvers.Query!.system as any)({}, {});
    const health = await (failingResolvers as any).OpenClawSystem.health(systemRoot, {});

    expect(health.status).toBe('UNHEALTHY');
    expect(health.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'gateway', status: 'FAIL' })]),
    );
  });

  it('Query.sources returns DataSource list from registry', async () => {
    const sources = await (resolvers.Query!.sources as any)({}, {});
    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBe(1);
    expect(sources[0]).toMatchObject({
      id: 'agent:main',
      attributes: { category: 'AGENT' },
      status: 'CONNECTED',
    });
  });

  it('Query.source(selector) returns null for unknown id', async () => {
    const result = await (resolvers.Query!.source as any)({}, { selector: { id: 'nonexistent' } });
    expect(result).toBeNull();
  });

  it('Query.source(selector) returns selected namespace root', async () => {
    const result = await (resolvers.Query!.source as any)({}, { selector: { category: 'AGENT' } });
    expect(result).toBeTruthy();
    const sessions = await (resolvers as any).AgentNamespace.sessions(result, {});
    expect(Array.isArray(sessions)).toBe(true);
  });

  it('Query.context legacy compat still works through LegacyContextNamespace', async () => {
    const contextRoot = await (resolvers.Query!.context as any)({}, {});
    const sourceRoot = await (resolvers as any).LegacyContextNamespace.source(contextRoot, {});
    const systemRoot = await (resolvers as any).LegacyContextNamespace.system(contextRoot, {});

    const sessions = await (resolvers as any).AgentNamespace.sessions(sourceRoot, {});
    expect(Array.isArray(sessions)).toBe(true);

    const resources = await (resolvers as any).OpenClawSystem.resources(systemRoot, {});
    expect(resources).toMatchObject({ cpu: 5 });
  });
});

// ── Selector/filter typed contracts (from selector track) ──

describe('Phase1B: selector/filter type contracts', () => {
  it('SourceCategory accepts known literals', () => {
    const cats: SourceCategory[] = ['AGENT', 'KANBAN', 'DASHBOARD', 'CALENDAR', 'INTEGRATION'];
    expect(cats).toHaveLength(5);
  });

  it('SourceCategory is strict enum-aligned union (compile-time guard)', () => {
    // @ts-expect-error category must match schema enum literal set
    const _invalid: SourceCategory = 'CUSTOM_THING';
    expect(true).toBe(true);
  });

  it('SourceProvider accepts known literals', () => {
    const providers: SourceProvider[] = ['openclaw', 'kanban', 'google', 'github'];
    expect(providers).toHaveLength(4);
  });

  it('SourceStatus accepts known literals', () => {
    const statuses: SourceStatus[] = ['INITIALIZING', 'CONNECTED', 'DISCONNECTED', 'ERROR'];
    expect(statuses).toHaveLength(4);
  });

  it('SelectorInput is assignable with typed category/provider', () => {
    const sel: SelectorInput = { category: 'AGENT', provider: 'openclaw' };
    expect(sel.category).toBe('AGENT');
  });

  it('FilterInput is assignable with typed status', () => {
    const f: FilterInput = { status: 'CONNECTED', category: 'KANBAN' };
    expect(f.status).toBe('CONNECTED');
  });
});

describe('Phase1B: AMBIGUOUS_SELECTOR contract', () => {
  const sources: SourceEntry[] = [
    { id: 'a1', name: 'A1', status: 'CONNECTED', attributes: { category: 'AGENT', provider: 'openclaw', tags: [] } },
    { id: 'a2', name: 'A2', status: 'CONNECTED', attributes: { category: 'AGENT', provider: 'openclaw', tags: [] } },
  ];

  it('throws AMBIGUOUS_SELECTOR with correct extension code', () => {
    try {
      resolveSelector(sources, { category: 'AGENT' });
      expect.unreachable('should have thrown');
    } catch (error) {
      const err = error as { message?: string; extensions?: { code?: string; matchedIds?: string[] } };
      expect(err.message).toContain('AMBIGUOUS_SELECTOR');
      expect(err.extensions?.code).toBe('AMBIGUOUS_SELECTOR');
      expect(err.extensions?.matchedIds).toEqual(['a1', 'a2']);
    }
  });

  it('does not throw when selector narrows to single match', () => {
    const result = resolveSelector(sources, { id: 'a1' });
    expect(result?.id).toBe('a1');
  });
});

describe('Phase1B: matchFilter typed contracts', () => {
  const sources: SourceEntry[] = [
    { id: 'k1', name: 'K', status: 'CONNECTED', attributes: { category: 'KANBAN', provider: 'kanban', tags: ['x'] } },
    { id: 'd1', name: 'D', status: 'DISCONNECTED', attributes: { category: 'DASHBOARD', tags: [] } },
  ];

  it('filters by typed category', () => {
    expect(matchFilter(sources, { category: 'KANBAN' })).toHaveLength(1);
  });

  it('filters by typed status', () => {
    expect(matchFilter(sources, { status: 'DISCONNECTED' })).toHaveLength(1);
  });

  it('empty filter returns all', () => {
    expect(matchFilter(sources, {})).toHaveLength(2);
  });
});
