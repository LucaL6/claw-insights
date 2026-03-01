import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { createChildLogger } from '../logger.js';

const log = createChildLogger('cli:snapshot');

export interface SnapshotCmdArgs {
  format: string;
  detail: string;
  range: string;
  theme: string;
  lang: string;
  layout: string;
  output: string | undefined;
  quick: boolean;
  dryRun: boolean;
  port: number;
  token: string | undefined;
}

export function parseSnapshotArgs(argv: string[]): SnapshotCmdArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      format: { type: 'string', default: 'png' },
      detail: { type: 'string', default: 'standard' },
      range: { type: 'string', default: '6h' },
      theme: { type: 'string', default: 'dark' },
      lang: { type: 'string', default: 'en' },
      layout: { type: 'string', default: 'desktop' },
      output: { type: 'string', short: 'o' },
      quick: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      port: { type: 'string', default: '41041' },
      token: { type: 'string', short: 't' },
    },
    strict: false,
  });

  const quick = values.quick as boolean;
  return {
    format: quick ? 'png' : (values.format as string),
    detail: quick ? 'compact' : (values.detail as string),
    range: values.range as string,
    theme: values.theme as string,
    lang: values.lang as string,
    layout: quick ? 'mobile' : (values.layout as string),
    output: values.output as string | undefined,
    quick,
    dryRun: values['dry-run'] as boolean,
    port: parseInt(values.port as string, 10),
    token: values.token as string | undefined,
  };
}

function printHelp(): void {
  console.log(`Usage: claw-insights snapshot [options]

Options:
  --format <png|json|svg>    Output format (default: png)
  --detail <compact|standard|full>  Detail level (default: standard)
  --range <1h|6h|12h|24h>   Time range (default: 6h)
  --theme <dark|light>       Color theme (default: dark)
  --lang <en|zh>             Language (default: en)
  --layout <desktop|mobile>  Layout mode (default: desktop)
  -o, --output <path>        Save to file
  -t, --token <token>        API auth token
  --port <number>            Server port (default: 41041)
  --quick                    Shorthand: compact + mobile + png
  --dry-run                  Print parameters without executing
  --help                     Show this help message

Examples:
  claw-insights snapshot                        # default PNG snapshot
  claw-insights snapshot --quick -o status.png  # quick mobile snapshot
  claw-insights snapshot --format json | jq .   # JSON to stdout
  claw-insights snapshot --dry-run              # preview parameters`);
}

export async function runSnapshotCmd(argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  const args = parseSnapshotArgs(argv);

  if (args.dryRun) {
    console.log('Snapshot parameters:');
    const display = {
      format: args.format,
      detail: args.detail,
      range: args.range,
      theme: args.theme,
      lang: args.lang,
      layout: args.layout,
    };
    for (const [k, v] of Object.entries(display)) {
      console.log(`  ${k}: ${v}`);
    }
    return;
  }

  // Resolve auth token: --token flag → env var → token file
  const token =
    args.token ??
    process.env.CLAW_INSIGHTS_API_TOKEN ??
    (() => {
      const tokenFile = join(process.env.HOME ?? '/tmp', '.claw-insights', 'auth-token');
      try {
        return existsSync(tokenFile) ? readFileSync(tokenFile, 'utf-8').trim() : undefined;
      } catch {
        return undefined;
      }
    })();

  const url = `http://127.0.0.1:${args.port}/api/snapshot`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        layout: args.layout,
        detail: args.detail,
        format: args.format,
        range: args.range,
        theme: args.theme,
        lang: args.lang,
      }),
    });
  } catch (err) {
    log.error({ err, port: args.port }, 'snapshot fetch failed');
    console.error(`Error: Claw-Insights server is not running on port ${args.port}.`);
    console.error(`  → Run 'claw-insights start' first.`);
    process.exit(1);
  }

  if (!resp.ok) {
    const body = (await resp.json().catch(() => ({ error: resp.statusText }))) as Record<string, unknown>;
    log.error({ status: resp.status, body }, 'snapshot API error');
    console.error(`Error: ${body.error}`);
    if (body.suggestion) {
      console.error(`  → ${body.suggestion}`);
    }
    process.exit(1);
  }

  const buffer = Buffer.from(await resp.arrayBuffer());

  if (args.output) {
    writeFileSync(args.output, buffer);
    console.log(`Saved: ${args.output}`);
  } else if (args.format === 'json') {
    process.stdout.write(buffer.toString('utf-8'));
  } else if (process.stdout.isTTY) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const ext = args.format === 'svg' ? 'svg' : 'png';
    const filename = `claw-insights-snapshot-${ts}.${ext}`;
    writeFileSync(filename, buffer);
    console.log(`Saved: ./${filename}`);
  } else {
    process.stdout.write(buffer);
  }
}
