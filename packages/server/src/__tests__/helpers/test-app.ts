/**
 * Test-app factory — creates a real Express + GraphQL server backed by
 * a seeded in-memory SQLite database.  All external I/O (gateway, system-info,
 * sessions file, cron file, log dir) is stubbed so the tests are hermetic.
 */
import express, { type Express } from 'express';

import type { AppContext } from '../../context.js';
import type { Database } from '../../db/database.js';
import { insertMessageEventBatch } from '../../db/message-queries.js';
import { seedTestData } from '../../db/seed.js';
import { insertTokenUsageEventBatch } from '../../db/token-queries.js';
import { type MessageEvent, MessageEventBus } from '../../events/message-event-bus.js';
import type { TokenUsageEvent } from '../../events/token-event-bus.js';
import { TokenEventBus } from '../../events/token-event-bus.js';
import { registerGraphQL } from '../../routes/graphql.js';
import { Aggregator } from '../../sources/aggregator.js';
import { DataValidator } from '../../sources/data-validator.js';

// ── Stub helpers ──

function stubGatewayClient() {
  return {
    getGatewayStatus: async () => ({
      running: true,
      pid: 12345,
      version: '1.0.0-test',
      updateAvailable: null,
      uptime: '2h 30m',
      startedAt: new Date().toISOString(),
      connectLatencyMs: 5,
      latestVersion: '1.0.0-test',
      securitySummary: { critical: 0, warn: 0 },
      channels: [{ provider: 'telegram', name: 'main', connected: true, latencyMs: 12 }],
    }),
    getVersion: async () => '1.0.0-test',
    warmCache: async () => {},
  };
}

function stubSystemInfoService() {
  return {
    getSystemMetrics: async () => ({
      cpu: 25.5,
      memoryMB: 512,
      diskMB: 102400,
      sampledAt: new Date().toISOString(),
    }),
    getUsageCost: async () => ({
      totalCost: 42.5,
      totalTokensM: 1.2,
      todayCost: 3.1,
      todayTokensM: 0.08,
      fetchedAt: new Date().toISOString(),
    }),
  };
}

function stubSessionReader() {
  return {
    setDb(_db: Database) {},
    invalidateTurnCounts() {},
    attachSubAgents(_map: Map<string, string[]>) {},
    getSessions(_filter?: unknown) {
      return [
        {
          key: 'session-1',
          displayName: 'Test Session',
          kind: 'chat',
          model: 'claude-sonnet-4-20250514',
          channel: 'webchat',
          totalTokens: 5000,
          contextTokens: 3000,
          usagePercent: 60,
          status: 'ACTIVE',
          updatedAt: Date.now(),
          turnCount: 10,
          subAgents: [],
        },
      ];
    },
    destroy() {},
  };
}

function stubCronReader() {
  return {
    getJobs() {
      return [
        {
          id: 'job-1',
          name: 'daily-backup',
          enabled: true,
          schedule: '0 3 * * *',
          lastRunAt: new Date(Date.now() - 86400000).toISOString(),
          lastRunSuccess: true,
          nextRunAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ];
    },
    destroy() {},
  };
}

function stubLogTailer() {
  return {
    getRecentEntries(count: number = 50) {
      return [
        {
          time: new Date().toISOString(),
          level: 'INFO',
          module: 'agent',
          message: 'Test log entry',
        },
      ].slice(0, count);
    },
    destroy() {},
    on() {},
    start() {},
  };
}

function stubSpawnTracker() {
  return {
    ingest() {},
    getParentChildMap() {
      return new Map<string, string[]>();
    },
  };
}

function stubLifetimeScanner() {
  return {
    state: { kind: 'complete' as const },
    init: async () => {},
    getStats: async () => ({
      isReady: true,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      daysSinceCreation: 30,
      totalSessions: 100,
      totalInputTokens: 500000,
      totalOutputTokens: 200000,
      totalCacheReadTokens: 150000,
      totalCacheWriteTokens: 50000,
      totalTokens: 900000,
      totalUserMessages: 1000,
      totalAssistantMessages: 1000,
    }),
    getFileStates: () => new Map(),
    isReady: () => true,
    destroy() {},
  };
}

// ── Factory ──

export interface TestApp {
  app: Express;
  db: Database;
  ctx: AppContext;
  flushTokenEvents(): void;
  flushMessageEvents(): void;
  clearAggregatorCache(): void;
  destroy(): void;
}

export function createTestApp(): TestApp {
  const db = seedTestData(':memory:');
  const aggregator = new Aggregator(db);
  const dataValidator = new DataValidator(
    db,
    () => (aggregator.getMetrics() as { totalTokensK: number }).totalTokensK,
    () => 0,
  );

  const tokenBus = new TokenEventBus();
  const messageBus = new MessageEventBus();

  let tokenEventBuffer: TokenUsageEvent[] = [];
  const flushTokenEvents = () => {
    if (tokenEventBuffer.length > 0) {
      insertTokenUsageEventBatch(db, tokenEventBuffer);
      tokenEventBuffer = [];
    }
  };
  tokenBus.on((event) => {
    tokenEventBuffer.push(event);
    if (tokenEventBuffer.length >= 100) {
      flushTokenEvents();
    }
  });

  let messageEventBuffer: MessageEvent[] = [];
  const flushMessageEvents = () => {
    if (messageEventBuffer.length > 0) {
      insertMessageEventBatch(db, messageEventBuffer);
      sessionReader.invalidateTurnCounts();
      messageEventBuffer = [];
    }
  };
  messageBus.on((event) => {
    messageEventBuffer.push(event);
    if (messageEventBuffer.length >= 100) {
      flushMessageEvents();
    }
  });

  const sessionReader = stubSessionReader();
  const cronReader = stubCronReader();
  const logTailer = stubLogTailer();
  const spawnTracker = stubSpawnTracker();

  const ctx: AppContext = {
    db,
    pipeline: { start() {}, destroy() {} } as unknown as AppContext['pipeline'],
    sessionReader: sessionReader as unknown as AppContext['sessionReader'],
    cronReader: cronReader as unknown as AppContext['cronReader'],
    logTailer: logTailer as unknown as AppContext['logTailer'],
    spawnTracker: spawnTracker as unknown as AppContext['spawnTracker'],
    aggregator,
    systemSampler: { start() {}, destroy() {} } as unknown as AppContext['systemSampler'],
    dataValidator,
    dataRetention: { start() {}, destroy() {} } as unknown as AppContext['dataRetention'],
    lifetimeScanner: stubLifetimeScanner(),
    destroyed: false,
    tokenBus,
    messageBus,
    gatewayClient: stubGatewayClient() as unknown as AppContext['gatewayClient'],
    systemInfoService: stubSystemInfoService() as unknown as AppContext['systemInfoService'],
  };

  const app = express();
  registerGraphQL(app, ctx);

  return {
    app,
    db,
    ctx,
    flushTokenEvents,
    flushMessageEvents,
    clearAggregatorCache() {
      aggregator.clearCache();
    },
    destroy() {
      ctx.destroyed = true;
      flushTokenEvents();
      flushMessageEvents();
      tokenBus.destroy();
      messageBus.destroy();
      if (typeof (db as unknown as { close?: () => void }).close === 'function') {
        (db as unknown as { close(): void }).close();
      }
    },
  };
}
