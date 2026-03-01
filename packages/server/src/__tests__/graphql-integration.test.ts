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

// ── 12 Query resolvers ──

describe('GraphQL Integration Tests', () => {
  // 1. gateway
  it('gateway returns status fields', async () => {
    const res = await gql('{ gateway { running pid version appVersion uptime securityCritical securityWarn } }');
    const g = res.body.data.gateway;
    expect(g.running).toBe(true);
    expect(g.pid).toBe(12345);
    expect(typeof g.version).toBe('string');
    expect(typeof g.appVersion).toBe('string');
    expect(g.securityCritical).toBe(0);
    expect(g.securityWarn).toBe(0);
  });

  // 2. resources
  it('resources returns system metrics', async () => {
    const res = await gql('{ resources { cpu memoryMB diskMB sampledAt } }');
    const r = res.body.data.resources;
    expect(r.cpu).toBeCloseTo(25.5);
    expect(r.memoryMB).toBe(512);
    expect(r.diskMB).toBe(102400);
    expect(r.sampledAt).toBeTruthy();
  });

  // 3. channels
  it('channels returns channel list', async () => {
    const res = await gql('{ channels { provider name connected latencyMs } }');
    const c = res.body.data.channels;
    expect(c).toHaveLength(1);
    expect(c[0].provider).toBe('telegram');
    expect(c[0].connected).toBe(true);
  });

  // 4. sessions
  it('sessions returns session list', async () => {
    const res = await gql('{ sessions { key displayName kind model status totalTokens turnCount subAgents { key } } }');
    const s = res.body.data.sessions;
    expect(s).toHaveLength(1);
    expect(s[0].key).toBe('session-1');
    expect(s[0].status).toBe('ACTIVE');
    expect(s[0].subAgents).toEqual([]);
  });

  // 5. metrics
  it('metrics returns summary with seeded data', async () => {
    const res = await gql('{ metrics { date range totalTokensK rangeTokensK totalErrors totalWarnings warnings } }');
    const m = res.body.data.metrics;
    expect(typeof m.totalTokensK).toBe('number');
    expect(typeof m.date).toBe('string');
    expect(Array.isArray(m.warnings)).toBe(true);
  });

  // 6. cronJobs
  it('cronJobs returns job list', async () => {
    const res = await gql('{ cronJobs { id name enabled schedule lastRunAt lastRunSuccess } }');
    const c = res.body.data.cronJobs;
    expect(c).toHaveLength(1);
    expect(c[0].id).toBe('job-1');
    expect(c[0].enabled).toBe(true);
  });

  // 7. usageCost
  it('usageCost returns cost data', async () => {
    const res = await gql('{ usageCost { totalCost totalTokensM todayCost todayTokensM fetchedAt } }');
    const u = res.body.data.usageCost;
    expect(u.totalCost).toBeCloseTo(42.5);
    expect(u.todayCost).toBeCloseTo(3.1);
    expect(u.fetchedAt).toBeTruthy();
  });

  // 8. recentLogs
  it('recentLogs returns log entries', async () => {
    const res = await gql('{ recentLogs(count: 10) { time level module message } }');
    const logs = res.body.data.recentLogs;
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].level).toBe('INFO');
    expect(logs[0].module).toBe('agent');
  });

  // 9. events
  it('events returns events with counts', async () => {
    const res = await gql(
      '{ events(limit: 20) { events { timestamp type module message } total counts { error warning restart } } }',
    );
    const e = res.body.data.events;
    expect(e.events.length).toBeGreaterThan(0);
    expect(typeof e.total).toBe('number');
    expect(typeof e.counts.error).toBe('number');
  });

  // 10. eventDensity
  it('eventDensity returns density buckets', async () => {
    const res = await gql('{ eventDensity { hour count hasError hasWarning epochStart } }');
    const d = res.body.data.eventDensity;
    expect(Array.isArray(d)).toBe(true);
    expect(d.length).toBeGreaterThan(0);
    expect(typeof d[0].hour).toBe('number');
    expect(typeof d[0].count).toBe('number');
  });

  // 11. eventCounts
  it('eventCounts returns counts', async () => {
    const res = await gql('{ eventCounts { error warning restart } }');
    const c = res.body.data.eventCounts;
    expect(typeof c.error).toBe('number');
    expect(typeof c.warning).toBe('number');
    expect(typeof c.restart).toBe('number');
  });

  // 12. lifetimeStats
  it('lifetimeStats returns lifetime data', async () => {
    const res = await gql(
      '{ lifetimeStats { isReady createdAt daysSinceCreation totalSessions totalTokens totalUserMessages totalAssistantMessages } }',
    );
    const l = res.body.data.lifetimeStats;
    expect(l.isReady).toBe(true);
    expect(l.daysSinceCreation).toBe(30);
    expect(l.totalSessions).toBe(100);
    expect(l.totalTokens).toBe(900000);
  });
});
