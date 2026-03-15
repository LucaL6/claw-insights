import type { ChildProcess, spawn } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import { spawnDaemonProcess } from '../daemon.js';

type SpawnProcess = typeof spawn;

function mockChild(pid: number = 12345): ChildProcess {
  return {
    pid,
    unref: vi.fn(),
  } as unknown as ChildProcess;
}

describe('daemon runtime spawn args', () => {
  const serverEntry = '/opt/claw-insights/server/index.js';
  const childEnv = {
    NODE_ENV: 'production',
    CLAW_INSIGHTS_SERVER_PORT: '41141',
    CLAW_INSIGHTS_WEB_PORT: '41142',
  };

  it('passes --experimental-sqlite to spawned child on Node 22', () => {
    const spawnProcess = vi.fn(() => mockChild()) as unknown as SpawnProcess;

    spawnDaemonProcess(serverEntry, childEnv, {
      spawnProcess,
      execPath: '/usr/local/bin/node',
      nodeVersion: '22.22.1',
    });

    expect(spawnProcess).toHaveBeenCalledWith('/usr/local/bin/node', ['--experimental-sqlite', serverEntry], {
      detached: true,
      stdio: 'ignore',
      env: childEnv,
    });
  });

  it('spawns without sqlite flag on Node 23+', () => {
    const spawnProcess = vi.fn(() => mockChild()) as unknown as SpawnProcess;

    spawnDaemonProcess(serverEntry, childEnv, {
      spawnProcess,
      execPath: '/usr/local/bin/node',
      nodeVersion: '23.5.0',
    });

    expect(spawnProcess).toHaveBeenCalledWith('/usr/local/bin/node', [serverEntry], {
      detached: true,
      stdio: 'ignore',
      env: childEnv,
    });
  });

  it('uses process.execPath by default', () => {
    const spawnProcess = vi.fn(() => mockChild()) as unknown as SpawnProcess;

    spawnDaemonProcess(serverEntry, childEnv, {
      spawnProcess,
      nodeVersion: '25.0.0',
    });

    expect(spawnProcess).toHaveBeenCalledWith(process.execPath, [serverEntry], {
      detached: true,
      stdio: 'ignore',
      env: childEnv,
    });
  });
});
