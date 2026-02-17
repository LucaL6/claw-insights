import { describe, it, expect, afterEach } from 'bun:test';
import { BrowserPool } from '../browser-pool';

describe('BrowserPool', () => {
  let pool: BrowserPool;

  afterEach(async () => {
    if (pool) await pool.shutdown();
  });

  it('acquire() returns a browser instance', async () => {
    pool = new BrowserPool({ idleTimeoutMs: 5000 });
    const browser = await pool.acquire();
    expect(browser).toBeDefined();
    expect(browser.isConnected()).toBe(true);
  });

  it('acquire() reuses the same browser on second call', async () => {
    pool = new BrowserPool({ idleTimeoutMs: 5000 });
    const b1 = await pool.acquire();
    const b2 = await pool.acquire();
    expect(b1 === b2).toBe(true);
  });

  it('shutdown() closes the browser', async () => {
    pool = new BrowserPool({ idleTimeoutMs: 5000 });
    const browser = await pool.acquire();
    expect(browser.isConnected()).toBe(true);
    await pool.shutdown();
    expect(browser.isConnected()).toBe(false);
  });

  it('acquire() after shutdown starts a new browser', async () => {
    pool = new BrowserPool({ idleTimeoutMs: 5000 });
    const b1 = await pool.acquire();
    await pool.shutdown();
    const b2 = await pool.acquire();
    expect(b2.isConnected()).toBe(true);
    expect(b1 === b2).toBe(false);
  });

  it('idle timeout closes the browser automatically', async () => {
    pool = new BrowserPool({ idleTimeoutMs: 200 });
    const browser = await pool.acquire();
    expect(browser.isConnected()).toBe(true);
    await new Promise((r) => setTimeout(r, 400));
    expect(browser.isConnected()).toBe(false);
  });

  it('acquire() resets idle timer', async () => {
    pool = new BrowserPool({ idleTimeoutMs: 300 });
    await pool.acquire();
    await new Promise((r) => setTimeout(r, 200));
    const b2 = await pool.acquire();
    await new Promise((r) => setTimeout(r, 200));
    expect(b2.isConnected()).toBe(true);
  });

  it('concurrent acquire() calls return same browser', async () => {
    pool = new BrowserPool({ idleTimeoutMs: 5000 });
    const [b1, b2, b3] = await Promise.all([
      pool.acquire(),
      pool.acquire(),
      pool.acquire(),
    ]);
    expect(b1 === b2).toBe(true);
    expect(b2 === b3).toBe(true);
  });
});
