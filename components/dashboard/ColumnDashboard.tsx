'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { RealtimeChannel } from '@supabase/supabase-js';
import { 
  RefreshCw, 
  Target, 
  FileText, 
  CheckCircle2, 
  Clock, 
  XCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Users,
  MapPin,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Zap,
  X
} from 'lucide-react';
import Link from 'next/link';
import { getPerformanceColor } from './PerformanceBar';
import { getCurrentMonthWITA, getFirstDayOfMonth, getLastDayOfMonth, getTodayWITA } from '@/lib/timezone';

interface PromoterData {
  id: string;
  name: string;
  employeeId: string;
  storeName: string;
  target: number;
  pengajuan: number;
  closing: number;
  pending: number;
  reject: number;
}

interface SatorData {
  satorName: string;
  area: string;
  promoterCount: number;
  target: number;
  pengajuan: number;
  closing: number;
  pending: number;
  reject: number;
  promoters: PromoterData[];
}

interface SPVData {
  area: string;
  spvName?: string;
  satorCount: number;
  promoterCount: number;
  target: number;
  pengajuan: number;
  closing: number;
  pending: number;
  reject: number;
  sators: SatorData[];
}

interface ColumnDashboardProps {
  selectedMonth?: string;
}

interface TargetStatus {
  hasTarget: boolean;
  totalWithTarget: number;
  totalWithoutTarget: number;
}

const areaColors: Record<string, string> = {
  'KUPANG': 'bg-blue-500',
  'KABUPATEN': 'bg-green-500',
  'SUMBA': 'bg-orange-500',
};

