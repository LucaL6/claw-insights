// src/platforms/index.ts
import { platform as osPlatform } from 'node:os';

import type { Platform } from '../ports/types.js';

export async function loadPlatform(): Promise<Platform> {
  switch (osPlatform()) {
    case 'darwin':
      return (await import('./darwin/index.js')).platform;
    case 'linux':
      return (await import('./linux/index.js')).platform;
    default:
      throw new Error(`Unsupported platform: ${osPlatform()}`);
  }
}

export type { Platform } from '../ports/types.js';
