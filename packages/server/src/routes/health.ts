import type { Request, Response } from 'express';

import { createChildLogger } from '../logger.js';
import type { RuntimeHealthStatus } from '../logging/state.js';
import type { LoggingHealthSnapshot } from '../logging/types.js';

const log = createChildLogger('health');
const startTime = Date.now();

interface HealthOptions {
  version: string;
  serverOnly: boolean;
  checkGateway: () => Promise<boolean>;
  checkDb: () => boolean;
  checkReady: () => boolean;
  getLoggingHealth?: () => LoggingHealthSnapshot;
  getLoggingRuntimeHealth?: () => RuntimeHealthStatus;
}

export function createHealthHandler(opts: HealthOptions) {
  return async (_req: Request, res: Response) => {
    const ready = opts.checkReady();
    const logging = opts.getLoggingHealth?.();
    const loggingFreshnessSec = logging ? Math.max(0, Math.floor((Date.now() - logging.ts) / 1000)) : undefined;

    const runtimeHealth = opts.getLoggingRuntimeHealth?.();
    const loggingPayload = {
      ...(logging ? { logging, loggingFreshnessSec } : {}),
      logMode: 'layered',
      ...(runtimeHealth ? { loggingRuntime: runtimeHealth } : {}),
    };

    // During startup: respond immediately without slow gateway check
    // so the CLI spinner doesn't stall waiting for event-loop-blocked I/O
    if (!ready) {
      res.json({
        status: 'starting',
        version: opts.version,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        mode: opts.serverOnly ? 'server-only' : 'full',
        gateway: 'pending',
        db: opts.checkDb() ? 'ok' : 'error',
        ...loggingPayload,
      });
      return;
    }

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
      ...loggingPayload,
    });
  };
}
