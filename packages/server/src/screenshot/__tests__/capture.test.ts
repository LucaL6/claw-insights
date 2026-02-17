import { describe, it, expect, afterAll } from 'vitest';
import { BrowserPool } from '../browser-pool';
import { capture, type CaptureOptions } from '../capture';

const WEB_PORT = Number(process.env.WEB_PORT ?? 3200);
const pool = new BrowserPool({ idleTimeoutMs: 30_000 });

afterAll(async () => {
  await pool.shutdown();
});

function isPng(buf: Buffer): boolean {
  return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

describe('capture', () => {
  it('captures full dashboard as PNG', async () => {
    const buf = await capture(pool, {
      section: 'dashboard',
      range: 'TWENTY_FOUR_HOUR',
      theme: 'dark',
      lang: 'en',
      webPort: WEB_PORT,
    });
    expect(isPng(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(10_000);
  }, 30_000);

  it('captures sessions section', async () => {
    const buf = await capture(pool, {
      section: 'sessions',
      range: 'TWENTY_FOUR_HOUR',
      theme: 'dark',
      lang: 'en',
      webPort: WEB_PORT,
    });
    expect(isPng(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(5_000);
  }, 30_000);

  it('captures metrics section', async () => {
    const buf = await capture(pool, {
      section: 'metrics',
      range: 'TWENTY_FOUR_HOUR',
      theme: 'dark',
      lang: 'en',
      webPort: WEB_PORT,
    });
    expect(isPng(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(5_000);
  }, 30_000);

  it('respects theme=light', async () => {
    const buf = await capture(pool, {
      section: 'dashboard',
      range: 'TWENTY_FOUR_HOUR',
      theme: 'light',
      lang: 'en',
      webPort: WEB_PORT,
    });
    expect(isPng(buf)).toBe(true);
  }, 30_000);

  it('throws on invalid section', async () => {
    await expect(
      capture(pool, {
        section: 'invalid' as CaptureOptions['section'],
        range: 'TWENTY_FOUR_HOUR',
        theme: 'dark',
        lang: 'en',
        webPort: WEB_PORT,
      }),
    ).rejects.toThrow();
  }, 30_000);
});
