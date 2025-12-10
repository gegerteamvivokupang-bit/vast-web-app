'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, getAccessibleAreas } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { formatDate, formatDateForInput, getDateRange } from '@/lib/utils';
import { Download, Copy, Check } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Sale {
  id: string;
  sale_date: string;
  promoter_name: string;
  status: string;
  phone_type: string;
  store_name?: string;
  area_detail?: string;
  sator?: string;
  image_url?: string;
}

interface Promoter {
  id: string;
  name: string;
  sator: string;
  store_name?: string;
}

type SalesStatus = 'ACC' | 'Pending' | 'Reject';
type VastStatus = 'ACC' | 'Belum disetujui' | 'Dapat limit tapi belum proses';

interface VastStoreRow {
  name: string | null;
  area_detail: string | null;
}

interface VastPromoterRow {
  sator: string | null;
}

interface VastApplicationRow {
  id: string;
  customer_name: string | null;
  status_pengajuan: VastStatus;
  promoter_name: string | null;
  store_id: string | null;
  sale_date: string | null;
  stores: VastStoreRow | null | VastStoreRow[];
  promoters: VastPromoterRow | null | VastPromoterRow[];
}

interface PromoterRow {
  id: string;
  name: string;
  sator: string;
  stores: VastStoreRow | null | VastStoreRow[];
}

