#!/usr/bin/env bash
# Build a single installable package from the monorepo.
# Output: dist/release/ directory + claw-insights-<version>.tgz

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE_DIR="$REPO_DIR/dist/release"
VERSION="${1:-0.1.0}"

echo "🔨 Building claw-insights v$VERSION release..."

# Step 0: Guard canonical CLI entrypoint parity before packaging
node "$REPO_DIR/scripts/check-cli-runtime-policy-parity.mjs"

# Step 1: Clean
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR/bin" "$RELEASE_DIR/server" "$RELEASE_DIR/web"

# Step 2: Build all packages
echo "  Running codegen..."
cd "$REPO_DIR"
npm run codegen
echo "  Building packages..."
npm run build

# Step 3: Copy server dist
cp -r packages/server/dist/* "$RELEASE_DIR/server/"

# Step 4: Copy web dist (static files)
cp -r packages/web/dist/* "$RELEASE_DIR/web/"

# Step 4.5: Copy font assets
echo "  Copying font assets..."
mkdir -p "$RELEASE_DIR/assets/fonts"
cp packages/server/assets/fonts/*.ttf "$RELEASE_DIR/assets/fonts/"
cp packages/server/assets/fonts/OFL-LICENSE.txt "$RELEASE_DIR/assets/fonts/"
cp packages/server/assets/openclaw-lobster.svg "$RELEASE_DIR/assets/openclaw-lobster.svg"

echo "  Copying logo assets..."
mkdir -p "$RELEASE_DIR/assets/logo"
cp packages/web/public/logo/icon-dark.svg "$RELEASE_DIR/assets/logo/"
cp packages/web/public/logo/icon-light.svg "$RELEASE_DIR/assets/logo/"

# Step 5: Generate package.json (auto-extract runtime deps from server)
echo "  Extracting runtime dependencies from packages/server/package.json..."
SERVER_DEPS=$(node -e "
  const pkg = require('./packages/server/package.json');
  const deps = pkg.dependencies || {};
  // Filter out workspace references
  const filtered = Object.fromEntries(
    Object.entries(deps).filter(([, v]) => !v.startsWith('workspace:'))
  );
  console.log(JSON.stringify(filtered, null, 4));
")

cat > "$RELEASE_DIR/package.json" << EOF
{
  "name": "claw-insights",
  "version": "$VERSION",
  "description": "Real-time monitoring dashboard for OpenClaw gateway",
  "type": "module",
  "bin": {
    "claw-insights": "./bin/claw-insights"
  },
  "files": ["bin/", "server/", "web/", "assets/"],
  "engines": { "node": ">=22" },
  "license": "MIT",
  "author": "Luca Liao",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/LucaL6/claw-insights.git"
  },
  "homepage": "https://github.com/LucaL6/claw-insights#readme",
  "bugs": {
    "url": "https://github.com/LucaL6/claw-insights/issues"
  },
  "keywords": ["openclaw", "dashboard", "monitoring", "analytics", "ai-agent"],
  "dependencies": $SERVER_DEPS
}
EOF

# Verify deps were extracted
DEP_COUNT=$(node -e "const d=require('$RELEASE_DIR/package.json').dependencies; console.log(Object.keys(d).length)")
if [ "$DEP_COUNT" -lt 1 ]; then
  echo "❌ Failed to extract runtime dependencies (got $DEP_COUNT)"
  exit 1
fi
echo "  Extracted $DEP_COUNT runtime dependencies"

# Step 6: Reuse canonical bin entrypoint (single source of truth)
cp "$REPO_DIR/bin/claw-insights.mjs" "$RELEASE_DIR/bin/claw-insights"
chmod +x "$RELEASE_DIR/bin/claw-insights"

# Step 7: Install runtime deps
cd "$RELEASE_DIR"
npm install --omit=dev

echo "  Verifying required assets..."
node "$REPO_DIR/scripts/ci/verify-package-assets.mjs"

# Step 8: Pack
npm pack
mv claw-insights-*.tgz "$REPO_DIR/dist/"

echo ""
echo "✅ Release built: dist/claw-insights-${VERSION}.tgz"
echo "   Install: npm install -g dist/claw-insights-${VERSION}.tgz"
