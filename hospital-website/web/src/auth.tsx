import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as api from './api';
import type { Hospital, Session } from './types';

interface AuthValue {
  session: Session | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  joinHospital: (payload: JoinHospitalPayload) => Promise<void>;
  acceptInvitation: (token: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateHospital: (hospital: Hospital) => void;
}

export interface JoinHospitalPayload {
  registry_id: number;
  admin: { email: string; password: string; full_name?: string };
  trauma_level?: number;
  ambulances_total?: number;
  beds_total?: number;
  phone?: string;
  emergency_phone?: string;
  lat?: number;
  lon?: number;
}

const AuthContext = createContext<AuthValue>({
  session: null,
  ready: false,
  signIn: async () => undefined,
  joinHospital: async () => undefined,
  acceptInvitation: async () => undefined,
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

  const joinHospital = useCallback(
    async (payload: {
      registry_id: number;
      admin: { email: string; password: string; full_name?: string };
      trauma_level?: number;
      ambulances_total?: number;
      beds_total?: number;
      phone?: string;
      emergency_phone?: string;
      lat?: number;
      lon?: number;
    }) => {
      adopt(await api.joinHospital(payload));
    },
    [adopt],
  );

  const acceptInvitation = useCallback(
    async (token: string, password: string, fullName?: string) => {
      adopt(await api.acceptInvitation(token, { password, full_name: fullName }));
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
    () => ({
      session,
      ready,
      signIn,
      joinHospital,
      acceptInvitation,
      signOut,
      updateHospital,
    }),
    [session, ready, signIn, joinHospital, acceptInvitation, signOut, updateHospital],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
