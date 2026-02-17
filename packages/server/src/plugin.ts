/**
 * Claw Insights Plugin Contract
 *
 * Defines the interface between Claw Insights and the OpenClaw plugin system.
 * See: DESIGN-013-PluginContract-2026-02-17.md
 */

// ── Manifest ──

export interface PluginManifest {
  name: string;
  version: string;
  displayName: string;
  description: string;
  minOpenClawVersion?: string;
  type: 'ui' | 'service' | 'integration';
  entry: {
    server: string;
    web?: string;
  };
  config?: Record<string, PluginConfigField>;
}

export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean';
  default?: string | number | boolean;
  description?: string;
  required?: boolean;
}

// ── Lifecycle ──

export interface PluginLifecycle {
  onInstall?: () => Promise<void>;
  onStart?: (context: PluginContext) => Promise<void>;
  onStop?: () => Promise<void>;
  onUpgrade?: (fromVersion: string) => Promise<void>;
}

// ── Context (injected by OpenClaw) ──

export interface PluginContext {
  gatewayUrl: string;
  gatewayToken: string;
  dataDir: string;
  config: Record<string, string | number | boolean>;
}

// ── Plugin Entry ──

export interface ClawDashboardPlugin extends PluginLifecycle {
  manifest: PluginManifest;
}

// ── Current Manifest ──

export const manifest: PluginManifest = {
  name: 'claw-insights',
  version: '0.1.0',
  displayName: 'Claw Insights',
  description: 'Monitoring dashboard for OpenClaw gateway',
  minOpenClawVersion: '2026.2.0',
  type: 'ui',
  entry: {
    server: './packages/server/src/index.ts',
    web: './packages/web/dist/',
  },
  config: {
    port: { type: 'number', default: 3200, description: 'Dashboard server port' },
  },
};

export const PLUGIN_CONTRACT_VERSION = '0.2.0';
