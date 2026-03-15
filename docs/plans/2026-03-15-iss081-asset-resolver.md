# ISS-081 Asset Resolver + SVG Inlining Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate runtime path resolution bugs for SVG assets by inlining them, centralize font path resolution, and fix error serialization.

**Architecture:** Small SVGs (logo icons, lobster — total 4.4KB) are embedded as build-time constants, eliminating runtime file I/O and path resolution entirely. Font loading keeps runtime resolution but uses a centralized resolver with explicit npm package structure support. Error logging gets serialization fallback for non-Error objects.

**Tech Stack:** TypeScript, Vitest, tsup, pino

**Ref:** `Obsidian/10-Projects/Claw-Insights/Issues/ISS-081-SnapshotLogoPathResolution-2026-03-15.md`

**Review:** PASS WITH CONDITIONS — Opus 4.6 (86/100) + Codex 5.3 (82/100). Plan updated per review findings.

---

## Phase 1: Inline SVG Assets (eliminates logo/lobster path bugs)

### Task 1: Create embedded SVG asset module

**Files:**

- Create: `packages/server/src/renderer/markup/embedded-assets.ts`
- Create: `packages/server/src/renderer/markup/__tests__/embedded-assets.test.ts`
- Create: `scripts/sync-embedded-assets.mjs` (codegen script to refresh constants from source SVGs)

**Context:**

- `icon-dark.svg` (1826B), `icon-light.svg` (1385B), `openclaw-lobster.svg` (1194B)
- Source: `packages/web/public/logo/` (icons), `packages/server/assets/` (lobster)
- All three are static brand assets that rarely change

**Step 1: Write the failing test**

```typescript
// packages/server/src/renderer/markup/__tests__/embedded-assets.test.ts
import { describe, expect, it } from 'vitest';

import {
  ICON_DARK_DATA_URI,
  ICON_LIGHT_DATA_URI,
  LOBSTER_DATA_URI,
  getFooterLogoDataUri,
  getLobsterLogoDataUri,
} from '../embedded-assets.js';

describe('embedded-assets', () => {
  it('exports valid data URIs for all brand SVGs', () => {
    for (const uri of [ICON_DARK_DATA_URI, ICON_LIGHT_DATA_URI, LOBSTER_DATA_URI]) {
      expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
      const decoded = Buffer.from(uri.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8');
      expect(decoded).toContain('<svg');
      expect(decoded).toContain('</svg>');
    }
  });

  it('icon-dark is a valid SVG with viewBox', () => {
    const decoded = Buffer.from(ICON_DARK_DATA_URI.replace('data:image/svg+xml;base64,', ''), 'base64').toString(
      'utf8',
    );
    expect(decoded).toContain('viewBox');
  });

  it('icon-light is a valid SVG with viewBox', () => {
    const decoded = Buffer.from(ICON_LIGHT_DATA_URI.replace('data:image/svg+xml;base64,', ''), 'base64').toString(
      'utf8',
    );
    expect(decoded).toContain('viewBox');
  });

  it('icon-dark and icon-light are distinct assets', () => {
    expect(ICON_DARK_DATA_URI).not.toBe(ICON_LIGHT_DATA_URI);
  });

  it('lobster is a valid SVG with viewBox', () => {
    const decoded = Buffer.from(LOBSTER_DATA_URI.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8');
    expect(decoded).toContain('viewBox');
  });

  it('getFooterLogoDataUri returns dark icon for dark theme', () => {
    expect(getFooterLogoDataUri('dark')).toBe(ICON_DARK_DATA_URI);
  });

  it('getFooterLogoDataUri returns light icon for light theme', () => {
    expect(getFooterLogoDataUri('light')).toBe(ICON_LIGHT_DATA_URI);
  });

  it('getLobsterLogoDataUri returns the lobster', () => {
    expect(getLobsterLogoDataUri()).toBe(LOBSTER_DATA_URI);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/server && npx vitest run src/renderer/markup/__tests__/embedded-assets.test.ts
```

