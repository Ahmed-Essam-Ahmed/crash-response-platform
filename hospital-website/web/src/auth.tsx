import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as api from './api';
import type { Hospital, Session } from './types';

interface AuthValue {
  session: Session | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: Record<string, unknown>) => Promise<void>;
  signOut: () => Promise<void>;
  updateHospital: (hospital: Hospital) => void;
}

const AuthContext = createContext<AuthValue>({
  session: null,
  ready: false,
  signIn: async () => undefined,
  signUp: async () => undefined,
  signOut: async () => undefined,
  updateHospital: () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const restore = async () => {
      if (!api.getToken()) {
        setReady(true);
        return;
      }
      try {
        const me = await api.fetchMe();
        if (alive) {
          setSession({ token: api.getToken() as string, expires_at: '', ...me });
        }
      } catch {
        api.setToken(null);
      } finally {
        if (alive) setReady(true);
      }
    };
    void restore();
    return () => {
      alive = false;
    };
  }, []);

  const adopt = useCallback((next: Session) => {
    api.setToken(next.token);
    setSession(next);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      adopt(await api.login(email, password));
    },
    [adopt],
  );

  const signUp = useCallback(
    async (payload: Record<string, unknown>) => {
      adopt(await api.register(payload));
    },
    [adopt],
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      void 0;
    }
    api.setToken(null);
    setSession(null);
  }, []);

  const updateHospital = useCallback((hospital: Hospital) => {
    setSession((current) => (current ? { ...current, hospital } : current));
  }, []);

  const value = useMemo(
    () => ({ session, ready, signIn, signUp, signOut, updateHospital }),
    [session, ready, signIn, signUp, signOut, updateHospital],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
