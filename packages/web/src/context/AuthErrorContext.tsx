import { createContext, type ReactNode,useContext, useState } from 'react';

interface AuthErrorState {
  authError: boolean;
  setAuthError: (v: boolean) => void;
}

const AuthErrorContext = createContext<AuthErrorState>({
  authError: false,
  setAuthError: () => {},
});

export function AuthErrorProvider({ children }: { children: ReactNode }) {
  const [authError, setAuthError] = useState(false);
  return <AuthErrorContext.Provider value={{ authError, setAuthError }}>{children}</AuthErrorContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with provider by design
export function useAuthError() {
  return useContext(AuthErrorContext);
}
