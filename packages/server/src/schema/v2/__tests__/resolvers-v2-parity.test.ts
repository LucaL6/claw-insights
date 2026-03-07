import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context.js';
import { readTranscript } from '../../../sources/readers/transcript-reader.js';
import { createResolvers } from '../../resolvers/index.js';

vi.mock('../../../sources/readers/transcript-reader.js', () => ({
  readTranscript: vi.fn(),
}));

function createMockCtx(): AppContext {
  return {
    db: {},
    ports: {
      sessions: {
        getSessions: vi.fn().mockReturnValue([
          {
            key: 'root',
            displayName: 'Root',
            kind: 'direct',
            model: 'gpt-5',
            channel: 'webchat',
            totalTokens: 10,
            contextTokens: 1,
            usagePercent: 1,
            status: 'ACTIVE',
            updatedAt: Date.now(),
            turnCount: 1,
            subAgents: [
              {
                key: 'root:subagent:abc',
                displayName: 'Sub',
                kind: 'subagent',
                model: 'gpt-5',
                channel: 'webchat',
                totalTokens: 2,
                contextTokens: 1,
                usagePercent: 1,
                status: 'DONE',
                updatedAt: Date.now(),
                turnCount: 1,
                subAgents: [],
              },
            ],
          },
        ]),
        getSessionById: vi.fn().mockReturnValue({ key: 'root', displayName: 'Root', subAgents: [] }),
      },
      metrics: {
        getMetrics: vi.fn().mockReturnValue({
          date: '2026-03-05',
          range: 'ONE_HOUR',
          bucketMinutes: 60,
          timezone: 'UTC',
          buckets: [],
          totalTokensK: 1,
          rangeTokensK: 1,
          totalErrors: 0,
          totalWarnings: 1,
          uptimePercent: 100,
          totalTurns: 1,
          warnings: ['port warning'],
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
      logs: {
        getRecentLogs: vi
          .fn()
          .mockReturnValue([{ timestamp: 0, level: 'mystery', source: 'sampler', message: 'hello' }]),
      },
      system: {
        getSystemMetrics: vi.fn().mockResolvedValue({
          cpu: 1,
          memoryMB: 1,
          diskMB: 1,
          uptime: '1h',
          platform: 'darwin',
          nodeVersion: process.version,
        }),
      },
      lifetime: {
        getStats: vi.fn().mockReturnValue({
          isReady: true,
          createdAt: new Date().toISOString(),
          daysSinceCreation: 1,
          totalSessions: 1,
          totalInputTokens: 1,
          totalOutputTokens: 1,
          totalCacheReadTokens: 1,
          totalCacheWriteTokens: 1,
          totalTokens: 4,
          totalUserMessages: 1,
          totalAssistantMessages: 1,
        }),
      },
      transcript: { getTranscriptPath: vi.fn().mockReturnValue('/tmp/not-used.jsonl') },
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
    dataValidator: { runValidation: vi.fn().mockReturnValue([{ pass: false, message: 'validator warning' }]) },
  } as unknown as AppContext;
}

describe('v2 resolver parity + guards', () => {
  const readTranscriptMock = vi.mocked(readTranscript);

  beforeEach(() => {
    readTranscriptMock.mockReset();
  });

  it('hierarchy parity: v1 sessions equals v2 context.source.sessions', async () => {
    const ctx = createMockCtx();
    const resolvers = createResolvers(ctx);

    const v1 = await (resolvers.Query!.sessions as any)({}, {});
    const contextRoot = await (resolvers.Query!.context as any)({}, {});
    const sourceRoot = await (resolvers.LegacyContextNamespace!.source as any)(contextRoot, {});
    const v2 = await (resolvers.AgentNamespace!.sessions as any)(sourceRoot, {});

    expect(v2).toEqual(v1);
  });

  it('transcript before+after throws BAD_USER_INPUT in v1 and v2 when transcript exists', async () => {
    const ctx = createMockCtx();
    const resolvers = createResolvers(ctx);

    await expect(
      (resolvers.Query!.sessionTranscript as any)({}, { sessionKey: 's1', before: 'a', after: 'b' }),
    ).rejects.toMatchObject({
      extensions: { code: 'BAD_USER_INPUT' },
    });

    const contextRoot = await (resolvers.Query!.context as any)({}, {});
    const sourceRoot = await (resolvers.LegacyContextNamespace!.source as any)(contextRoot, {});
    await expect(
      (resolvers.AgentNamespace!.sessionTranscript as any)(sourceRoot, { sessionKey: 's1', before: 'a', after: 'b' }),
    ).rejects.toMatchObject({
      extensions: { code: 'BAD_USER_INPUT' },
    });
  });

  it('transcript parity: missing transcript returns null even with before+after in v1 and v2', async () => {
    const ctx = createMockCtx();
    ctx.ports.transcript.getTranscriptPath = vi.fn().mockReturnValue(null);

    const resolvers = createResolvers(ctx);

    await expect(
      (resolvers.Query!.sessionTranscript as any)({}, { sessionKey: 'missing', before: 'a', after: 'b' }),
    ).resolves.toBeNull();

    const contextRoot = await (resolvers.Query!.context as any)({}, {});
    const sourceRoot = await (resolvers.LegacyContextNamespace!.source as any)(contextRoot, {});
    await expect(
      (resolvers.AgentNamespace!.sessionTranscript as any)(sourceRoot, {
        sessionKey: 'missing',
        before: 'a',
        after: 'b',
      }),
    ).resolves.toBeNull();
  });

  it('metrics parity: v1 and v2 use validator warnings', async () => {
    const ctx = createMockCtx();
    const resolvers = createResolvers(ctx);

    const v1 = await (resolvers.Query!.metrics as any)({}, { range: 'ONE_HOUR' });
    const contextRoot = await (resolvers.Query!.context as any)({}, {});
    const sourceRoot = await (resolvers.LegacyContextNamespace!.source as any)(contextRoot, {});
    const v2 = await (resolvers.AgentNamespace!.metrics as any)(sourceRoot, { range: 'ONE_HOUR' });

    expect(v1.warnings).toEqual(['validator warning']);
    expect(v2.warnings).toEqual(v1.warnings);
  });

  it('recentLogs parity: unknown levels normalize to INFO in v1 and v2', async () => {
    const ctx = createMockCtx();
    const resolvers = createResolvers(ctx);

    const v1 = await (resolvers.Query!.recentLogs as any)({}, { count: 1 });
    const contextRoot = await (resolvers.Query!.context as any)({}, {});
    const sourceRoot = await (resolvers.LegacyContextNamespace!.source as any)(contextRoot, {});
    const v2 = await (resolvers.AgentNamespace!.recentLogs as any)(sourceRoot, { count: 1 });

    expect(v1[0].level).toBe('INFO');
    expect(v2[0].level).toBe(v1[0].level);
  });

  it('transcript parity: file-too-large maps to TRANSCRIPT_TOO_LARGE in v1 and v2', async () => {
    readTranscriptMock.mockRejectedValue(new Error('File too large: 60000000 bytes (max 52428800)'));

    const ctx = createMockCtx();
    const resolvers = createResolvers(ctx);

    await expect((resolvers.Query!.sessionTranscript as any)({}, { sessionKey: 's1' })).rejects.toMatchObject({
      extensions: { code: 'TRANSCRIPT_TOO_LARGE' },
    });

    const contextRoot = await (resolvers.Query!.context as any)({}, {});
    const sourceRoot = await (resolvers.LegacyContextNamespace!.source as any)(contextRoot, {});
    await expect(
      (resolvers.AgentNamespace!.sessionTranscript as any)(sourceRoot, { sessionKey: 's1' }),
    ).rejects.toMatchObject({
      extensions: { code: 'TRANSCRIPT_TOO_LARGE' },
    });
  });

  it('transcript parity: generic read errors map to TRANSCRIPT_READ_ERROR in v1 and v2', async () => {
    readTranscriptMock.mockRejectedValue(new Error('boom'));

    const ctx = createMockCtx();
    const resolvers = createResolvers(ctx);

    await expect((resolvers.Query!.sessionTranscript as any)({}, { sessionKey: 's1' })).rejects.toMatchObject({
      extensions: { code: 'TRANSCRIPT_READ_ERROR' },
    });

    const contextRoot = await (resolvers.Query!.context as any)({}, {});
    const sourceRoot = await (resolvers.LegacyContextNamespace!.source as any)(contextRoot, {});
    await expect(
      (resolvers.AgentNamespace!.sessionTranscript as any)(sourceRoot, { sessionKey: 's1' }),
    ).rejects.toMatchObject({
      extensions: { code: 'TRANSCRIPT_READ_ERROR' },
    });
  });

  it('canonical parity: Query.source(selector) matches v1 source-root fields', async () => {
    const ctx = createMockCtx();
    const resolvers = createResolvers(ctx);
    const gqlCtx = {};

    const sourceRoot = await (resolvers.Query!.source as any)({}, { selector: { id: 'agent:main' } }, gqlCtx);
    expect(sourceRoot).toBeTruthy();

    const v1Sessions = await (resolvers.Query!.sessions as any)({}, {});
    const v2Sessions = await (resolvers.AgentNamespace!.sessions as any)(sourceRoot, {}, gqlCtx);
    expect(v2Sessions).toEqual(v1Sessions);

    const v1Metrics = await (resolvers.Query!.metrics as any)({}, { range: 'ONE_HOUR' });
    const v2Metrics = await (resolvers.AgentNamespace!.metrics as any)(sourceRoot, { range: 'ONE_HOUR' }, gqlCtx);
    expect(v2Metrics).toEqual(v1Metrics);

    const v1Logs = await (resolvers.Query!.recentLogs as any)({}, { count: 1 });
    const v2Logs = await (resolvers.AgentNamespace!.recentLogs as any)(sourceRoot, { count: 1 }, gqlCtx);
    expect(v2Logs).toEqual(v1Logs);
  });

  it('canonical parity: Query.system(context) matches v1 gateway/resources/channels', async () => {
    const ctx = createMockCtx();
    const resolvers = createResolvers(ctx);
    const gqlCtx = {};

    const systemRoot = await (resolvers.Query!.system as any)({}, {}, gqlCtx);

    const v1Gateway = await (resolvers.Query!.gateway as any)({}, {}, gqlCtx);
    const v2Gateway = await (resolvers.OpenClawSystem!.gateway as any)(systemRoot, {}, gqlCtx);
    expect(v2Gateway).toEqual(v1Gateway);

    const v1Resources = await (resolvers.Query!.resources as any)({}, {}, gqlCtx);
    const v2Resources = await (resolvers.OpenClawSystem!.resources as any)(systemRoot, {}, gqlCtx);
    expect(v2Resources).toEqual(v1Resources);

    const v1Channels = await (resolvers.Query!.channels as any)({}, {}, gqlCtx);
    const v2Channels = await (resolvers.OpenClawSystem!.channels as any)(systemRoot, {}, gqlCtx);
    expect(v2Channels).toEqual(v1Channels);
  });

  it('compat alias parity: context.source.gateway and context.system.gateway share one gateway snapshot', async () => {
    const ctx = createMockCtx();
    const resolvers = createResolvers(ctx);
    const gqlCtx = {};

    const contextRoot = await (resolvers.Query!.context as any)({}, {}, gqlCtx);
    const sourceRoot = await (resolvers.LegacyContextNamespace!.source as any)(contextRoot, {}, gqlCtx);
    const systemRoot = await (resolvers.LegacyContextNamespace!.system as any)(contextRoot, {}, gqlCtx);

    const aliasGateway = await (resolvers.AgentNamespace!.gateway as any)(sourceRoot, {}, gqlCtx);
    const canonicalGateway = await (resolvers.OpenClawSystem!.gateway as any)(systemRoot, {}, gqlCtx);

    expect(aliasGateway).toEqual(canonicalGateway);
    expect(ctx.ports.gateway.getGatewayStatus).toHaveBeenCalledTimes(1);
  });

  it('createResolvers(ctx) production assembly smoke', async () => {
    const ctx = createMockCtx();
    const resolvers = createResolvers(ctx);

    expect(resolvers.Query).toBeTruthy();
    expect(typeof resolvers.Query?.context).toBe('function');

    const contextRoot = await (resolvers.Query!.context as any)({}, {});
    const systemRoot = await (resolvers.LegacyContextNamespace!.system as any)(contextRoot, {});
    const resources = await (resolvers.OpenClawSystem!.resources as any)(systemRoot, {});

    expect(resources).toMatchObject({ cpu: 1, memoryMB: 1, diskMB: 1 });
  });
});