Expected: FAIL — module not found

**Step 3: Create embedded assets module**

```typescript
// packages/server/src/renderer/markup/embedded-assets.ts
//
// Brand SVG assets inlined as base64 data URIs.
// Eliminates runtime file I/O and path resolution — these are static,
// rarely-changing brand assets totaling ~4.4KB.
//
// To regenerate after SVG changes: node scripts/sync-embedded-assets.mjs
//

export type BrandTheme = 'dark' | 'light';

/** icon-dark.svg — footer brand icon (dark theme) */
export const ICON_DARK_DATA_URI = 'data:image/svg+xml;base64,<BASE64_CONTENT>';

/** icon-light.svg — footer brand icon (light theme) */
export const ICON_LIGHT_DATA_URI = 'data:image/svg+xml;base64,<BASE64_CONTENT>';

/** openclaw-lobster.svg — header brand mascot */
export const LOBSTER_DATA_URI = 'data:image/svg+xml;base64,<BASE64_CONTENT>';

/** Get the footer brand icon data URI for the given theme */
export function getFooterLogoDataUri(theme: BrandTheme): string {
  return theme === 'dark' ? ICON_DARK_DATA_URI : ICON_LIGHT_DATA_URI;
}

/** Get the lobster mascot data URI */
export function getLobsterLogoDataUri(): string {
  return LOBSTER_DATA_URI;
}
```

Replace `<BASE64_CONTENT>` placeholders with actual base64 from the source SVGs:

```bash
node -e "
const fs = require('fs');
const files = {
  ICON_DARK: 'packages/web/public/logo/icon-dark.svg',
  ICON_LIGHT: 'packages/web/public/logo/icon-light.svg',
  LOBSTER: 'packages/server/assets/openclaw-lobster.svg',
};
for (const [key, path] of Object.entries(files)) {
  const b64 = fs.readFileSync(path).toString('base64');
  console.log(key + ':', b64.length, 'chars');
}
"
```

**Step 4: Create sync script**

```javascript
// scripts/sync-embedded-assets.mjs
// Reads source SVGs and regenerates embedded-assets.ts constants.
// Run: node scripts/sync-embedded-assets.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const ASSETS = [
  { name: 'ICON_DARK', src: 'packages/web/public/logo/icon-dark.svg', desc: 'footer brand icon (dark theme)' },
  { name: 'ICON_LIGHT', src: 'packages/web/public/logo/icon-light.svg', desc: 'footer brand icon (light theme)' },
  { name: 'LOBSTER', src: 'packages/server/assets/openclaw-lobster.svg', desc: 'header brand mascot' },
];

const TARGET = 'packages/server/src/renderer/markup/embedded-assets.ts';

const entries = ASSETS.map(({ name, src, desc }) => {
  const svg = readFileSync(resolve(root, src), 'utf8');
  const b64 = Buffer.from(svg).toString('base64');
  return { name, b64, desc };
});

const code = `//
// Brand SVG assets inlined as base64 data URIs.
// AUTO-GENERATED by scripts/sync-embedded-assets.mjs — do not edit manually.
//
// To regenerate after SVG changes: node scripts/sync-embedded-assets.mjs
//

export type BrandTheme = 'dark' | 'light';

${entries.map(({ name, b64, desc }) => `/** ${desc} */\nexport const ${name}_DATA_URI = 'data:image/svg+xml;base64,${b64}';\n`).join('\n')}
/** Get the footer brand icon data URI for the given theme */
export function getFooterLogoDataUri(theme: BrandTheme): string {
  return theme === 'dark' ? ICON_DARK_DATA_URI : ICON_LIGHT_DATA_URI;
}

/** Get the lobster mascot data URI */
export function getLobsterLogoDataUri(): string {
  return LOBSTER_DATA_URI;
}
`;

writeFileSync(resolve(root, TARGET), code);
console.log('✅ Updated', TARGET);
```

