import type { LogEntry } from '@claw-insights/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogIngester } from '../log-ingester';

vi.mock('../../../db/event-queries.js', () => ({
  insertEvent: vi.fn(),
}));

import { insertEvent } from '../../../db/event-queries';
const mockInsert = vi.mocked(insertEvent);

describe('createLogIngester', () => {
  const fakeDb = {} as unknown as import('../../../db/database.js').Database;
  const ingest = createLogIngester(fakeDb);

  beforeEach(() => {
    mockInsert.mockClear();
  });

  it('ingests ERROR level as error event', () => {
    const entry: LogEntry = { time: '12:00:00', level: 'ERROR', module: 'core', message: 'something broke' };
    ingest(entry);
    expect(mockInsert).toHaveBeenCalledWith(fakeDb, 'error', null, { module: 'core', message: 'something broke' });
  });

  it('ingests WARN level as warning event', () => {
    const entry: LogEntry = { time: '12:00:00', level: 'WARN', module: 'tools', message: 'slow response' };
    ingest(entry);
    expect(mockInsert).toHaveBeenCalledWith(fakeDb, 'warning', null, { module: 'tools', message: 'slow response' });
  });

  it('ingests tool start as tool_call event', () => {
    const entry: LogEntry = { time: '12:00:00', level: 'INFO', module: 'tools', message: 'tool start exec' };
    ingest(entry);
    expect(mockInsert).toHaveBeenCalledWith(fakeDb, 'tool_call', 1, { module: 'tools' });
  });

  it('ingests embedded run tool start as api_call event', () => {
    const entry: LogEntry = { time: '12:00:00', level: 'INFO', module: 'agent', message: 'embedded run tool start' };
    ingest(entry);
    expect(mockInsert).toHaveBeenCalledWith(fakeDb, 'api_call', 1, { module: 'agent' });
  });

  it('ingests gateway restart event', () => {
    const entry: LogEntry = {
      time: '12:00:00',
      level: 'INFO',
      module: 'system',
      message: 'gateway restart detected',
    };
    ingest(entry);
    expect(mockInsert).toHaveBeenCalledWith(fakeDb, 'gateway_restart', null, {});
  });

  it('ignores INFO without keywords', () => {
    const entry: LogEntry = { time: '12:00:00', level: 'INFO', module: 'system', message: 'heartbeat ok' };
    ingest(entry);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('ERROR with tool start triggers both error and tool_call', () => {
    const entry: LogEntry = { time: '12:00:00', level: 'ERROR', module: 'tools', message: 'tool start failed' };
    ingest(entry);
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(mockInsert).toHaveBeenCalledWith(fakeDb, 'error', null, { module: 'tools', message: 'tool start failed' });
    expect(mockInsert).toHaveBeenCalledWith(fakeDb, 'tool_call', 1, { module: 'tools' });
  });
});
