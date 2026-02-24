#!/usr/bin/env bash
set -euo pipefail

WORK_DIR="${1:?Usage: sandbox.sh <worktree-path>}"
cd "$WORK_DIR"

# 1. Build release tarball
echo "▸ Building release tarball"
bash scripts/build-release.sh 0.0.0-local

# 2. Install from tarball into worktree-local prefix
echo ""
echo "▸ Installing from tarball"
npm install -g --prefix "$WORK_DIR/.local" ./dist/claw-insights-*.tgz
export PATH="$WORK_DIR/.local/bin:$PATH"

# 3. Run mock scenarios with fixed ports (matching CI)
chmod +x sandbox/mock-openclaw/bin/openclaw

SCENARIOS=(healthy offline no-sessions)
PORTS=(4111 4112 4113)

for i in 0 1 2; do
  echo ""
  echo "▸ Sandbox scenario: ${SCENARIOS[$i]} (port ${PORTS[$i]})"
  MOCK_SCENARIO="${SCENARIOS[$i]}" bash sandbox/sandbox-verify.sh \
    --cli-path sandbox/mock-openclaw/bin/openclaw \
    --port "${PORTS[$i]}"
done
