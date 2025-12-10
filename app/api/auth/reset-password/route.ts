import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  // Validate environment variables
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, message: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const targetUserId = body?.targetUserId;
    const newPassword = body?.newPassword;
    const adminUserId = body?.adminUserId;

    // Input validation
    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Invalid target user ID' },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password harus minimal 6 karakter' },
        { status: 400 }
      );
    }

    if (!adminUserId || typeof adminUserId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Invalid admin user ID' },
        { status: 400 }
      );
    }

    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify admin is super_admin
    const { data: adminProfile, error: adminError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', adminUserId)
      .single();

    if (adminError || !adminProfile) {
      return NextResponse.json(
        { success: false, message: 'Admin tidak ditemukan' },
        { status: 403 }
      );
    }

    if (adminProfile.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, message: 'Hanya Super Admin yang bisa reset password' },
        { status: 403 }
      );
    }

    // Get target user info
    const { data: targetProfile, error: targetError } = await supabase
      .from('user_profiles')
      .select('name, email, role')
      .eq('id', targetUserId)
      .single();

    if (targetError || !targetProfile) {
      return NextResponse.json(
        { success: false, message: 'User tidak ditemukan' },
        { status: 404 }
      );
    }

    // Prevent resetting super_admin password (except self)
    if (targetProfile.role === 'super_admin' && targetUserId !== adminUserId) {
      return NextResponse.json(
        { success: false, message: 'Tidak bisa reset password Super Admin lain' },
        { status: 403 }
      );
    }

    // Update password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateError) {
      return NextResponse.json(
        { success: false, message: 'Gagal reset password' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Password untuk ${targetProfile.name} berhasil direset`,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
