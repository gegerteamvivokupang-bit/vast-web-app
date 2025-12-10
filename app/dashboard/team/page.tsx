'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Search,
  Edit2,
  Key,
  UserMinus,
  UserCheck,
  Target as TargetIcon,
  Users,
  X,
  Trash2,
  Store as StoreIcon,
} from 'lucide-react';

interface Promoter {
  id: string;
  name: string;
  employee_id: string;
  sator: string;
  category: 'official' | 'training';
  store_id: string;
  store_name: string;
  is_active: boolean;
  user_id: string;
}

interface Store {
  id: string;
  name: string;
  area_detail: string;
}

interface Sator {
  name: string;
}

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  area: string;
  is_active: boolean;
}

export default function TeamManagementPage() {
  const { user, profile } = useAuth();
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [sators, setSators] = useState<Sator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'official' | 'training'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Tab state
  const [activeTab, setActiveTab] = useState<'promoters' | 'stores' | 'staff'>('promoters');
  
  // Staff management (Super Admin only)
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPinModal, setShowResetPinModal] = useState(false);
  const [selectedPromoter, setSelectedPromoter] = useState<Promoter | null>(null);

  // Store modal states
  const [showAddStoreModal, setShowAddStoreModal] = useState(false);
  const [showDeleteStoreModal, setShowDeleteStoreModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [storeFormData, setStoreFormData] = useState({ name: '' });
  const [storeSearch, setStoreSearch] = useState('');

  // Form states
  const [formData, setFormData] = useState<{
    name: string;
    sator: string;
    store_id: string;
    category: 'official' | 'training';
  }>({
    name: '',
    sator: '',
    store_id: '',
    category: 'official',
  });

  useEffect(() => {
    const loadData = async () => {
      if (!profile) return;
      setLoading(true);
      try {
        const promises = [fetchPromoters(), fetchStores(), fetchSators()];
        if (profile.role === 'super_admin') {
          promises.push(fetchStaffUsers());
        }
        await Promise.all(promises);
      } catch {
        // Error handled in individual fetch functions
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [profile]);

  const fetchPromoters = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('promoters')
        .select(
          `
          id,
          name,
          employee_id,
          sator,
          category,
          store_id,
          is_active,
          user_id,
          stores (
            name
          )
        `
        )
        .eq('area', profile.area)
        .order('employee_id');

      if (error) throw error;

      setPromoters(
        data?.map((p: any) => ({
          ...p,
          store_name: p.stores?.name || '-',
        })) || []
      );
    } catch (error) {
      console.error('Error fetching promoters:', error);
    }
  };

  const fetchStores = async () => {
    if (!profile) return;

    try {
      let query = supabase
        .from('stores')
        .select('id, name, area_detail')
        .order('name');

      // Filter by area for non-super_admin
      if (profile.role !== 'super_admin') {
        query = query.ilike('area_detail', `%${profile.area}%`);
      }

      const { data } = await query;
      setStores(data || []);
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
  };

  // Store CRUD functions
  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !storeFormData.name.trim()) return;

    try {
      // Generate store ID from name
      const storeId = storeFormData.name.trim().toUpperCase().replace(/\s+/g, '_');
      
      const { error } = await supabase.from('stores').insert({
        id: storeId,
        name: storeFormData.name.trim(),
        area_detail: profile.area,
      });

      if (error) {
        if (error.code === '23505') {
          alert('Toko dengan nama ini sudah ada!');
        } else {
          throw error;
        }
        return;
      }

      await fetchStores();
      setShowAddStoreModal(false);
      setStoreFormData({ name: '' });
      alert('Toko berhasil ditambahkan!');
    } catch (error) {
      console.error('Error adding store:', error);
      alert('Gagal menambahkan toko');
    }
  };

  const handleDeleteStore = async () => {
    if (!selectedStore) return;

    try {
      // Check if store has promoters
      const { data: promotersInStore } = await supabase
        .from('promoters')
        .select('id')
        .eq('store_id', selectedStore.id)
        .limit(1);

      if (promotersInStore && promotersInStore.length > 0) {
        alert('Tidak bisa menghapus toko ini karena masih ada promotor yang terdaftar!');
        return;
      }

      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', selectedStore.id);

      if (error) throw error;

      await fetchStores();
      setShowDeleteStoreModal(false);
      setSelectedStore(null);
      alert('Toko berhasil dihapus!');
    } catch (error) {
      console.error('Error deleting store:', error);
      alert('Gagal menghapus toko');
    }
  };

  const openDeleteStoreModal = (store: Store) => {
    setSelectedStore(store);
    setShowDeleteStoreModal(true);
  };

  const filteredStores = stores.filter(store =>
    store.name.toLowerCase().includes(storeSearch.toLowerCase())
  );

  const fetchSators = async () => {
    if (!profile) return;

    try {
      // Ambil daftar sator unik dari promoters di area SPV ini
      const { data } = await supabase
        .from('promoters')
        .select('sator')
        .eq('area', profile.area)
        .not('sator', 'is', null)
        .not('sator', 'eq', '');

      if (data) {
        // Ambil unique sators
        const uniqueSators = [...new Set(data.map((p: any) => p.sator))]
          .filter(Boolean)
          .sort()
          .map((name) => ({ name }));
        setSators(uniqueSators);
      }
    } catch {
      // Error fetching sators
    }
  };

  // Fetch staff users (Super Admin only)
  const fetchStaffUsers = async () => {
    if (!profile || profile.role !== 'super_admin') return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, email, role, area, is_active')
        .in('role', ['super_admin', 'manager_area', 'spv_area', 'sator'])
        .order('role')
        .order('name');

      if (error) throw error;
      setStaffUsers(data || []);
    } catch {
      // Error fetching staff
    }
  };

  // Reset password handler
  const handleResetPassword = async () => {
    if (!selectedStaff || !newPassword || !user) return;

    if (newPassword.length < 6) {
      alert('Password harus minimal 6 karakter');
      return;
    }

    setResettingPassword(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedStaff.id,
          newPassword: newPassword,
          adminUserId: user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal reset password');
      }

      alert(`Password untuk ${selectedStaff.name} berhasil direset!`);
      setShowResetPasswordModal(false);
      setSelectedStaff(null);
      setNewPassword('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Gagal reset password';
      alert(message);
    } finally {
      setResettingPassword(false);
    }
  };

  // Get role label
  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: 'Super Admin',
      manager_area: 'Manager Area',
      spv_area: 'SPV Area',
      sator: 'Sator',
    };
    return labels[role] || role;
  };

  // Filter staff users
  const filteredStaff = staffUsers.filter((staff) => {
    if (!staffSearch) return true;
    const search = staffSearch.toLowerCase();
    return (
      staff.name.toLowerCase().includes(search) ||
      staff.email.toLowerCase().includes(search) ||
      staff.role.toLowerCase().includes(search)
    );
  });

  const handleAddPromoter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      // Generate employee_id secara manual (format: KPG001, KBP001, SMB001)
      const prefix = profile.area === 'KUPANG' ? 'KPG' 
        : profile.area === 'KABUPATEN' ? 'KBP' 
        : profile.area === 'SUMBA' ? 'SMB' : 'PRO';
      
      // Hitung jumlah promoter di area ini untuk generate nomor
      const { count } = await supabase
        .from('promoters')
        .select('*', { count: 'exact', head: true })
        .eq('area', profile.area);
      
      const nextNumber = (count || 0) + 1;
      const newEmployeeId = `${prefix}${String(nextNumber).padStart(3, '0')}`;

      // Buat user_profile untuk login promoter
      const pinHash = await hashPin('1234');
      const newUserId = crypto.randomUUID(); // Generate UUID untuk user
      
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .insert({
          id: newUserId,
          name: formData.name,
          role: 'promoter',
          area: profile.area,
          employee_id: newEmployeeId,
          pin_hash: pinHash,
          is_active: true,
        })
        .select('id')
        .single();

      if (userError) {
        throw userError;
      }

      // Insert promoter dengan user_id dan employee_id
      const { error: insertError } = await supabase.from('promoters').insert({
        name: formData.name,
        sator: formData.sator,
        store_id: formData.store_id,
        category: formData.category,
        area: profile.area,
        spv_id: profile.id,
        user_id: userData.id,
        employee_id: newEmployeeId,
        is_active: true,
      });

      if (insertError) {
        throw insertError;
      }

      alert(`Promotor berhasil ditambahkan!\n\nEmployee ID: ${newEmployeeId}\nPIN: 1234\n\nPromotor bisa login dengan Employee ID dan PIN ini.`);
      setShowAddModal(false);
      resetForm();
      fetchPromoters();
      fetchSators();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert('Gagal menambahkan promotor: ' + message);
    }
  };

  // Helper function to hash PIN
  const hashPin = async (pin: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleEditPromoter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPromoter) return;

    try {
      const { error } = await supabase
        .from('promoters')
        .update({
          name: formData.name,
          sator: formData.sator,
          store_id: formData.store_id,
          category: formData.category,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPromoter.id);

      if (error) throw error;

      alert('Promotor berhasil diupdate!');
      setShowEditModal(false);
      setSelectedPromoter(null);
      resetForm();
      fetchPromoters();
    } catch (error: any) {
      alert('Gagal update promotor: ' + error.message);
    }
  };

  const handleResetPin = async (newPin: string) => {
    if (!selectedPromoter || !selectedPromoter.user_id) return;

    try {
      // Hash PIN (same as SQL function)
      const crypto = await import('crypto');
      const pinHash = crypto.createHash('sha256').update(newPin).digest('hex');

      const { error } = await supabase
        .from('user_profiles')
        .update({
          pin_hash: pinHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPromoter.user_id);

      if (error) throw error;

      alert(`PIN berhasil direset!\nEmployee ID: ${selectedPromoter.employee_id}\nPIN baru: ${newPin}`);
      setShowResetPinModal(false);
      setSelectedPromoter(null);
    } catch (error: any) {
      alert('Gagal reset PIN: ' + error.message);
    }
  };

  const handleToggleActive = async (promoter: Promoter) => {
    const action = promoter.is_active ? 'nonaktifkan' : 'aktifkan';
    
    if (!confirm(`Apakah Anda yakin ingin ${action} promotor ${promoter.name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('promoters')
        .update({
          is_active: !promoter.is_active,
        })
        .eq('id', promoter.id);

      if (error) {
        throw error;
      }

      // Also update user_profiles if user_id exists
      if (promoter.user_id) {
        await supabase
          .from('user_profiles')
          .update({
            is_active: !promoter.is_active,
          })
          .eq('id', promoter.user_id);
      }

      alert(`Promotor berhasil di${action}!`);
      fetchPromoters();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Gagal ${action} promotor: ` + message);
    }
  };

  const handleDeletePromoter = async (promoter: Promoter) => {
    const confirmMsg = `HAPUS PERMANEN promotor "${promoter.name}"?\n\n` +
      `⚠️ Data promotor akan dihapus, tapi data pengajuan di toko tetap tersimpan.\n\n` +
      `Ketik "HAPUS" untuk konfirmasi:`;
    
    const input = prompt(confirmMsg);
    if (input !== 'HAPUS') {
      if (input !== null) {
        alert('Penghapusan dibatalkan. Ketik "HAPUS" untuk konfirmasi.');
      }
      return;
    }

    try {
      // 1. Set promoter_id ke NULL di sales (agar data pengajuan tetap ada)
      await supabase
        .from('sales')
        .update({ promoter_id: null })
        .eq('promoter_id', promoter.id);

      // 2. Set promoter_id ke NULL di vast_finance_applications
      await supabase
        .from('vast_finance_applications')
        .update({ promoter_id: null })
        .eq('promoter_id', promoter.id);

      // 3. Hapus dari promoters
      const { error: promoterError } = await supabase
        .from('promoters')
        .delete()
        .eq('id', promoter.id);

      if (promoterError) {
        throw promoterError;
      }

      // 4. Hapus user_profiles jika ada
      if (promoter.user_id) {
        await supabase
          .from('user_profiles')
          .delete()
          .eq('id', promoter.user_id);
      }

      alert(`Promotor "${promoter.name}" berhasil dihapus!\n\nData pengajuan di toko tetap tersimpan.`);
      fetchPromoters();
      fetchSators();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert('Gagal menghapus promotor: ' + message);
    }
  };

  const openEditModal = (promoter: Promoter) => {
    setSelectedPromoter(promoter);
    setFormData({
      name: promoter.name,
      sator: promoter.sator,
      store_id: promoter.store_id,
      category: promoter.category || 'official',
    });
    setShowEditModal(true);
  };

  const openResetPinModal = (promoter: Promoter) => {
    setSelectedPromoter(promoter);
    setShowResetPinModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sator: '',
      store_id: '',
      category: 'official',
    });
  };

  // Filter promoters
  const filteredPromoters = promoters.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.employee_id.toLowerCase().includes(search.toLowerCase()) ||
      p.sator.toLowerCase().includes(search.toLowerCase());

    const matchCategory = filterCategory === 'all' || p.category === filterCategory;
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && p.is_active) ||
      (filterStatus === 'inactive' && !p.is_active);

    return matchSearch && matchCategory && matchStatus;
  });

  const stats = {
    total: promoters.length,
    active: promoters.filter((p) => p.is_active).length,
    official: promoters.filter((p) => p.category === 'official').length,
    training: promoters.filter((p) => p.category === 'training').length,
  };

  if (!profile || (profile.role !== 'spv_area' && profile.role !== 'super_admin')) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Akses ditolak. Halaman ini hanya untuk SPV dan Super Admin.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-1.5">
        <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-100">
          <p className="text-base font-bold text-blue-600">{stats.total}</p>
          <p className="text-[10px] text-blue-600 font-medium">Total</p>
        </div>
        <div className="bg-green-50 rounded-lg p-2 text-center border border-green-100">
          <p className="text-base font-bold text-green-600">{stats.active}</p>
          <p className="text-[10px] text-green-600 font-medium">Aktif</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-2 text-center border border-purple-100">
          <p className="text-base font-bold text-purple-600">{stats.official}</p>
          <p className="text-[10px] text-purple-600 font-medium">Official</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-2 text-center border border-orange-100">
          <p className="text-base font-bold text-orange-600">{stats.training}</p>
          <p className="text-[10px] text-orange-600 font-medium">Training</p>
        </div>
        <div className="bg-indigo-50 rounded-lg p-2 text-center border border-indigo-100">
          <p className="text-base font-bold text-indigo-600">{stores.length}</p>
          <p className="text-[10px] text-indigo-600 font-medium">Toko</p>
        </div>
      </div>

      {/* Tabs + Add Button */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200 flex items-center justify-between px-2">
          <div className="flex">
            <button
              onClick={() => setActiveTab('promoters')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'promoters' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
              }`}
            >
              <Users size={14} className="inline mr-1" /> Promotor
            </button>
            <button
              onClick={() => setActiveTab('stores')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'stores' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
              }`}
            >
              <StoreIcon size={14} className="inline mr-1" /> Toko
            </button>
            {profile?.role === 'super_admin' && (
              <button
                onClick={() => setActiveTab('staff')}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'staff' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
                }`}
              >
                <Key size={14} className="inline mr-1" /> Staff
              </button>
            )}
          </div>
          {activeTab !== 'staff' && (
            <Button size="sm" onClick={() => activeTab === 'promoters' ? setShowAddModal(true) : setShowAddStoreModal(true)} className="text-xs py-1 h-7">
              <Plus size={14} className="mr-1" /> Tambah
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'promoters' && (
      <>
      {/* Compact Filters */}
      <div className="bg-white rounded-lg shadow-sm p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex-1 min-w-[150px] relative">
            <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, ID..."
              className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as any)}
            className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Kategori</option>
            <option value="official">Official</option>
            <option value="training">Training</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                  ID
                </th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                  Nama
                </th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                  Sator
                </th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                  Toko
                </th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                  Kategori
                </th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPromoters.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-xs text-gray-500">
                    Tidak ada promotor
                  </td>
                </tr>
              ) : (
                filteredPromoters.map((promoter) => (
                  <tr key={promoter.id} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-[10px] font-mono font-semibold text-gray-900">
                      {promoter.employee_id || '-'}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] text-gray-900 font-medium">{promoter.name}</td>
                    <td className="px-2 py-1.5 text-[10px] text-gray-600">{promoter.sator}</td>
                    <td className="px-2 py-1.5 text-[10px] text-gray-600">{promoter.store_name}</td>
                    <td className="px-2 py-1.5 text-[10px]">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          promoter.category === 'official'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {promoter.category}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-[10px]">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          promoter.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {promoter.is_active ? 'Aktif' : 'Off'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-[10px]">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(promoter)}
                          className="p-0.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => openResetPinModal(promoter)}
                          className="p-0.5 text-orange-600 hover:bg-orange-50 rounded"
                          title="Reset PIN"
                        >
                          <Key size={12} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(promoter)}
                          className={`p-0.5 rounded ${
                            promoter.is_active
                              ? 'text-yellow-600 hover:bg-yellow-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={promoter.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          {promoter.is_active ? <UserMinus size={12} /> : <UserCheck size={12} />}
                        </button>
                        <button
                          onClick={() => handleDeletePromoter(promoter)}
                          className="p-0.5 text-white bg-red-500 hover:bg-red-600 rounded"
                          title="Hapus Permanen"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Stores Tab */}
      {activeTab === 'stores' && (
        <>
          {/* Store Search */}
          <div className="bg-white rounded-lg shadow-sm p-2">
            <div className="flex-1 relative">
              <Search
                size={14}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                placeholder="Cari nama toko..."
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Stores Table */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                      No
                    </th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                      ID Toko
                    </th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                      Nama Toko
                    </th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                      Area
                    </th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStores.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-xs text-gray-500">
                        Tidak ada toko
                      </td>
                    </tr>
                  ) : (
                    filteredStores.map((store, index) => (
                      <tr key={store.id} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-[10px] text-gray-600 font-medium">{index + 1}</td>
                        <td className="px-2 py-1.5 text-[10px] font-mono font-semibold text-gray-900">{store.id}</td>
                        <td className="px-2 py-1.5 text-[10px] text-gray-900 font-medium">{store.name}</td>
                        <td className="px-2 py-1.5 text-[10px] text-gray-600">{store.area_detail || '-'}</td>
                        <td className="px-2 py-1.5 text-[10px]">
                          <button
                            onClick={() => openDeleteStoreModal(store)}
                            className="p-0.5 text-white bg-red-500 hover:bg-red-600 rounded"
                            title="Hapus Toko"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Staff Tab Content (Super Admin only) */}
      {activeTab === 'staff' && profile?.role === 'super_admin' && (
        <>
          {/* Search */}
          <div className="bg-white rounded-lg shadow-sm p-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="Cari nama atau email staff..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Staff Table */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Area</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        Tidak ada staff
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((staff) => (
                      <tr key={staff.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{staff.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{staff.email}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            staff.role === 'super_admin' ? 'bg-red-100 text-red-700' :
                            staff.role === 'manager_area' ? 'bg-purple-100 text-purple-700' :
                            staff.role === 'spv_area' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {getRoleLabel(staff.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{staff.area}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            staff.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {staff.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => {
                              setSelectedStaff(staff);
                              setShowResetPasswordModal(true);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1"
                            title="Reset Password"
                          >
                            <Key size={14} />
                            <span className="text-xs">Reset Password</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Reset Password</h2>
              <button 
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setSelectedStaff(null);
                  setNewPassword('');
                }} 
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Reset password untuk:</p>
              <p className="font-medium text-gray-900">{selectedStaff.name}</p>
              <p className="text-sm text-gray-500">{selectedStaff.email}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password Baru
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Password akan ditampilkan, pastikan catat sebelum menutup modal
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleResetPassword}
                  disabled={resettingPassword || newPassword.length < 6}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {resettingPassword ? 'Mereset...' : 'Reset Password'}
                </Button>
                <Button
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setSelectedStaff(null);
                    setNewPassword('');
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Batal
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Tambah Promotor Baru</h2>
              <button onClick={() => {setShowAddModal(false); resetForm();}} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddPromoter} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sator/Tutor</label>
                <select
                  value={formData.sator}
                  onChange={(e) => setFormData({ ...formData, sator: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Pilih Sator/Tutor</option>
                  {sators.map((sator) => (
                    <option key={sator.name} value={sator.name}>
                      {sator.name}
                    </option>
                  ))}
                </select>
                {sators.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Belum ada sator. Sator akan otomatis muncul dari data promoter yang ada.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Toko</label>
                <select
                  value={formData.store_id}
                  onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Pilih Toko</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="official">Official</option>
                  <option value="training">Training</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Tambah
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal - Similar structure to Add Modal */}
      {showEditModal && selectedPromoter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Promotor</h2>
              <button onClick={() => {setShowEditModal(false); setSelectedPromoter(null); resetForm();}} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleEditPromoter} className="space-y-4">
              {/* Same fields as Add Modal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sator/Tutor</label>
                <select
                  value={formData.sator}
                  onChange={(e) => setFormData({ ...formData, sator: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Pilih Sator/Tutor</option>
                  {sators.map((sator) => (
                    <option key={sator.name} value={sator.name}>
                      {sator.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Toko</label>
                <select
                  value={formData.store_id}
                  onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Pilih Toko</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="official">Official</option>
                  <option value="training">Training</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedPromoter(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset PIN Modal */}
      {showResetPinModal && selectedPromoter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Reset PIN</h2>
              <button onClick={() => {setShowResetPinModal(false); setSelectedPromoter(null);}} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              Reset PIN untuk <strong>{selectedPromoter.name}</strong>?
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Employee ID: {selectedPromoter.employee_id}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => handleResetPin('1234')}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                Reset ke 1234
              </Button>
              <Button
                type="button"
                onClick={() => {setShowResetPinModal(false); setSelectedPromoter(null);}}
                variant="secondary"
                className="flex-1"
              >
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Store Modal */}
      {showAddStoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Tambah Toko Baru</h2>
              <button onClick={() => {setShowAddStoreModal(false); setStoreFormData({ name: '' });}} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddStore} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Toko</label>
                <input
                  type="text"
                  value={storeFormData.name}
                  onChange={(e) => setStoreFormData({ name: e.target.value })}
                  required
                  placeholder="Contoh: Toko ABC"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                <input
                  type="text"
                  value={profile?.area || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Area otomatis sesuai dengan area Anda</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                  Tambah Toko
                </Button>
                <Button
                  type="button"
                  onClick={() => {setShowAddStoreModal(false); setStoreFormData({ name: '' });}}
                  variant="secondary"
                  className="flex-1"
                >
                  Batal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Store Modal */}
      {showDeleteStoreModal && selectedStore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-red-600">Hapus Toko</h2>
              <button onClick={() => {setShowDeleteStoreModal(false); setSelectedStore(null);}} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <p className="text-gray-600 mb-2">
              Yakin ingin menghapus toko <strong>{selectedStore.name}</strong>?
            </p>
            <p className="text-sm text-gray-500 mb-4">
              ID Toko: {selectedStore.id}
            </p>
            <p className="text-sm text-red-500 mb-4">
              Toko hanya bisa dihapus jika tidak ada promotor yang terdaftar di toko ini.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleDeleteStore}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Hapus Toko
              </Button>
              <Button
                type="button"
                onClick={() => {setShowDeleteStoreModal(false); setSelectedStore(null);}}
                variant="secondary"
                className="flex-1"
              >
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
