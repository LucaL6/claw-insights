import { createHash, timingSafeEqual } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { config } from '../config.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('middleware:cookie-exchange');

const COOKIE_NAME = 'claw_session';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Timing-safe string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function cookieExchangeMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.query.token as string | undefined;

  if (!token || config.noAuth) {
    next();
    return;
  }

  if (!safeEqual(token, config.apiToken)) {
    log.warn('cookie exchange rejected: invalid token');
    res.status(403).send('Invalid token. Check your startup logs.');
    return;
  }

  log.debug('cookie exchange: issuing session cookie');
  res.cookie(COOKIE_NAME, hashToken(config.apiToken), {
    httpOnly: true,
    sameSite: 'strict',
    secure: false,
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  res.redirect(303, '/');
}
