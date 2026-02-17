import type { DatabaseSync as Database } from 'node:sqlite';
import { insertEvent } from '../db/queries.js';

export interface ValidationResult {
  pass: boolean;
  deviation: number;
  metric: string;
  sourceA: number;
  sourceB: number;
  message: string;
}

export class DataValidator {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private db: Database,
    private getAggregatorTokensK: () => number,
    private getStatusTokensK: () => number,
  ) {}

  static compare(a: number, b: number, metric: string): ValidationResult {
    if (a === 0 && b === 0) return { pass: true, deviation: 0, metric, sourceA: a, sourceB: b, message: 'Both zero' };
    const max = Math.max(Math.abs(a), Math.abs(b));
    if (max === 0) return { pass: true, deviation: 0, metric, sourceA: a, sourceB: b, message: 'Both zero' };
    const deviation = Math.abs(a - b) / max;
    const pass = deviation <= 0.2;
    return {
      pass,
      deviation,
      metric,
      sourceA: a,
      sourceB: b,
      message: pass ? `Within threshold (${(deviation * 100).toFixed(1)}%)` : `EXCEEDS threshold (${(deviation * 100).toFixed(1)}% > 20%)`,
    };
  }

  runValidation(): ValidationResult[] {
    const results: ValidationResult[] = [];
    const aggTokens = this.getAggregatorTokensK();
    const statusTokens = this.getStatusTokensK();
    const tokenResult = DataValidator.compare(aggTokens, statusTokens, 'daily_tokens_k');
    results.push(tokenResult);

    if (!tokenResult.pass) {
      insertEvent(this.db, 'validation_warning', tokenResult.deviation, {
        metric: tokenResult.metric,
        sourceA: tokenResult.sourceA,
        sourceB: tokenResult.sourceB,
        message: tokenResult.message,
      });
    }

    return results;
  }

  start(intervalMs: number = 10 * 60 * 1000) {
    this.interval = setInterval(() => this.runValidation(), intervalMs);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }
}
