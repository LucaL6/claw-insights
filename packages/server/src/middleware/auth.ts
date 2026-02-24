import { createHash, timingSafeEqual } from 'node:crypto';

import { parse as parseCookies } from 'cookie';
import type { NextFunction,Request, Response } from 'express';

import { config } from '../config.js';

const COOKIE_NAME = 'claw_session';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Timing-safe string comparison. Returns false if lengths differ. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {return false;}
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) {return undefined;}
  const cookies = parseCookies(cookieHeader);
  return cookies[name];
}

function csrfCheck(req: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {return true;}

  const host = req.headers.host ?? `127.0.0.1:${config.serverPort}`;
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {return origin === `http://${host}`;}
  if (referer) {return referer.startsWith(`http://${host}/`);}

  return false;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. noAuth mode
  if (config.noAuth) {
    next();
    return;
  }

  // 2. Bearer header (API/programmatic access)
  const header = req.headers.authorization;
  if (header) {
    if (!header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    const token = header.slice(7);
    if (safeEqual(token, config.apiToken)) {
      next();
      return;
    }
    res.status(403).json({ error: 'Invalid token' });
    return;
  }

  // 3. Cookie (Web UI)
  const cookie = parseCookie(req.headers.cookie, COOKIE_NAME);
  if (cookie && safeEqual(cookie, hashToken(config.apiToken))) {
    // 4. CSRF check for state-changing requests
    if (!csrfCheck(req)) {
      res.status(403).json({ error: 'CSRF check failed' });
      return;
    }
    next();
    return;
  }

  // 5. Reject
  res.status(401).json({ error: 'Unauthorized' });
}
