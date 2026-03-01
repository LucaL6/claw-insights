// src/platforms/linux/index.ts
import { CLI_ENV, config } from '../../config.js';
import { createChildLogger } from '../../logger.js';
import type { Platform } from '../../ports/types.js';
import { PosixCliAdapter } from '../shared/cli-adapter.js';
import { LinuxProcessAdapter } from './process-adapter.js';

const log = createChildLogger('platform:linux');
log.debug('linux platform initialized');

export const platform: Platform = {
  process: new LinuxProcessAdapter(),
  cli: new PosixCliAdapter(config.cliPath, CLI_ENV),
};
