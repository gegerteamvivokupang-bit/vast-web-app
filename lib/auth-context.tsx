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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
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
      try {
        // Get current session from Supabase - NO timeout, NO race conditions
        // Trust Supabase's built-in session management
        const { data: { session }, error } = await supabase.auth.getSession();

        if (!isMounted) return;

        // Only handle actual Supabase errors
        if (error) {
          console.error('Supabase session error:', error);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        // No session = not logged in (this is normal, not an error)
        if (!session?.user) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        // Valid session found - set user immediately
        setUser(session.user);

        // Fetch user profile (no timeout racing)
        try {
          const userProfile = await getUserProfile(session.user.id);
          if (isMounted && userProfile) {
            setProfile(userProfile);
          }
        } catch (error) {
          console.error('Failed to fetch profile:', error);
          // Don't logout on profile fetch error - user is still authenticated
        }

        if (isMounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        // Don't clear session on unexpected errors - let Supabase handle it
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
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
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
