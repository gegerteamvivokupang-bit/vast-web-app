'use client';

import { AuthProvider } from '@/lib/auth-context';
import { DebugOverlay } from '@/components/debug-overlay';
import { ReactNode, useEffect } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    // TEMPORARY FIX: Clear old service workers and caches on mount
    // This fixes the "stuck loading" issue after refresh
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length > 0) {
          console.log('[Fix] Clearing old service workers...');
          registrations.forEach((registration) => {
            registration.unregister();
          });

          // Clear all caches
          caches.keys().then((cacheNames) => {
            cacheNames.forEach((cacheName) => {
              caches.delete(cacheName);
            });
          });
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
