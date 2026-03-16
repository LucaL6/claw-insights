import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const releaseDir = resolve(__dirname, '..', '..', 'dist', 'release');

const REQUIRED_ASSETS = [
  'assets/fonts/Inter-Regular.ttf',
  'assets/fonts/Inter-Bold.ttf',
  'assets/fonts/Inter-Medium.ttf',
  'assets/fonts/Inter-SemiBold.ttf',
  'assets/fonts/Inter-ExtraBold.ttf',
  'assets/fonts/JetBrainsMono-Regular.ttf',
  'assets/fonts/NotoSansSC-Regular-subset.ttf',
  'assets/openclaw-lobster.svg',
  'assets/logo/icon-dark.svg',
  'assets/logo/icon-light.svg',
  'server/index.js',
  'server/schema.graphql',
  'web/index.html',
  'bin/claw-insights',
  'README.md',
  'LICENSE',
  'package.json',
];

let failed = false;
for (const file of REQUIRED_ASSETS) {
  const full = resolve(releaseDir, file);
  if (!existsSync(full)) {
    console.error(`❌ Missing: ${file}`);
    failed = true;
  }
}

if (failed) {
  console.error('\n❌ Package asset verification failed!');
  process.exit(1);
}

console.log(`✅ All ${REQUIRED_ASSETS.length} required assets present in release package.`);
