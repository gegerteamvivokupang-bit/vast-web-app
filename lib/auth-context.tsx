'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, UserProfile, getUserProfile } from './supabase';
import { User } from '@supabase/supabase-js';

// REMOVED: Aggressive timeout that was clearing valid sessions
// ROOT CAUSE: Timeout racing with auth init was clearing valid sessions on pull-to-refresh
// SOLUTION: Trust Supabase's built-in session management, no artificial timeouts

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  debugInfo: string[];
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  debugInfo: [],
  signOut: async () => {},
  refreshProfile: async () => {},
});

// Helper to clear all auth-related storage
const clearAllAuthStorage = () => {
  if (typeof window === 'undefined') return;

  try {
    // Clear localStorage
    localStorage.removeItem('promoter_session');
    localStorage.removeItem('vast-auth');
    localStorage.removeItem('supabase.auth.token');

    // Clear any supabase-related keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('vast'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear sessionStorage too
    sessionStorage.clear();
  } catch (error) {
    console.error('Failed to clear storage:', error);
  }
};

// Helper to unregister service worker on critical errors
const unregisterServiceWorker = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
    console.log('Service worker unregistered');
  } catch (error) {
    console.error('Failed to unregister service worker:', error);
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const fetchProfile = async (userId: string) => {
    try {
      const userProfile = await getUserProfile(userId);
      setProfile(userProfile);
      return userProfile;
    } catch {
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const addDebug = (msg: string) => {
        console.log(msg);
        setDebugInfo(prev => [...prev, msg]);
      };

      addDebug('[Auth] Starting...');
      try {
        addDebug('[Auth] Fetching session from Supabase...');
        const { data: { session }, error } = await supabase.auth.getSession();
        addDebug(`[Auth] Session: ${session ? 'EXISTS' : 'NONE'}`);

        if (!isMounted) {
          addDebug('[Auth] Component unmounted');
          return;
        }

        if (error) {
          addDebug(`[Auth] ERROR: ${error.message}`);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (!session?.user) {
          addDebug('[Auth] No session, not logged in');
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        addDebug(`[Auth] User found: ${session.user.id.substring(0, 8)}...`);
        setUser(session.user);

        try {
          addDebug('[Auth] Fetching profile...');
          const userProfile = await getUserProfile(session.user.id);
          addDebug(`[Auth] Profile: ${userProfile ? 'SUCCESS' : 'NULL'}`);

          if (isMounted && userProfile) {
            setProfile(userProfile);
            addDebug('[Auth] ✅ COMPLETE');
          } else if (!userProfile) {
            addDebug('[Auth] ❌ Profile NULL!');
          }
        } catch (error) {
          addDebug(`[Auth] Profile error: ${error}`);
        }

        if (isMounted) {
          setLoading(false);
        }
      } catch (error) {
        addDebug(`[Auth] FATAL: ${error}`);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        console.log('Auth state changed:', event);

        if (event === 'SIGNED_OUT' || !session?.user) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          clearAllAuthStorage();
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setUser(session.user);
          try {
            const userProfile = await getUserProfile(session.user.id);
            if (isMounted) {
              setProfile(userProfile);
              setLoading(false);
            }
          } catch (error) {
            console.error('Failed to fetch profile on auth change:', error);
            if (isMounted) setLoading(false);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);

      // Sign out with timeout to prevent hanging
      const signOutPromise = supabase.auth.signOut({ scope: 'global' });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SignOut timeout')), 3000)
      );

      await Promise.race([signOutPromise, timeoutPromise]);
    } catch (err) {
      console.error('SignOut error:', err);
      // Continue with cleanup even if signOut fails
    } finally {
      // Always clear ALL local state and storage
      setUser(null);
      setProfile(null);
      clearAllAuthStorage();
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, debugInfo, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper functions untuk cek akses
export function canAccessArea(profile: UserProfile | null, area: string): boolean {
  if (!profile) return false;
  if (profile.role === 'super_admin' || profile.role === 'manager_area') return true;
  if (profile.area === 'ALL') return true;
  return profile.area === area;
}

export function canAccessSator(profile: UserProfile | null, satorName: string): boolean {
  if (!profile) return false;
  if (profile.role === 'super_admin' || profile.role === 'manager_area' || profile.role === 'spv_area') {
    return true;
  }
  // Sator can access their own team
  if (profile.sator_name === satorName) return true;
  // Sator can access other sators if in can_view_other_sators
  if (profile.can_view_other_sators?.includes(satorName)) return true;
  return false;
}

export function getAccessibleAreas(profile: UserProfile | null): string[] {
  if (!profile) return [];
  if (profile.role === 'super_admin' || profile.role === 'manager_area' || profile.area === 'ALL') {
    return ['KUPANG', 'KABUPATEN', 'SUMBA'];
  }
  return [profile.area];
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    'super_admin': 'Super Admin',
    'manager_area': 'Manager Area',
    'spv_area': 'SPV Area',
    'sator': 'Sator',
  };
  return labels[role] || role;
}
