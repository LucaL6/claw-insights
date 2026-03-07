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
        getSystemMetrics: vi
          .fn()
          .mockResolvedValue({
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
        getUsageCost: vi
          .fn()
          .mockResolvedValue({
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
    const sourceRoot = await (resolvers.QueryContext!.source as any)(contextRoot, {});
    const v2 = await (resolvers.SourceNamespace!.sessions as any)(sourceRoot, {});

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
    const sourceRoot = await (resolvers.QueryContext!.source as any)(contextRoot, {});
    await expect(
      (resolvers.SourceNamespace!.sessionTranscript as any)(sourceRoot, { sessionKey: 's1', before: 'a', after: 'b' }),
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
    const sourceRoot = await (resolvers.QueryContext!.source as any)(contextRoot, {});
    await expect(
      (resolvers.SourceNamespace!.sessionTranscript as any)(sourceRoot, {
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
    const sourceRoot = await (resolvers.QueryContext!.source as any)(contextRoot, {});
    const v2 = await (resolvers.SourceNamespace!.metrics as any)(sourceRoot, { range: 'ONE_HOUR' });

    expect(v1.warnings).toEqual(['validator warning']);
    expect(v2.warnings).toEqual(v1.warnings);
  });

  it('recentLogs parity: unknown levels normalize to INFO in v1 and v2', async () => {
    const ctx = createMockCtx();
    const resolvers = createResolvers(ctx);

    const v1 = await (resolvers.Query!.recentLogs as any)({}, { count: 1 });
    const contextRoot = await (resolvers.Query!.context as any)({}, {});
    const sourceRoot = await (resolvers.QueryContext!.source as any)(contextRoot, {});
    const v2 = await (resolvers.SourceNamespace!.recentLogs as any)(sourceRoot, { count: 1 });

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
    const sourceRoot = await (resolvers.QueryContext!.source as any)(contextRoot, {});
    await expect(
      (resolvers.SourceNamespace!.sessionTranscript as any)(sourceRoot, { sessionKey: 's1' }),
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
    const sourceRoot = await (resolvers.QueryContext!.source as any)(contextRoot, {});
    await expect(
      (resolvers.SourceNamespace!.sessionTranscript as any)(sourceRoot, { sessionKey: 's1' }),
    ).rejects.toMatchObject({
      extensions: { code: 'TRANSCRIPT_READ_ERROR' },
    });
  });

  it('createResolvers(ctx) production assembly smoke', async () => {
    const ctx = createMockCtx();
    const resolvers = createResolvers(ctx);

    expect(resolvers.Query).toBeTruthy();
    expect(typeof resolvers.Query?.context).toBe('function');

    const contextRoot = await (resolvers.Query!.context as any)({}, {});
    const systemRoot = await (resolvers.QueryContext!.system as any)(contextRoot, {});
    const resources = await (resolvers.SystemNamespace!.resources as any)(systemRoot, {});

    expect(resources).toMatchObject({ cpu: 1, memoryMB: 1, diskMB: 1 });
  });
});
