import type { Managed, PipelineConfig,Processor, Service, Source, WiringRule } from './types.js';

type BoundHandler = { source: Source; event: string; handler: (...args: unknown[]) => void };

export class Pipeline {
  private sources = new Map<string, Source>();
  private managed = new Map<string, Managed>();
  private processors = new Map<string, Processor>();
  private services = new Map<string, Service>();
  private wiring: WiringRule[] = [];
  private all = new Map<string, Source | Managed | Processor | Service>();
  private boundHandlers: BoundHandler[] = [];
  private built = false;

  addSource(name: string, source: Source): this {
    this.guardNotBuilt('addSource');
    this.sources.set(name, source);
    this.all.set(name, source);
    return this;
  }

  addManaged(name: string, resource: Managed): this {
    this.guardNotBuilt('addManaged');
    this.managed.set(name, resource);
    this.all.set(name, resource);
    return this;
  }

  addProcessor(name: string, processor: Processor): this {
    this.guardNotBuilt('addProcessor');
    this.processors.set(name, processor);
    this.all.set(name, processor);
    return this;
  }

  addService(name: string, service: Service): this {
    this.guardNotBuilt('addService');
    this.services.set(name, service);
    this.all.set(name, service);
    return this;
  }

  wire(source: string, event: string, targets: string[]): this {
    this.guardNotBuilt('wire');
    if (!this.sources.has(source)) {throw new Error(`Unknown source: "${source}"`);}
    for (const t of targets) {
      if (!this.processors.has(t)) {throw new Error(`Unknown processor: "${t}"`);}
    }
    this.wiring.push({ source, event, targets });
    return this;
  }

  build(): this {
    if (this.built) {throw new Error('Pipeline already built — cannot build twice');}
    for (const rule of this.wiring) {
      const src = this.sources.get(rule.source)!;
      const handlers = rule.targets.map((t) => {
        const proc = this.processors.get(t)!;
        return typeof proc === 'function' ? proc : proc.handle.bind(proc);
      });
      const handler = (...args: unknown[]) => {
        for (const h of handlers) {h(...args);}
      };
      src.on(rule.event, handler);
      this.boundHandlers.push({ source: src, event: rule.event, handler });
    }
    this.built = true;
    return this;
  }

  start(): void {
    if (!this.built) {throw new Error('Pipeline not built — call build() before start()');}
    for (const svc of this.services.values()) {svc.start();}
  }

  destroy(): void {
    // Unbind all wired event handlers
    for (const { source, event, handler } of this.boundHandlers) {
      source.off(event, handler);
    }
    this.boundHandlers = [];
    // Stop and destroy services
    for (const svc of this.services.values()) {
      svc.stop();
      svc.destroy?.();
    }
    // Destroy sources
    for (const src of this.sources.values()) {src.destroy?.();}
    // Destroy managed resources
    for (const res of this.managed.values()) {res.destroy();}
  }

  get<T = unknown>(name: string): T {
    return this.all.get(name) as T;
  }

  getConfig(): PipelineConfig {
    return {
      sources: new Map(this.sources),
      managed: new Map(this.managed),
      processors: new Map(this.processors),
      services: new Map(this.services),
      wiring: [...this.wiring],
    };
  }

  private guardNotBuilt(method: string): void {
    if (this.built) {throw new Error(`Cannot call ${method}() after build()`);}
  }
}
