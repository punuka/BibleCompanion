import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LANGUAGE, type PublicUser } from '@bible/shared';
import { api, setAuthToken } from '../api/client';
import { dictFor } from '../i18n/strings';

const TOKEN_KEY = 'bible.token';

interface AuthState {
  user: PublicUser | null;
  token: string | null;
  loading: boolean;
  language: string;
  t: ReturnType<typeof dictFor>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    displayName: string;
    language: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  setLanguage: (code: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on cold start. A stale or revoked token is discarded
  // silently rather than dropping the user on an error screen at launch.
  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(TOKEN_KEY);
        if (stored) {
          setAuthToken(stored);
          const me = await api.me();
          setToken(stored);
          setUser(me);
        }
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
        setAuthToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: { token: string; user: PublicUser }) => {
    setAuthToken(next.token);
    await AsyncStorage.setItem(TOKEN_KEY, next.token);
    setToken(next.token);
    setUser(next.user);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await persist(await api.login({ email, password }));
    },
    [persist],
  );

  const signUp = useCallback(
    async (input: { email: string; password: string; displayName: string; language: string }) => {
      await persist(await api.register(input));
    },
    [persist],
  );

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const setLanguage = useCallback(async (code: string) => {
    setUser(await api.updateMe({ language: code }));
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    setUser(await api.me());
  }, [token]);

  const language = user?.language ?? DEFAULT_LANGUAGE;

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      loading,
      language,
      t: dictFor(language),
      signIn,
      signUp,
      signOut,
      setLanguage,
      refresh,
    }),
    [user, token, loading, language, signIn, signUp, signOut, setLanguage, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
