/**
 * Branch-coverage tests for src/schema/source/resolvers.ts
 */
import request from 'supertest';
import { afterAll,beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from '../../../__tests__/helpers/test-app.js';

let t: TestApp;
beforeAll(() => {
  t = createTestApp();
});
afterAll(() => {
  t.destroy();
});

const gql = (query: string, variables?: Record<string, unknown>) =>
  request(t.app).post('/graphql').send({ query, variables }).expect(200);

// Fragments for union types
const SYS = `... on OpenClawSystem`;
const AGENT = `... on AgentNamespace`;
const DASH = `... on DashboardNamespace`;

// ── Query.system ──
describe('Query.system', () => {
  it('without context', async () => {
    const res = await gql(`{ system { ${SYS} { health { status checks { name status message } } } } }`);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.system.health).toBeDefined();
  });

  it('with context', async () => {
    const res = await gql(`query($ctx: QueryContext) { system(context: $ctx) { ${SYS} { health { status } } } }`, {
      ctx: { trace: { requestId: 'r1' }, defaults: { timeRange: { preset: 'ONE_HOUR' } } },
    });
    expect(res.body.errors).toBeUndefined();
  });

  it('with empty context', async () => {
    const res = await gql(`query($ctx: QueryContext) { system(context: $ctx) { ${SYS} { health { status } } } }`, {
      ctx: {},
    });
    expect(res.body.errors).toBeUndefined();
  });
});

// ── Query.sources ──
describe('Query.sources', () => {
  it('without filter', async () => {
    const res = await gql(`{ sources { id name status } }`);
    expect(res.body.data.sources.length).toBeGreaterThanOrEqual(2);
  });

  it('with category filter', async () => {
    const res = await gql(`query($f: SourceFilter) { sources(filter: $f) { id } }`, { f: { category: 'AGENT' } });
    expect(res.body.data.sources.length).toBeGreaterThanOrEqual(1);
  });

  it('with context', async () => {
    const res = await gql(`query($ctx: QueryContext) { sources(context: $ctx) { id } }`, {
      ctx: { defaults: { timeRange: { from: 0 } } },
    });
    expect(res.body.errors).toBeUndefined();
  });
});

// ── Query.source ──
describe('Query.source', () => {
  it('resolves agent', async () => {
    const res = await gql(`query($s: SourceSelector!) { source(selector: $s) { ${AGENT} { info { id } } } }`, {
      s: { id: 'agent:main' },
    });
    expect(res.body.data.source.info.id).toBe('agent:main');
  });

  it('resolves dashboard', async () => {
    const res = await gql(`query($s: SourceSelector!) { source(selector: $s) { ${DASH} { info { id } } } }`, {
      s: { id: 'dashboard:main' },
    });
    expect(res.body.data.source.info.id).toBe('dashboard:main');
  });

  it('returns null for non-existent', async () => {
    const res = await gql(`query($s: SourceSelector!) { source(selector: $s) { ${AGENT} { info { id } } } }`, {
      s: { id: 'nonexistent:x' },
    });
    expect(res.body.data.source).toBeNull();
  });

  it('agent with context defaults', async () => {
    const res = await gql(
      `query($s: SourceSelector!, $ctx: QueryContext) { source(selector: $s, context: $ctx) { ${AGENT} { info { id } } } }`,
      { s: { id: 'agent:main' }, ctx: { defaults: { timeRange: { from: 1000, to: 2000 } } } },
    );
    expect(res.body.errors).toBeUndefined();
  });
});

