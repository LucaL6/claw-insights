import { type ChildProcess, spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dir = dirname(fileURLToPath(import.meta.url));
let proc: ChildProcess;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const GQL = (query: string, variables?: Record<string, unknown>) =>
  fetch('http://127.0.0.1:41041/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  }).then((r) => r.json());

// Integration test — requires a running server.
// Skipped unless RUN_INTEGRATION=1 (set by the dedicated CI integration job).
describe.skipIf(!process.env.RUN_INTEGRATION)('GraphQL Resolvers', () => {
  beforeAll(async () => {
    proc = spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: join(__dir, '../..'),
      stdio: 'pipe',
    });
    for (let i = 0; i < 30; i++) {
      try {
        await GQL('{ gateway { running } }');
        break;
      } catch {
        await sleep(200);
      }
    }
  });

  afterAll(() => proc?.kill());

  // F1.1 Gateway status
  it('F1.1: gateway query returns running status', async () => {
    const d = (await GQL('{ gateway { running pid version uptime } }')) as {
      data: { gateway: Record<string, unknown> };
    };
    expect(typeof d.data.gateway.running).toBe('boolean');
    expect(typeof d.data.gateway.version).toBe('string');
  });

  // F1.3 System resources
  it('F1.3: resources query returns CPU/MEM/DISK', async () => {
    const d = (await GQL('{ resources { cpu memoryMB diskMB sampledAt } }')) as {
      data: { resources: Record<string, unknown> };
    };
    expect(typeof d.data.resources.cpu).toBe('number');
    expect(typeof d.data.resources.memoryMB).toBe('number');
    expect(typeof d.data.resources.diskMB).toBe('number');
    expect(d.data.resources.diskMB).toBeGreaterThanOrEqual(0);
  });

  // F1.2 Channels
  it('F1.2: channels query returns array', async () => {
    const d = (await GQL('{ channels { name connected } }')) as { data: { channels: unknown[] } };
    expect(Array.isArray(d.data.channels)).toBe(true);
  });

  // F2.1 Sessions
  it('F2.1: sessions query returns list with required fields', async () => {
    const d = (await GQL(`{
      sessions { key displayName kind model channel totalTokens contextTokens usagePercent status updatedAt subAgents { key } }
    }`)) as { data: { sessions: Array<Record<string, unknown>> } };
    expect(Array.isArray(d.data.sessions)).toBe(true);
    // With sessions fixture provided, we must have data
    expect(d.data.sessions.length).toBeGreaterThan(0);
    const s = d.data.sessions[0];
    expect(typeof s.key).toBe('string');
    expect(typeof s.usagePercent).toBe('number');
    expect(Array.isArray(s.subAgents)).toBe(true);
  });

  // F2.2 Session filter: activeOnly
  it('F2.2: sessions filter activeOnly', async () => {
    const all = (await GQL('{ sessions { key status } }')) as { data: { sessions: Array<{ status: string }> } };
    const active = (await GQL('{ sessions(filter: { activeOnly: true }) { key status } }')) as {
      data: { sessions: Array<{ status: string }> };
    };
    expect(active.data.sessions.length).toBeLessThanOrEqual(all.data.sessions.length);
    for (const s of active.data.sessions) {
      expect(s.status).toBe('ACTIVE');
    }
  });

  // F2.2 Session sort by tokens
  it('F2.2: sessions sort by TOKENS_DESC', async () => {
    const d = (await GQL('{ sessions(filter: { sortBy: TOKENS_DESC }) { totalTokens } }')) as {
      data: { sessions: Array<{ totalTokens: number }> };
    };
    for (let i = 1; i < d.data.sessions.length; i++) {
      expect(d.data.sessions[i - 1].totalTokens).toBeGreaterThanOrEqual(d.data.sessions[i].totalTokens);
    }
  });

  // F3 Metrics
  it('F3: metrics query returns buckets', async () => {
    const d = (await GQL(
      '{ metrics { date buckets { bucket label sessions tokensK errors warnings gatewayUp restartEvent } totalErrors uptimePercent } }',
    )) as { data: { metrics: { buckets: unknown[]; date: string } } };
    expect(d.data.metrics.buckets.length).toBeGreaterThan(0);
    expect(d.data.metrics.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // F3 Metrics with date param
  it('F3: metrics query accepts date parameter', async () => {
    const d = (await GQL('{ metrics(date: "2026-02-14") { date totalErrors } }')) as {
      data: { metrics: { date: string } };
    };
    expect(d.data.metrics.date).toBe('2026-02-14');
  });

  // Cron jobs
  it('cronJobs query returns list', async () => {
    const d = (await GQL('{ cronJobs { id name enabled schedule } }')) as { data: { cronJobs: unknown[] } };
    expect(Array.isArray(d.data.cronJobs)).toBe(true);
  });
});
