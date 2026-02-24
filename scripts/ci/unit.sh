#!/usr/bin/env bash
set -euo pipefail

WORK_DIR="${1:?Usage: unit.sh <worktree-path>}"
cd "$WORK_DIR"

echo "▸ Server unit tests"
npm run -w @claw-insights/server test

echo ""
echo "▸ Web unit tests"
npm run -w @claw-insights/web test
