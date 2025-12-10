import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'vast-auth',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  // Service worker is already configured to skip Supabase requests (NetworkOnly)
  // No need for custom fetch that breaks auth headers
});

// Database Types
export interface Store {
  id: string;
  name: string;
  area_detail: string;
  created_at?: string;
}

export interface Promoter {
  id: string;
  name: string;
  sator: string;
  target: number;
  store_id: string;
  is_active: boolean;
  created_at?: string;
}

export interface Sale {
  id: string;
  sale_date: string;
  promoter_name: string;
  status: 'ACC' | 'Pending' | 'Reject';
  phone_type: string;
  store_id: string;
  image_url?: string;
  image_public_id?: string;
  created_at?: string;
  deleted_at?: string;
}

export interface ImageCleanupLog {
  id: string;
  deleted_count: number;
  deleted_date: string;
}

// User Profile Type (untuk RBAC)
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'manager_area' | 'spv_area' | 'sator';
  area: 'ALL' | 'KUPANG' | 'KABUPATEN' | 'SUMBA';
  sator_name: string | null;
  can_view_other_sators: string[] | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Phone Type (untuk dropdown tipe HP di VAST Finance)
export interface PhoneType {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

// VAST Finance Application
export interface VastFinanceApplication {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_ktp_image_url?: string;
  customer_ktp_image_public_id?: string;
  pekerjaan: 'PNS' | 'Pegawai Swasta' | 'Buruh' | 'Pelajar' | 'IRT' | 'Tidak Bekerja';
  penghasilan?: number;
  has_npwp: boolean;
  status_pengajuan: 'ACC' | 'Belum disetujui' | 'Dapat limit tapi belum proses';
  limit_amount?: number;
  phone_type_id?: string;
  proof_image_url?: string;
  proof_image_public_id?: string;
  promoter_id?: string;
  promoter_name?: string;
  store_id?: string; // TEXT type to match stores.id
  created_by_user_id: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
}

// Pending Conversion (untuk track pending yang jadi closing)
export interface PendingConversion {
  id: string;
  application_id: string;
  customer_name: string;
  customer_phone: string;
  converted_by_user_id: string;
  converted_by_name: string;
  converted_at: string;
  old_dp_amount?: number;
  new_dp_amount?: number;
  limit_amount: number;
  tenor: number;
  phone_type_id?: string;
  phone_type_name?: string;
  sale_date: string;
  store_id?: string;
  store_name?: string;
  created_at?: string;
  updated_at?: string;
}

// Fetch user profile from user_profiles table
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    return null;
  }

  return data;
}
