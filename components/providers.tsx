'use client';

import { AuthProvider } from '@/lib/auth-context';
import { DebugOverlay } from '@/components/debug-overlay';
import { ReactNode, useEffect } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Clear service workers ONCE on initial mount only
    // Using sessionStorage flag to prevent running on every refresh
    if (typeof window === 'undefined') return;

    const hasCleared = sessionStorage.getItem('sw-cleared');
    if (hasCleared) return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length > 0) {
          console.log('[Providers] Clearing service workers...');
          Promise.all(registrations.map(reg => reg.unregister())).then(() => {
            sessionStorage.setItem('sw-cleared', 'true');
            console.log('[Providers] Service workers cleared');
          });
        } else {
          sessionStorage.setItem('sw-cleared', 'true');
        }
      });
    }
  }, []);

  return (
    <AuthProvider>
      {children}
      <DebugOverlay />
    </AuthProvider>
  );
}
