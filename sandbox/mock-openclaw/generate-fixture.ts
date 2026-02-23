/**
 * Generate custom sandbox fixtures.
 * Usage: npx tsx sandbox/mock-openclaw/generate-fixture.ts [options]
 *   --sessions <n>     Number of recent sessions (default: 3)
 *   --channels <n>     Number of channels (default: 2)
 *   --offline          Gateway offline
 *   --platform <p>     linux or darwin (default: linux)
 *   --output <path>    Output file (default: stdout)
 */
import { writeFileSync } from 'node:fs';

interface FixtureOptions {
  sessions: number;
  channels: number;
  offline: boolean;
  platform: 'linux' | 'darwin';
  output: string | null;
}

function parseArgs(): FixtureOptions {
  const args = process.argv.slice(2);
  const opts: FixtureOptions = {
    sessions: 3,
    channels: 2,
    offline: false,
    platform: 'linux',
    output: null,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--sessions': opts.sessions = parseInt(args[++i], 10); break;
      case '--channels': opts.channels = parseInt(args[++i], 10); break;
      case '--offline': opts.offline = true; break;
      case '--platform': opts.platform = args[++i] as 'linux' | 'darwin'; break;
      case '--output': opts.output = args[++i]; break;
    }
  }
  return opts;
}

const CHANNEL_TEMPLATES: [string, string][] = [
  ['Telegram: configured', '  - default (token:config)'],
  ['Slack: configured', '  - default (bot:config, app:config)'],
  ['Discord: configured', '  - default (bot:config)'],
  ['WhatsApp: configured', '  - default (paired)'],
  ['Signal: configured', '  - default (linked)'],
];

const MODELS = ['claude-sonnet-4-20250514', 'gpt-4o', 'claude-opus-4-6', 'gemini-2.5-pro'];

interface Session {
  agentId: string;
  key: string;
  kind: string;
  sessionId: string;
  updatedAt: number;
  age: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  remainingTokens: number;
  percentUsed: number;
  model: string;
  contextTokens: number;
  flags: string[];
}

function generateSession(index: number): Session {
  const model = MODELS[index % MODELS.length];
  const now = Date.now();
  return {
    agentId: 'main',
    key: `agent:main:session-${index}`,
    kind: 'direct',
    sessionId: `${String(index).padStart(8, '0')}-0000-0000-0000-000000000000`,
    updatedAt: now - index * 300_000,
    age: index * 300_000,
    inputTokens: 100 + index * 50,
    outputTokens: 200 + index * 100,
    totalTokens: 30000 + index * 5000,
    remainingTokens: 170000 - index * 5000,
    percentUsed: 15 + index * 5,
    model,
    contextTokens: 200000,
    flags: [],
  };
}

function generate(opts: FixtureOptions) {
  const channelSummary = CHANNEL_TEMPLATES.slice(0, opts.channels).flatMap(([a, b]) => [a, b]);
  const sessions = Array.from({ length: opts.sessions }, (_, i) => generateSession(i));

  const isDarwin = opts.platform === 'darwin';

  return {
    heartbeat: {
      defaultAgentId: 'main',
      agents: [{ agentId: 'main', enabled: true, every: '1h', everyMs: 3600000 }],
    },
    channelSummary,
    queuedSystemEvents: [],
    sessions: {
      paths: ['/home/testuser/.openclaw/agents/main/sessions/sessions.json'],
      count: opts.sessions * 10,
      defaults: { model: 'claude-sonnet-4-20250514', contextTokens: 200000 },
      recent: opts.offline ? [] : sessions,
    },
    os: isDarwin
      ? { platform: 'darwin', arch: 'arm64', release: '25.2.0', label: 'macos 26.2 (arm64)' }
      : { platform: 'linux', arch: 'x64', release: '6.1.0', label: 'linux 6.1 (x64)' },
    update: {
      root: '/home/testuser/.npm-global/lib/node_modules/openclaw',
      installKind: 'package',
      packageManager: 'npm',
      deps: { manager: 'npm', status: 'up-to-date' },
      registry: { latestVersion: '2026.2.21-2' },
    },
    updateChannel: 'stable',
    updateChannelSource: 'default',
    memory: null,
    memoryPlugin: null,
    gateway: {
      mode: 'local',
      url: 'ws://127.0.0.1:18789',
      urlSource: 'local loopback',
      misconfigured: false,
      reachable: !opts.offline,
      connectLatencyMs: opts.offline ? null : 12,
      self: opts.offline ? null : {
        host: 'sandbox-host',
        ip: '198.51.100.1',
        version: '2026.2.21-2',
        platform: isDarwin ? 'macos 26.2' : 'linux 6.1',
      },
      error: opts.offline ? 'ECONNREFUSED' : null,
    },
    gatewayService: {
      label: isDarwin ? 'LaunchAgent' : 'systemd',
      installed: true,
      loadedText: 'loaded',
      runtimeShort: opts.offline ? 'stopped' : 'running (pid 1234, state active)',
    },
    nodeService: null,
    agents: [{ id: 'main', workspace: '/home/testuser/openclaw' }],
    securityAudit: { summary: { critical: 0, warn: 1, info: 3 } },
  };
}

const opts = parseArgs();
const fixture = generate(opts);
const json = JSON.stringify(fixture, null, 2) + '\n';

if (opts.output) {
  writeFileSync(opts.output, json);
  console.log(`Written to ${opts.output}`);
} else {
  process.stdout.write(json);
}
