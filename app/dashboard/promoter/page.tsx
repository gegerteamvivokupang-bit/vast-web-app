'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { getCurrentMonthWITA, getFirstDayOfMonthWITA } from '@/lib/timezone';
import {
  User,
  Target,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  LogOut,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

interface PromoterSession {
  user_id: string;
  name: string;
  area: string;
  employee_id: string;
  role: string;
}

interface Stats {
  target: number;
  total: number;
  closing: number;
  pending: number;
  reject: number;
}

interface RecentSale {
  id: string;
  sale_date: string;
  status: string;
  phone_type: string;
  store_name: string;
  created_at: string;
}

export default function PromoterDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<PromoterSession | null>(null);
  const [stats, setStats] = useState<Stats>({
    target: 0,
    total: 0,
    closing: 0,
    pending: 0,
    reject: 0,
  });
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check session
    const sessionData = localStorage.getItem('promoter_session');
    if (!sessionData) {
      router.replace('/login');
      return;
    }

    const parsedSession = JSON.parse(sessionData);
    setSession(parsedSession);

    // Fetch data
    fetchStats(parsedSession.user_id);
    fetchRecentSales(parsedSession.user_id);
  }, [router]);

  const fetchStats = async (userId: string) => {
    try {
      // Get promoter info (only need id for target lookup)
      const { data: promoter } = await supabase
        .from('promoters')
        .select('id')
        .eq('user_id', userId)
        .single();

      // Get target from targets table ONLY (no fallback)
      const currentMonth = getCurrentMonthWITA();
      let targetValue = 0;
      
      if (promoter?.id) {
        const { data: targetData } = await supabase
          .from('targets')
          .select('target_value')
          .eq('assigned_to_id', promoter.id)
          .eq('assigned_to_role', 'promoter')
          .eq('month', currentMonth)
          .eq('target_type', 'pengajuan')
          .single();
        
        if (targetData?.target_value) {
          targetValue = targetData.target_value;
        }
      }

      // Get sales stats for current month (WITA timezone)
      const startOfMonth = getFirstDayOfMonthWITA();

      const { data: sales } = await supabase
        .from('sales')
        .select('status')
        .eq('created_by_user_id', userId)
        .gte('sale_date', startOfMonth)
        .is('deleted_at', null);

      const total = sales?.length || 0;
      const closing = sales?.filter((s) => s.status === 'ACC').length || 0;
      const pending = sales?.filter((s) => s.status === 'Pending').length || 0;
      const reject = sales?.filter((s) => s.status === 'Reject').length || 0;

      setStats({
        target: targetValue,
        total,
        closing,
        pending,
        reject,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentSales = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('sales')
        .select(
          `
          id,
          sale_date,
          status,
          phone_type,
          created_at,
          stores (
            name
          )
        `
        )
        .eq('created_by_user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentSales(
        data?.map((sale: any) => ({
          ...sale,
          store_name: sale.stores?.name || '-',
        })) || []
      );
    } catch (error) {
      console.error('Error fetching recent sales:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('promoter_session');
    router.replace('/login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACC':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'Pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Reject':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const progressPercentage = stats.target > 0 ? (stats.total / stats.target) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-md">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <User size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold">{session?.name}</h1>
                <p className="text-sm text-blue-100">{session?.employee_id}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 pb-20">
        {/* Target Not Set Warning */}
        {stats.target === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex items-center gap-3">
            <div className="bg-amber-100 rounded-full p-2">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-amber-800">Target Belum Di-set</p>
              <p className="text-sm text-amber-600">Hubungi SPV untuk setting target bulan ini</p>
            </div>
          </div>
        )}

        {/* Target Progress */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Target size={20} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">Target Bulan Ini</h2>
          </div>
          {stats.target > 0 ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-gray-900">
                  {stats.total} / {stats.target}
                </span>
                <span className="text-sm text-gray-600">
                  {progressPercentage.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    progressPercentage >= 100
                      ? 'bg-green-500'
                      : progressPercentage >= 75
                      ? 'bg-blue-500'
                      : progressPercentage >= 50
                      ? 'bg-yellow-500'
                      : 'bg-orange-500'
                  }`}
                  style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500">Target belum di-set oleh SPV</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total} pengajuan</p>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Closing */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col items-center text-center">
              <div className="bg-green-50 p-2 rounded-full mb-2">
                <CheckCircle size={20} className="text-green-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.closing}</div>
              <div className="text-xs text-gray-600">Closing</div>
            </div>
          </div>

          {/* Pending */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col items-center text-center">
              <div className="bg-yellow-50 p-2 rounded-full mb-2">
                <Clock size={20} className="text-yellow-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.pending}</div>
              <div className="text-xs text-gray-600">Pending</div>
            </div>
          </div>

          {/* Reject */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col items-center text-center">
              <div className="bg-red-50 p-2 rounded-full mb-2">
                <XCircle size={20} className="text-red-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.reject}</div>
              <div className="text-xs text-gray-600">Reject</div>
            </div>
          </div>
        </div>

        {/* Recent Sales */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Riwayat Pengajuan</h2>
          {recentSales.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Belum ada pengajuan</p>
          ) : (
            <div className="space-y-2">
              {recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{sale.phone_type || '-'}</p>
                      <p className="text-sm text-gray-600">{sale.store_name}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                        sale.status
                      )}`}
                    >
                      {sale.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar size={12} />
                    {new Date(sale.sale_date).toLocaleDateString('id-ID')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => router.push('/promoter/vast-finance')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg font-semibold rounded-xl shadow-lg flex items-center justify-center gap-2"
          >
            <Plus size={24} />
            Input Pengajuan Baru
          </Button>
        </div>
      </div>
    </div>
  );
}
