'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  getTodayWITA,
  getCurrentMonthWITA,
  getFirstDayOfMonth,
  getLastDayOfMonth,
  getYearWITA,
  getMonthWITA
} from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { ChangePinDialog } from '@/components/change-pin-dialog';
import {
  User,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  LogOut,
  Calendar,
  CreditCard,
  TrendingUp,
  Filter,
  X as CloseIcon,
  KeyRound,
  Camera,
  Loader2,
} from 'lucide-react';

interface PromoterSession {
  user_id: string;
  name: string;
  area: string;
  employee_id: string;
  role: string;
}

interface PromoterRecord {
  id: string;
  name: string;
  user_id: string;
}

interface TargetData {
  target_pengajuan: number;
  target_closing: number;
}

interface VastFinanceStats {
  total: number;
  acc: number;
  belumDisetujui: number;
  dapatLimit: number;
  pendingSelesai: number;
}

interface RecentVastFinance {
  id: string;
  customer_name: string;
  customer_phone: string;
  status_pengajuan: string;
  sale_date: string;
  source?: 'form' | 'excel';
}

interface ApplicationDetail {
  id: string;
  customer_name: string;
  customer_phone: string;
  status_pengajuan: string;
  sale_date: string;
  source: 'form' | 'excel';
  // Form data (vast_finance_applications)
  pekerjaan?: string;
  penghasilan?: number;
  has_npwp?: boolean;
  limit_amount?: number;
  dp_amount?: number;
  tenor?: number;
  phone_type_name?: string;
  store_name?: string;
  customer_ktp_image_url?: string;
  proof_image_url?: string;
  // Excel data (sales)
  phone_type?: string;
}

interface PhoneType {
  id: string;
  name: string;
}

interface PendingConversionDetail {
  id: string;
  application_id: string;
  customer_name: string;
  customer_phone: string;
  converted_at: string;
  limit_amount: number;
  new_dp_amount?: number;
  tenor: number;
  phone_type_name?: string;
  sale_date: string;
}

type DateFilter = 'today' | 'this_month' | 'last_month' | 'custom';

