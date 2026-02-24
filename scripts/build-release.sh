#!/usr/bin/env bash
# Build a single installable package from the monorepo.
# Output: dist/release/ directory + claw-insights-<version>.tgz

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE_DIR="$REPO_DIR/dist/release"
VERSION="${1:-0.1.0}"

echo "🔨 Building claw-insights v$VERSION release..."

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

# Step 6: Generate bin entry (mirrors bin/claw-insights.mjs with release paths)
cat > "$RELEASE_DIR/bin/claw-insights" << 'ENTRY'
#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

async function main() {
  const { parseCliArgs } = await import(
    resolve(__dirname, '..', 'server', 'cli', 'parse-args.js')
  );
  const args = parseCliArgs(process.argv.slice(2));

  if (args.version) {
    console.log(`claw-insights v${pkg.version}`);
    process.exit(0);
  }

  if (args.help) {
    printUsage(pkg.version);
    process.exit(0);
  }

  const serverEntry = resolve(__dirname, '..', 'server', 'index.js');
  if (!existsSync(serverEntry)) {
    console.error(`❌ Build not found at ${serverEntry}`);
    process.exit(1);
  }

  if (args.serverOnly && process.argv.includes('--web-port')) {
    console.warn('⚠️  --web-port is ignored in server-only mode.');
  }

  process.env.NODE_ENV = process.env.NODE_ENV ?? 'production';
  process.env.CLAW_INSIGHTS_SERVER_PORT = String(args.port);
  process.env.CLAW_INSIGHTS_WEB_PORT = String(args.webPort);
  if (args.serverOnly) process.env.CLAW_INSIGHTS_SERVER_ONLY = 'true';
  if (args.noAuth) process.env.CLAW_INSIGHTS_NO_AUTH = 'true';
  if (args.gateway) process.env.CLAW_INSIGHTS_GATEWAY = args.gateway;

  const { daemonStart, daemonStop, daemonStatus, daemonLogs, daemonRestart } = await import(
    resolve(__dirname, '..', 'server', 'cli', 'daemon.js')
  );

  switch (args.command) {
    case 'start':
      await daemonStart(args, serverEntry);
      break;
    case 'stop':
      daemonStop();
      break;
    case 'status':
      await daemonStatus();
      break;
    case 'logs':
      daemonLogs(args.lines);
      break;
    case 'restart':
      await daemonRestart(args, serverEntry);
      break;
    case 'run':
      await import(serverEntry);
      break;
  }
}

function printUsage(version) {
  console.log(`
  💡 Claw Insights v${version}

  Usage:
    claw-insights [options]              Run in foreground (server + web)
    claw-insights start [options]        Start as daemon
    claw-insights stop                   Stop daemon
    claw-insights status                 Show daemon status
    claw-insights logs [--lines N]       View daemon logs
    claw-insights restart [options]      Restart daemon

  Options:
    --port <port>         Server port (default: 4000)
    --web-port <port>     Web UI port (default: 3200)
    --server-only         Run server only (no web UI)
    --no-auth             Disable authentication (local/trusted network)
    --gateway <url>       OpenClaw gateway URL
    --log-dir <dir>       Log directory
    --help, -h            Show this help
    --version, -v         Show version
  `.trim());
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
ENTRY
chmod +x "$RELEASE_DIR/bin/claw-insights"

# Step 7: Install runtime deps
cd "$RELEASE_DIR"
npm install --omit=dev

# Step 8: Pack
npm pack
mv claw-insights-*.tgz "$REPO_DIR/dist/"

echo ""
echo "✅ Release built: dist/claw-insights-${VERSION}.tgz"
echo "   Install: npm install -g dist/claw-insights-${VERSION}.tgz"
