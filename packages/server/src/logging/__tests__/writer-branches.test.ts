import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LogWriter } from '../writer.js';

describe('LogWriter branch coverage', () => {
  let logDir: string;

  beforeEach(() => {
    logDir = join(tmpdir(), `log-writer-branch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(logDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(logDir, { recursive: true, force: true });
  });

  it('append returns 0 when closed (line 166 — closed guard)', async () => {
    const writer = new LogWriter({ logDir });
    await writer.shutdown();
    const bytes = writer.append('app', 'bestEffort', 'after-close');
    expect(bytes).toBe(0);
  });

  it('endDestination falls back to destroy when end() throws (lines 271-272)', async () => {
    const writer = new LogWriter({ logDir });
    writer.append('app', 'bestEffort', 'data');

    // Call endDestination directly with a mock-like destination
    let destroyCalled = false;
    const fakeDest = {
      end: () => {
        throw new Error('end failed');
      },
      destroy: () => {
        destroyCalled = true;
      },
    };

    (writer as any).endDestination(fakeDest);
    expect(destroyCalled).toBe(true);

    await writer.shutdown();
  });

  it('endDestination handles both end() and destroy() throwing (lines 271-274)', async () => {
    const writer = new LogWriter({ logDir });
    writer.append('app', 'bestEffort', 'data');

    const states = (writer as any).states as Map<string, any>;
    const state = states.get('app')!;
    const dest = state.destination;
    // Save real refs for cleanup
    const realEnd = dest.end.bind(dest);

    dest.end = () => {
      throw new Error('end failed');
    };
    dest.destroy = () => {
      throw new Error('destroy failed');
    };

    // Should not throw — best effort
    (writer as any).endDestination(dest);

    // Restore for proper cleanup
    dest.end = realEnd;
    dest.destroy = () => {};
    await writer.shutdown();
  });

  it('closeDestination with null returns immediately (line 281)', async () => {
    const writer = new LogWriter({ logDir });
    // Call closeDestination with null directly
    await (writer as any).closeDestination(null);
    await writer.shutdown();
  });

  it('closeDestination finish guard prevents double resolve (line 288)', async () => {
    const writer = new LogWriter({ logDir });
    writer.append('error', 'critical', 'data');

    const states = (writer as any).states as Map<string, any>;
    const state = states.get('error')!;
    const dest = state.destination;

    // Make the destination emit both 'close' and 'error' events to trigger finish twice
    const originalEnd = dest.end.bind(dest);
    dest.end = function (this: any) {
      originalEnd();
      // Also emit error to trigger finish a second time
      this.emit('error', new Error('fake'));
    };

    await (writer as any).closeDestination(dest);

    states.delete('error');
    await writer.shutdown();
  });

  it('flushDestination falls back to flush() when flushSync() throws', async () => {
    const writer = new LogWriter({ logDir });
    writer.append('app', 'bestEffort', 'data');

    const states = (writer as any).states as Map<string, any>;
    const state = states.get('app')!;
    const dest = state.destination;

    let flushCalled = false;
    dest.flushSync = () => {
      throw new Error('flushSync failed');
    };
    const originalFlush = dest.flush.bind(dest);
    dest.flush = () => {
      flushCalled = true;
      return originalFlush();
    };

    (writer as any).flushDestination(dest);
    expect(flushCalled).toBe(true);

    await writer.shutdown();
  });

  it('flushDestination with null is no-op', async () => {
    const writer = new LogWriter({ logDir });
    (writer as any).flushDestination(null);
    await writer.shutdown();
  });

  it('endDestination with null is no-op', async () => {
    const writer = new LogWriter({ logDir });
    (writer as any).endDestination(null);
    await writer.shutdown();
  });

  it('streamSyncMode returns null for unknown stream', async () => {
    const writer = new LogWriter({ logDir });
    expect(writer.streamSyncMode('app')).toBeNull();
    await writer.shutdown();
  });

  it('critical sync batch triggers mid-write fsync', async () => {
    const writer = new LogWriter({ logDir, criticalSyncBatch: 3 });
    writer.append('error', 'critical', 'a');
    writer.append('error', 'critical', 'b');
    writer.append('error', 'critical', 'c'); // should trigger sync at batch=3

    const states = (writer as any).states as Map<string, any>;
    const state = states.get('error')!;
    // After sync, entriesSinceSync should be reset to 0
    expect(state.entriesSinceSync).toBe(0);

    await writer.shutdown();
  });
});
