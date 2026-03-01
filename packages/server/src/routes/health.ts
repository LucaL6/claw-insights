import type { Request, Response } from 'express';

import { createChildLogger } from '../logger.js';

const log = createChildLogger('health');
const startTime = Date.now();

interface HealthOptions {
  version: string;
  serverOnly: boolean;
  checkGateway: () => Promise<boolean>;
  checkDb: () => boolean;
}

export function createHealthHandler(opts: HealthOptions) {
  return async (_req: Request, res: Response) => {
    const [gatewayOk, dbOk] = await Promise.all([
      opts.checkGateway().catch(() => false),
      Promise.resolve(opts.checkDb()),
    ]);

    if (!gatewayOk || !dbOk) {
      log.warn({ gatewayOk, dbOk }, 'health check degraded');
    }

    res.json({
      status: 'ok',
      version: opts.version,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      mode: opts.serverOnly ? 'server-only' : 'full',
      gateway: gatewayOk ? 'connected' : 'disconnected',
      db: dbOk ? 'ok' : 'error',
    });
  };
}
