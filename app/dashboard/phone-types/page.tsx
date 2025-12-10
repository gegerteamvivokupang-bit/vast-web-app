'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2, Check, X, Smartphone } from 'lucide-react';

interface PhoneType {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function PhoneTypesManagementPage() {
  const { profile } = useAuth();
  const [phoneTypes, setPhoneTypes] = useState<PhoneType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [editTypeName, setEditTypeName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Only super admin can access this page
    if (profile && profile.role !== 'super_admin') {
      window.location.href = '/dashboard';
      return;
    }

    fetchPhoneTypes();
  }, [profile]);

  const fetchPhoneTypes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('phone_types')
        .select('*')
        .order('name');

      if (error) throw error;
      setPhoneTypes(data || []);
    } catch (error) {
      console.error('Error fetching phone types:', error);
      alert('Gagal memuat data tipe HP');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) {
      alert('Nama tipe HP tidak boleh kosong');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('phone_types').insert({
        name: newTypeName.trim(),
        is_active: true,
      });

      if (error) throw error;

      setNewTypeName('');
      setShowAddForm(false);
      fetchPhoneTypes();
      alert('Tipe HP berhasil ditambahkan');
    } catch (error) {
      console.error('Error adding phone type:', error);
      const err = error as { code?: string; message?: string };
      if (err.code === '23505') {
        alert('Tipe HP dengan nama ini sudah ada');
      } else {
        alert('Gagal menambahkan tipe HP: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editTypeName.trim()) {
      alert('Nama tipe HP tidak boleh kosong');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('phone_types')
        .update({ name: editTypeName.trim() })
        .eq('id', id);

      if (error) throw error;

      setEditingId(null);
      setEditTypeName('');
      fetchPhoneTypes();
      alert('Tipe HP berhasil diupdate');
    } catch (error) {
      console.error('Error updating phone type:', error);
      const err = error as { code?: string; message?: string };
      if (err.code === '23505') {
        alert('Tipe HP dengan nama ini sudah ada');
      } else {
        alert('Gagal mengupdate tipe HP: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('phone_types')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      fetchPhoneTypes();
    } catch (error) {
      console.error('Error toggling phone type status:', error);
      const err = error as { message?: string };
      alert('Gagal mengubah status: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Yakin ingin menghapus tipe HP "${name}"?\n\nPerhatian: Data yang sudah terkait dengan tipe HP ini tidak akan terhapus, namun tipe HP tidak akan bisa dipilih lagi.`)) {
      return;
    }

    setSubmitting(true);
    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('phone_types')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      fetchPhoneTypes();
      alert('Tipe HP berhasil dinonaktifkan');
    } catch (error) {
      console.error('Error deleting phone type:', error);
      const err = error as { message?: string };
      alert('Gagal menghapus tipe HP: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (phoneType: PhoneType) => {
    setEditingId(phoneType.id);
    setEditTypeName(phoneType.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTypeName('');
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
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Kelola tipe HP untuk form VAST Finance</p>
        <Button
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus size={16} className="mr-1" />
          Tambah
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tambah Tipe HP Baru</h3>
          <form onSubmit={handleAdd} className="flex gap-3">
            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="Contoh: Y04 SERIES"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={submitting}
              autoFocus
            />
            <Button
              type="submit"
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Check size={20} className="mr-2" />
              Simpan
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewTypeName('');
              }}
              disabled={submitting}
              className="bg-gray-500 hover:bg-gray-600 text-white"
            >
              <X size={20} className="mr-2" />
              Batal
            </Button>
          </form>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Smartphone className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-1">Informasi</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Tipe HP yang ditambahkan akan otomatis tersedia untuk semua promoter</li>
              <li>• Tipe HP yang dinonaktifkan tidak akan muncul di form input</li>
              <li>• Data pengajuan yang sudah menggunakan tipe HP tertentu tetap tersimpan meskipun tipe HP dinonaktifkan</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Phone Types List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            Daftar Tipe HP ({phoneTypes.length})
          </h3>
        </div>

        {phoneTypes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Smartphone size={48} className="mx-auto mb-3 text-gray-300" />
            <p>Belum ada tipe HP yang ditambahkan</p>
            <p className="text-sm mt-1">Klik tombol “Tambah Tipe HP” untuk menambahkan</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {phoneTypes.map((phoneType) => (
              <div
                key={phoneType.id}
                className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                  !phoneType.is_active ? 'opacity-60' : ''
                }`}
              >
                {editingId === phoneType.id ? (
                  // Edit Mode
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={editTypeName}
                      onChange={(e) => setEditTypeName(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={submitting}
                      autoFocus
                    />
                    <Button
                      onClick={() => handleEdit(phoneType.id)}
                      disabled={submitting}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      <Check size={16} />
                    </Button>
                    <Button
                      onClick={cancelEdit}
                      disabled={submitting}
                      className="bg-gray-500 hover:bg-gray-600 text-white"
                      size="sm"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Smartphone
                        size={20}
                        className={phoneType.is_active ? 'text-blue-600' : 'text-gray-400'}
                      />
                      <div>
                        <h4 className="font-medium text-gray-900">{phoneType.name}</h4>
                        <p className="text-xs text-gray-500">
                          Dibuat: {new Date(phoneType.created_at).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status Badge */}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          phoneType.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {phoneType.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>

                      {/* Action Buttons */}
                      <Button
                        onClick={() => handleToggleActive(phoneType.id, phoneType.is_active)}
                        disabled={submitting}
                        className={`${
                          phoneType.is_active
                            ? 'bg-yellow-600 hover:bg-yellow-700'
                            : 'bg-green-600 hover:bg-green-700'
                        } text-white`}
                        size="sm"
                      >
                        {phoneType.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>

                      <Button
                        onClick={() => startEdit(phoneType)}
                        disabled={submitting}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        size="sm"
                      >
                        <Edit2 size={16} />
                      </Button>

                      {phoneType.is_active && (
                        <Button
                          onClick={() => handleDelete(phoneType.id, phoneType.name)}
                          disabled={submitting}
                          className="bg-red-600 hover:bg-red-700 text-white"
                          size="sm"
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
