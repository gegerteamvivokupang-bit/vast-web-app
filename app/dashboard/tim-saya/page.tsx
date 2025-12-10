'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { 
  Users, 
  Target, 
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MapPin,
  User
} from 'lucide-react';
import { getCurrentMonthWITA, getFirstDayOfMonth, getLastDayOfMonth } from '@/lib/timezone';

interface PromoterData {
  id: string;
  name: string;
  employeeId: string;
  storeName: string;
  target: number;
  pengajuan: number;
  closing: number;
}

interface SatorData {
  id: string;
  name: string;
  target: number;
  pengajuan: number;
  closing: number;
  promoterCount: number;
  promoters: PromoterData[];
}

interface AreaData {
  area: string;
  spvName: string;
  target: number;
  pengajuan: number;
  closing: number;
  satorCount: number;
  promoterCount: number;
  sators: SatorData[];
}

export default function TimSayaPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [expandedSators, setExpandedSators] = useState<Set<string>>(new Set());
  
  const [areas, setAreas] = useState<AreaData[]>([]);
  const [totals, setTotals] = useState({
    target: 0,
    pengajuan: 0,
    closing: 0,
    satorCount: 0,
    promoterCount: 0,
  });

  const currentMonth = getCurrentMonthWITA();
  const [year, month] = currentMonth.split('-').map(Number);

  const isManagerArea = profile?.role === 'manager_area';
  const isSPVArea = profile?.role === 'spv_area';
  const isSator = profile?.role === 'sator';

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!profile) return;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const startDate = getFirstDayOfMonth(year, month);
    const endDate = getLastDayOfMonth(year, month);

    try {
      // Build promoters query based on role
      let promotersQuery = supabase
        .from('promoters')
        .select('id, name, employee_id, sator, sator_id, area, store_id, stores(name, area_detail)')
        .eq('is_active', true);

      // Filter by area for SPV
      if (isSPVArea && profile.area && profile.area !== 'ALL') {
        promotersQuery = promotersQuery.eq('area', profile.area);
      }
      
      // Filter by sator for sator role
      if (isSator && profile.sator_name) {
        promotersQuery = promotersQuery.eq('sator', profile.sator_name);
      }

      // Fetch all data in parallel
      const [
        promotersResult, 
        salesResult, 
        vastResult, 
        targetsResult, 
        satorTargetsResult, 
        satorsResult,
        spvProfilesResult
      ] = await Promise.all([
        promotersQuery,
        supabase.from('sales').select('promoter_name, status').is('deleted_at', null).gte('sale_date', startDate).lte('sale_date', endDate),
        supabase.from('vast_finance_applications').select('promoter_name, status_pengajuan').is('deleted_at', null).gte('sale_date', startDate).lte('sale_date', endDate),
        supabase.from('targets').select('assigned_to_id, target_value').eq('assigned_to_role', 'promoter').eq('target_type', 'pengajuan').eq('month', currentMonth),
        supabase.from('targets').select('assigned_to_id, target_value').eq('assigned_to_role', 'sator').eq('target_type', 'pengajuan').eq('month', currentMonth),
        supabase.from('sators').select('id, name, area').eq('is_active', true),
        supabase.from('user_profiles').select('name, area').eq('role', 'spv_area').eq('is_active', true),
      ]);

      const promoters = promotersResult.data || [];
      const sales = salesResult.data || [];
      const vastApps = vastResult.data || [];
      const targets = targetsResult.data || [];
      const satorTargets = satorTargetsResult.data || [];
      const satorsData = satorsResult.data || [];
      const spvProfiles = spvProfilesResult.data || [];

      // Create target lookup
      const targetMap: Record<string, number> = {};
      targets.forEach((t: any) => {
        targetMap[t.assigned_to_id] = t.target_value;
      });

      const satorTargetMap: Record<string, number> = {};
      satorTargets.forEach((t: any) => {
        satorTargetMap[t.assigned_to_id] = t.target_value;
      });

      // Create sator lookup
      const satorIdMap: Record<string, { id: string; name: string; area: string }> = {};
      satorsData.forEach((s: any) => {
        satorIdMap[s.name] = { id: s.id, name: s.name, area: s.area };
      });

      // Create SPV lookup by area
      const spvByArea: Record<string, string> = {};
      spvProfiles.forEach((spv: any) => {
        spvByArea[spv.area] = spv.name;
      });

      // Calculate promoter performance
      const promoterDataMap = new Map<string, PromoterData>();
      promoters.forEach((p: any) => {
        const promoterSales = sales.filter((s: any) => s.promoter_name === p.name);
        const promoterVast = vastApps.filter((v: any) => v.promoter_name === p.name);
        
        const pengajuan = promoterSales.length + promoterVast.length;
        const closing = promoterSales.filter((s: any) => s.status === 'ACC').length + 
                       promoterVast.filter((v: any) => v.status_pengajuan === 'ACC').length;

        promoterDataMap.set(p.id, {
          id: p.id,
          name: p.name,
          employeeId: p.employee_id || '-',
          storeName: (p.stores as any)?.name || '-',
          target: targetMap[p.id] || 0,
          pengajuan,
          closing,
        });
      });

      // Build hierarchy: Area -> Sator -> Promoter
      const areaMap = new Map<string, AreaData>();

      promoters.forEach((p: any) => {
        const areaName = p.area || (p.stores as any)?.area_detail || 'Tanpa Area';
        const satorName = p.sator || 'Tanpa Sator';
        const satorInfo = satorIdMap[satorName];

        // Initialize area if not exists
        if (!areaMap.has(areaName)) {
          areaMap.set(areaName, {
            area: areaName,
            spvName: spvByArea[areaName] || '-',
            target: 0,
            pengajuan: 0,
            closing: 0,
            satorCount: 0,
            promoterCount: 0,
            sators: [],
          });
        }

        const area = areaMap.get(areaName)!;

        // Find or create sator in this area
        let sator = area.sators.find(s => s.name === satorName);
        if (!sator) {
          sator = {
            id: satorInfo?.id || satorName,
            name: satorName,
            target: satorTargetMap[satorInfo?.id || ''] || 0,
            pengajuan: 0,
            closing: 0,
            promoterCount: 0,
            promoters: [],
          };
          area.sators.push(sator);
        }

        // Add promoter data
        const promoterData = promoterDataMap.get(p.id);
        if (promoterData) {
          sator.promoters.push(promoterData);
          sator.pengajuan += promoterData.pengajuan;
          sator.closing += promoterData.closing;
          sator.promoterCount++;
          
          area.pengajuan += promoterData.pengajuan;
          area.closing += promoterData.closing;
          area.promoterCount++;
          area.target += promoterData.target;
        }
      });

      // Finalize area data
      areaMap.forEach(area => {
        area.satorCount = area.sators.length;
        // Sort sators by name
        area.sators.sort((a, b) => a.name.localeCompare(b.name));
        // Sort promoters by pengajuan desc
        area.sators.forEach(s => {
          s.promoters.sort((a, b) => b.pengajuan - a.pengajuan);
        });
      });

      // Sort areas
      const sortedAreas = Array.from(areaMap.values()).sort((a, b) => a.area.localeCompare(b.area));
      setAreas(sortedAreas);

      // Calculate totals
      const totalTarget = sortedAreas.reduce((sum, a) => sum + a.target, 0);
      const totalPengajuan = sortedAreas.reduce((sum, a) => sum + a.pengajuan, 0);
      const totalClosing = sortedAreas.reduce((sum, a) => sum + a.closing, 0);
      const totalSators = sortedAreas.reduce((sum, a) => sum + a.satorCount, 0);
      const totalPromoters = sortedAreas.reduce((sum, a) => sum + a.promoterCount, 0);

      setTotals({
        target: totalTarget,
        pengajuan: totalPengajuan,
        closing: totalClosing,
        satorCount: totalSators,
        promoterCount: totalPromoters,
      });

      // Auto-expand first area for non-manager
      if (!isManagerArea && sortedAreas.length > 0) {
        setExpandedAreas(new Set([sortedAreas[0].area]));
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, year, month, currentMonth, isManagerArea, isSPVArea, isSator]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleArea = (areaName: string) => {
    setExpandedAreas(prev => {
      const next = new Set(prev);
      if (next.has(areaName)) {
        next.delete(areaName);
      } else {
        next.add(areaName);
      }
      return next;
    });
  };

  const toggleSator = (satorKey: string) => {
    setExpandedSators(prev => {
      const next = new Set(prev);
      if (next.has(satorKey)) {
        next.delete(satorKey);
      } else {
        next.add(satorKey);
      }
      return next;
    });
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return 'bg-green-500';
    if (pct >= 75) return 'bg-blue-500';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getProgressBadgeColor = (pct: number) => {
    if (pct >= 100) return 'bg-green-100 text-green-700';
    if (pct >= 75) return 'bg-blue-100 text-blue-700';
    if (pct >= 50) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const areaColors: Record<string, string> = {
    'KUPANG': 'bg-blue-500',
    'KABUPATEN': 'bg-green-500',
    'SUMBA': 'bg-orange-500',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const totalPct = totals.target > 0 ? Math.round((totals.pengajuan / totals.target) * 100) : 0;

  return (
    <div className="space-y-3 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Tim Saya</h1>
          <p className="text-xs text-gray-500 font-medium">
            {new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
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

      {/* Summary Card */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="px-2.5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="p-0.5 bg-white/20 rounded">
              <Users className="h-3 w-3 text-white" />
            </div>
            <span className="font-semibold text-xs text-white">{totals.promoterCount} Promoter</span>
          </div>
          {isManagerArea && (
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-medium text-white">{totals.satorCount} Sator</span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-1 px-2.5 pb-2">
          <div className="text-center bg-white/15 backdrop-blur-sm rounded-lg p-1.5">
            <p className="text-base font-bold text-white">{totals.target}</p>
            <p className="text-[10px] font-medium text-indigo-100">Target</p>
          </div>
          <div className="text-center bg-white/15 backdrop-blur-sm rounded-lg p-1.5">
            <p className="text-base font-bold text-white">{totals.pengajuan}</p>
            <p className="text-[10px] font-medium text-indigo-100">Pengajuan</p>
          </div>
          <div className="text-center bg-white/15 backdrop-blur-sm rounded-lg p-1.5">
            <p className="text-base font-bold text-white">{totals.closing}</p>
            <p className="text-[10px] font-medium text-indigo-100">Closing</p>
          </div>
        </div>

        {/* Progress */}
        <div className="px-2.5 pb-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-white">Progress</span>
            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${getProgressBadgeColor(totalPct)}`}>{totalPct}%</span>
          </div>
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(totalPct)} rounded-full transition-all`}
              style={{ width: `${Math.min(totalPct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Area List */}
      <div className="space-y-2">
        {areas.map((area) => {
          const isAreaExpanded = expandedAreas.has(area.area);
          const areaPct = area.target > 0 ? Math.round((area.pengajuan / area.target) * 100) : 0;

          return (
            <div key={area.area} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Area Header */}
              <button
                onClick={() => toggleArea(area.area)}
                className="w-full p-2 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${areaColors[area.area] || 'bg-gray-400'}`} />
                  <div className="text-left flex-1 min-w-0">
                    <h3 className="font-bold text-xs text-gray-900">{area.area}</h3>
                    <p className="text-[10px] text-gray-500 font-medium truncate">
                      <span className="inline-flex items-center gap-0.5">
                        <User className="h-2.5 w-2.5" />
                        {area.spvName} • {area.satorCount}S • {area.promoterCount}P
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-900">{area.pengajuan}/{area.target}</p>
                    <span className={`text-[10px] px-1 py-0.5 rounded font-bold ${getProgressBadgeColor(areaPct)}`}>
                      {areaPct}%
                    </span>
                  </div>
                  {isAreaExpanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                </div>
              </button>

              {/* Area Progress Bar */}
              <div className="px-2 pb-1.5">
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(areaPct)} rounded-full transition-all`}
                    style={{ width: `${Math.min(areaPct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Sator List */}
              {isAreaExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/50">
                  {area.sators.map((sator) => {
                    const satorKey = `${area.area}-${sator.name}`;
                    const isSatorExpanded = expandedSators.has(satorKey);
                    const satorTotalTarget = sator.promoters.reduce((sum, p) => sum + p.target, 0);
                    const satorPct = satorTotalTarget > 0 ? Math.round((sator.pengajuan / satorTotalTarget) * 100) : 0;

                    return (
                      <div key={satorKey} className="border-b border-gray-100 last:border-b-0">
                        {/* Sator Header */}
                        <button
                          onClick={() => toggleSator(satorKey)}
                          className="w-full p-1.5 pl-3 flex items-center justify-between hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <div className="p-0.5 bg-indigo-100 rounded">
                              <Target className="h-2.5 w-2.5 text-indigo-600" />
                            </div>
                            <div className="text-left flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 text-xs truncate">{sator.name}</p>
                              <p className="text-[10px] text-gray-500 font-medium">{sator.promoterCount}P</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xs font-bold text-gray-900">{sator.pengajuan}/{satorTotalTarget}</p>
                              <span className={`text-[10px] px-1 py-0.5 rounded font-bold ${getProgressBadgeColor(satorPct)}`}>
                                {satorPct}%
                              </span>
                            </div>
                            {isSatorExpanded ? <ChevronUp className="h-3 w-3 text-gray-400" /> : <ChevronDown className="h-3 w-3 text-gray-400" />}
                          </div>
                        </button>

                        {/* Sator Progress */}
                        <div className="px-3 pb-1">
                          <div className="h-0.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getProgressColor(satorPct)} rounded-full transition-all`}
                              style={{ width: `${Math.min(satorPct, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Promoter List */}
                        {isSatorExpanded && (
                          <div className="bg-white divide-y divide-gray-50">
                            {sator.promoters.map((promoter, idx) => {
                              const pPct = promoter.target > 0 ? Math.round((promoter.pengajuan / promoter.target) * 100) : 0;
                              return (
                                <div key={promoter.id} className="p-1.5 pl-5 hover:bg-gray-50 transition-colors">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <span className="text-[10px] text-gray-400 font-bold w-3 flex-shrink-0">{idx + 1}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-900 text-xs truncate">{promoter.name}</p>
                                        <p className="text-[10px] text-gray-500 truncate">{promoter.storeName}</p>
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-1.5">
                                      <p className="text-xs font-bold text-gray-900">{promoter.pengajuan}/{promoter.target}</p>
                                      <span className={`text-[10px] px-1 py-0.5 rounded font-bold ${getProgressBadgeColor(pPct)}`}>
                                        {pPct}%
                                      </span>
                                    </div>
                                  </div>
                                  <div className="h-0.5 bg-gray-100 rounded-full overflow-hidden ml-4">
                                    <div
                                      className={`h-full ${getProgressColor(pPct)} rounded-full transition-all`}
                                      style={{ width: `${Math.min(pPct, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                            {sator.promoters.length === 0 && (
                              <div className="p-3 text-center text-gray-500 text-[10px]">
                                Tidak ada promoter
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {areas.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="p-3 bg-gray-100 rounded-full w-fit mx-auto mb-2">
              <Users className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-xs text-gray-500 font-medium">Tidak ada data tim</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Data tim akan muncul di sini</p>
          </div>
        )}
      </div>
    </div>
  );
}
