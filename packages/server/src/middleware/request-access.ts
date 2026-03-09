import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { createChildLogger } from '../logger.js';

const log = createChildLogger('http-access');

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path;
}

function shouldLogPath(path: string): boolean {
  const normalizedPath = normalizePath(path);
  return (
    normalizedPath === '/graphql' ||
    normalizedPath.startsWith('/api/') ||
    normalizedPath === '/api' ||
    normalizedPath === '/mcp'
  );
}

function normalizeRequestId(rawHeader: string | string[] | undefined): string | null {
  if (typeof rawHeader !== 'string') {
    return null;
  }

  const value = rawHeader.trim();
  if (value.length === 0 || value.length > 128) {
    return null;
  }

  if (/\r|\n/.test(value)) {
    return null;
  }

  return value;
}

export function requestAccessMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!shouldLogPath(req.path)) {
    next();
    return;
  }

  const startedAt = performance.now();
  const requestId = normalizeRequestId(req.headers['x-request-id']) ?? randomUUID();

  res.on('finish', () => {
    log.info(
      {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      },
      'http access',
    );
  });

  next();
}
