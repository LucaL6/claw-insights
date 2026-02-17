import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip auth if no token configured (local dev mode)
  if (!config.apiToken) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7);
  if (token !== config.apiToken) {
    res.status(403).json({ error: 'Invalid token' });
    return;
  }

  next();
}