export default function LaporanHarianPage() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [area, setArea] = useState<string>('all');
  const [sator, setSator] = useState<string>('all'); // Default: 'all', will be set to 'own' for sator role
  const [availableSators, setAvailableSators] = useState<string[]>([]);
  const [preset, setPreset] = useState<string>('today');
  const [fromDate, setFromDate] = useState<string>(formatDateForInput(new Date()));
  const [toDate, setToDate] = useState<string>(formatDateForInput(new Date()));

  // Get accessible areas for this user
  const accessibleAreas = useMemo(() => (profile ? getAccessibleAreas(profile) : []), [profile]);

  // Track if initial setup is done
  const [initialized, setInitialized] = useState(false);

  // Single useEffect for initial setup
  useEffect(() => {
    if (!profile || initialized) return;
    
    // Set area if user has limited access
    if (accessibleAreas.length === 1) {
      setArea(accessibleAreas[0]);
    }
    
    // Set default sator to 'own' only for sator role
    if (profile.role === 'sator') {
      setSator('own');
    }
    
    // Fetch available sators for spv_area
    if (profile.role === 'spv_area' && profile.area && profile.area !== 'ALL') {
      supabase
        .from('sales_with_details')
        .select('sator')
        .eq('area_detail', profile.area)
        .not('sator', 'is', null)
        .then(({ data }) => {
          if (data) {
            const uniqueSators = Array.from(new Set(data.map((d) => d.sator).filter(Boolean))) as string[];
            uniqueSators.sort();
            setAvailableSators(uniqueSators);
          }
        });
    }
    
    setInitialized(true);
  }, [profile, initialized, accessibleAreas]);

  // Update date range when preset changes
  useEffect(() => {
    if (preset !== 'custom') {
      const range = getDateRange(preset);
      setFromDate(formatDateForInput(range.from));
      setToDate(formatDateForInput(range.to));
    }
  }, [preset]);

  const fetchSales = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
    
    // Query 1: sales_with_details (Excel data) - only select needed columns
    let salesQuery = supabase
      .from('sales_with_details')
      .select('id, sale_date, promoter_name, status, phone_type, store_name, area_detail, sator, image_url')
      .gte('sale_date', fromDate)
      .lte('sale_date', toDate)
      .order('sale_date', { ascending: false })
      .limit(500);

    // Query 2: vast_finance_applications (Form data)
    const vastQuery = supabase
      .from('vast_finance_applications')
      .select(`
        id,
        customer_name,
        status_pengajuan,
        promoter_name,
        store_id,
        sale_date,
        stores (name, area_detail),
        promoters (sator)
      `)
      .is('deleted_at', null)
      .gte('sale_date', fromDate)
      .lte('sale_date', toDate)
      .limit(500);

    // Apply area filter to sales
    if (area !== 'all') {
      salesQuery = salesQuery.eq('area_detail', area);
    } else if (profile.role !== 'super_admin' && profile.role !== 'manager_area') {
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

    // For sator role, filter by selected sator
    if (profile.role === 'sator') {
      if (sator === 'own' && profile.sator_name) {
        salesQuery = salesQuery.eq('sator', profile.sator_name);
      } else if (sator !== 'all' && sator !== 'own') {
        salesQuery = salesQuery.eq('sator', sator);
      } else if (sator === 'all') {
        const sators: string[] = [];
        if (profile.sator_name) sators.push(profile.sator_name);
        if (profile.can_view_other_sators) sators.push(...profile.can_view_other_sators);
        if (sators.length > 0) {
          salesQuery = salesQuery.in('sator', sators);
        }
      }
    }

    // For spv_area role, filter by selected sator if not 'all'
    if (profile.role === 'spv_area' && sator !== 'all') {
      salesQuery = salesQuery.eq('sator', sator);
    }

    // Build promoters query
    let promotersQuery = supabase
      .from('promoters')
      .select('id, name, sator, store_id, stores(name, area_detail)')
      .eq('is_active', true);

    if (profile.role === 'sator') {
      const satorsList: string[] = [];
      if (profile.sator_name) satorsList.push(profile.sator_name);
      if (profile.can_view_other_sators) satorsList.push(...profile.can_view_other_sators);
      if (satorsList.length > 0) {
        promotersQuery = promotersQuery.in('sator', satorsList);
      }
    }

    // Execute ALL queries in parallel (including promoters)
    const [salesResult, vastResult, promotersResult] = await Promise.all([
      salesQuery, 
      vastQuery,
      promotersQuery
    ]);

    if (salesResult.error) {
      console.error('Error fetching sales:', salesResult.error);
    }
    if (vastResult.error) {
      console.error('Error fetching vast:', vastResult.error);
    }

    // Transform vast data to match Sale interface
    const vastSales: Sale[] = (vastResult.data || []).map((v: VastApplicationRow) => {
      const storeData = Array.isArray(v.stores) ? v.stores[0] : v.stores;
      const promoterData = Array.isArray(v.promoters) ? v.promoters[0] : v.promoters;
      
      // Map status
      const status = v.status_pengajuan === 'ACC' ? 'ACC'
        : v.status_pengajuan === 'Belum disetujui' ? 'Reject'
        : 'Pending';

      return {
        id: v.id,
        sale_date: v.sale_date || '',
        promoter_name: v.promoter_name || '',
        status,
        phone_type: '',
        store_name: storeData?.name || '',
        area_detail: storeData?.area_detail || '',
        sator: promoterData?.sator || '',
      };
    });

    // Filter vast data by area if needed
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

    // Filter vast data by sator (same logic as sales)
    if (profile.role === 'sator') {
      if (sator === 'own' && profile.sator_name) {
        filteredVastSales = filteredVastSales.filter(v => v.sator === profile.sator_name);
      } else if (sator !== 'all' && sator !== 'own') {
        filteredVastSales = filteredVastSales.filter(v => v.sator === sator);
      } else if (sator === 'all') {
        const sators: string[] = [];
        if (profile.sator_name) sators.push(profile.sator_name);
        if (profile.can_view_other_sators) sators.push(...profile.can_view_other_sators);
        if (sators.length > 0) {
          filteredVastSales = filteredVastSales.filter(v => sators.includes(v.sator || ''));
        }
      }
    }

    // For spv_area role, filter vast by selected sator if not 'all'
    if (profile.role === 'spv_area' && sator !== 'all') {
      filteredVastSales = filteredVastSales.filter(v => v.sator === sator);
    }

    // Combine and sort by date
    const combinedSales = [...(salesResult.data || []), ...filteredVastSales]
      .sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());

    setSales(combinedSales);

    // Process promoters data (already fetched in parallel)
    if (promotersResult.data) {
      let filtered = promotersResult.data as PromoterRow[];
      
      // Filter by area for SPV
      if (profile.role === 'spv_area' && profile.area !== 'ALL') {
        filtered = filtered.filter((p) => {
          const storeInfo = Array.isArray(p.stores) ? p.stores[0] : p.stores;
          return storeInfo?.area_detail === profile.area;
        });
      }

      // Filter by accessible areas for non-admin roles
      if (profile.role !== 'super_admin' && profile.role !== 'manager_area' && profile.role !== 'spv_area') {
        filtered = filtered.filter((p) => {
          const storeInfo = Array.isArray(p.stores) ? p.stores[0] : p.stores;
          return storeInfo && accessibleAreas.includes(storeInfo.area_detail || '');
        });
      }
      
      // Apply sator filter if selected
      if (sator !== 'all' && sator !== 'own') {
        filtered = filtered.filter((p) => p.sator === sator);
      }
      
      const mapped = filtered.map((p) => {
        const storeInfo = Array.isArray(p.stores) ? p.stores[0] : p.stores;
        return {
          id: p.id,
          name: p.name,
          sator: p.sator,
          store_name: storeInfo?.name || '-',
        };
      });
      setPromoters(mapped);
    }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  }, [accessibleAreas, area, fromDate, profile, sator, toDate]);

  // Auto-fetch when initialized and filters change - with debounce
  useEffect(() => {
    if (!profile || !initialized) return;

    const timer = setTimeout(() => {
      fetchSales();
    }, 100); // Small debounce to batch state changes

    return () => clearTimeout(timer);
  }, [profile, initialized, area, sator, fromDate, toDate, fetchSales]);

  const getFirstName = (fullName: string) => {
    return fullName.split(' ')[0];
  };

  const formatStatusLabel = (status: string) => {
    return status === 'ACC' ? 'Closing' : status;
  };

  const generateWAText = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const currentArea = area !== 'all' ? area : (profile?.area || 'ALL');
    const isSPV = profile?.role === 'spv_area';
    const isSator = profile?.role === 'sator';

    let text = '';
    text += '📊 *LAPORAN HARIAN VAST*\n';
    text += '━━━━━━━━━━━━━━━━━━━━━\n';
    text += `📍 Area: ${currentArea}\n`;
    
    if (isSator && profile?.sator_name) {
      const satorDisplayName = profile.sator_name.replace('TUTOR ', '').replace('SPV ', '');
      text += `👤 Sator: ${satorDisplayName}\n`;
    } else if (isSPV) {
      text += `👤 SPV: ${profile?.name || ''}\n`;
    }
    
    text += `📅 ${dateStr}, ${timeStr}\n\n`;

    if (isSPV) {
      text += `📈 *TOTAL AREA ${currentArea}*\n`;
    } else {
      text += '📈 *RINGKASAN*\n';
    }
    text += `• Pengajuan   : ${stats.total}\n`;
    text += `• Dapat Limit : ${stats.dapatLimit}\n`;
    text += `• Closing     : ${stats.closing}\n`;
    text += `• Pending     : ${stats.pending}\n`;
    text += `• Reject      : ${stats.reject}\n\n`;

    // Group sales by sator for SPV view
    if (isSPV) {
      const salesBySator: Record<string, Sale[]> = {};
      sales.forEach((sale) => {
        const satorKey = sale.sator || 'Lainnya';
        if (!salesBySator[satorKey]) salesBySator[satorKey] = [];
        salesBySator[satorKey].push(sale);
      });

      text += '✅ *ADA AKTIVITAS*\n';
      Object.keys(salesBySator).sort().forEach((satorName) => {
        const satorSales = salesBySator[satorName];
        const displayName = satorName.replace('TUTOR ', '').replace('SPV ', '');
        text += `${displayName}:\n`;
        satorSales.forEach((sale, idx) => {
          const firstName = getFirstName(sale.promoter_name);
          const storeName = sale.store_name || '-';
          const statusLabel = formatStatusLabel(sale.status);
          text += `${idx + 1}. ${firstName} - ${storeName} → ${statusLabel}\n`;
        });
        text += '\n';
      });

      // Belum ada aktivitas - grouped by sator
      const promotersWithSales = new Set(sales.map((s) => s.promoter_name));
      const promotersNoActivity = promoters.filter((p) => !promotersWithSales.has(p.name));

      if (promotersNoActivity.length > 0) {
        const noActivityBySator: Record<string, Promoter[]> = {};
        promotersNoActivity.forEach((p) => {
          if (!noActivityBySator[p.sator]) noActivityBySator[p.sator] = [];
          noActivityBySator[p.sator].push(p);
        });

        text += '❌ *BELUM ADA AKTIVITAS*\n';
        Object.keys(noActivityBySator).sort().forEach((satorName) => {
          const satorPromoters = noActivityBySator[satorName];
          const displayName = satorName.replace('TUTOR ', '').replace('SPV ', '');
          text += `${displayName}:\n`;
          satorPromoters.forEach((p) => {
            const firstName = getFirstName(p.name);
            text += `• ${firstName} - ${p.store_name}\n`;
          });
          text += '\n';
        });
      }
    } else {
      // Sator view - simple list
      if (sales.length > 0) {
        text += '✅ *ADA AKTIVITAS*\n';
        sales.forEach((sale, idx) => {
          const firstName = getFirstName(sale.promoter_name);
          const storeName = sale.store_name || '-';
          const statusLabel = formatStatusLabel(sale.status);
          text += `${idx + 1}. ${firstName} - ${storeName} → ${statusLabel}\n`;
        });
        text += '\n';
      }

      // Belum ada aktivitas
      const promotersWithSales = new Set(sales.map((s) => s.promoter_name));
      const promotersNoActivity = promoters.filter((p) => !promotersWithSales.has(p.name));

      if (promotersNoActivity.length > 0) {
        text += '❌ *BELUM ADA AKTIVITAS*\n';
        promotersNoActivity.forEach((p) => {
          const firstName = getFirstName(p.name);
          text += `• ${firstName} - ${p.store_name}\n`;
        });
      }
    }

    text += '━━━━━━━━━━━━━━━━━━━━━';

    return text;
  };

  const copyToClipboard = () => {
    const text = generateWAText();
    
    // Create textarea element
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    
    try {
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        alert('Gagal copy. Silakan copy manual dari preview di bawah.');
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Gagal copy. Silakan copy manual dari preview di bawah.');
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const acc = sales.filter((s) => s.status === 'ACC').length;
  const pending = sales.filter((s) => s.status === 'Pending').length;
  const reject = sales.filter((s) => s.status === 'Reject').length;
  const total = sales.length;
  const dapatLimit = acc + pending;

  const stats = { total, dapatLimit, closing: acc, pending, reject };

  const exportToExcel = () => {
    if (sales.length === 0) {
      alert('Tidak ada data untuk di-export');
      return;
    }

    const data = sales.map((sale, index) => ({
      'No': index + 1,
      'Tanggal': formatDate(sale.sale_date),
      'Promotor': sale.promoter_name,
      'Toko': sale.store_name || '-',
      'Sator': sale.sator || '-',
      'Tipe HP': sale.phone_type || '-',
      'Status': sale.status,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Harian');

    ws['!cols'] = [
      { wch: 5 },   // No
      { wch: 12 },  // Tanggal
      { wch: 25 },  // Promotor
      { wch: 20 },  // Toko
      { wch: 15 },  // Sator
      { wch: 15 },  // Tipe HP
      { wch: 10 },  // Status
    ];

    XLSX.writeFile(wb, `laporan-harian-${fromDate}-${toDate}.xlsx`);
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-2 md:p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-[calc(50%-4px)] md:flex-1 md:min-w-[100px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Area</label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full px-2 py-1.5 text-xs md:text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
              disabled={accessibleAreas.length === 1}
            >
              {accessibleAreas.length > 1 && <option value="all">Semua</option>}
              {accessibleAreas.includes('KUPANG') && <option value="KUPANG">Kupang</option>}
              {accessibleAreas.includes('KABUPATEN') && <option value="KABUPATEN">Kabupaten</option>}
              {accessibleAreas.includes('SUMBA') && <option value="SUMBA">Sumba</option>}
            </select>
          </div>

          {profile?.role === 'sator' && (
            <div className="w-[calc(50%-4px)] md:flex-1 md:min-w-[100px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Sator</label>
              <select
                value={sator}
                onChange={(e) => setSator(e.target.value)}
                className="w-full px-2 py-1.5 text-xs md:text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
              >
                <option value="own">Tim Saya</option>
                {profile.can_view_other_sators?.map((s) => <option key={s} value={s}>{s.replace('TUTOR ', '')}</option>)}
                <option value="all">Semua</option>
              </select>
            </div>
          )}

          {profile?.role === 'spv_area' && availableSators.length > 0 && (
            <div className="w-[calc(50%-4px)] md:flex-1 md:min-w-[100px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Sator</label>
              <select
                value={sator}
                onChange={(e) => setSator(e.target.value)}
                className="w-full px-2 py-1.5 text-xs md:text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Semua</option>
                {availableSators.map((s) => <option key={s} value={s}>{s.replace('TUTOR ', '').replace('SPV ', '')}</option>)}
              </select>
            </div>
          )}

          <div className="w-[calc(50%-4px)] md:flex-1 md:min-w-[100px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Periode</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="w-full px-2 py-1.5 text-xs md:text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Semua</option>
              <option value="today">Hari Ini</option>
              <option value="yesterday">Kemarin</option>
              <option value="last7days">7 Hari</option>
              <option value="mtd">Bulan Ini</option>
              <option value="lastmonth">Bulan Lalu</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {preset === 'custom' && (
            <>
              <div className="w-[calc(50%-4px)] md:flex-1 md:min-w-[100px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Dari</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs md:text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="w-[calc(50%-4px)] md:flex-1 md:min-w-[100px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Sampai</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs md:text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>

        {/* Action Buttons - Separate row on mobile */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
          <Button onClick={fetchSales} disabled={loading} size="sm" className="px-3 text-xs md:text-sm">
            {loading ? '...' : 'Cari'}
          </Button>
          <div className="flex gap-2 ml-auto">
            {profile?.role !== 'manager_area' && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={copyToClipboard} 
                className={`px-2 md:px-3 text-xs ${copied ? 'bg-green-50 border-green-200' : ''}`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="ml-1 text-green-600 font-medium hidden sm:inline">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-blue-600" />
                    <span className="ml-1 text-blue-600 font-medium">WA</span>
                  </>
                )}
              </Button>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={exportToExcel} 
              disabled={sales.length === 0} 
              className="px-2 md:px-3 text-xs disabled:opacity-50"
            >
              <Download className="h-4 w-4 text-green-600" />
              <span className="ml-1 text-green-600 font-medium">Excel</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid - Responsive */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        <div className="bg-blue-50 rounded-lg p-2 md:p-3 text-center border border-blue-100">
          <p className="text-xl md:text-2xl font-bold text-blue-600">{stats.total}</p>
          <p className="text-xs text-blue-600">Pengajuan</p>
        </div>
        <div className="bg-indigo-50 rounded-lg p-2 md:p-3 text-center border border-indigo-100">
          <p className="text-xl md:text-2xl font-bold text-indigo-600">{stats.dapatLimit}</p>
          <p className="text-xs text-indigo-600">Dapat Limit</p>
        </div>
        <div className="bg-green-50 rounded-lg p-2 md:p-3 text-center border border-green-100">
          <p className="text-xl md:text-2xl font-bold text-green-600">{stats.closing}</p>
          <p className="text-xs text-green-600">Closing</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-2 md:p-3 text-center border border-yellow-100">
          <p className="text-xl md:text-2xl font-bold text-yellow-600">{stats.pending}</p>
          <p className="text-xs text-yellow-600">Pending</p>
        </div>
        <div className="bg-red-50 rounded-lg p-2 md:p-3 text-center border border-red-100">
          <p className="text-xl md:text-2xl font-bold text-red-600">{stats.reject}</p>
          <p className="text-xs text-red-600">Reject</p>
        </div>
      </div>

      {/* Copy untuk WA - Compact Preview */}
      {profile?.role !== 'manager_area' && (
        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base md:text-sm font-semibold text-gray-700">Preview WhatsApp</h3>
          </div>
          {sales.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-3 text-center text-gray-500 text-xs md:text-sm">
              Tidak ada data. Ubah filter periode.
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs md:text-sm whitespace-pre-wrap max-h-[200px] md:max-h-[300px] overflow-y-auto text-gray-900">
              {generateWAText()}
            </div>
          )}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-3 md:p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base md:text-lg font-semibold text-gray-900">
            Data ({sales.length})
          </h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToExcel} 
            className="text-xs md:text-sm"
            disabled={sales.length === 0}
          >
            <Download className="h-4 w-4 text-green-600 mr-1.5" />
            <span className="text-green-600 font-medium"><span className="hidden sm:inline">Export </span>Excel</span>
          </Button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-600">Loading...</div>
        ) : sales.length === 0 ? (
          <div className="p-8 text-center text-gray-600 text-sm">
            Tidak ada data untuk periode yang dipilih
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-100">
              {sales.map((sale) => (
                <div key={sale.id} className="p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{sale.promoter_name}</p>
                      <p className="text-xs text-gray-500 truncate">{sale.store_name || '-'}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(sale.sale_date)} {sale.phone_type ? `• ${sale.phone_type}` : ''}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${
                        sale.status === 'ACC'
                          ? 'bg-green-100 text-green-700'
                          : sale.status === 'Pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {sale.status === 'ACC' ? 'Closing' : sale.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Promotor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Toko</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Area</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe HP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatDate(sale.sale_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{sale.promoter_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{sale.store_name || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{sale.area_detail || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{sale.phone_type || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            sale.status === 'ACC'
                              ? 'bg-green-100 text-green-800'
                              : sale.status === 'Pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {sale.status === 'ACC' ? 'Closing' : sale.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
