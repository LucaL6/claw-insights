import { timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';

import { parse as parseCookies } from 'cookie';
import type { NextFunction, Request, Response } from 'express';

import { triggerAuthRotationFallbackCheck } from '../auth/rotation-runner.js';
import { findCookieMatch, parseSessionCookie } from '../auth/token-state.js';
import { loadOrInitTokenState } from '../auth/token-state-store.js';
import { config, getDataDir } from '../config.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('middleware:auth');

const COOKIE_NAME = 'claw_session';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CONFIG_PATH = join(getDataDir(), 'config.json');

/** Timing-safe string comparison. Returns false if lengths differ. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  const cookies = parseCookies(cookieHeader);
  return cookies[name];
}

function csrfCheck(req: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return true;
  }

  const host = req.headers.host ?? `127.0.0.1:${config.serverPort}`;
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {
    return origin === `http://${host}`;
  }
  if (referer) {
    return referer.startsWith(`http://${host}/`);
  }

  return false;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. noAuth mode
  if (config.noAuth) {
    next();
    return;
  }

  // Request-path fallback rotation check (throttled in runner, best-effort)
  triggerAuthRotationFallbackCheck();

  // 2. Bearer header (API/programmatic access)
  const header = req.headers.authorization;
  if (header) {
    if (!header.startsWith('Bearer ')) {
      log.warn({ method: req.method, path: req.path }, 'auth rejected: malformed Authorization header');
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    const token = header.slice(7);
    if (safeEqual(token, config.apiToken)) {
      log.debug({ method: req.method, path: req.path }, 'auth ok via bearer');
      next();
      return;
    }
    log.warn({ method: req.method, path: req.path }, 'auth rejected: invalid bearer token');
    res.status(403).json({ error: 'Invalid token' });
    return;
  }

  // 3. Cookie (Web UI)
  const cookie = parseCookie(req.headers.cookie, COOKIE_NAME);
  if (cookie) {
    const parsed = parseSessionCookie(cookie);
    if (parsed.kind === 'legacy') {
      log.warn({ method: req.method, path: req.path }, 'auth rejected: legacy session cookie format');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (parsed.kind === 'malformed') {
      log.warn({ method: req.method, path: req.path }, 'auth rejected: malformed session cookie');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const now = Date.now();
    const state = loadOrInitTokenState(CONFIG_PATH, config.apiToken, now);
    const match = findCookieMatch(state, cookie, now);

    if (match.kind === 'active' || match.kind === 'previous') {
      if (match.kind === 'previous') {
        res.cookie(COOKIE_NAME, `${state.activeKid}:${state.activeDigest}`, {
          httpOnly: true,
          sameSite: 'strict',
          secure: false,
          maxAge: COOKIE_MAX_AGE_MS,
          path: '/',
        });
      }

      // 4. CSRF check for state-changing requests
      if (!csrfCheck(req)) {
        log.warn({ method: req.method, path: req.path }, 'auth rejected: CSRF check failed');
        res.status(403).json({ error: 'CSRF check failed' });
        return;
      }

      log.debug({ method: req.method, path: req.path }, 'auth ok via cookie');
      next();
      return;
    }
  }

  // 5. Reject
  log.warn({ method: req.method, path: req.path }, 'auth rejected: no valid credentials');
  res.status(401).json({ error: 'Unauthorized' });
}
