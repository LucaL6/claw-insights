import type { DiagnosticRule, DiagnosticResult, SystemSnapshot } from './types.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('diagnostic-engine');

export class DiagnosticEngine {
  constructor(private rules: DiagnosticRule[]) {}

  evaluate(snapshot: SystemSnapshot): DiagnosticResult[] {
    const now = new Date().toISOString();
    const results: DiagnosticResult[] = [];

    for (const rule of this.rules) {
      try {
        if (rule.check(snapshot)) {
          results.push({
            id: rule.id,
            severity: rule.severity,
            title: rule.title,
            detail: rule.detail,
            matchedAt: now,
          });
        }
      } catch (err) {
        log.warn({ err: err as Error, ruleId: rule.id }, 'rule evaluation threw');
        results.push({
          id: `rule-error:${rule.id}`,
          severity: 'warning',
          title: `Rule evaluation failed: ${rule.id}`,
          detail: `The diagnostic rule "${rule.id}" threw an error during evaluation: ${(err as Error).message}`,
          matchedAt: now,
        });
      }
    }

    return results;
  }
}