**Step 5: Run sync script, then run test to verify it passes**

```bash
node scripts/sync-embedded-assets.mjs
cd packages/server && npx vitest run src/renderer/markup/__tests__/embedded-assets.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/server/src/renderer/markup/embedded-assets.ts \
       packages/server/src/renderer/markup/__tests__/embedded-assets.test.ts \
       scripts/sync-embedded-assets.mjs
git commit -m "feat(snapshot): add embedded SVG asset module (ISS-081)"
```

---

### Task 2: Refactor footer to use embedded assets

**Files:**

- Modify: `packages/server/src/renderer/markup/footer.ts`
- Modify: `packages/server/src/renderer/markup/__tests__/footer.test.ts`
- Delete: `packages/server/src/renderer/markup/logo-assets.ts`

**Context:**

- `footer.ts` currently imports `loadLogoDataUri` and `getFooterBrandLogoFile` from `logo-assets.ts`
- Replace with `getFooterLogoDataUri` from `embedded-assets.ts`
- `logo-assets.ts` becomes dead code → delete

**Step 1: Update footer.ts imports and usage**

```typescript
// footer.ts — replace:
import type { BrandTheme } from './logo-assets.js';
import { getFooterBrandLogoFile, loadLogoDataUri } from './logo-assets.js';
// ...
const logoSrc = loadLogoDataUri(getFooterBrandLogoFile(theme));

// with:
import type { BrandTheme } from './embedded-assets.js';
import { getFooterLogoDataUri } from './embedded-assets.js';
// ...
const logoSrc = getFooterLogoDataUri(theme);
```

**Step 2: Update footer test**

The existing test checks for `data:image/svg+xml;base64,` prefix and decoded content — this should still pass since the embedded content is identical. Verify no test imports from `logo-assets.js`.

**Step 3: Delete `logo-assets.ts`**

```bash
rm packages/server/src/renderer/markup/logo-assets.ts
```

**Step 4: Check for any remaining imports of logo-assets**

```bash
grep -rn "logo-assets" packages/server/src/ --include="*.ts"
```

Expected: no results (or only test snapshots to clean up)

**Step 5: Run tests**

```bash
cd packages/server && npx vitest run src/renderer/markup/__tests__/footer.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor(snapshot): footer uses embedded SVG assets, remove logo-assets.ts (ISS-081)"
```

---

### Task 3: Refactor header to use embedded lobster

**Files:**

- Modify: `packages/server/src/renderer/markup/header.ts`
- Modify: `packages/server/src/renderer/markup/__tests__/header.test.ts`

**Context:**

- `header.ts` has its own `resolveLobsterAssetPath` + `FALLBACK_LOBSTER_SVG` + caching logic
- Replace all of that with `getLobsterLogoDataUri` from `embedded-assets.ts`
- Remove `_resetLobsterCache` export (no longer needed)

**Step 1: Refactor header.ts**

Remove:

- `FALLBACK_LOBSTER_SVG` constant
- `resolveLobsterAssetPath()` function
- `getLobsterDataUri()` function with its caching
- `_resetLobsterCache` export
- `import { existsSync, readFileSync } from 'node:fs'`
- `import { dirname, resolve } from 'node:path'`
- `import { fileURLToPath } from 'node:url'`

Add:

```typescript
import { getLobsterLogoDataUri } from './embedded-assets.js';
```

Replace usage in `renderHeader`:

```typescript
// was:
const lobsterUri = getLobsterDataUri();
// now:
const lobsterUri = getLobsterLogoDataUri();
```

**Step 2: Update header tests**

