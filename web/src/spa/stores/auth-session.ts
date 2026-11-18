import { useCallback, useEffect, useState } from 'react';
import type { AuthSession, IAuthGateway } from '@/gateways/auth.gateway';

export interface AuthSessionSnapshot {
  readonly session: AuthSession | null;
  readonly isLoading: boolean;
  readonly refresh: () => Promise<AuthSession | null>;
}

/**
 * Shared reactive session hook subscribing cleanly to `IAuthGateway.onSessionChanged`.
 */
export function useAuthSession(auth: IAuthGateway): AuthSessionSnapshot {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await auth.getSession();
    const next = res.ok ? res.value : null;
    setSession(next);
    setIsLoading(false);
    return next;
  }, [auth]);

  useEffect(() => {
    let active = true;
    void auth.getSession().then((res) => {
      if (!active) return;
      setSession(res.ok ? res.value : null);
      setIsLoading(false);
    });
    const unsubscribe = auth.onSessionChanged((nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setIsLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth]);

  return { session, isLoading, refresh };
}
