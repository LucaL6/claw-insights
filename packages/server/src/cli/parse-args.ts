import { parseArgs } from 'node:util';

import { createChildLogger } from '../logger.js';

const log = createChildLogger('cli:parse-args');

const SUBCOMMANDS = ['start', 'stop', 'status', 'logs', 'restart', 'snapshot'] as const;
type Subcommand = (typeof SUBCOMMANDS)[number];

export interface CliArgs {
  command: Subcommand | 'run'; // 'run' = foreground (no subcommand)
  port: number;
  portExplicit: boolean;
  webPort: number;
  webPortExplicit: boolean;
  serverOnly: boolean;
  noAuth: boolean;
  gateway: string | undefined;
  logDir: string | undefined;
  lines: number | undefined;
  open: boolean;
  help: boolean;
  version: boolean;
}

export function parseCliArgs(argv: string[]): CliArgs {
  // Separate subcommand from flags
  let command: CliArgs['command'] = 'run';
  const args = [...argv];

  if (args.length > 0 && !args[0].startsWith('-')) {
    const sub = args.shift();
    if (sub === undefined) {
      throw new Error('Expected subcommand argument');
    }
    if (SUBCOMMANDS.includes(sub as Subcommand)) {
      command = sub as Subcommand;
    }
  }

  const { values } = parseArgs({
    args,
    options: {
      port: { type: 'string', short: 'p' },
      'web-port': { type: 'string' },
      'server-only': { type: 'boolean', default: false },
      'no-auth': { type: 'boolean', default: false },
      gateway: { type: 'string' },
      'log-dir': { type: 'string' },
      lines: { type: 'string', short: 'n' },
      open: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
    strict: false,
  });

  const result = {
    command,
    port: values.port ? parseInt(values.port as string, 10) : 41041,
    portExplicit: !!values.port,
    webPort: values['web-port'] ? parseInt(values['web-port'] as string, 10) : 41042,
    webPortExplicit: !!values['web-port'],
    serverOnly: (values['server-only'] as boolean) ?? false,
    noAuth: (values['no-auth'] as boolean) ?? false,
    gateway: values.gateway as string | undefined,
    logDir: values['log-dir'] as string | undefined,
    lines: values.lines ? parseInt(values.lines as string, 10) : undefined,
    open: (values.open as boolean) ?? false,
    help: (values.help as boolean) ?? false,
    version: (values.version as boolean) ?? false,
  };

  log.debug({ command: result.command, port: result.port }, 'parsed CLI args');
  return result;
}
