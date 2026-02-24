#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Parse arguments
if [ "$#" -eq 0 ]; then
  JOBS=(unit integration e2e sandbox)
else
  JOBS=("$@")
fi

echo "╔══════════════════════════════════════╗"
echo "║       Local CI Simulation            ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Preflight: Node version ──
NODE_MAJOR=$(node --version | cut -d. -f1 | tr -d 'v')
if [ "$NODE_MAJOR" != "22" ]; then
  echo "⚠️  Node $NODE_MAJOR detected, CI uses Node 22. Results may differ."
  read -rp "   Continue? [y/N] " REPLY
  [[ "$REPLY" =~ ^[Yy]$ ]] || exit 1
fi

# ── Preflight: uncommitted changes ──
cd "$REPO_ROOT"
DIRTY=$(git status --porcelain)
if [ -n "$DIRTY" ]; then
  echo "⚠️  Uncommitted changes (excluded from worktree):"
  echo "$DIRTY" | sed 's/^/   /' | head -20
  echo ""
fi

# ── Preflight: port conflicts ──
PORTS_TO_CHECK=(4000 4111 4112 4113)
for port in "${PORTS_TO_CHECK[@]}"; do
  if lsof -iTCP:"$port" -sTCP:LISTEN -t &>/dev/null; then
    echo "⚠️  Port $port is in use — some tests may fail"
  fi
done

# ── actionlint (optional) ──
if command -v actionlint &>/dev/null; then
  echo ""
  echo "══ actionlint ══"
  if actionlint "$REPO_ROOT/.github/workflows/"; then
    echo "✅ actionlint passed"
  else
    echo "❌ actionlint failed"
    exit 1
  fi
  echo ""
fi

# ── Validate job names ──
VALID_JOBS=(unit integration e2e sandbox)
for job in "${JOBS[@]}"; do
  valid=false
  for v in "${VALID_JOBS[@]}"; do
    if [ "$job" = "$v" ]; then valid=true; break; fi
  done
  if ! $valid; then
    echo "❌ Unknown job: $job"
    echo "   Valid jobs: ${VALID_JOBS[*]}"
    exit 1
  fi
done

# ── Setup worktree ──
echo "══ setup ══"
WORK_DIR=$("$SCRIPT_DIR/setup-worktree.sh")
trap '"$SCRIPT_DIR/teardown.sh" "$WORK_DIR"' EXIT
echo "   worktree: $WORK_DIR"
echo ""

# ── Run jobs ──
FAILED=()
TIMES=()
for job in "${JOBS[@]}"; do
  echo "══ $job ══"
  START_TIME=$SECONDS
  if "$SCRIPT_DIR/$job.sh" "$WORK_DIR"; then
    ELAPSED=$(( SECONDS - START_TIME ))
    echo "✅ $job passed (${ELAPSED}s)"
    TIMES+=("$job:${ELAPSED}s")
  else
    ELAPSED=$(( SECONDS - START_TIME ))
    echo "❌ $job failed (${ELAPSED}s)"
    FAILED+=("$job")
    TIMES+=("$job:${ELAPSED}s(FAIL)")
  fi
  echo ""
done

# ── Summary ──
echo "══ Summary ══"
for t in "${TIMES[@]}"; do
  echo "   $t"
done
echo ""

if [ ${#FAILED[@]} -eq 0 ]; then
  echo "🎉 All jobs passed"
else
  echo "💥 Failed: ${FAILED[*]}"
  exit 1
fi
