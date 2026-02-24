#!/usr/bin/env bash
set -euo pipefail

# Resolve repo root (two levels up from scripts/ci/)
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# Generate unique worktree path
SHORT_SHA=$(git rev-parse --short HEAD)
WORK_DIR="/tmp/ci-local-${SHORT_SHA}-$$"

# Self-cleanup trap: if npm ci or build fails, remove the half-created worktree
cleanup_on_failure() {
  if [ -d "$WORK_DIR" ]; then
    git worktree remove --force "$WORK_DIR" 2>/dev/null || rm -rf "$WORK_DIR"
  fi
}
trap cleanup_on_failure ERR

# Create detached worktree (output to stderr so stdout stays clean for path)
git worktree add --detach "$WORK_DIR" HEAD >&2

# Install deps and build (all output to stderr)
cd "$WORK_DIR"
npm ci >&2
npm run build >&2

# Output ONLY the path to stdout (caller captures this)
echo "$WORK_DIR"
