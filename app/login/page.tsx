'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

type LoginMode = 'staff' | 'promoter';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>('staff');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [showRecovery, setShowRecovery] = useState(false);

  // Helper to clear all cache and storage
  const clearAllCacheAndStorage = async () => {
    try {
      // Clear localStorage
      localStorage.clear();
      sessionStorage.clear();

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      }

      console.log('All cache and storage cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  // Force recovery - clear everything and reload
  const handleForceRecovery = async () => {
    await clearAllCacheAndStorage();
    window.location.reload();
  };

  // Check if already logged in
  useEffect(() => {
    let isMounted = true;

    // Show recovery button after 8 seconds if still checking
    const recoveryTimeout = setTimeout(() => {
      if (isMounted && checkingSession) {
        setShowRecovery(true);
      }
    }, 8000);

    // Fallback timeout - prevent infinite loading (5 seconds)
    const timeout = setTimeout(() => {
      if (isMounted) setCheckingSession(false);
    }, 5000);

    const checkSession = async () => {
      // Check promoter session with expiration (24 hours)
      const promoterSession = localStorage.getItem('promoter_session');
      if (promoterSession) {
        try {
          const session = JSON.parse(promoterSession);
          const loginTime = new Date(session.loginAt).getTime();
          const now = Date.now();
          const SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

          if (session?.user_id && (now - loginTime) < SESSION_EXPIRY) {
            router.replace('/promoter');
            return;
          } else {
            localStorage.removeItem('promoter_session');
          }
        } catch {
          localStorage.removeItem('promoter_session');
        }
      }

      // Check staff session with aggressive timeout
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 3000)
        );

        const result = await Promise.race([sessionPromise, timeoutPromise]);

        if (result === null) {
          // Timeout - clear and continue
          console.warn('Session check timeout');
        } else if (result?.data?.session?.user) {
          router.replace('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Session check error:', error);
      }

      if (isMounted) {
        clearTimeout(timeout);
        clearTimeout(recoveryTimeout);
        setCheckingSession(false);
      }
    };

    checkSession();

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      clearTimeout(recoveryTimeout);
    };
  }, [router]);

  const handleIdentifierChange = (value: string) => {
    setIdentifier(value);
    // No auto-detect - user picks tab manually
  };

  // Authenticate promoter with employee_id + PIN
  const authenticatePromoter = async (employeeId: string, pin: string) => {
    try {
      const { data, error } = await supabase.rpc('authenticate_promoter', {
        p_employee_id: employeeId.toUpperCase(),
        p_pin: pin,
      });

      if (error) {
        throw new Error('Gagal authenticate: ' + error.message);
      }

      if (!data || data.length === 0) {
        throw new Error('Function tidak return data');
      }

      const result = data[0];

      if (!result.success) {
        throw new Error(result.message || 'Login gagal');
      }

      return result;
    } catch (err: any) {
      throw err;
    }
  };

  // Sign in as staff with Supabase Auth
  const signInStaff = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'promoter') {
        // Promoter login: employee_id + PIN
        const promoterData = await authenticatePromoter(identifier, password);

        // Store promoter session in localStorage
        const session = {
          user_id: promoterData.user_id,
          name: promoterData.name,
          area: promoterData.area,
          employee_id: identifier.toUpperCase(),
          role: 'promoter',
          loginAt: new Date().toISOString(),
        };

        localStorage.setItem('promoter_session', JSON.stringify(session));

        // Redirect to promoter dashboard
        router.replace('/promoter');
      } else {
        // Staff login: email + password (Supabase Auth)
        await signInStaff(identifier, password);
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  // Show loading while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-3 text-gray-800">Memeriksa sesi...</p>

          {showRecovery && (
            <div className="mt-6 p-4 bg-white rounded-lg shadow-lg max-w-sm mx-auto">
              <p className="text-sm text-gray-700 mb-3">
                Loading terlalu lama? Mungkin ada masalah dengan cache.
              </p>
              <Button
                onClick={handleForceRecovery}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                Reset & Reload
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">VAST Sales</h1>
          <p className="text-gray-800 mt-2">Sistem Laporan Penjualan</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setMode('staff')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              mode === 'staff'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Staff / SPV
          </button>
          <button
            type="button"
            onClick={() => setMode('promoter')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              mode === 'promoter'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Promotor
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-2">
              {mode === 'staff' ? 'Email' : 'Employee ID'}
            </label>
            <input
              id="identifier"
              type={mode === 'staff' ? 'email' : 'text'}
              value={identifier}
              onChange={(e) => handleIdentifierChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder={mode === 'staff' ? 'admin@vast.com' : 'KPG001'}
              required
              autoComplete="off"
            />
            {mode === 'promoter' && (
              <p className="text-xs text-gray-500 mt-1">Format: KPG001, KBP001, atau SMB001</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              {mode === 'staff' ? 'Password' : 'PIN (4 digit)'}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder={mode === 'staff' ? '••••••••' : '••••'}
              maxLength={mode === 'staff' ? undefined : 4}
              inputMode={mode === 'promoter' ? 'numeric' : 'text'}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Login'}
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-6 text-center text-xs text-gray-500">
          {mode === 'staff' ? (
            <p className="text-gray-400">
              Hubungi Admin jika lupa password
            </p>
          ) : (
            <>
              <p className="font-medium mb-2">Login Promotor:</p>
              <p>Gunakan Employee ID dan PIN yang diberikan oleh SPV</p>
              <p className="mt-1">PIN default: <strong>1234</strong></p>
              <p className="text-xs mt-2 text-gray-400">
                Jika lupa PIN, hubungi SPV Anda
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