// ── OpenClawSystem.health branches ──
describe('health branches', () => {
  const healthQ = `{ system { ${SYS} { health { status checks { name status message } } } } }`;

  it('healthy: gateway up, all channels, no security', async () => {
    const res = await gql(healthQ);
    const h = res.body.data.system.health;
    expect(h.status).toBe('HEALTHY');
    expect(h.checks.find((c: any) => c.name === 'gateway').message).toBe('Gateway reachable');
  });

  it('gateway throws Error', async () => {
    const orig = t.ctx.ports.gateway.getGatewayStatus;
    t.ctx.ports.gateway.getGatewayStatus = async () => {
      throw new Error('connection refused');
    };
    try {
      const res = await gql(healthQ);
      const h = res.body.data.system.health;
      expect(h.status).toBe('UNHEALTHY');
      expect(h.checks.every((c: any) => c.status === 'FAIL')).toBe(true);
      expect(h.checks[0].message).toContain('connection refused');
    } finally {
      t.ctx.ports.gateway.getGatewayStatus = orig;
    }
  });

  it('gateway throws non-Error', async () => {
    const orig = t.ctx.ports.gateway.getGatewayStatus;
    t.ctx.ports.gateway.getGatewayStatus = async () => {
      throw 'raw string';
    };
    try {
      const res = await gql(healthQ);
      const h = res.body.data.system.health;
      expect(h.status).toBe('UNHEALTHY');
      expect(h.checks[0].message).toContain('raw string');
    } finally {
      t.ctx.ports.gateway.getGatewayStatus = orig;
    }
  });

  const mkGateway = (overrides: any) => async () => ({
    running: true,
    pid: 1,
    version: '1.0.0',
    updateAvailable: null,
    uptime: '1h',
    startedAt: new Date().toISOString(),
    connectLatencyMs: 5,
    latestVersion: '1.0.0',
    securitySummary: { critical: 0, warn: 0, info: 0 },
    sessionDefaults: null,
    channels: [{ provider: 'telegram', name: 'a', connected: true, latencyMs: null }],
    ...overrides,
  });

  it('gateway not running', async () => {
    const orig = t.ctx.ports.gateway.getGatewayStatus;
    t.ctx.ports.gateway.getGatewayStatus = mkGateway({ running: false, channels: [] });
    try {
      const res = await gql(healthQ);
      const h = res.body.data.system.health;
      expect(h.status).toBe('UNHEALTHY');
      expect(h.checks.find((c: any) => c.name === 'gateway').message).toBe('Gateway unreachable');
      expect(h.checks.find((c: any) => c.name === 'channels').message).toBe('No channels configured');
    } finally {
      t.ctx.ports.gateway.getGatewayStatus = orig;
    }
  });

  it('partial channels', async () => {
    const orig = t.ctx.ports.gateway.getGatewayStatus;
    t.ctx.ports.gateway.getGatewayStatus = mkGateway({
      channels: [
        { provider: 'a', name: 'a', connected: true, latencyMs: null },
        { provider: 'b', name: 'b', connected: false, latencyMs: null },
      ],
    });
    try {
      const res = await gql(healthQ);
      const h = res.body.data.system.health;
      expect(h.status).toBe('DEGRADED');
      expect(h.checks.find((c: any) => c.name === 'channels').message).toBe('1/2 channels connected');
    } finally {
      t.ctx.ports.gateway.getGatewayStatus = orig;
    }
  });

  it('zero channels connected', async () => {
    const orig = t.ctx.ports.gateway.getGatewayStatus;
    t.ctx.ports.gateway.getGatewayStatus = mkGateway({
      channels: [
        { provider: 'a', name: 'a', connected: false, latencyMs: null },
        { provider: 'b', name: 'b', connected: false, latencyMs: null },
      ],
    });
    try {
      const res = await gql(healthQ);
      const h = res.body.data.system.health;
      expect(h.status).toBe('UNHEALTHY');
      expect(h.checks.find((c: any) => c.name === 'channels').status).toBe('FAIL');
    } finally {
      t.ctx.ports.gateway.getGatewayStatus = orig;
    }
  });

  it('security critical', async () => {
    const orig = t.ctx.ports.gateway.getGatewayStatus;
    t.ctx.ports.gateway.getGatewayStatus = mkGateway({ securitySummary: { critical: 2, warn: 1, info: 0 } });
    try {
      const res = await gql(healthQ);
      const h = res.body.data.system.health;
      expect(h.status).toBe('UNHEALTHY');
      expect(h.checks.find((c: any) => c.name === 'security').status).toBe('FAIL');
    } finally {
      t.ctx.ports.gateway.getGatewayStatus = orig;
    }
  });

  it('security warn only', async () => {
    const orig = t.ctx.ports.gateway.getGatewayStatus;
    t.ctx.ports.gateway.getGatewayStatus = mkGateway({ securitySummary: { critical: 0, warn: 3, info: 0 } });
    try {
      const res = await gql(healthQ);
      const h = res.body.data.system.health;
      expect(h.status).toBe('DEGRADED');
      expect(h.checks.find((c: any) => c.name === 'security').status).toBe('WARN');
    } finally {
      t.ctx.ports.gateway.getGatewayStatus = orig;
    }
  });
});

