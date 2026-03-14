import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

import express from 'express';

export function mountSpaFallbackRoutes(app: express.Express, webDistPath: string): void {
  app.use(express.static(webDistPath, { index: 'index.html' }));

  // SPA fallback — serve index.html for non-API, non-file GET routes
  const serveIndex = (_req: express.Request, res: express.Response) => {
    res.type('html').send(readFileSync(resolve(webDistPath, 'index.html'), 'utf-8'));
  };

  app.get('/', serveIndex);
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/graphql') || req.path.startsWith('/api') || req.path.startsWith('/health')) {
      next();
      return;
    }

    // Don't serve index.html for requests with file extensions (e.g. /foo.js, /bar.css)
    if (extname(req.path)) {
      next();
      return;
    }

    serveIndex(req, res);
  });
}
