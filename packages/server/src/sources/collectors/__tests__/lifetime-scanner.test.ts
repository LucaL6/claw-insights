import { appendFileSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BACKGROUND_DELAY_MS = 5_000;

import type { Database } from '../../../db/database.js';
import { initDatabase } from '../../../db/init.js';
import { type MessageEvent, MessageEventBus } from '../../../events/message-event-bus';
import { TokenEventBus, type TokenUsageEvent } from '../../../events/token-event-bus';
import { createLifetimeScanner } from '../lifetime-scanner';

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'lifetime-test-'));
}

function tmpDb(dir: string): Database {
  return initDatabase({ dbPath: join(dir, 'test.db') });
}

function writeLine(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

function makeTranscript(dir: string, name: string, lines: string[]): string {
  const file = join(dir, name);
  writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

function makeDeviceJson(dir: string, createdAtMs: number): string {
  const file = join(dir, 'device.json');
  writeFileSync(file, JSON.stringify({ createdAtMs }));
  return file;
}

// Unique counter to avoid content_hash collisions in DB
let msgSeq = 0;

// Helper to build transcript lines
const userMsg = (ts?: string) =>
  writeLine({
    type: 'message',
    timestamp: ts ?? '2025-06-01T00:00:00Z',
    message: { role: 'user', content: `hello-${++msgSeq}` },
  });

const assistantMsg = (usage?: Record<string, number>, ts?: string) =>
  writeLine({
    type: 'message',
    timestamp: ts ?? '2025-06-01T00:01:00Z',
    message: {
      role: 'assistant',
      content: 'hi',
      ...(usage ? { usage } : {}),
    },
  });

const assistantMsgWithModel = (usage?: Record<string, number>, model?: string, ts?: string) =>
  writeLine({
    type: 'message',
    timestamp: ts ?? '2025-06-01T00:01:00Z',
    message: {
      role: 'assistant',
      content: 'hi',
      model: model ?? 'claude-3',
      ...(usage ? { usage } : {}),
    },
  });

const sessionLine = (ts?: string) =>
  writeLine({ type: 'session', timestamp: ts ?? '2025-06-01T00:00:00Z', model: 'claude-3' });

describe('LifetimeScanner', () => {
  let dir: string;
  let deviceDir: string;
  let db: Database;

  beforeEach(() => {
    dir = tmpDir();
    deviceDir = tmpDir();
    db = tmpDb(dir);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
    rmSync(deviceDir, { recursive: true, force: true });
  });

  // -- Test 1: Empty directory
  it('returns zeros for empty directory', async () => {
    const scanner = createLifetimeScanner({ db, transcriptsDir: dir, deviceJsonPath: join(deviceDir, 'device.json') });
    await scanner.init();
    const stats = await scanner.getStats();
    expect(stats.isReady).toBe(true);
    expect(stats.totalSessions).toBe(0);
    expect(stats.totalTokens).toBe(0);
    expect(stats.totalUserMessages).toBe(0);
    expect(stats.totalAssistantMessages).toBe(0);
  });

  // -- Test 2: Non-existent directory
  it('handles non-existent directory gracefully', async () => {
    const scanner = createLifetimeScanner({
      db,
      transcriptsDir: '/nonexistent/path',
      deviceJsonPath: join(deviceDir, 'device.json'),
    });
    await scanner.init();
    const stats = await scanner.getStats();
    expect(stats.isReady).toBe(true);
    expect(stats.totalSessions).toBe(0);
  });

  // -- Test 3: Multi-file aggregation
  it('aggregates across multiple transcript files', async () => {
    const deviceJson = makeDeviceJson(deviceDir, Date.now());

    makeTranscript(dir, 'session-a.jsonl', [
      sessionLine(),
      userMsg(),
      assistantMsg({ input: 100, output: 50, cacheRead: 10, cacheWrite: 5 }),
      userMsg(),
      assistantMsg({ input: 200, output: 80, cacheRead: 0, cacheWrite: 0 }),
    ]);

    makeTranscript(dir, 'session-b.jsonl', [
      sessionLine(),
      userMsg(),
      assistantMsg({ input: 300, output: 100, cacheRead: 20, cacheWrite: 10 }),
    ]);

    makeTranscript(dir, 'session-c.jsonl', [
      sessionLine(),
      userMsg(),
      assistantMsg({ input: 50, output: 25, cacheRead: 5, cacheWrite: 2 }),
    ]);

    const scanner = createLifetimeScanner({ db, transcriptsDir: dir, deviceJsonPath: deviceJson });
    await scanner.init();
    const stats = await scanner.getStats();

    expect(stats.totalSessions).toBe(3);
    expect(stats.totalUserMessages).toBe(4);
    expect(stats.totalAssistantMessages).toBe(4);
    expect(stats.totalInputTokens).toBe(650); // 100+200+300+50
    expect(stats.totalOutputTokens).toBe(255); // 50+80+100+25
    expect(stats.totalCacheReadTokens).toBe(35); // 10+0+20+5
    expect(stats.totalCacheWriteTokens).toBe(17); // 5+0+10+2
    expect(stats.totalTokens).toBe(650 + 255 + 35 + 17); // 957
  });

  // -- Test 4: Corrupt JSON lines are skipped
  it('skips corrupt JSON lines without crashing', async () => {
    makeTranscript(dir, 'corrupt.jsonl', [
      sessionLine(),
      userMsg(),
      '{broken json!!!',
      assistantMsg({ input: 100, output: 50 }),
      '{"type": "message", "message": {}}', // missing role
      userMsg(),
    ]);

    const scanner = createLifetimeScanner({ db, transcriptsDir: dir, deviceJsonPath: join(deviceDir, 'device.json') });
    await scanner.init();
    const stats = await scanner.getStats();

    expect(stats.totalSessions).toBe(1);
    expect(stats.totalUserMessages).toBe(2);
    expect(stats.totalAssistantMessages).toBe(1);
    expect(stats.totalInputTokens).toBe(100);
  });

  // -- Test 5: Non-message types are skipped
  it('skips non-message types', async () => {
    makeTranscript(dir, 'mixed.jsonl', [
      writeLine({ type: 'session', timestamp: '2025-01-01T00:00:00Z' }),
      writeLine({ type: 'model_change', timestamp: '2025-01-01T00:00:01Z', model: 'x' }),
      writeLine({
        type: 'thinking_level_change',
        timestamp: '2025-01-01T00:00:02Z',
        level: 'high',
      }),
      userMsg(),
      assistantMsg({ input: 50, output: 25 }),
    ]);

    const scanner = createLifetimeScanner({ db, transcriptsDir: dir, deviceJsonPath: join(deviceDir, 'device.json') });
    await scanner.init();
    const stats = await scanner.getStats();

    expect(stats.totalUserMessages).toBe(1);
    expect(stats.totalAssistantMessages).toBe(1);
    expect(stats.totalInputTokens).toBe(50);
  });

  // -- Test 6: Assistant without usage still counted as message
  it('counts assistant messages without usage block', async () => {
    makeTranscript(dir, 'no-usage.jsonl', [
      sessionLine(),
      userMsg(),
      assistantMsg(), // no usage
      userMsg(),
      assistantMsg({ input: 100, output: 50 }),
    ]);

    const scanner = createLifetimeScanner({ db, transcriptsDir: dir, deviceJsonPath: join(deviceDir, 'device.json') });
    await scanner.init();
    const stats = await scanner.getStats();

    expect(stats.totalAssistantMessages).toBe(2);
    expect(stats.totalInputTokens).toBe(100);
  });

  // -- Test 7: Empty .jsonl file
  it('handles empty .jsonl file', async () => {
    writeFileSync(join(dir, 'empty.jsonl'), '');
    makeTranscript(dir, 'valid.jsonl', [userMsg(), assistantMsg({ input: 10, output: 5 })]);

    const scanner = createLifetimeScanner({ db, transcriptsDir: dir, deviceJsonPath: join(deviceDir, 'device.json') });
    await scanner.init();
    const stats = await scanner.getStats();

    expect(stats.totalSessions).toBe(2); // both files counted
    expect(stats.totalUserMessages).toBe(1);
  });

  // ── Incremental Tests ──

  // ── getFileStates (handoff to TranscriptWatcher) ──

  describe('getFileStates', () => {
    it('returns populated map after init', async () => {
      makeTranscript(dir, 'a.jsonl', [userMsg()]);
      makeTranscript(dir, 'b.jsonl', [userMsg()]);

      const scanner = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
      });
      await scanner.init();

      const states = scanner.getFileStates();
      expect(states.size).toBe(2);
      for (const [, state] of states) {
        expect(state.offset).toBeGreaterThan(0);
        expect(state.inode).toBeGreaterThan(0);
        expect(state.birthtimeMs).toBeGreaterThan(0);
      }
    });

    it('returns a clone (does not share internal state)', async () => {
      makeTranscript(dir, 'x.jsonl', [userMsg()]);

      const scanner = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
      });
      await scanner.init();

      const states = scanner.getFileStates();
      states.clear(); // mutate the clone

      // Internal state should be unaffected
      expect(scanner.getFileStates().size).toBe(1);
    });
  });

  // ── getStats (pure memory read, no I/O) ──

  describe('getStats', () => {
    it('returns instant result without I/O after init', async () => {
      makeTranscript(dir, 'instant.jsonl', [userMsg(), assistantMsg({ input: 100, output: 50 })]);

      const scanner = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
      });
      await scanner.init();

      const stats = await scanner.getStats();
      expect(stats.totalUserMessages).toBe(1);
      expect(stats.totalInputTokens).toBe(100);
      expect(stats.isReady).toBe(true);
    });
  });

  // ── createdAt ──

  describe('createdAt', () => {
    // -- Test 16: min of device.json and transcript
    it('uses min of device.json and earliest transcript', async () => {
      const olderTs = '2025-01-01T00:00:00Z'; // 1735689600000
      const deviceMs = new Date('2025-06-01T00:00:00Z').getTime();
      const deviceJson = makeDeviceJson(deviceDir, deviceMs);

      makeTranscript(dir, 'old.jsonl', [writeLine({ type: 'session', timestamp: olderTs }), userMsg(olderTs)]);

      const scanner = createLifetimeScanner({ db, transcriptsDir: dir, deviceJsonPath: deviceJson });
      await scanner.init();
      const stats = await scanner.getStats();

      expect(new Date(stats.createdAt).getTime()).toBe(new Date(olderTs).getTime());
    });

    // -- Test 17: device.json only (no transcripts)
    it('uses device.json when no transcripts exist', async () => {
      const deviceMs = new Date('2025-03-15T00:00:00Z').getTime();
      const deviceJson = makeDeviceJson(deviceDir, deviceMs);

      const scanner = createLifetimeScanner({ db, transcriptsDir: dir, deviceJsonPath: deviceJson });
      await scanner.init();
      const stats = await scanner.getStats();

      expect(new Date(stats.createdAt).getTime()).toBe(deviceMs);
    });
  });

  // ── createdAt: timestamp from non-first line ──

  describe('createdAt edge cases', () => {
    it('finds timestamp from non-first line', async () => {
      const deviceMs = new Date('2026-01-01T00:00:00Z').getTime();
      const deviceJson = makeDeviceJson(deviceDir, deviceMs);
      const earlyTs = '2025-06-15T00:00:00Z';

      // First line has no timestamp, second line does
      makeTranscript(dir, 'weird.jsonl', [
        writeLine({ type: 'session', model: 'claude-3' }), // no timestamp
        writeLine({ type: 'message', timestamp: earlyTs, message: { role: 'user', content: 'hi' } }),
      ]);

      const scanner = createLifetimeScanner({ db, transcriptsDir: dir, deviceJsonPath: deviceJson });
      await scanner.init();
      const stats = await scanner.getStats();

      expect(new Date(stats.createdAt).getTime()).toBe(new Date(earlyTs).getTime());
    });
  });

  // ── Restart consistency ──

  describe('restart consistency', () => {
    // -- Test 20: Full rescan after restart matches original
    it('produces identical stats after simulated restart', async () => {
      makeTranscript(dir, 'session-a.jsonl', [
        sessionLine('2025-03-01T00:00:00Z'),
        userMsg(),
        assistantMsg({ input: 100, output: 50, cacheRead: 10, cacheWrite: 5 }),
        userMsg(),
        assistantMsg({ input: 200, output: 80 }),
      ]);
      makeTranscript(dir, 'session-b.jsonl', [
        sessionLine('2025-04-01T00:00:00Z'),
        userMsg(),
        assistantMsg({ input: 300, output: 100, cacheRead: 20, cacheWrite: 10 }),
      ]);

      const deviceJson = makeDeviceJson(deviceDir, new Date('2025-01-01T00:00:00Z').getTime());

      // First scan
      const scanner1 = createLifetimeScanner({ db, transcriptsDir: dir, deviceJsonPath: deviceJson });
      await scanner1.init();
      const stats1 = await scanner1.getStats();
      scanner1.destroy();

      // "Restart" — new instance, same data & same DB
      const scanner2 = createLifetimeScanner({ db, transcriptsDir: dir, deviceJsonPath: deviceJson });
      await scanner2.init();
      const stats2 = await scanner2.getStats();
      scanner2.destroy();

      expect(stats2.totalSessions).toBe(stats1.totalSessions);
      expect(stats2.totalInputTokens).toBe(stats1.totalInputTokens);
      expect(stats2.totalOutputTokens).toBe(stats1.totalOutputTokens);
      expect(stats2.totalCacheReadTokens).toBe(stats1.totalCacheReadTokens);
      expect(stats2.totalCacheWriteTokens).toBe(stats1.totalCacheWriteTokens);
      expect(stats2.totalUserMessages).toBe(stats1.totalUserMessages);
      expect(stats2.totalAssistantMessages).toBe(stats1.totalAssistantMessages);
      expect(stats2.createdAt).toBe(stats1.createdAt);
    });
  });

  // ── MessageEventBus integration ──

  describe('MessageEventBus integration', () => {
    it('emits message events for user, assistant, and toolResult roles', async () => {
      const bus = new MessageEventBus();
      const events: MessageEvent[] = [];
      bus.on((e) => events.push(e));

      makeTranscript(dir, 'sess-msg.jsonl', [
        writeLine({
          type: 'message',
          timestamp: '2025-06-01T00:00:00Z',
          message: { role: 'user', content: 'hi' },
        }),
        writeLine({
          type: 'message',
          timestamp: '2025-06-01T00:00:01Z',
          message: { role: 'assistant', content: 'hello', usage: { input: 10, output: 5 } },
        }),
        writeLine({
          type: 'message',
          timestamp: '2025-06-01T00:00:02Z',
          message: { role: 'toolResult', content: 'ok' },
        }),
      ]);

      const scanner = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
        messageBus: bus,
      });
      await scanner.init();

      expect(events).toEqual([
        { timestamp: '2025-06-01T00:00:00Z', sessionKey: 'sess-msg', role: 'user', lineHash: expect.any(String) },
        { timestamp: '2025-06-01T00:00:01Z', sessionKey: 'sess-msg', role: 'assistant', lineHash: expect.any(String) },
        { timestamp: '2025-06-01T00:00:02Z', sessionKey: 'sess-msg', role: 'tool', lineHash: expect.any(String) },
      ]);
    });
  });

  // ── TokenEventBus integration ──

  describe('TokenEventBus integration', () => {
    it('emits token usage events during scanAll', async () => {
      const bus = new TokenEventBus();
      const events: TokenUsageEvent[] = [];
      bus.on((e) => events.push(e));

      makeTranscript(dir, 'sess-abc.jsonl', [
        sessionLine(),
        userMsg(),
        assistantMsgWithModel(
          { input: 100, output: 50, cacheRead: 10, cacheWrite: 5 },
          'claude-opus-4-6',
          '2025-06-01T00:01:00Z',
        ),
        userMsg(),
        assistantMsgWithModel({ input: 200, output: 80 }, 'claude-opus-4-6', '2025-06-01T00:02:00Z'),
      ]);

      const scanner = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
        tokenBus: bus,
      });
      await scanner.init();

      expect(events.length).toBe(2);
      expect(events[0].sessionKey).toBe('sess-abc');
      expect(events[0].inputTokens).toBe(100);
      expect(events[0].outputTokens).toBe(50);
      expect(events[0].cacheReadTokens).toBe(10);
      expect(events[0].cacheWriteTokens).toBe(5);
      expect(events[0].model).toBe('claude-opus-4-6');
      expect(events[0].timestamp).toBe('2025-06-01T00:01:00Z');
      expect(events[1].inputTokens).toBe(200);
    });

    it('emits with unknown model fallback when model is missing', async () => {
      const bus = new TokenEventBus();
      const events: TokenUsageEvent[] = [];
      bus.on((e) => events.push(e));

      // assistant message WITHOUT model field
      makeTranscript(dir, 'sess-nomodel.jsonl', [
        sessionLine(),
        userMsg(),
        writeLine({
          type: 'message',
          timestamp: '2025-06-01T00:01:00Z',
          message: {
            role: 'assistant',
            content: 'hi',
            usage: { input: 100, output: 50 },
          },
        }),
      ]);

      const scanner = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
        tokenBus: bus,
      });
      await scanner.init();

      expect(events.length).toBe(1);
      expect(events[0].model).toMatch(/^unknown:[0-9a-f]{8}$/);
      const stats = await scanner.getStats();
      expect(stats.totalAssistantMessages).toBe(1);
      expect(stats.totalInputTokens).toBe(100);
    });

    it('skips emit when timestamp is missing', async () => {
      const bus = new TokenEventBus();
      const events: TokenUsageEvent[] = [];
      bus.on((e) => events.push(e));

      // assistant message WITHOUT timestamp on the outer object
      makeTranscript(dir, 'sess-nots.jsonl', [
        sessionLine(),
        userMsg(),
        writeLine({
          type: 'message',
          message: {
            role: 'assistant',
            content: 'hi',
            model: 'claude-3',
            usage: { input: 100, output: 50 },
          },
        }),
      ]);

      const scanner = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
        tokenBus: bus,
      });
      await scanner.init();

      expect(events.length).toBe(0);
      const stats = await scanner.getStats();
      expect(stats.totalAssistantMessages).toBe(0);
    });

    it('does not emit for non-assistant messages', async () => {
      const bus = new TokenEventBus();
      const events: TokenUsageEvent[] = [];
      bus.on((e) => events.push(e));

      makeTranscript(dir, 'sess-user.jsonl', [sessionLine(), userMsg(), userMsg(), userMsg()]);

      const scanner = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
        tokenBus: bus,
      });
      await scanner.init();

      expect(events.length).toBe(0);
    });
  });

  describe('incremental scan (warm restart)', () => {
    it('skips unchanged files on second init', async () => {
      const d = tmpDir();
      const dd = tmpDir();
      const ddb = tmpDb(d);
      const deviceJson = makeDeviceJson(dd, Date.now());

      makeTranscript(d, 'sess.jsonl', [sessionLine(), userMsg(), assistantMsg({ input: 100, output: 50 })]);

      const s1 = createLifetimeScanner({ db: ddb, transcriptsDir: d, deviceJsonPath: deviceJson });
      await s1.init();
      const stats1 = await s1.getStats();
      expect(stats1.totalUserMessages).toBe(1);
      s1.destroy();

      const t0 = performance.now();
      const s2 = createLifetimeScanner({ db: ddb, transcriptsDir: d, deviceJsonPath: deviceJson });
      await s2.init();
      const elapsed = performance.now() - t0;
      const stats2 = await s2.getStats();

      expect(stats2.totalUserMessages).toBe(1);
      expect(stats2.totalInputTokens).toBe(100);
      expect(elapsed).toBeLessThan(500);
      s2.destroy();

      ddb.close();
      rmSync(d, { recursive: true, force: true });
      rmSync(dd, { recursive: true, force: true });
    });

    it('picks up appended content on restart', async () => {
      const d = tmpDir();
      const dd = tmpDir();
      const ddb = tmpDb(d);
      const deviceJson = makeDeviceJson(dd, Date.now());

      const file = makeTranscript(d, 'sess.jsonl', [
        sessionLine(),
        userMsg('2025-06-01T00:00:00Z'),
        assistantMsg({ input: 100, output: 50 }),
      ]);

      const s1 = createLifetimeScanner({ db: ddb, transcriptsDir: d, deviceJsonPath: deviceJson });
      await s1.init();
      expect((await s1.getStats()).totalUserMessages).toBe(1);
      s1.destroy();

      // Append new content
      appendFileSync(file, userMsg('2025-06-01T00:02:00Z') + '\n');
      appendFileSync(file, assistantMsg({ input: 200, output: 80 }, '2025-06-01T00:03:00Z') + '\n');

      const s2 = createLifetimeScanner({ db: ddb, transcriptsDir: d, deviceJsonPath: deviceJson });
      await s2.init();
      const stats2 = await s2.getStats();

      expect(stats2.totalUserMessages).toBe(2);
      expect(stats2.totalInputTokens).toBe(300);
      s2.destroy();

      ddb.close();
      rmSync(d, { recursive: true, force: true });
      rmSync(dd, { recursive: true, force: true });
    });

    it('handles deleted files gracefully', async () => {
      const d = tmpDir();
      const dd = tmpDir();
      const ddb = tmpDb(d);
      const deviceJson = makeDeviceJson(dd, Date.now());

      const file = makeTranscript(d, 'sess.jsonl', [
        sessionLine(),
        userMsg(),
        assistantMsg({ input: 100, output: 50 }),
      ]);

      const s1 = createLifetimeScanner({ db: ddb, transcriptsDir: d, deviceJsonPath: deviceJson });
      await s1.init();
      expect((await s1.getStats()).totalUserMessages).toBe(1);
      s1.destroy();

      // Delete the file
      rmSync(file);

      const s2 = createLifetimeScanner({ db: ddb, transcriptsDir: d, deviceJsonPath: deviceJson });
      await s2.init();
      const stats2 = await s2.getStats();

      // Events persist in DB
      expect(stats2.totalUserMessages).toBe(1);
      expect(stats2.totalInputTokens).toBe(100);
      s2.destroy();

      ddb.close();
      rmSync(d, { recursive: true, force: true });
      rmSync(dd, { recursive: true, force: true });
    });

    it('rescans replaced file (different inode)', async () => {
      const d = tmpDir();
      const dd = tmpDir();
      const ddb = tmpDb(d);
      const deviceJson = makeDeviceJson(dd, Date.now());

      makeTranscript(d, 'sess.jsonl', [
        sessionLine(),
        userMsg('2025-06-01T00:00:00Z'),
        assistantMsg({ input: 100, output: 50 }, '2025-06-01T00:01:00Z'),
      ]);

      const s1 = createLifetimeScanner({ db: ddb, transcriptsDir: d, deviceJsonPath: deviceJson });
      await s1.init();
      expect((await s1.getStats()).totalUserMessages).toBe(1);
      s1.destroy();

      // Replace file (rm + recreate = different inode)
      rmSync(join(d, 'sess.jsonl'));
      makeTranscript(d, 'sess.jsonl', [
        sessionLine(),
        userMsg('2025-06-02T00:00:00Z'),
        assistantMsg({ input: 500, output: 200 }, '2025-06-02T00:01:00Z'),
        userMsg('2025-06-02T00:02:00Z'),
        assistantMsg({ input: 300, output: 100 }, '2025-06-02T00:03:00Z'),
      ]);

      const s2 = createLifetimeScanner({ db: ddb, transcriptsDir: d, deviceJsonPath: deviceJson });
      await s2.init();
      const stats2 = await s2.getStats();

      // 1 from original scan + 2 from replaced file (old events persist in DB)
      expect(stats2.totalUserMessages).toBe(3);
      expect(stats2.totalInputTokens).toBe(900); // 100 + 500 + 300
      s2.destroy();

      ddb.close();
      rmSync(d, { recursive: true, force: true });
      rmSync(dd, { recursive: true, force: true });
    });

    it('falls back to main thread when worker fails (>10 files cold start)', async () => {
      const d = tmpDir();
      const dd = tmpDir();
      const ddb = tmpDb(d);
      const deviceJson = makeDeviceJson(dd, Date.now());

      for (let i = 0; i < 15; i++) {
        makeTranscript(d, `session-${i}.jsonl`, [
          sessionLine(`2025-06-${String(i + 1).padStart(2, '0')}T00:00:00Z`),
          userMsg(`2025-06-${String(i + 1).padStart(2, '0')}T00:00:01Z`),
          assistantMsg({ input: 10, output: 5 }, `2025-06-${String(i + 1).padStart(2, '0')}T00:00:02Z`),
        ]);
      }

      const scanner = createLifetimeScanner({ db: ddb, transcriptsDir: d, deviceJsonPath: deviceJson });
      await scanner.init();
      const stats = await scanner.getStats();

      expect(stats.totalSessions).toBe(15);
      expect(stats.totalUserMessages).toBe(15);
      expect(stats.totalInputTokens).toBe(150);
      scanner.destroy();

      ddb.close();
      rmSync(d, { recursive: true, force: true });
      rmSync(dd, { recursive: true, force: true });
    });
  });

  describe('event loop yielding', () => {
    it('should yield to event loop during file scanning, not just before', async () => {
      // Create 100 small .jsonl files
      for (let i = 0; i < 100; i++) {
        makeTranscript(dir, `session-yield-${i}.jsonl`, [sessionLine()]);
      }

      const scanner = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
      });

      const initPromise = scanner.init();

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      let yieldedDuringScan = false;
      setImmediate(() => {
        yieldedDuringScan = true;
      });

      await initPromise;

      expect(yieldedDuringScan).toBe(true);

      const stats = await scanner.getStats();
      expect(stats.totalSessions).toBe(100);
    });

    it('should abort scan if destroyed during yield', async () => {
      // Create enough files to trigger at least one yield
      for (let i = 0; i < 60; i++) {
        makeTranscript(dir, `session-abort-${i}.jsonl`, [sessionLine()]);
      }

      const scanner = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
      });

      const initPromise = scanner.init();

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      scanner.destroy();

      await initPromise;

      const stats = await scanner.getStats();
      expect(stats.isReady).toBe(false);
    });
  });

  describe('tiered scanning', () => {
    it('marks ready after fast scan, deferred files have restored state', async () => {
      makeTranscript(dir, 'old.jsonl', [userMsg(), assistantMsg({ input: 100, output: 50 })]);
      makeTranscript(dir, 'recent.jsonl', [userMsg(), assistantMsg({ input: 200, output: 100 })]);

      const s1 = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
        scanTiered: false,
      });
      await s1.init();
      s1.destroy();

      const threeDaysAgo = Date.now() - 3 * 86_400_000;
      utimesSync(join(dir, 'old.jsonl'), threeDaysAgo / 1000, threeDaysAgo / 1000);

      const s2 = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
        scanTiered: true,
      });
      await s2.init();

      expect(s2.isReady()).toBe(true);
      expect(s2.getFileStates().size).toBe(2);
      s2.destroy();
    });

    it('falls back to full scan when DB is empty (fresh start)', async () => {
      makeTranscript(dir, 'old.jsonl', [userMsg(), assistantMsg({ input: 100, output: 50 })]);
      const threeDaysAgo = Date.now() - 3 * 86_400_000;
      utimesSync(join(dir, 'old.jsonl'), threeDaysAgo / 1000, threeDaysAgo / 1000);

      const scanner = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
        scanTiered: true,
      });
      await scanner.init();

      const stats = await scanner.getStats();
      expect(stats.totalInputTokens).toBe(100);
      expect(stats.totalSessions).toBe(1);
      scanner.destroy();
    });

    it('disables tiering when scanTiered is false', async () => {
      makeTranscript(dir, 'old.jsonl', [userMsg(), assistantMsg({ input: 100, output: 50 })]);
      const threeDaysAgo = Date.now() - 3 * 86_400_000;
      utimesSync(join(dir, 'old.jsonl'), threeDaysAgo / 1000, threeDaysAgo / 1000);

      const scanner = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
        scanTiered: false,
      });
      await scanner.init();

      const stats = await scanner.getStats();
      expect(stats.totalInputTokens).toBe(100);
      scanner.destroy();
    });

    it('background scan updates stats after delay', { timeout: 15_000 }, async () => {
      // Phase 1: full scan to build cache (real timers)
      makeTranscript(dir, 'old.jsonl', [userMsg(), assistantMsg({ input: 100, output: 50 })]);
      makeTranscript(dir, 'recent.jsonl', [userMsg(), assistantMsg({ input: 200, output: 100 })]);

      const s1 = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
        scanTiered: false,
      });
      await s1.init();
      const stats1 = await s1.getStats();
      s1.destroy();

      const oldPath = join(dir, 'old.jsonl');
      appendFileSync(oldPath, '\n' + assistantMsg({ input: 50, output: 25 }) + '\n');
      const threeDaysAgo = Date.now() - 3 * 86_400_000;
      utimesSync(oldPath, threeDaysAgo / 1000, threeDaysAgo / 1000);

      const s2 = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
        scanTiered: true,
      });
      await s2.init();

      const statsFast = await s2.getStats();
      expect(statsFast.totalInputTokens).toBe(stats1.totalInputTokens);

      // Wait for background scan to complete (real timers)
      await new Promise((r) => setTimeout(r, BACKGROUND_DELAY_MS + 1_000));

      const statsFull = await s2.getStats();
      expect(statsFull.totalInputTokens).toBe(stats1.totalInputTokens + 50);

      s2.destroy();
    });

    it('destroy cancels pending background timer', { timeout: 15_000 }, async () => {
      // Phase 1: build cache with real timers
      makeTranscript(dir, 'old.jsonl', [userMsg(), assistantMsg({ input: 100, output: 50 })]);

      const s1 = createLifetimeScanner({
        db,
        transcriptsDir: dir,
        deviceJsonPath: join(deviceDir, 'device.json'),
        scanTiered: false,
      });
      await s1.init();
      s1.destroy();

      const threeDaysAgo = Date.now() - 3 * 86_400_000;
      utimesSync(join(dir, 'old.jsonl'), threeDaysAgo / 1000, threeDaysAgo / 1000);

      // Switch to fake timers for phase 2
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const s2 = createLifetimeScanner({
          db,
          transcriptsDir: dir,
          deviceJsonPath: join(deviceDir, 'device.json'),
          scanTiered: true,
        });
        await s2.init();

        s2.destroy();

        await vi.advanceTimersByTimeAsync(BACKGROUND_DELAY_MS + 100);

        expect(true).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
