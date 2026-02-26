import type { Express } from 'express';
import express from 'express';

import { config } from '../config.js';
import { authMiddleware } from '../middleware/auth.js';
import type { SnapshotEngine } from '../services/snapshot-engine.js';
import { localOnlyMiddleware } from './mcp.js';
import { createSnapshotHandler } from './snapshot-handler.js';

export function registerSnapshot(app: Express, engine: SnapshotEngine): void {
  // Security baseline: Host check (no-auth mode) + body size limit + auth
  const bodyParser = express.json({ limit: '1kb' });
  app.post(
    '/api/snapshot',
    localOnlyMiddleware(config.noAuth),
    bodyParser,
    authMiddleware,
    createSnapshotHandler(engine),
  );
}
