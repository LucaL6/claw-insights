#!/usr/bin/env bash
set -euo pipefail

WORK_DIR="${1:?Usage: integration.sh <worktree-path>}"
cd "$WORK_DIR"

chmod +x sandbox/mock-openclaw/bin/openclaw

echo "▸ Integration tests (GraphQL resolvers)"
RUN_INTEGRATION=1 \
MOCK_SCENARIO=healthy \
CLAW_INSIGHTS_CLI="$WORK_DIR/sandbox/mock-openclaw/bin/openclaw" \
CLAW_INSIGHTS_SESSIONS_PATH="$WORK_DIR/sandbox/fixtures/sessions.json" \
CLAW_INSIGHTS_SERVER_PORT=4000 \
  npm run -w @claw-insights/server test -- src/__tests__/resolvers.test.ts
