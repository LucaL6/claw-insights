// src/platforms/linux/index.ts
import { CLI_ENV, config } from '../../config.js';
import type { Platform } from '../../ports/types.js';
import { PosixCliAdapter } from '../shared/cli-adapter.js';
import { LinuxProcessAdapter } from './process-adapter.js';

export const platform: Platform = {
  process: new LinuxProcessAdapter(),
  cli: new PosixCliAdapter(config.cliPath, CLI_ENV),
};
