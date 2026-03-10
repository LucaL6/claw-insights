import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { createChildLogger } from '../logger.js';
import {
  classifyEndpoint,
  extractGraphqlOperation,
  hashGraphqlDocument,
  normalizeUrlPath,
  sanitizeHost,
  shouldEmitAccessLog,
  statusClass,
  statusToLevel,
} from './request-access-utils.js';

const log = createChildLogger('http-access');

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
  const startedAt = performance.now();
  const requestId = normalizeRequestId(req.headers['x-request-id']) ?? randomUUID();
  const urlPath = normalizeUrlPath(req.originalUrl ?? req.url);
  const endpoint = classifyEndpoint(urlPath);

  if (endpoint === 'unknown') {
    next();
    return;
  }

  const rawHost =
    typeof req.headers.host === 'string'
      ? req.headers.host
      : typeof req.headers['x-forwarded-host'] === 'string'
        ? req.headers['x-forwarded-host']
        : undefined;
  const host = sanitizeHost(rawHost);

  const graphqlSnapshot = endpoint === 'graphql' ? extractGraphqlOperation(req.body) : null;
  const documentHash =
    endpoint === 'graphql' && typeof req.body === 'object' && req.body !== null && 'query' in req.body
      ? hashGraphqlDocument((req.body as { query?: unknown }).query)
      : null;

  res.on('finish', () => {
    const status = res.statusCode;
    const durationMs = Math.round(performance.now() - startedAt);
    const sample = shouldEmitAccessLog({
      status,
      durationMs,
      requestId,
      endpoint,
      operationName: graphqlSnapshot?.operationName ?? 'anonymous',
    });

    if (!sample.emit) {
      return;
    }

    const level = statusToLevel(status);
    const payload: Record<string, unknown> = {
      requestId,
      method: req.method,
      status,
      statusClass: statusClass(status),
      durationMs,
      host,
      urlPath,
      endpoint,
    };

    if (endpoint === 'graphql') {
      payload.operationName = graphqlSnapshot?.operationName ?? 'anonymous';
      payload.operationType = graphqlSnapshot?.operationType ?? null;
      payload.documentHash = documentHash;
      payload.opParseError = graphqlSnapshot?.opParseError ?? false;
      payload.sampleReason = sample.sampleReason;
    }

    log[level](payload, 'http access');
  });

  next();
}
