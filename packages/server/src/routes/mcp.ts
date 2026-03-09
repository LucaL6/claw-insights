import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Express, NextFunction, Request, Response } from 'express';
import express from 'express';
import { z } from 'zod';

import { createChildLogger } from '../logger.js';
import { authMiddleware } from '../middleware/auth.js';
import type { SnapshotEngine } from '../services/snapshot-engine.js';
import { parseSnapshotRequest } from '../services/snapshot-types.js';
import {
  CollectTimeoutError,
  GatewayUnreachableError,
  PayloadTooLargeError,
  QueueFullError,
  QueueTimeoutError,
  RateLimitedError,
  TotalTimeoutError,
} from '../utils/snapshot-errors.js';

const log = createChildLogger('mcp');

// ── Security Middleware ──

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

/** Host + remoteAddress check for no-auth mode. Reusable across /mcp and /api/snapshot. */
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

/** Content-Type whitelist — JSON only */
export function jsonContentTypeMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ct = req.headers['content-type'];
  if (!ct || !ct.includes('application/json')) {
    log.warn(
      {
        method: req.method,
        path: req.path,
        contentType: typeof ct === 'string' ? ct : null,
      },
      'security reject: invalid content-type',
    );
    res.status(415).json({ error: 'Content-Type must be application/json' });
    return;
  }
  next();
}

// ── Tool Registration ──

function registerSnapshotTool(server: McpServer, engine: SnapshotEngine): void {
  server.registerTool(
    'snapshot',
    {
      description: 'Generate a visual status snapshot of the OpenClaw infrastructure.',
      inputSchema: {
        detail: z.enum(['compact', 'standard', 'full']).default('standard'),
        format: z.enum(['png', 'json', 'svg']).default('png'),
        range: z.enum(['1h', '6h', '12h', '24h']).default('6h'),
        theme: z.enum(['dark', 'light']).default('dark'),
        lang: z.enum(['en', 'zh']).default('en'),
      },
    },
    async (params) => {
      try {
        // M-1: Use parseSnapshotRequest for type-safe validation instead of raw assertion
        const request = parseSnapshotRequest(params as Record<string, unknown>);
        const result = await engine.execute(request);

        if (result.format === 'json') {
          return { content: [{ type: 'text' as const, text: JSON.stringify(result.output, null, 2) }] };
        }

        if (result.format === 'svg') {
          // I-4: SVG → base64 image per MCP spec (image type supports image/svg+xml)
          const svgBase64 = Buffer.from(result.output as string).toString('base64');
          return {
            content: [
              {
                type: 'image' as const,
                data: svgBase64,
                mimeType: 'image/svg+xml',
              },
            ],
          };
        }

        // PNG → base64 image
        return {
          content: [
            {
              type: 'image' as const,
              data: (result.output as Buffer).toString('base64'),
              mimeType: 'image/png',
            },
          ],
        };
      } catch (err) {
        const errorMessage =
          err instanceof RateLimitedError
            ? `Rate limited. Retry after ${Math.ceil(err.retryAfterMs / 1000)}s.`
            : err instanceof QueueFullError
              ? 'Server is busy. Try again shortly.'
              : err instanceof QueueTimeoutError
                ? 'Server is busy. Try again shortly.'
                : err instanceof CollectTimeoutError
                  ? 'Data collection timed out. OpenClaw may be under heavy load.'
                  : err instanceof GatewayUnreachableError
                    ? 'OpenClaw Gateway is not reachable. Check if OpenClaw is running.'
                    : err instanceof TotalTimeoutError
                      ? 'Snapshot timeout. Try detail=compact or format=json.'
                      : err instanceof PayloadTooLargeError
                        ? 'Output too large. Use format=json.'
                        : 'Snapshot generation failed.';

        return {
          content: [{ type: 'text' as const, text: errorMessage }],
          isError: true,
        };
      }
    },
  );
}

// ── Route Registration ──

export function registerMcp(app: Express, engine: SnapshotEngine, noAuth: boolean): void {
  // Security checks BEFORE body parser — reject bad requests without consuming parse resources
  const mcpJsonParser = express.json({ limit: '1kb', type: 'application/json' });

  const middleware = noAuth
    ? [localOnlyMiddleware(noAuth), jsonContentTypeMiddleware, mcpJsonParser]
    : [localOnlyMiddleware(noAuth), jsonContentTypeMiddleware, mcpJsonParser, authMiddleware];

  // POST /mcp — stateless mode: each request gets independent server+transport
  // TODO: Consider server instance pooling if per-request GC pressure becomes an issue at high throughput
  app.post('/mcp', ...middleware, async (req: Request, res: Response) => {
    try {
      const server = new McpServer({
        name: 'claw-insights',
        version: process.env.npm_package_version ?? '0.1.0',
      });
      registerSnapshotTool(server, engine);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless mode
      });

      res.on('close', () => {
        transport.close().catch(() => {});
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      log.error({ err }, 'MCP request failed');
      if (!res.headersSent) {
        res.status(500).json({ error: 'MCP request failed' });
      }
    }
  });

  // All non-POST methods → 405
  const methodNotAllowed = (_req: Request, res: Response) => {
    res
      .status(405)
      .set('Allow', 'POST')
      .json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Stateless mode: only POST is supported' },
        id: null,
      });
  };
  app.all('/mcp', methodNotAllowed);
}
