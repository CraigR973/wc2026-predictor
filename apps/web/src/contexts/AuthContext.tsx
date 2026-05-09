import React, { createContext, useCallback, useContext, useState } from 'react';
import { clearTokens, getStoredPlayer, storeTokens, StoredPlayer } from '../lib/tokens';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

interface AuthState {
  player: StoredPlayer | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (displayName: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    player: getStoredPlayer(),
    isLoading: false,
  });

  const login = useCallback(async (displayName: string, pin: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const resp = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName, pin }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail ?? 'Login failed');
      }
      const data = await resp.json();
      const player: StoredPlayer = {
        id: data.player.id,
        displayName: data.player.display_name,
        role: data.player.role,
        timezone: data.player.timezone,
      };
      storeTokens(data.access_token, data.refresh_token, player);
      setState({ player, isLoading: false });
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    const { getRefreshToken } = await import('../lib/tokens');
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      fetch(`${BASE}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }
    clearTokens();
    setState({ player: null, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
