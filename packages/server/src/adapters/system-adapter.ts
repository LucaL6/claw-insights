// src/adapters/system-adapter.ts
import { mapInfraError } from '../ports/error-mapping.js';
import type { ReadContext } from '../ports/shared.js';
import type { SystemMetrics, SystemPort } from '../ports/system-port.js';
import type { Platform } from '../ports/types.js';
import type { SystemInfoService } from '../sources/system-info.js';

const SOURCE = 'system-adapter';

export function createSystemAdapter(
  service: SystemInfoService,
  platform: Platform,
): SystemPort & { destroy: () => void } {
  async function getSystemMetrics(_context?: ReadContext): Promise<SystemMetrics> {
    try {
      const data = await service.getSystemMetrics();
      return {
        cpu: data.cpu,
        memoryMB: data.memoryMB,
        diskMB: data.diskMB,
        uptime: process.uptime().toFixed(0) + 's',
        platform: process.platform,
        nodeVersion: process.version,
      };
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  async function getProcessMetrics(
    pid: number,
    _context?: ReadContext,
  ): Promise<{ cpu: number; memoryMB: number } | null> {
    try {
      const metrics = await platform.process.getProcessMetrics(pid);
      return metrics ?? null;
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function destroy(): void {
    // No-op: SystemAdapter has no stateful resources to clean up
  }

  return { getSystemMetrics, getProcessMetrics, destroy };
}
