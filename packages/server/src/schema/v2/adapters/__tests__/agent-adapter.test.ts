import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TypedPorts } from '../../../../ports/index.js';
import { readTranscript } from '../../../../sources/readers/transcript-reader.js';
import { createAgentAdapter } from '../agent-adapter.js';

vi.mock('../../../../sources/readers/transcript-reader.js', () => ({
  readTranscript: vi.fn(),
}));

const makeMockPorts = () => ({
  sessions: {
    getSessions: vi.fn().mockReturnValue([{ key: 'test', displayName: 'Test', subAgents: [] }]),
    getSessionById: vi.fn().mockReturnValue({ key: 'test', displayName: 'Test', subAgents: [] }),
  },
  metrics: { getMetrics: vi.fn().mockReturnValue({ date: '2026-03-05', totalTokensK: 0, warnings: [] }) },
  logs: { getRecentLogs: vi.fn().mockReturnValue([]) },
  cron: { getCronJobs: vi.fn().mockReturnValue([]) },
  usage: { getUsageCost: vi.fn().mockReturnValue({ totalCost: 0 }) },
  lifetime: { getStats: vi.fn().mockReturnValue({ isReady: true, totalTokens: 0 }) },
  transcript: { getTranscriptPath: vi.fn().mockReturnValue(null) },
  gateway: {},
  system: {},
});

const makeMockEventsFns = () => ({
  queryEvents: vi.fn().mockReturnValue({ events: [], total: 0, counts: { error: 0, warning: 0, restart: 0 } }),
  getEventDensity: vi.fn().mockReturnValue([]),
  getEventCounts: vi.fn().mockReturnValue({ error: 0, warning: 0, restart: 0 }),
});