// ── Other system resolvers ──
describe('system resolvers', () => {
  it('gateway', async () => {
    const res = await gql(`{ system { ${SYS} { gateway { running version } } } }`);
    expect(res.body.data.system.gateway.running).toBe(true);
  });

  it('channels', async () => {
    const res = await gql(`{ system { ${SYS} { channels { provider name connected } } } }`);
    expect(res.body.data.system.channels.length).toBeGreaterThanOrEqual(1);
  });

  it('resources', async () => {
    const res = await gql(`{ system { ${SYS} { resources { cpu memoryMB } } } }`);
    expect(res.body.data.system.resources.cpu).toBeDefined();
  });
});

// ── __resolveType ──
describe('__resolveType', () => {
  it('SourceNamespace → AgentNamespace', async () => {
    const res = await gql(`query($s: SourceSelector!) { source(selector: $s) { __typename } }`, {
      s: { id: 'agent:main' },
    });
    expect(res.body.data.source.__typename).toBe('AgentNamespace');
  });

  it('SourceNamespace → DashboardNamespace', async () => {
    const res = await gql(`query($s: SourceSelector!) { source(selector: $s) { __typename } }`, {
      s: { id: 'dashboard:main' },
    });
    expect(res.body.data.source.__typename).toBe('DashboardNamespace');
  });

  it('SystemNamespace → OpenClawSystem', async () => {
    const res = await gql(`{ system { __typename } }`);
    expect(res.body.data.system.__typename).toBe('OpenClawSystem');
  });
});

// ── AgentNamespace resolvers ──
describe('AgentNamespace', () => {
  const agentQ = (field: string, ctx?: Record<string, unknown>) =>
    gql(
      `query($s: SourceSelector!, $ctx: QueryContext) { source(selector: $s, context: $ctx) { ${AGENT} { ${field} } } }`,
      { s: { id: 'agent:main' }, ctx: ctx ?? null },
    );

  it('metrics without defaults', async () => {
    const res = await agentQ('metrics { totalTokensK }');
    expect(res.body.errors).toBeUndefined();
  });

  it('metrics with preset default', async () => {
    const res = await agentQ('metrics { totalTokensK }', { defaults: { timeRange: { preset: 'ONE_HOUR' } } });
    expect(res.body.errors).toBeUndefined();
  });

  it('events without defaults', async () => {
    const res = await agentQ('events { total }');
    expect(res.body.errors).toBeUndefined();
  });

  it('events with time range', async () => {
    const now = Math.floor(Date.now() / 1000);
    const res = await agentQ('events { total }', { defaults: { timeRange: { from: now - 3600, to: now } } });
    expect(res.body.errors).toBeUndefined();
  });

  it('eventCounts without defaults', async () => {
    const res = await agentQ('eventCounts { error }');
    expect(res.body.errors).toBeUndefined();
  });

  it('eventCounts with time range', async () => {
    const now = Math.floor(Date.now() / 1000);
    const res = await agentQ('eventCounts { error }', { defaults: { timeRange: { from: now - 3600, to: now } } });
    expect(res.body.errors).toBeUndefined();
  });

  it('sessions', async () => {
    const res = await agentQ('sessions { key }');
    expect(res.body.errors).toBeUndefined();
  });

  it('session by key', async () => {
    const res = await gql(
      `query($s: SourceSelector!) { source(selector: $s) { ${AGENT} { session(key: "s1") { key } } } }`,
      { s: { id: 'agent:main' } },
    );
    expect(res.body.errors).toBeUndefined();
  });

  it('cronJobs', async () => {
    const res = await agentQ('cronJobs { id }');
    expect(res.body.errors).toBeUndefined();
  });

  it('recentLogs', async () => {
    const res = await agentQ('recentLogs { message }');
    expect(res.body.errors).toBeUndefined();
  });

  it('eventDensity', async () => {
    const res = await agentQ('eventDensity { hour count }');
    expect(res.body.errors).toBeUndefined();
  });

  it('lifetimeStats', async () => {
    const res = await agentQ('lifetimeStats { totalSessions }');
    expect(res.body.errors).toBeUndefined();
  });

  it('sessionTranscript', async () => {
    const res = await gql(
      `query($s: SourceSelector!) { source(selector: $s) { ${AGENT} { sessionTranscript(sessionKey: "s1") { sessionKey } } } }`,
      { s: { id: 'agent:main' } },
    );
    // Transcript file doesn't exist in test, so we get an error — that's fine, the resolver was exercised
    expect(res.body.errors?.[0]?.extensions?.code).toBeDefined();
  });

  it('usageCost', async () => {
    const res = await agentQ('usageCost { totalCost }');
    expect(res.body.errors).toBeUndefined();
  });
});

