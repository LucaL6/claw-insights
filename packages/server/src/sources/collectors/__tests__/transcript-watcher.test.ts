import { appendFileSync, chmodSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type MessageEvent, MessageEventBus } from '../../../events/message-event-bus';
import { TokenEventBus, type TokenUsageEvent } from '../../../events/token-event-bus';
import type { FileState } from '../lifetime-scanner';
import { createTranscriptWatcher } from '../transcript-watcher';

// ── Helpers ──

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'tw-test-'));
}

function writeLine(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

const userMsg = (ts?: string) =>
  writeLine({
    type: 'message',
    timestamp: ts ?? '2025-06-01T00:00:00Z',
    message: { role: 'user', content: 'hello' },
  });

const assistantMsg = (usage?: Record<string, number>, model?: string, ts?: string) =>
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

function makeFile(dir: string, name: string, lines: string[]): string {
  const path = join(dir, name);
  writeFileSync(path, lines.join('\n') + '\n');
  return path;
}

function fileState(path: string, offset: number): [string, FileState] {
  const st = statSync(path);
  return [path, { offset, inode: st.ino, birthtimeMs: st.birthtimeMs, partialLine: '' }];
}

// ── Tests ──

describe('TranscriptWatcher', () => {
  let dir: string;
  let tokenBus: TokenEventBus;
  let messageBus: MessageEventBus;
  let tokenEvents: TokenUsageEvent[];
  let messageEvents: MessageEvent[];

  beforeEach(() => {
    vi.useFakeTimers();
    dir = tmpDir();
    tokenBus = new TokenEventBus();
    messageBus = new MessageEventBus();
    tokenEvents = [];
    messageEvents = [];
    tokenBus.on((e) => tokenEvents.push(e));
    messageBus.on((e) => messageEvents.push(e));
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  // ── Builder chain ──

  describe('builder', () => {
    it('all methods return builder, start() returns TranscriptWatcher', () => {
      const path = makeFile(dir, 'a.jsonl', [userMsg()]);
      const builder = createTranscriptWatcher(dir);
      const b2 = builder.pollEvery(5000);
      expect(b2).toBe(builder);
      const b3 = builder.dirScanEvery(30_000);
      expect(b3).toBe(builder);
      const b4 = builder.byteBudget(1024);
      expect(b4).toBe(builder);
      const b5 = builder.emitTo(tokenBus, messageBus);
      expect(b5).toBe(builder);
      const b6 = builder.onFlush(() => {});
      expect(b6).toBe(builder);

      const states = new Map([fileState(path, 0)]);
      const watcher = builder.start(states);
      expect(watcher).toHaveProperty('destroy');
      watcher.destroy();
    });

    it('start() without emitTo() throws', () => {
      expect(() => {
        createTranscriptWatcher(dir).start(new Map());
      }).toThrow('emitTo');
    });

    it('start() with non-existent dir warns but does not throw', () => {
      const watcher = createTranscriptWatcher('/tmp/nonexistent-tw-dir-12345')
        .emitTo(tokenBus, messageBus)
        .start(new Map());
      watcher.destroy();
    });
  });

  // ── Poll: new bytes → events emitted ──

  describe('poll', () => {
    it('emits events for new bytes in known files', () => {
      const content = [userMsg(), assistantMsg({ input: 100, output: 50 })];
      const path = makeFile(dir, 'session1.jsonl', content);
      const states = new Map([fileState(path, 0)]);

      const flushFn = vi.fn();
      const watcher = createTranscriptWatcher(dir)
        .pollEvery(100)
        .emitTo(tokenBus, messageBus)
        .onFlush(flushFn)
        .start(states);

      vi.advanceTimersByTime(100);

      expect(messageEvents).toHaveLength(2); // user + assistant
      expect(messageEvents[0].role).toBe('user');
      expect(messageEvents[1].role).toBe('assistant');
      expect(tokenEvents).toHaveLength(1);
      expect(tokenEvents[0].inputTokens).toBe(100);
      expect(flushFn).toHaveBeenCalled();

      watcher.destroy();
    });

    it('does not emit when no new bytes', () => {
      const content = [userMsg()];
      const path = makeFile(dir, 'session2.jsonl', content);
      // Offset at file end — nothing new
      const st = statSync(path);
      const states = new Map<string, FileState>([
        [path, { offset: st.size, inode: st.ino, birthtimeMs: st.birthtimeMs, partialLine: '' }],
      ]);

      const watcher = createTranscriptWatcher(dir).pollEvery(100).emitTo(tokenBus, messageBus).start(states);

      vi.advanceTimersByTime(100);
      expect(messageEvents).toHaveLength(0);
      expect(tokenEvents).toHaveLength(0);
      watcher.destroy();
    });

    it('emits events for appended bytes after start', () => {
      const path = makeFile(dir, 'session3.jsonl', [userMsg()]);
      const st = statSync(path);
      // Start at end of file
      const states = new Map<string, FileState>([
        [path, { offset: st.size, inode: st.ino, birthtimeMs: st.birthtimeMs, partialLine: '' }],
      ]);

      const watcher = createTranscriptWatcher(dir).pollEvery(100).emitTo(tokenBus, messageBus).start(states);

      // Append new line
      appendFileSync(path, assistantMsg({ input: 200, output: 100 }, 'gpt-4', '2025-06-01T00:02:00Z') + '\n');

      vi.advanceTimersByTime(100);
      expect(messageEvents).toHaveLength(1);
      expect(messageEvents[0].role).toBe('assistant');
      expect(tokenEvents).toHaveLength(1);
      expect(tokenEvents[0].model).toBe('gpt-4');
      watcher.destroy();
    });

    it('handles partial lines across polls', () => {
      const path = makeFile(dir, 'partial.jsonl', []);
      // Write half a line
      const fullLine = userMsg('2025-06-01T00:05:00Z');
      const half1 = fullLine.slice(0, 20);
      const half2 = fullLine.slice(20) + '\n';
      writeFileSync(path, half1);

      const st = statSync(path);
      const states = new Map<string, FileState>([
        [path, { offset: 0, inode: st.ino, birthtimeMs: st.birthtimeMs, partialLine: '' }],
      ]);

      const watcher = createTranscriptWatcher(dir).pollEvery(100).emitTo(tokenBus, messageBus).start(states);

      // First poll: partial line, no events
      vi.advanceTimersByTime(100);
      expect(messageEvents).toHaveLength(0);

      // Complete the line
      appendFileSync(path, half2);

      // Second poll: line complete
      vi.advanceTimersByTime(100);
      expect(messageEvents).toHaveLength(1);
      expect(messageEvents[0].role).toBe('user');
      watcher.destroy();
    });
  });

  // ── Truncation detection ──

  describe('truncation', () => {
    it('resets offset on truncated file', () => {
      const content = [
        userMsg('2025-06-01T00:00:00Z'),
        assistantMsg({ input: 10, output: 5 }, 'claude', '2025-06-01T00:01:00Z'),
      ];
      const path = makeFile(dir, 'trunc.jsonl', content);
      const st = statSync(path);

      // Start at end
      const states = new Map<string, FileState>([
        [path, { offset: st.size, inode: st.ino, birthtimeMs: st.birthtimeMs, partialLine: '' }],
      ]);

      const watcher = createTranscriptWatcher(dir).pollEvery(100).emitTo(tokenBus, messageBus).start(states);

      // Truncate to just user msg
      writeFileSync(path, userMsg('2025-06-01T00:10:00Z') + '\n');

      vi.advanceTimersByTime(100);
      // Should re-read from 0 and emit the user message
      expect(messageEvents.length).toBeGreaterThanOrEqual(1);
      expect(messageEvents[0].role).toBe('user');
      watcher.destroy();
    });
  });

  // ── Dir scan ──

  describe('dirScan', () => {
    it('discovers new files and scans from offset 0', () => {
      // Start with empty states
      const watcher = createTranscriptWatcher(dir)
        .pollEvery(100)
        .dirScanEvery(200)
        .emitTo(tokenBus, messageBus)
        .start(new Map());

      // No files yet
      vi.advanceTimersByTime(100);
      expect(messageEvents).toHaveLength(0);

      // Add a new file
      makeFile(dir, 'new-session.jsonl', [
        userMsg('2025-07-01T00:00:00Z'),
        assistantMsg({ input: 50, output: 25 }, 'claude', '2025-07-01T00:01:00Z'),
      ]);

      // Dir scan interval
      vi.advanceTimersByTime(200);
      // Then poll to read it
      vi.advanceTimersByTime(100);

      expect(messageEvents.length).toBeGreaterThanOrEqual(2);
      watcher.destroy();
    });

    it('dirScan returns early when dir does not exist (L200)', () => {
      const nonExistentDir = join(tmpdir(), `tw-no-exist-${Date.now()}`);
      const watcher = createTranscriptWatcher(nonExistentDir)
        .pollEvery(100)
        .dirScanEvery(100)
        .emitTo(tokenBus, messageBus)
        .start(new Map());

      // Trigger dirScan — should return early without error
      vi.advanceTimersByTime(200);
      expect(messageEvents).toHaveLength(0);
      watcher.destroy();
    });

    it('handles stat failure on new file gracefully (L220)', () => {
      const watcher = createTranscriptWatcher(dir)
        .pollEvery(100)
        .dirScanEvery(100)
        .emitTo(tokenBus, messageBus)
        .start(new Map());

      const path = makeFile(dir, 'stat-fail.jsonl', [userMsg()]);
      rmSync(path);
      symlinkSync('/nonexistent/path', path);

      vi.advanceTimersByTime(200);
      watcher.destroy();
      rmSync(path);
    });

    it('handles readdir error in dirScan gracefully (L234)', () => {
      const watcher = createTranscriptWatcher(dir)
        .pollEvery(100)
        .dirScanEvery(100)
        .emitTo(tokenBus, messageBus)
        .start(new Map());

      chmodSync(dir, 0o000);
      vi.advanceTimersByTime(200);
      watcher.destroy();
      chmodSync(dir, 0o755);
    });

    it('removes deleted files from state', () => {
      const path = makeFile(dir, 'to-delete.jsonl', [userMsg()]);
      const states = new Map([fileState(path, 0)]);

      const watcher = createTranscriptWatcher(dir)
        .pollEvery(100)
        .dirScanEvery(200)
        .emitTo(tokenBus, messageBus)
        .start(states);

      // First poll reads the file
      vi.advanceTimersByTime(100);
      expect(messageEvents).toHaveLength(1);

      // Delete file
      rmSync(path);

      // Dir scan detects removal
      vi.advanceTimersByTime(200);

      // Next poll should not error
      vi.advanceTimersByTime(100);

      watcher.destroy();
    });
  });

  // ── Byte budget ──

  describe('byte budget', () => {
    it('caps reading at byteBudget per tick', () => {
      // Create a large file (> 512 bytes)
      const lines: string[] = [];
      for (let i = 0; i < 50; i++) {
        lines.push(userMsg(`2025-06-01T00:${String(i).padStart(2, '0')}:00Z`));
      }
      const path = makeFile(dir, 'big.jsonl', lines);
      const states = new Map([fileState(path, 0)]);

      const watcher = createTranscriptWatcher(dir)
        .pollEvery(100)
        .byteBudget(512) // Very small budget
        .emitTo(tokenBus, messageBus)
        .start(states);

      // First tick: limited by budget
      vi.advanceTimersByTime(100);
      const firstBatch = messageEvents.length;
      expect(firstBatch).toBeGreaterThan(0);
      expect(firstBatch).toBeLessThan(50); // Budget should limit

      // Second tick: reads more
      vi.advanceTimersByTime(100);
      expect(messageEvents.length).toBeGreaterThan(firstBatch);

      watcher.destroy();
    });
  });

  // ── Round-robin ──

  describe('round-robin', () => {
    it('polls multiple files fairly', () => {
      // Two files, each with one line
      const path1 = makeFile(dir, 'sess-a.jsonl', [userMsg('2025-06-01T00:00:00Z')]);
      const path2 = makeFile(dir, 'sess-b.jsonl', [userMsg('2025-06-01T00:00:01Z')]);

      const states = new Map([fileState(path1, 0), fileState(path2, 0)]);

      const watcher = createTranscriptWatcher(dir).pollEvery(100).emitTo(tokenBus, messageBus).start(states);

      vi.advanceTimersByTime(100);

      // Both files should be read
      expect(messageEvents).toHaveLength(2);
      const sessions = messageEvents.map((e) => e.sessionKey);
      expect(sessions).toContain('sess-a');
      expect(sessions).toContain('sess-b');

      watcher.destroy();
    });
  });

  // ── Destroy ──

  describe('destroy', () => {
    it('stops timers and calls final flush', () => {
      const path = makeFile(dir, 'd.jsonl', [userMsg()]);
      const states = new Map([fileState(path, 0)]);
      const flushFn = vi.fn();

      const watcher = createTranscriptWatcher(dir)
        .pollEvery(100)
        .emitTo(tokenBus, messageBus)
        .onFlush(flushFn)
        .start(states);

      watcher.destroy();
      flushFn.mockClear();

      // Advance past many intervals — no more polls should fire
      vi.advanceTimersByTime(10_000);

      // flush was called once at destroy, not on subsequent ticks
      expect(flushFn).not.toHaveBeenCalled();

      // No additional events
      // (first poll at interval wouldn't have fired yet since we destroyed immediately)
    });

    it('does not emit after destroy', () => {
      const path = makeFile(dir, 'dd.jsonl', [userMsg()]);
      const st = statSync(path);
      const states = new Map<string, FileState>([
        [path, { offset: st.size, inode: st.ino, birthtimeMs: st.birthtimeMs, partialLine: '' }],
      ]);

      const watcher = createTranscriptWatcher(dir).pollEvery(100).emitTo(tokenBus, messageBus).start(states);

      watcher.destroy();

      // Append new data after destroy
      appendFileSync(path, userMsg('2025-06-01T01:00:00Z') + '\n');

      vi.advanceTimersByTime(1000);
      expect(messageEvents).toHaveLength(0);

      watcher.destroy(); // double-destroy is safe
    });
  });
});
