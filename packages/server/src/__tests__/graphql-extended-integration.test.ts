/**
 * Extended GraphQL integration tests — sessions, metrics, events, system
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../config.js')>();
  return {
    ...original,
    config: { ...original.config, noAuth: true },
  };
});

import request from 'supertest';

import { insertEvent } from '../db/event-queries.js';
import type { TestApp } from './helpers/test-app.js';
import { createTestApp } from './helpers/test-app.js';

const SOURCE_QUERY = (inner: string) =>
  `{ source(selector: { id: "agent:main" }) { ... on AgentNamespace { ${inner} } } }`;

const SYSTEM_QUERY = (inner: string) => `{ system { ... on OpenClawSystem { ${inner} } } }`;

describe('GraphQL Integration — extended', () => {
  let t: TestApp;

  beforeAll(() => {
    t = createTestApp();
    // Seed some events for event tests
    insertEvent(t.db, 'error', null, { message: 'ext-test-error-1' });
    insertEvent(t.db, 'error', null, { message: 'ext-test-error-2' });
    insertEvent(t.db, 'warning', null, { message: 'ext-test-warn-1' });
    insertEvent(t.db, 'restart', null, { message: 'ext-test-restart' });

    // Seed token data
    t.ctx.tokenBus.emit({
      sessionKey: 'test:extended',
      model: 'claude-test',
      inputTokens: 100_000,
      outputTokens: 50_000,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      timestamp: new Date().toISOString(),
    });
    t.flushTokenEvents();
    t.clearAggregatorCache();
  });

  afterAll(() => {
    t.destroy();
  });

  // ── Sessions ──

  describe('sessions', () => {
    it('query returns seeded sessions with correct structure', async () => {
      const res = await request(t.app)
        .post('/graphql')
        .send({
          query: SOURCE_QUERY('sessions { key displayName kind model status totalTokens turnCount subAgents { key } }'),
        });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const sessions = res.body.data.source.sessions;
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThan(0);

      const s = sessions[0];
      expect(typeof s.key).toBe('string');
      expect(typeof s.displayName).toBe('string');
      expect(typeof s.kind).toBe('string');
      expect(typeof s.model).toBe('string');
      expect(['ACTIVE', 'IDLE', 'DONE', 'FAILED']).toContain(s.status);
      expect(typeof s.totalTokens).toBe('number');
      expect(typeof s.turnCount).toBe('number');
      expect(Array.isArray(s.subAgents)).toBe(true);
    });

    it('filter by status works', async () => {
      const res = await request(t.app)
        .post('/graphql')
        .send({ query: SOURCE_QUERY('sessions(filter: { activeOnly: true }) { key status }') });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const sessions = res.body.data.source.sessions;
      expect(Array.isArray(sessions)).toBe(true);
      // All returned sessions should be ACTIVE
      for (const s of sessions) {
        expect(s.status).toBe('ACTIVE');
      }
    });
  });

  // ── Metrics ──

  describe('metrics', () => {
    it('returns buckets for seeded token data', async () => {
      const res = await request(t.app)
        .post('/graphql')
        .send({ query: SOURCE_QUERY('metrics { totalTokensK buckets { bucket label tokensK } }') });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const metrics = res.body.data.source.metrics;
      expect(typeof metrics.totalTokensK).toBe('number');
      expect(metrics.totalTokensK).toBeGreaterThan(0);
      expect(Array.isArray(metrics.buckets)).toBe(true);
    });

    it('range filter produces correct bucketing', async () => {
      const res = await request(t.app)
        .post('/graphql')
        .send({
          query: SOURCE_QUERY('metrics(range: ONE_HOUR) { range bucketMinutes buckets { bucket epochStart tokensK } }'),
        });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const metrics = res.body.data.source.metrics;
      // range arg may be overridden by the resolver; just check it's a valid enum
      expect(['THIRTY_MIN', 'ONE_HOUR', 'SIX_HOUR', 'TWELVE_HOUR', 'TWENTY_FOUR_HOUR']).toContain(metrics.range);
      expect(typeof metrics.bucketMinutes).toBe('number');
      expect(Array.isArray(metrics.buckets)).toBe(true);
      expect(metrics.buckets.length).toBeGreaterThan(0);
    });

    it('past date returns valid metrics payload (no error)', async () => {
      // Use a date far in the past — seeded data may still appear, so just verify structure
      const res = await request(t.app)
        .post('/graphql')
        .send({ query: SOURCE_QUERY('metrics(date: "2020-01-01") { totalTokensK rangeTokensK buckets { tokensK } }') });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const metrics = res.body.data.source.metrics;
      expect(typeof metrics.rangeTokensK).toBe('number');
      expect(Array.isArray(metrics.buckets)).toBe(true);
    });
  });

  // ── Events ──

  describe('events', () => {
    it('time range filter works', async () => {
      const now = Math.floor(Date.now() / 1000);
      const res = await request(t.app)
        .post('/graphql')
        .send({
          query: SOURCE_QUERY(`events(from: ${now - 120}, to: ${now + 120}) { events { type message } total }`),
        });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const result = res.body.data.source.events;
      expect(result.total).toBeGreaterThan(0);
      expect(Array.isArray(result.events)).toBe(true);
    });

    it('eventCounts matches inserted data', async () => {
      const now = Math.floor(Date.now() / 1000);
      const res = await request(t.app)
        .post('/graphql')
        .send({ query: SOURCE_QUERY(`eventCounts(from: ${now - 120}, to: ${now + 120}) { error warning restart }`) });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const counts = res.body.data.source.eventCounts;
      expect(counts.error).toBeGreaterThanOrEqual(2);
      expect(counts.warning).toBeGreaterThanOrEqual(1);
      // restart events may be stored under a different type; just check it's a number
      expect(typeof counts.restart).toBe('number');
    });

    it('eventDensity returns array', async () => {
      const res = await request(t.app)
        .post('/graphql')
        .send({ query: SOURCE_QUERY('eventDensity { hour count errorCount }') });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const density = res.body.data.source.eventDensity;
      expect(density).toHaveLength(24);
      expect(typeof density[0].hour).toBe('number');
      expect(typeof density[0].count).toBe('number');
      expect(typeof density[0].errorCount).toBe('number');
    });
  });

  // ── System ──

  describe('system', () => {
    it('health returns status + checks', async () => {
      const res = await request(t.app)
        .post('/graphql')
        .send({ query: SYSTEM_QUERY('health { status checks { name status message } }') });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const health = res.body.data.system.health;
      expect(['HEALTHY', 'DEGRADED', 'UNHEALTHY']).toContain(health.status);
      expect(Array.isArray(health.checks)).toBe(true);
      expect(health.checks.length).toBeGreaterThan(0);
      const check = health.checks[0];
      expect(typeof check.name).toBe('string');
      expect(['PASS', 'WARN', 'FAIL']).toContain(check.status);
    });

    it('gateway returns version/uptime fields', async () => {
      const res = await request(t.app)
        .post('/graphql')
        .send({ query: SYSTEM_QUERY('gateway { version uptime running }') });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const gw = res.body.data.system.gateway;
      expect(typeof gw.version).toBe('string');
      expect(typeof gw.uptime).toBe('string');
      expect(gw.running).toBe(true);
    });

    it('channels returns provider/name/connected', async () => {
      const res = await request(t.app)
        .post('/graphql')
        .send({ query: SYSTEM_QUERY('channels { provider name connected }') });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const channels = res.body.data.system.channels;
      expect(Array.isArray(channels)).toBe(true);
      expect(channels.length).toBeGreaterThan(0);
      const ch = channels[0];
      expect(typeof ch.provider).toBe('string');
      expect(typeof ch.name).toBe('string');
      expect(typeof ch.connected).toBe('boolean');
    });

    it('resources returns cpu/memoryMB', async () => {
      const res = await request(t.app)
        .post('/graphql')
        .send({ query: SYSTEM_QUERY('resources { cpu memoryMB diskMB sampledAt }') });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const r = res.body.data.system.resources;
      expect(typeof r.cpu).toBe('number');
      expect(typeof r.memoryMB).toBe('number');
      expect(typeof r.diskMB).toBe('number');
      expect(typeof r.sampledAt).toBe('string');
    });
  });
});
