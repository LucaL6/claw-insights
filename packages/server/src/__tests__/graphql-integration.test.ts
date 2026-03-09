/**
 * GraphQL integration tests — real Express + seeded in-memory DB.
 * Config mock MUST come before any codebase imports.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Mock config BEFORE any app imports so auth is disabled
vi.mock('../config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../config.js')>();
  return {
    ...original,
    config: {
      ...original.config,
      noAuth: true,
      dbPath: ':memory:',
      sessionsPath: '/tmp/test-sessions.json',
      logDir: '/tmp/test-logs',
      cronPath: '/tmp/test-cron.json',
      transcriptsDir: '/tmp/test-transcripts',
      deviceJsonPath: '/tmp/test-device.json',
    },
  };
});

import request from 'supertest';

import { createTestApp, type TestApp } from './helpers/test-app.js';

// ── Setup ──

let t: TestApp;

beforeAll(() => {
  t = createTestApp();
});

afterAll(() => {
  t?.destroy();
});

// Helper
const gql = (query: string, variables?: Record<string, unknown>) =>
  request(t.app).post('/graphql').send({ query, variables }).set('Content-Type', 'application/json').expect(200);

// ── canonical Query resolvers ──

describe('GraphQL Integration Tests (canonical)', () => {
  // 1. system → gateway
  it('system returns gateway status fields', async () => {
    const res = await gql(
      '{ system { ... on OpenClawSystem { gateway { running pid version appVersion uptime securityCritical securityWarn } } } }',
    );
    const g = res.body.data.system.gateway;
    expect(g.running).toBe(true);
    expect(g.pid).toBe(12345);
    expect(typeof g.version).toBe('string');
    expect(typeof g.appVersion).toBe('string');
    expect(g.securityCritical).toBe(0);
    expect(g.securityWarn).toBe(0);
  });

  // 2. system → resources
  it('system returns system resources', async () => {
    const res = await gql('{ system { ... on OpenClawSystem { resources { cpu memoryMB diskMB sampledAt } } } }');
    const r = res.body.data.system.resources;
    expect(r.cpu).toBeCloseTo(25.5);
    expect(r.memoryMB).toBe(512);
    expect(r.diskMB).toBe(102400);
    expect(r.sampledAt).toBeTruthy();
  });

  // 3. system → channels
  it('system returns channel list', async () => {
    const res = await gql('{ system { ... on OpenClawSystem { channels { provider name connected latencyMs } } } }');
    const c = res.body.data.system.channels;
    expect(c).toHaveLength(1);
    expect(c[0].provider).toBe('telegram');
    expect(c[0].connected).toBe(true);
  });

  // 4. source → sessions
  it('source returns session list', async () => {
    const res = await gql(`{
      source(selector: { id: "agent:main" }) {
        ... on AgentNamespace {
          sessions { key displayName kind model status totalTokens turnCount subAgents { key } }
        }
      }
    }`);
    const s = res.body.data.source.sessions;
    expect(s).toHaveLength(1);
    expect(s[0].key).toBe('session-1');
    expect(s[0].status).toBe('ACTIVE');
    expect(s[0].subAgents).toEqual([]);
  });

  // 5. source → metrics
  it('source returns metrics summary', async () => {
    const res = await gql(`{
      source(selector: { id: "agent:main" }) {
        ... on AgentNamespace {
          metrics { date range totalTokensK rangeTokensK totalErrors totalWarnings warnings }
        }
      }
    }`);
    const m = res.body.data.source.metrics;
    expect(typeof m.totalTokensK).toBe('number');
    expect(typeof m.date).toBe('string');
    expect(Array.isArray(m.warnings)).toBe(true);
  });

  // 6. source → cronJobs
  it('source returns cron jobs', async () => {
    const res = await gql(`{
      source(selector: { id: "agent:main" }) {
        ... on AgentNamespace {
          cronJobs { id name enabled schedule lastRunAt lastRunSuccess }
        }
      }
    }`);
    const c = res.body.data.source.cronJobs;
    expect(c).toHaveLength(1);
    expect(c[0].id).toBe('job-1');
    expect(c[0].enabled).toBe(true);
  });

  // 7. source → usageCost
  it('source returns usage cost', async () => {
    const res = await gql(`{
      source(selector: { id: "agent:main" }) {
        ... on AgentNamespace {
          usageCost { totalCost totalTokensM todayCost todayTokensM fetchedAt }
        }
      }
    }`);
    const u = res.body.data.source.usageCost;
    expect(u.totalCost).toBeCloseTo(42.5);
    expect(u.todayCost).toBeCloseTo(3.1);
    expect(u.fetchedAt).toBeTruthy();
  });

  // 8. source → recentLogs
  it('source returns recent logs', async () => {
    const res = await gql(`{
      source(selector: { id: "agent:main" }) {
        ... on AgentNamespace {
          recentLogs(count: 10) { time level module message }
        }
      }
    }`);
    const logs = res.body.data.source.recentLogs;
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].level).toBe('INFO');
    expect(logs[0].module).toBe('agent');
  });

  // 9. source → events
  it('source returns events with counts', async () => {
    const res = await gql(`{
      source(selector: { id: "agent:main" }) {
        ... on AgentNamespace {
          events(limit: 20) { events { timestamp type module message } total counts { error warning restart } }
        }
      }
    }`);
    const e = res.body.data.source.events;
    expect(e.events.length).toBeGreaterThan(0);
    expect(typeof e.total).toBe('number');
    expect(typeof e.counts.error).toBe('number');
  });

  // 10. source → eventDensity
  it('source returns event density', async () => {
    const res = await gql(`{
      source(selector: { id: "agent:main" }) {
        ... on AgentNamespace {
          eventDensity { hour count hasError hasWarning epochStart }
        }
      }
    }`);
    const d = res.body.data.source.eventDensity;
    expect(Array.isArray(d)).toBe(true);
    expect(d.length).toBeGreaterThan(0);
    expect(typeof d[0].hour).toBe('number');
    expect(typeof d[0].count).toBe('number');
  });

  // 11. source → eventCounts
  it('source returns event counts', async () => {
    const res = await gql(`{
      source(selector: { id: "agent:main" }) {
        ... on AgentNamespace {
          eventCounts { error warning restart }
        }
      }
    }`);
    const c = res.body.data.source.eventCounts;
    expect(typeof c.error).toBe('number');
    expect(typeof c.warning).toBe('number');
    expect(typeof c.restart).toBe('number');
  });

  // 12. source → lifetimeStats
  it('source returns lifetime stats', async () => {
    const res = await gql(`{
      source(selector: { id: "agent:main" }) {
        ... on AgentNamespace {
          lifetimeStats { isReady createdAt daysSinceCreation totalSessions totalTokens totalUserMessages totalAssistantMessages }
        }
      }
    }`);
    const l = res.body.data.source.lifetimeStats;
    expect(l.isReady).toBe(true);
    expect(l.daysSinceCreation).toBe(30);
    expect(l.totalSessions).toBe(100);
    expect(l.totalTokens).toBe(900000);
  });
});
