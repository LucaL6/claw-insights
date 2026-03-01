import { beforeEach,describe, expect, it, vi } from 'vitest';

vi.mock('../stream-scanner.js', () => ({
  streamScanFile: vi.fn(),
}));

import { run, type ScanWorkerTask } from '../scan-worker.js';
import { streamScanFile } from '../stream-scanner.js';

const mockScan = streamScanFile as ReturnType<typeof vi.fn>;

const OK_SCAN = { newOffset: 100, partial: '', birthtimeMs: 1, inode: 1, mtimeMs: 1, firstTimestampMs: null };

beforeEach(() => {
  mockScan.mockReset();
});

describe('scan-worker run()', () => {
  it('captures Error.message in catch', async () => {
    mockScan.mockRejectedValueOnce(new Error('boom'));
    const task: ScanWorkerTask = { files: [{ path: 'a.jsonl', offset: 0, partial: '' }] };
    const res = await run(task);
    expect(res.files[0].error).toBe('boom');
    expect(res.files[0].scan.newOffset).toBe(0);
  });

  it('captures String(err) for non-Error throw', async () => {
    mockScan.mockRejectedValueOnce('string-error');
    const res = await run({ files: [{ path: 'b.jsonl', offset: 0, partial: '' }] });
    expect(res.files[0].error).toBe('string-error');
  });

  it('handles mixed success and error files', async () => {
    mockScan.mockResolvedValueOnce(OK_SCAN);
    mockScan.mockRejectedValueOnce(new Error('fail'));
    mockScan.mockResolvedValueOnce(OK_SCAN);

    const task: ScanWorkerTask = {
      files: [
        { path: 'ok1.jsonl', offset: 0, partial: '' },
        { path: 'bad.jsonl', offset: 0, partial: '' },
        { path: 'ok2.jsonl', offset: 0, partial: '' },
      ],
    };
    const res = await run(task);
    expect(res.files).toHaveLength(3);
    expect(res.files[0].scan.newOffset).toBe(100);
    expect(res.files[0].error).toBeUndefined();
    expect(res.files[1].error).toBe('fail');
    expect(res.files[2].scan.newOffset).toBe(100);
  });

  it('collects token and message events via callbacks', async () => {
    const fakeToken = { type: 'token', ts: 1 };
    const fakeMsg = { type: 'message', ts: 2 };
    mockScan.mockImplementationOnce(
      async (_p: string, _o: number, _par: string, onToken: (t: unknown) => void, onMsg: (m: unknown) => void) => {
        onToken(fakeToken);
        onMsg(fakeMsg);
        return OK_SCAN;
      },
    );
    const res = await run({ files: [{ path: 'c.jsonl', offset: 0, partial: '' }] });
    expect(res.tokenEvents).toEqual([fakeToken]);
    expect(res.messageEvents).toEqual([fakeMsg]);
  });
});
