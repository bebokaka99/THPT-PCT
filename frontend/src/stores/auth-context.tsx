import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  login as loginRequest,
  logoutSession,
  refreshSession,
} from '../services/auth.service';
import {
  AUTH_SESSION_EXPIRED_EVENT,
  AUTH_TOKEN_REFRESHED_EVENT,
} from '../services/api-client';
import type { AuthUser } from '../types/auth';

const storageKey = 'thpt_pct_pt_access_token';

type AuthContextValue = {
  accessToken: string | null;
  user: AuthUser | null;
  roles: string[];
  permissions: string[];
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(storageKey);
    void logoutSession().catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      localStorage.removeItem(storageKey);

      try {
        const response = await refreshSession();

        if (isMounted) {
          setAccessToken(response.accessToken);
          setUser(response.user);
        }
      } catch {
        if (isMounted) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleTokenRefreshed = (event: Event) => {
      const accessToken = (event as CustomEvent<{ accessToken?: unknown }>).detail
        ?.accessToken;
      if (typeof accessToken === 'string' && accessToken) {
        setAccessToken(accessToken);
      }
    };
    const handleSessionExpired = () => {
      localStorage.removeItem(storageKey);
      setAccessToken(null);
      setUser(null);
    };

    window.addEventListener(AUTH_TOKEN_REFRESHED_EVENT, handleTokenRefreshed);
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(AUTH_TOKEN_REFRESHED_EVENT, handleTokenRefreshed);
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const response = await loginRequest(identifier, password);
    localStorage.removeItem(storageKey);
    setAccessToken(response.accessToken);
    setUser(response.user);
    return response.user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      user,
      roles: user?.roles ?? [],
      permissions: user?.permissions ?? [],
      isAuthenticated: Boolean(accessToken && user),
      isInitializing,
      login,
      logout,
    }),
    [accessToken, isInitializing, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
