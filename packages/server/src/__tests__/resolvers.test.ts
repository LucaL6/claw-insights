import { type ChildProcess, spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dir = dirname(fileURLToPath(import.meta.url));
let proc: ChildProcess;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PORT = process.env.CLAW_INSIGHTS_SERVER_PORT || '41041';
const SOURCE_ID = process.env.CLAW_INSIGHTS_SOURCE_ID ?? 'agent:main';
const AGENT_SELECTOR_VARIABLES: Record<string, unknown> = { selector: { id: SOURCE_ID } };

interface GraphQLErrorShape {
  message?: string;
}

interface GraphQLResponse<TData> {
  data?: TData;
  errors?: GraphQLErrorShape[];
}

const GQL = async <TData>(query: string, variables?: Record<string, unknown>): Promise<TData> => {
  const response = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  const responseText = await response.text();

  let payload: GraphQLResponse<TData>;
  try {
    payload = responseText.length > 0 ? (JSON.parse(responseText) as GraphQLResponse<TData>) : {};
  } catch {
    throw new Error(`GraphQL HTTP ${response.status}: non-JSON response ${responseText.slice(0, 200)}`);
  }

  if (!response.ok) {
    const details = payload.errors?.map((e) => e.message ?? 'Unknown GraphQL error').join('; ') || responseText;
    throw new Error(`GraphQL HTTP ${response.status}: ${details.slice(0, 200)}`);
  }

  if (payload.errors?.length) {
    const messages = payload.errors.map((e) => e.message ?? 'Unknown GraphQL error').join('; ');
    throw new Error(`GraphQL errors: ${messages}`);
  }

  if (!payload.data) {
    throw new Error('GraphQL response missing data');
  }

  return payload.data;
};

const SYSTEM_QUERY = (inner: string) => `{ system { __typename ... on OpenClawSystem { ${inner} } } }`;
const AGENT_QUERY = (inner: string) =>
  `query($selector: SourceSelector!) { source(selector: $selector) { __typename ... on AgentNamespace { ${inner} } } }`;

function expectOpenClawSystem<T extends object>(
  system: { __typename: string } & T,
): { __typename: 'OpenClawSystem' } & T {
  expect(system.__typename).toBe('OpenClawSystem');
  return system as { __typename: 'OpenClawSystem' } & T;
}

function expectAgentNamespace<T extends object>(
  source: ({ __typename: string } & T) | null,
): { __typename: 'AgentNamespace' } & T {
  expect(source).not.toBeNull();
  expect(source?.__typename).toBe('AgentNamespace');
  return source as { __typename: 'AgentNamespace' } & T;
}

// Integration test — requires a running server.
// Skipped unless RUN_INTEGRATION=1 (set by the dedicated CI integration job).
describe.skipIf(!process.env.RUN_INTEGRATION)('GraphQL Resolvers', () => {
  beforeAll(async () => {
    proc = spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: join(__dir, '../..'),
      stdio: 'pipe',
    });

    let started = false;
    let lastError: unknown;

    for (let i = 0; i < 30; i++) {
      try {
        const systemProbe = await GQL<{
          system: { __typename: string; gateway: { running: boolean } };
        }>(SYSTEM_QUERY('gateway { running }'));
        const system = expectOpenClawSystem(systemProbe.system);
        expect(typeof system.gateway.running).toBe('boolean');

        const sourceProbe = await GQL<{
          source: ({ __typename: string; info: { id: string } } & Record<string, unknown>) | null;
        }>(AGENT_QUERY('info { id }'), AGENT_SELECTOR_VARIABLES);
        const source = expectAgentNamespace(sourceProbe.source);
        expect(source.info.id).toBe(SOURCE_ID);

        started = true;
        break;
      } catch (error) {
        lastError = error;
        await sleep(200);
      }
    }

    if (!started) {
      const details = lastError instanceof Error ? `: ${lastError.message}` : '';
      throw new Error(`Server did not become ready in time${details}`);
    }
  });

  afterAll(() => proc?.kill());

  // F1.1 Gateway status
  it('F1.1: gateway query returns running status', async () => {
    const data = await GQL<{
      system: {
        __typename: string;
        gateway: { running: boolean; pid: number | null; version: string; uptime: string };
      };
    }>(SYSTEM_QUERY('gateway { running pid version uptime }'));

    const system = expectOpenClawSystem(data.system);
    expect(typeof system.gateway.running).toBe('boolean');
    expect(typeof system.gateway.version).toBe('string');
  });

  // F1.3 System resources
  it('F1.3: resources query returns CPU/MEM/DISK', async () => {
    const data = await GQL<{
      system: {
        __typename: string;
        resources: { cpu: number; memoryMB: number; diskMB: number; sampledAt: string };
      };
    }>(SYSTEM_QUERY('resources { cpu memoryMB diskMB sampledAt }'));

    const system = expectOpenClawSystem(data.system);
    expect(typeof system.resources.cpu).toBe('number');
    expect(typeof system.resources.memoryMB).toBe('number');
    expect(typeof system.resources.diskMB).toBe('number');
    expect(system.resources.diskMB).toBeGreaterThanOrEqual(0);
  });

  // F1.2 Channels
  it('F1.2: channels query returns array', async () => {
    const data = await GQL<{
      system: {
        __typename: string;
        channels: Array<{ name: string; connected: boolean }>;
      };
    }>(SYSTEM_QUERY('channels { name connected }'));

    const system = expectOpenClawSystem(data.system);
    expect(Array.isArray(system.channels)).toBe(true);
  });

  // F2.1 Sessions
  it('F2.1: sessions query returns list with required fields', async () => {
    const data = await GQL<{
      source: {
        __typename: string;
        sessions: Array<{
          key: string;
          usagePercent: number;
          subAgents: Array<Record<string, unknown>>;
        }>;
      } | null;
    }>(
      AGENT_QUERY(
        'sessions { key displayName kind model channel totalTokens contextTokens usagePercent status updatedAt subAgents { key } }',
      ),
      AGENT_SELECTOR_VARIABLES,
    );

    const source = expectAgentNamespace(data.source);
    expect(Array.isArray(source.sessions)).toBe(true);
    // With sessions fixture provided, we must have data
    expect(source.sessions.length).toBeGreaterThan(0);
    const session = source.sessions[0];
    expect(typeof session.key).toBe('string');
    expect(typeof session.usagePercent).toBe('number');
    expect(Array.isArray(session.subAgents)).toBe(true);
  });

  // F2.2 Session filter: activeOnly
  it('F2.2: sessions filter activeOnly', async () => {
    const all = await GQL<{
      source: { __typename: string; sessions: Array<{ status: string }> } | null;
    }>(AGENT_QUERY('sessions { key status }'), AGENT_SELECTOR_VARIABLES);

    const active = await GQL<{
      source: { __typename: string; sessions: Array<{ status: string }> } | null;
    }>(AGENT_QUERY('sessions(filter: { activeOnly: true }) { key status }'), AGENT_SELECTOR_VARIABLES);

    const allSource = expectAgentNamespace(all.source);
    const activeSource = expectAgentNamespace(active.source);

    expect(activeSource.sessions.length).toBeLessThanOrEqual(allSource.sessions.length);
    for (const session of activeSource.sessions) {
      expect(session.status).toBe('ACTIVE');
    }
  });

  // F2.2 Session sort by tokens
  it('F2.2: sessions sort by TOKENS_DESC', async () => {
    const data = await GQL<{
      source: { __typename: string; sessions: Array<{ totalTokens: number }> } | null;
    }>(AGENT_QUERY('sessions(filter: { sortBy: TOKENS_DESC }) { totalTokens }'), AGENT_SELECTOR_VARIABLES);

    const source = expectAgentNamespace(data.source);
    for (let i = 1; i < source.sessions.length; i++) {
      expect(source.sessions[i - 1].totalTokens).toBeGreaterThanOrEqual(source.sessions[i].totalTokens);
    }
  });

  // F3 Metrics
  it('F3: metrics query returns buckets', async () => {
    const data = await GQL<{
      source: {
        __typename: string;
        metrics: {
          buckets: unknown[];
          date: string;
        };
      } | null;
    }>(
      AGENT_QUERY(
        'metrics { date buckets { bucket label sessions tokensK errors warnings gatewayUp restartEvent } totalErrors uptimePercent }',
      ),
      AGENT_SELECTOR_VARIABLES,
    );

    const source = expectAgentNamespace(data.source);
    expect(source.metrics.buckets.length).toBeGreaterThan(0);
    expect(source.metrics.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // F3 Metrics with date param
  it('F3: metrics query accepts date parameter', async () => {
    const data = await GQL<{
      source: {
        __typename: string;
        metrics: {
          date: string;
        };
      } | null;
    }>(AGENT_QUERY('metrics(date: "2026-02-14") { date totalErrors }'), AGENT_SELECTOR_VARIABLES);

    const source = expectAgentNamespace(data.source);
    expect(source.metrics.date).toBe('2026-02-14');
  });

  // Cron jobs
  it('cronJobs query returns list', async () => {
    const data = await GQL<{
      source: { __typename: string; cronJobs: unknown[] } | null;
    }>(AGENT_QUERY('cronJobs { id name enabled schedule }'), AGENT_SELECTOR_VARIABLES);

    const source = expectAgentNamespace(data.source);
    expect(Array.isArray(source.cronJobs)).toBe(true);
  });
});