// ── HasSourceInfo / HasSystemInfo interface resolveType ──
describe('interface resolveType', () => {
  it('HasSourceInfo resolves AgentNamespace via interface fragment', async () => {
    const res = await gql(
      `query($s: SourceSelector!) { source(selector: $s) { ... on HasSourceInfo { info { id } } } }`,
      { s: { id: 'agent:main' } },
    );
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.source.info.id).toBe('agent:main');
  });

  it('HasSourceInfo resolves DashboardNamespace via interface fragment', async () => {
    const res = await gql(
      `query($s: SourceSelector!) { source(selector: $s) { ... on HasSourceInfo { info { id } } } }`,
      { s: { id: 'dashboard:main' } },
    );
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.source.info.id).toBe('dashboard:main');
  });

  it('HasSystemInfo resolves OpenClawSystem via interface fragment', async () => {
    const res = await gql(`{ system { ... on HasSystemInfo { health { status } } } }`);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.system.health.status).toBeDefined();
  });
});

// ── Direct unit test of resolvers for uncovered branches ──
describe('direct resolveType calls', () => {
  it('SourceNamespace.__resolveType with neither _agent nor _info', async () => {
    // Access the resolvers directly
    const { createSourceResolvers } = await import('../resolvers.js');
    const resolvers = createSourceResolvers(t.ctx) as any;

    // neither _agent nor _info
    expect(resolvers.SourceNamespace.__resolveType({})).toBeNull();
    expect(resolvers.SourceNamespace.__resolveType(null)).toBeNull();
    expect(resolvers.SourceNamespace.__resolveType('string')).toBeNull();

    // _agent
    expect(resolvers.SourceNamespace.__resolveType({ _agent: true })).toBe('AgentNamespace');
    // _info
    expect(resolvers.SourceNamespace.__resolveType({ _info: true })).toBe('DashboardNamespace');

    // HasSourceInfo
    expect(resolvers.HasSourceInfo.__resolveType({})).toBe('AgentNamespace'); // fallback
    expect(resolvers.HasSourceInfo.__resolveType(null)).toBe('AgentNamespace'); // fallback
    expect(resolvers.HasSourceInfo.__resolveType({ _agent: true })).toBe('AgentNamespace');
    expect(resolvers.HasSourceInfo.__resolveType({ _info: true })).toBe('DashboardNamespace');

    // SystemNamespace / HasSystemInfo
    expect(resolvers.SystemNamespace.__resolveType()).toBe('OpenClawSystem');
    expect(resolvers.HasSystemInfo.__resolveType()).toBe('OpenClawSystem');
  });
});

// ── getRequestMemo reuse ──
describe('memo reuse', () => {
  it('health+gateway+channels share one snapshot call', async () => {
    let calls = 0;
    const orig = t.ctx.ports.gateway.getGatewayStatus;
    t.ctx.ports.gateway.getGatewayStatus = async (...args: unknown[]) => {
      calls++;
      return (orig as Function)(...args);
    };
    try {
      const res = await gql(`{ system { ${SYS} { health { status } gateway { running } channels { provider } } } }`);
      expect(res.body.errors).toBeUndefined();
      expect(calls).toBeLessThanOrEqual(1);
    } finally {
      t.ctx.ports.gateway.getGatewayStatus = orig;
    }
  });
});