export function ColumnDashboard({ selectedMonth }: ColumnDashboardProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [spvDataList, setSpvDataList] = useState<SPVData[]>([]);
  const [totals, setTotals] = useState({
    target: 0,
    pengajuan: 0,
    closing: 0,
    pending: 0,
    reject: 0,
    satorCount: 0,
    promoterCount: 0,
  });
  const [targetStatus, setTargetStatus] = useState<TargetStatus>({
    hasTarget: false,
    totalWithTarget: 0,
    totalWithoutTarget: 0,
  });
  
  // Today stats for Manager Area
  const [todayStats, setTodayStats] = useState({
    pengajuan: 0,
    closing: 0,
    pending: 0,
    reject: 0,
  });

  // Today stats per area (for modal)
  const [todayStatsPerArea, setTodayStatsPerArea] = useState<Record<string, {
    pengajuan: number;
    closing: number;
    pending: number;
    reject: number;
  }>>({});
  const [showTodayModal, setShowTodayModal] = useState(false);

  // Selection states
  const [selectedSPV, setSelectedSPV] = useState<SPVData | null>(null);
  const [selectedSator, setSelectedSator] = useState<SatorData | null>(null);
  
  // Mobile navigation state
  const [mobileView, setMobileView] = useState<'spv' | 'sator' | 'promoter'>('spv');

  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);
  const fetchDataRef = useRef<(isRefresh?: boolean) => Promise<void>>(undefined);

  const currentMonth = selectedMonth || getCurrentMonthWITA();
  const [year, month] = currentMonth.split('-').map(Number);

  const isManagerArea = profile?.role === 'manager_area';
  const isSPVArea = profile?.role === 'spv_area';

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!profile) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const startDate = getFirstDayOfMonth(year, month);
    const endDate = getLastDayOfMonth(year, month);
    const todayDate = getTodayWITA();

    try {
      let promotersQuery = supabase
        .from('promoters')
        .select('id, name, employee_id, sator, area, category, is_active, store_id, stores(name, area_detail)')
        .eq('is_active', true);

      if (isSPVArea && profile.area && profile.area !== 'ALL') {
        promotersQuery = promotersQuery.eq('area', profile.area);
      }

      const [
        { data: promoters },
        { data: sales },
        { data: vastApps },
        { data: spvProfiles },
        { data: targetsData },
        { data: spvTargetsData },
        { data: satorTargetsData },
        { data: satorsData },
        { data: todaySales },
        { data: todayVastApps }
      ] = await Promise.all([
        promotersQuery,
        supabase.from('sales').select('*').is('deleted_at', null).gte('sale_date', startDate).lte('sale_date', endDate),
        supabase.from('vast_finance_applications').select('*').is('deleted_at', null).gte('sale_date', startDate).lte('sale_date', endDate),
        supabase.from('user_profiles').select('*').eq('role', 'spv_area'),
        supabase.from('targets').select('assigned_to_id, target_type, target_value').eq('assigned_to_role', 'promoter').eq('month', currentMonth),
        supabase.from('targets').select('assigned_to_id, target_value').eq('assigned_to_role', 'spv_area').eq('target_type', 'pengajuan').eq('month', currentMonth),
        supabase.from('targets').select('assigned_to_id, target_value').eq('assigned_to_role', 'sator').eq('target_type', 'pengajuan').eq('month', currentMonth),
        supabase.from('sators').select('id, name, area').eq('is_active', true),
        // Today's data with area info
        supabase.from('sales_with_details').select('status, area_detail').eq('sale_date', todayDate),
        supabase.from('vast_finance_applications').select('status_pengajuan, store_id, stores(area_detail)').is('deleted_at', null).eq('sale_date', todayDate)
      ]);

      // Calculate today stats
      if (isManagerArea) {
        let todayPengajuan = 0, todayClosing = 0, todayPending = 0, todayReject = 0;
        
        // Per area stats
        const areaStats: Record<string, { pengajuan: number; closing: number; pending: number; reject: number }> = {
          'KUPANG': { pengajuan: 0, closing: 0, pending: 0, reject: 0 },
          'KABUPATEN': { pengajuan: 0, closing: 0, pending: 0, reject: 0 },
          'SUMBA': { pengajuan: 0, closing: 0, pending: 0, reject: 0 },
        };
        
        // From sales table
        (todaySales || []).forEach((s: any) => {
          todayPengajuan++;
          const area = s.area_detail || 'UNKNOWN';
          if (areaStats[area]) {
            areaStats[area].pengajuan++;
            if (s.status === 'ACC') { todayClosing++; areaStats[area].closing++; }
            else if (s.status === 'Pending') { todayPending++; areaStats[area].pending++; }
            else if (s.status === 'Reject') { todayReject++; areaStats[area].reject++; }
          } else {
            if (s.status === 'ACC') todayClosing++;
            else if (s.status === 'Pending') todayPending++;
            else if (s.status === 'Reject') todayReject++;
          }
        });
        
        // From vast_finance_applications
        (todayVastApps || []).forEach((v: any) => {
          todayPengajuan++;
          const area = v.stores?.area_detail || 'UNKNOWN';
          if (areaStats[area]) {
            areaStats[area].pengajuan++;
            if (v.status_pengajuan === 'ACC') { todayClosing++; areaStats[area].closing++; }
            else if (v.status_pengajuan === 'Dapat limit tapi belum proses') { todayPending++; areaStats[area].pending++; }
            else if (v.status_pengajuan === 'Belum disetujui') { todayReject++; areaStats[area].reject++; }
          } else {
            if (v.status_pengajuan === 'ACC') todayClosing++;
            else if (v.status_pengajuan === 'Dapat limit tapi belum proses') todayPending++;
            else if (v.status_pengajuan === 'Belum disetujui') todayReject++;
          }
        });
        
        setTodayStats({
          pengajuan: todayPengajuan,
          closing: todayClosing,
          pending: todayPending,
          reject: todayReject,
        });
        
        setTodayStatsPerArea(areaStats);
      }

      // Create SPV target lookup (target dari MA untuk SPV)
      const spvTargetMap: Record<string, number> = {};
      (spvTargetsData || []).forEach((t: any) => {
        spvTargetMap[t.assigned_to_id] = t.target_value;
      });

      // Create Sator target lookup (target dari MA untuk Sator)
      const satorTargetMap: Record<string, number> = {};
      (satorTargetsData || []).forEach((t: any) => {
        satorTargetMap[t.assigned_to_id] = t.target_value;
      });

      // Create sator name to ID lookup
      const satorNameToId: Record<string, string> = {};
      const satorIdToData: Record<string, { name: string; area: string }> = {};
      (satorsData || []).forEach((s: any) => {
        satorNameToId[s.name] = s.id;
        satorIdToData[s.id] = { name: s.name, area: s.area };
      });

      // Create lookup map for targets from targets table
      const targetMap: Record<string, { pengajuan: number; closing: number }> = {};
      (targetsData || []).forEach((t: any) => {
        if (!targetMap[t.assigned_to_id]) {
          targetMap[t.assigned_to_id] = { pengajuan: 0, closing: 0 };
        }
        if (t.target_type === 'pengajuan') {
          targetMap[t.assigned_to_id].pengajuan = t.target_value;
        } else if (t.target_type === 'closing') {
          targetMap[t.assigned_to_id].closing = t.target_value;
        }
      });

      // Build promoter performance map
      const promoterPerfMap = new Map<string, PromoterData>();
      
      (promoters || []).forEach((p: any) => {
        const promoterSales = sales?.filter((s: any) => s.promoter_name === p.name) || [];
        const promoterVast = vastApps?.filter((v: any) => v.promoter_name === p.name) || [];
        
        const closing = promoterSales.filter((s: any) => s.status === 'ACC').length + 
                       promoterVast.filter((v: any) => v.status_pengajuan === 'ACC').length;
        const pending = promoterSales.filter((s: any) => s.status === 'Pending').length + 
                       promoterVast.filter((v: any) => v.status_pengajuan === 'Dapat limit tapi belum proses').length;
        const reject = promoterSales.filter((s: any) => s.status === 'Reject').length + 
                      promoterVast.filter((v: any) => v.status_pengajuan === 'Belum disetujui').length;
        const pengajuan = promoterSales.length + promoterVast.length;

        // Use target PENGAJUAN from targets table (bukan closing)
        const targetValue = targetMap[p.id]?.pengajuan || 0;

        promoterPerfMap.set(p.id, {
          id: p.id,
          name: p.name,
          employeeId: p.employee_id || '-',
          storeName: p.stores?.name || '-',
          target: targetValue,
          pengajuan,
          closing,
          pending,
          reject,
        });
      });

      // Group by Sator
      const satorMap = new Map<string, { satorName: string; area: string; promoters: PromoterData[] }>();
      
      (promoters || []).forEach((p: any) => {
        const satorName = p.sator || 'Tanpa Sator';
        const area = p.area || p.stores?.area_detail || 'UNKNOWN';
        
        if (!satorMap.has(satorName)) {
          satorMap.set(satorName, { satorName, area, promoters: [] });
        }
        
        const promoterData = promoterPerfMap.get(p.id);
        if (promoterData) {
          satorMap.get(satorName)!.promoters.push(promoterData);
        }
      });

      // Calculate Sator data
      const satorsDataList: (SatorData & { area: string })[] = [];
      
      satorMap.forEach((data) => {
        const satorPromoters = data.promoters;
        // Get target from MA (satorTargetMap) using sator ID
        const satorId = satorNameToId[data.satorName];
        const targetFromMA = satorId ? satorTargetMap[satorId] || 0 : 0;
        
        const pengajuan = satorPromoters.reduce((sum, p) => sum + p.pengajuan, 0);
        const closing = satorPromoters.reduce((sum, p) => sum + p.closing, 0);
        const pending = satorPromoters.reduce((sum, p) => sum + p.pending, 0);
        const reject = satorPromoters.reduce((sum, p) => sum + p.reject, 0);

        satorsDataList.push({
          satorName: data.satorName,
          area: data.area,
          promoterCount: satorPromoters.length,
          target: targetFromMA, // Use target dari MA
          pengajuan,
          closing,
          pending,
          reject,
          promoters: satorPromoters.sort((a, b) => {
            const pctA = a.target > 0 ? a.pengajuan / a.target : 0;
            const pctB = b.target > 0 ? b.pengajuan / b.target : 0;
            return pctB - pctA;
          }),
        });
      });

      satorsDataList.sort((a, b) => {
        const pctA = a.target > 0 ? a.pengajuan / a.target : 0;
        const pctB = b.target > 0 ? b.pengajuan / b.target : 0;
        return pctB - pctA;
      });

      // Group by SPV Area
      const areas = isManagerArea ? ['KUPANG', 'KABUPATEN', 'SUMBA'] : [profile.area];
      const spvData: SPVData[] = areas.map(area => {
        const areaSators = satorsDataList.filter(s => s.area === area);
        const spvProfile = spvProfiles?.find((sp: any) => sp.area === area);
        
        // Get SPV target from MA
        const spvTargetFromMA = spvProfile ? spvTargetMap[spvProfile.id] || 0 : 0;
        
        const pengajuan = areaSators.reduce((sum, s) => sum + s.pengajuan, 0);
        const closing = areaSators.reduce((sum, s) => sum + s.closing, 0);
        const pending = areaSators.reduce((sum, s) => sum + s.pending, 0);
        const reject = areaSators.reduce((sum, s) => sum + s.reject, 0);
        const promoterCount = areaSators.reduce((sum, s) => sum + s.promoterCount, 0);

        return {
          area,
          spvName: spvProfile?.name,
          satorCount: areaSators.length,
          promoterCount,
          target: spvTargetFromMA, // Use target dari MA untuk SPV
          pengajuan,
          closing,
          pending,
          reject,
          sators: areaSators,
        };
      });

      setSpvDataList(spvData);

      // Auto-select first SPV for SPV role
      if (isSPVArea && spvData.length > 0 && !selectedSPV) {
        setSelectedSPV(spvData[0]);
      }

      setTotals({
        target: spvData.reduce((sum, s) => sum + s.target, 0),
        pengajuan: spvData.reduce((sum, s) => sum + s.pengajuan, 0),
        closing: spvData.reduce((sum, s) => sum + s.closing, 0),
        pending: spvData.reduce((sum, s) => sum + s.pending, 0),
        reject: spvData.reduce((sum, s) => sum + s.reject, 0),
        satorCount: spvData.reduce((sum, s) => sum + s.satorCount, 0),
        promoterCount: spvData.reduce((sum, s) => sum + s.promoterCount, 0),
      });

      // Calculate target status
      const allPromoters = Array.from(promoterPerfMap.values());
      const withTarget = allPromoters.filter(p => p.target > 0).length;
      const withoutTarget = allPromoters.filter(p => p.target === 0).length;
      setTargetStatus({
        hasTarget: withTarget > 0,
        totalWithTarget: withTarget,
        totalWithoutTarget: withoutTarget,
      });

    } catch (err: any) {
      console.error('Error fetching data:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Gagal memuat data');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
        setLastUpdated(new Date());
      }
    }
  }, [profile, currentMonth, isManagerArea, isSPVArea, selectedSPV]);

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    isMountedRef.current = true;
    if (profile) {
      fetchData();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData, profile]);

  useEffect(() => {
    const channel = supabase
      .channel('column-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => fetchDataRef.current?.())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vast_finance_applications' }, () => fetchDataRef.current?.())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promoters' }, () => fetchDataRef.current?.())
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const handleRefresh = () => fetchData(true);

  const handleSelectSPV = (spv: SPVData) => {
    setSelectedSPV(spv);
    setSelectedSator(null);
    setMobileView('sator');
  };

  const handleSelectSator = (sator: SatorData) => {
    setSelectedSator(sator);
    setMobileView('promoter');
  };

  const handleMobileBack = () => {
    if (mobileView === 'promoter') {
      setMobileView('sator');
      setSelectedSator(null);
    } else if (mobileView === 'sator') {
      setMobileView('spv');
      setSelectedSPV(null);
    }
  };

  const overallPercentage = totals.target > 0 ? Math.round((totals.pengajuan / totals.target) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-600">{error}</p>
        <button onClick={handleRefresh} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          Coba Lagi
        </button>
      </div>
    );
  }

  // Render metric badge
  const MetricBadge = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );

  // SPV Column Item
  const SPVItem = ({ spv, isSelected }: { spv: SPVData; isSelected: boolean }) => {
    const pct = spv.target > 0 ? Math.round((spv.pengajuan / spv.target) * 100) : 0;
    const colors = getPerformanceColor(pct);
    
    return (
      <button
        onClick={() => handleSelectSPV(spv)}
        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
          isSelected 
            ? 'border-indigo-500 bg-indigo-50 shadow-md' 
            : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-3 h-3 rounded-full ${areaColors[spv.area] || 'bg-gray-400'}`} />
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">{spv.area}</h3>
            {spv.spvName && <p className="text-xs text-gray-500">{spv.spvName}</p>}
          </div>
          <span className={`px-2 py-1 rounded-full text-sm font-bold ${colors.badge}`}>
            {pct}%
          </span>
        </div>
        
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div className={`h-full ${colors.bg} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{spv.satorCount} Sator</span>
          <span>{spv.promoterCount} Promoter</span>
        </div>
        
        <div className="grid grid-cols-5 gap-1 mt-3 pt-3 border-t border-gray-100">
          <MetricBadge label="Target" value={spv.target} color="text-purple-600" />
          <MetricBadge label="Ajuan" value={spv.pengajuan} color="text-indigo-600" />
          <MetricBadge label="Close" value={spv.closing} color="text-green-600" />
          <MetricBadge label="Pend" value={spv.pending} color="text-amber-600" />
          <MetricBadge label="Rej" value={spv.reject} color="text-red-600" />
        </div>
        
        {isSelected && (
          <div className="flex justify-end mt-2">
            <ChevronRight className="h-5 w-5 text-indigo-500" />
          </div>
        )}
      </button>
    );
  };

  // Sator Column Item
  const SatorItem = ({ sator, isSelected }: { sator: SatorData; isSelected: boolean }) => {
    const pct = sator.target > 0 ? Math.round((sator.pengajuan / sator.target) * 100) : 0;
    const colors = getPerformanceColor(pct);
    
    return (
      <button
        onClick={() => handleSelectSator(sator)}
        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
          isSelected 
            ? 'border-indigo-500 bg-indigo-50 shadow-md' 
            : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-gray-900">{sator.satorName}</h3>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Users className="h-3 w-3" />
              {sator.promoterCount} promoter
            </p>
          </div>
          <span className={`px-2 py-1 rounded-full text-sm font-bold ${colors.badge}`}>
            {pct}%
          </span>
        </div>
        
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div className={`h-full ${colors.bg} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        
        <div className="grid grid-cols-5 gap-1 text-center">
          <MetricBadge label="Target" value={sator.target} color="text-purple-600" />
          <MetricBadge label="Ajuan" value={sator.pengajuan} color="text-indigo-600" />
          <MetricBadge label="Close" value={sator.closing} color="text-green-600" />
          <MetricBadge label="Pend" value={sator.pending} color="text-amber-600" />
          <MetricBadge label="Rej" value={sator.reject} color="text-red-600" />
        </div>
        
        {isSelected && (
          <div className="flex justify-end mt-2">
            <ChevronRight className="h-5 w-5 text-indigo-500" />
          </div>
        )}
      </button>
    );
  };

  // Promoter List Item
  const PromoterItem = ({ promoter, index }: { promoter: PromoterData; index: number }) => {
    const pct = promoter.target > 0 ? Math.round((promoter.pengajuan / promoter.target) * 100) : 0;
    const colors = getPerformanceColor(pct);
    
    return (
      <div className="p-3 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-all">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-400 mt-1">{index + 1}.</span>
            <div>
              <h4 className="font-medium text-gray-900">{promoter.name}</h4>
              <p className="text-xs text-gray-500">{promoter.storeName}</p>
            </div>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors.badge}`}>
            {pct}%
          </span>
        </div>
        
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className={`h-full ${colors.bg} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        
        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          <div>
            <p className="font-semibold text-purple-600">{promoter.target}</p>
            <p className="text-gray-400">Target</p>
          </div>
          <div>
            <p className="font-semibold text-indigo-600">{promoter.pengajuan}</p>
            <p className="text-gray-400">Ajuan</p>
          </div>
          <div>
            <p className="font-semibold text-green-600">{promoter.closing}</p>
            <p className="text-gray-400">Close</p>
          </div>
          <div>
            <p className="font-semibold text-amber-600">{promoter.pending}</p>
            <p className="text-gray-400">Pend</p>
          </div>
          <div>
            <p className="font-semibold text-red-600">{promoter.reject}</p>
            <p className="text-gray-400">Rej</p>
          </div>
        </div>
      </div>
    );
  };

  const todayDapatLimit = todayStats.closing + todayStats.pending;

  return (
    <div className="space-y-4">
      {/* Stats Row - Today + Month */}
      {isManagerArea && (
        <div className="space-y-3">
          {/* Month Info + Refresh */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </p>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Today Stats - Clickable */}
            <button
              onClick={() => setShowTodayModal(true)}
              className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white text-left hover:from-blue-600 hover:to-blue-700 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span className="font-medium text-sm">Hari Ini</span>
                </div>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded">{getTodayWITA()}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold">{todayStats.pengajuan}</p>
                  <p className="text-xs text-blue-100">Pengajuan</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{todayDapatLimit}</p>
                  <p className="text-xs text-blue-100">Dapat Limit</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{todayStats.closing}</p>
                  <p className="text-xs text-blue-100">Closing</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{todayStats.reject}</p>
                  <p className="text-xs text-blue-100">Reject</p>
                </div>
              </div>
              <p className="text-xs text-blue-200 mt-2 text-center">Klik untuk detail per area</p>
            </button>

            {/* Month Stats */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium text-sm">Bulan Ini</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  overallPercentage >= 80 ? 'bg-green-400/30' :
                  overallPercentage >= 50 ? 'bg-yellow-400/30' : 'bg-red-400/30'
                }`}>{overallPercentage}%</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold">{totals.pengajuan}</p>
                  <p className="text-xs text-indigo-100">Pengajuan</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals.closing + totals.pending}</p>
                  <p className="text-xs text-indigo-100">Dapat Limit</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals.closing}</p>
                  <p className="text-xs text-indigo-100">Closing</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals.reject}</p>
                  <p className="text-xs text-indigo-100">Reject</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SPV Only - Month Stats */}
      {isSPVArea && (
        <div className="space-y-3">
          {/* Month Info + Refresh */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </p>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
          
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <span className="font-medium text-sm">Target Bulan Ini</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                overallPercentage >= 80 ? 'bg-green-400/30' :
                overallPercentage >= 50 ? 'bg-yellow-400/30' : 'bg-red-400/30'
              }`}>{overallPercentage}%</span>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center">
              <div>
                <p className="text-xl font-bold">{totals.target}</p>
                <p className="text-xs text-indigo-100">Target</p>
              </div>
              <div>
                <p className="text-xl font-bold">{totals.pengajuan}</p>
                <p className="text-xs text-indigo-100">Pengajuan</p>
              </div>
              <div>
                <p className="text-xl font-bold">{totals.closing}</p>
                <p className="text-xs text-indigo-100">Closing</p>
              </div>
              <div>
                <p className="text-xl font-bold">{totals.pending}</p>
                <p className="text-xs text-indigo-100">Pending</p>
              </div>
              <div>
                <p className="text-xl font-bold">{totals.reject}</p>
                <p className="text-xs text-indigo-100">Reject</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Target Status - Compact */}
      {targetStatus.totalWithoutTarget > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-800">
              <strong>{targetStatus.totalWithoutTarget}</strong> promoter belum ada target
            </span>
          </div>
          {isSPVArea && (
            <Link href="/dashboard/targets" className="text-xs px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700">
              Set Target
            </Link>
          )}
        </div>
      )}

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        {mobileView !== 'spv' && (
          <button onClick={handleMobileBack} className="flex items-center gap-1 text-indigo-600 text-sm font-medium mb-2">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>
        )}
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
          <span className={mobileView === 'spv' ? 'text-indigo-600 font-medium' : ''}>Area</span>
          {selectedSPV && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className={mobileView === 'sator' ? 'text-indigo-600 font-medium' : ''}>{selectedSPV.area}</span>
            </>
          )}
          {selectedSator && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className={mobileView === 'promoter' ? 'text-indigo-600 font-medium' : ''}>{selectedSator.satorName}</span>
            </>
          )}
        </div>
      </div>

      {/* Desktop: 3 Column Layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-3">
        {/* Column 1: SPV Areas */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-indigo-600" />
              <span className="font-medium text-gray-700 text-sm">Area SPV</span>
            </div>
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{spvDataList.length}</span>
          </div>
          <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
            {spvDataList.map((spv) => (
              <SPVItem key={spv.area} spv={spv} isSelected={selectedSPV?.area === spv.area} />
            ))}
          </div>
        </div>

        {/* Column 2: Sators */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              <span className="font-medium text-gray-700 text-sm">Sator</span>
              {selectedSPV && <span className="text-xs text-gray-400">- {selectedSPV.area}</span>}
            </div>
            {selectedSPV && <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{selectedSPV.sators.length}</span>}
          </div>
          <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
            {!selectedSPV ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <ChevronLeft className="h-6 w-6 mb-1" />
                <p className="text-xs">Pilih Area</p>
              </div>
            ) : selectedSPV.sators.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Tidak ada sator</p>
            ) : (
              selectedSPV.sators.map((sator) => (
                <SatorItem key={sator.satorName} sator={sator} isSelected={selectedSator?.satorName === sator.satorName} />
              ))
            )}
          </div>
        </div>

        {/* Column 3: Promoters */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              <span className="font-medium text-gray-700 text-sm">Promoter</span>
              {selectedSator && <span className="text-xs text-gray-400">- {selectedSator.satorName}</span>}
            </div>
            {selectedSator && <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{selectedSator.promoters.length}</span>}
          </div>
          <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
            {!selectedSator ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <ChevronLeft className="h-6 w-6 mb-1" />
                <p className="text-xs">Pilih Sator</p>
              </div>
            ) : selectedSator.promoters.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Tidak ada promoter</p>
            ) : (
              selectedSator.promoters.map((promoter, idx) => (
                <PromoterItem key={promoter.id} promoter={promoter} index={idx} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mobile: Single Column */}
      <div className="lg:hidden space-y-2">
        {mobileView === 'spv' && spvDataList.map((spv) => (
          <SPVItem key={spv.area} spv={spv} isSelected={false} />
        ))}
        {mobileView === 'sator' && selectedSPV?.sators.map((sator) => (
          <SatorItem key={sator.satorName} sator={sator} isSelected={false} />
        ))}
        {mobileView === 'promoter' && selectedSator?.promoters.map((promoter, idx) => (
          <PromoterItem key={promoter.id} promoter={promoter} index={idx} />
        ))}
      </div>

      {/* Today Detail Modal */}
      {showTodayModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900">Detail Hari Ini</h3>
                <p className="text-sm text-gray-500">{getTodayWITA()}</p>
              </div>
              <button
                onClick={() => setShowTodayModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-3">
              {/* Kupang */}
              {(() => {
                const stats = todayStatsPerArea['KUPANG'] || { pengajuan: 0, closing: 0, pending: 0, reject: 0 };
                const dapatLimit = stats.closing + stats.pending;
                return (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-blue-700">KUPANG</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {stats.pengajuan} pengajuan
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-blue-600">{stats.pengajuan}</p>
                        <p className="text-xs text-gray-500">Pengajuan</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-indigo-600">{dapatLimit}</p>
                        <p className="text-xs text-gray-500">Dapat Limit</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-600">{stats.closing}</p>
                        <p className="text-xs text-gray-500">Closing</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">{stats.reject}</p>
                        <p className="text-xs text-gray-500">Reject</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Kabupaten */}
              {(() => {
                const stats = todayStatsPerArea['KABUPATEN'] || { pengajuan: 0, closing: 0, pending: 0, reject: 0 };
                const dapatLimit = stats.closing + stats.pending;
                return (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-green-700">KABUPATEN</span>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {stats.pengajuan} pengajuan
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-green-600">{stats.pengajuan}</p>
                        <p className="text-xs text-gray-500">Pengajuan</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-indigo-600">{dapatLimit}</p>
                        <p className="text-xs text-gray-500">Dapat Limit</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-emerald-600">{stats.closing}</p>
                        <p className="text-xs text-gray-500">Closing</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">{stats.reject}</p>
                        <p className="text-xs text-gray-500">Reject</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Sumba */}
              {(() => {
                const stats = todayStatsPerArea['SUMBA'] || { pengajuan: 0, closing: 0, pending: 0, reject: 0 };
                const dapatLimit = stats.closing + stats.pending;
                return (
                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-orange-700">SUMBA</span>
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                        {stats.pengajuan} pengajuan
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-orange-600">{stats.pengajuan}</p>
                        <p className="text-xs text-gray-500">Pengajuan</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-indigo-600">{dapatLimit}</p>
                        <p className="text-xs text-gray-500">Dapat Limit</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-600">{stats.closing}</p>
                        <p className="text-xs text-gray-500">Closing</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">{stats.reject}</p>
                        <p className="text-xs text-gray-500">Reject</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Total */}
              <div className="bg-gray-100 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-700">TOTAL</span>
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                    {todayStats.pengajuan} pengajuan
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-gray-700">{todayStats.pengajuan}</p>
                    <p className="text-xs text-gray-500">Pengajuan</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-indigo-600">{todayDapatLimit}</p>
                    <p className="text-xs text-gray-500">Dapat Limit</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{todayStats.closing}</p>
                    <p className="text-xs text-gray-500">Closing</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-600">{todayStats.reject}</p>
                    <p className="text-xs text-gray-500">Reject</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowTodayModal(false)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