- Remove tests for `resolveLobsterAssetPath`, `_resetLobsterCache`, `getLobsterDataUri` fallback paths
- **Keep:** the test `'uses the lobster asset styling in snapshot header icon with fixed 32x32 size'` — update to verify decoded SVG contains `<svg` and image has `width: 32, height: 32`
- **Keep:** all `renderHeader` tests for online/offline status, locale, and detail-level branches
- Add a simple test: lobster image `src` in header is a valid `data:image/svg+xml;base64,` URI
- Also check `header-branches.test.ts` — it only imports `renderHeader`, no changes needed

**Step 3: Run tests**

```bash
cd packages/server && npx vitest run src/renderer/markup/__tests__/header.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor(snapshot): header uses embedded lobster SVG (ISS-081)"
```

---

## Phase 2: Centralized Font Resolver

### Task 4: Create asset resolver utility

**Files:**

- Create: `packages/server/src/renderer/asset-resolver.ts`
- Create: `packages/server/src/renderer/__tests__/asset-resolver.test.ts`

**Context:**

- `fonts.ts` currently uses `import.meta.url` based `__dirname` + 2 candidates
- Works on npm package by accident (`resolve(__dirname, '../assets/fonts')` = `<pkg>/assets/fonts`)
- Should be explicit about npm package structure
- Support `CLAW_INSIGHTS_FONTS_DIR` env override (existing behavior)

**Step 1: Write failing test**

```typescript
// packages/server/src/renderer/__tests__/asset-resolver.test.ts
import { describe, expect, it, vi } from 'vitest';

import { resolveAssetDir } from '../asset-resolver.js';

describe('resolveAssetDir', () => {
  it('resolves fonts dir from npm package structure', () => {
    const result = resolveAssetDir('fonts', {
      moduleDir: '/pkg/server',
      cwd: '/pkg',
      pathExists: (p) => p === '/pkg/assets/fonts',
    });
    expect(result).toBe('/pkg/assets/fonts');
  });

  it('resolves fonts dir from monorepo dev structure', () => {
    const result = resolveAssetDir('fonts', {
      moduleDir: '/repo/packages/server/dist/renderer',
      cwd: '/repo',
      pathExists: (p) => p === '/repo/packages/server/assets/fonts',
    });
    expect(result).toBe('/repo/packages/server/assets/fonts');
  });

  it('prefers env override when set', () => {
    vi.stubEnv('CLAW_INSIGHTS_FONTS_DIR', '/custom/fonts');
    const result = resolveAssetDir('fonts', {
      moduleDir: '/pkg/server',
      cwd: '/pkg',
      pathExists: (p) => p === '/custom/fonts' || p === '/pkg/assets/fonts',
    });
    expect(result).toBe('/custom/fonts');
    vi.unstubAllEnvs();
  });

  it('throws with clear message when no candidate resolves', () => {
    expect(() =>
      resolveAssetDir('fonts', {
        moduleDir: '/nowhere',
        cwd: '/nowhere',
        pathExists: () => false,
      }),
    ).toThrow(/fonts.*not found/i);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/server && npx vitest run src/renderer/__tests__/asset-resolver.test.ts
```

Expected: FAIL — module not found

**Step 3: Implement asset resolver**

