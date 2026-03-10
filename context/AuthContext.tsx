import { api, setOnUnauthorized } from '@/backend/src/utils/api';
import {
  clearToken,
  createInitialAppDataForUser,
  getToken,
  loadAuth,
  saveAppData,
  saveAuth,
  saveToken,
} from '@/backend/src/utils/storage';
import type { ApiUser, User } from '@/types';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface AuthContextValue {
  isLoggedIn: boolean;
  user: User | ApiUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (user: User) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await clearToken();
    const auth = await loadAuth();
    await saveAuth({
      ...auth,
      isLoggedIn: false,
      currentUserEmail: null,
      apiUser: null,
      token: null,
    });
    setIsLoggedIn(false);
    setUser(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      setIsLoggedIn(false);
      setUser(null);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [auth, token] = await Promise.all([loadAuth(), getToken()]);
      if (cancelled) return;
      if (token) {
        setIsLoggedIn(true);
        setUser(auth.apiUser ?? null);
      } else {
        const u = auth.currentUserEmail && auth.users[auth.currentUserEmail]
          ? auth.users[auth.currentUserEmail]
          : null;
        setIsLoggedIn(!!u);
        setUser(u);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await api.post<{ token: string; user: ApiUser }>('/api/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      const { token, user: apiUser } = res;
      await saveToken(token);
      const auth = await loadAuth();
      const next = {
        ...auth,
        isLoggedIn: true,
        currentUserEmail: apiUser.email,
        apiUser,
        token,
      };
      await saveAuth(next);
      setIsLoggedIn(true);
      setUser(apiUser);
      return { success: true };
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Invalid email or password';
      return { success: false, error: message };
    }
  }, []);

  const register = useCallback(async (newUser: User): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await api.post<{ token: string; user: ApiUser }>('/api/auth/register', {
        name: newUser.ownerName?.trim() || newUser.businessName?.trim() || 'User',
        businessName: newUser.businessName?.trim() || null,
        email: newUser.email.trim().toLowerCase(),
        password: newUser.password,
      });
      const { token, user: apiUser } = res;
      await saveToken(token);
      const auth = await loadAuth();
      const normalizedEmail = newUser.email.trim().toLowerCase();
      const userToStore: User = {
        ...newUser,
        email: normalizedEmail,
      };
      const next = {
        ...auth,
        users: { ...auth.users, [normalizedEmail]: userToStore },
        isLoggedIn: true,
        currentUserEmail: normalizedEmail,
        apiUser,
        token,
      };
      await saveAuth(next);
      const initialData = createInitialAppDataForUser(userToStore);
      await saveAppData(initialData);
      setIsLoggedIn(true);
      setUser(apiUser);
      return { success: true };
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Registration failed';
      return { success: false, error: message };
    }
  }, []);

  const value: AuthContextValue = {
    isLoggedIn,
    user,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
