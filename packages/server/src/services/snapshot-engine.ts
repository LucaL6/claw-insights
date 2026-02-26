import { createChildLogger } from '../logger.js';
import { renderSnapshot, renderSnapshotSvg } from '../renderer/satori-renderer.js';
import { Deadline, withDeadline } from '../utils/deadline.js';
import { TokenBucketLimiter } from '../utils/rate-limiter.js';
import { RenderPool } from '../utils/render-pool.js';
import {
  COALESCE_WINDOW_MS,
  COLLECT_TIMEOUT_MS,
  CollectTimeoutError,
  GatewayUnreachableError,
  MAX_OUTPUT_BYTES,
  PayloadTooLargeError,
  QUEUE_WAIT_TIMEOUT_MS,
  RATE_LIMIT_PER_MINUTE,
  RateLimitedError,
  RENDER_CONCURRENCY,
  RENDER_QUEUE_MAX,
  TOTAL_TIMEOUT_MS,
  TotalTimeoutError,
} from '../utils/snapshot-errors.js';
import { buildSnapshotData } from './snapshot-service.js';
import type { DataSources, Detail, InternalRange, SnapshotData, SnapshotRequest } from './snapshot-types.js';
import { RANGE_MAP } from './snapshot-types.js';

const log = createChildLogger('snapshot-engine');

const DETAIL_ORDER: Detail[] = ['full', 'standard', 'compact'];

export interface SnapshotResult {
  format: 'png' | 'json' | 'svg';
  output: Buffer | string | object;
  contentType: string;
  detail: Detail;
  degraded: boolean;
  durationMs: number;
}

export class SnapshotEngine {
  private readonly renderPool: RenderPool;
  private readonly rateLimiter: TokenBucketLimiter;

  // In-flight coalescing: reuse a single data collection promise within the window
  private inflightPromise: Promise<SnapshotData> | null = null;
  private inflightExpiry = 0;
  private inflightKey = '';

  constructor(private readonly sources: DataSources) {
    this.renderPool = new RenderPool(RENDER_CONCURRENCY, RENDER_QUEUE_MAX, QUEUE_WAIT_TIMEOUT_MS);
    this.rateLimiter = new TokenBucketLimiter(RATE_LIMIT_PER_MINUTE, 60_000);
  }

  /**
   * Collect data with in-flight coalescing (COALESCE_WINDOW_MS window).
   * Requests with the same (detail, range) within the window share one CLI call.
   * Rethrows CollectTimeoutError as-is; wraps connectivity errors as GatewayUnreachableError;
   * re-throws other errors (DB, serialization) as-is for accurate error mapping.
   */
  private async collectData(
    detail: Detail,
    internalRange: InternalRange,
    totalDeadline: Deadline,
  ): Promise<SnapshotData> {
    const key = `${detail}:${internalRange}`;
    const now = Date.now();

    if (this.inflightPromise && now < this.inflightExpiry && this.inflightKey === key) {
      return this.inflightPromise;
    }

    const collectMs = Math.min(totalDeadline.remaining(), COLLECT_TIMEOUT_MS);
    const collectDeadline = new Deadline(collectMs);

    const promise = withDeadline(
      buildSnapshotData(this.sources, { detail, range: internalRange }),
      collectDeadline,
      CollectTimeoutError,
    ).catch((err) => {
      // Clear inflight on failure so next request retries
      this.inflightPromise = null;
      if (err instanceof CollectTimeoutError) {
        throw err;
      }
      // Only wrap fetch/network errors; let others propagate for accurate 500 mapping
      if (err instanceof Error && (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND'))) {
        throw new GatewayUnreachableError();
      }
      throw err;
    });

    this.inflightPromise = promise;
    this.inflightExpiry = now + COALESCE_WINDOW_MS;
    this.inflightKey = key;

    const result = await promise;

    // Clear after expiry (don't hold stale references)
    if (Date.now() >= this.inflightExpiry) {
      this.inflightPromise = null;
    }

    return result;
  }

  async execute(params: SnapshotRequest): Promise<SnapshotResult> {
    const t0 = performance.now();

    // 1. Rate limit check (shared across all trigger sources)
    const rateResult = this.rateLimiter.tryConsume();
    if (!rateResult.allowed) {
      throw new RateLimitedError(rateResult.retryAfterMs);
    }

    const internalRange = RANGE_MAP[params.range];
    const totalDeadline = new Deadline(TOTAL_TIMEOUT_MS);

    // 2. JSON format: no render pool needed
    if (params.format === 'json') {
      const data = await this.collectData(params.detail, internalRange, totalDeadline);
      return {
        format: 'json',
        output: data,
        contentType: 'application/json',
        detail: params.detail,
        degraded: false,
        durationMs: Math.round(performance.now() - t0),
      };
    }

    // 3. Collect data OUTSIDE render pool (M-5: don't hold pool slot during collection)
    const data = await this.collectData(params.detail, internalRange, totalDeadline);

    // 4. PNG/SVG: render pool controlled (render only)
    return this.renderPool.execute(async () => {
      // Render with auto-degradation loop
      let detail = params.detail;
      let degraded = false;

      const doRender = async (d: Detail): Promise<{ output: Buffer | string; contentType: string }> => {
        if (params.format === 'svg') {
          const svg = await renderSnapshotSvg(data, { detail: d, theme: params.theme, lang: params.lang });
          return { output: svg, contentType: 'image/svg+xml' };
        }
        const buf = await renderSnapshot(data, { detail: d, theme: params.theme, lang: params.lang });
        return { output: buf, contentType: 'image/png' };
      };

      let rendered = await withDeadline(doRender(detail), totalDeadline, TotalTimeoutError);
      let size = typeof rendered.output === 'string' ? Buffer.byteLength(rendered.output) : rendered.output.length;

      // Auto-degradation: full → standard → compact → 413
      while (size > MAX_OUTPUT_BYTES) {
        const currentIdx = DETAIL_ORDER.indexOf(detail);
        const nextIdx = currentIdx + 1;
        if (nextIdx >= DETAIL_ORDER.length) {
          throw new PayloadTooLargeError();
        }
        detail = DETAIL_ORDER[nextIdx];
        degraded = true;
        log.info({ from: params.detail, to: detail }, 'auto-degrading detail due to size limit');
        rendered = await withDeadline(doRender(detail), totalDeadline, TotalTimeoutError);
        size = typeof rendered.output === 'string' ? Buffer.byteLength(rendered.output) : rendered.output.length;
      }

      return {
        format: params.format,
        output: rendered.output,
        contentType: rendered.contentType,
        detail,
        degraded,
        durationMs: Math.round(performance.now() - t0),
      };
    });
  }

  /** Expose pool stats for health/diagnostics */
  get stats() {
    return {
      renderConcurrency: this.renderPool.concurrency,
      renderQueueLength: this.renderPool.queueLength,
    };
  }
}