```typescript
// packages/server/src/renderer/asset-resolver.ts
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultModuleDir = dirname(fileURLToPath(import.meta.url));

interface ResolveOptions {
  moduleDir?: string;
  cwd?: string;
  pathExists?: (path: string) => boolean;
}

const ENV_OVERRIDES: Record<string, string> = {
  fonts: 'CLAW_INSIGHTS_FONTS_DIR',
};

/**
 * Resolve an asset directory across npm package and monorepo structures.
 *
 * Resolution order:
 * 1. Environment variable override (CLAW_INSIGHTS_FONTS_DIR, etc.)
 * 2. npm package layout: <cwd>/assets/<subdir>
 * 3. npm package layout: <moduleDir>/../assets/<subdir>
 * 4. Monorepo dev layout: <moduleDir>/../../assets/<subdir>
 * 5. Monorepo dev layout: <cwd>/packages/server/assets/<subdir>
 */
export function resolveAssetDir(subdir: string, opts?: ResolveOptions): string {
  const moduleDir = opts?.moduleDir ?? defaultModuleDir;
  const cwd = opts?.cwd ?? process.cwd();
  const pathExists = opts?.pathExists ?? existsSync;

  // 1. Env override
  const envKey = ENV_OVERRIDES[subdir];
  if (envKey) {
    const envVal = process.env[envKey];
    if (envVal && pathExists(envVal)) {
      return envVal;
    }
  }

  // 2-5. Candidate paths
  const candidates = [
    resolve(cwd, 'assets', subdir), // npm: <pkg>/assets/fonts
    resolve(moduleDir, '..', 'assets', subdir), // npm: <pkg>/server/../assets/fonts
    resolve(moduleDir, '..', '..', 'assets', subdir), // dev: dist/renderer/../../assets/fonts
    resolve(cwd, 'packages', 'server', 'assets', subdir), // dev: monorepo root
  ];

  for (const candidate of candidates) {
    if (pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Asset directory '${subdir}' not found. ` +
      `Set ${envKey || `CLAW_INSIGHTS_${subdir.toUpperCase()}_DIR`} or check installation. ` +
      `Checked: ${candidates.join(', ')}`,
  );
}
```

**Step 4: Run test**

```bash
cd packages/server && npx vitest run src/renderer/__tests__/asset-resolver.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/renderer/asset-resolver.ts \
       packages/server/src/renderer/__tests__/asset-resolver.test.ts
git commit -m "feat(snapshot): add centralized asset directory resolver (ISS-081)"
```

---

### Task 5: Refactor fonts.ts to use centralized resolver

**Files:**

- Modify: `packages/server/src/renderer/fonts.ts`
- Modify: `packages/server/src/renderer/__tests__/fonts.test.ts`

**Step 1: Refactor fonts.ts**

Replace the entire `__dirname`-based candidate search AND `customDir` logic with a single `resolveAssetDir('fonts')` call.
`CLAW_INSIGHTS_FONTS_DIR` env override is now handled internally by `resolveAssetDir` — no need to check it twice.

```typescript
// Remove ALL of these:
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
// ...
const customDir = process.env.CLAW_INSIGHTS_FONTS_DIR;
const candidates = [resolve(__dirname, '../../assets/fonts'), resolve(__dirname, '../assets/fonts')];
const builtinDir = candidates.find((d) => existsSync(d));
if (!builtinDir && !customDir) { ... }
const fontDir = customDir && existsSync(customDir) ? customDir : builtinDir;
if (!fontDir) { ... }

// Replace with:
import { resolveAssetDir } from './asset-resolver.js';
// ...
const fontDir = resolveAssetDir('fonts');
```

**⚠️ Review fix:** Previous version kept `customDir` check in `fonts.ts` + env check inside `resolveAssetDir`, violating DRY. Now env override is handled exclusively by the resolver.

**Step 2: Run existing tests**

```bash
cd packages/server && npx vitest run src/renderer/__tests__/fonts.test.ts
```

Expected: PASS (behavior unchanged)

**Step 3: Commit**

```bash
git add packages/server/src/renderer/fonts.ts
git commit -m "refactor(snapshot): fonts.ts uses centralized asset resolver (ISS-081)"
```

---

## Phase 3: Error Handling + Diagnostics

### Task 6: Fix pino error serialization

**Files:**

- Create: `packages/server/src/utils/error-serializer.ts`
- Create: `packages/server/src/utils/__tests__/error-serializer.test.ts`
- Modify: `packages/server/src/routes/snapshot-handler.ts`
- Modify: `packages/server/src/renderer/satori-renderer.ts`

**Context:**

- Pino v10 transport workers use structured clone for message passing
- Error objects lose `.message` / `.stack` during structured clone
- Result: `err: {}` in logs — completely useless for diagnostics

**Step 1: Write failing test**

```typescript
// packages/server/src/utils/__tests__/error-serializer.test.ts
import { describe, expect, it } from 'vitest';

