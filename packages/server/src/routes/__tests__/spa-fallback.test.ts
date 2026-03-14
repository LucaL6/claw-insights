import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { mountSpaFallbackRoutes } from '../spa-fallback.js';

const tempDirs: string[] = [];

function createProdWebApp() {
  const dir = mkdtempSync(join(tmpdir(), 'claw-insights-spa-'));
  tempDirs.push(dir);
  writeFileSync(join(dir, 'index.html'), '<!doctype html><html><body>SPA-FALLBACK</body></html>', 'utf-8');

  const app = express();
  mountSpaFallbackRoutes(app, dir);
  return app;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('SPA fallback semantics (production + web UI)', () => {
  it.each(['/mcp', '/mcp/', '/mcp/anything'] as const)('GET %s -> 200 index.html', async (path) => {
    const app = createProdWebApp();
    const res = await request(app).get(path);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('SPA-FALLBACK');
  });

  it.each(['/mcp', '/mcp/', '/mcp/anything'] as const)('POST %s -> 404', async (path) => {
    const app = createProdWebApp();
    const res = await request(app).post(path).send({ ping: true });

    expect(res.status).toBe(404);
  });
});
