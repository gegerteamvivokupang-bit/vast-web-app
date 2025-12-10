'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatDateForInput, getDateRange, getStartOfMonth } from '@/lib/utils';
import { Download, Copy, Check, Image, Trophy, TrendingDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toPng } from 'html-to-image';
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
}

interface StoreStats {
  store_name: string;
  area_detail: string;
  total: number;
  acc: number;
  pending: number;
  reject: number;
}

interface PromoterStats {
  promoter_name: string;
  promoter_id: string;
  store_name: string;
  area_detail: string;
  total: number;
  acc: number;
  pending: number;
  reject: number;
  target_pengajuan: number;
}

interface SPCPromoter {
  id: string;
  name: string;
  store_name: string;
  area_detail: string;
  sator: string;
}

export default function SPCGrupPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [allSPCPromoters, setAllSPCPromoters] = useState<SPCPromoter[]>([]);
  const [promoterTargets, setPromoterTargets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState<string>('mtd');
  const [fromDate, setFromDate] = useState<string>(formatDateForInput(getStartOfMonth()));
  const [toDate, setToDate] = useState<string>(formatDateForInput(new Date()));
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  
  // Derive month for rekap from fromDate
  const monthForRekap = fromDate.substring(0, 7);

  // Check access: only SPV Kupang and Sator Andri can access
  useEffect(() => {
    if (!profile) return;

    const isSPVKupang = profile.role === 'spv_area' && profile.area === 'KUPANG';
    const isSatorAndri = profile.email === 'andri@vast.com';
    const isAdmin = profile.role === 'super_admin' || profile.role === 'manager_area';

    if (!isSPVKupang && !isSatorAndri && !isAdmin) {
      alert('Anda tidak memiliki akses ke halaman ini');
      router.push('/dashboard');
    }
  }, [profile, router]);

  // Update date range when preset changes
  useEffect(() => {
    if (preset !== 'custom') {
      const range = getDateRange(preset);
      setFromDate(formatDateForInput(range.from));
      setToDate(formatDateForInput(range.to));
    }
  }, [preset]);

  // Auto-fetch on initial load
  useEffect(() => {
    const loadData = async () => {
      if (!profile) return;
      setLoading(true);
      try {
        await fetchSPCData();
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [profile]);

  const fetchSPCData = async () => {
    if (!profile) return;

    // Query 1: sales_with_details (Excel data) - filter for SPC stores
    const salesQuery = supabase
      .from('sales_with_details')
      .select('id, sale_date, promoter_name, status, phone_type, store_name, area_detail, sator')
      .gte('sale_date', fromDate)
      .lte('sale_date', toDate)
      .ilike('store_name', 'SPC%') // Filter stores that start with "SPC"
      .order('sale_date', { ascending: false })
      .limit(1000);

    // Query 2: vast_finance_applications (Form data) - filter for SPC stores
    const vastQuery = supabase
      .from('vast_finance_applications')
      .select(`
        id,
        customer_name,
        status_pengajuan,
        promoter_name,
        store_id,
        sale_date,
        stores!inner (name, area_detail),
        promoters (sator)
      `)
      .is('deleted_at', null)
      .gte('sale_date', fromDate)
      .lte('sale_date', toDate)
      .ilike('stores.name', 'SPC%') // Filter stores that start with "SPC"
      .limit(1000);

    // Execute both queries in parallel
    const [salesResult, vastResult] = await Promise.all([salesQuery, vastQuery]);

    if (salesResult.error) {
      console.error('Error fetching sales:', salesResult.error);
    }
    if (vastResult.error) {
      console.error('Error fetching vast:', vastResult.error);
    }

    // Transform vast data to match Sale interface
    const vastSales: Sale[] = (vastResult.data || []).map((v: any) => {
      const storeData = v.stores as { name: string; area_detail: string } | null;
      const promoterData = v.promoters as { sator: string } | null;

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

    // Combine and sort by date
    const combinedSales = [...(salesResult.data || []), ...vastSales]
      .sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());

    setSales(combinedSales);

    // Fetch ALL promoters from SPC stores (including those with 0 sales)
    const { data: spcStores } = await supabase
      .from('stores')
      .select('id, name, area_detail')
      .ilike('name', 'SPC%');

    if (spcStores && spcStores.length > 0) {
      const spcStoreIds = spcStores.map((s: any) => s.id);
      const storeMap = new Map(spcStores.map((s: any) => [s.id, { name: s.name, area_detail: s.area_detail }]));

      const { data: spcPromotersData } = await supabase
        .from('promoters')
        .select('id, name, store_id, sator')
        .eq('is_active', true)
        .in('store_id', spcStoreIds);

      const promoters: SPCPromoter[] = (spcPromotersData || []).map((p: any) => {
        const store = storeMap.get(p.store_id);
        return {
          id: p.id,
          name: p.name,
          store_name: store?.name || '',
          area_detail: store?.area_detail || '',
          sator: p.sator || '',
        };
      });

      setAllSPCPromoters(promoters);

      // Fetch targets for SPC promoters
      const promoterIds = promoters.map((p) => p.id);
      if (promoterIds.length > 0) {
        const { data: targetsData } = await supabase
          .from('targets')
          .select('assigned_to_id, target_value')
          .eq('assigned_to_role', 'promoter')
          .eq('target_type', 'pengajuan')
          .eq('month', monthForRekap)
          .in('assigned_to_id', promoterIds);

        const targetMap: Record<string, number> = {};
        (targetsData || []).forEach((t: any) => {
          targetMap[t.assigned_to_id] = t.target_value;
        });
        setPromoterTargets(targetMap);
      }
    }
  };

  // Calculate stats
  const acc = sales.filter((s) => s.status === 'ACC').length;
  const pending = sales.filter((s) => s.status === 'Pending').length;
  const reject = sales.filter((s) => s.status === 'Reject').length;
  const total = sales.length;
  const dapatLimit = acc + pending;

  // Group by store
  const storeStatsMap = new Map<string, StoreStats>();
  sales.forEach((sale) => {
    const storeName = sale.store_name || 'Unknown';
    const existing = storeStatsMap.get(storeName) || {
      store_name: storeName,
      area_detail: sale.area_detail || '',
      total: 0,
      acc: 0,
      pending: 0,
      reject: 0,
    };

    existing.total++;
    if (sale.status === 'ACC') existing.acc++;
    else if (sale.status === 'Pending') existing.pending++;
    else if (sale.status === 'Reject') existing.reject++;

    storeStatsMap.set(storeName, existing);
  });

  const storeStats = Array.from(storeStatsMap.values()).sort((a, b) => b.total - a.total);

  // Helper functions
  const getFirstName = (fullName: string) => fullName.split(' ')[0];

  const formatStatusLabel = (status: string) => {
    return status === 'ACC' ? 'Closing' : status;
  };

  const getMonthName = (monthStr: string) => {
    const [year, monthNum] = monthStr.split('-');
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${months[parseInt(monthNum) - 1]} ${year}`;
  };

  // Generate WhatsApp text for Laporan Harian
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

    let text = '';
    text += '📊 *LAPORAN HARIAN SPC GRUP*\n';
    text += '━━━━━━━━━━━━━━━━━━━━━\n';
    text += `📍 Kupang, Kabupaten, Sumba\n`;
    text += `📅 ${dateStr}, ${timeStr}\n\n`;

    text += '📈 *RINGKASAN*\n';
    text += `• Pengajuan   : ${total}\n`;
    text += `• Dapat Limit : ${dapatLimit}\n`;
    text += `• Closing     : ${acc}\n`;
    text += `• Pending     : ${pending}\n`;
    text += `• Reject      : ${reject}\n\n`;

    // Group by store
    const salesByStore: Record<string, Sale[]> = {};
    sales.forEach((sale) => {
      const storeKey = sale.store_name || 'Lainnya';
      if (!salesByStore[storeKey]) salesByStore[storeKey] = [];
      salesByStore[storeKey].push(sale);
    });

    if (Object.keys(salesByStore).length > 0) {
      text += '✅ *ADA AKTIVITAS*\n';
      Object.keys(salesByStore).sort().forEach((storeName) => {
        const storeSales = salesByStore[storeName];
        const storeArea = storeSales[0]?.area_detail || '';
        text += `\n*${storeName}* (${storeArea}):\n`;
        storeSales.forEach((sale, idx) => {
          const firstName = getFirstName(sale.promoter_name);
          const statusLabel = formatStatusLabel(sale.status);
          text += `${idx + 1}. ${firstName} → ${statusLabel}\n`;
        });
      });
    }

    // Find promoters with no activity
    const promotersWithSales = new Set(sales.map((s) => s.promoter_name));
    const promotersNoActivity = allSPCPromoters.filter((p) => !promotersWithSales.has(p.name));

    if (promotersNoActivity.length > 0) {
      text += '\n❌ *BELUM ADA AKTIVITAS*\n';
      // Group by store
      const noActivityByStore: Record<string, SPCPromoter[]> = {};
      promotersNoActivity.forEach((p) => {
        if (!noActivityByStore[p.store_name]) noActivityByStore[p.store_name] = [];
        noActivityByStore[p.store_name].push(p);
      });
      
      Object.keys(noActivityByStore).sort().forEach((storeName) => {
        const storePromoters = noActivityByStore[storeName];
        const storeArea = storePromoters[0]?.area_detail || '';
        text += `\n*${storeName}* (${storeArea}):\n`;
        storePromoters.forEach((p) => {
          const firstName = getFirstName(p.name);
          text += `• ${firstName}\n`;
        });
      });
    }

    text += '\n━━━━━━━━━━━━━━━━━━━━━';

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

  // Generate rekap bulanan per promoter for image - including ALL promoters (even with 0 sales)
  const generatePromoterStats = () => {
    const promoterMap = new Map<string, PromoterStats>();

    // First, initialize ALL SPC promoters with 0 stats
    allSPCPromoters.forEach((p) => {
      const key = `${p.name}|${p.store_name}`;
      promoterMap.set(key, {
        promoter_name: p.name,
        promoter_id: p.id,
        store_name: p.store_name,
        area_detail: p.area_detail,
        total: 0,
        acc: 0,
        pending: 0,
        reject: 0,
        target_pengajuan: promoterTargets[p.id] || 0,
      });
    });

    // Then update with actual sales data
    sales.forEach((sale) => {
      const key = `${sale.promoter_name}|${sale.store_name}`;
      const existing = promoterMap.get(key);
      
      if (existing) {
        existing.total++;
        if (sale.status === 'ACC') existing.acc++;
        else if (sale.status === 'Pending') existing.pending++;
        else if (sale.status === 'Reject') existing.reject++;
      } else {
        // Promoter not in our SPC list (maybe from sales data but not active) - still add them
        promoterMap.set(key, {
          promoter_name: sale.promoter_name,
          promoter_id: '',
          store_name: sale.store_name || '',
          area_detail: sale.area_detail || '',
          total: 1,
          acc: sale.status === 'ACC' ? 1 : 0,
          pending: sale.status === 'Pending' ? 1 : 0,
          reject: sale.status === 'Reject' ? 1 : 0,
          target_pengajuan: 0,
        });
      }
    });

    return Array.from(promoterMap.values()).sort((a, b) => b.total - a.total);
  };

  const promoterStats = generatePromoterStats();
  const sortedByTotalDesc = [...promoterStats].sort((a, b) => b.total - a.total);
  const sortedByTotalAsc = [...promoterStats].sort((a, b) => a.total - b.total);
  const top3Promoters = sortedByTotalDesc.slice(0, 3);
  const bottom3Promoters = sortedByTotalAsc.slice(0, 3); // Mulai dari yang 0

  const generateImage = async () => {
    if (!imageRef.current) {
      alert('Tidak ada data untuk di-generate. Silakan klik "Cari Data" terlebih dahulu.');
      return;
    }

    setGenerating(true);
    try {
      const dataUrl = await toPng(imageRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `rekap-spc-grup-${monthForRekap}.png`;
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
    if (promoterStats.length === 0) {
      alert('Tidak ada data untuk di-export');
      return;
    }

    // Sheet 1: Per Promotor
    const promoterData = promoterStats.map((stat, index) => {
      const pengajuanPercent = stat.target_pengajuan > 0 
        ? Math.round((stat.total / stat.target_pengajuan) * 100) 
        : 0;
      return {
        'No': index + 1,
        'Promotor': stat.promoter_name,
        'Toko': stat.store_name || '-',
        'Area': stat.area_detail || '-',
        'Target': stat.target_pengajuan || '-',
        'Pengajuan': stat.total,
        '% Target': stat.target_pengajuan > 0 ? `${pengajuanPercent}%` : '-',
        'Closing': stat.acc,
        'Pending': stat.pending,
        'Reject': stat.reject,
      };
    });

    // Sheet 2: Per Toko
    const storeData = storeStats.map((stat, index) => ({
      'No': index + 1,
      'Toko': stat.store_name,
      'Area': stat.area_detail || '-',
      'Total': stat.total,
      'ACC': stat.acc,
      'Pending': stat.pending,
      'Reject': stat.reject,
      'Closing Rate (%)': stat.total > 0 ? ((stat.acc / stat.total) * 100).toFixed(1) : '0',
    }));

    const wb = XLSX.utils.book_new();

    // Add promoter sheet
    const wsPromoter = XLSX.utils.json_to_sheet(promoterData);
    wsPromoter['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 20 }, { wch: 15 },
      { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(wb, wsPromoter, 'Per Promotor');

    // Add store sheet
    const wsStore = XLSX.utils.json_to_sheet(storeData);
    wsStore['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 15 },
      { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(wb, wsStore, 'Per Toko');

    XLSX.writeFile(wb, `spc-grup-${fromDate}-${toDate}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-3">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2 sm:gap-3">
          <div className="col-span-1">
            <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Periode</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-900 border border-gray-200 rounded-md focus:ring-1 focus:ring-purple-500"
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
              <div className="col-span-1">
                <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Dari</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-900 border border-gray-200 rounded-md focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Sampai</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-900 border border-gray-200 rounded-md focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </>
          )}

          <button 
            onClick={fetchSPCData} 
            disabled={loading} 
            className="col-span-1 px-3 py-1.5 text-xs sm:text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? '...' : 'Cari'}
          </button>
        </div>
      </div>

      {/* Stats Cards - 4 card utama */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        <div className="bg-blue-50 rounded-lg p-2 sm:p-3 text-center border border-blue-100">
          <p className="text-lg sm:text-xl font-bold text-blue-600">{total}</p>
          <p className="text-xs text-blue-600">Pengajuan</p>
        </div>
        <div className="bg-green-50 rounded-lg p-2 sm:p-3 text-center border border-green-100">
          <p className="text-lg sm:text-xl font-bold text-green-600">{acc}</p>
          <p className="text-xs text-green-600">ACC</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-2 sm:p-3 text-center border border-yellow-100">
          <p className="text-lg sm:text-xl font-bold text-yellow-600">{pending}</p>
          <p className="text-xs text-yellow-600">Pending</p>
        </div>
        <div className="bg-red-50 rounded-lg p-2 sm:p-3 text-center border border-red-100">
          <p className="text-lg sm:text-xl font-bold text-red-600">{reject}</p>
          <p className="text-xs text-red-600">Reject</p>
        </div>
      </div>

      {/* LAPORAN HARIAN - Copy untuk WhatsApp - Hidden for Manager Area */}
      {profile?.role !== 'manager_area' && (
        <div className="bg-white rounded-lg shadow p-3 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">📋 Laporan Harian</h3>
            <button
              onClick={copyToClipboard}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md ${
                copied 
                  ? 'bg-green-600 text-white' 
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span className="hidden sm:inline">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          {sales.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
              Tidak ada data untuk periode yang dipilih. Klik “Cari Data” atau ubah filter periode.
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
              {generateWAText()}
            </div>
          )}
        </div>
      )}

      {/* REKAP BULANAN - Generate Gambar */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">📸 Rekap Gambar</h3>
            <p className="text-xs text-gray-500">{getMonthName(monthForRekap)} • {promoterStats.length} promotor</p>
          </div>
          <button
            onClick={generateImage}
            disabled={generating || promoterStats.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Image className="h-4 w-4" />
            <span>{generating ? 'Generating...' : 'Download Gambar'}</span>
          </button>
        </div>

        {promoterStats.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
            Tidak ada data untuk bulan yang dipilih. Klik “Cari Data” untuk memuat data.
          </div>
        ) : (
          <>
          {/* Hidden section for image generation - fixed desktop layout */}
          <div className="absolute -left-[9999px] -top-[9999px]">
          <div ref={imageRef} className="bg-white p-6 border rounded-lg w-[800px]">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-purple-900">REKAP BULANAN SPC GRUP</h2>
              <p className="text-lg text-gray-600">{getMonthName(monthForRekap)}</p>
              <p className="text-sm text-gray-500">Kupang, Kabupaten, Sumba</p>
            </div>

            {/* Summary - Fixed 5 columns */}
            <div className="grid grid-cols-5 gap-3 mb-6">
              <div className="bg-blue-50 p-3 rounded text-center">
                <p className="text-xs text-blue-700">Pengajuan</p>
                <p className="text-xl font-bold text-blue-600">{total}</p>
              </div>
              <div className="bg-indigo-50 p-3 rounded text-center">
                <p className="text-xs text-indigo-700">Dapat Limit</p>
                <p className="text-xl font-bold text-indigo-600">{dapatLimit}</p>
              </div>
              <div className="bg-green-50 p-3 rounded text-center">
                <p className="text-xs text-green-700">Closing</p>
                <p className="text-xl font-bold text-green-600">{acc}</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded text-center">
                <p className="text-xs text-yellow-700">Pending</p>
                <p className="text-xl font-bold text-yellow-600">{pending}</p>
              </div>
              <div className="bg-red-50 p-3 rounded text-center">
                <p className="text-xs text-red-700">Reject</p>
                <p className="text-xl font-bold text-red-600">{reject}</p>
              </div>
            </div>

            {/* Top 3 & Bottom 3 - Fixed 2 columns */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Top 3 */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-green-800">Top 3 Promotor</h4>
                </div>
                {top3Promoters.map((p, idx) => (
                  <div key={`${p.promoter_name}-${p.store_name}`} className="flex items-center justify-between py-2 border-b border-green-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-gray-800 block">{getFirstName(p.promoter_name)}</span>
                        <span className="text-xs text-gray-500">{p.store_name}</span>
                      </div>
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
                {bottom3Promoters.map((p, idx) => (
                  <div key={`${p.promoter_name}-${p.store_name}`} className="flex items-center justify-between py-2 border-b border-red-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-gray-800 block">{getFirstName(p.promoter_name)}</span>
                        <span className="text-xs text-gray-500">{p.store_name}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-red-600">{p.total}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Full Table - Per Promoter dengan Toko */}
            <div className="border rounded-lg overflow-hidden">
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
                  {promoterStats.map((stat, index) => {
                    const pengajuanPercent = stat.target_pengajuan > 0 
                      ? Math.round((stat.total / stat.target_pengajuan) * 100) 
                      : 0;
                    const percentColor = pengajuanPercent >= 100 ? 'text-green-600' 
                      : pengajuanPercent >= 50 ? 'text-yellow-600' 
                      : 'text-red-600';
                    return (
                      <tr key={`${stat.promoter_name}-${stat.store_name}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1.5 text-gray-600 text-xs">{index + 1}</td>
                        <td className="px-2 py-1.5 text-xs">
                          <span className="font-medium text-gray-900">{stat.promoter_name}</span>
                          <span className="text-gray-500 ml-1">({stat.store_name})</span>
                        </td>
                        <td className="px-2 py-1.5 text-center text-xs text-gray-600">{stat.target_pengajuan || '-'}</td>
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

          </>
        )}
      </div>

    </div>
  );
}
