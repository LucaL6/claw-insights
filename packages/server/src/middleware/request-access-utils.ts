import { createHash } from 'node:crypto';

import { Kind, parse } from 'graphql';

export type AccessEndpoint = 'graphql' | 'snapshot' | 'api' | 'mcp' | 'unknown';

export interface GraphqlOperationMetadata {
  operationName: string;
  operationType: 'query' | 'mutation' | 'subscription' | null;
  opParseError: boolean;
}

export interface AccessSampleDecision {
  emit: boolean;
  sampleReason: 'error' | 'slow' | 'sampled' | 'dropped';
}

export function normalizeUrlPath(originalUrl: string): string {
  const withoutHash = originalUrl.split('#', 1)[0] ?? '';
  const rawPath = withoutHash.split('?', 1)[0] ?? '/';
  const path = rawPath.trim() || '/';

  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }

  return path;
}

export function sanitizeHost(rawHost: string | undefined): string | null {
  if (!rawHost) {
    return null;
  }

  const firstHop = (rawHost.split(',', 1)[0] ?? '').trim().toLowerCase();
  if (!firstHop) {
    return null;
  }

  if (firstHop.startsWith('[')) {
    const closingIndex = firstHop.indexOf(']');
    if (closingIndex > 0) {
      return firstHop.slice(1, closingIndex);
    }
  }

  const hostname = (firstHop.split(':', 1)[0] ?? '').trim();
  return hostname || null;
}

export function classifyEndpoint(urlPath: string): AccessEndpoint {
  const path = normalizeUrlPath(urlPath);

  if (path === '/graphql') {
    return 'graphql';
  }

  if (path === '/mcp' || path.startsWith('/mcp/')) {
    return 'mcp';
  }

  if (path === '/api/snapshot' || path.startsWith('/api/snapshot/')) {
    return 'snapshot';
  }

  if (path === '/api' || path.startsWith('/api/')) {
    return 'api';
  }

  return 'unknown';
}

export function statusToLevel(status: number): 'info' | 'warn' | 'error' {
  if (status >= 500) {
    return 'error';
  }
  if (status >= 400) {
    return 'warn';
  }
  return 'info';
}

export function statusClass(status: number): '2xx' | '3xx' | '4xx' | '5xx' | 'unknown' {
  if (status >= 200 && status < 300) {
    return '2xx';
  }
  if (status >= 300 && status < 400) {
    return '3xx';
  }
  if (status >= 400 && status < 500) {
    return '4xx';
  }
  if (status >= 500 && status < 600) {
    return '5xx';
  }
  return 'unknown';
}

export function extractGraphqlOperation(body: unknown): GraphqlOperationMetadata {
  const query = typeof body === 'object' && body !== null && 'query' in body ? (body.query) : undefined;
  const operationName =
    typeof body === 'object' && body !== null && 'operationName' in body ? (body.operationName) : undefined;

  const normalizedClientOperationName = typeof operationName === 'string' ? operationName.trim() : '';
  const queryText = typeof query === 'string' ? query : '';

  if (!queryText.trim()) {
    return {
      operationName: normalizedClientOperationName || 'anonymous',
      operationType: null,
      opParseError: false,
    };
  }

  try {
    const document = parse(queryText);
    const operationDefinition = document.definitions.find((d) => d.kind === Kind.OPERATION_DEFINITION);

    if (!operationDefinition || operationDefinition.kind !== Kind.OPERATION_DEFINITION) {
      return {
        operationName: normalizedClientOperationName || 'anonymous',
        operationType: null,
        opParseError: false,
      };
    }

    return {
      operationName: normalizedClientOperationName || operationDefinition.name?.value || 'anonymous',
      operationType: operationDefinition.operation,
      opParseError: false,
    };
  } catch {
    return {
      operationName: normalizedClientOperationName || 'anonymous',
      operationType: null,
      opParseError: true,
    };
  }
}

export function hashGraphqlDocument(query: unknown): string | null {
  const text = typeof query === 'string' ? query.trim() : '';
  if (!text) {
    return null;
  }

  return createHash('sha256').update(text).digest('hex');
}

export function shouldEmitAccessLog(input: {
  status: number;
  durationMs: number;
  requestId: string;
  endpoint: string;
  operationName: string;
}): AccessSampleDecision {
  if (input.durationMs > 1000) {
    return { emit: true, sampleReason: 'slow' };
  }

  if (input.status >= 400) {
    return { emit: true, sampleReason: 'error' };
  }

  const key = `${input.requestId}|${input.endpoint}|${input.operationName}`;
  const hash = createHash('sha256').update(key).digest();
  const bucket = hash.readUInt32BE(0) % 100;

  if (bucket < 30) {
    return { emit: true, sampleReason: 'sampled' };
  }

  return { emit: false, sampleReason: 'dropped' };
}
