export type ServerState = 'running' | 'degraded' | 'stopped';

export interface StatusJsonPayload {
  schemaVersion: 1;
  version: string;
  server: {
    state: ServerState;
    pid: number | null;
    port: number;
    url: string;
  };
  web: {
    enabled: boolean;
    port: number;
    url: string;
  };
  auth: {
    mode: string;
    tokenUrlPresent: boolean;
    accessUrl: string | null;
  };
  health: {
    ok: boolean;
    ready: boolean;
    gateway: string;
    db: string;
    warnings: string[];
  };
}

export interface BuildStatusJsonInput {
  version: string;
  server: StatusJsonPayload['server'];
  web: StatusJsonPayload['web'];
  auth: StatusJsonPayload['auth'];
  health: Omit<StatusJsonPayload['health'], 'warnings'> & { warnings?: string[] };
}

export function buildStatusJson(input: BuildStatusJsonInput): StatusJsonPayload {
  const warnings = [...(input.health.warnings ?? [])];
  if (input.version === 'unknown') {
    warnings.push('cli version is unknown');
  }

  return {
    schemaVersion: 1,
    version: input.version,
    server: input.server,
    web: input.web,
    auth: input.auth,
    health: {
      ...input.health,
      warnings,
    },
  };
}
