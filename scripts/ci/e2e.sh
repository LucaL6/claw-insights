#!/usr/bin/env bash
set -euo pipefail

WORK_DIR="${1:?Usage: e2e.sh <worktree-path>}"
cd "$WORK_DIR"

echo "▸ Installing Playwright Chromium"
npx playwright install --with-deps chromium

echo ""
echo "▸ E2E tests"
npm run -w @claw-insights/web test:e2e

echo ""
echo "📁 Playwright report: $WORK_DIR/packages/web/playwright-report/"
