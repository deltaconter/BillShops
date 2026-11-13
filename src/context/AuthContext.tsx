import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { AUTH_CONFIG, buildVisitorAuthEmail } from '../config/authConfig';
import { supabase, isSupabaseConfigured } from '../config/supabaseClient';
import { UserRole, AuthSession } from '../types/auth';
import { DbProfile } from '../types/database';
import { registerRpcAccessDeniedHandler } from '../utils/rpcAccessError';

export type { UserRole, AuthSession };

interface AuthContextType {
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isVisitor: boolean;
  isSupabaseActive: boolean;
  accessError: string | null;
  clearAccessError: () => void;
  loginAdmin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginVisitor: (
    identifier: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

type SelectedProfile = Pick<DbProfile, 'role' | 'establishment_id' | 'full_name'>;

const LEGACY_SESSION_KEY = 'billshops_auth_session';
const LEGACY_LOCKOUT_KEY = 'billshops_auth_lockout';
const LEGACY_FAILURES_KEY = 'billshops_auth_failures';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function safeSupabaseSignOut(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch {
    // Ignorer les erreurs réseau de déconnexion
  }
}

async function fetchValidProfile(userId: string): Promise<SelectedProfile | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, establishment_id, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const profile = data as {
      role?: unknown;
      establishment_id?: unknown;
      full_name?: unknown;
    };

    if (profile.role !== 'admin' && profile.role !== 'visitor') {
      return null;
    }

    if (typeof profile.establishment_id !== 'string' || !profile.establishment_id) {
      return null;
    }

    return {
      role: profile.role,
      establishment_id: profile.establishment_id,
      full_name: typeof profile.full_name === 'string' ? profile.full_name : null,
    };
  } catch {
    return null;
  }
}

