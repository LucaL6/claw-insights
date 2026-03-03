import { createChildLogger } from '../logger.js';
import type {
  DestroyReport,
  Managed,
  PipelineConfig,
  PipelineState,
  Port,
  Processor,
  Service,
  Source,
  WiringRule,
} from './types.js';

const log = createChildLogger('pipeline');

type BoundHandler = { source: Source; event: string; handler: (entry: unknown) => void };

export class Pipeline {
  private sources = new Map<string, Source>();
  private managed = new Map<string, Managed>();
  private processors = new Map<string, Processor>();
  private services = new Map<string, Service>();
  private ports = new Map<string, Port>();
  private wiring: WiringRule[] = [];
  private all = new Map<string, Source | Managed | Processor | Service | Port>();
  private boundHandlers: BoundHandler[] = [];
  private state: PipelineState = 'init';
  private _startedAt?: number;

  // ── Port Management ───────────────────────────────────────

  addPort(key: string, port: Port): this {
    this.guardInitState('addPort');
    if (this.ports.has(key)) {
      throw new Error(`Port "${key}" already registered (duplicate key)`);
    }
    this.ports.set(key, port);
    this.all.set(key, port);
    return this;
  }

  getPort<T = Port>(key: string): T {
    this.guardNotDestroyed('getPort');
    const port = this.ports.get(key);
    if (!port) {
      throw new Error(`Port "${key}" not found (INVALID_STATE)`);
    }
    return port as T;
  }

  async replacePort(key: string, newPort: Port): Promise<void> {
    this.guardInitState('replacePort');
    const oldPort = this.ports.get(key);
    if (!oldPort) {
      throw new Error(`Port "${key}" not found for replacement`);
    }

    // Staged rollback: try to destroy old port first
    if (oldPort.destroy) {
      await oldPort.destroy();
    }
    // If oldPort.destroy() throws, old port remains registered (rollback)

    // Old port destroyed successfully, now register new port
    // If this throws (e.g., port creation error), old port is already destroyed
    this.ports.set(key, newPort);
    this.all.set(key, newPort);
  }

  // ── Component Registration ────────────────────────────────

  addSource(name: string, source: Source): this {
    this.guardInitState('addSource');
    this.sources.set(name, source);
    this.all.set(name, source);
    return this;
  }

  addManaged(name: string, resource: Managed): this {
    this.guardInitState('addManaged');
    this.managed.set(name, resource);
    this.all.set(name, resource);
    return this;
  }

  addProcessor(name: string, processor: Processor): this {
    this.guardInitState('addProcessor');
    this.processors.set(name, processor);
    this.all.set(name, processor);
    return this;
  }

  addService(name: string, service: Service): this {
    this.guardInitState('addService');
    this.services.set(name, service);
    this.all.set(name, service);
    return this;
  }

  wire(source: string, event: string, targets: string[]): this {
    this.guardInitState('wire');
    if (!this.sources.has(source)) {
      throw new Error(`Unknown source: "${source}"`);
    }
    for (const t of targets) {
      if (!this.processors.has(t)) {
        throw new Error(`Unknown processor: "${t}"`);
      }
    }
    this.wiring.push({ source, event, targets });
    return this;
  }

  // ── Lifecycle ─────────────────────────────────────────────

  build(): this {
    this.guardNotDestroyed('build');
    if (this.state === 'built' || this.state === 'started') {
      throw new Error('Pipeline already built — cannot build twice');
    }
    for (const rule of this.wiring) {
      const src = this.sources.get(rule.source);
      if (!src) {
        throw new Error(`Pipeline build: source "${rule.source}" not found`);
      }
      const handlers = rule.targets.map((t) => {
        const proc = this.processors.get(t);
        if (!proc) {
          throw new Error(`Pipeline build: processor "${t}" not found`);
        }
        return typeof proc === 'function' ? proc : proc.handle.bind(proc);
      });
      const handler = (entry: unknown) => {
        for (const h of handlers) {
          h(entry);
        }
      };
      src.on(rule.event, handler);
      this.boundHandlers.push({ source: src, event: rule.event, handler });
    }
    this.state = 'built';
    log.info(
      {
        sources: this.sources.size,
        processors: this.processors.size,
        services: this.services.size,
        ports: this.ports.size,
        wiring: this.wiring.length,
      },
      'pipeline built',
    );
    return this;
  }

  start(): void {
    this.guardNotDestroyed('start');
    if (this.state === 'init') {
      throw new Error('Pipeline not built — call build() before start()');
    }
    if (this.state === 'started') {
      // Idempotent: no-op on re-entry
      return;
    }
    for (const svc of this.services.values()) {
      svc.start();
    }
    this.state = 'started';
    this._startedAt = Date.now();
    log.info({ services: this.services.size }, 'pipeline started');
  }

  async destroy(): Promise<DestroyReport> {
    if (this.state === 'destroyed') {
      // Idempotent: return empty report on re-entry
      return {
        destroyed: { ports: [], services: [], sources: [], managed: [] },
        failed: [],
      };
    }

    log.info('pipeline destroying');

    // Phase 1: Set destroyed state (blocks new operations)
    this.state = 'destroyed';

    const report: DestroyReport = {
      destroyed: { ports: [], services: [], sources: [], managed: [] },
      failed: [],
    };
    const errors: Error[] = [];

    // Phase 2: Destroy ports in LIFO order
    const portEntries = Array.from(this.ports.entries()).reverse();
    for (const [key, port] of portEntries) {
      try {
        if (port.destroy) {
          await port.destroy();
        }
        report.destroyed.ports.push(key);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        report.failed.push({ component: 'ports', key, error });
        errors.push(error);
      }
    }

    // Unbind all wired event handlers
    for (const { source, event, handler } of this.boundHandlers) {
      source.off(event, handler);
    }
    this.boundHandlers = [];

    // Phase 3: Stop and destroy services, then sources, then managed
    for (const [key, svc] of this.services.entries()) {
      try {
        svc.stop();
        svc.destroy?.();
        report.destroyed.services.push(key);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        report.failed.push({ component: 'services', key, error });
        errors.push(error);
      }
    }
    for (const [key, src] of this.sources.entries()) {
      try {
        src.destroy?.();
        report.destroyed.sources.push(key);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        report.failed.push({ component: 'sources', key, error });
        errors.push(error);
      }
    }
    for (const [key, res] of this.managed.entries()) {
      try {
        res.destroy();
        report.destroyed.managed.push(key);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        report.failed.push({ component: 'managed', key, error });
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      const aggErr = new AggregateError(errors, 'Pipeline destroy encountered errors') as AggregateError & {
        report: DestroyReport;
      };
      aggErr.report = report;
      throw aggErr;
    }

    return report;
  }

  // ── Lookup ────────────────────────────────────────────────

  get<T = unknown>(name: string): T {
    return this.all.get(name) as T;
  }

  getConfig(): PipelineConfig {
    return {
      sources: new Map(this.sources),
      managed: new Map(this.managed),
      processors: new Map(this.processors),
      services: new Map(this.services),
      ports: new Map(this.ports),
      wiring: [...this.wiring],
    };
  }

  // ── Guards ────────────────────────────────────────────────

  private guardInitState(method: string): void {
    if (this.state !== 'init') {
      throw new Error(`Cannot call ${method}() after build() (INVALID_STATE)`);
    }
  }

  private guardNotDestroyed(method: string): void {
    if (this.state === 'destroyed') {
      throw new Error(`Cannot call ${method}() on destroyed pipeline (INVALID_STATE)`);
    }
  }
}
