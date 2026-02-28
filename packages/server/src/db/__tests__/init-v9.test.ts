import { describe, expect, it } from 'vitest';

import { initDatabase, MIGRATIONS } from '../init.js';

describe('migration v9 — kv_meta', () => {
  it('creates kv_meta table with key-value schema', () => {
    const tmpPath = `/tmp/test-kv-meta-${Date.now()}.db`;
    const db = initDatabase(tmpPath);
    const info = db.prepare("PRAGMA table_info('kv_meta')").all() as Array<{ name: string; type: string }>;
    const cols = info.map((c) => c.name);
    expect(cols).toContain('key');
    expect(cols).toContain('value');
    db.close();
  });

  it('enforces PRIMARY KEY uniqueness on kv_meta.key', () => {
    const tmpPath = `/tmp/test-kv-pk-${Date.now()}.db`;
    const db = initDatabase(tmpPath);
    db.prepare('INSERT INTO kv_meta (key, value) VALUES (?, ?)').run('test_key', 'hello');
    db.prepare('INSERT OR REPLACE INTO kv_meta (key, value) VALUES (?, ?)').run('test_key', 'world');
    const row = db.prepare('SELECT value FROM kv_meta WHERE key = ?').get('test_key') as { value: string };
    expect(row.value).toBe('world');
    db.close();
  });

  it('migration count matches expected total', () => {
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(9);
    expect(MIGRATIONS[MIGRATIONS.length - 1].version).toBe(MIGRATIONS.length);
  });
});
