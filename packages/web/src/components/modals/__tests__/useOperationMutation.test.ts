import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOperationMutation } from '../useOperationMutation';

const mockExecute = vi.fn();
vi.mock('urql', () => ({
  useMutation: () => [{ fetching: false, error: null }, mockExecute],
}));

describe('useOperationMutation', () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it('returns loading false initially', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useOperationMutation(null as any, onClose));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('executes mutation and calls onClose on success', async () => {
    mockExecute.mockResolvedValueOnce({ data: { restartGateway: { success: true } } });
    const onClose = vi.fn();
    const { result } = renderHook(() => useOperationMutation(null as any, onClose));

    await act(async () => {
      await result.current.run();
    });

    expect(mockExecute).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('sets error on mutation failure', async () => {
    mockExecute.mockResolvedValueOnce({ error: { message: 'Network error' } });
    const onClose = vi.fn();
    const { result } = renderHook(() => useOperationMutation(null as any, onClose));

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.error).toBe('Network error');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('passes variables to execute', async () => {
    mockExecute.mockResolvedValueOnce({ data: {} });
    const onClose = vi.fn();
    const { result } = renderHook(() => useOperationMutation(null as any, onClose));

    await act(async () => {
      await result.current.run({ options: { autoFix: true } } as any);
    });

    expect(mockExecute).toHaveBeenCalledWith({ options: { autoFix: true } });
  });
});
