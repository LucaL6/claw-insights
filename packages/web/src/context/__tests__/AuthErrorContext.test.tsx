import { act,renderHook } from '@testing-library/react';
import { describe, expect,it } from 'vitest';

import { AuthErrorProvider, useAuthError } from '../AuthErrorContext';

describe('AuthErrorContext', () => {
  it('starts with no error', () => {
    const { result } = renderHook(() => useAuthError(), {
      wrapper: AuthErrorProvider,
    });
    expect(result.current.authError).toBe(false);
  });

  it('setAuthError triggers error state', () => {
    const { result } = renderHook(() => useAuthError(), {
      wrapper: AuthErrorProvider,
    });
    act(() => result.current.setAuthError(true));
    expect(result.current.authError).toBe(true);
  });
});
