/**
 * Data-flow integration tests — verify Event → DB → GraphQL query pipeline
 * and EventBus → flush → DB → GraphQL metrics pipeline.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// ── Mock config BEFORE any codebase imports (bypass auth) ──
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

describe('Event Insert → DB → GraphQL Query', () => {
  let t: TestApp;

  beforeAll(() => {
    t = createTestApp();
  });

  afterAll(() => {
    t.destroy();
  });

  it('inserted error event appears in events query', async () => {
    insertEvent(t.db, 'error', null, { message: 'dataflow-test-error' });

    const res = await request(t.app)
      .post('/graphql')
      .send({ query: '{ events(types: ["error"]) { events { type message } total } }' });

    expect(res.status).toBe(200);
    const { events, total } = res.body.data.events;
    expect(total).toBeGreaterThan(0);
    expect(events.some((e: { message: string }) => e.message.includes('dataflow-test-error'))).toBe(true);
  });

  it('inserted events update eventCounts within time range', async () => {
    const now = Math.floor(Date.now() / 1000);
    insertEvent(t.db, 'error', null, { message: 'count-err' });
    insertEvent(t.db, 'warning', null, { message: 'count-warn' });

    const res = await request(t.app)
      .post('/graphql')
      .send({ query: `{ eventCounts(from: ${now - 60}, to: ${now + 60}) { error warning restart } }` });

    expect(res.status).toBe(200);
    const counts = res.body.data.eventCounts;
    expect(counts.error).toBeGreaterThan(0);
    expect(counts.warning).toBeGreaterThan(0);
  });

  it('inserted events show up in eventDensity', async () => {
    insertEvent(t.db, 'error', null, { message: 'density-test' });

    const res = await request(t.app).post('/graphql').send({ query: '{ eventDensity { hour count errorCount } }' });

    expect(res.status).toBe(200);
    const density = res.body.data.eventDensity;
    expect(density).toHaveLength(24);
    const totalErrors = density.reduce((s: number, b: { errorCount: number }) => s + b.errorCount, 0);
    expect(totalErrors).toBeGreaterThan(0);
  });
});

describe('EventBus → Flush → DB → GraphQL Query', () => {
  let t: TestApp;

  beforeAll(() => {
    t = createTestApp();
  });

  afterAll(() => {
    t.destroy();
  });

  it('token events emitted on bus appear in metrics after flush', async () => {
    const before = await request(t.app).post('/graphql').send({ query: '{ metrics { totalTokensK } }' });
    const baselineTokensK = before.body.data.metrics.totalTokensK;

    // Emit a token usage event
    t.ctx.tokenBus.emit({
      sessionKey: 'test:dataflow',
      model: 'claude-test',
      inputTokens: 50_000,
      outputTokens: 25_000,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      timestamp: new Date().toISOString(),
    });

    // Flush to DB + clear aggregator cache
    t.flushTokenEvents();
    t.clearAggregatorCache();

    const after = await request(t.app).post('/graphql').send({ query: '{ metrics { totalTokensK } }' });

    expect(after.body.data.metrics.totalTokensK).toBeGreaterThan(baselineTokensK);
  });

  it('message events emitted on bus are flushed to DB', async () => {
    const beforeCount = (t.ctx.db.prepare('SELECT COUNT(*) as cnt FROM message_events').get() as { cnt: number }).cnt;

    t.ctx.messageBus.emit({
      sessionKey: 'test:dataflow',
      role: 'user',
      lineHash: 'abc123def456',
      timestamp: new Date().toISOString(),
    });

    t.flushMessageEvents();

    const afterCount = (t.ctx.db.prepare('SELECT COUNT(*) as cnt FROM message_events').get() as { cnt: number }).cnt;
    expect(afterCount).toBe(beforeCount + 1);
  });
});