import { serializeError } from '../error-serializer.js';

describe('serializeError', () => {
  it('serializes standard Error with message and stack', () => {
    const err = new Error('test error');
    const result = serializeError(err);
    expect(result.message).toBe('test error');
    expect(result.stack).toContain('test error');
    expect(result.type).toBe('Error');
  });

  it('serializes TypeError', () => {
    const err = new TypeError('bad type');
    const result = serializeError(err);
    expect(result.message).toBe('bad type');
    expect(result.type).toBe('TypeError');
  });

  it('serializes string errors', () => {
    const result = serializeError('string error');
    expect(result.message).toBe('string error');
    expect(result.type).toBe('string');
  });

  it('serializes null/undefined', () => {
    expect(serializeError(null).message).toBe('null');
    expect(serializeError(undefined).message).toBe('undefined');
  });

  it('serializes plain objects', () => {
    const result = serializeError({ code: 'FAIL', detail: 'oops' });
    expect(result.message).toContain('FAIL');
    expect(result.type).toBe('object');
  });

  it('serializes NAPI errors with non-enumerable properties', () => {
    const err = new Error('napi error');
    Object.defineProperty(err, 'code', { value: 'ERR_NAPI', enumerable: false });
    const result = serializeError(err);
    expect(result.message).toBe('napi error');
  });

  it('handles circular references safely', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const result = serializeError(obj);
    expect(result.type).toBe('object');
    expect(result.message).toBeDefined();
    // Should not throw
  });

  it('handles BigInt values', () => {
    const result = serializeError({ code: BigInt(42) });
    expect(result.type).toBe('object');
    expect(result.message).toBeDefined();
  });
});
```

**Step 2: Implement error serializer**

```typescript
// packages/server/src/utils/error-serializer.ts

interface SerializedError {
  message: string;
  stack?: string;
  type: string;
  code?: string;
}

/**
 * Serialize any thrown value into a plain object that survives
 * pino's transport worker structured clone.
 */
export function serializeError(err: unknown): SerializedError {
  if (err instanceof Error) {
    return {
      message: err.message,
      stack: err.stack,
      type: err.constructor.name,
      ...('code' in err && typeof err.code === 'string' ? { code: err.code } : {}),
    };
  }
  if (err === null || err === undefined) {
    return { message: String(err), type: String(err) };
  }
  if (typeof err === 'string') {
    return { message: err, type: 'string' };
  }
  try {
    return { message: JSON.stringify(err), type: typeof err };
  } catch {
    // Circular references, BigInt, or other non-serializable values
    return { message: String(err), type: typeof err };
  }
}
```

**Step 3: Update snapshot-handler.ts**

```typescript
// Replace:
log.error({ err }, 'snapshot render failed');

// With:
import { serializeError } from '../utils/error-serializer.js';
// ...
log.error({ err: serializeError(err) }, 'snapshot render failed');
```

**Step 4: Update satori-renderer.ts**

```typescript
// Replace:
log.error({ err, ms: ... }, 'renderSnapshot failed');

// With:
import { serializeError } from '../utils/error-serializer.js';
// ...
log.error({ err: serializeError(err), ms: ... }, 'renderSnapshot failed');
```

**Step 5: Run tests**

```bash
cd packages/server && npx vitest run src/utils/__tests__/error-serializer.test.ts
cd packages/server && npx vitest run src/routes/__tests__/snapshot-handler.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "fix(snapshot): error serialization survives pino transport structured clone (ISS-081)"
```

---

### Task 7: Startup asset precheck

**Files:**

- Modify: `packages/server/src/context.ts` (or `index.ts` startup path)

**Context:**

- After Phase 1, SVGs no longer need runtime loading → no precheck needed for them
- Fonts still need runtime loading → precheck font directory at startup
- Fail fast with clear log rather than waiting for first snapshot request

**Step 1: Add precheck in `packages/server/src/index.ts`, after `startContext(ctx)` and before `app.listen()`**

The existing `log` variable in `index.ts` is `const log = createChildLogger('server')` — use it directly.

```typescript
// In packages/server/src/index.ts — add after line `startContext(ctx);`:
import { loadFonts } from './renderer/fonts.js';
import { serializeError } from './utils/error-serializer.js';

