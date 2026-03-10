import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getAuthSecretPath,
  MalformedAuthSecretError,
  migrateLegacyApiTokenToSecret,
  readAuthSecret,
  writeAuthSecret,
} from '../auth/secret-store.js';

describe('secret-store', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'claw-secret-store-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reads existing auth-secret', () => {
    const path = join(root, 'auth-secret');
    writeFileSync(path, 'token-123');

    expect(readAuthSecret(path)).toBe('token-123');
  });

  it('writes auth-secret with 0600 permissions', () => {
    const path = join(root, 'nested', 'auth-secret');
    writeAuthSecret(path, 'token-123');

    expect(readFileSync(path, 'utf-8')).toBe('token-123');
    const mode = statSync(path).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('migrates config.json.apiToken to auth-secret', () => {
    const configPath = join(root, 'config.json');
    const secretPath = join(root, 'auth-secret');
    writeFileSync(configPath, JSON.stringify({ apiToken: 'legacy-token', serverPort: 41041 }));

    const result = migrateLegacyApiTokenToSecret(configPath, secretPath);

    expect(result).toBe('migrated');
    expect(readAuthSecret(secretPath)).toBe('legacy-token');
  });

  it('removes apiToken and keeps other config keys after migration', () => {
    const configPath = join(root, 'config.json');
    const secretPath = join(root, 'auth-secret');
    writeFileSync(configPath, JSON.stringify({ apiToken: 'legacy-token', noAuth: false, dbPath: '/tmp/x.db' }));

    migrateLegacyApiTokenToSecret(configPath, secretPath);

    const updated = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    expect(updated.apiToken).toBeUndefined();
    expect(updated.noAuth).toBe(false);
    expect(updated.dbPath).toBe('/tmp/x.db');
  });

  it('does not overwrite existing auth-secret during migration', () => {
    const configPath = join(root, 'config.json');
    const secretPath = join(root, 'auth-secret');
    writeFileSync(secretPath, 'existing-secret');
    writeFileSync(configPath, JSON.stringify({ apiToken: 'legacy-token' }));

    const result = migrateLegacyApiTokenToSecret(configPath, secretPath);

    expect(result).toBe('noop');
    expect(readAuthSecret(secretPath)).toBe('existing-secret');
    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    expect(config.apiToken).toBe('legacy-token');
  });

  it('throws typed error when auth-secret content is malformed', () => {
    const path = join(root, 'auth-secret');
    writeFileSync(path, '   \n');

    expect(() => readAuthSecret(path)).toThrow(MalformedAuthSecretError);
  });

  it('builds auth-secret path from home', () => {
    expect(getAuthSecretPath('/tmp/home')).toBe('/tmp/home/.claw-insights/auth-secret');
  });

  it('migration is noop when config has no apiToken', () => {
    const configPath = join(root, 'config.json');
    const secretPath = join(root, 'auth-secret');
    writeFileSync(configPath, JSON.stringify({ noAuth: true }));

    const result = migrateLegacyApiTokenToSecret(configPath, secretPath);

    expect(result).toBe('noop');
    expect(existsSync(secretPath)).toBe(false);
  });
});
