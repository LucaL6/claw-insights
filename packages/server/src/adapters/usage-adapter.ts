// src/adapters/usage-adapter.ts
import { mapInfraError } from '../ports/error-mapping.js';
import type { ReadContext } from '../ports/shared.js';
import type { UsageCost, UsagePort } from '../ports/usage-port.js';
import type { SystemInfoService } from '../sources/system-info.js';

const SOURCE = 'usage-adapter';

export function createUsageAdapter(systemInfoService: SystemInfoService): UsagePort & { destroy: () => void } {
  async function getUsageCost(_context?: ReadContext): Promise<UsageCost> {
    try {
      return await systemInfoService.getUsageCost();
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function destroy(): void {
    // No-op: UsageAdapter does not own SystemInfoService lifecycle
  }

  return { getUsageCost, destroy };
}
