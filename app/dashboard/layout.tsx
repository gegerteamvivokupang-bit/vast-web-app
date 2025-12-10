'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth, getRoleLabel } from '@/lib/auth-context';
import { ChangePasswordDialog } from '@/components/change-password-dialog';
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  LogOut,
  Menu,
  User,
  Users,
  Smartphone,
  Building2,
  Target,
  Key,
  ChevronDown,
  X,
  Home,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, profileError, signOut, refreshProfile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [retryingProfile, setRetryingProfile] = useState(false);

  // Redirect handled by middleware, but also check here for client-side navigation
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/login');
    } catch {
      router.replace('/login');
    }
  };

  const handleRetryProfile = async () => {
    if (retryingProfile) return;
    setRetryingProfile(true);
    try {
      await refreshProfile();
    } finally {
      setRetryingProfile(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full text-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
          <h2 className="text-lg font-semibold text-gray-900">Profil belum siap</h2>
          <p className="text-sm text-gray-600">
            {profileError || 'Profil pengguna belum berhasil dimuat. Coba lagi atau logout.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={handleRetryProfile} disabled={retryingProfile}>
              {retryingProfile ? 'Memuat ulang...' : 'Coba lagi'}
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Build nav items based on role
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/tim-saya', label: 'Tim Saya', icon: Users },
  ];

  // Add Laporan Harian for all except Manager Area
  if (profile.role !== 'manager_area') {
    navItems.push({ href: '/dashboard/laporan-harian', label: 'Laporan Harian', icon: FileText });
  }

  // Add Rekap Bulanan for all
  navItems.push({ href: '/dashboard/rekap', label: 'Rekap Bulanan', icon: BarChart3 });

  // Add SPC Grup for SPV Kupang, Sator Andri, Super Admin, and Manager Area
  const isSPVKupang = profile.role === 'spv_area' && profile.area === 'KUPANG';
  const isSatorAndri = profile.email === 'andri@vast.com';
  const isAdmin = profile.role === 'super_admin' || profile.role === 'manager_area';

  if (isSPVKupang || isSatorAndri || isAdmin) {
    navItems.push({
      href: '/dashboard/spc-grup',
      label: 'SPC Grup',
      icon: Building2,
    });
  }

  // Add Target Management for SPV and Manager Area
  if (profile.role === 'spv_area' || profile.role === 'manager_area') {
    navItems.push({
      href: '/dashboard/targets',
      label: 'Setting Target',
      icon: Target,
    });
  }

  // Add Management Tim for SPV and Super Admin only (not Manager Area)
  if (profile.role === 'spv_area' || profile.role === 'super_admin') {
    navItems.push({
      href: '/dashboard/team',
      label: 'Management Tim',
      icon: Users,
    });
  }

  // Add Management Tipe HP for Super Admin only
  if (profile.role === 'super_admin') {
    navItems.push({
      href: '/dashboard/phone-types',
      label: 'Management Tipe HP',
      icon: Smartphone,
    });
  }

  // Menu items (semua kecuali Dashboard)
  const menuItems = navItems.filter(item => item.href !== '/dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar - hidden on mobile */}
      <aside
        className={`fixed left-0 top-0 h-full bg-indigo-900 text-white transition-all duration-300 hidden md:block ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="p-4 border-b border-indigo-800 flex items-center justify-between">
          {sidebarOpen && <h1 className="text-xl font-bold">VAST Sales</h1>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white hover:bg-indigo-800"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-indigo-700'
                    : 'hover:bg-indigo-800'
                }`}
                style={{ color: 'white' }}
              >
                <Icon className="h-5 w-5 flex-shrink-0" style={{ color: 'white' }} />
                {sidebarOpen && <span style={{ color: 'white' }}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-indigo-800">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-white bg-red-600 hover:bg-red-700"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span className="ml-3">Logout</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-indigo-900 text-white z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold">VAST Sales</h1>
          <button
            onClick={handleLogout}
            className="p-2 bg-red-600 hover:bg-red-700 rounded-lg"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`transition-all duration-300 ml-0 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-20'
        } pt-14 md:pt-0 pb-20 md:pb-0`}
      >
        {/* Desktop Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 hidden md:block">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900">
                {navItems.find((item) => item.href === pathname)?.label || 'Dashboard'}
              </h2>
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 transition-colors"
                >
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{profile.name}</p>
                    <p className="text-xs text-gray-500">
                      {getRoleLabel(profile.role)} {profile.area !== 'ALL' && `• ${profile.area}`}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-indigo-600" />
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <button
                        onClick={() => {
                          setShowPasswordDialog(true);
                          setShowUserMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Key className="h-4 w-4" />
                        Ganti Password
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex">
          <Link
            href="/dashboard"
            className={`flex-1 flex flex-col items-center py-3 ${
              pathname === '/dashboard' ? 'text-indigo-600' : 'text-gray-500'
            }`}
          >
            <Home className="h-6 w-6" />
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
          <button
            onClick={() => setShowMobileMenu(true)}
            className={`flex-1 flex flex-col items-center py-3 ${
              pathname !== '/dashboard' ? 'text-indigo-600' : 'text-gray-500'
            }`}
          >
            <Menu className="h-6 w-6" />
            <span className="text-xs mt-1">Menu</span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Popup */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-50">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileMenu(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Menu</h3>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMobileMenu(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
              <div className="border-t border-gray-200 mt-2 pt-2">
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowPasswordDialog(true);
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 w-full"
                >
                  <Key className="h-5 w-5" />
                  <span className="font-medium">Ganti Password</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Dialog */}
      {user && (
        <ChangePasswordDialog
          isOpen={showPasswordDialog}
          onClose={() => setShowPasswordDialog(false)}
          userId={user.id}
        />
      )}
    </div>
  );
}
