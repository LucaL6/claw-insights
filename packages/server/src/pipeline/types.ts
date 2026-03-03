/**
 * Pipeline component interfaces.
 *
 * Four roles:
 * - Source: emits events (has .on/.off, optional destroy)
 * - Managed: lifecycle-only resource (destroy, no events)
 * - Processor: receives events (a function or object with handler method)
 * - Service: background lifecycle (start/stop, optional destroy)
 * - Port: typed contract for data access (subscribable + destroyable)
 */

/** Minimal event emitter interface (subset of EventEmitter) */
export interface Emittable {
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}

/** A source emits events. Has optional lifecycle. */
export interface Source extends Emittable {
  destroy?(): void;
}

/** A managed resource with lifecycle but no events. */
export interface Managed {
  destroy(): void;
}

/** A processor handles events. Can be a function or object. */
export type Processor = ((entry: unknown) => void) | { handle(entry: unknown): void };

/** A service runs in the background with start/stop lifecycle. */
export interface Service {
  start(): void;
  stop(): void;
  destroy?(): void;
}

/** A port provides typed data access with subscription and lifecycle. */
export interface Port {
  destroy?(): void | Promise<void>;
  onChanged?(cb: () => void): () => void;
}

/** Wiring declaration: source event → processor targets */
export interface WiringRule {
  source: string;
  event: string;
  targets: string[];
}

/** Pipeline configuration (output of build) */
export interface PipelineConfig {
  sources: Map<string, Source>;
  managed: Map<string, Managed>;
  processors: Map<string, Processor>;
  services: Map<string, Service>;
  ports: Map<string, Port>;
  wiring: WiringRule[];
}

/** Pipeline state */
export type PipelineState = 'init' | 'built' | 'started' | 'destroyed';

/** Destroy report structure */
export interface DestroyReport {
  destroyed: {
    ports: string[];
    services: string[];
    sources: string[];
    managed: string[];
  };
  failed: Array<{
    component: 'ports' | 'services' | 'sources' | 'managed';
    key: string;
    error: Error;
  }>;
}
