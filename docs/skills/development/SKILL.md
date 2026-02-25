---
name: development
description: Local development setup for Claw Insights — clone, dev server, tests, codegen. Use when cloning the repo, developing features, running tests, or preparing pull requests.
---

# Development Workflow

Local development setup for Claw Insights. Requires Node.js ≥22.5 and npm ≥10.

## Quick Reference

```bash
# Setup
git clone https://github.com/nicepkg/claw-insights.git
cd claw-insights && npm install

# Dev server (codegen watch + server + web concurrently)
npm run dev                # Web :41042 | API :41041 | Auth disabled

# Codegen (after changing schema.graphql)
npm run codegen            # One-shot
npm run codegen:watch      # Watch mode

# Test
npm test                   # All tests
npm run test:server        # Server only (vitest)
npm run test:web           # Web only (vitest)
npm run test:e2e           # E2E (Playwright)

# Build & format
npm run build              # Build all packages
npm run format             # Prettier
```

## Details

For full documentation, see:

- [Architecture — Development](../../architecture.md#development) — directory structure, test conventions, code style, commit workflow, Docker smoke test
