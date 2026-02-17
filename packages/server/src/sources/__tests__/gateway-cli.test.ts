import { describe, it, expect } from 'vitest';
import { getGatewayStatus } from '../gateway-cli';

describe('gateway-cli extended fields', () => {
  it('should include connectLatencyMs in gateway status', async () => {
    const status = await getGatewayStatus();
    expect(typeof status.connectLatencyMs === 'number' || status.connectLatencyMs === null).toBe(true);
  });

  it('should include latestVersion in gateway status', async () => {
    const status = await getGatewayStatus();
    expect(status.latestVersion === null || typeof status.latestVersion === 'string').toBe(true);
  });

  it('should include securitySummary in gateway status', async () => {
    const status = await getGatewayStatus();
    expect(status.securitySummary).toBeDefined();
    expect(typeof status.securitySummary.critical).toBe('number');
    expect(typeof status.securitySummary.warn).toBe('number');
    expect(typeof status.securitySummary.info).toBe('number');
  });

  it('should include sessionDefaults in gateway status', async () => {
    const status = await getGatewayStatus();
    expect(status.sessionDefaults === null || typeof status.sessionDefaults === 'object').toBe(true);
  });
});