// Eagerly validate font availability (fail fast with clear log)
try {
  loadFonts();
  log.info('font precheck passed');
} catch (err) {
  log.warn({ err: serializeError(err) }, 'font precheck failed — snapshot rendering will be unavailable');
}
```

**Step 2: Run full test suite**

```bash
cd packages/server && npx vitest run
```

Expected: PASS

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(snapshot): eager font precheck at startup (ISS-081)"
```

---

### Task 8: Build script — copy logo to assets/logo

**Files:**

- Modify: `scripts/build-release.sh`

**Context:**

- Even though SVGs are now inlined, keeping `assets/logo/` in the package avoids confusion and provides a secondary source for users who want to customize
- Also needed for the `web/logo/` symlink workaround to be unnecessary

**Step 1: Add logo copy step after font copy**

```bash
# After Step 4.5 in build-release.sh, add:
echo "  Copying logo assets..."
mkdir -p "$RELEASE_DIR/assets/logo"
cp packages/web/public/logo/icon-dark.svg "$RELEASE_DIR/assets/logo/"
cp packages/web/public/logo/icon-light.svg "$RELEASE_DIR/assets/logo/"
```

**Step 2: Update "files" field in generated package.json**

Already includes `"assets/"` → logo subdirectory is automatically covered.

**Step 3: Commit**

```bash
git add scripts/build-release.sh
git commit -m "fix(build): include logo SVGs in release package assets (ISS-081)"
```

---

### Task 9: CI npm package structure smoke test

**Files:**

- Create: `scripts/ci/verify-package-assets.mjs`

**Context:**

- Prevents regression: verifies all required assets exist in the built release tarball
- Run as part of CI after `build-release.sh`

**Step 1: Create verification script**

```javascript
// scripts/ci/verify-package-assets.mjs
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
```

**Step 2: Add to build script or CI workflow**

Add at the end of `build-release.sh` before `npm pack`:

```bash
# Step 6.5: Verify all required assets
echo "  Verifying required assets..."
node "$REPO_DIR/scripts/ci/verify-package-assets.mjs"
```

**Step 3: Commit**

```bash
git add scripts/ci/verify-package-assets.mjs scripts/build-release.sh
git commit -m "ci: add npm package asset verification gate (ISS-081)"
```

---

## Task Dependency Graph

```
Task 1 (embedded-assets module)
  ↓
Task 2 (refactor footer) ──→ Task 3 (refactor header)
                                      ↓
Task 4 (centralized resolver) ──→ Task 5 (refactor fonts)
                                      ↓
Task 6 (error serializer) ──→ Task 7 (startup precheck)
                                      ↓
Task 8 (build script logo) ──→ Task 9 (CI verify)
```

Tasks 1-3 (SVG inlining) and Tasks 4-5 (font resolver) are independent and can be parallelized. Tasks 6-7 depend on neither. Tasks 8-9 are independent of all code changes.

## Verification Checklist

After all tasks:

- [ ] `npx vitest run` — all server tests pass
- [ ] `npm run build` — clean build, no type errors
- [ ] `bash scripts/build-release.sh 0.1.0-test` — release builds without error
- [ ] `node scripts/ci/verify-package-assets.mjs` — all assets verified
- [ ] Manual: install built tarball in Tart VM → `claw-insights snapshot` works
- [ ] `grep -rn "logo-assets" packages/server/src/` — no remaining imports of deleted file
- [ ] `grep -rn "import\.meta\.url" packages/server/src/renderer/markup/` — no more import.meta.url in markup/
