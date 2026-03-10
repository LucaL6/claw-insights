import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const HOME = process.env.HOME ?? '/tmp';

export class MalformedAuthSecretError extends Error {
  constructor(path: string) {
    super(`Malformed auth-secret file: ${path}`);
    this.name = 'MalformedAuthSecretError';
  }
}

export function getAuthSecretPath(home?: string): string {
  return join(home ?? HOME, '.claw-insights', 'auth-secret');
}

export function readAuthSecret(path: string): string {
  const raw = readFileSync(path, 'utf-8');
  const token = raw.trim();
  if (!token) {
    throw new MalformedAuthSecretError(path);
  }
  return token;
}

export function writeAuthSecret(path: string, token: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, token, { mode: 0o600 });
  if (process.platform !== 'win32') {
    chmodSync(path, 0o600);
  }
}

export function migrateLegacyApiTokenToSecret(configPath: string, secretPath: string): 'migrated' | 'noop' {
  if (existsSync(secretPath)) {
    return 'noop';
  }
  if (!existsSync(configPath)) {
    return 'noop';
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
  if (typeof config.apiToken !== 'string' || config.apiToken.trim() === '') {
    return 'noop';
  }

  writeAuthSecret(secretPath, config.apiToken);
  delete config.apiToken;
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  return 'migrated';
}
