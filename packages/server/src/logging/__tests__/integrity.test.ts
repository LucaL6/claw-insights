import { mkdtemp, readFile, rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach,beforeEach, describe, expect, it } from 'vitest';

import { LogIntegrity } from '../integrity.js';

describe('LogIntegrity', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'integrity-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('leaves valid JSONL unchanged', async () => {
    const filePath = join(tempDir, 'app.2025-01-20.0.log');
    const content = '{"a":1}\n{"b":2}\n';
    await writeFile(filePath, content);

    const integrity = new LogIntegrity({ logDir: tempDir });
    const result = await integrity.repairTail('app', filePath);

    expect(result.wasRepaired).toBe(false);
    expect(result.truncatedBytes).toBe(0);
    expect(await readFile(filePath, 'utf-8')).toBe(content);
  });

  it('repairs truncated last line', async () => {
    const filePath = join(tempDir, 'app.2025-01-20.0.log');
    await writeFile(filePath, '{"a":1}\n{"b":2}\n{"trun');

    const integrity = new LogIntegrity({ logDir: tempDir });
    const result = await integrity.repairTail('app', filePath);

    expect(result.wasRepaired).toBe(true);
    expect(result.truncatedBytes).toBeGreaterThan(0);

    const repaired = await readFile(filePath, 'utf-8');
    expect(repaired).toBe('{"a":1}\n{"b":2}\n');
  });

  it('handles completely corrupt file (no valid JSON lines)', async () => {
    const filePath = join(tempDir, 'app.2025-01-20.0.log');
    await writeFile(filePath, 'not json at all');

    const integrity = new LogIntegrity({ logDir: tempDir });
    const result = await integrity.repairTail('app', filePath);

    expect(result.wasRepaired).toBe(true);
    const repaired = await readFile(filePath, 'utf-8');
    expect(repaired).toBe('');
  });

  it('handles empty file without error', async () => {
    const filePath = join(tempDir, 'app.2025-01-20.0.log');
    await writeFile(filePath, '');

    const integrity = new LogIntegrity({ logDir: tempDir });
    const result = await integrity.repairTail('app', filePath);

    expect(result.wasRepaired).toBe(false);
  });

  it('tracks tailRepairCount across multiple repairs', async () => {
    const f1 = join(tempDir, 'a.log');
    const f2 = join(tempDir, 'b.log');
    await writeFile(f1, '{"ok":1}\n{"trunc');
    await writeFile(f2, '{"ok":1}\n');

    const integrity = new LogIntegrity({ logDir: tempDir });
    await integrity.repairAllActive([
      { stream: 'app', path: f1 },
      { stream: 'error', path: f2 },
    ]);

    expect(integrity.tailRepairCount).toBe(1);
    expect(integrity.repairResults).toHaveLength(1);
  });
});
