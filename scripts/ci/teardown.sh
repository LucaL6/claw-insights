#!/usr/bin/env bash
set -euo pipefail

WORK_DIR="${1:?Usage: teardown.sh <worktree-path>}"

if [ -d "$WORK_DIR" ]; then
  # Try git worktree remove first, fallback to rm
  REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
  cd "$REPO_ROOT"
  git worktree remove --force "$WORK_DIR" 2>/dev/null || rm -rf "$WORK_DIR"
  echo "🧹 Cleaned up $WORK_DIR"
else
  echo "⚠️  Worktree not found: $WORK_DIR"
fi
