# FIX: Stuck Loading on Refresh - Race Condition

## 🐛 Problem
App gets stuck on loading screen after multiple refreshes:
- 1st refresh: ✅ OK
- 2nd refresh: ✅ OK  
- 3rd+ refresh: ❌ STUCK
- Kadang berhasil, kadang tidak (non-deterministic)

Debug log shows:
```
Loading: YES | User: YES | Profile: NO
```

## 🔍 Root Cause
**Multiple Race Conditions:**

1. **Service Worker Race Condition**
   - PWA disabled (`disable: true` in config) but service worker files still exist
   - Service worker intercepting requests inconsistently
   - Pull-to-refresh triggering service worker cleanup WHILE auth initializing
   - Creates timing conflicts

2. **Multiple Auth Initialization**
   - No guard flag to prevent concurrent `initializeAuth()` calls
   - React Strict Mode or multiple refreshes trigger parallel initializations
   - State updates from multiple sources conflict
   - `getUserProfile()` called multiple times simultaneously

3. **Service Worker Cleanup on Every Refresh**
   - `providers.tsx` was clearing service workers on EVERY mount
   - Racing with auth initialization
   - Causing unpredictable behavior

## ✅ Solutions Applied

### 1. Added Initialization Guard Flag
**File:** `lib/auth-context.tsx`

```typescript
useEffect(() => {
  let isMounted = true;
  let isInitializing = false; // GUARD FLAG

  const initializeAuth = async () => {
    // Prevent multiple concurrent initializations
    if (isInitializing) {
      console.log('[Auth] Already initializing, skipping...');
      return;
    }
    isInitializing = true;
    // ... rest of auth init
  };

  return () => {
    isMounted = false;
    isInitializing = false; // Reset flag on cleanup
    subscription.unsubscribe();
  };
}, []);
```

**Why:** Prevents multiple `initializeAuth()` calls from racing with each other.

### 2. Service Worker Cleanup Once Per Session
**File:** `components/providers.tsx`

**Before:**
```typescript
useEffect(() => {
  // Runs on EVERY mount/refresh - CAUSES RACE CONDITION
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
  });
}, []);
```

**After:**
```typescript
useEffect(() => {
  // Only run ONCE per browser session
  const hasCleared = sessionStorage.getItem('sw-cleared');
  if (hasCleared) return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      if (registrations.length > 0) {
        Promise.all(registrations.map(reg => reg.unregister())).then(() => {
          sessionStorage.setItem('sw-cleared', 'true');
        });
      } else {
        sessionStorage.setItem('sw-cleared', 'true');
      }
    });
  }
}, []);
```

**Why:** 
- Prevents cleanup from running on every refresh
- Only clears service workers once per session
- No longer races with auth initialization

### 3. Removed Service Worker Files
**Files deleted:**
- `public/sw.js`
- `public/workbox-*.js`

**Why:** 
- PWA is disabled but files were still being generated
- Even disabled, service workers can still register from cache
- Complete removal ensures no interference

### 4. Enhanced Error Logging
**File:** `lib/supabase.ts`

```typescript
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[getUserProfile] Error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      userId: userId
    });
    return null;
  }

  if (!data) {
    console.warn('[getUserProfile] No profile found for user:', userId);
    return null;
  }

  console.log('[getUserProfile] Profile loaded successfully:', data.email);
  return data;
}
```

**Why:** Better debugging when issues occur.

## 📊 Expected Behavior After Fix

### Before:
```
Refresh 1: ✅ OK
Refresh 2: ✅ OK
Refresh 3: ❌ STUCK (race condition)
Refresh 4: ❌ STUCK
Refresh 5: ✅ OK (randomly works)
```

### After:
```
Refresh 1: ✅ OK (service worker cleared once)
Refresh 2: ✅ OK (no service worker interference)
Refresh 3: ✅ OK (guard flag prevents race)
Refresh 4: ✅ OK (consistent behavior)
Refresh 5: ✅ OK (no more random failures)
```

## 🧪 Testing Checklist

1. **Clear Browser Data First:**
   ```
   - Clear all browser cache
   - Clear localStorage
   - Clear sessionStorage
   - Unregister all service workers manually
   ```

2. **Test Rapid Refresh:**
   ```
   - Login to app
   - Pull to refresh 10x rapidly
   - Should NOT get stuck
   ```

3. **Check Console Logs:**
   ```
   [Auth] Starting...
   [Auth] Fetching session from Supabase...
   [Auth] Session: EXISTS
   [Auth] User found: xxx...
   [Auth] Fetching profile...
   [Auth] User ID: xxx...
   [getUserProfile] Profile loaded successfully: user@example.com
   [Auth] Profile: SUCCESS
   [Auth] ✅ COMPLETE
   ```

4. **Verify No Duplicate Calls:**
   - Should NOT see "Already initializing, skipping..." unless rapid refresh
   - `getUserProfile()` should be called exactly once per refresh

## 🚀 Deployment

After deploying:
1. Users may need to clear cache ONCE
2. Service worker will be unregistered automatically
3. All subsequent refreshes should work consistently

## 📝 Additional Files Created

1. `FIX-USER-PROFILES-RLS.sql` - RLS policy fix (if needed)
2. `DEBUG-USER-SESSION.sql` - Debugging queries
3. This document - Documentation of fix

## ⚠️ Important Notes

1. **React Strict Mode:** 
   - In development, React may still double-mount
   - Guard flag prevents issues from this

2. **Service Worker Cache:**
   - Old service workers from previous deploys may persist
   - First load after deploy clears them
   - Uses sessionStorage to prevent repeated clearing

3. **Profile Timeout:**
   - 5 second timeout on `getUserProfile()`
   - If profile doesn't load, shows error instead of infinite loading
   - Better UX even if something fails
