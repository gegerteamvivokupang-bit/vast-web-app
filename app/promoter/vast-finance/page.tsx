'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getTodayWITA } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Camera, Upload, CheckCircle, Loader2, X as CloseIcon } from 'lucide-react';

interface PromoterSession {
  user_id: string;
  name: string;
  area: string;
  employee_id: string;
}

interface Promoter {
  id: string;
  name: string;
  store_id: string;
}

interface PhoneType {
  id: string;
  name: string;
}

export default function VastFinanceInputPage() {
  const router = useRouter();
  const [session, setSession] = useState<PromoterSession | null>(null);
  const [promoter, setPromoter] = useState<Promoter | null>(null);
  const [phoneTypes, setPhoneTypes] = useState<PhoneType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingKtp, setUploadingKtp] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form state - Basic Info
  const [saleDate, setSaleDate] = useState(getTodayWITA());
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [ktpImage, setKtpImage] = useState<File | null>(null);
  const [ktpImagePreview, setKtpImagePreview] = useState('');
  const [ktpImageUrl, setKtpImageUrl] = useState('');
  const [ktpImagePublicId, setKtpImagePublicId] = useState('');

  // Form state - Employment & Financial
  const [pekerjaan, setPekerjaan] = useState('');
  const [penghasilan, setPenghasilan] = useState('');
  const [hasNpwp, setHasNpwp] = useState(false);

  // Form state - Application Status
  const [statusPengajuan, setStatusPengajuan] = useState('');

  // Form state - Conditional (A) - Only if ACC
  const [limitAmount, setLimitAmount] = useState('');
  const [dpAmount, setDpAmount] = useState('');
  const [tenor, setTenor] = useState('');
  const [phoneTypeId, setPhoneTypeId] = useState('');


  const [proofImage, setProofImage] = useState<File | null>(null);
  const [proofImagePreview, setProofImagePreview] = useState('');
  const [proofImageUrl, setProofImageUrl] = useState('');
  const [proofImagePublicId, setProofImagePublicId] = useState('');

  useEffect(() => {
    // Check session
    const sessionData = localStorage.getItem('promoter_session');
    if (!sessionData) {
      router.push('/login');
      return;
    }

    const parsedSession = JSON.parse(sessionData);
    setSession(parsedSession);

    // Fetch promoter data and phone types
    fetchPromoterData(parsedSession.user_id);
    fetchPhoneTypes();
  }, [router]);

  const fetchPromoterData = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('promoters')
        .select('id, name, store_id')
        .eq('user_id', userId)
        .single();

      if (data) {
        setPromoter(data);
      }
    } catch (error) {
      console.error('Error fetching promoter:', error);
    }
  };

  const fetchPhoneTypes = async () => {
    try {
      const { data } = await supabase
        .from('phone_types')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      setPhoneTypes(data || []);
    } catch (error) {
      console.error('Error fetching phone types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKtpImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setKtpImage(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setKtpImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Auto upload to Cloudinary
      await uploadKtpToCloudinary(file);
    }
  };

  const uploadKtpToCloudinary = async (file: File) => {
    setUploadingKtp(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'vast-finance/ktp');

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        setKtpImageUrl(result.url);
        setKtpImagePublicId(result.publicId);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error uploading KTP:', error);
      alert('Gagal upload foto KTP: ' + error.message);
    } finally {
      setUploadingKtp(false);
    }
  };

  const handleProofImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofImage(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Auto upload to Cloudinary
      await uploadProofToCloudinary(file);
    }
  };

  const uploadProofToCloudinary = async (file: File) => {
    setUploadingProof(true);
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
        setProofImageUrl(result.url);
        setProofImagePublicId(result.publicId);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error uploading proof:', error);
      alert('Gagal upload foto bukti: ' + error.message);
    } finally {
      setUploadingProof(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !promoter) return;

    // Validation
    if (!customerName || !customerPhone || !pekerjaan || !statusPengajuan) {
      alert('Mohon lengkapi semua field yang wajib diisi');
      return;
    }

    // Validation for ACC status
    if (statusPengajuan === 'ACC') {
      if (!limitAmount || !phoneTypeId) {
        alert('Untuk status ACC, mohon isi Limit dan Tipe HP yang diambil');
        return;
      }
    }

    setSubmitting(true);

    try {
      // 1. Insert to vast_finance_applications
      const { error } = await supabase.from('vast_finance_applications').insert({
        sale_date: saleDate,
        customer_name: customerName,
        customer_phone: `+62${customerPhone}`,
        customer_ktp_image_url: ktpImageUrl,
        customer_ktp_image_public_id: ktpImagePublicId,
        pekerjaan,
        penghasilan: penghasilan ? parseFloat(penghasilan.replace(/\./g, '')) : null,
        has_npwp: hasNpwp,
        status_pengajuan: statusPengajuan,
        limit_amount: statusPengajuan === 'ACC' && limitAmount ? parseFloat(limitAmount.replace(/\./g, '')) : null,
        dp_amount: (statusPengajuan === 'ACC' || statusPengajuan === 'Dapat limit tapi belum proses') && dpAmount !== '' ? parseFloat(dpAmount.replace(/\./g, '')) : null,
        tenor: statusPengajuan === 'ACC' && tenor ? parseInt(tenor) : null,
        phone_type_id: statusPengajuan === 'ACC' ? phoneTypeId : null,
        proof_image_url: statusPengajuan === 'ACC' ? proofImageUrl : null,
        proof_image_public_id: statusPengajuan === 'ACC' ? proofImagePublicId : null,
        promoter_id: promoter.id,
        promoter_name: promoter.name,
        store_id: promoter.store_id,
        created_by_user_id: session.user_id,
      });

      if (error) throw error;

      // Show success
      setSuccess(true);

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/promoter');
      }, 2000);
    } catch (error: any) {
      console.error('Error submitting:', error);
      alert('Gagal submit pengajuan: ' + error.message);
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: string) => {
    // Remove non-numeric characters
    const numericValue = value.replace(/\D/g, '');
    // Format with thousand separators
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handlePenghasilanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setPenghasilan(formatted);
  };

  const handleLimitAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setLimitAmount(formatted);
  };

  const handleDpAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setDpAmount(formatted);
  };

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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50/30 to-green-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 text-center max-w-md w-full border-2 border-green-100 animate-fade-in">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <CheckCircle size={48} className="text-white" strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Berhasil!</h2>
          <p className="text-gray-600 mb-8 leading-relaxed text-lg">Pengajuan VAST Finance berhasil disimpan</p>
          <Button
            onClick={() => router.push('/promoter')}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-4 text-lg font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-95"
          >
            Kembali ke Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Show conditional sections based on status
  const showSectionA = statusPengajuan === 'ACC';
  const showSectionB = statusPengajuan === 'Belum disetujui';
  const showSectionC = statusPengajuan === 'Dapat limit tapi belum proses';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50/20 to-gray-50">
      {/* Header - Modern */}
      <div className="bg-gradient-to-br from-green-600 via-green-600 to-emerald-700 text-white p-4 sticky top-0 z-10 shadow-xl">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-3 hover:bg-white/20 active:scale-95 rounded-xl transition-all backdrop-blur-sm border border-white/20"
          >
            <ArrowLeft size={24} strokeWidth={2.5} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Form VAST Finance</h1>
            <p className="text-sm text-green-100 font-medium">{session?.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 pb-24">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Tanggal Pengajuan */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 animate-fade-in">
            <label className="block text-sm font-bold text-gray-900 mb-3">
              📅 Tanggal Pengajuan
            </label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="w-full px-5 py-3.5 border-2 border-gray-200 rounded-xl text-base font-medium focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
              required
            />
          </div>

          {/* Data Pemohon */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 animate-fade-in">
            <h2 className="font-bold text-gray-900 text-lg mb-5 flex items-center gap-2">
              <span className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-8 h-8 rounded-xl flex items-center justify-center text-sm">1</span>
              Data Pemohon
            </h2>

            {/* Nama */}
            <div className="mb-5">
              <label className="block text-sm font-bold text-gray-900 mb-3">
                Nama (sesuai KTP) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                className="w-full px-5 py-3.5 border-2 border-gray-200 rounded-xl text-base font-medium focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all uppercase"
                placeholder="NAMA LENGKAP SESUAI KTP"
                required
              />
            </div>

            {/* No Tlp */}
            <div className="mb-5">
              <label className="block text-sm font-bold text-gray-900 mb-3">
                No Telp Pemohon <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-5 top-4 text-gray-500 font-semibold">+62</span>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.startsWith('62')) {
                      value = value.substring(2);
                    } else if (value.startsWith('0')) {
                      value = value.substring(1);
                    }
                    setCustomerPhone(value);
                  }}
                  className="w-full pl-16 pr-5 py-3.5 border-2 border-gray-200 rounded-xl text-base font-medium focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  placeholder="8xxxxxxxxxx"
                  required
                />
              </div>
            </div>

            {/* Foto KTP */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-3">
                📷 Foto KTP
              </label>
              {ktpImagePreview ? (
                <div className="relative group">
                  <img
                    src={ktpImagePreview}
                    alt="Preview KTP"
                    className="w-full h-56 object-cover rounded-2xl border-2 border-gray-200 shadow-md"
                  />
                  {uploadingKtp && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="animate-spin text-white mx-auto mb-2" size={40} strokeWidth={2.5} />
                        <p className="text-white font-semibold text-sm">Uploading...</p>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setKtpImage(null);
                      setKtpImagePreview('');
                      setKtpImageUrl('');
                      setKtpImagePublicId('');
                    }}
                    className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white p-2.5 rounded-xl transition-all active:scale-95 shadow-lg opacity-0 group-hover:opacity-100"
                  >
                    <CloseIcon size={18} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition-all active:scale-[0.99]">
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="bg-gray-100 p-4 rounded-2xl mb-3">
                      <Camera size={36} className="text-gray-500" strokeWidth={2} />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Klik untuk upload foto KTP</p>
                    <p className="text-xs text-gray-500 mt-1">JPG, PNG (Max 5MB)</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleKtpImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Data Pekerjaan & Keuangan */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 animate-fade-in">
            <h2 className="font-bold text-gray-900 text-lg mb-5 flex items-center gap-2">
              <span className="bg-gradient-to-br from-green-500 to-emerald-600 text-white w-8 h-8 rounded-xl flex items-center justify-center text-sm">2</span>
              Data Pekerjaan & Keuangan
            </h2>

            {/* Pekerjaan */}
            <div className="mb-5">
              <label className="block text-sm font-bold text-gray-900 mb-3">
                Pekerjaan <span className="text-red-500">*</span>
              </label>
              <select
                value={pekerjaan}
                onChange={(e) => setPekerjaan(e.target.value)}
                className={`w-full px-5 py-3.5 border-2 border-gray-200 rounded-xl text-base font-medium focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all ${!pekerjaan ? 'text-gray-400' : 'text-gray-900'}`}
                required
              >
                <option value="" disabled className="text-gray-400">Pilih Pekerjaan</option>
                <option value="PNS">PNS</option>
                <option value="Pegawai Swasta">Pegawai Swasta</option>
                <option value="Buruh">Buruh</option>
                <option value="Pelajar">Pelajar</option>
                <option value="IRT">IRT</option>
                <option value="Tidak Bekerja">Tidak Bekerja</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            {/* Penghasilan */}
            <div className="mb-5">
              <label className="block text-sm font-bold text-gray-900 mb-3">
                Penghasilan (per bulan)
              </label>
              <div className="relative">
                <span className="absolute left-5 top-4 text-gray-500 font-semibold">Rp</span>
                <input
                  type="text"
                  value={penghasilan}
                  onChange={handlePenghasilanChange}
                  className="w-full pl-14 pr-5 py-3.5 border-2 border-gray-200 rounded-xl text-base font-medium focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  placeholder="0"
                />
              </div>
            </div>

            {/* NPWP */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-3">
                NPWP
              </label>
              <div className="flex gap-3">
                <label className="flex-1 flex items-center justify-center gap-3 cursor-pointer bg-gradient-to-br from-gray-50 to-gray-100/50 border-2 border-gray-200 rounded-xl p-4 transition-all hover:border-green-300 hover:bg-green-50/50 has-[:checked]:border-green-500 has-[:checked]:bg-green-50 has-[:checked]:shadow-md">
                  <input
                    type="radio"
                    name="npwp"
                    checked={hasNpwp === true}
                    onChange={() => setHasNpwp(true)}
                    className="w-5 h-5 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm font-bold text-gray-900">Ada</span>
                </label>
                <label className="flex-1 flex items-center justify-center gap-3 cursor-pointer bg-gradient-to-br from-gray-50 to-gray-100/50 border-2 border-gray-200 rounded-xl p-4 transition-all hover:border-green-300 hover:bg-green-50/50 has-[:checked]:border-green-500 has-[:checked]:bg-green-50 has-[:checked]:shadow-md">
                  <input
                    type="radio"
                    name="npwp"
                    checked={hasNpwp === false}
                    onChange={() => setHasNpwp(false)}
                    className="w-5 h-5 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm font-bold text-gray-900">Tidak Ada</span>
                </label>
              </div>
            </div>
          </div>

          {/* Status Pengajuan */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 animate-fade-in">
            <h2 className="font-bold text-gray-900 text-lg mb-5 flex items-center gap-2">
              <span className="bg-gradient-to-br from-yellow-500 to-orange-600 text-white w-8 h-8 rounded-xl flex items-center justify-center text-sm">3</span>
              Status Pengajuan
            </h2>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-3">
                Status Pengajuan <span className="text-red-500">*</span>
              </label>
              <select
                value={statusPengajuan}
                onChange={(e) => setStatusPengajuan(e.target.value)}
                className={`w-full px-5 py-3.5 border-2 border-gray-200 rounded-xl text-base font-medium focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all ${!statusPengajuan ? 'text-gray-400' : 'text-gray-900'}`}
                required
              >
                <option value="" disabled className="text-gray-400">Pilih Status</option>
                <option value="ACC">ACC</option>
                <option value="Belum disetujui">Belum disetujui</option>
                <option value="Dapat limit tapi belum proses">Dapat limit tapi belum proses</option>
              </select>
            </div>

            {/* Info Status */}
            {statusPengajuan && (
              <div className={`p-4 rounded-2xl border-2 mt-4 ${
                statusPengajuan === 'ACC' ? 'bg-gradient-to-br from-green-50 to-green-100/50 border-green-300' :
                statusPengajuan === 'Belum disetujui' ? 'bg-gradient-to-br from-red-50 to-red-100/50 border-red-300' :
                'bg-gradient-to-br from-yellow-50 to-yellow-100/50 border-yellow-300'
              }`}>
                <p className="text-sm font-medium text-gray-700">
                  {statusPengajuan === 'ACC' && 'Status ACC - Mohon lengkapi data limit dan tipe HP'}
                  {statusPengajuan === 'Belum disetujui' && 'Status Reject - Form akan selesai setelah submit'}
                  {statusPengajuan === 'Dapat limit tapi belum proses' && 'Dapat limit tapi belum proses - Form akan selesai setelah submit'}
                </p>
              </div>
            )}
          </div>

          {/* Section A - Only if ACC */}
          {showSectionA && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg shadow-sm p-4">
              <h2 className="font-semibold text-green-900 mb-4">Data ACC</h2>

              {/* Limit yang didapatkan */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Limit yang didapatkan <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-gray-500">Rp</span>
                  <input
                    type="text"
                    value={limitAmount}
                    onChange={handleLimitAmountChange}
                    className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    required={showSectionA}
                  />
                </div>
              </div>

              {/* DP yang diberikan */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Berapa DP yang diberikan?
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-gray-500">Rp</span>
                  <input
                    type="text"
                    value={dpAmount}
                    onChange={handleDpAmountChange}
                    className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Tenor */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tenor
                </label>
                <select
                  value={tenor}
                  onChange={(e) => setTenor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipe HP yang diambil <span className="text-red-500">*</span>
                </label>
                <select
                  value={phoneTypeId}
                  onChange={(e) => setPhoneTypeId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={showSectionA}
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
                    Belum ada tipe HP. Hubungi admin untuk menambahkan tipe HP.
                  </p>
                )}
              </div>

              {/* Upload Foto Bukti */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Foto Bukti Pengajuan
                </label>
                {proofImagePreview ? (
                  <div className="relative">
                    <img
                      src={proofImagePreview}
                      alt="Preview Bukti"
                      className="w-full h-48 object-cover rounded-lg mb-2"
                    />
                    {uploadingProof && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <Loader2 className="animate-spin text-white" size={32} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setProofImage(null);
                        setProofImagePreview('');
                        setProofImageUrl('');
                        setProofImagePublicId('');
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
                      onChange={handleProofImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Section B - Reject */}
          {showSectionB && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg shadow-sm p-4">
              <p className="text-sm text-red-800">
                Pengajuan ditolak. Klik tombol Submit untuk menyimpan data.
              </p>
            </div>
          )}

          {/* Section C - Dapat limit tapi belum proses */}
          {showSectionC && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg shadow-sm p-4">
              <h2 className="font-semibold text-yellow-900 mb-4">Dapat Limit Tapi Belum Proses</h2>

              {/* DP yang diberikan sistem */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  DP yang diberikan sistem
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-gray-500">Rp</span>
                  <input
                    type="text"
                    value={dpAmount}
                    onChange={handleDpAmountChange}
                    className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-6">
            <Button
              type="submit"
              disabled={submitting || uploadingKtp || uploadingProof}
              className="w-full bg-gradient-to-r from-green-600 via-green-600 to-emerald-600 hover:from-green-700 hover:via-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white py-6 text-lg font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-200 active:scale-[0.98] border-2 border-green-400 disabled:border-gray-300"
            >
              {submitting ? (
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="animate-spin" size={24} strokeWidth={2.5} />
                  <span>Menyimpan...</span>
                </div>
              ) : uploadingKtp || uploadingProof ? (
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="animate-spin" size={24} strokeWidth={2.5} />
                  <span>Uploading Foto...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <div className="bg-white/20 p-1.5 rounded-xl">
                    <Upload size={22} strokeWidth={2.5} />
                  </div>
                  <span>Submit Pengajuan</span>
                </div>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
