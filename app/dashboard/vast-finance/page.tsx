'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getTodayWITA } from '@/lib/timezone';
import { useAuth, getAccessibleAreas } from '@/lib/auth-context';
import { Calendar, User, Phone, Briefcase, CreditCard, FileText } from 'lucide-react';

interface VastFinanceApplication {
  id: string;
  customer_name: string;
  customer_phone: string;
  pekerjaan: string;
  penghasilan: number | null;
  has_npwp: boolean;
  status_pengajuan: string;
  limit_amount: number | null;
  dp_amount: number | null;
  tenor: number | null;
  phone_type_name: string | null;
  promoter_name: string | null;
  store_name: string | null;
  created_at: string;
  customer_ktp_image_url: string | null;
  proof_image_url: string | null;
}

export default function VastFinanceDashboardPage() {
  const { profile } = useAuth();
  const [applications, setApplications] = useState<VastFinanceApplication[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<VastFinanceApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(getTodayWITA());

  useEffect(() => {
    const loadData = async () => {
      if (!profile) return;
      await fetchApplications();
    };
    loadData();
  }, [profile]);

  useEffect(() => {
    filterApplications();
  }, [applications, filterStatus, searchTerm, filterDate]);

  const fetchApplications = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // Build query
      let query = supabase
        .from('vast_finance_applications')
        .select(
          `
          id,
          customer_name,
          customer_phone,
          pekerjaan,
          penghasilan,
          has_npwp,
          status_pengajuan,
          limit_amount,
          dp_amount,
          tenor,
          promoter_name,
          created_at,
          customer_ktp_image_url,
          proof_image_url,
          phone_types (
            name
          ),
          stores (
            name,
            area_detail
          ),
          promoters (
            sator
          )
        `
        )
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      // Transform data
      const transformedData: VastFinanceApplication[] = (data || []).map((app: any) => ({
        id: app.id,
        customer_name: app.customer_name,
        customer_phone: app.customer_phone,
        pekerjaan: app.pekerjaan,
        penghasilan: app.penghasilan,
        has_npwp: app.has_npwp,
        status_pengajuan: app.status_pengajuan,
        limit_amount: app.limit_amount,
        dp_amount: app.dp_amount,
        tenor: app.tenor,
        phone_type_name: app.phone_types?.name || null,
        promoter_name: app.promoter_name,
        store_name: app.stores?.name || null,
        created_at: app.created_at,
        customer_ktp_image_url: app.customer_ktp_image_url,
        proof_image_url: app.proof_image_url,
      }));

      // Apply RBAC filtering on client side
      let filtered = transformedData;

      // Filter by role
      if (profile.role !== 'super_admin' && profile.role !== 'manager_area') {
        const accessibleAreas = getAccessibleAreas(profile);
        filtered = transformedData.filter((app: any) => {
          const storeData = (data || []).find((d: any) => d.id === app.id);
          const storeInfo = storeData?.stores as unknown as { name: string; area_detail: string } | null;
          return storeData && storeInfo && accessibleAreas.includes(storeInfo.area_detail);
        });
      }

      // Additional safety: SPV must always be filtered by their area
      if (profile.role === 'spv_area' && profile.area !== 'ALL') {
        filtered = filtered.filter((app: any) => {
          const storeData = (data || []).find((d: any) => d.id === app.id);
          const storeInfo = storeData?.stores as unknown as { name: string; area_detail: string } | null;
          return storeData && storeInfo && storeInfo.area_detail === profile.area;
        });
      }

      // For sator role, filter by their accessible sators
      if (profile.role === 'sator') {
        const sators: string[] = [];
        if (profile.sator_name) sators.push(profile.sator_name);
        if (profile.can_view_other_sators) sators.push(...profile.can_view_other_sators);
        if (sators.length > 0) {
          filtered = filtered.filter((app: any) => {
            const storeData = (data || []).find((d: any) => d.id === app.id);
            const promoterData = storeData?.promoters as unknown as { sator: string } | null;
            return promoterData && sators.includes(promoterData.sator);
          });
        }
      }

      setApplications(filtered);
    } catch (error) {
      console.error('Error fetching applications:', error);
      alert('Gagal memuat data pengajuan');
    } finally {
      setLoading(false);
    }
  };

  const filterApplications = () => {
    let filtered = applications;

    // Filter by date
    if (filterDate) {
      filtered = filtered.filter((app) => {
        const appDate = new Date(app.created_at).toISOString().split('T')[0];
        return appDate === filterDate;
      });
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter((app) => app.status_pengajuan === filterStatus);
    }

    // Search by customer name or phone
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.customer_name.toLowerCase().includes(term) ||
          app.customer_phone.toLowerCase().includes(term) ||
          app.promoter_name?.toLowerCase().includes(term) ||
          ''
      );
    }

    setFilteredApplications(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACC':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Belum disetujui':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Dapat limit tapi belum proses':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const stats = {
    total: filteredApplications.length,
    acc: filteredApplications.filter((a) => a.status_pengajuan === 'ACC').length,
    reject: filteredApplications.filter((a) => a.status_pengajuan === 'Belum disetujui').length,
    dapatLimit: filteredApplications.filter(
      (a) => a.status_pengajuan === 'Dapat limit tapi belum proses'
    ).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4 shadow">
          <p className="text-sm opacity-90">Total Pengajuan</p>
          <p className="text-3xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-4 shadow">
          <p className="text-sm opacity-90">ACC</p>
          <p className="text-3xl font-bold mt-1">{stats.acc}</p>
        </div>
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg p-4 shadow">
          <p className="text-sm opacity-90">Dapat Limit</p>
          <p className="text-3xl font-bold mt-1">{stats.dapatLimit}</p>
        </div>
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg p-4 shadow">
          <p className="text-sm opacity-90">Reject</p>
          <p className="text-3xl font-bold mt-1">{stats.reject}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Filter Tanggal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter Tanggal
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cari Customer/Promoter
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nama customer, telepon, atau promoter"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua Status</option>
              <option value="ACC">ACC</option>
              <option value="Dapat limit tapi belum proses">Dapat Limit</option>
              <option value="Belum disetujui">Reject</option>
            </select>
          </div>
        </div>
      </div>

      {/* Applications List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            Daftar Pengajuan ({filteredApplications.length})
          </h3>
        </div>

        {filteredApplications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CreditCard size={48} className="mx-auto mb-3 text-gray-300" />
            <p>Tidak ada data pengajuan</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredApplications.map((app) => (
              <div key={app.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900">{app.customer_name}</h4>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          app.status_pengajuan
                        )}`}
                      >
                        {getStatusLabel(app.status_pengajuan)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      {/* Customer Info */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone size={16} />
                          {app.customer_phone}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Briefcase size={16} />
                          {app.pekerjaan}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <CreditCard size={16} />
                          Penghasilan: {formatCurrency(app.penghasilan)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <FileText size={16} />
                          NPWP: {app.has_npwp ? 'Ada' : 'Tidak Ada'}
                        </div>
                      </div>

                      {/* Application Info */}
                      <div className="space-y-2">
                        {app.status_pengajuan === 'ACC' && (
                          <>
                            <div className="text-sm">
                              <span className="text-gray-600">Limit:</span>
                              <span className="font-semibold text-gray-900 ml-2">
                                {formatCurrency(app.limit_amount)}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-600">DP:</span>
                              <span className="font-semibold text-gray-900 ml-2">
                                {formatCurrency(app.dp_amount)}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-600">Tenor:</span>
                              <span className="font-semibold text-gray-900 ml-2">
                                {app.tenor ? `${app.tenor} Bulan` : '-'}
                              </span>
                            </div>
                            {app.phone_type_name && (
                              <div className="text-sm">
                                <span className="text-gray-600">Tipe HP:</span>
                                <span className="font-semibold text-gray-900 ml-2">
                                  {app.phone_type_name}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User size={16} />
                          Promoter: {app.promoter_name || '-'}
                        </div>
                        <div className="text-sm text-gray-600">
                          Toko: {app.store_name || '-'}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar size={16} />
                          {new Date(app.created_at).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Images */}
                    {(app.customer_ktp_image_url || app.proof_image_url) && (
                      <div className="mt-4 flex gap-3">
                        {app.customer_ktp_image_url && (
                          <a
                            href={app.customer_ktp_image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 underline"
                          >
                            Lihat KTP
                          </a>
                        )}
                        {app.proof_image_url && (
                          <a
                            href={app.proof_image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 underline"
                          >
                            Lihat Bukti
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
