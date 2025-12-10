'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, getAccessibleAreas } from '@/lib/auth-context';
import { formatDate, getStartOfMonth, formatDateForInput } from '@/lib/utils';
import { Download, Image, Trophy, TrendingDown } from 'lucide-react';
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx';

interface PromoterStats {
  promoter_name: string;
  promoter_id?: string;
  sator?: string;
  store_name?: string;
  total: number;
  acc: number;
  pending: number;
  reject: number;
  accRate: number;
  target_pengajuan: number;
  target_closing: number;
}

export default function RekapPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<PromoterStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [area, setArea] = useState<string>('all');
  const [sator, setSator] = useState<string>('all'); // Default: 'all', will be set to 'own' for sator role
  const [availableSators, setAvailableSators] = useState<string[]>([]);
  const [month, setMonth] = useState<string>(formatDateForInput(getStartOfMonth()).substring(0, 7));
  const imageRef = useRef<HTMLDivElement>(null);

  // Get accessible areas for this user
  const accessibleAreas = profile ? getAccessibleAreas(profile) : [];

  // Auto-set area if user has limited access
  useEffect(() => {
    if (profile && accessibleAreas.length === 1) {
      setArea(accessibleAreas[0]);
    }
    // Set default sator to 'own' only for sator role
    if (profile && profile.role === 'sator') {
      setSator('own');
    }
  }, [profile]);

  // Fetch available sators based on selected area
  useEffect(() => {
    if (profile) {
      fetchAvailableSators();
    }
  }, [profile, area]);

  const fetchAvailableSators = async () => {
    if (!profile) return;

    // For sator role, use their own sators
    if (profile.role === 'sator') {
      const sators: string[] = [];
      if (profile.sator_name) sators.push(profile.sator_name);
      if (profile.can_view_other_sators) sators.push(...profile.can_view_other_sators);
      setAvailableSators(sators.sort());
      return;
    }

    // For other roles, fetch from promoters table based on area
    let query = supabase
      .from('promoters')
      .select('sator')
      .eq('is_active', true)
      .not('sator', 'is', null);

    if (area !== 'all') {
      query = query.eq('area', area);
    } else if (profile.role === 'spv_area' && profile.area !== 'ALL') {
      query = query.eq('area', profile.area);
    }

    const { data } = await query;

    if (data) {
      const uniqueSators = Array.from(new Set(data.map((d: any) => d.sator))).filter(Boolean).sort();
      setAvailableSators(uniqueSators as string[]);
    }
  };

  // Auto-fetch when profile or filters change
  useEffect(() => {
    if (profile) {
      fetchStats();
    }
  }, [profile, area, sator, month]);

  const fetchStats = async () => {
    if (!profile) return;

    setLoading(true);
    try {
    const startDate = `${month}-01`;

    // Calculate last day of month correctly (month in JS is 0-indexed)
    const [year, monthNum] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNum, 0).getDate(); // Get last day of month
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    // Query 1: sales_with_details (Excel data) - only needed columns
    let salesQuery = supabase
      .from('sales_with_details')
      .select('promoter_name, status, sator, store_name, area_detail')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate);

    // Query 2: vast_finance_applications (Form data)
    const vastQuery = supabase
      .from('vast_finance_applications')
      .select(`
        status_pengajuan,
        promoter_name,
        promoter_id,
        stores (name, area_detail),
        promoters (id, sator)
      `)
      .is('deleted_at', null)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate);

    // Apply area filter to sales
    if (area !== 'all') {
      salesQuery = salesQuery.eq('area_detail', area);
    } else if (profile.role !== 'super_admin' && profile.role !== 'manager_area') {
      // User has limited access, filter by accessible areas
      if (accessibleAreas.length === 1) {
        salesQuery = salesQuery.eq('area_detail', accessibleAreas[0]);
      } else if (accessibleAreas.length > 1) {
        salesQuery = salesQuery.in('area_detail', accessibleAreas);
      }
    }
    
    // Additional safety: SPV must always be filtered by their area
    if (profile.role === 'spv_area' && profile.area !== 'ALL') {
      salesQuery = salesQuery.eq('area_detail', profile.area);
    }

    // Filter by selected sator for all roles
    if (sator !== 'all' && sator !== 'own') {
      salesQuery = salesQuery.eq('sator', sator);
    } else if (profile.role === 'sator') {
      // For sator role with special handling
      if (sator === 'own' && profile.sator_name) {
        salesQuery = salesQuery.eq('sator', profile.sator_name);
      } else if (sator === 'all') {
        // Show all sators they can access
        const sators: string[] = [];
        if (profile.sator_name) sators.push(profile.sator_name);
        if (profile.can_view_other_sators) sators.push(...profile.can_view_other_sators);
        if (sators.length > 0) {
          salesQuery = salesQuery.in('sator', sators);
        }
      }
    }

    // Execute both queries in parallel
    const [salesResult, vastResult] = await Promise.all([salesQuery, vastQuery]);

    if (salesResult.error) {
      console.error('Error fetching sales:', salesResult.error);
    }
    if (vastResult.error) {
      console.error('Error fetching vast:', vastResult.error);
    }

    // Transform vast data to match sales format
    interface VastSale {
      promoter_name: string;
      status: string;
      sator: string;
      store_name: string;
      area_detail: string;
    }

    const vastSales: VastSale[] = (vastResult.data || []).map((v: any) => {
      const storeData = v.stores as { name: string; area_detail: string } | null;
      const promoterData = v.promoters as { sator: string } | null;
      
      // Map status
      const status = v.status_pengajuan === 'ACC' ? 'ACC'
        : v.status_pengajuan === 'Belum disetujui' ? 'Reject'
        : 'Pending';

      return {
        promoter_name: v.promoter_name || '',
        status,
        sator: promoterData?.sator || '',
        store_name: storeData?.name || '',
        area_detail: storeData?.area_detail || '',
      };
    });

    // Filter vast data by area
    let filteredVastSales = vastSales;
    if (area !== 'all') {
      filteredVastSales = vastSales.filter(v => v.area_detail === area);
    } else if (profile.role !== 'super_admin' && profile.role !== 'manager_area') {
      filteredVastSales = vastSales.filter(v => accessibleAreas.includes(v.area_detail || ''));
    }
    
    // Additional safety: SPV must always be filtered by their area
    if (profile.role === 'spv_area' && profile.area !== 'ALL') {
      filteredVastSales = filteredVastSales.filter(v => v.area_detail === profile.area);
    }

    // Filter vast data by sator for all roles
    if (sator !== 'all' && sator !== 'own') {
      filteredVastSales = filteredVastSales.filter(v => v.sator === sator);
    } else if (profile.role === 'sator') {
      if (sator === 'own' && profile.sator_name) {
        filteredVastSales = filteredVastSales.filter(v => v.sator === profile.sator_name);
      } else if (sator === 'all') {
        const sators: string[] = [];
        if (profile.sator_name) sators.push(profile.sator_name);
        if (profile.can_view_other_sators) sators.push(...profile.can_view_other_sators);
        if (sators.length > 0) {
          filteredVastSales = filteredVastSales.filter(v => sators.includes(v.sator || ''));
        }
      }
    }

    // Combine sales data
    const allSales = [...(salesResult.data || []), ...filteredVastSales];

    // Build area filter for promoters query
    let promotersQuery = supabase
      .from('promoters')
      .select('id, name, sator, is_active, stores(name)')
      .eq('is_active', true);

    // Apply area filter to promoters
    if (area !== 'all') {
      promotersQuery = promotersQuery.eq('area', area);
    } else if (profile.role === 'spv_area' && profile.area !== 'ALL') {
      promotersQuery = promotersQuery.eq('area', profile.area);
    } else if (profile.role === 'sator' && profile.area) {
      promotersQuery = promotersQuery.eq('area', profile.area);
    } else if (profile.role !== 'super_admin' && profile.role !== 'manager_area' && accessibleAreas.length > 0) {
      promotersQuery = promotersQuery.in('area', accessibleAreas);
    }

    // Apply sator filter to promoters for all roles
    if (sator !== 'all' && sator !== 'own') {
      promotersQuery = promotersQuery.eq('sator', sator);
    } else if (profile.role === 'sator') {
      if (sator === 'own' && profile.sator_name) {
        promotersQuery = promotersQuery.eq('sator', profile.sator_name);
      } else if (sator === 'all') {
        const sators: string[] = [];
        if (profile.sator_name) sators.push(profile.sator_name);
        if (profile.can_view_other_sators) sators.push(...profile.can_view_other_sators);
        if (sators.length > 0) {
          promotersQuery = promotersQuery.in('sator', sators);
        }
      }
    }

    const { data: allPromotersData } = await promotersQuery;

    // Get all promoter IDs for target lookup
    const allPromoterIds = (allPromotersData || []).map((p: any) => p.id);
    
    // Fetch targets from targets table
    const targetMap: Record<string, number> = {};
    if (allPromoterIds.length > 0) {
      const { data: targetsData } = await supabase
        .from('targets')
        .select('assigned_to_id, target_value')
        .eq('assigned_to_role', 'promoter')
        .eq('target_type', 'pengajuan')
        .eq('month', month)
        .in('assigned_to_id', allPromoterIds);
      
      (targetsData || []).forEach((t: any) => {
        targetMap[t.assigned_to_id] = t.target_value;
      });
    }

    // Create promoter data map from ALL promoters (not just those with sales)
    const promoterDataMap = new Map<string, { id: string; target: number; sator: string; store_name: string }>();
    (allPromotersData || []).forEach((p: any) => {
      promoterDataMap.set(p.name, { 
        id: p.id, 
        target: targetMap[p.id] || 0,
        sator: p.sator || '',
        store_name: p.stores?.name || ''
      });
    });

    // Initialize promoter stats with ALL promoters (including those with 0 sales)
    const promoterMap = new Map<string, PromoterStats>();
    
    // First, add all promoters with 0 stats
    promoterDataMap.forEach((data, name) => {
      promoterMap.set(name, {
        promoter_name: name,
        promoter_id: data.id,
        sator: data.sator,
        store_name: data.store_name,
        total: 0,
        acc: 0,
        pending: 0,
        reject: 0,
        accRate: 0,
        target_pengajuan: data.target,
        target_closing: 0,
      });
    });

    // Then, update with actual sales data
    allSales.forEach((sale: any) => {
      const existing = promoterMap.get(sale.promoter_name);
      if (existing) {
        existing.total++;
        if (sale.status === 'ACC') existing.acc++;
        else if (sale.status === 'Pending') existing.pending++;
        else if (sale.status === 'Reject') existing.reject++;
      } else {
        // Promoter not in our list (maybe inactive or different area) - still add them
        const promoterData = promoterDataMap.get(sale.promoter_name);
        promoterMap.set(sale.promoter_name, {
          promoter_name: sale.promoter_name,
          promoter_id: promoterData?.id || sale.promoter_id,
          sator: sale.sator || promoterData?.sator || '',
          store_name: sale.store_name || promoterData?.store_name || '',
          total: 1,
          acc: sale.status === 'ACC' ? 1 : 0,
          pending: sale.status === 'Pending' ? 1 : 0,
          reject: sale.status === 'Reject' ? 1 : 0,
          accRate: 0,
          target_pengajuan: promoterData?.target || 0,
          target_closing: 0,
        });
      }
    });

    const statsArray = Array.from(promoterMap.values()).map((stat) => ({
      ...stat,
      accRate: stat.total > 0 ? (stat.acc / stat.total) * 100 : 0,
    }));

    // Sort by total descending (highest first)
    statsArray.sort((a, b) => b.total - a.total);

    setStats(statsArray);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalStats = stats.reduce(
    (acc, stat) => ({
      total: acc.total + stat.total,
      acc: acc.acc + stat.acc,
      pending: acc.pending + stat.pending,
      reject: acc.reject + stat.reject,
    }),
    { total: 0, acc: 0, pending: 0, reject: 0 }
  );

  const dapatLimit = totalStats.acc + totalStats.pending;
  const closingRate = totalStats.total > 0 ? ((totalStats.acc / totalStats.total) * 100).toFixed(1) : '0';
  const pendingRate = totalStats.total > 0 ? ((totalStats.pending / totalStats.total) * 100).toFixed(1) : '0';
  const rejectRate = totalStats.total > 0 ? ((totalStats.reject / totalStats.total) * 100).toFixed(1) : '0';
  const dapatLimitRate = totalStats.total > 0 ? ((dapatLimit / totalStats.total) * 100).toFixed(1) : '0';

  // Top 3 and Bottom 3 promotors (based on pengajuan/total)
  const sortedByTotalDesc = [...stats].sort((a, b) => b.total - a.total);
  const sortedByTotalAsc = [...stats].sort((a, b) => a.total - b.total);
  const top3 = sortedByTotalDesc.slice(0, 3);
  const bottom3 = sortedByTotalAsc.slice(0, 3); // Mulai dari yang 0

  const getFirstName = (fullName: string) => fullName.split(' ')[0];

  const getMonthName = (monthStr: string) => {
    const [year, monthNum] = monthStr.split('-');
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${months[parseInt(monthNum) - 1]} ${year}`;
  };

  const generateImage = async () => {
    if (!imageRef.current) {
      alert('Tidak ada data untuk di-generate. Silakan klik "Cari Data" terlebih dahulu.');
      return;
    }
    
    setGenerating(true);
    try {
      // Get the actual dimensions of the element
      const element = imageRef.current;
      const rect = element.getBoundingClientRect();
      
      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
        cacheBust: true,
      });
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `rekap-${month}-${area !== 'all' ? area : 'semua'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating image:', err);
      alert('Gagal generate gambar: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setGenerating(false);
  };

  const exportToExcel = () => {
    if (stats.length === 0) {
      alert('Tidak ada data untuk di-export');
      return;
    }

    const data = stats.map((stat, index) => ({
      'No': index + 1,
      'Promotor': stat.promoter_name,
      'Toko': stat.store_name || '-',
      'Target': stat.target_pengajuan || 0,
      'Pengajuan': stat.total,
      '%': stat.target_pengajuan > 0 ? Math.round((stat.total / stat.target_pengajuan) * 100) : 0,
      'ACC': stat.acc,
      'Pending': stat.pending,
      'Reject': stat.reject,
      'Closing Rate (%)': stat.accRate.toFixed(1),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Bulanan');

    // Auto-size columns
    const colWidths = [
      { wch: 5 },   // No
      { wch: 25 },  // Promotor
      { wch: 20 },  // Toko
      { wch: 10 },  // Target
      { wch: 12 },  // Pengajuan
      { wch: 8 },   // %
      { wch: 8 },   // ACC
      { wch: 10 }, // Pending
      { wch: 10 }, // Reject
      { wch: 15 }, // Closing Rate
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `rekap-bulanan-${month}-${area !== 'all' ? area : 'semua'}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Filters + Export Buttons */}
      <div className="bg-white rounded-lg shadow-sm p-3">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2 sm:gap-3">
          <div className="col-span-1">
            <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Area</label>
            <select
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setSator('all'); // Reset sator when area changes
              }}
              className="w-full px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
              disabled={accessibleAreas.length === 1}
            >
              {accessibleAreas.length > 1 && <option value="all">Semua</option>}
              {accessibleAreas.includes('KUPANG') && <option value="KUPANG">Kupang</option>}
              {accessibleAreas.includes('KABUPATEN') && <option value="KABUPATEN">Kabupaten</option>}
              {accessibleAreas.includes('SUMBA') && <option value="SUMBA">Sumba</option>}
            </select>
          </div>

          {availableSators.length > 0 && (
            <div className="col-span-1">
              <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Sator</label>
              <select
                value={sator}
                onChange={(e) => setSator(e.target.value)}
                className="w-full px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Semua Sator</option>
                {profile?.role === 'sator' && <option value="own">Tim Saya</option>}
                {availableSators.map((s) => (
                  <option key={s} value={s}>{s.replace('TUTOR ', '')}</option>
                ))}
              </select>
            </div>
          )}

          <div className="col-span-1">
            <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Bulan</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button 
            onClick={fetchStats} 
            disabled={loading} 
            className="col-span-1 px-3 py-1.5 text-xs sm:text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '...' : 'Cari'}
          </button>

          <div className="col-span-2 sm:col-span-1 flex gap-2 sm:ml-auto">
            <button 
              onClick={exportToExcel} 
              disabled={stats.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4" /> Excel
            </button>
            <button 
              onClick={generateImage} 
              disabled={generating || stats.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <Image className="h-3 w-3 sm:h-4 sm:w-4" /> {generating ? '...' : 'Gambar'}
            </button>
          </div>
        </div>
      </div>

      {/* Compact Stats Grid - Responsive */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <div className="bg-blue-50 rounded-lg p-2 sm:p-3 text-center border border-blue-100">
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{totalStats.total}</p>
          <p className="text-[10px] sm:text-xs text-blue-600">Pengajuan</p>
        </div>
        <div className="bg-indigo-50 rounded-lg p-2 sm:p-3 text-center border border-indigo-100">
          <p className="text-xl sm:text-2xl font-bold text-indigo-600">{dapatLimit}</p>
          <p className="text-[10px] sm:text-xs text-indigo-600">Dapat Limit</p>
        </div>
        <div className="bg-green-50 rounded-lg p-2 sm:p-3 text-center border border-green-100">
          <p className="text-xl sm:text-2xl font-bold text-green-600">{totalStats.acc}</p>
          <p className="text-[10px] sm:text-xs text-green-600">Closing</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-2 sm:p-3 text-center border border-yellow-100">
          <p className="text-xl sm:text-2xl font-bold text-yellow-600">{totalStats.pending}</p>
          <p className="text-[10px] sm:text-xs text-yellow-600">Pending</p>
        </div>
        <div className="bg-red-50 rounded-lg p-2 sm:p-3 text-center border border-red-100 col-span-3 sm:col-span-1">
          <p className="text-xl sm:text-2xl font-bold text-red-600">{totalStats.reject}</p>
          <p className="text-[10px] sm:text-xs text-red-600">Reject</p>
        </div>
      </div>

      {/* Generate Image Section - Hidden, only for capture */}
      {stats.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
          Tidak ada data untuk bulan yang dipilih.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Hidden section for image generation */}
          <div className="absolute -left-[9999px] -top-[9999px]">
          <div ref={imageRef} className="bg-white p-6 border rounded-lg overflow-visible w-[800px]">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">REKAP BULANAN VAST</h2>
              <p className="text-lg text-gray-600">{getMonthName(month)}</p>
              <p className="text-sm text-gray-500">Area: {area !== 'all' ? area : 'Semua Area'}</p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-5 gap-3 mb-6">
              <div className="bg-blue-50 p-3 rounded text-center">
                <p className="text-xs text-blue-700">Pengajuan</p>
                <p className="text-xl font-bold text-blue-600">{totalStats.total}</p>
              </div>
              <div className="bg-indigo-50 p-3 rounded text-center">
                <p className="text-xs text-indigo-700">Dapat Limit</p>
                <p className="text-xl font-bold text-indigo-600">{dapatLimit}</p>
              </div>
              <div className="bg-green-50 p-3 rounded text-center">
                <p className="text-xs text-green-700">Closing</p>
                <p className="text-xl font-bold text-green-600">{totalStats.acc}</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded text-center">
                <p className="text-xs text-yellow-700">Pending</p>
                <p className="text-xl font-bold text-yellow-600">{totalStats.pending}</p>
              </div>
              <div className="bg-red-50 p-3 rounded text-center">
                <p className="text-xs text-red-700">Reject</p>
                <p className="text-xl font-bold text-red-600">{totalStats.reject}</p>
              </div>
            </div>

            {/* Top 3 & Bottom 3 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Top 3 */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-green-800">Top 3 Promotor</h4>
                </div>
                {top3.map((p, idx) => (
                  <div key={p.promoter_name} className="flex items-center justify-between py-2 border-b border-green-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-800">{getFirstName(p.promoter_name)}</span>
                    </div>
                    <span className="text-sm font-bold text-green-600">{p.total} pengajuan</span>
                  </div>
                ))}
              </div>

              {/* Bottom 3 */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <h4 className="font-semibold text-red-800">Bottom 3 Promotor</h4>
                </div>
                {bottom3.map((p, idx) => (
                  <div key={p.promoter_name} className="flex items-center justify-between py-2 border-b border-red-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-800">{getFirstName(p.promoter_name)}</span>
                    </div>
                    <span className="text-sm font-bold text-red-600">{p.total} pengajuan</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Full Table */}
            <div className="border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 text-xs">No</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 text-xs">Promotor</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 text-xs">Target</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 text-xs">Pengajuan</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 text-xs">%</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 text-xs">Closing</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 text-xs">Pending</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 text-xs">Reject</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((stat, index) => {
                    const pengajuanPercent = stat.target_pengajuan > 0 
                      ? Math.round((stat.total / stat.target_pengajuan) * 100) 
                      : 0;
                    const percentColor = pengajuanPercent >= 100 ? 'text-green-600' 
                      : pengajuanPercent >= 50 ? 'text-yellow-600' 
                      : 'text-red-600';
                    
                    return (
                      <tr key={stat.promoter_name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1.5 text-gray-700 text-xs">{index + 1}</td>
                        <td className="px-2 py-1.5 font-medium text-gray-900 text-xs">{stat.promoter_name}</td>
                        <td className="px-2 py-1.5 text-center text-xs text-gray-700">{stat.target_pengajuan || '-'}</td>
                        <td className="px-2 py-1.5 text-center font-semibold text-xs text-gray-900">{stat.total}</td>
                        <td className={`px-2 py-1.5 text-center font-bold text-xs ${percentColor}`}>
                          {stat.target_pengajuan > 0 ? `${pengajuanPercent}%` : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-center text-green-600 text-xs">{stat.acc}</td>
                        <td className="px-2 py-1.5 text-center text-yellow-600 text-xs">{stat.pending}</td>
                        <td className="px-2 py-1.5 text-center text-red-600 text-xs">{stat.reject}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-4 text-center text-xs text-gray-400">
              Generated: {new Date().toLocaleString('id-ID')}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Promoter Stats - Mobile Card / Desktop Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-3 sm:p-4 border-b border-gray-200">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900">
            Performa Promotor ({stats.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-600">Loading...</div>
        ) : stats.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            Tidak ada data untuk bulan yang dipilih
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="sm:hidden divide-y divide-gray-100">
              {stats.map((stat, index) => {
                const pengajuanPercent = stat.target_pengajuan > 0 
                  ? Math.round((stat.total / stat.target_pengajuan) * 100) 
                  : 0;
                const percentColor = pengajuanPercent >= 100 ? 'text-green-600' 
                  : pengajuanPercent >= 50 ? 'text-yellow-600' 
                  : 'text-red-600';
                
                return (
                  <div key={stat.promoter_name} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-gray-200 text-gray-700 rounded-full flex items-center justify-center text-[10px] font-medium">
                          {index + 1}
                        </span>
                        <span className="font-medium text-gray-900 text-sm">{stat.promoter_name}</span>
                      </div>
                      {stat.target_pengajuan > 0 && (
                        <span className={`text-xs font-bold ${percentColor}`}>{pengajuanPercent}%</span>
                      )}
                    </div>
                    {stat.store_name && (
                      <p className="text-xs text-gray-500 mb-2 ml-7">{stat.store_name}</p>
                    )}
                    <div className="grid grid-cols-5 gap-1 text-center text-xs ml-7">
                      <div>
                        <p className="text-gray-500">Target</p>
                        <p className="font-medium text-gray-700">{stat.target_pengajuan || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Ajuan</p>
                        <p className="font-bold text-gray-900">{stat.total}</p>
                      </div>
                      <div>
                        <p className="text-green-600">ACC</p>
                        <p className="font-medium text-green-600">{stat.acc}</p>
                      </div>
                      <div>
                        <p className="text-yellow-600">Pend</p>
                        <p className="font-medium text-yellow-600">{stat.pending}</p>
                      </div>
                      <div>
                        <p className="text-red-600">Rej</p>
                        <p className="font-medium text-red-600">{stat.reject}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Promotor</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Toko</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Target</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Pengajuan</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">%</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Closing</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Pending</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Reject</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.map((stat, index) => {
                    const pengajuanPercent = stat.target_pengajuan > 0 
                      ? Math.round((stat.total / stat.target_pengajuan) * 100) 
                      : 0;
                    const percentColor = pengajuanPercent >= 100 ? 'text-green-600' 
                      : pengajuanPercent >= 50 ? 'text-yellow-600' 
                      : 'text-red-600';
                    
                    return (
                      <tr key={stat.promoter_name} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{index + 1}</td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">{stat.promoter_name}</td>
                        <td className="px-3 py-2 text-sm text-gray-600">{stat.store_name || '-'}</td>
                        <td className="px-3 py-2 text-sm text-center text-gray-600">{stat.target_pengajuan || '-'}</td>
                        <td className="px-3 py-2 text-sm text-center font-semibold text-gray-900">{stat.total}</td>
                        <td className={`px-3 py-2 text-sm text-center font-bold ${percentColor}`}>
                          {stat.target_pengajuan > 0 ? `${pengajuanPercent}%` : '-'}
                        </td>
                        <td className="px-3 py-2 text-sm text-center text-green-600 font-medium">{stat.acc}</td>
                        <td className="px-3 py-2 text-sm text-center text-yellow-600">{stat.pending}</td>
                        <td className="px-3 py-2 text-sm text-center text-red-600">{stat.reject}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
