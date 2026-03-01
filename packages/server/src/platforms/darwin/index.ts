// src/platforms/darwin/index.ts
import { CLI_ENV, config } from '../../config.js';
import { createChildLogger } from '../../logger.js';
import type { Platform } from '../../ports/types.js';
import { PosixCliAdapter } from '../shared/cli-adapter.js';
import { DarwinProcessAdapter } from './process-adapter.js';

const log = createChildLogger('platform:darwin');
log.debug('darwin platform initialized');

export const platform: Platform = {
  process: new DarwinProcessAdapter(),
  cli: new PosixCliAdapter(config.cliPath, CLI_ENV),
};
