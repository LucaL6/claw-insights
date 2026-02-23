import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AppContext } from '../../context.js';
import type { Resolvers, MutationResolvers, OperationResult } from '../generated/resolver-types.js';
import { config, CLI_ENV } from '../../config.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('mutations');
const execFileAsync = promisify(execFile);

async function runCli(args: string[], timeoutMs = 30_000): Promise<OperationResult> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(config.cliPath, args, {
      timeout: timeoutMs,
      encoding: 'utf-8',
      env: CLI_ENV,
    });
    const output = (stdout + stderr).trim() || null;
    return {
      success: true,
      message: null,
      output,
      duration: Date.now() - start,
    };
  } catch (err: unknown) {
    const e = err as Error & { stdout?: string; stderr?: string; code?: number };
    const output = ((e.stdout ?? '') + (e.stderr ?? '')).trim() || null;
    const message = e.message ?? 'Command failed';
    log.error({ err: e, args }, 'CLI mutation failed');
    return {
      success: false,
      message,
      output,
      duration: Date.now() - start,
    };
  }
}

export function mutationResolvers(_ctx: AppContext): Partial<Resolvers> {
  const restartGateway: MutationResolvers['restartGateway'] = async () => {
    log.info('Restarting gateway via CLI');
    return runCli(['gateway', 'restart']);
  };

  const updateGateway: MutationResolvers['updateGateway'] = async () => {
    log.info('Updating gateway via CLI');
    return runCli(['update', 'run'], 60_000);
  };

  const runDoctor: MutationResolvers['runDoctor'] = async (_parent, { options }) => {
    const args = ['doctor', '--non-interactive'];
    if (options.fix) args.push('--fix');
    if (options.deep) args.push('--deep');
    log.info({ options }, 'Running doctor via CLI');
    return runCli(args, 30_000);
  };

  return { Mutation: { restartGateway, updateGateway, runDoctor } };
}
