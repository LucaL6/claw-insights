import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type MessageEvent, MessageEventBus } from '../../../events/message-event-bus';
import { TokenEventBus, type TokenUsageEvent } from '../../../events/token-event-bus';
import { LifetimeScanner } from '../lifetime-scanner';

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'lifetime-test-'));
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

// Helper to build transcript lines
const userMsg = (ts?: string) =>
  writeLine({
    type: 'message',
    timestamp: ts ?? '2025-06-01T00:00:00Z',
    message: { role: 'user', content: 'hello' },
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

  beforeEach(() => {
    dir = tmpDir();
    deviceDir = tmpDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(deviceDir, { recursive: true, force: true });
  });

  // -- Test 1: Empty directory
  it('returns zeros for empty directory', async () => {
    const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
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
    const scanner = new LifetimeScanner('/nonexistent/path', join(deviceDir, 'device.json'));
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

    const scanner = new LifetimeScanner(dir, deviceJson);
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

    const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
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

    const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
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

    const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
    await scanner.init();
    const stats = await scanner.getStats();

    expect(stats.totalAssistantMessages).toBe(2);
    expect(stats.totalInputTokens).toBe(100);
  });

  // -- Test 7: Empty .jsonl file
  it('handles empty .jsonl file', async () => {
    writeFileSync(join(dir, 'empty.jsonl'), '');
    makeTranscript(dir, 'valid.jsonl', [userMsg(), assistantMsg({ input: 10, output: 5 })]);

    const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
    await scanner.init();
    const stats = await scanner.getStats();

    expect(stats.totalSessions).toBe(2); // both files counted
    expect(stats.totalUserMessages).toBe(1);
  });

  // ── Incremental Tests ──

  describe('incremental refresh', () => {
    // -- Test 8: File append detected
    it('picks up appended lines on refresh', async () => {
      const file = join(dir, 'growing.jsonl');
      writeFileSync(file, [sessionLine(), userMsg(), assistantMsg({ input: 100, output: 50 })].join('\n') + '\n');

      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
      await scanner.init();

      let stats = await scanner.getStats();
      expect(stats.totalUserMessages).toBe(1);
      expect(stats.totalAssistantMessages).toBe(1);

      // Append more lines (simulate OpenClaw writing)
      const { appendFileSync } = await import('node:fs');
      appendFileSync(file, [userMsg(), assistantMsg({ input: 200, output: 100 })].join('\n') + '\n');

      // Force refresh (bypass cooldown for test)
      (scanner as any).lastRefreshMs = 0;
      stats = await scanner.getStats();

      expect(stats.totalUserMessages).toBe(2);
      expect(stats.totalAssistantMessages).toBe(2);
      expect(stats.totalInputTokens).toBe(300);
      expect(stats.totalOutputTokens).toBe(150);
    });

    // -- Test 9: New file appears
    it('discovers new files on refresh', async () => {
      makeTranscript(dir, 'first.jsonl', [userMsg(), assistantMsg({ input: 100, output: 50 })]);

      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
      await scanner.init();

      expect((await scanner.getStats()).totalSessions).toBe(1);

      // Add new file
      makeTranscript(dir, 'second.jsonl', [userMsg(), assistantMsg({ input: 200, output: 100 })]);

      (scanner as any).lastRefreshMs = 0;
      const stats = await scanner.getStats();

      expect(stats.totalSessions).toBe(2);
      expect(stats.totalInputTokens).toBe(300);
    });

    // -- Test 10: Partial line handling
    it('buffers partial lines and completes them next refresh', async () => {
      const file = join(dir, 'partial.jsonl');
      const completeLine = userMsg();
      // Write complete line + half of next line (no trailing \n)
      const halfLine = '{"type":"message","message":{"role":"assistant","content":"hi"';
      writeFileSync(file, completeLine + '\n' + halfLine);

      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
      await scanner.init();

      let stats = await scanner.getStats();
      expect(stats.totalUserMessages).toBe(1);
      expect(stats.totalAssistantMessages).toBe(0); // partial not counted

      // Complete the line
      const { appendFileSync } = await import('node:fs');
      const rest = ',"usage":{"input":100,"output":50}}}\n';
      appendFileSync(file, rest);

      (scanner as any).lastRefreshMs = 0;
      stats = await scanner.getStats();

      expect(stats.totalAssistantMessages).toBe(1);
      expect(stats.totalInputTokens).toBe(100);
    });

    // -- Test 11: File deleted after scan
    it('handles file deletion gracefully', async () => {
      makeTranscript(dir, 'ephemeral.jsonl', [userMsg(), assistantMsg({ input: 100, output: 50 })]);
      makeTranscript(dir, 'permanent.jsonl', [userMsg(), assistantMsg({ input: 200, output: 100 })]);

      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
      await scanner.init();

      expect((await scanner.getStats()).totalSessions).toBe(2);

      // Delete one file
      rmSync(join(dir, 'ephemeral.jsonl'));
      (scanner as any).lastRefreshMs = 0;
      const stats = await scanner.getStats();

      // Session count drops, but aggregated tokens remain (documented behavior)
      expect(stats.totalSessions).toBe(1);
      // No crash
    });
  });

  // ── Usage normalization ──

  describe('normalizeUsage', () => {
    // -- Test 12: Anthropic format
    it('normalizes Anthropic usage format', async () => {
      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
      const result = scanner.normalizeUsage({
        input: 100,
        output: 50,
        cacheRead: 10,
        cacheWrite: 5,
      });
      expect(result).toEqual({ input: 100, output: 50, cacheRead: 10, cacheWrite: 5 });
    });

    // -- Test 13: OpenAI format
    it('normalizes OpenAI usage format', async () => {
      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
      const result = scanner.normalizeUsage({ prompt_tokens: 100, completion_tokens: 50 });
      expect(result).toEqual({ input: 100, output: 50, cacheRead: 0, cacheWrite: 0 });
    });

    // -- Test 14: Anthropic API snake_case format
    it('normalizes Anthropic API format', async () => {
      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
      const result = scanner.normalizeUsage({
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 20,
        cache_creation_input_tokens: 10,
      });
      expect(result).toEqual({ input: 100, output: 50, cacheRead: 20, cacheWrite: 10 });
    });

    // -- Test 15: null/undefined usage
    it('returns null for null/undefined usage', async () => {
      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
      expect(scanner.normalizeUsage(null)).toBeNull();
      expect(scanner.normalizeUsage(undefined)).toBeNull();
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

      const scanner = new LifetimeScanner(dir, deviceJson);
      await scanner.init();
      const stats = await scanner.getStats();

      expect(new Date(stats.createdAt).getTime()).toBe(new Date(olderTs).getTime());
    });

    // -- Test 17: device.json only (no transcripts)
    it('uses device.json when no transcripts exist', async () => {
      const deviceMs = new Date('2025-03-15T00:00:00Z').getTime();
      const deviceJson = makeDeviceJson(deviceDir, deviceMs);

      const scanner = new LifetimeScanner(dir, deviceJson);
      await scanner.init();
      const stats = await scanner.getStats();

      expect(new Date(stats.createdAt).getTime()).toBe(deviceMs);
    });
  });

  // ── Concurrency ──

  describe('concurrency', () => {
    // -- Test 18: Concurrent getStats() calls
    it('handles concurrent getStats without double counting', async () => {
      makeTranscript(dir, 'session.jsonl', [userMsg(), assistantMsg({ input: 100, output: 50 })]);

      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
      await scanner.init();

      // Force cooldown to 0 so all calls trigger refresh
      const origCooldown = LifetimeScanner.REFRESH_COOLDOWN_MS;
      (scanner as any).lastRefreshMs = 0;
      LifetimeScanner.REFRESH_COOLDOWN_MS = 0;

      // Fire 10 concurrent calls
      const results = await Promise.all(Array.from({ length: 10 }, () => scanner.getStats()));

      // All results should be identical (no double count)
      for (const stats of results) {
        expect(stats.totalInputTokens).toBe(100);
        expect(stats.totalOutputTokens).toBe(50);
      }

      // Restore cooldown
      LifetimeScanner.REFRESH_COOLDOWN_MS = origCooldown;
    });
  });

  // ── Staleness guard ──

  describe('staleness guard', () => {
    // -- Test 19: Second call within cooldown skips refresh
    it('skips refresh within cooldown period', async () => {
      makeTranscript(dir, 'session.jsonl', [userMsg(), assistantMsg({ input: 100, output: 50 })]);

      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
      await scanner.init();

      const stats1 = await scanner.getStats();

      // Append data
      const { appendFileSync } = await import('node:fs');
      appendFileSync(join(dir, 'session.jsonl'), userMsg() + '\n');

      // Call again immediately (within 5s cooldown)
      const stats2 = await scanner.getStats();

      // Should NOT see the new message (refresh was skipped)
      expect(stats2.totalUserMessages).toBe(stats1.totalUserMessages);
    });
  });

  // ── Truncate / Inode change ──

  describe('truncate and inode change', () => {
    // -- Test 21: File truncated (size shrinks) triggers correct rescan
    it('calls onBeforeRescan before full rescan on truncation', async () => {
      const file = join(dir, 'callback.jsonl');
      writeFileSync(file, [sessionLine(), userMsg(), assistantMsg({ input: 100, output: 50 })].join('\n') + '\n');

      const onBeforeRescan = vi.fn();
      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'), undefined, undefined, onBeforeRescan);
      await scanner.init();
      onBeforeRescan.mockClear();

      writeFileSync(file, [sessionLine(), userMsg()].join('\n') + '\n');
      (scanner as any).lastRefreshMs = 0;
      await scanner.getStats();

      expect(onBeforeRescan).toHaveBeenCalledTimes(1);
    });

    it('handles file truncation without double counting', async () => {
      const file = join(dir, 'truncated.jsonl');
      writeFileSync(
        file,
        [
          sessionLine(),
          userMsg(),
          assistantMsg({ input: 100, output: 50 }),
          userMsg(),
          assistantMsg({ input: 200, output: 100 }),
        ].join('\n') + '\n',
      );

      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
      await scanner.init();

      let stats = await scanner.getStats();
      expect(stats.totalInputTokens).toBe(300); // 100+200
      expect(stats.totalUserMessages).toBe(2);

      // Truncate: rewrite with less data (same filename, same inode on most OS)
      writeFileSync(file, [sessionLine(), userMsg(), assistantMsg({ input: 50, output: 25 })].join('\n') + '\n');

      (scanner as any).lastRefreshMs = 0;
      stats = await scanner.getStats();

      // After rescan, should reflect new file content only — not old + new
      expect(stats.totalInputTokens).toBe(50);
      expect(stats.totalOutputTokens).toBe(25);
      expect(stats.totalUserMessages).toBe(1);
      expect(stats.totalAssistantMessages).toBe(1);
    });

    // -- Test 22: File replaced (new inode) triggers correct rescan
    it('handles inode change (file replace) without double counting', async () => {
      const filePath = join(dir, 'replaced.jsonl');
      writeFileSync(filePath, [sessionLine(), userMsg(), assistantMsg({ input: 100, output: 50 })].join('\n') + '\n');

      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'));
      await scanner.init();

      let stats = await scanner.getStats();
      expect(stats.totalInputTokens).toBe(100);

      // Replace file: delete + create new (new inode)
      rmSync(filePath);
      writeFileSync(filePath, [sessionLine(), userMsg(), assistantMsg({ input: 500, output: 250 })].join('\n') + '\n');

      (scanner as any).lastRefreshMs = 0;
      stats = await scanner.getStats();

      // Should reflect replacement data, not original + replacement
      expect(stats.totalInputTokens).toBe(500);
      expect(stats.totalOutputTokens).toBe(250);
      expect(stats.totalSessions).toBe(1);
    });

    // -- Test 23: createdAt uses first parseable timestamp (not just first line)
    it('finds timestamp from non-first line', async () => {
      const deviceMs = new Date('2026-01-01T00:00:00Z').getTime();
      const deviceJson = makeDeviceJson(deviceDir, deviceMs);
      const earlyTs = '2025-06-15T00:00:00Z';

      // First line has no timestamp, second line does
      makeTranscript(dir, 'weird.jsonl', [
        writeLine({ type: 'session', model: 'claude-3' }), // no timestamp
        writeLine({ type: 'message', timestamp: earlyTs, message: { role: 'user', content: 'hi' } }),
      ]);

      const scanner = new LifetimeScanner(dir, deviceJson);
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
      const scanner1 = new LifetimeScanner(dir, deviceJson);
      await scanner1.init();
      const stats1 = await scanner1.getStats();
      scanner1.destroy();

      // "Restart" — new instance, same data
      const scanner2 = new LifetimeScanner(dir, deviceJson);
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

      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'), undefined, bus);
      await scanner.init();

      expect(events).toEqual([
        { timestamp: '2025-06-01T00:00:00Z', sessionKey: 'sess-msg', role: 'user' },
        { timestamp: '2025-06-01T00:00:01Z', sessionKey: 'sess-msg', role: 'assistant' },
        { timestamp: '2025-06-01T00:00:02Z', sessionKey: 'sess-msg', role: 'tool' },
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

      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'), bus);
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

    it('emits events during incremental refresh', async () => {
      const bus = new TokenEventBus();
      const events: TokenUsageEvent[] = [];
      bus.on((e) => events.push(e));

      makeTranscript(dir, 'sess-inc.jsonl', [
        sessionLine(),
        userMsg(),
        assistantMsgWithModel({ input: 100, output: 50 }, 'claude-opus-4-6'),
      ]);

      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'), bus);
      await scanner.init();

      events.length = 0; // clear init events

      const { appendFileSync } = await import('node:fs');
      appendFileSync(
        join(dir, 'sess-inc.jsonl'),
        '\n' +
          userMsg() +
          '\n' +
          assistantMsgWithModel({ input: 300, output: 150 }, 'gpt-4o', '2025-06-01T00:03:00Z') +
          '\n',
      );

      (scanner as Record<string, unknown>).lastRefreshMs = 0;
      await scanner.getStats();

      expect(events.length).toBe(1);
      expect(events[0].inputTokens).toBe(300);
      expect(events[0].model).toBe('gpt-4o');
      expect(events[0].sessionKey).toBe('sess-inc');
    });

    it('skips emit when model is missing', async () => {
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

      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'), bus);
      await scanner.init();

      expect(events.length).toBe(0);
      // But the message is still counted in stats
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

      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'), bus);
      await scanner.init();

      expect(events.length).toBe(0);
      const stats = await scanner.getStats();
      expect(stats.totalAssistantMessages).toBe(1);
    });

    it('does not emit for non-assistant messages', async () => {
      const bus = new TokenEventBus();
      const events: TokenUsageEvent[] = [];
      bus.on((e) => events.push(e));

      makeTranscript(dir, 'sess-user.jsonl', [sessionLine(), userMsg(), userMsg(), userMsg()]);

      const scanner = new LifetimeScanner(dir, join(deviceDir, 'device.json'), bus);
      await scanner.init();

      expect(events.length).toBe(0);
    });
  });
});