describe('createAgentAdapter', () => {
  const readTranscriptMock = vi.mocked(readTranscript);

  beforeEach(() => {
    readTranscriptMock.mockReset();
  });

  it('creates adapter with correct info', () => {
    const adapter = createAgentAdapter(
      'agent:main',
      'Main Agent',
      makeMockPorts() as unknown as TypedPorts,
      makeMockEventsFns(),
      null,
    );
    expect(adapter.info.id).toBe('agent:main');
    expect(adapter.info.name).toBe('Main Agent');
    expect(adapter.info.attributes.category).toBe('AGENT');
    expect(adapter.info.attributes.provider).toBe('openclaw');
    expect(adapter.info.status).toBe('CONNECTED');
  });

  it('has resolvers for all current SourceNamespace fields (except gateway)', () => {
    const adapter = createAgentAdapter(
      'agent:main',
      'Main',
      makeMockPorts() as unknown as TypedPorts,
      makeMockEventsFns(),
      null,
    );
    const expected = [
      'sessions',
      'metrics',
      'recentLogs',
      'cronJobs',
      'usageCost',
      'lifetimeStats',
      'sessionTranscript',
      'events',
      'eventDensity',
      'eventCounts',
    ];
    for (const field of expected) {
      expect(adapter.resolvers).toHaveProperty(field);
    }
  });

  it('sessions resolver calls port with correct signature', () => {
    const ports = makeMockPorts();
    const adapter = createAgentAdapter('agent:main', 'Main', ports as unknown as TypedPorts, makeMockEventsFns(), null);
    adapter.resolvers.sessions({ filter: { activeOnly: true } });
    expect(ports.sessions.getSessions).toHaveBeenCalledWith({ activeOnly: true, sortBy: undefined }, expect.anything());
  });

  it('does not expose a session resolver until schema adds context.source.session', () => {
    const adapter = createAgentAdapter(
      'agent:main',
      'Main',
      makeMockPorts() as unknown as TypedPorts,
      makeMockEventsFns(),
      null,
    );
    expect(adapter.resolvers).not.toHaveProperty('session');
  });

  it('lifetimeStats resolver calls getStats', () => {
    const ports = makeMockPorts();
    const adapter = createAgentAdapter('agent:main', 'Main', ports as unknown as TypedPorts, makeMockEventsFns(), null);
    adapter.resolvers.lifetimeStats({});
    expect(ports.lifetime.getStats).toHaveBeenCalled();
  });

  it('eventDensity resolver calls getEventDensity with only db', () => {
    const eventsFns = makeMockEventsFns();
    const mockDb = {};
    const adapter = createAgentAdapter(
      'agent:main',
      'Main',
      makeMockPorts() as unknown as TypedPorts,
      eventsFns,
      mockDb as never,
    );
    adapter.resolvers.eventDensity({});
    expect(eventsFns.getEventDensity).toHaveBeenCalledWith(mockDb);
  });

  it('eventCounts resolver passes { from, to } as object', () => {
    const eventsFns = makeMockEventsFns();
    const mockDb = {};
    const adapter = createAgentAdapter(
      'agent:main',
      'Main',
      makeMockPorts() as unknown as TypedPorts,
      eventsFns,
      mockDb as never,
    );
    adapter.resolvers.eventCounts({ from: 100, to: 200 });
    expect(eventsFns.getEventCounts).toHaveBeenCalledWith(mockDb, { from: 100, to: 200 });
  });

  it('recentLogs maps port entry shape to GraphQL shape', () => {
    const ports = makeMockPorts();
    ports.logs.getRecentLogs.mockReturnValue([{ timestamp: 0, level: 'warn', source: 'sampler', message: 'hello' }]);
    const adapter = createAgentAdapter('agent:main', 'Main', ports as unknown as TypedPorts, makeMockEventsFns(), null);
    const result = adapter.resolvers.recentLogs({ count: 1 }) as Array<Record<string, unknown>>;
    expect(result[0]).toMatchObject({
      time: new Date(0).toISOString(),
      level: 'WARN',
      module: 'sampler',
      message: 'hello',
    });
  });

  it('recentLogs falls back to INFO for unknown level', () => {
    const ports = makeMockPorts();
    ports.logs.getRecentLogs.mockReturnValue([{ timestamp: 0, level: 'mystery', source: 'sampler', message: 'hello' }]);
    const adapter = createAgentAdapter('agent:main', 'Main', ports as unknown as TypedPorts, makeMockEventsFns(), null);
    const result = adapter.resolvers.recentLogs({ count: 1 }) as Array<Record<string, unknown>>;
    expect(result[0]).toMatchObject({ level: 'INFO' });
  });

  it('cronJobs maps CronEntry fields to GraphQL CronJob fields', () => {
    const ports = makeMockPorts();
    ports.cron.getCronJobs.mockReturnValue([
      {
        id: 'j1',
        schedule: '*/5 * * * *',
        enabled: true,
        lastRun: 1700000000000,
        nextRun: 1700000300000,
        description: 'job1',
      },
    ]);
    const adapter = createAgentAdapter('agent:main', 'Main', ports as unknown as TypedPorts, makeMockEventsFns(), null);
    const result = adapter.resolvers.cronJobs({}) as Array<Record<string, unknown>>;
    expect(result[0]).toMatchObject({
      id: 'j1',
      name: 'job1',
      lastRunSuccess: null,
      lastRunAt: new Date(1700000000000).toISOString(),
      nextRunAt: new Date(1700000300000).toISOString(),
    });
  });

  it('metrics resolver always returns warnings array', () => {
    const ports = makeMockPorts();
    ports.metrics.getMetrics.mockReturnValue({ date: '2026-03-05', totalTokensK: 0 });
    const adapter = createAgentAdapter('agent:main', 'Main', ports as unknown as TypedPorts, makeMockEventsFns(), null);
    const result = adapter.resolvers.metrics({ range: 'ONE_HOUR' }) as Record<string, unknown>;
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('metrics resolver defaults invalid range to TWENTY_FOUR_HOUR', () => {
    const ports = makeMockPorts();
    const adapter = createAgentAdapter('agent:main', 'Main', ports as unknown as TypedPorts, makeMockEventsFns(), null);

    adapter.resolvers.metrics({ range: 'INVALID_RANGE' });

    expect(ports.metrics.getMetrics).toHaveBeenCalledWith(undefined, 'TWENTY_FOUR_HOUR', expect.anything());
  });

  it('metrics warnings come from validation runner when provided', () => {
    const ports = makeMockPorts();
    ports.metrics.getMetrics.mockReturnValue({ date: '2026-03-05', totalTokensK: 0, warnings: ['port warning'] });

    const adapter = createAgentAdapter(
      'agent:main',
      'Main',
      ports as unknown as TypedPorts,
      makeMockEventsFns(),
      null,
      {
        runValidation: () => [
          { pass: true, message: 'ok' },
          { pass: false, message: 'validation warning' },
        ],
      },
    );

    const result = adapter.resolvers.metrics({ range: 'ONE_HOUR' }) as Record<string, unknown>;
    expect(result.warnings).toEqual(['validation warning']);
  });

  it('sessionTranscript rejects before+after with BAD_USER_INPUT when transcript exists', async () => {
    const ports = makeMockPorts();
    ports.transcript.getTranscriptPath.mockReturnValue('/tmp/transcript.jsonl');

    const adapter = createAgentAdapter('agent:main', 'Main', ports as unknown as TypedPorts, makeMockEventsFns(), null);
    await expect(
      adapter.resolvers.sessionTranscript({ sessionKey: 's1', before: 'a', after: 'b' }),
    ).rejects.toMatchObject({
      extensions: { code: 'BAD_USER_INPUT' },
    });
  });

  it('sessionTranscript maps file-too-large to TRANSCRIPT_TOO_LARGE', async () => {
    const ports = makeMockPorts();
    ports.transcript.getTranscriptPath.mockReturnValue('/tmp/transcript.jsonl');
    readTranscriptMock.mockRejectedValueOnce(new Error('File too large: 60000000 bytes (max 52428800)'));

    const adapter = createAgentAdapter('agent:main', 'Main', ports as unknown as TypedPorts, makeMockEventsFns(), null);

    await expect(adapter.resolvers.sessionTranscript({ sessionKey: 's1' })).rejects.toMatchObject({
      extensions: { code: 'TRANSCRIPT_TOO_LARGE' },
    });
  });

  it('sessionTranscript maps generic read failures to TRANSCRIPT_READ_ERROR', async () => {
    const ports = makeMockPorts();
    ports.transcript.getTranscriptPath.mockReturnValue('/tmp/transcript.jsonl');
    readTranscriptMock.mockRejectedValueOnce(new Error('boom'));

    const adapter = createAgentAdapter('agent:main', 'Main', ports as unknown as TypedPorts, makeMockEventsFns(), null);

    await expect(adapter.resolvers.sessionTranscript({ sessionKey: 's1' })).rejects.toMatchObject({
      extensions: { code: 'TRANSCRIPT_READ_ERROR' },
    });
  });
});
