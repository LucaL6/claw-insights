import type { AppContext } from '../../context.js';
import type { Resolvers, QueryResolvers } from '../generated/resolver-types.js';
import { DiagnosticEngine } from '../../knowledge/engine.js';
import { diagnosticRules } from '../../knowledge/rules.js';
import { buildSnapshot } from '../../knowledge/snapshot.js';
import { getSystemMetrics, getUsageCost } from '../../sources/system-info.js';
import { getGatewayStatus } from '../../sources/gateway-cli.js';
import { safe } from './utils.js';

const engine = new DiagnosticEngine(diagnosticRules);

const severityMap = { critical: 'CRITICAL', warning: 'WARNING', info: 'INFO' } as const;

export function diagnosticsResolvers(ctx: AppContext): Partial<Resolvers> {
  const diagnostics: QueryResolvers['diagnostics'] = () =>
    safe(async () => {
      const snapshot = await buildSnapshot({
        sessionReader: ctx.sessionReader,
        aggregator: ctx.aggregator,
        getSystemMetrics: () => getSystemMetrics(),
        getUsageCost: () => getUsageCost(),
        getGatewayRunning: async () => {
          try {
            const status = await getGatewayStatus();
            return status.running;
          } catch {
            return null;
          }
        },
      });

      const findings = engine.evaluate(snapshot).map((f) => ({
        ...f,
        severity: severityMap[f.severity],
      }));

      const parts = [
        `CPU ${snapshot.cpu}%`,
        `MEM ${snapshot.memoryMB}MB`,
        `${snapshot.activeSessions} sessions`,
        `${snapshot.errorsLast24h} errors/24h`,
      ];

      return {
        findings,
        evaluatedAt: new Date().toISOString(),
        snapshotSummary: parts.join(' · '),
      };
    });

  return { Query: { diagnostics } };
}
