'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  getTodayWITA, 
  getFirstDayOfMonthWITA, 
  getCurrentMonthWITA
} from '@/lib/timezone';
import { useAuth, getAccessibleAreas } from '@/lib/auth-context';
import { 
  TrendingUp,
  CheckCircle,
  RefreshCw,
  Calendar,
  Zap,
  Target,
  X,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';

interface PeriodStats {
  total: number;
  closing: number;
  pending: number;
  reject: number;
}

interface TodayActivity {
  id: string;
  name: string;
  status: string;
  promoter: string;
  store: string;
  time: string;
  source: 'sales' | 'vast';
}

type SalesStatus = 'ACC' | 'Pending' | 'Reject';
type VastStatus = 'ACC' | 'Belum disetujui' | 'Dapat limit tapi belum proses';

interface SalesWithDetailsRow {
  id: string;
  status: SalesStatus;
  promoter_name: string | null;
  store_name: string | null;
  area_detail: string | null;
  created_at: string;
}

interface VastStore {
  name: string | null;
  area_detail: string | null;
}

interface VastApplicationRow {
  id: string;
  status_pengajuan: VastStatus;
  promoter_name: string | null;
  customer_name: string | null;
  stores: VastStore | null;
  sale_date: string | null;
  created_at: string;
}

interface TargetRow {
  target_value: number | null;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayStats, setTodayStats] = useState<PeriodStats>({ total: 0, closing: 0, pending: 0, reject: 0 });
  const [monthStats, setMonthStats] = useState<PeriodStats>({ total: 0, closing: 0, pending: 0, reject: 0 });
  const [monthTarget, setMonthTarget] = useState(0);
  const [todayActivities, setTodayActivities] = useState<TodayActivity[]>([]);
  const [showTodayModal, setShowTodayModal] = useState(false);

  const currentMonth = getCurrentMonthWITA();
  const [year, month] = currentMonth.split('-').map(Number);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!profile) return;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const todayStr = getTodayWITA();
    const monthStartStr = getFirstDayOfMonthWITA();
    const accessibleAreas = getAccessibleAreas(profile);

    try {
      // Get promoter names and IDs for sator role
      let promoterNames: string[] = [];
      
      if (profile.role === 'sator' && profile.sator_name) {
        const { data: promoters } = await supabase
          .from('promoters')
          .select('id, name')
          .eq('sator', profile.sator_name);
        promoterNames = promoters?.map(p => p.name) || [];
      }

      // Build base query filters
      const buildFilters = (query: PostgrestFilterBuilder<any, any, any, any>) => {
        if (profile.role === 'spv_area' && profile.area && profile.area !== 'ALL') {
          return query.eq('area_detail', profile.area);
        } else if (profile.role === 'sator' && promoterNames.length > 0) {
          return query.in('promoter_name', promoterNames);
        } else if (profile.role !== 'super_admin' && profile.role !== 'manager_area') {
          if (accessibleAreas.length === 1) {
            return query.eq('area_detail', accessibleAreas[0]);
          } else if (accessibleAreas.length > 1) {
            return query.in('area_detail', accessibleAreas);
          }
        }
        return query;
      };

      // Build target query based on role
      // MA: total target yang dibagikan ke SPV
      // SPV: target yang diberikan MA kepada SPV tersebut
      // Sator: target yang diberikan MA kepada Sator tersebut
      let targetQuery = supabase
        .from('targets')
        .select('target_value')
        .eq('target_type', 'pengajuan')
        .eq('month', currentMonth);

      if (profile.role === 'manager_area' || profile.role === 'super_admin') {
        // MA: Sum of all SPV targets
        targetQuery = targetQuery.eq('assigned_to_role', 'spv_area');
      } else if (profile.role === 'spv_area') {
        // SPV: Their own target from MA
        targetQuery = targetQuery.eq('assigned_to_role', 'spv_area').eq('assigned_to_id', profile.id);
      } else if (profile.role === 'sator') {
        // Sator: Their own target from MA
        targetQuery = targetQuery.eq('assigned_to_role', 'sator').eq('assigned_to_id', profile.id);
      }

      // Fetch all data in parallel
      const [
        salesTodayResult,
        salesMonthResult,
        vastTodayResult,
        vastMonthResult,
        targetResult,
        todaySalesDetailResult,
        todayVastDetailResult
      ] = await Promise.all([
        buildFilters(supabase.from('sales_with_details').select('status').eq('sale_date', todayStr)),
        buildFilters(supabase.from('sales_with_details').select('status').gte('sale_date', monthStartStr).lte('sale_date', todayStr)),
        supabase.from('vast_finance_applications').select('status_pengajuan, stores(area_detail), promoter_name').is('deleted_at', null).eq('sale_date', todayStr),
        supabase.from('vast_finance_applications').select('status_pengajuan, stores(area_detail), promoter_name').is('deleted_at', null).gte('sale_date', monthStartStr).lte('sale_date', todayStr),
        targetQuery,
        buildFilters(supabase.from('sales_with_details').select('id, status, promoter_name, store_name, area_detail, created_at').eq('sale_date', todayStr).order('created_at', { ascending: false })),
        supabase.from('vast_finance_applications').select('id, customer_name, status_pengajuan, promoter_name, stores(name, area_detail), created_at').is('deleted_at', null).eq('sale_date', todayStr).order('created_at', { ascending: false }),
      ]);

      // Filter vast data by access
      const filterVast = (data: VastApplicationRow[]) => {
        if (!data) return [];
        if (profile.role === 'super_admin' || profile.role === 'manager_area') return data;
        if (profile.role === 'spv_area' && profile.area && profile.area !== 'ALL') {
          return data.filter(v => v.stores?.area_detail === profile.area);
        }
        if (profile.role === 'sator' && promoterNames.length > 0) {
          return data.filter(v => v.promoter_name && promoterNames.includes(v.promoter_name));
        }
        return data.filter(v => accessibleAreas.includes(v.stores?.area_detail || ''));
      };

      // Calculate stats
      const calcStats = (sales: SalesWithDetailsRow[], vast: VastApplicationRow[]): PeriodStats => {
        const salesClosing = sales.filter(s => s.status === 'ACC').length;
        const salesPending = sales.filter(s => s.status === 'Pending').length;
        const salesReject = sales.filter(s => s.status === 'Reject').length;
        
        const vastClosing = vast.filter(v => v.status_pengajuan === 'ACC').length;
        const vastPending = vast.filter(v => v.status_pengajuan === 'Dapat limit tapi belum proses').length;
        const vastReject = vast.filter(v => v.status_pengajuan === 'Belum disetujui').length;

        return {
          total: sales.length + vast.length,
          closing: salesClosing + vastClosing,
          pending: salesPending + vastPending,
          reject: salesReject + vastReject,
        };
      };

      const filteredVastToday = filterVast((vastTodayResult.data || []) as VastApplicationRow[]);
      const filteredVastMonth = filterVast((vastMonthResult.data || []) as VastApplicationRow[]);

      setTodayStats(calcStats((salesTodayResult.data || []) as SalesWithDetailsRow[], filteredVastToday));
      setMonthStats(calcStats((salesMonthResult.data || []) as SalesWithDetailsRow[], filteredVastMonth));

      // Calculate total target
      const totalTarget = (targetResult.data || []).reduce((sum: number, t: TargetRow) => sum + (t.target_value || 0), 0);
      setMonthTarget(totalTarget);

      // Today's activities with WITA time
      const salesActivities: TodayActivity[] = ((todaySalesDetailResult.data || []) as SalesWithDetailsRow[]).map((s) => {
        const createdAt = new Date(s.created_at);
        const witaTime = new Date(createdAt.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
        return {
          id: s.id,
          name: s.promoter_name || '-', // Use promoter name as identifier since customer_name not in view
          status: s.status,
          promoter: s.promoter_name || '-',
          store: s.store_name || '-',
          time: witaTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA',
          source: 'sales' as const,
        };
      });

      const filteredVastDetail = filterVast((todayVastDetailResult.data || []) as VastApplicationRow[]);
      const vastActivities: TodayActivity[] = filteredVastDetail.map((v) => {
        const createdAt = new Date(v.created_at);
        const witaTime = new Date(createdAt.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
        return {
          id: v.id,
          name: v.customer_name || '-',
          status: v.status_pengajuan,
          promoter: v.promoter_name || '-',
          store: v.stores?.name || '-',
          time: witaTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA',
          source: 'vast' as const,
        };
      });

      // Combine and sort by time (newest first)
      const allActivities = [...salesActivities, ...vastActivities].sort((a, b) => {
        return b.time.localeCompare(a.time);
      });
      setTodayActivities(allActivities);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, currentMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusColor = (status: string) => {
    if (status === 'ACC') return 'bg-green-500';
    if (status === 'Belum disetujui' || status === 'Reject') return 'bg-red-500';
    return 'bg-amber-500';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'ACC') return 'Closing';
    if (status === 'Belum disetujui' || status === 'Reject') return 'Reject';
    return 'Pending';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'ACC') return 'bg-green-100 text-green-700';
    if (status === 'Belum disetujui' || status === 'Reject') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const monthProgress = monthTarget > 0 ? Math.round((monthStats.total / monthTarget) * 100) : 0;
  const monthClosingRate = monthStats.total > 0 ? Math.round((monthStats.closing / monthStats.total) * 100) : 0;

  return (
    <div className="space-y-3 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            Halo, {profile?.name?.split(' ')[0]}!
          </h1>
          <p className="text-xs text-gray-500 font-medium">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Today Stats Card - Clickable */}
      <button
        onClick={() => setShowTodayModal(true)}
        className="w-full text-left bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-3.5 shadow-lg text-white hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl transition-all active:scale-[0.98]"
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Zap className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm">Hari Ini</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-white/20 px-2 py-1 rounded-md font-medium">{getTodayWITA()}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className="bg-white/15 backdrop-blur-sm rounded-lg p-2.5">
            <p className="text-xl font-bold mb-0.5">{todayStats.total}</p>
            <p className="text-[10px] text-blue-100 font-medium">Pengajuan</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-lg p-2.5">
            <p className="text-xl font-bold mb-0.5">{todayStats.closing}</p>
            <p className="text-[10px] text-blue-100 font-medium">Closing</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-lg p-2.5">
            <p className="text-xl font-bold mb-0.5">{todayStats.pending}</p>
            <p className="text-[10px] text-blue-100 font-medium">Pending</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-lg p-2.5">
            <p className="text-xl font-bold mb-0.5">{todayStats.reject}</p>
            <p className="text-[10px] text-blue-100 font-medium">Reject</p>
          </div>
        </div>
      </button>

      {/* Month Stats Card - Clickable to Rekap */}
      <Link
        href="/dashboard/rekap"
        className="block bg-white rounded-2xl border border-gray-200 shadow-sm p-3.5 hover:border-indigo-300 hover:shadow-md transition-all active:scale-[0.99]"
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 rounded-lg">
              <Calendar className="h-4 w-4 text-indigo-600" />
            </div>
            <span className="font-semibold text-sm text-gray-900">
              {new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </div>

        {/* Target Progress */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-2.5 mb-2.5 border border-purple-100">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-purple-600" />
              <span className="text-xs font-medium text-purple-800">Target Bulan Ini</span>
            </div>
            <span className="text-xs font-bold text-purple-700">{monthStats.total}/{monthTarget}</span>
          </div>
          <div className="h-2 bg-purple-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${monthProgress >= 100 ? 'bg-green-500' : monthProgress >= 75 ? 'bg-blue-500' : monthProgress >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(monthProgress, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-purple-600 mt-1 text-right font-medium">{monthProgress}% tercapai</p>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <div className="text-center p-2 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-lg font-bold text-gray-900">{monthStats.total}</p>
            <p className="text-[10px] text-gray-600 font-medium">Pengajuan</p>
          </div>
          <div className="text-center p-2 bg-green-50 rounded-lg border border-green-100">
            <p className="text-lg font-bold text-green-600">{monthStats.closing}</p>
            <p className="text-[10px] text-green-700 font-medium">Closing</p>
          </div>
          <div className="text-center p-2 bg-amber-50 rounded-lg border border-amber-100">
            <p className="text-lg font-bold text-amber-600">{monthStats.pending}</p>
            <p className="text-[10px] text-amber-700 font-medium">Pending</p>
          </div>
          <div className="text-center p-2 bg-red-50 rounded-lg border border-red-100">
            <p className="text-lg font-bold text-red-600">{monthStats.reject}</p>
            <p className="text-[10px] text-red-700 font-medium">Reject</p>
          </div>
        </div>

        {monthStats.total > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 font-medium">Closing Rate</span>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">{monthClosingRate}%</span>
            </div>
          </div>
        )}
      </Link>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-3.5 shadow-md">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="p-1 bg-white/20 rounded-lg">
              <TrendingUp className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-white">Dapat Limit</span>
          </div>
          <p className="text-2xl font-bold text-white mb-0.5">{monthStats.closing + monthStats.pending}</p>
          <p className="text-[10px] text-emerald-100 font-medium">Bulan ini</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-3.5 shadow-md">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="p-1 bg-white/20 rounded-lg">
              <CheckCircle className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-white">Total Closing</span>
          </div>
          <p className="text-2xl font-bold text-white mb-0.5">{monthStats.closing}</p>
          <p className="text-[10px] text-purple-100 font-medium">Bulan ini</p>
        </div>
      </div>

      {/* Today Modal */}
      {showTodayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-base">Aktivitas Hari Ini</h3>
                  <p className="text-xs text-blue-100">{getTodayWITA()} (WITA)</p>
                </div>
                <button
                  onClick={() => setShowTodayModal(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-4 gap-1.5 text-center">
                <div className="bg-white/15 backdrop-blur-sm rounded-lg py-2">
                  <p className="font-bold text-sm">{todayStats.total}</p>
                  <p className="text-[10px] text-blue-100 font-medium">Total</p>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-lg py-2">
                  <p className="font-bold text-sm">{todayStats.closing}</p>
                  <p className="text-[10px] text-blue-100 font-medium">Closing</p>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-lg py-2">
                  <p className="font-bold text-sm">{todayStats.pending}</p>
                  <p className="text-[10px] text-blue-100 font-medium">Pending</p>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-lg py-2">
                  <p className="font-bold text-sm">{todayStats.reject}</p>
                  <p className="text-[10px] text-blue-100 font-medium">Reject</p>
                </div>
              </div>
            </div>

            {/* Activity List */}
            <div className="overflow-y-auto max-h-[60vh]">
              {todayActivities.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-3">
                    <Zap className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Belum ada aktivitas hari ini</p>
                  <p className="text-xs text-gray-400 mt-1">Data akan muncul setelah ada pengajuan</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {todayActivities.map((activity) => (
                    <div key={`${activity.source}-${activity.id}`} className="p-3 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                      <div className="flex items-start gap-2.5">
                        <div className={`w-9 h-9 rounded-full ${getStatusColor(activity.status)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm`}>
                          {activity.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-1">
                            <p className="font-semibold text-gray-900 text-sm truncate flex-1">{activity.name}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${getStatusBadge(activity.status)}`}>
                              {getStatusLabel(activity.status)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 font-medium">{activity.promoter}</p>
                          <p className="text-xs text-gray-400">{activity.store}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] font-semibold text-gray-600 mb-1">{activity.time}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${activity.source === 'vast' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {activity.source === 'vast' ? 'VAST' : 'SPC'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
