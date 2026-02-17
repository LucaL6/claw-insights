import { describe, test, expect } from 'vitest';
import { captureFromHtml } from '../../screenshot/capture';
import { BrowserPool } from '../../screenshot/browser-pool';

describe('captureFromHtml', () => {
  test('captures PNG from simple HTML', async () => {
    const pool = new BrowserPool();
    try {
      const html = '<!DOCTYPE html><html><body data-ready="true"><h1>Test</h1></body></html>';
      const buffer = await captureFromHtml(pool, { html, viewportWidth: 390 });
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
      // PNG magic bytes
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
    } finally {
      await pool.shutdown();
    }
  }, 30_000);
});
