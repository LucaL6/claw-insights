import type { NextFunction, Request, Response } from 'express';

import { createChildLogger } from '../logger.js';

const log = createChildLogger('security:local-only');
const VALID_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function parseHostname(raw: string): string {
  try {
    return new URL(`http://${raw}`).hostname;
  } catch {
    return raw.replace(/:\d+$/, '');
  }
}

function isLocalRequest(req: Request): boolean {
  const host = parseHostname(req.headers.host ?? '');
  if (!VALID_LOCAL_HOSTS.has(host)) {
    return false;
  }
  const remote = req.socket.remoteAddress ?? '';
  return remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
}

export function localOnlyMiddleware(noAuth: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (noAuth && !isLocalRequest(req)) {
      log.warn(
        {
          method: req.method,
          path: req.path,
          host: req.headers.host ?? null,
          remoteAddress: req.socket.remoteAddress ?? null,
        },
        'security reject: non-local access in no-auth mode',
      );
      res.status(403).json({ error: 'Forbidden: non-local access in no-auth mode' });
      return;
    }
    next();
  };
}