export default function PromoterDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<PromoterSession | null>(null);
  const [promoter, setPromoter] = useState<PromoterRecord | null>(null);
  const [targetData, setTargetData] = useState<TargetData>({
    target_pengajuan: 0,
    target_closing: 0,
  });
  const [vastFinanceStats, setVastFinanceStats] = useState<VastFinanceStats>({
    total: 0,
    acc: 0,
    belumDisetujui: 0,
    dapatLimit: 0,
    pendingSelesai: 0,
  });
  const [recentVastFinance, setRecentVastFinance] = useState<RecentVastFinance[]>([]);
  const [phoneTypes, setPhoneTypes] = useState<PhoneType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Detail modal states
  const [selectedApplication, setSelectedApplication] = useState<ApplicationDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Convert to Closing modal states
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertLimitAmount, setConvertLimitAmount] = useState('');
  const [convertDpAmount, setConvertDpAmount] = useState('');
  const [convertTenor, setConvertTenor] = useState('');
  const [convertPhoneTypeId, setConvertPhoneTypeId] = useState('');
  const [convertProofImage, setConvertProofImage] = useState<File | null>(null);
  const [convertProofImagePreview, setConvertProofImagePreview] = useState('');
  const [convertProofImageUrl, setConvertProofImageUrl] = useState('');
  const [convertProofImagePublicId, setConvertProofImagePublicId] = useState('');
  const [convertSubmitting, setConvertSubmitting] = useState(false);
  const [uploadingConvertProof, setUploadingConvertProof] = useState(false);

  // Pending Selesai modal states
  const [showPendingSelesaiModal, setShowPendingSelesaiModal] = useState(false);
  const [pendingSelesaiList, setPendingSelesaiList] = useState<PendingConversionDetail[]>([]);
  const [loadingPendingSelesai, setLoadingPendingSelesai] = useState(false);

  // PIN change dialog
  const [showPinDialog, setShowPinDialog] = useState(false);

  // Initial load - get session and promoter record
  useEffect(() => {
    const initSession = async () => {
      try {
        const sessionData = localStorage.getItem('promoter_session');
        if (!sessionData) {
          router.replace('/login');
          return;
        }

        const parsedSession = JSON.parse(sessionData);
        
        // Check session expiration (24 hours)
        const loginTime = new Date(parsedSession.loginAt).getTime();
        const now = Date.now();
        const SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
        
        if ((now - loginTime) >= SESSION_EXPIRY) {
          localStorage.removeItem('promoter_session');
          router.replace('/login');
          return;
        }
        
        setSession(parsedSession);

        // Fetch promoter record from database (source of truth)
        const { data: promoterData, error } = await supabase
          .from('promoters')
          .select('id, name, user_id')
          .eq('user_id', parsedSession.user_id)
          .single();

        if (error || !promoterData) {
          console.error('Error fetching promoter:', error);
          // Fallback: create promoter record from session
          setPromoter({
            id: '',
            name: parsedSession.name,
            user_id: parsedSession.user_id,
          });
        } else {
          setPromoter(promoterData);
          // Fetch target for this promoter (non-blocking)
          fetchTargetData(promoterData.id);
        }
      } catch (err) {
        console.error('Error in initSession:', err);
      } finally {
        // Always stop initial loading
        setLoading(false);
      }
    };

    initSession();
  }, [router]);

  // Fetch data when promoter or filters change
  useEffect(() => {
    if (promoter) {
      fetchData();
    }
  }, [promoter, dateFilter, customStartDate, customEndDate, statusFilter]);

  const fetchData = async () => {
    if (!promoter) return;
    try {
      await Promise.all([fetchVastFinanceStats(), fetchRecentVastFinance(), fetchPhoneTypes()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchPhoneTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('phone_types')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setPhoneTypes(data || []);
    } catch (error) {
      console.error('Error fetching phone types:', error);
    }
  };

  const fetchTargetData = async (promoterId: string) => {
    try {
      // Get current month in YYYY-MM format using WITA timezone
      const currentMonth = getCurrentMonthWITA();

      // Fetch target pengajuan for this promoter for current month
      const { data: targets, error } = await supabase
        .from('targets')
        .select('target_value')
        .eq('assigned_to_id', promoterId)
        .eq('assigned_to_role', 'promoter')
        .eq('month', currentMonth)
        .eq('target_type', 'pengajuan');

      if (error) {
        console.error('Error fetching targets:', error);
        return;
      }

      // Target pengajuan dari query result
      const targetPengajuan = targets && targets.length > 0 ? targets[0].target_value : 0;

      setTargetData({
        target_pengajuan: targetPengajuan,
        target_closing: 0,
      });
    } catch (error) {
      console.error('Error fetching target data:', error);
    }
  };

  // Returns date range as YYYY-MM-DD strings using WITA timezone
  const getDateRangeStrings = (): { startDateStr: string; endDateStr: string } => {
    const year = getYearWITA();
    const month = getMonthWITA();

    switch (dateFilter) {
      case 'today':
        const todayStr = getTodayWITA();
        console.log('Filter: today (WITA), date:', todayStr);
        return { startDateStr: todayStr, endDateStr: todayStr };

      case 'this_month':
        console.log('Filter: this_month (WITA)');
        return {
          startDateStr: getFirstDayOfMonth(year, month),
          endDateStr: getLastDayOfMonth(year, month),
        };

      case 'last_month':
        const lastMonthNum = month === 1 ? 12 : month - 1;
        const lastMonthYear = month === 1 ? year - 1 : year;
        console.log('Filter: last_month (WITA)');
        return {
          startDateStr: getFirstDayOfMonth(lastMonthYear, lastMonthNum),
          endDateStr: getLastDayOfMonth(lastMonthYear, lastMonthNum),
        };

      case 'custom':
        if (customStartDate && customEndDate) {
          console.log('Filter: custom', customStartDate, customEndDate);
          return { startDateStr: customStartDate, endDateStr: customEndDate };
        }
        // Fall through to default
      
      default:
        console.log('Filter: default (this_month)');
        return {
          startDateStr: getFirstDayOfMonth(year, month),
          endDateStr: getLastDayOfMonth(year, month),
        };
    }
  };

  const fetchVastFinanceStats = async () => {
    if (!promoter) return;
    
    try {
      // Get date range as strings directly to avoid timezone issues
      const { startDateStr, endDateStr } = getDateRangeStrings();

      console.log('=== fetchVastFinanceStats ===');
      console.log('promoter.user_id:', promoter.user_id);
      console.log('promoter.id:', promoter.id);
      console.log('Date range:', startDateStr, 'to', endDateStr);

      // Query 1: vast_finance_applications (form baru)
      // Gunakan user_id dari promoter record ATAU promoter_name untuk data import Excel
      // Filter by sale_date untuk konsistensi dengan tabel sales
      let vastQuery = supabase
        .from('vast_finance_applications')
        .select('status_pengajuan, sale_date')
        .gte('sale_date', startDateStr)
        .lte('sale_date', endDateStr)
        .is('deleted_at', null);

      // Filter by created_by_user_id OR promoter_name (for Excel imports)
      vastQuery = vastQuery.or(`created_by_user_id.eq.${promoter.user_id},promoter_name.ilike.%${promoter.name}%`);

      const { data: vastData, error: vastError } = await vastQuery;
      
      console.log('vastData:', vastData, 'error:', vastError);

      // Query 2: sales (Excel data)
      // Gunakan promoter_id ATAU promoter_name untuk backward compatibility
      let salesQuery = supabase
        .from('sales')
        .select('status, sale_date, promoter_id, promoter_name')
        .gte('sale_date', startDateStr)
        .lte('sale_date', endDateStr)
        .is('deleted_at', null);

      // Filter by promoter_id jika ada, atau promoter_name sebagai fallback
      if (promoter.id && promoter.id !== '') {
        // Query dengan OR: promoter_id = id ATAU promoter_name = name (case insensitive)
        salesQuery = salesQuery.or(`promoter_id.eq.${promoter.id},promoter_name.ilike.%${promoter.name}%`);
      } else if (promoter.name) {
        salesQuery = salesQuery.ilike('promoter_name', `%${promoter.name}%`);
      }

      const { data: salesData, error: salesError } = await salesQuery;

      if (vastError) console.error('Error vast query:', vastError);
      if (salesError) console.error('Error sales query:', salesError);

      // Filter sales: hanya bulan 9+ (September ke atas)
      const filteredSales = (salesData || []).filter((s: any) => {
        const month = new Date(s.sale_date).getMonth() + 1;
        return month >= 9;
      });

      // Gabungkan dan hitung stats
      let accCount = 0;
      let rejectCount = 0;
      let dapatLimitCount = 0;

      // Dari vast_finance_applications
      (vastData || []).forEach((item: any) => {
        if (statusFilter !== 'all' && item.status_pengajuan !== statusFilter) return;
        if (item.status_pengajuan === 'ACC') accCount++;
        else if (item.status_pengajuan === 'Belum disetujui') rejectCount++;
        else if (item.status_pengajuan === 'Dapat limit tapi belum proses') dapatLimitCount++;
      });

      // Dari sales (mapping status: ACC=ACC, Reject=Reject, Pending=DapatLimit)
      filteredSales.forEach((item: any) => {
        const mappedStatus = item.status === 'ACC' ? 'ACC' 
          : item.status === 'Reject' ? 'Belum disetujui' 
          : 'Dapat limit tapi belum proses';
        if (statusFilter !== 'all' && mappedStatus !== statusFilter) return;
        if (item.status === 'ACC') accCount++;
        else if (item.status === 'Reject') rejectCount++;
        else if (item.status === 'Pending') dapatLimitCount++;
      });

      const total = accCount + rejectCount + dapatLimitCount;

      // Query 3: Pending Selesai (dari pending_conversions)
      const { data: pendingSelesaiData, error: pendingSelesaiError } = await supabase
        .from('pending_conversions')
        .select('id', { count: 'exact', head: true })
        .eq('converted_by_user_id', promoter.user_id)
        .gte('sale_date', startDateStr)
        .lte('sale_date', endDateStr);

      if (pendingSelesaiError) console.error('Error pending selesai query:', pendingSelesaiError);

      const pendingSelesaiCount = pendingSelesaiData ? 0 : 0; // Use count from response
      // Get actual count from Supabase count response
      const { count: pendingSelesaiCountActual } = await supabase
        .from('pending_conversions')
        .select('*', { count: 'exact', head: true })
        .eq('converted_by_user_id', promoter.user_id)
        .gte('sale_date', startDateStr)
        .lte('sale_date', endDateStr);

      setVastFinanceStats({
        total,
        acc: accCount,
        belumDisetujui: rejectCount,
        dapatLimit: dapatLimitCount,
        pendingSelesai: pendingSelesaiCountActual || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRecentVastFinance = async () => {
    if (!promoter) return;

    try {
      const { startDateStr, endDateStr } = getDateRangeStrings();

      // Query 1: vast_finance_applications (form baru)
      // Filter by sale_date untuk konsistensi dengan tabel sales
      let vastQuery2 = supabase
        .from('vast_finance_applications')
        .select('id, customer_name, customer_phone, status_pengajuan, sale_date')
        .gte('sale_date', startDateStr)
        .lte('sale_date', endDateStr)
        .is('deleted_at', null);

      // Filter by created_by_user_id OR promoter_name (for Excel imports)
      vastQuery2 = vastQuery2.or(`created_by_user_id.eq.${promoter.user_id},promoter_name.ilike.%${promoter.name}%`);

      const { data: vastData } = await vastQuery2;

      // Query 2: sales (Excel data)
      let salesQuery = supabase
        .from('sales')
        .select('id, promoter_name, status, sale_date, created_at, promoter_id')
        .gte('sale_date', startDateStr)
        .lte('sale_date', endDateStr)
        .is('deleted_at', null);

      // Filter by promoter_id atau promoter_name
      if (promoter.id && promoter.id !== '') {
        salesQuery = salesQuery.or(`promoter_id.eq.${promoter.id},promoter_name.ilike.%${promoter.name}%`);
      } else if (promoter.name) {
        salesQuery = salesQuery.ilike('promoter_name', `%${promoter.name}%`);
      }

      const { data: salesData } = await salesQuery;

      // Filter sales bulan 9+ dan map ke format yang sama
      const mappedSales: RecentVastFinance[] = (salesData || [])
        .filter((s: any) => new Date(s.sale_date).getMonth() + 1 >= 9)
        .map((s: any) => ({
          id: s.id,
          customer_name: s.promoter_name,
          customer_phone: '-',
          status_pengajuan: s.status === 'ACC' ? 'ACC' 
            : s.status === 'Reject' ? 'Belum disetujui' 
            : 'Dapat limit tapi belum proses',
          sale_date: s.sale_date,
          source: 'excel' as const
        }));

      // Map vast data
      const mappedVast: RecentVastFinance[] = (vastData || []).map((v: any) => ({
        ...v,
        source: 'form' as const
      }));

      // Gabungkan dan sort by sale_date desc
      let combined = [...mappedVast, ...mappedSales]
        .sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());

      // Apply status filter
      if (statusFilter !== 'all') {
        combined = combined.filter((item) => item.status_pengajuan === statusFilter);
      }

      setRecentVastFinance(combined.slice(0, 50));
    } catch (error) {
      console.error('Error fetching recent:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('promoter_session');
    router.replace('/login');
  };

  const handlePendingSelesaiCardClick = async () => {
    setShowPendingSelesaiModal(true);
    setLoadingPendingSelesai(true);

    try {
      const { startDateStr, endDateStr } = getDateRangeStrings();

      const { data, error } = await supabase
        .from('pending_conversions')
        .select(`
          id,
          application_id,
          customer_name,
          customer_phone,
          converted_at,
          limit_amount,
          new_dp_amount,
          tenor,
          phone_type_name,
          sale_date
        `)
        .eq('converted_by_user_id', promoter?.user_id)
        .gte('sale_date', startDateStr)
        .lte('sale_date', endDateStr)
        .order('converted_at', { ascending: false });

      if (error) throw error;

      setPendingSelesaiList(data || []);
    } catch (error) {
      console.error('Error fetching pending selesai list:', error);
      alert('Gagal memuat data: ' + (error as any).message);
    } finally {
      setLoadingPendingSelesai(false);
    }
  };

  const handleCardClick = async (application: RecentVastFinance) => {
    setLoadingDetail(true);
    setShowDetailModal(true);

    try {
      if (application.source === 'form') {
        // Fetch from vast_finance_applications
        const { data, error } = await supabase
          .from('vast_finance_applications')
          .select(`
            id,
            customer_name,
            customer_phone,
            status_pengajuan,
            sale_date,
            pekerjaan,
            penghasilan,
            has_npwp,
            limit_amount,
            dp_amount,
            tenor,
            customer_ktp_image_url,
            proof_image_url,
            phone_types (name),
            stores (name)
          `)
          .eq('id', application.id)
          .single();

        if (error) throw error;

        setSelectedApplication({
          id: data.id,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          status_pengajuan: data.status_pengajuan,
          sale_date: data.sale_date,
          source: 'form',
          pekerjaan: data.pekerjaan,
          penghasilan: data.penghasilan,
          has_npwp: data.has_npwp,
          limit_amount: data.limit_amount,
          dp_amount: data.dp_amount,
          tenor: data.tenor,
          phone_type_name: (data.phone_types as any)?.name,
          store_name: (data.stores as any)?.name,
          customer_ktp_image_url: data.customer_ktp_image_url,
          proof_image_url: data.proof_image_url,
        });
      } else {
        // Fetch from sales (Excel data)
        const { data, error } = await supabase
          .from('sales')
          .select(`
            id,
            promoter_name,
            status,
            sale_date,
            phone_type,
            stores (name)
          `)
          .eq('id', application.id)
          .single();

        if (error) throw error;

        setSelectedApplication({
          id: data.id,
          customer_name: data.promoter_name,
          customer_phone: '-',
          status_pengajuan: data.status === 'ACC' ? 'ACC' 
            : data.status === 'Reject' ? 'Belum disetujui' 
            : 'Dapat limit tapi belum proses',
          sale_date: data.sale_date,
          source: 'excel',
          phone_type: data.phone_type,
          store_name: (data.stores as any)?.name,
        });
      }
    } catch (error) {
      console.error('Error fetching detail:', error);
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedApplication(null);
  };

  const handleOpenConvertModal = () => {
    if (!selectedApplication) return;

    // Auto-fill data dari aplikasi yang ada
    if (selectedApplication.limit_amount) {
      setConvertLimitAmount(selectedApplication.limit_amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
    } else {
      setConvertLimitAmount('');
    }

    if (selectedApplication.dp_amount) {
      setConvertDpAmount(selectedApplication.dp_amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
    } else {
      setConvertDpAmount('');
    }

    if (selectedApplication.tenor) {
      setConvertTenor(selectedApplication.tenor.toString());
    } else {
      setConvertTenor('');
    }

    // Reset other fields
    setConvertPhoneTypeId('');
    setConvertProofImage(null);
    setConvertProofImagePreview('');
    setConvertProofImageUrl('');
    setConvertProofImagePublicId('');

    setShowConvertModal(true);
  };

  const handleConvertProofImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setConvertProofImage(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setConvertProofImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Auto upload to Cloudinary
      await uploadConvertProofToCloudinary(file);
    }
  };

  const uploadConvertProofToCloudinary = async (file: File) => {
    setUploadingConvertProof(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'vast-finance/proof');

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        setConvertProofImageUrl(result.url);
        setConvertProofImagePublicId(result.publicId);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error uploading proof:', error);
      alert('Gagal upload foto bukti: ' + error.message);
    } finally {
      setUploadingConvertProof(false);
    }
  };

  const handleConvertToClosing = async () => {
    if (!selectedApplication) return;

    // Validation
    if (!convertLimitAmount || convertLimitAmount === '0') {
      alert('Limit yang didapatkan wajib diisi');
      return;
    }
    if (!convertTenor) {
      alert('Tenor wajib dipilih');
      return;
    }
    if (!convertPhoneTypeId) {
      alert('Tipe HP yang diambil wajib dipilih');
      return;
    }
    if (!convertProofImageUrl) {
      alert('Foto bukti pengajuan wajib diupload');
      return;
    }

    setConvertSubmitting(true);

    try {
      // 1. Update status di vast_finance_applications
      const { error: updateError } = await supabase
        .from('vast_finance_applications')
        .update({
          status_pengajuan: 'ACC',
          limit_amount: parseFloat(convertLimitAmount.replace(/\./g, '')),
          dp_amount: convertDpAmount ? parseFloat(convertDpAmount.replace(/\./g, '')) : null,
          tenor: parseInt(convertTenor),
          phone_type_id: convertPhoneTypeId,
          proof_image_url: convertProofImageUrl,
          proof_image_public_id: convertProofImagePublicId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedApplication.id);

      if (updateError) throw updateError;

      // 2. Get phone type name untuk record
      const phoneType = phoneTypes.find(pt => pt.id === convertPhoneTypeId);

      // 3. Insert record ke pending_conversions
      const { error: insertError } = await supabase
        .from('pending_conversions')
        .insert({
          application_id: selectedApplication.id,
          customer_name: selectedApplication.customer_name,
          customer_phone: selectedApplication.customer_phone,
          converted_by_user_id: session?.user_id || '',
          converted_by_name: session?.name || '',
          old_dp_amount: selectedApplication.dp_amount || null,
          new_dp_amount: convertDpAmount ? parseFloat(convertDpAmount.replace(/\./g, '')) : null,
          limit_amount: parseFloat(convertLimitAmount.replace(/\./g, '')),
          tenor: parseInt(convertTenor),
          phone_type_id: convertPhoneTypeId,
          phone_type_name: phoneType?.name || '',
          sale_date: selectedApplication.sale_date,
          store_name: selectedApplication.store_name || null,
        });

      // Don't throw error if insert fails, just log it
      if (insertError) {
        console.error('Warning: Failed to log conversion:', insertError);
        // Continue anyway, karena yang penting update status sudah berhasil
      }

      // Success
      alert('Berhasil diubah ke Closing (ACC)!');
      setShowConvertModal(false);
      setShowDetailModal(false);
      setSelectedApplication(null);

      // Refresh data
      await fetchData();
    } catch (error: any) {
      console.error('Error converting to closing:', error);
      alert('Gagal ubah status: ' + error.message);
    } finally {
      setConvertSubmitting(false);
    }
  };

  const formatCurrencyForInput = (value: string) => {
    // Remove non-numeric characters
    const numericValue = value.replace(/\D/g, '');
    // Format with thousand separators
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleConvertLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyForInput(e.target.value);
    setConvertLimitAmount(formatted);
  };

  const handleConvertDpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyForInput(e.target.value);
    setConvertDpAmount(formatted);
  };

  const formatCurrency = (value: number | undefined) => {
    if (!value) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACC':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'Belum disetujui':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'Dapat limit tapi belum proses':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACC':
        return 'ACC';
      case 'Belum disetujui':
        return 'Reject';
      case 'Dapat limit tapi belum proses':
        return 'Dapat Limit';
      default:
        return status;
    }
  };

  const getFilterLabel = () => {
    if (dateFilter === 'today') return 'Hari Ini';
    if (dateFilter === 'this_month') return 'Bulan Ini';
    if (dateFilter === 'last_month') {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return `Bulan ${lastMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;
    }
    if (dateFilter === 'custom' && customStartDate && customEndDate) {
      return `${new Date(customStartDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${new Date(customEndDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return 'Pilih Periode';
  };

  const resetFilters = () => {
    setDateFilter('today');
    setStatusFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  const hasActiveFilters =
    dateFilter !== 'today' ||
    statusFilter !== 'all';

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-gray-50">
      {/* Header - Modern Design */}
      <div className="bg-gradient-to-br from-green-600 via-green-600 to-emerald-700 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            {/* User Info */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-2xl border-2 border-white/30 shadow-lg">
                  <User size={28} strokeWidth={2.5} />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">{session?.name}</h1>
                <p className="text-xs text-green-100 font-medium mt-0.5">{session?.employee_id}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPinDialog(true)}
                className="bg-white/10 backdrop-blur-sm hover:bg-white/20 active:scale-95 p-3 rounded-xl transition-all duration-200 border border-white/20"
                title="Ganti PIN"
              >
                <KeyRound size={20} strokeWidth={2.5} />
              </button>
              <button
                onClick={handleLogout}
                className="bg-white/10 backdrop-blur-sm hover:bg-red-500/90 active:scale-95 p-3 rounded-xl transition-all duration-200 border border-white/20"
                title="Logout"
              >
                <LogOut size={20} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 pb-28">
        {/* Title & Filter Button */}
        <div className="mb-6 flex items-center justify-between animate-fade-in">
          <div>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2.5 rounded-2xl shadow-lg">
                <CreditCard className="text-white" size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">VAST Finance</h2>
                <p className="text-sm text-gray-600 font-medium mt-0.5">{getFilterLabel()}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 shadow-md ${
              hasActiveFilters
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-lg'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-green-300 hover:bg-green-50'
            }`}
          >
            <Filter size={20} strokeWidth={2.5} />
            <span>Filter</span>
            {hasActiveFilters && (
              <span className="bg-white/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
                {statusFilter !== 'all' ? 2 : 1}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white rounded-2xl shadow-xl p-5 mb-6 border-2 border-green-100 animate-slide-down">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900 text-lg">Filter Data</h3>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-all active:scale-95"
                >
                  <CloseIcon size={16} strokeWidth={2.5} />
                  Reset
                </button>
              )}
            </div>

            {/* Date Filter */}
            <div className="mb-5">
              <label className="block text-sm font-bold text-gray-700 mb-3">
                Periode Waktu
              </label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button
                  onClick={() => setDateFilter('today')}
                  className={`px-4 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 ${
                    dateFilter === 'today'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent hover:border-green-300'
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  onClick={() => setDateFilter('this_month')}
                  className={`px-4 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 ${
                    dateFilter === 'this_month'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent hover:border-green-300'
                  }`}
                >
                  Bulan Ini
                </button>
                <button
                  onClick={() => setDateFilter('last_month')}
                  className={`px-4 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 ${
                    dateFilter === 'last_month'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent hover:border-green-300'
                  }`}
                >
                  Bulan Lalu
                </button>
                <button
                  onClick={() => setDateFilter('custom')}
                  className={`px-4 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 ${
                    dateFilter === 'custom'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent hover:border-green-300'
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* Custom Date Range */}
              {dateFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-3 mt-3 p-4 bg-gradient-to-br from-gray-50 to-green-50/30 rounded-xl border-2 border-green-100">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">
                      Dari Tanggal
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">
                      Sampai Tanggal
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">
                Status Pengajuan
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-4 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 ${
                    statusFilter === 'all'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent hover:border-blue-300'
                  }`}
                >
                  Semua Status
                </button>
                <button
                  onClick={() => setStatusFilter('ACC')}
                  className={`px-4 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 ${
                    statusFilter === 'ACC'
                      ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent hover:border-green-300'
                  }`}
                >
                  ACC
                </button>
                <button
                  onClick={() => setStatusFilter('Dapat limit tapi belum proses')}
                  className={`px-4 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 ${
                    statusFilter === 'Dapat limit tapi belum proses'
                      ? 'bg-gradient-to-r from-yellow-600 to-yellow-700 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent hover:border-yellow-300'
                  }`}
                >
                  Dapat Limit
                </button>
                <button
                  onClick={() => setStatusFilter('Belum disetujui')}
                  className={`px-4 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 ${
                    statusFilter === 'Belum disetujui'
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent hover:border-red-300'
                  }`}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Target Progress Card */}
        {targetData.target_pengajuan > 0 ? (
          <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 text-white rounded-2xl shadow-xl p-6 mb-6 animate-fade-in border border-blue-400/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm font-semibold opacity-90 mb-1">Target Pengajuan Bulan Ini</p>
                <div className="flex items-baseline gap-3">
                  <p className="text-4xl font-black tracking-tight">{vastFinanceStats.total}</p>
                  <p className="text-xl font-bold opacity-80">/ {targetData.target_pengajuan}</p>
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm p-3.5 rounded-2xl border-2 border-white/30">
                <CreditCard className="h-9 w-9" strokeWidth={2.5} />
              </div>
            </div>

            <div className="mb-3">
              <div className="w-full bg-white/20 backdrop-blur-sm rounded-full h-4 overflow-hidden shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    vastFinanceStats.total >= targetData.target_pengajuan
                      ? 'bg-gradient-to-r from-yellow-300 to-yellow-400 shadow-lg'
                      : 'bg-gradient-to-r from-white to-blue-50 shadow-md'
                  }`}
                  style={{ width: `${Math.min((vastFinanceStats.total / targetData.target_pengajuan) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="opacity-95">
                {((vastFinanceStats.total / targetData.target_pengajuan) * 100).toFixed(0)}% tercapai
              </span>
              <span className={vastFinanceStats.total >= targetData.target_pengajuan ? 'text-yellow-300 animate-pulse' : 'opacity-95'}>
                {vastFinanceStats.total >= targetData.target_pengajuan
                  ? '🎉 Target tercapai!'
                  : `Sisa ${targetData.target_pengajuan - vastFinanceStats.total} lagi`}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-gray-100 to-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl p-4 shadow-inner">
                <TrendingUp className="h-9 w-9 text-gray-500" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-lg">Target Bulan Ini Belum Diset</p>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                  Target pengajuan VAST Finance bulan ini belum diset oleh SPV. Hubungi SPV Anda untuk mengatur target.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Stats - Periode Filter */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100 animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-900 text-lg">Ringkasan {getFilterLabel()}</h3>
            <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
              Total: {vastFinanceStats.total} pengajuan
            </span>
          </div>

          {/* Stats Grid - Modern 5 Cards */}
          <div className="grid grid-cols-5 gap-3">
            {/* Total Pengajuan */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-4 border-2 border-blue-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col items-center text-center">
                <div className="bg-blue-500 text-white w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-md">
                  <CreditCard size={20} strokeWidth={2.5} />
                </div>
                <div className="text-3xl font-black text-blue-700 tracking-tight">{vastFinanceStats.total}</div>
                <div className="text-xs text-blue-600 mt-1.5 font-bold">Pengajuan</div>
              </div>
            </div>

            {/* ACC / Closing */}
            <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-2xl p-4 border-2 border-green-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col items-center text-center">
                <div className="bg-green-500 text-white w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-md">
                  <CheckCircle size={20} strokeWidth={2.5} />
                </div>
                <div className="text-3xl font-black text-green-700 tracking-tight">{vastFinanceStats.acc}</div>
                <div className="text-xs text-green-600 mt-1.5 font-bold">Closing</div>
              </div>
            </div>

            {/* Dapat Limit */}
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 rounded-2xl p-4 border-2 border-yellow-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col items-center text-center">
                <div className="bg-yellow-500 text-white w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-md">
                  <Clock size={20} strokeWidth={2.5} />
                </div>
                <div className="text-3xl font-black text-yellow-700 tracking-tight">{vastFinanceStats.dapatLimit}</div>
                <div className="text-xs text-yellow-600 mt-1.5 font-bold">Dapat Limit</div>
              </div>
            </div>

            {/* Reject */}
            <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-2xl p-4 border-2 border-red-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col items-center text-center">
                <div className="bg-red-500 text-white w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-md">
                  <XCircle size={20} strokeWidth={2.5} />
                </div>
                <div className="text-3xl font-black text-red-700 tracking-tight">{vastFinanceStats.belumDisetujui}</div>
                <div className="text-xs text-red-600 mt-1.5 font-bold">Reject</div>
              </div>
            </div>

            {/* Pending Selesai - Clickable Card */}
            <div
              onClick={handlePendingSelesaiCardClick}
              className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl p-4 border-2 border-purple-200 shadow-sm hover:shadow-xl hover:scale-105 transition-all cursor-pointer active:scale-95"
            >
              <div className="flex flex-col items-center text-center">
                <div className="bg-purple-500 text-white w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-md">
                  <TrendingUp size={20} strokeWidth={2.5} />
                </div>
                <div className="text-3xl font-black text-purple-700 tracking-tight">{vastFinanceStats.pendingSelesai}</div>
                <div className="text-xs text-purple-600 mt-1.5 font-bold">Pending Selesai</div>
              </div>
            </div>
          </div>

          {/* Conversion Rate */}
          {vastFinanceStats.total > 0 && (
            <div className="mt-6 pt-5 border-t-2 border-gray-100">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-4 text-center border-2 border-green-200">
                  <p className="text-xs font-bold text-green-700 mb-1">Tingkat Closing</p>
                  <p className="text-2xl font-black text-green-600">
                    {((vastFinanceStats.acc / vastFinanceStats.total) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl p-4 text-center border-2 border-red-200">
                  <p className="text-xs font-bold text-red-700 mb-1">Tingkat Reject</p>
                  <p className="text-2xl font-black text-red-600">
                    {((vastFinanceStats.belumDisetujui / vastFinanceStats.total) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Applications */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100 animate-fade-in">
          <h2 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl shadow-md">
              <CreditCard size={18} className="text-white" strokeWidth={2.5} />
            </div>
            Riwayat Pengajuan ({recentVastFinance.length})
          </h2>
          {recentVastFinance.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gray-100 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CreditCard size={40} className="text-gray-400" strokeWidth={2} />
              </div>
              <p className="text-gray-700 font-semibold">Tidak ada pengajuan</p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                {statusFilter !== 'all'
                  ? `Tidak ada pengajuan dengan status ${getStatusLabel(statusFilter)}`
                  : 'Klik tombol hijau di bawah untuk mulai input'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentVastFinance.map((application) => (
                <div
                  key={application.id}
                  onClick={() => handleCardClick(application)}
                  className="border-2 border-gray-200 rounded-2xl p-4 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50/50 hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-gray-900 text-base leading-tight">{application.customer_name}</p>
                        {application.source === 'excel' && (
                          <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-lg font-bold border border-blue-200">
                            Excel
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 font-medium">{application.customer_phone}</p>
                    </div>
                    <span
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 shadow-sm ${getStatusColor(
                        application.status_pengajuan
                      )}`}
                    >
                      {getStatusLabel(application.status_pengajuan)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 font-semibold bg-gray-50 px-3 py-2 rounded-lg">
                    <Calendar size={14} strokeWidth={2.5} />
                    {new Date(application.sale_date).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Detail Pengajuan</h3>
              <button
                onClick={closeDetailModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <CloseIcon size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : selectedApplication ? (
                <div className="space-y-4">
                  {/* Status Badge */}
                  <div className="text-center">
                    <span
                      className={`inline-block px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(
                        selectedApplication.status_pengajuan
                      )}`}
                    >
                      {getStatusLabel(selectedApplication.status_pengajuan)}
                    </span>
                    {selectedApplication.source === 'excel' && (
                      <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded font-medium">
                        Data Excel
                      </span>
                    )}
                  </div>

                  {/* Customer Info */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium text-gray-900 border-b pb-2">Informasi Pemohon</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-gray-500">Nama:</span>
                      <span className="font-medium text-gray-900">{selectedApplication.customer_name}</span>
                      
                      <span className="text-gray-500">No. Telp:</span>
                      <span className="font-medium text-gray-900">{selectedApplication.customer_phone}</span>
                      
                      <span className="text-gray-500">Tanggal:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(selectedApplication.sale_date).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>

                      {selectedApplication.store_name && (
                        <>
                          <span className="text-gray-500">Toko:</span>
                          <span className="font-medium text-gray-900">{selectedApplication.store_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Form Data (vast_finance) */}
                  {selectedApplication.source === 'form' && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <h4 className="font-medium text-gray-900 border-b pb-2">Data Pekerjaan</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-gray-500">Pekerjaan:</span>
                        <span className="font-medium text-gray-900">{selectedApplication.pekerjaan || '-'}</span>
                        
                        <span className="text-gray-500">Penghasilan:</span>
                        <span className="font-medium text-gray-900">{formatCurrency(selectedApplication.penghasilan)}</span>
                        
                        <span className="text-gray-500">NPWP:</span>
                        <span className="font-medium text-gray-900">{selectedApplication.has_npwp ? 'Ada' : 'Tidak Ada'}</span>
                      </div>
                    </div>
                  )}

                  {/* ACC Data */}
                  {selectedApplication.status_pengajuan === 'ACC' && (
                    <div className="bg-green-50 rounded-lg p-4 space-y-3">
                      <h4 className="font-medium text-green-900 border-b border-green-200 pb-2">Data ACC</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {selectedApplication.limit_amount !== undefined && (
                          <>
                            <span className="text-green-700">Limit:</span>
                            <span className="font-medium text-green-900">{formatCurrency(selectedApplication.limit_amount)}</span>
                          </>
                        )}

                        {selectedApplication.dp_amount !== undefined && (
                          <>
                            <span className="text-green-700">DP:</span>
                            <span className="font-medium text-green-900">{formatCurrency(selectedApplication.dp_amount)}</span>
                          </>
                        )}

                        {selectedApplication.tenor && (
                          <>
                            <span className="text-green-700">Tenor:</span>
                            <span className="font-medium text-green-900">{selectedApplication.tenor} Bulan</span>
                          </>
                        )}
                        
                        {(selectedApplication.phone_type_name || selectedApplication.phone_type) && (
                          <>
                            <span className="text-green-700">Tipe HP:</span>
                            <span className="font-medium text-green-900">
                              {selectedApplication.phone_type_name || selectedApplication.phone_type}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dapat Limit Data */}
                  {selectedApplication.status_pengajuan === 'Dapat limit tapi belum proses' && selectedApplication.dp_amount !== undefined && (
                    <div className="bg-yellow-50 rounded-lg p-4 space-y-3">
                      <h4 className="font-medium text-yellow-900 border-b border-yellow-200 pb-2">Data Dapat Limit</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-yellow-700">DP yang diberikan sistem:</span>
                        <span className="font-medium text-yellow-900">{formatCurrency(selectedApplication.dp_amount)}</span>
                      </div>
                    </div>
                  )}

                  {/* Images */}
                  {selectedApplication.source === 'form' && (
                    <div className="space-y-3">
                      {selectedApplication.customer_ktp_image_url && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Foto KTP</h4>
                          <img
                            src={selectedApplication.customer_ktp_image_url}
                            alt="KTP"
                            className="w-full rounded-lg border"
                          />
                        </div>
                      )}
                      {selectedApplication.proof_image_url && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Foto Bukti</h4>
                          <img
                            src={selectedApplication.proof_image_url}
                            alt="Bukti"
                            className="w-full rounded-lg border"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Button Ubah ke Closing - Only for Pending */}
                  {selectedApplication.status_pengajuan === 'Dapat limit tapi belum proses' && (
                    <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                      <p className="text-sm text-yellow-800 mb-3 font-medium">
                        💡 Konsumen kembali dan ingin melanjutkan proses?
                      </p>
                      <Button
                        onClick={handleOpenConvertModal}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 font-semibold"
                      >
                        Ubah ke Closing (ACC)
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Data tidak ditemukan
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Button - Modern */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-white/95 backdrop-blur-lg border-t-2 border-gray-200 p-4 shadow-2xl z-30">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => router.push('/promoter/vast-finance')}
            className="w-full bg-gradient-to-r from-green-600 via-green-600 to-emerald-600 hover:from-green-700 hover:via-green-700 hover:to-emerald-700 text-white py-6 text-lg font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-3 border-2 border-green-400"
          >
            <div className="bg-white/20 p-1.5 rounded-xl">
              <Plus size={24} strokeWidth={3} />
            </div>
            Input Pengajuan VAST Finance
          </Button>
        </div>
      </div>

      {/* Convert to Closing Modal */}
      {showConvertModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Ubah ke Closing (ACC)</h3>
              <button
                onClick={() => setShowConvertModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <CloseIcon size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4">
              <div className="space-y-4">
                {/* Info Customer */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-900">{selectedApplication.customer_name}</p>
                  <p className="text-xs text-blue-700">{selectedApplication.customer_phone}</p>
                </div>

                {/* Limit Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Limit yang didapatkan <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-gray-500">Rp</span>
                    <input
                      type="text"
                      value={convertLimitAmount}
                      onChange={handleConvertLimitChange}
                      className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Masukkan limit yang didapatkan"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {convertLimitAmount ? 'Bisa disesuaikan jika ada perubahan' : 'Input limit yang diberikan sistem'}
                  </p>
                </div>

                {/* DP Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Berapa DP yang diberikan?
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-gray-500">Rp</span>
                    <input
                      type="text"
                      value={convertDpAmount}
                      onChange={handleConvertDpChange}
                      className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Bisa disesuaikan dengan kondisi terbaru</p>
                </div>

                {/* Tenor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tenor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={convertTenor}
                    onChange={(e) => setConvertTenor(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Pilih Tenor</option>
                    <option value="3">3 Bulan</option>
                    <option value="6">6 Bulan</option>
                    <option value="9">9 Bulan</option>
                    <option value="12">12 Bulan</option>
                    <option value="24">24 Bulan</option>
                  </select>
                </div>

                {/* Tipe HP */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipe HP yang diambil <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={convertPhoneTypeId}
                    onChange={(e) => setConvertPhoneTypeId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Pilih Tipe HP</option>
                    {phoneTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  {phoneTypes.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Belum ada tipe HP. Hubungi admin.
                    </p>
                  )}
                </div>

                {/* Upload Foto Bukti */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Foto Bukti Pengajuan <span className="text-red-500">*</span>
                  </label>
                  {convertProofImagePreview ? (
                    <div className="relative">
                      <img
                        src={convertProofImagePreview}
                        alt="Preview Bukti"
                        className="w-full h-48 object-cover rounded-lg mb-2"
                      />
                      {uploadingConvertProof && (
                        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                          <Loader2 className="animate-spin text-white" size={32} />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setConvertProofImage(null);
                          setConvertProofImagePreview('');
                          setConvertProofImageUrl('');
                          setConvertProofImagePublicId('');
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                      >
                        <span className="text-sm">×</span>
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col items-center justify-center py-4">
                        <Camera size={32} className="text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">Klik untuk upload foto bukti</p>
                        <p className="text-xs text-gray-500">JPG, PNG (Max 5MB)</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleConvertProofImageChange}
                        className="hidden"
                      />
                    </label>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Foto bukti wajib diupload untuk closing</p>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <Button
                    onClick={handleConvertToClosing}
                    disabled={convertSubmitting || uploadingConvertProof}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 font-semibold"
                  >
                    {convertSubmitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin" size={20} />
                        Menyimpan...
                      </div>
                    ) : (
                      'Simpan sebagai Closing (ACC)'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Selesai Modal */}
      {showPendingSelesaiModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Pending Selesai</h3>
                <p className="text-sm text-gray-600">Konsumen yang berhasil closing dari pending</p>
              </div>
              <button
                onClick={() => setShowPendingSelesaiModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <CloseIcon size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4">
              {loadingPendingSelesai ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                </div>
              ) : pendingSelesaiList.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 font-medium">Belum ada pending yang selesai</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {getFilterLabel()} belum ada konsumen pending yang berhasil jadi closing
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Info Summary */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-purple-900 font-medium">
                      📊 Total: {pendingSelesaiList.length} konsumen berhasil closing dari pending
                    </p>
                    <p className="text-xs text-purple-700 mt-1">
                      Periode: {getFilterLabel()}
                    </p>
                  </div>

                  {/* List Items */}
                  {pendingSelesaiList.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-purple-50 hover:border-purple-300 transition-colors"
                    >
                      {/* Customer Name & Phone */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">{item.customer_name}</p>
                          <p className="text-sm text-gray-600">{item.customer_phone}</p>
                        </div>
                        <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                          Closing
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500">Limit:</p>
                          <p className="font-medium text-gray-900">{formatCurrency(item.limit_amount)}</p>
                        </div>
                        {item.new_dp_amount && (
                          <div>
                            <p className="text-gray-500">DP:</p>
                            <p className="font-medium text-gray-900">{formatCurrency(item.new_dp_amount)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-gray-500">Tenor:</p>
                          <p className="font-medium text-gray-900">{item.tenor} Bulan</p>
                        </div>
                        {item.phone_type_name && (
                          <div>
                            <p className="text-gray-500">Tipe HP:</p>
                            <p className="font-medium text-gray-900">{item.phone_type_name}</p>
                          </div>
                        )}
                      </div>

                      {/* Dates */}
                      <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          Tanggal Penjualan: {new Date(item.sale_date).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div>
                          Closing: {new Date(item.converted_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
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

      {/* Change PIN Dialog */}
      {session && (
        <ChangePinDialog
          isOpen={showPinDialog}
          onClose={() => setShowPinDialog(false)}
          userId={session.user_id}
        />
      )}
    </div>
  );
}
