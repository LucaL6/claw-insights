// src/adapters/index.ts
export { createCronAdapter } from './cron-adapter.js';
export { createGatewayAdapter } from './gateway-adapter.js';
export { createLogAdapter } from './log-adapter.js';
export { createMetricsAdapter } from './metrics-adapter.js';
export { createSessionAdapter } from './session-adapter.js';
export { createSubscriptionHub } from './shared/subscription-hub.js';
export type { HealthStatus } from './system-adapter.js';
export { aggregateHealthStatus,createSystemAdapter, mapHealthStatus } from './system-adapter.js';
