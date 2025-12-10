import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname;

  // Dashboard and Promoter routes
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isPromoterRoute = pathname.startsWith('/promoter');

  // Add cache control headers to prevent browser caching of auth pages
  // This is the main purpose of middleware now - prevent caching
  // Auth validation is handled client-side because Supabase uses localStorage
  if (isDashboardRoute || isPromoterRoute || pathname === '/login') {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\\.js|.*\\.svg$).*)',
  ],
};