function buildAuthSession(
  sbSession: Session,
  user: User,
  profile: SelectedProfile
): AuthSession {
  const role: UserRole = profile.role;
  const email = user.email || '';
  const metadataName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
  const emailPrefix = email.includes('@') ? email.split('@')[0] : email;

  const username =
    (profile.full_name && profile.full_name.trim()) ||
    metadataName ||
    emailPrefix ||
    (role === 'admin' ? 'Admin' : 'Visiteur');

  return {
    role,
    userId: user.id,
    username,
    email,
    token: sbSession.access_token,
    establishmentId: profile.establishment_id,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured && !!supabase);
  const [accessError, setAccessError] = useState<string | null>(null);

  const lastActivityRef = useRef<number>(0);
  const authFlowInProgressRef = useRef<boolean>(false);

  // Nettoyage des anciennes clés de session/verrouillage locales de démonstration
  useEffect(() => {
    try {
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
      localStorage.removeItem(LEGACY_LOCKOUT_KEY);
      localStorage.removeItem(LEGACY_FAILURES_KEY);
    } catch {
      // Ignorer
    }
  }, []);

  const clearAccessError = useCallback(() => {
    setAccessError(null);
  }, []);

  const clearHashIfProtected = useCallback(() => {
    if (window.location.hash.includes('admin') || window.location.hash.includes('visiteur')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const logout = useCallback(async () => {
    setSession(null);
    lastActivityRef.current = 0;
    await safeSupabaseSignOut();
    clearHashIfProtected();
  }, [clearHashIfProtected]);

  // Enregistrer le gestionnaire global d'erreur d'accès RPC (ex. visiteur désactivé côté serveur)
  useEffect(() => {
    return registerRpcAccessDeniedHandler(() => {
      setAccessError(AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS);
      void logout();
    });
  }, [logout]);

  // Synchronisation de la session avec Supabase Auth + table profiles
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setSession(null);
      setIsLoading(false);
      return;
    }

    const client = supabase;
    let isMounted = true;

    const syncSupabaseSession = async (sbSession: Session | null, resetActivity: boolean) => {
      if (!sbSession?.user) {
        if (isMounted) {
          setSession(null);
          lastActivityRef.current = 0;
          setIsLoading(false);
        }
        return;
      }

      const profile = await fetchValidProfile(sbSession.user.id);
      if (!profile) {
        await safeSupabaseSignOut();
        if (isMounted) {
          setSession(null);
          lastActivityRef.current = 0;
          setIsLoading(false);
        }
        return;
      }

      if (isMounted) {
        if (resetActivity || !lastActivityRef.current) {
          lastActivityRef.current = Date.now();
        }
        setSession(buildAuthSession(sbSession, sbSession.user, profile));
        setIsLoading(false);
      }
    };

    const initAuth = async () => {
      try {
        const {
          data: { session: initialSession },
          error,
        } = await client.auth.getSession();

        if (error) {
          await safeSupabaseSignOut();
          if (isMounted) {
            setSession(null);
            setIsLoading(false);
          }
          return;
        }

        await syncSupabaseSession(initialSession, true);
      } catch {
        if (isMounted) {
          setSession(null);
          setIsLoading(false);
        }
      }
    };

    void initAuth();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (authFlowInProgressRef.current) {
        return;
      }

      if (event === 'SIGNED_OUT' || !nextSession) {
        if (isMounted) {
          setSession(null);
          lastActivityRef.current = 0;
          setIsLoading(false);
          clearHashIfProtected();
        }
        return;
      }

      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        void syncSupabaseSession(nextSession, event === 'SIGNED_IN');
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [clearHashIfProtected]);

  // Surveillance d'inactivité en mémoire (30 min admin, 15 min visiteur)
  useEffect(() => {
    if (!session) {
      lastActivityRef.current = 0;
      return;
    }

    const timeoutMs =
      session.role === 'admin'
        ? AUTH_CONFIG.SESSION_TIMEOUTS.ADMIN_MS
        : AUTH_CONFIG.SESSION_TIMEOUTS.VISITOR_MS;

    if (!lastActivityRef.current) {
      lastActivityRef.current = Date.now();
    }

    const handleUserInteraction = () => {
      lastActivityRef.current = Date.now();
    };

    const checkExpiration = () => {
      if (lastActivityRef.current > 0 && Date.now() - lastActivityRef.current >= timeoutMs) {
        void logout();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkExpiration();
      }
    };

    const interval = window.setInterval(checkExpiration, 5000);
    window.addEventListener('mousedown', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('scroll', handleUserInteraction, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('scroll', handleUserInteraction);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session?.userId, session?.role, logout]);

  // Connexion Administrateur : email + mot de passe via Supabase Auth + vérification profil
  const loginAdmin = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    setAccessError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      return { success: false, error: AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS };
    }

    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS };
    }

    authFlowInProgressRef.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error || !data?.user || !data?.session) {
        setSession(null);
        return { success: false, error: AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS };
      }

      const profile = await fetchValidProfile(data.user.id);
      if (!profile || profile.role !== 'admin') {
        await safeSupabaseSignOut();
        setSession(null);
        return { success: false, error: AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS };
      }

      lastActivityRef.current = Date.now();
      setSession(buildAuthSession(data.session, data.user, profile));
      return { success: true };
    } catch {
      await safeSupabaseSignOut();
      setSession(null);
      return { success: false, error: AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS };
    } finally {
      authFlowInProgressRef.current = false;
    }
  };

  // Connexion Visiteur Spécial : identifiant + mot de passe -> ${identifiant.toLowerCase()}@billshops.invalid
  const loginVisitor = async (
    identifier: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    setAccessError(null);
    const cleanIdentifier = identifier.trim().toLowerCase();
    if (!cleanIdentifier || !password) {
      return { success: false, error: AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS };
    }

    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS };
    }

    const internalEmail = buildVisitorAuthEmail(cleanIdentifier);

    authFlowInProgressRef.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password,
      });

      if (error || !data?.user || !data?.session) {
        setSession(null);
        return { success: false, error: AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS };
      }

      const profile = await fetchValidProfile(data.user.id);
      if (!profile || profile.role !== 'visitor') {
        await safeSupabaseSignOut();
        setSession(null);
        return { success: false, error: AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS };
      }

      lastActivityRef.current = Date.now();
      setSession(buildAuthSession(data.session, data.user, profile));
      return { success: true };
    } catch {
      await safeSupabaseSignOut();
      setSession(null);
      return { success: false, error: AUTH_CONFIG.MESSAGES.INVALID_CREDENTIALS };
    } finally {
      authFlowInProgressRef.current = false;
    }
  };

  const isAuthenticated = !!session;
  const isAdmin = isAuthenticated && session?.role === 'admin';
  const isVisitor = isAuthenticated && (session?.role === 'visitor' || session?.role === 'admin');

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isAuthenticated,
        isAdmin,
        isVisitor,
        isSupabaseActive: isSupabaseConfigured,
        accessError,
        clearAccessError,
        loginAdmin,
        loginVisitor,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l’intérieur de AuthProvider');
  }
  return context;
};
