'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentMonthWITA } from '@/lib/timezone';
import { useAuth } from '@/lib/auth-context';
import { InfoModal } from '@/components/info-modal';
import { Save, CheckCircle, AlertTriangle, Edit2, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PromoterTarget {
  id: string;
  name: string;
  employee_id: string;
  category: 'official' | 'training' | null;
  target: number;
  store_name: string;
  sator: string;
  sator_id: string | null;
  area: string;
}

interface SatorData {
  id: string;
  name: string;
  area: string;
  target: number;
  promoterCount: number;
  totalPromoterTarget: number;
}

interface SPVData {
  id: string;
  name: string;
  email: string;
  area: string;
  targetPengajuan: number;
  satorCount: number;
  totalSatorTarget: number;
}

interface TargetStats {
  official: { count: number; totalTarget: number };
  training: { count: number; totalTarget: number };
}

export default function TargetsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  
  // Common states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthWITA);

  // Manager Area states
  const [maActiveTab, setMaActiveTab] = useState<'spv' | 'sator'>('spv');
  const [spvList, setSpvList] = useState<SPVData[]>([]);
  const [allSators, setAllSators] = useState<SatorData[]>([]);
  const [editingSPV, setEditingSPV] = useState<string | null>(null);
  const [editingSator, setEditingSator] = useState<string | null>(null);
  const [spvTargetInput, setSpvTargetInput] = useState<string>('');
  const [satorTargetInput, setSatorTargetInput] = useState<string>('');

  // SPV mode - Promoter states
  const [promoters, setPromoters] = useState<PromoterTarget[]>([]);
  const [satorTargetForSPV, setSatorTargetForSPV] = useState<number>(0);
  const [officialTarget, setOfficialTarget] = useState<string>('');
  const [trainingTarget, setTrainingTarget] = useState<string>('');
  const [stats, setStats] = useState<TargetStats>({
    official: { count: 0, totalTarget: 0 },
    training: { count: 0, totalTarget: 0 },
  });
  const [uncategorizedPromoters, setUncategorizedPromoters] = useState<PromoterTarget[]>([]);

  // Modal state
  const [modalInfo, setModalInfo] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const showInfo = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setModalInfo({ isOpen: true, title, message, type });
  };

  // Check access
  useEffect(() => {
    if (!profile) return;
    if (profile.role !== 'spv_area' && profile.role !== 'manager_area') {
      showInfo('Akses Ditolak', 'Halaman ini hanya untuk SPV Area dan Manager Area', 'warning');
      router.push('/dashboard');
    }
  }, [profile, router]);

  // Fetch data based on role
  useEffect(() => {
    const loadData = async () => {
      if (!profile) return;
      setLoading(true);
      try {
        if (profile.role === 'spv_area') {
          await fetchPromotersForSPV();
        } else if (profile.role === 'manager_area') {
          await Promise.all([fetchSPVsForMA(), fetchAllSatorsForMA()]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [profile, selectedMonth]);

  // ============ MANAGER AREA Functions ============
  const fetchSPVsForMA = async () => {
    if (!profile) return;

    // Run all queries in parallel
    const [spvsResult, spvTargetsResult, satorsResult, satorTargetsResult] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, name, email, area')
        .eq('role', 'spv_area')
        .eq('is_active', true)
        .order('area'),
      supabase
        .from('targets')
        .select('assigned_to_id, target_value')
        .eq('assigned_to_role', 'spv_area')
        .eq('target_type', 'pengajuan')
        .eq('month', selectedMonth),
      supabase
        .from('sators')
        .select('id, area')
        .eq('is_active', true),
      supabase
        .from('targets')
        .select('assigned_to_id, target_value')
        .eq('assigned_to_role', 'sator')
        .eq('target_type', 'pengajuan')
        .eq('month', selectedMonth),
    ]);

    const spvs = spvsResult.data;
    const spvTargets = spvTargetsResult.data;
    const satorsData = satorsResult.data;
    const satorTargets = satorTargetsResult.data;

    const satorTargetMap: Record<string, number> = {};
    (satorTargets || []).forEach((t: any) => {
      satorTargetMap[t.assigned_to_id] = t.target_value;
    });

    const spvData: SPVData[] = (spvs || []).map((spv: any) => {
      const areaSators = satorsData?.filter((s: any) => s.area === spv.area) || [];
      const spvTarget = spvTargets?.find((t: any) => t.assigned_to_id === spv.id);
      const totalSatorTarget = areaSators.reduce((sum: number, s: any) => sum + (satorTargetMap[s.id] || 0), 0);
      
      return {
        id: spv.id,
        name: spv.name,
        email: spv.email,
        area: spv.area,
        targetPengajuan: spvTarget?.target_value || 0,
        satorCount: areaSators.length,
        totalSatorTarget,
      };
    });

    setSpvList(spvData);
  };

  const fetchAllSatorsForMA = async () => {
    if (!profile) return;

    // Run all queries in parallel
    const [satorsResult, targetsResult, promotersResult, promoterTargetsResult] = await Promise.all([
      supabase
        .from('sators')
        .select('id, name, area')
        .eq('is_active', true)
        .order('area')
        .order('name'),
      supabase
        .from('targets')
        .select('assigned_to_id, target_value')
        .eq('assigned_to_role', 'sator')
        .eq('target_type', 'pengajuan')
        .eq('month', selectedMonth),
      supabase
        .from('promoters')
        .select('id, sator_id')
        .eq('is_active', true),
      supabase
        .from('targets')
        .select('assigned_to_id, target_value')
        .eq('assigned_to_role', 'promoter')
        .eq('target_type', 'pengajuan')
        .eq('month', selectedMonth),
    ]);

    const satorsData = satorsResult.data;
    const targetsData = targetsResult.data;
    const promotersData = promotersResult.data;
    const promoterTargets = promoterTargetsResult.data;

    const targetMap: Record<string, number> = {};
    (targetsData || []).forEach((t: any) => {
      targetMap[t.assigned_to_id] = t.target_value;
    });

    const promoterTargetMap: Record<string, number> = {};
    (promoterTargets || []).forEach((t: any) => {
      promoterTargetMap[t.assigned_to_id] = t.target_value;
    });

    const mapped: SatorData[] = (satorsData || []).map((s: any) => {
      const satorPromoters = (promotersData || []).filter((p: any) => p.sator_id === s.id);
      const totalPromoterTarget = satorPromoters.reduce((sum: number, p: any) => sum + (promoterTargetMap[p.id] || 0), 0);
      
      return {
        id: s.id,
        name: s.name,
        area: s.area,
        target: targetMap[s.id] || 0,
        promoterCount: satorPromoters.length,
        totalPromoterTarget,
      };
    });

    setAllSators(mapped);
  };

  const handleSaveSPVTarget = async (spv: SPVData) => {
    if (!profile) return;
    
    const targetVal = parseInt(spvTargetInput);
    if (isNaN(targetVal) || targetVal < 0) {
      showInfo('Input Tidak Valid', 'Masukkan target yang valid (angka >= 0)', 'warning');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('targets').upsert({
        assigned_to_id: spv.id,
        assigned_to_name: spv.name,
        assigned_to_role: 'spv_area',
        area: spv.area,
        month: selectedMonth,
        target_type: 'pengajuan',
        target_value: targetVal,
        assigned_by_id: profile.id,
        assigned_by_name: profile.name,
      }, { onConflict: 'assigned_to_id,month,target_type' });

      if (error) throw error;

      showInfo('Berhasil', 'Target SPV berhasil disimpan!', 'success');
      setEditingSPV(null);
      setSpvTargetInput('');
      fetchSPVsForMA();
    } catch (error: any) {
      showInfo('Gagal Menyimpan', error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSatorTarget = async (sator: SatorData) => {
    if (!profile) return;
    
    const targetVal = parseInt(satorTargetInput);
    if (isNaN(targetVal) || targetVal < 0) {
      showInfo('Input Tidak Valid', 'Masukkan target yang valid (angka >= 0)', 'warning');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.from('targets').upsert({
        assigned_to_id: sator.id,
        assigned_to_name: sator.name,
        assigned_to_role: 'sator',
        area: sator.area,
        month: selectedMonth,
        target_type: 'pengajuan',
        target_value: targetVal,
        assigned_by_id: profile.id,
        assigned_by_name: profile.name,
      }, { onConflict: 'assigned_to_id,month,target_type' });

      if (error) throw error;

      showInfo('Berhasil', 'Target Sator berhasil disimpan!', 'success');
      setEditingSator(null);
      setSatorTargetInput('');
      await Promise.all([fetchSPVsForMA(), fetchAllSatorsForMA()]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      showInfo('Gagal Menyimpan', message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ============ SPV Functions ============
  const fetchPromotersForSPV = async () => {
    if (!profile) return;

    // Run all queries in parallel
    const [promotersResult, targetsResult, satorTargetsResult, satorsResult] = await Promise.all([
      supabase
        .from('promoters')
        .select(`id, name, employee_id, category, sator, sator_id, area, stores (name)`)
        .eq('area', profile.area)
        .eq('is_active', true)
        .order('sator')
        .order('category')
        .order('name'),
      supabase
        .from('targets')
        .select('assigned_to_id, target_value')
        .eq('assigned_to_role', 'promoter')
        .eq('target_type', 'pengajuan')
        .eq('month', selectedMonth),
      supabase
        .from('targets')
        .select('assigned_to_id, target_value')
        .eq('assigned_to_role', 'sator')
        .eq('target_type', 'pengajuan')
        .eq('month', selectedMonth),
      supabase
        .from('sators')
        .select('id, area')
        .eq('area', profile.area)
        .eq('is_active', true),
    ]);

    const { data, error } = promotersResult;
    if (error) {
      console.error('Error fetching promoters:', error);
      return;
    }

    const targetsData = targetsResult.data;
    const satorTargetsData = satorTargetsResult.data;
    const satorsData = satorsResult.data;

    // Get sator IDs for this area
    const satorIdsInArea = new Set((satorsData || []).map((s: any) => s.id));
    
    // Filter sator targets for this SPV's area and sum them
    const areaSatorTargets = (satorTargetsData || []).filter((t: any) => satorIdsInArea.has(t.assigned_to_id));
    const totalSatorTarget = areaSatorTargets.reduce((sum: number, t: any) => sum + (t.target_value || 0), 0);
    setSatorTargetForSPV(totalSatorTarget);

    const targetMap: Record<string, number> = {};
    (targetsData || []).forEach((t: any) => {
      targetMap[t.assigned_to_id] = t.target_value;
    });

    const mapped = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      employee_id: p.employee_id,
      category: p.category || null,
      target: targetMap[p.id] || 0,
      store_name: p.stores?.name || '-',
      sator: p.sator || '-',
      sator_id: p.sator_id || null,
      area: p.area || '-',
    }));
    
    setPromoters(mapped);
    setUncategorizedPromoters(mapped.filter(p => !p.category));
    calculateStats(mapped);
  };

  const calculateStats = (data: PromoterTarget[]) => {
    const official = data.filter(p => p.category === 'official');
    const training = data.filter(p => p.category === 'training');
    setStats({
      official: { count: official.length, totalTarget: official.reduce((sum, p) => sum + (p.target || 0), 0) },
      training: { count: training.length, totalTarget: training.reduce((sum, p) => sum + (p.target || 0), 0) },
    });
  };

  const handleBulkSave = async () => {
    if (!profile) return;
    const officialVal = parseInt(officialTarget);
    const trainingVal = parseInt(trainingTarget);

    if (isNaN(officialVal) && isNaN(trainingVal)) {
      showInfo('Input Diperlukan', 'Masukkan minimal satu target (Official atau Training)', 'warning');
      return;
    }

    setSaving(true);
    try {
      const officialPromoters = promoters.filter(p => p.category === 'official');
      const trainingPromoters = promoters.filter(p => p.category === 'training');

      if (!isNaN(officialVal) && officialVal >= 0 && officialPromoters.length > 0) {
        for (const p of officialPromoters) {
          const { error } = await supabase.from('targets').upsert({
            assigned_to_id: p.id,
            assigned_to_name: p.name,
            assigned_to_role: 'promoter',
            area: profile.area,
            month: selectedMonth,
            target_type: 'pengajuan',
            target_value: officialVal,
            assigned_by_id: profile.id,
            assigned_by_name: profile.name,
          }, { onConflict: 'assigned_to_id,month,target_type' });
          
          if (error) throw error;
        }
      }

      if (!isNaN(trainingVal) && trainingVal >= 0 && trainingPromoters.length > 0) {
        for (const p of trainingPromoters) {
          const { error } = await supabase.from('targets').upsert({
            assigned_to_id: p.id,
            assigned_to_name: p.name,
            assigned_to_role: 'promoter',
            area: profile.area,
            month: selectedMonth,
            target_type: 'pengajuan',
            target_value: trainingVal,
            assigned_by_id: profile.id,
            assigned_by_name: profile.name,
          }, { onConflict: 'assigned_to_id,month,target_type' });
          
          if (error) throw error;
        }
      }

      showInfo('Berhasil', 'Target berhasil disimpan untuk semua promoter!', 'success');
      setOfficialTarget('');
      setTrainingTarget('');
      fetchPromotersForSPV();
    } catch (error: any) {
      showInfo('Gagal Menyimpan', error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ============ VALIDATION ============
  const getSPVValidationStatus = (spv: SPVData) => {
    if (spv.targetPengajuan === 0) return 'no-target';
    if (spv.totalSatorTarget >= spv.targetPengajuan) return 'valid';
    return 'invalid';
  };

  const getSatorValidationStatus = (sator: SatorData) => {
    if (sator.target === 0) return 'no-target';
    if (sator.totalPromoterTarget >= sator.target) return 'valid';
    return 'invalid';
  };

  const hasUncategorized = uncategorizedPromoters.length > 0;
  const totalPromoterTarget = stats.official.totalTarget + stats.training.totalTarget;

  if (!profile || (profile.role !== 'spv_area' && profile.role !== 'manager_area')) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // ============ MANAGER AREA VIEW ============
  if (profile.role === 'manager_area') {
    return (
      <div className="space-y-3">
        {/* Loading Overlay */}
        {saving && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-4 flex items-center gap-3 shadow-xl">
              <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
              <p className="font-medium text-gray-900">Menyimpan...</p>
            </div>
          </div>
        )}

        {/* Month Selector */}
        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <p className="text-xs sm:text-sm text-gray-500">Periode Target:</p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-500" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex-1 sm:flex-none px-3 py-2 text-sm font-medium text-gray-900 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-indigo-50"
              />
            </div>
          </div>
        </div>

        {/* Tabs + Content */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-2 sm:p-3 border-b border-gray-200">
            <nav className="flex gap-2">
              <button
                onClick={() => setMaActiveTab('spv')}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                  maActiveTab === 'spv'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Target SPV
              </button>
              <button
                onClick={() => setMaActiveTab('sator')}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                  maActiveTab === 'sator'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Target Sator
              </button>
            </nav>
          </div>

          <div className="p-3 sm:p-6">
            {/* ============ TAB SPV ============ */}
            {maActiveTab === 'spv' && (
              <div className="space-y-4">
                {/* Summary - Pindah ke atas */}
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <div className="bg-indigo-50 rounded-lg p-3 sm:p-4 border border-indigo-200">
                    <p className="text-xs sm:text-sm text-indigo-600 font-medium">Total Target SPV</p>
                    <p className="text-xl sm:text-3xl font-bold text-indigo-900">{spvList.reduce((sum, s) => sum + s.targetPengajuan, 0)}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 sm:p-4 border border-purple-200">
                    <p className="text-xs sm:text-sm text-purple-600 font-medium">Total Target Sator</p>
                    <p className="text-xl sm:text-3xl font-bold text-purple-900">{spvList.reduce((sum, s) => sum + s.totalSatorTarget, 0)}</p>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="sm:hidden space-y-3">
                  {spvList.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">Belum ada SPV terdaftar</div>
                  ) : (
                    spvList.map((spv) => {
                      const status = getSPVValidationStatus(spv);
                      return (
                        <div key={spv.id} className="bg-gray-50 rounded-lg p-3 border">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{spv.name}</p>
                              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                spv.area === 'KUPANG' ? 'bg-blue-100 text-blue-700' :
                                spv.area === 'KABUPATEN' ? 'bg-green-100 text-green-700' :
                                'bg-orange-100 text-orange-700'
                              }`}>
                                {spv.area}
                              </span>
                            </div>
                            {status === 'valid' && <CheckCircle className="h-5 w-5 text-green-500" />}
                            {status === 'invalid' && (
                              <button 
                                onClick={() => showInfo('Target Belum Tercapai', `Target SPV: ${spv.targetPengajuan}\nTotal Target Sator: ${spv.totalSatorTarget}\n\nKurang ${spv.targetPengajuan - spv.totalSatorTarget} target lagi.\n\nPastikan total target semua Sator di area ini >= target SPV.`, 'error')}
                                className="p-0.5 hover:bg-red-100 rounded-full"
                              >
                                <AlertCircle className="h-5 w-5 text-red-500" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center mb-2">
                            <div className="bg-white rounded p-2">
                              <p className="text-[10px] text-gray-500">Sator</p>
                              <p className="text-sm font-bold text-gray-900">{spv.satorCount}</p>
                            </div>
                            <div className="bg-white rounded p-2">
                              <p className="text-[10px] text-gray-500">Target</p>
                              <p className="text-sm font-bold text-indigo-600">{spv.targetPengajuan}</p>
                            </div>
                            <div className="bg-white rounded p-2">
                              <p className="text-[10px] text-gray-500">Sator Target</p>
                              <p className="text-sm font-bold text-purple-600">{spv.totalSatorTarget}</p>
                            </div>
                          </div>
                          {editingSPV === spv.id ? (
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={spvTargetInput}
                                onChange={(e) => setSpvTargetInput(e.target.value)}
                                className="flex-1 px-2 py-1.5 text-sm text-gray-900 border rounded text-center"
                                min="0"
                                placeholder="Target"
                              />
                              <button onClick={() => handleSaveSPVTarget(spv)} disabled={saving} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded">
                                <Save className="h-4 w-4" />
                              </button>
                              <button onClick={() => setEditingSPV(null)} className="px-3 py-1.5 border text-xs rounded text-gray-700">
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => { setEditingSPV(spv.id); setSpvTargetInput(spv.targetPengajuan.toString()); }}
                              className="w-full py-1.5 text-xs border rounded text-gray-700 hover:bg-gray-100"
                            >
                              <Edit2 className="h-3 w-3 inline mr-1" /> Edit Target
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SPV</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Area</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sator</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Target</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Target Sator</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {spvList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                            Belum ada SPV terdaftar
                          </td>
                        </tr>
                      ) : (
                        spvList.map((spv) => {
                          const status = getSPVValidationStatus(spv);
                          return (
                            <tr key={spv.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900 text-sm">{spv.name}</p>
                                <p className="text-xs text-gray-500">{spv.email}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  spv.area === 'KUPANG' ? 'bg-blue-100 text-blue-700' :
                                  spv.area === 'KABUPATEN' ? 'bg-green-100 text-green-700' :
                                  'bg-orange-100 text-orange-700'
                                }`}>
                                  {spv.area}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="font-semibold text-gray-900">{spv.satorCount}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {editingSPV === spv.id ? (
                                  <input
                                    type="number"
                                    value={spvTargetInput}
                                    onChange={(e) => setSpvTargetInput(e.target.value)}
                                    className="w-20 px-2 py-1 text-sm text-gray-900 border rounded text-center"
                                    min="0"
                                  />
                                ) : (
                                  <span className="text-base font-bold text-indigo-600">{spv.targetPengajuan}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-base font-bold text-purple-600">{spv.totalSatorTarget}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {status === 'no-target' && (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Belum</span>
                                )}
                                {status === 'valid' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                    <CheckCircle className="h-3 w-3" /> OK
                                  </span>
                                )}
                                {status === 'invalid' && (
                                  <button 
                                    onClick={() => showInfo('Target Belum Tercapai', `Target SPV: ${spv.targetPengajuan}\nTotal Target Sator: ${spv.totalSatorTarget}\n\nKurang ${spv.targetPengajuan - spv.totalSatorTarget} target lagi.\n\nPastikan total target semua Sator di area ini >= target SPV.`, 'error')}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700 hover:bg-red-200"
                                  >
                                    <AlertCircle className="h-3 w-3" /> -{spv.targetPengajuan - spv.totalSatorTarget}
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {editingSPV === spv.id ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => handleSaveSPVTarget(spv)} disabled={saving} className="p-1.5 bg-green-600 text-white rounded">
                                      <Save className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => setEditingSPV(null)} className="p-1.5 border rounded text-gray-700">
                                      X
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => { setEditingSPV(spv.id); setSpvTargetInput(spv.targetPengajuan.toString()); }}
                                    className="px-2 py-1 text-xs border rounded text-gray-700 hover:bg-gray-50"
                                  >
                                    <Edit2 className="h-3 w-3 inline" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ============ TAB SATOR ============ */}
            {maActiveTab === 'sator' && (
              <div className="space-y-4">
                {/* Summary per Area - Pindah ke atas */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  {['KUPANG', 'KABUPATEN', 'SUMBA'].map((area) => {
                    const areaSators = allSators.filter(s => s.area === area);
                    const totalTarget = areaSators.reduce((sum, s) => sum + s.target, 0);
                    const totalPromoter = areaSators.reduce((sum, s) => sum + s.totalPromoterTarget, 0);
                    return (
                      <div key={area} className={`rounded-lg p-2 sm:p-4 border ${
                        area === 'KUPANG' ? 'bg-blue-50 border-blue-200' :
                        area === 'KABUPATEN' ? 'bg-green-50 border-green-200' :
                        'bg-orange-50 border-orange-200'
                      }`}>
                        <p className="text-[10px] sm:text-sm font-medium text-gray-600">{area}</p>
                        <p className="text-lg sm:text-2xl font-bold text-gray-900">{totalTarget}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500">Prom: {totalPromoter}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile Card View */}
                <div className="sm:hidden space-y-3">
                  {allSators.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">Belum ada Sator terdaftar</div>
                  ) : (
                    allSators.map((sator) => {
                      const status = getSatorValidationStatus(sator);
                      return (
                        <div key={sator.id} className="bg-gray-50 rounded-lg p-3 border">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{sator.name}</p>
                              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                sator.area === 'KUPANG' ? 'bg-blue-100 text-blue-700' :
                                sator.area === 'KABUPATEN' ? 'bg-green-100 text-green-700' :
                                'bg-orange-100 text-orange-700'
                              }`}>
                                {sator.area}
                              </span>
                            </div>
                            {status === 'valid' && <CheckCircle className="h-5 w-5 text-green-500" />}
                            {status === 'invalid' && (
                              <button 
                                onClick={() => showInfo('Target Belum Tercapai', `Target Sator: ${sator.target}\nTotal Target Promoter: ${sator.totalPromoterTarget}\n\nKurang ${sator.target - sator.totalPromoterTarget} target lagi.\n\nPastikan total target semua Promoter di Sator ini >= target Sator.`, 'error')}
                                className="p-0.5 hover:bg-red-100 rounded-full"
                              >
                                <AlertCircle className="h-5 w-5 text-red-500" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center mb-2">
                            <div className="bg-white rounded p-2">
                              <p className="text-[10px] text-gray-500">Promoter</p>
                              <p className="text-sm font-bold text-gray-900">{sator.promoterCount}</p>
                            </div>
                            <div className="bg-white rounded p-2">
                              <p className="text-[10px] text-gray-500">Target</p>
                              <p className="text-sm font-bold text-indigo-600">{sator.target}</p>
                            </div>
                            <div className="bg-white rounded p-2">
                              <p className="text-[10px] text-gray-500">Promoter Target</p>
                              <p className="text-sm font-bold text-purple-600">{sator.totalPromoterTarget}</p>
                            </div>
                          </div>
                          {editingSator === sator.id ? (
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={satorTargetInput}
                                onChange={(e) => setSatorTargetInput(e.target.value)}
                                className="flex-1 px-2 py-1.5 text-sm text-gray-900 border rounded text-center"
                                min="0"
                                placeholder="Target"
                              />
                              <button onClick={() => handleSaveSatorTarget(sator)} disabled={saving} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded">
                                <Save className="h-4 w-4" />
                              </button>
                              <button onClick={() => setEditingSator(null)} className="px-3 py-1.5 border text-xs rounded text-gray-700">
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => { setEditingSator(sator.id); setSatorTargetInput(sator.target.toString()); }}
                              className="w-full py-1.5 text-xs border rounded text-gray-700 hover:bg-gray-100"
                            >
                              <Edit2 className="h-3 w-3 inline mr-1" /> Edit Target
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sator</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Area</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Promoter</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Target</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Promoter Target</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {allSators.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                            Belum ada Sator terdaftar
                          </td>
                        </tr>
                      ) : (
                        allSators.map((sator) => {
                          const status = getSatorValidationStatus(sator);
                          return (
                            <tr key={sator.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900 text-sm">{sator.name}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  sator.area === 'KUPANG' ? 'bg-blue-100 text-blue-700' :
                                  sator.area === 'KABUPATEN' ? 'bg-green-100 text-green-700' :
                                  'bg-orange-100 text-orange-700'
                                }`}>
                                  {sator.area}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="font-semibold text-gray-900">{sator.promoterCount}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {editingSator === sator.id ? (
                                  <input
                                    type="number"
                                    value={satorTargetInput}
                                    onChange={(e) => setSatorTargetInput(e.target.value)}
                                    className="w-20 px-2 py-1 text-sm text-gray-900 border rounded text-center"
                                    min="0"
                                  />
                                ) : (
                                  <span className="text-base font-bold text-indigo-600">{sator.target}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-base font-bold text-purple-600">{sator.totalPromoterTarget}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {status === 'no-target' && (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Belum</span>
                                )}
                                {status === 'valid' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                    <CheckCircle className="h-3 w-3" /> OK
                                  </span>
                                )}
                                {status === 'invalid' && (
                                  <button 
                                    onClick={() => showInfo('Target Belum Tercapai', `Target Sator: ${sator.target}\nTotal Target Promoter: ${sator.totalPromoterTarget}\n\nKurang ${sator.target - sator.totalPromoterTarget} target lagi.\n\nPastikan total target semua Promoter di Sator ini >= target Sator.`, 'error')}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700 hover:bg-red-200"
                                  >
                                    <AlertCircle className="h-3 w-3" /> -{sator.target - sator.totalPromoterTarget}
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {editingSator === sator.id ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => handleSaveSatorTarget(sator)} disabled={saving} className="p-1.5 bg-green-600 text-white rounded">
                                      <Save className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => setEditingSator(null)} className="p-1.5 border rounded text-gray-700">
                                      X
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => { setEditingSator(sator.id); setSatorTargetInput(sator.target.toString()); }}
                                    className="px-2 py-1 text-xs border rounded text-gray-700 hover:bg-gray-50"
                                  >
                                    <Edit2 className="h-3 w-3 inline" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Modal */}
        <InfoModal
          isOpen={modalInfo.isOpen}
          onClose={() => setModalInfo({ ...modalInfo, isOpen: false })}
          title={modalInfo.title}
          message={modalInfo.message}
          type={modalInfo.type}
        />
      </div>
    );
  }

  // ============ SPV VIEW ============
  return (
    <div className="space-y-3 relative">
      {/* Loading Overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 flex items-center gap-3 shadow-xl">
            <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
            <p className="font-medium text-gray-900">Menyimpan...</p>
          </div>
        </div>
      )}

      {/* Month Selector */}
      <div className="bg-white rounded-lg shadow-sm p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm text-gray-500">Area {profile.area}</p>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-900 border border-gray-200 rounded-md focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Target Info + Warning Row */}
      {(satorTargetForSPV > 0 || hasUncategorized) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {satorTargetForSPV > 0 && (
            <div className={`rounded-lg p-3 border ${
              totalPromoterTarget >= satorTargetForSPV ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs text-gray-500">Target MA</p>
                  <p className="text-base sm:text-lg font-bold text-gray-900">{satorTargetForSPV}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] sm:text-xs text-gray-500">Target Anda</p>
                  <p className={`text-base sm:text-lg font-bold ${totalPromoterTarget >= satorTargetForSPV ? 'text-green-600' : 'text-yellow-600'}`}>
                    {totalPromoterTarget}
                  </p>
                </div>
                {totalPromoterTarget >= satorTargetForSPV ? (
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
                )}
              </div>
            </div>
          )}
          {hasUncategorized && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-yellow-800 truncate">{uncategorizedPromoters.length} promoter belum ada kategori</p>
                </div>
                <Link href="/dashboard/team">
                  <button className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded">Fix</button>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compact Stats + Bulk Set */}
      <div className={`bg-white rounded-lg shadow-sm p-3 sm:p-4 ${hasUncategorized ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-purple-50 rounded-lg p-2 sm:p-3 border border-purple-100">
            <p className="text-[10px] sm:text-xs text-purple-600 font-medium">Official</p>
            <p className="text-lg sm:text-xl font-bold text-purple-700">{stats.official.count}</p>
            <p className="text-[10px] sm:text-xs text-purple-500">Target: {stats.official.totalTarget}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-2 sm:p-3 border border-orange-100">
            <p className="text-[10px] sm:text-xs text-orange-600 font-medium">Training</p>
            <p className="text-lg sm:text-xl font-bold text-orange-700">{stats.training.count}</p>
            <p className="text-[10px] sm:text-xs text-orange-500">Target: {stats.training.totalTarget}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-2 sm:p-3 border border-purple-200">
            <label className="block text-[10px] sm:text-xs font-medium text-purple-700 mb-1">Set Official</label>
            <input type="number" min="0" value={officialTarget} onChange={(e) => setOfficialTarget(e.target.value)}
              className="w-full px-2 py-1 sm:py-1.5 text-xs sm:text-sm text-gray-900 border border-purple-300 rounded" placeholder="30" />
          </div>
          <div className="bg-orange-50 rounded-lg p-2 sm:p-3 border border-orange-200">
            <label className="block text-[10px] sm:text-xs font-medium text-orange-700 mb-1">Set Training</label>
            <input type="number" min="0" value={trainingTarget} onChange={(e) => setTrainingTarget(e.target.value)}
              className="w-full px-2 py-1 sm:py-1.5 text-xs sm:text-sm text-gray-900 border border-orange-300 rounded" placeholder="15" />
          </div>
        </div>
        <div className="mt-2 sm:mt-3 flex justify-end">
          <button 
            onClick={handleBulkSave} 
            disabled={saving || (!officialTarget && !trainingTarget) || hasUncategorized}
            className="flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? '...' : <><Save className="h-3 w-3 sm:h-4 sm:w-4" /> Simpan</>}
          </button>
        </div>
      </div>

      {/* Promoter List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-3 sm:p-4 border-b">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900">Daftar Promoter & Target</h3>
        </div>
        
        {/* Mobile Card View */}
        <div className="sm:hidden divide-y divide-gray-100">
          {promoters.map((p, idx) => (
            <div key={p.id || idx} className="p-3">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                  <p className="text-[10px] text-gray-500">{p.employee_id} • {p.sator}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-base font-bold text-gray-900">{p.target}</span>
                  {p.target > 0 && <CheckCircle className="h-4 w-4 text-green-500" />}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-500">{p.store_name}</p>
                {p.category ? (
                  <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${p.category === 'official' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'}`}>
                    {p.category.toUpperCase()}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-100 text-red-800">BELUM</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sator</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Toko</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {promoters.map((p, idx) => (
                <tr key={p.id || idx} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs font-mono text-gray-900">{p.employee_id}</td>
                  <td className="px-3 py-2 text-sm font-medium text-gray-900">{p.name}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{p.sator}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{p.store_name}</td>
                  <td className="px-3 py-2">
                    {p.category ? (
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${p.category === 'official' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'}`}>
                        {p.category.toUpperCase()}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">BELUM</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-gray-900">{p.target}</span>
                      {p.target > 0 && <CheckCircle className="h-3 w-3 text-green-500" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Modal */}
      <InfoModal
        isOpen={modalInfo.isOpen}
        onClose={() => setModalInfo({ ...modalInfo, isOpen: false })}
        title={modalInfo.title}
        message={modalInfo.message}
        type={modalInfo.type}
      />
    </div>
  );
}
