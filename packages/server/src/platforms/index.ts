// src/platforms/index.ts
import { platform as osPlatform } from 'node:os';

import { createChildLogger } from '../logger.js';
import type { Platform } from '../ports/types.js';

const log = createChildLogger('platform');

export async function loadPlatform(): Promise<Platform> {
  const os = osPlatform();
  log.info({ os }, 'loading platform adapter');
  switch (os) {
    case 'darwin':
      return (await import('./darwin/index.js')).platform;
    case 'linux':
      return (await import('./linux/index.js')).platform;
    default:
      throw new Error(`Unsupported platform: ${os}`);
  }
}

export type { Platform } from '../ports/types.js';
