import { describe, it, expect } from 'vitest';

describe('OperationModals barrel export', () => {
  it('exports useOperationModals', async () => {
    const mod = await import('../OperationModals');
    expect(mod.useOperationModals).toBeDefined();
  });

  it('exports RestartModal', async () => {
    const mod = await import('../OperationModals');
    expect(mod.RestartModal).toBeDefined();
  });

  it('exports UpdateModal', async () => {
    const mod = await import('../OperationModals');
    expect(mod.UpdateModal).toBeDefined();
  });

  it('exports DoctorModal', async () => {
    const mod = await import('../OperationModals');
    expect(mod.DoctorModal).toBeDefined();
  });
});
