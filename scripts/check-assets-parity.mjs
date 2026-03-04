import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

export const ALLOWED = [
  'icon-dark.svg',
  'icon-light.svg',
  'icon-mono.svg',
  'watermark.svg',
  'favicon.svg',
  'openclaw-lobster.svg',
];

function sha256(path) {
  const content = readFileSync(path);
  return createHash('sha256').update(content).digest('hex');
}

function listFiles(dir) {
  if (!existsSync(dir)) {
    return { exists: false, files: [] };
  }

  return {
    exists: true,
    files: readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort(),
  };
}

function setDiff(left, right) {
  return left.filter((item) => !right.includes(item));
}

export function checkAssetsParity({
  webDir = resolve(ROOT_DIR, 'packages/web/public/logo'),
  serverDir = resolve(ROOT_DIR, 'packages/server/assets/logo'),
  allowed = ALLOWED,
} = {}) {
  const errors = [];

  const web = listFiles(webDir);
  const server = listFiles(serverDir);
  if (!web.exists) errors.push(`Web logo directory not found: ${webDir}`);
  if (!server.exists) errors.push(`Server logo directory not found: ${serverDir}`);
  if (errors.length > 0) return { ok: false, errors };

  const unexpectedWeb = setDiff(web.files, allowed);
  const unexpectedServer = setDiff(server.files, allowed);
  const missingInWeb = setDiff(allowed, web.files);
  const missingInServer = setDiff(allowed, server.files);

  if (unexpectedWeb.length > 0) {
    errors.push(`Unexpected files in web: ${unexpectedWeb.join(', ')}`);
  }
  if (unexpectedServer.length > 0) {
    errors.push(`Unexpected files in server: ${unexpectedServer.join(', ')}`);
  }
  if (missingInWeb.length > 0) {
    errors.push(`Missing files in web: ${missingInWeb.join(', ')}`);
  }
  if (missingInServer.length > 0) {
    errors.push(`Missing files in server: ${missingInServer.join(', ')}`);
  }

  const comparable = allowed.filter((file) => web.files.includes(file) && server.files.includes(file));
  for (const file of comparable) {
    const webHash = sha256(resolve(webDir, file));
    const serverHash = sha256(resolve(serverDir, file));
    if (webHash !== serverHash) {
      errors.push(`Hash mismatch for ${file}: web=${webHash} server=${serverHash}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertAssetsParity(options = {}) {
  const result = checkAssetsParity(options);
  if (!result.ok) {
    throw new Error(`Asset parity check failed:\n- ${result.errors.join('\n- ')}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    assertAssetsParity();
    console.log('Asset parity check passed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
